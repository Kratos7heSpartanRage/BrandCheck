// Execute the actual TypeScript service and generated SQL against SQLite, using
// a transaction-capable D1 adapter. No cloud credentials or production data.
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import ts from "typescript";

const directory = resolve("work/shared-tests");
await mkdir(directory, { recursive: true });
for (const [source, name] of [["lib/shared-review.ts", "shared-review"], ["components/brandcheck/review.ts", "review"], ["components/brandcheck/model.ts", "model"], ["components/brandcheck/aiReview.ts", "aiReview"]]) {
  let compiled = ts.transpileModule(await readFile(source, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  compiled = compiled.replace(/"(?:\.\.\/components\/brandcheck\/|\.\/)(review|model|aiReview)"/g, '"./$1.mjs"');
  await writeFile(resolve(directory, `${name}.mjs`), compiled);
}
const { mutateWorkspace: mutate, readWorkspace: read, listWorkspaces: list } = await import(pathToFileURL(resolve(directory, "shared-review.mjs")).href);
const owner = { userId: "owner", email: "owner@example.com" };
const creator = { userId: "creator", email: "creator@example.com" };
const reviewer = { userId: "reviewer", email: "reviewer@example.com" };
const stranger = { userId: "stranger", email: "stranger@example.com" };
async function fixture() {
  const sql = new DatabaseSync(":memory:"); sql.exec("PRAGMA foreign_keys = ON");
  for (const filename of (await readdir("drizzle")).filter(f => f.endsWith(".sql")).sort()) sql.exec(await readFile(`drizzle/${filename}`, "utf8"));
  class Statement {
    constructor(query, values = []) { this.query = query; this.values = values; }
    bind(...values) { return new Statement(this.query, values); }
    async first() { return sql.prepare(this.query).get(...this.values) ?? null; }
    async all() { return { results: sql.prepare(this.query).all(...this.values) }; }
    async run() { const result = sql.prepare(this.query).run(...this.values); return { meta: { changes: Number(result.changes) } }; }
  }
  const db = { prepare: query => new Statement(query), batch: async statements => {
    sql.exec("BEGIN IMMEDIATE");
    try { const results = []; for (const statement of statements) results.push(await statement.run()); sql.exec("COMMIT"); return results; }
    catch (error) { sql.exec("ROLLBACK"); throw error; }
  } };
  // readWorkspace batch returns rows rather than write metadata.
  const writeBatch = db.batch;
  db.batch = async statements => statements.every(s => s.query.startsWith("SELECT")) ? Promise.all(statements.map(s => s.all())) : writeBatch(statements);
  const { workspaceId } = await mutate(db, owner, { action: "createWorkspace", name: "Test workspace" });
  await mutate(db, owner, { action: "invite", workspaceId, email: creator.email, role: "creator" });
  await mutate(db, owner, { action: "invite", workspaceId, email: reviewer.email, role: "reviewer" });
  const { draftId } = await mutate(db, creator, { action: "createDraft", workspaceId, title: "Launch", body: "Our draft" });
  return { db, sql, workspaceId, draftId };
}
const denied = status => error => error.status === status;
test("separate identities see persisted draft and reviewer decision snapshot", async () => {
  const { db, workspaceId, draftId } = await fixture();
  await mutate(db, creator, { action: "submit", workspaceId, draftId, version: 1 });
  assert.equal((await read(db, reviewer, workspaceId)).drafts[0].state, "submitted");
  await mutate(db, reviewer, { action: "decide", workspaceId, draftId, version: 2, decision: "approved", note: "Checked the evidence" });
  const state = await read(db, creator, workspaceId);
  assert.equal(state.drafts[0].state, "approved");
  const decision = state.events.find(e => e.action === "approved");
  assert.equal(JSON.parse(decision.detail).reviewedVersion, 2);
  assert.equal(JSON.parse(decision.detail).snapshot.body, "Our draft");
});
test("non-members cannot list, read or write another organization", async () => {
  const { db, workspaceId, draftId } = await fixture();
  assert.deepEqual(await list(db, stranger), []);
  await assert.rejects(read(db, stranger, workspaceId), denied(404));
  await assert.rejects(mutate(db, stranger, { action: "comment", workspaceId, draftId, version: 1, note: "Leak?" }), denied(404));
  const other = await mutate(db, stranger, { action: "createWorkspace", name: "Other org" });
  await assert.rejects(mutate(db, stranger, { action: "comment", workspaceId: other.workspaceId, draftId, version: 1, note: "Forged parent" }), denied(404));
});
test("creator cannot self-approve, including an admin author", async () => {
  const { db, workspaceId } = await fixture();
  for (const user of [owner, creator]) {
    const { draftId } = await mutate(db, user, { action: "createDraft", workspaceId, title: "Self", body: "Text" });
    await mutate(db, user, { action: "submit", workspaceId, draftId, version: 1 });
    await assert.rejects(mutate(db, user, { action: "decide", workspaceId, draftId, version: 2, decision: "approved", note: "My own work" }), denied(403));
  }
});
test("reviewers cannot edit drafts or invite users; creators cannot grant privileges", async () => {
  const { db, workspaceId, draftId } = await fixture();
  await assert.rejects(mutate(db, reviewer, { action: "saveDraft", workspaceId, draftId, version: 1, title: "Changed", body: "Tampered" }), denied(403));
  for (const user of [creator, reviewer]) await assert.rejects(mutate(db, user, { action: "invite", workspaceId, email: stranger.email, role: "reviewer" }), denied(403));
});
test("stale revision cannot be saved or approved and produces no false audit event", async () => {
  const { db, workspaceId, draftId, sql } = await fixture();
  await mutate(db, creator, { action: "saveDraft", workspaceId, draftId, version: 1, title: "Updated", body: "v2" });
  await assert.rejects(mutate(db, creator, { action: "saveDraft", workspaceId, draftId, version: 1, title: "Stale", body: "v1" }), denied(409));
  await mutate(db, creator, { action: "submit", workspaceId, draftId, version: 2 });
  await assert.rejects(mutate(db, reviewer, { action: "decide", workspaceId, draftId, version: 2, decision: "approved", note: "Stale" }), denied(409));
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM audit_events WHERE action = 'approved'").get().n, 0);
});
test("submitted content is frozen; changes requested permits a new draft", async () => {
  const { db, workspaceId, draftId } = await fixture();
  await mutate(db, creator, { action: "submit", workspaceId, draftId, version: 1 });
  await assert.rejects(mutate(db, creator, { action: "saveDraft", workspaceId, draftId, version: 2, title: "Edit", body: "While pending" }), denied(409));
  await mutate(db, reviewer, { action: "decide", workspaceId, draftId, version: 2, decision: "changes_requested", note: "Please revise" });
  await mutate(db, creator, { action: "saveDraft", workspaceId, draftId, version: 3, title: "Revised", body: "Fixed" });
  assert.equal((await read(db, reviewer, workspaceId)).drafts[0].state, "draft");
});
test("approval becomes draft again on edit; audit retains original decision", async () => {
  const { db, workspaceId, draftId } = await fixture();
  await mutate(db, creator, { action: "submit", workspaceId, draftId, version: 1 });
  await mutate(db, reviewer, { action: "decide", workspaceId, draftId, version: 2, decision: "approved", note: "Approved original" });
  await mutate(db, creator, { action: "saveDraft", workspaceId, draftId, version: 3, title: "Changed", body: "New claims" });
  const value = await read(db, reviewer, workspaceId);
  assert.equal(value.drafts[0].state, "draft"); assert.ok(value.events.some(e => e.action === "approved"));
});
test("review decisions require a reason and input lengths are bounded", async () => {
  const { db, workspaceId, draftId } = await fixture();
  await assert.rejects(mutate(db, reviewer, { action: "decide", workspaceId, draftId, version: 1, decision: "approved", note: " " }));
  await assert.rejects(mutate(db, creator, { action: "createDraft", workspaceId, title: "Too long", body: "x".repeat(5001) }));
});
test("a failed transaction rolls back the mutation when audit insert fails", async () => {
  const { db, workspaceId, draftId, sql } = await fixture();
  sql.exec("CREATE TRIGGER fail_event BEFORE INSERT ON audit_events WHEN NEW.action = 'submit' BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
  await assert.rejects(mutate(db, creator, { action: "submit", workspaceId, draftId, version: 1 }));
  assert.equal(sql.prepare("SELECT state FROM shared_drafts WHERE id = ?").get(draftId).state, "draft");
});
test("submission attaches real rule findings and frozen source versions", async () => {
  const { db, workspaceId, draftId } = await fixture();
  await mutate(db, creator, { action: "saveDraft", workspaceId, draftId, version: 1, title: "Flowly launch", body: "Flowly is here" });
  await mutate(db, creator, { action: "submit", workspaceId, draftId, version: 2 });
  const value = await read(db, reviewer, workspaceId);
  const evidence = JSON.parse(value.events.find(e => e.action === "submit").detail);
  assert.ok(evidence.findings.some(f => f.category === "Terminology"));
  assert.ok(evidence.sources.every(source => source.version));
});
test("a competing write after the initial read loses the CAS without a false event", async () => {
  const { db, workspaceId, draftId, sql } = await fixture();
  const batch = db.batch;
  let injected = false;
  db.batch = async statements => {
    if (!injected && statements[0].query.startsWith("UPDATE shared_drafts")) {
      injected = true;
      sql.prepare("UPDATE shared_drafts SET version = version + 1, body = 'concurrent edit', mutation = 'competitor' WHERE id = ?").run(draftId);
    }
    return batch(statements);
  };
  await assert.rejects(mutate(db, creator, { action: "saveDraft", workspaceId, draftId, version: 1, title: "Losing edit", body: "Overwritten?" }), denied(409));
  assert.equal(sql.prepare("SELECT body FROM shared_drafts WHERE id = ?").get(draftId).body, "concurrent edit");
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM audit_events WHERE action = 'saveDraft'").get().n, 0);
});
