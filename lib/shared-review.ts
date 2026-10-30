import { z } from "zod";
import { reviewDraft } from "../components/brandcheck/review";
import { seedSources, seedTerms } from "../components/brandcheck/model";

export type Identity = { userId: string; email: string };
type Member = { role: "admin" | "creator" | "reviewer" };
type Draft = { id: string; workspace_id: string; author_id: string; title: string; body: string; version: number; state: string; updated_at: string; mutation: string };
export class ReviewError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const id = z.string().uuid();
const version = z.number().int().min(1).max(1_000_000);
const content = { title: z.string().trim().min(1).max(100), body: z.string().max(5_000) };
export const sharedAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createWorkspace"), name: z.string().trim().min(1).max(100) }),
  z.object({ action: z.literal("invite"), workspaceId: id, email: z.string().email().max(254), role: z.enum(["creator", "reviewer"]) }),
  z.object({ action: z.literal("createDraft"), workspaceId: id, ...content }),
  z.object({ action: z.literal("saveDraft"), workspaceId: id, draftId: id, version, ...content }),
  z.object({ action: z.literal("submit"), workspaceId: id, draftId: id, version }),
  z.object({ action: z.literal("comment"), workspaceId: id, draftId: id, version, note: z.string().trim().min(1).max(2_000) }),
  z.object({ action: z.literal("decide"), workspaceId: id, draftId: id, version, decision: z.enum(["approved", "changes_requested"]), note: z.string().trim().min(1).max(2_000) }),
]);
type Action = z.infer<typeof sharedAction>;
function email(user: Identity) { return user.email.toLowerCase().trim(); }
async function membership(db: D1Database, user: Identity, workspaceId: string): Promise<Member> {
  const found = await db.prepare("SELECT role FROM memberships WHERE workspace_id = ? AND email = ?").bind(workspaceId, email(user)).first<Member>();
  if (!found) throw new ReviewError(404, "Workspace not found or access denied.");
  return found;
}
function event(db: D1Database, user: Identity, workspaceId: string, action: string, detail: unknown, draftId: string | null = null, v: number | null = null) {
  return db.prepare("INSERT INTO audit_events (id, workspace_id, draft_id, actor_id, actor_email, action, version, detail, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), workspaceId, draftId, user.userId, email(user), action, v, JSON.stringify(detail), new Date().toISOString());
}
export async function listWorkspaces(db: D1Database, user: Identity) {
  return (await db.prepare("SELECT w.id, w.name, m.role FROM workspaces w JOIN memberships m ON w.id = m.workspace_id WHERE m.email = ? ORDER BY w.created_at DESC LIMIT 100").bind(email(user)).all()).results;
}
export async function readWorkspace(db: D1Database, user: Identity, workspaceId: string) {
  id.parse(workspaceId);
  const member = await membership(db, user, workspaceId);
  const result = await db.batch([
    db.prepare("SELECT id, title, body, version, state, author_id, updated_at FROM shared_drafts WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 100").bind(workspaceId),
    db.prepare("SELECT id, draft_id, actor_email, action, version, detail, created_at FROM audit_events WHERE workspace_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 200").bind(workspaceId),
    db.prepare("SELECT email, role FROM memberships WHERE workspace_id = ? ORDER BY role, email LIMIT 100").bind(workspaceId),
  ]);
  return { role: member.role, drafts: result[0].results, events: result[1].results, members: result[2].results };
}
export async function mutateWorkspace(db: D1Database, user: Identity, input: unknown) {
  const action: Action = sharedAction.parse(input);
  const now = new Date().toISOString();
  if (action.action === "createWorkspace") {
    // Bound per-identity workspace creation, including concurrent requests.
    const workspaceId = crypto.randomUUID();
    const result = await db.batch([
      db.prepare("INSERT INTO workspaces (id, name, created_at) SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM memberships WHERE email = ? AND role = 'admin') < 5").bind(workspaceId, action.name, now, email(user)),
      db.prepare("INSERT INTO memberships (workspace_id, email, role) SELECT ?, ?, 'admin' WHERE EXISTS (SELECT 1 FROM workspaces WHERE id = ?)").bind(workspaceId, email(user), workspaceId),
      db.prepare("INSERT INTO audit_events (id, workspace_id, actor_id, actor_email, action, detail, created_at) SELECT ?, ?, ?, ?, 'workspace_created', ?, ? WHERE EXISTS (SELECT 1 FROM workspaces WHERE id = ?)").bind(crypto.randomUUID(), workspaceId, user.userId, email(user), JSON.stringify({ name: action.name }), now, workspaceId),
    ]);
    if (!result[0].meta.changes) throw new ReviewError(409, "You can create up to five workspaces.");
    return { workspaceId };
  }
  const member = await membership(db, user, action.workspaceId);
  if (action.action === "invite") {
    if (member.role !== "admin") throw new ReviewError(403, "Only workspace admins can grant access.");
    const invitedEmail = action.email.toLowerCase().trim();
    if (invitedEmail === email(user)) throw new ReviewError(400, "Your administrator membership cannot be changed here.");
    const existing = await db.prepare("SELECT role FROM memberships WHERE workspace_id = ? AND email = ?").bind(action.workspaceId, invitedEmail).first<Member>();
    if (existing) throw new ReviewError(409, "That member already has access. Role changes are not supported in this release.");
    await db.batch([
      db.prepare("INSERT INTO memberships (workspace_id, email, role) VALUES (?, ?, ?)").bind(action.workspaceId, invitedEmail, action.role),
      event(db, user, action.workspaceId, "member_granted", { email: invitedEmail, role: action.role }),
    ]);
    return { granted: true };
  }
  if (action.action === "createDraft") {
    if (member.role === "reviewer") throw new ReviewError(403, "Reviewers cannot create drafts.");
    const draftId = crypto.randomUUID();
    const token = crypto.randomUUID();
    const result = await db.batch([
      db.prepare("INSERT INTO shared_drafts (id, workspace_id, author_id, title, body, version, state, updated_at, mutation) SELECT ?, ?, ?, ?, ?, 1, 'draft', ?, ? WHERE (SELECT COUNT(*) FROM shared_drafts WHERE workspace_id = ?) < 100").bind(draftId, action.workspaceId, user.userId, action.title, action.body, now, token, action.workspaceId),
      db.prepare("INSERT INTO audit_events (id, workspace_id, draft_id, actor_id, actor_email, action, version, detail, created_at) SELECT ?, ?, ?, ?, ?, 'draft_created', 1, ?, ? WHERE EXISTS (SELECT 1 FROM shared_drafts WHERE id = ?)").bind(crypto.randomUUID(), action.workspaceId, draftId, user.userId, email(user), JSON.stringify(contentSnapshot(action)), now, draftId),
    ]);
    if (!result[0].meta.changes) throw new ReviewError(409, "This workspace has reached its 100-draft limit.");
    return { draftId };
  }
  const draft = await db.prepare("SELECT * FROM shared_drafts WHERE id = ? AND workspace_id = ?").bind(action.draftId, action.workspaceId).first<Draft>();
  if (!draft) throw new ReviewError(404, "Draft not found.");
  if (draft.version !== action.version) throw new ReviewError(409, "This draft has changed. Refresh before continuing.");
  if (action.action === "comment") {
    const result = await db.prepare("INSERT INTO audit_events (id, workspace_id, draft_id, actor_id, actor_email, action, version, detail, created_at) SELECT ?, ?, ?, ?, ?, 'comment', ?, ?, ? WHERE EXISTS (SELECT 1 FROM shared_drafts WHERE id = ? AND workspace_id = ? AND version = ?)").bind(crypto.randomUUID(), action.workspaceId, draft.id, user.userId, email(user), draft.version, JSON.stringify({ note: action.note }), now, draft.id, action.workspaceId, draft.version).run();
    if (!result.meta.changes) throw new ReviewError(409, "This draft has changed. Refresh before commenting.");
    return { commented: true };
  }
  let nextState = draft.state;
  let title = draft.title;
  let body = draft.body;
  let detail: unknown;
  if (action.action === "decide") {
    if (member.role !== "reviewer" && member.role !== "admin") throw new ReviewError(403, "Only reviewers can decide.");
    if (draft.author_id === user.userId) throw new ReviewError(403, "You cannot approve or review your own draft.");
    if (draft.state !== "submitted") throw new ReviewError(409, "Only a submitted revision can receive a decision.");
    nextState = action.decision;
    detail = { note: action.note, reviewedVersion: draft.version, snapshot: contentSnapshot(draft) };
  } else {
    if (member.role === "reviewer" || draft.author_id !== user.userId) throw new ReviewError(403, "Only the original creator can edit or submit this draft.");
    if (action.action === "submit") {
      if (draft.state !== "draft") throw new ReviewError(409, "Save a new draft revision before submitting.");
      if (!draft.body.trim()) throw new ReviewError(400, "Add content before submitting.");
      nextState = "submitted";
      const findings = reviewDraft({ title: draft.title, text: draft.body, channel: "Shared draft", audience: "General", image: null }, seedSources, seedTerms);
      detail = { snapshot: contentSnapshot(draft), reviewMode: "rules", brandPack: "NovaDesk demonstration pack", sources: seedSources, findings };
    } else {
      if (draft.state === "submitted") throw new ReviewError(409, "This revision is awaiting review. A reviewer must request changes before it can be edited.");
      title = action.title; body = action.body; nextState = "draft";
      detail = { snapshot: { title, body }, previousState: draft.state };
    }
  }
  // Compare-and-swap and event are one D1 transaction. A unique mutation token prevents
  // a losing concurrent request from recording an approval/event it did not perform.
  const token = crypto.randomUUID();
  const results = await db.batch([
    db.prepare("UPDATE shared_drafts SET title = ?, body = ?, state = ?, version = version + 1, updated_at = ?, mutation = ? WHERE id = ? AND workspace_id = ? AND version = ?").bind(title, body, nextState, now, token, draft.id, action.workspaceId, action.version),
    db.prepare("INSERT INTO audit_events (id, workspace_id, draft_id, actor_id, actor_email, action, version, detail, created_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM shared_drafts WHERE id = ? AND mutation = ?)").bind(crypto.randomUUID(), action.workspaceId, draft.id, user.userId, email(user), action.action === "decide" ? action.decision : action.action, action.version + 1, JSON.stringify(detail), now, draft.id, token),
  ]);
  if (!results[0].meta.changes) throw new ReviewError(409, "Another person changed this revision. Refresh before continuing.");
  return { draftId: draft.id, version: action.version + 1, state: nextState };
}
function contentSnapshot(value: { title: string; body: string }) { return { title: value.title, body: value.body }; }
