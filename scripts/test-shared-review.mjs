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
for (const [source, name] of [["lib/shared-review.ts", "shared-review"], ["lib/policy.ts", "policy"], ["lib/documents.ts", "documents"], ["components/brandcheck/review.ts", "review"], ["components/brandcheck/model.ts", "model"], ["components/brandcheck/aiReview.ts", "aiReview"]]) {
  let compiled = ts.transpileModule(await readFile(source, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  compiled = compiled.replace(/"(?:\.\.\/components\/brandcheck\/|\.\/)(review|model|aiReview|policy)"/g, '"./$1.mjs"');
  await writeFile(resolve(directory, `${name}.mjs`), compiled);
}
const { mutateWorkspace: mutate, readWorkspace: read, listWorkspaces: list } = await import(pathToFileURL(resolve(directory, "shared-review.mjs")).href);
const { defaultPolicy, checkPolicy, fetchGitHubPolicy, policyDiff, policySchema } = await import(pathToFileURL(resolve(directory, "policy.mjs")).href);
const { runGroundedGeminiReview } = await import(pathToFileURL(resolve(directory, "aiReview.mjs")).href);
const { contrastRatio, extractDocument } = await import(pathToFileURL(resolve(directory, "documents.mjs")).href);
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
function renamePolicy() {
  const pack = structuredClone(defaultPolicy);
  pack.terms.push({ id: "rename-nova", retired: "NovaDesk", preferred: "NovaDesk One", sourceId: "TERM-001" });
  pack.sources[0].version = "2.0";
  pack.sources[0].body = "NovaDesk One is approved. NovaDesk is retired.";
  return pack;
}
test("policy activation rechecks stored drafts and invalidates an affected approval", async () => {
  const { db, workspaceId, draftId } = await fixture();
  await mutate(db, creator, { action: "saveDraft", workspaceId, draftId, version: 1, title: "Announcement", body: "NovaDesk simplifies work." });
  await mutate(db, creator, { action: "submit", workspaceId, draftId, version: 2 });
  await mutate(db, reviewer, { action: "decide", workspaceId, draftId, version: 3, decision: "approved", note: "Reviewed" });
  const proposal = await mutate(db, owner, { action: "proposePolicy", workspaceId, policy: renamePolicy() });
  assert.equal((await read(db, owner, workspaceId)).policy.version, 0);
  const activated = await mutate(db, owner, { action: "decidePolicy", workspaceId, proposalId: proposal.proposalId, accept: true, note: "Approved rename" });
  assert.equal(activated.rechecked, 1);
  const value = await read(db, creator, workspaceId);
  assert.equal(value.policy.version, 1); assert.equal(value.drafts[0].state, "needs_review");
  assert.equal(JSON.parse(value.drafts[0].findings)[0].sourceVersion, "2.0");
  assert.ok(value.events.some(e => e.action === "approved"));
  assert.ok(value.events.some(e => e.action === "policy_recheck"));
});
test("rejected policy leaves current rules and approvals unchanged", async () => {
  const { db, workspaceId } = await fixture();
  const proposal = await mutate(db, owner, { action: "proposePolicy", workspaceId, policy: renamePolicy() });
  await mutate(db, owner, { action: "decidePolicy", workspaceId, proposalId: proposal.proposalId, accept: false, note: "Not yet" });
  const value = await read(db, owner, workspaceId);
  assert.equal(value.policy.version, 0); assert.equal(value.proposals[0].state, "rejected");
});
test("non-admins cannot change policy; stale proposals cannot overwrite a new version", async () => {
  const { db, workspaceId } = await fixture();
  await assert.rejects(mutate(db, creator, { action: "proposePolicy", workspaceId, policy: renamePolicy() }), denied(403));
  const a = await mutate(db, owner, { action: "proposePolicy", workspaceId, policy: renamePolicy() });
  const b = await mutate(db, owner, { action: "proposePolicy", workspaceId, policy: renamePolicy() });
  await mutate(db, owner, { action: "decidePolicy", workspaceId, proposalId: a.proposalId, accept: true, note: "First change" });
  await assert.rejects(mutate(db, owner, { action: "decidePolicy", workspaceId, proposalId: b.proposalId, accept: true, note: "Stale change" }), denied(409));
});
test("policy activation and regression rollback together on database failure", async () => {
  const { db, workspaceId, sql } = await fixture();
  const proposal = await mutate(db, owner, { action: "proposePolicy", workspaceId, policy: renamePolicy() });
  sql.exec("CREATE TRIGGER fail_regression BEFORE INSERT ON audit_events WHEN NEW.action = 'policy_recheck' BEGIN SELECT RAISE(ABORT, 'failure'); END;");
  await assert.rejects(mutate(db, owner, { action: "decidePolicy", workspaceId, proposalId: proposal.proposalId, accept: true, note: "Test rollback" }));
  const value = await read(db, owner, workspaceId);
  assert.equal(value.policy.version, 0); assert.equal(value.proposals[0].state, "pending");
});
test("new approved name containing old name is not incorrectly flagged", () => {
  const pack = renamePolicy();
  assert.equal(checkPolicy(pack, "", "NovaDesk One simplifies work.").filter(f => f.category === "Terminology").length, 0);
  assert.equal(checkPolicy(pack, "", "NovaDesk simplifies work. NovaDesk One is new.").filter(f => f.category === "Terminology").length, 1);
});
test("GitHub connector rejects internal URLs before fetching", async () => {
  for (const url of ["http://127.0.0.1/internal", "https://example.com/policy.json", "https://raw.githubusercontent.com@evil.example/a/b/c/d"]) await assert.rejects(fetchGitHubPolicy(url));
});
test("contrast calculations match known black/white and identical-colour cases", () => {
  assert.equal(contrastRatio("#000000", "#FFFFFF"), 21);
  assert.equal(contrastRatio("#777777", "#777777"), 1);
  assert.ok(contrastRatio("#777777", "#FFFFFF") < 4.5);
});
test("plain text intake keeps paragraph locations and rejects unsupported/empty files", async () => {
  const extracted = await extractDocument(new File(["First paragraph\n\nFlowly launch"], "draft.txt"));
  assert.equal(extracted.parts[1].label, "Paragraph 2");
  assert.equal(extracted.parts[1].text, "Flowly launch");
  await assert.rejects(extractDocument(new File([""], "empty.txt")));
  await assert.rejects(extractDocument(new File(["bad"], "draft.exe")));
});
test("DOCX intake extracts real zipped XML into paragraph-linked text", async () => {
  const { zipSync, strToU8 } = await import("fflate");
  const archive = zipSync({
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
    "_rels/.rels": strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),
    "word/document.xml": strToU8('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>First paragraph</w:t></w:r></w:p><w:p><w:r><w:t>Flowly launch</w:t></w:r></w:p></w:body></w:document>'),
  });
  await writeFile(resolve(directory, "sample.docx"), archive);
  const extracted = await extractDocument(new File([archive], "sample.docx"));
  assert.equal(extracted.parts[1].text, "Flowly launch");
  assert.equal(extracted.parts[1].label, "Paragraph 2");
});
test("policy differences ignore JSON property ordering", () => {
  const result = policyDiff(defaultPolicy, policySchema.parse(defaultPolicy));
  assert.deepEqual(result.sources.changed, []);
  assert.deepEqual(result.terms.changed, []);
});
test("explicit recheck recovers a pending draft without allowing a stale approval", async () => {
  const { db, workspaceId, draftId } = await fixture();
  await mutate(db, creator, { action: "submit", workspaceId, draftId, version: 1 });
  await mutate(db, reviewer, { action: "recheckDraft", workspaceId, draftId, version: 2 });
  assert.equal((await read(db, creator, workspaceId)).drafts[0].state, "needs_review");
  await mutate(db, creator, { action: "saveDraft", workspaceId, draftId, version: 3, title: "Revised", body: "Ready again" });
  await mutate(db, creator, { action: "submit", workspaceId, draftId, version: 4 });
  assert.equal((await read(db, reviewer, workspaceId)).drafts[0].state, "submitted");
});
test("AI findings require real excerpts and active citations; invalid replacement targets are dropped", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const valid = { category: "Terminology", severity: "Needs attention", evidenceStatus: "Rule match", location: "Draft text", excerpt: "Flowly", sourceId: "TERM-001", explanation: "Retired name", suggestion: "Use NovaDesk", replacement: { from: "invented text", to: "NovaDesk" } };
    globalThis.fetch = async () => Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ findings: [valid, { ...valid, excerpt: "Content that was never written" }, { ...valid, sourceId: "invented-source" }], assessment: { riskLevel: "Moderate", score: 50, summary: "Needs review", claimRiskNote: "", toneRiskNote: "", suggestedRewrite: "NovaDesk" } }) }] } }] });
    const result = await runGroundedGeminiReview({ title: "Draft", text: "Flowly launch", channel: "Social", audience: "Teams", image: null }, defaultPolicy.sources, defaultPolicy.terms, [], "test-key-not-a-real-secret");
    assert.equal(result.findings.length, 1); assert.equal(result.findings[0].excerpt, "Flowly"); assert.equal(result.findings[0].replacement, undefined);
  } finally { globalThis.fetch = originalFetch; }
});
test("GitHub connector uses edge-compatible manual redirects and never follows a redirect", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async (_url, options) => { calls++; assert.equal(options.redirect, "manual"); return new Response(null, { status: 302, headers: { Location: "http://127.0.0.1/private" } }); };
    await assert.rejects(fetchGitHubPolicy("https://raw.githubusercontent.com/owner/repo/main/policy.json"));
    assert.equal(calls, 1);
    globalThis.fetch = async (_url, options) => { assert.equal(options.redirect, "manual"); return Response.json(defaultPolicy); };
    assert.equal((await fetchGitHubPolicy("https://raw.githubusercontent.com/owner/repo/main/policy.json")).name, defaultPolicy.name);
  } finally { globalThis.fetch = originalFetch; }
});
