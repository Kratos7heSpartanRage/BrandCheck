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
for (const [source, name] of [["lib/shared-review.ts", "shared-review"], ["lib/content.ts", "content"], ["lib/grounded-assessment.ts", "grounded-assessment"], ["lib/visual-grounding.ts", "visual-grounding"], ["lib/policy.ts", "policy"], ["lib/documents.ts", "documents"], ["lib/insights.ts", "insights"], ["lib/revisions.ts", "revisions"], ["components/brandcheck/review.ts", "review"], ["components/brandcheck/model.ts", "model"], ["components/brandcheck/aiReview.ts", "aiReview"]]) {
  let compiled = ts.transpileModule(await readFile(source, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  compiled = compiled.replace(/"(?:\.\.\/components\/brandcheck\/|\.\/)(review|model|aiReview|policy|content|grounded-assessment)"/g, '"./$1.mjs"');
  await writeFile(resolve(directory, `${name}.mjs`), compiled);
}
const { mutateWorkspace: mutate, readWorkspace: read, listWorkspaces: list } = await import(pathToFileURL(resolve(directory, "shared-review.mjs")).href);
const { defaultPolicy, checkPolicy, fetchGitHubPolicy, policyDiff, policySchema } = await import(pathToFileURL(resolve(directory, "policy.mjs")).href);
const { runGroundedGeminiReview } = await import(pathToFileURL(resolve(directory, "aiReview.mjs")).href);
const { contrastRatio, extractDocument } = await import(pathToFileURL(resolve(directory, "documents.mjs")).href);
const { groundAIFinding } = await import(pathToFileURL(resolve(directory, "grounded-assessment.mjs")).href);
const { checkContent } = await import(pathToFileURL(resolve(directory, "content.mjs")).href);
const { buildInsights } = await import(pathToFileURL(resolve(directory, "insights.mjs")).href);
const { revisionChoices, diffText } = await import(pathToFileURL(resolve(directory, "revisions.mjs")).href);
const { groundVisualResult } = await import(pathToFileURL(resolve(directory, "visual-grounding.mjs")).href);
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
  const { workspaceId } = await mutate(db, owner, { action: "createWorkspace", name: "Test workspace", useExamplePack: true });
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
  await assert.rejects(mutate(db, creator, { action: "createDraft", workspaceId, title: "Too long", body: "x".repeat(10001) }));
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
test("a real workspace starts with generic guidelines and no fictional facts", async () => {
  const { db } = await fixture();
  const { workspaceId } = await mutate(db, owner, { action: "createWorkspace", name: "Atlas team" });
  const value = await read(db, owner, workspaceId);
  assert.equal(value.policy.pack.terms.length, 0);
  assert.ok(!JSON.stringify(value.policy.pack).includes("NovaDesk"));
  assert.ok(value.policy.pack.name.includes("Atlas"));
});
test("document locations survive save, submit and later policy rechecks", async () => {
  const { db, workspaceId } = await fixture();
  const document = { name: "launch.pdf", type: "pdf", segments: [{ label: "Page 1", start: 0, end: 5 }, { label: "Page 2", start: 7, end: 13 }] };
  const { draftId } = await mutate(db, creator, { action: "createDraft", workspaceId, title: "PDF", body: "Hello\n\nFlowly", document });
  await mutate(db, creator, { action: "submit", workspaceId, draftId, version: 1 });
  let value = await read(db, reviewer, workspaceId);
  let draft = value.drafts.find(d => d.id === draftId);
  assert.equal(JSON.parse(draft.findings)[0].location, "Page 2");
  assert.deepEqual(JSON.parse(draft.document), document);
  const proposal = await mutate(db, owner, { action: "proposePolicy", workspaceId, policy: renamePolicy() });
  await mutate(db, owner, { action: "decidePolicy", workspaceId, proposalId: proposal.proposalId, accept: true, note: "Rename" });
  value = await read(db, reviewer, workspaceId); draft = value.drafts.find(d => d.id === draftId);
  assert.equal(JSON.parse(draft.findings)[0].location, "Page 2");
});
test("invalid document ranges cannot hide unreviewed text", async () => {
  const { db, workspaceId } = await fixture();
  await assert.rejects(mutate(db, creator, { action: "createDraft", workspaceId, title: "Forged", body: "Flowly remains hidden", document: { name: "fake.pdf", type: "pdf", segments: [{ label: "Page 1", start: 10, end: 20 }] } }), denied(400));
});
test("shared AI results are saved, survive submission and clear when content changes", async () => {
  const { db, workspaceId, draftId } = await fixture();
  const services = { aiReview: async () => ({ findings: [], assessment: { riskLevel: "Low", score: 80, summary: "Human review needed", claimRiskNote: "", toneRiskNote: "", suggestedRewrite: "A revised draft" }, isSimulated: false, model: "test-model" }) };
  await mutate(db, creator, { action: "reviewAI", workspaceId, draftId, version: 1, consent: true }, services);
  assert.equal(JSON.parse((await read(db, reviewer, workspaceId)).drafts[0].review_meta).mode, "hybrid");
  await mutate(db, creator, { action: "submit", workspaceId, draftId, version: 2 });
  assert.equal(JSON.parse((await read(db, reviewer, workspaceId)).drafts[0].review_meta).model, "test-model");
  await mutate(db, reviewer, { action: "decide", workspaceId, draftId, version: 3, decision: "changes_requested", note: "Please update" });
  await mutate(db, creator, { action: "saveDraft", workspaceId, draftId, version: 4, title: "Changed", body: "Changed text" });
  assert.equal((await read(db, reviewer, workspaceId)).drafts[0].review_meta, null);
});
test("AI failure stores clearly labelled rules with no simulated assessment", async () => {
  const { db, workspaceId, draftId } = await fixture();
  const services = { aiReview: async () => ({ findings: [{ id: "fake", category: "Claims" }], assessment: { score: 99 }, isSimulated: true, error: "Unavailable" }) };
  await mutate(db, creator, { action: "reviewAI", workspaceId, draftId, version: 1, consent: true }, services);
  const draft = (await read(db, reviewer, workspaceId)).drafts[0];
  assert.equal(JSON.parse(draft.review_meta).mode, "rules-fallback");
  assert.equal(JSON.parse(draft.review_meta).assessment, null);
  assert.ok(!JSON.parse(draft.findings).some(f => f.id === "fake"));
});
test("AI review requires consent and rechecks membership and revision before saving", async () => {
  const { db, workspaceId, draftId, sql } = await fixture();
  let calls = 0;
  const services = { aiReview: async () => { calls++; return { findings: [], assessment: null, isSimulated: false }; } };
  await assert.rejects(mutate(db, creator, { action: "reviewAI", workspaceId, draftId, version: 1, consent: false }, services));
  assert.equal(calls, 0);
  const changed = { aiReview: async () => { await mutate(db, creator, { action: "saveDraft", workspaceId, draftId, version: 1, title: "New", body: "New content" }); return { findings: [], assessment: null, isSimulated: false }; } };
  await assert.rejects(mutate(db, creator, { action: "reviewAI", workspaceId, draftId, version: 1, consent: true }, changed), denied(409));
  assert.equal(sql.prepare("SELECT COUNT(*) n FROM audit_events WHERE action = 'reviewAI'").get().n, 0);
});
test("removing a teammate immediately denies future reads and writes", async () => {
  const { db, workspaceId, draftId } = await fixture();
  await assert.rejects(mutate(db, creator, { action: "removeMember", workspaceId, email: reviewer.email, note: "Not authorised" }), denied(403));
  await assert.rejects(mutate(db, owner, { action: "removeMember", workspaceId, email: owner.email, note: "Cannot remove owner" }), denied(403));
  await mutate(db, owner, { action: "removeMember", workspaceId, email: reviewer.email, note: "Access ended" });
  await assert.rejects(read(db, reviewer, workspaceId), denied(404));
  await assert.rejects(mutate(db, reviewer, { action: "comment", workspaceId, draftId, version: 1, note: "No access" }), denied(404));
});
test("accepted proposal keeps its original difference after active policy changes", async () => {
  const { db, workspaceId } = await fixture();
  const proposal = await mutate(db, owner, { action: "proposePolicy", workspaceId, policy: renamePolicy() });
  await mutate(db, owner, { action: "decidePolicy", workspaceId, proposalId: proposal.proposalId, accept: true, note: "Approved" });
  const value = await read(db, owner, workspaceId);
  assert.ok(value.proposals[0].diff.terms.added.includes("rename-nova"));
  assert.equal(value.proposals[0].comparison, "Original proposal comparison");
});
test("creator can resubmit unchanged content for a new human decision after a recheck", async () => {
  const { db, workspaceId, draftId } = await fixture();
  await mutate(db, creator, { action: "submit", workspaceId, draftId, version: 1 });
  await mutate(db, reviewer, { action: "recheckDraft", workspaceId, draftId, version: 2 });
  await mutate(db, creator, { action: "submit", workspaceId, draftId, version: 3 });
  assert.equal((await read(db, reviewer, workspaceId)).drafts[0].state, "submitted");
});
test("policy changes during AI analysis reject stale results", async () => {
  const { db, workspaceId, draftId } = await fixture();
  const services = { aiReview: async () => {
    const proposal = await mutate(db, owner, { action: "proposePolicy", workspaceId, policy: renamePolicy() });
    await mutate(db, owner, { action: "decidePolicy", workspaceId, proposalId: proposal.proposalId, accept: true, note: "Changed during review" });
    return { findings: [], assessment: null, isSimulated: false };
  } };
  await assert.rejects(mutate(db, creator, { action: "reviewAI", workspaceId, draftId, version: 1, consent: true }, services), denied(409));
  const value = await read(db, reviewer, workspaceId);
  assert.equal(value.policy.version, 1); assert.equal(value.drafts[0].review_meta, null);
});
test("membership revoked during AI analysis cannot save the result", async () => {
  const { db, workspaceId, draftId } = await fixture();
  const services = { aiReview: async () => {
    await mutate(db, owner, { action: "removeMember", workspaceId, email: creator.email, note: "Access revoked during analysis" });
    return { findings: [], assessment: null, isSimulated: false };
  } };
  await assert.rejects(mutate(db, creator, { action: "reviewAI", workspaceId, draftId, version: 1, consent: true }, services), denied(404));
  assert.equal((await read(db, owner, workspaceId)).drafts[0].review_meta, null);
});
test("saved AI assessment cannot repeat unsupported model conclusions", async () => {
  const { db, workspaceId, draftId } = await fixture();
  await mutate(db, creator, { action: "reviewAI", workspaceId, draftId, version: 1, consent: true }, { aiReview: async () => ({ findings: [], assessment: { riskLevel: "Critical", score: 0, summary: "Invented regulatory breach", claimRiskNote: "", toneRiskNote: "", suggestedRewrite: "Unapproved text" }, isSimulated: false, model: "test" }) });
  const saved = JSON.parse((await read(db, reviewer, workspaceId)).drafts[0].review_meta).assessment;
  assert.equal(saved.riskLevel, "Low");
  assert.ok(!JSON.stringify(saved).includes("regulatory breach"));
  const wrongSource = { id: "ai:1", category: "Claims", sourceId: "TERM-001", sourceVersion: "1.0", explanation: "Regulatory breach", suggestion: "Replace all", excerpt: "Our draft" };
  assert.equal(groundAIFinding(wrongSource, defaultPolicy.sources), null);
});
test("saved image review checks alt text, approval fingerprint and graphic palette", async () => {
  const { db, workspaceId } = await fixture();
  const image = { name: "graphic.png", mime: "image/png", bytes: 100, sha256: "a".repeat(64), alt: "", decorative: false, visualType: "brand-graphic", dominantColor: "#ff0000", previewDataUrl: null };
  const { draftId } = await mutate(db, creator, { action: "createDraft", workspaceId, title: "Visual post", body: "", image });
  assert.equal(JSON.parse((await read(db, reviewer, workspaceId)).drafts.find(d => d.id === draftId).image).sha256, image.sha256);
  await mutate(db, creator, { action: "recheckDraft", workspaceId, draftId, version: 1 });
  let draft = (await read(db, reviewer, workspaceId)).drafts.find(d => d.id === draftId);
  assert.deepEqual(JSON.parse(draft.findings).map(f => f.id).sort(), ["access:alt","asset:unapproved"]);
  const pack = structuredClone(defaultPolicy); pack.approvedAssets = [{ name: image.name, sha256: image.sha256, sourceId: "ASSET-001", approvedAt: "2026-10-30" }]; pack.palette = ["#174e39"];
  const proposal = await mutate(db, owner, { action: "proposePolicy", workspaceId, policy: pack });
  await mutate(db, owner, { action: "decidePolicy", workspaceId, proposalId: proposal.proposalId, accept: true, note: "Approved exact asset" });
  draft = (await read(db, reviewer, workspaceId)).drafts.find(d => d.id === draftId);
  assert.deepEqual(JSON.parse(draft.findings).map(f => f.id), ["access:alt"]);
  assert.equal(JSON.parse(draft.image).sha256, image.sha256);
  await mutate(db, creator, { action: "saveDraft", workspaceId, draftId, version: draft.version, title: draft.title, body: "", image: { ...image, alt: "Green product launch graphic" } });
  draft = (await read(db, reviewer, workspaceId)).drafts.find(d => d.id === draftId);
  await mutate(db, creator, { action: "recheckDraft", workspaceId, draftId, version: draft.version });
  assert.equal(JSON.parse((await read(db, reviewer, workspaceId)).drafts.find(d => d.id === draftId).findings).length, 0);
});
test("assigned reviewer receives the submitted revision; other reviewer is denied", async () => {
  const { db, workspaceId, draftId } = await fixture();
  const other = { userId: "other", email: "other@example.com" };
  await mutate(db, owner, { action: "invite", workspaceId, email: other.email, role: "reviewer" });
  await mutate(db, creator, { action: "assignReviewer", workspaceId, draftId, version: 1, email: reviewer.email });
  await mutate(db, creator, { action: "submit", workspaceId, draftId, version: 2 });
  assert.equal((await read(db, reviewer, workspaceId)).drafts[0].reviewer_email, reviewer.email);
  await assert.rejects(mutate(db, other, { action: "decide", workspaceId, draftId, version: 3, decision: "approved", note: "Wrong reviewer" }), denied(403));
  await mutate(db, reviewer, { action: "decide", workspaceId, draftId, version: 3, decision: "approved", note: "Checked this exact revision" });
  assert.equal((await read(db, creator, workspaceId)).drafts[0].state, "approved");
});
test("palette suggestions apply to unknown graphics but not photographs or approved assets", () => {
  const pack = structuredClone(defaultPolicy); pack.palette = ["#174e39"];
  const image = { name: "poster.png", mime: "image/png", bytes: 100, sha256: "b".repeat(64), alt: "Launch poster", decorative: false, visualType: "brand-graphic", dominantColor: "#ff0000", previewDataUrl: null };
  assert.ok(checkContent(pack, "Poster", "", null, image).some(f => f.id === "asset:palette"));
  assert.ok(!checkContent(pack, "Photo", "", null, { ...image, visualType: "photo" }).some(f => f.id === "asset:palette"));
  pack.approvedAssets = [{ name: image.name, sha256: image.sha256, sourceId: "ASSET-001", approvedAt: "2026-10-30" }];
  assert.ok(!checkContent(pack, "Approved poster", "", null, image).some(f => f.id === "asset:palette"));
});
test("removing an assigned reviewer clears assignment and invalidates a stale decision", async () => {
  const { db, workspaceId, draftId } = await fixture();
  await mutate(db, creator, { action: "assignReviewer", workspaceId, draftId, version: 1, email: reviewer.email });
  await mutate(db, creator, { action: "submit", workspaceId, draftId, version: 2 });
  await mutate(db, owner, { action: "removeMember", workspaceId, email: reviewer.email, note: "Reviewer left" });
  const draft = (await read(db, creator, workspaceId)).drafts[0];
  assert.equal(draft.reviewer_email, null);
  assert.equal(draft.version, 4);
  await assert.rejects(mutate(db, reviewer, { action: "decide", workspaceId, draftId, version: 3, decision: "approved", note: "Stale" }), denied(404));
});
test("visual AI leads need consent and a separate reviewer before becoming findings", async () => {
  const { db, workspaceId, draftId } = await fixture();
  const image = { name: "launch.webp", mime: "image/webp", bytes: 100, sha256: "c".repeat(64), alt: "Launch card", decorative: false, visualType: "brand-graphic", dominantColor: "#ffffff", previewDataUrl: `data:image/webp;base64,${"a".repeat(80)}` };
  await mutate(db, creator, { action: "saveDraft", workspaceId, draftId, version: 1, title: "Launch", body: "Our draft", image });
  let calls = 0;
  const services = { visualReview: async () => { calls++; return { model: "test-vision", observedText: "NovaDesk", findings: [{ id: `visual:${image.sha256.slice(0,12)}:0`, category: "Asset usage", severity: "Suggestion", evidenceStatus: "Review suggestion", location: "Image: launch.webp", excerpt: "Logo close to the edge", explanation: "Compare with ASSET-001", sourceId: "ASSET-001", sourceVersion: "1", suggestion: "Verify with the original", detectedBy: "ai" }] }; } };
  await assert.rejects(mutate(db, creator, { action: "reviewVisual", workspaceId, draftId, version: 2, consent: false }, services));
  assert.equal(calls, 0);
  await mutate(db, creator, { action: "reviewVisual", workspaceId, draftId, version: 2, consent: true }, services);
  let saved = (await read(db, reviewer, workspaceId)).drafts[0];
  assert.equal(JSON.parse(saved.review_meta).observedText, "NovaDesk");
  assert.ok(JSON.parse(saved.review_meta).visualCandidates.some(f => f.id.startsWith("visual:")));
  assert.ok(!JSON.parse(saved.findings).some(f => f.id.startsWith("visual:")));
  await mutate(db, creator, { action: "submit", workspaceId, draftId, version: 3 });
  await assert.rejects(mutate(db, creator, { action: "resolveVisualCandidate", workspaceId, draftId, version: 4, candidateId: `visual:${image.sha256.slice(0,12)}:0`, decision: "confirmed", note: "My own image" }), denied(403));
  await mutate(db, reviewer, { action: "resolveVisualCandidate", workspaceId, draftId, version: 4, candidateId: `visual:${image.sha256.slice(0,12)}:0`, decision: "confirmed", note: "Checked original image" });
  saved = (await read(db, reviewer, workspaceId)).drafts[0];
  assert.ok(JSON.parse(saved.findings).some(f => f.id.startsWith("visual:")));
  assert.equal(JSON.parse(saved.review_meta).visualResolutions[0].decision, "confirmed");
  await assert.rejects(mutate(db, reviewer, { action: "resolveVisualCandidate", workspaceId, draftId, version: 5, candidateId: `visual:${image.sha256.slice(0,12)}:0`, decision: "dismissed", note: "Duplicate" }), denied(409));
  await mutate(db, reviewer, { action: "decide", workspaceId, draftId, version: 5, decision: "approved", note: "Checked image" });
  await mutate(db, creator, { action: "reviewVisual", workspaceId, draftId, version: 6, consent: true }, services);
  saved = (await read(db, reviewer, workspaceId)).drafts[0];
  assert.equal(saved.state, "needs_review");
  assert.equal(calls, 2);
});
test("insights count distinct content items and omit duplicate submission events", () => {
  const finding = { id: "term:1", sourceId: "TERM-001", category: "Terminology", evidenceStatus: "Evidence needed" };
  const drafts = [{ id: "a", findings: JSON.stringify([finding, { ...finding, id: "term:2" }]), state: "submitted", policy_version: 1 }, { id: "b", findings: JSON.stringify([finding]), state: "draft", policy_version: 1 }];
  const events = [{ id: "r", draft_id: "a", action: "recheckDraft", version: 2, detail: JSON.stringify({ findings: [finding] }), created_at: "2026-10-30T00:00:00Z" }, { id: "s", draft_id: "a", action: "submit", version: 3, detail: JSON.stringify({ findings: [finding] }), created_at: "2026-10-30T00:01:00Z" }];
  const result = buildInsights(drafts, events);
  assert.deepEqual([result.rows[0].drafts, result.rows[0].findings, result.rows[0].reviewOccurrences], [2,3,1]);
  assert.equal(result.awaitingDecision, 1);
});
test("revision comparison uses saved snapshots and preserves additions and removals", async () => {
  const { db, workspaceId, draftId } = await fixture();
  await mutate(db, creator, { action: "saveDraft", workspaceId, draftId, version: 1, title: "Launch", body: "Our revised draft" });
  const state = await read(db, reviewer, workspaceId);
  const choices = revisionChoices(state.events, draftId, state.drafts[0].version);
  assert.ok(choices.some(choice => choice.version === 1 && choice.snapshot.body === "Our draft"));
  const parts = diffText("Old line\nKeep line", "New line\nKeep line");
  assert.ok(parts.some(part => part.kind === "removed" && part.text.includes("Old line")));
  assert.ok(parts.some(part => part.kind === "added" && part.text.includes("New line")));
  assert.ok(parts.some(part => part.kind === "same" && part.text.includes("Keep line")));
});
test("visual observations reject invented sources and mark OCR terminology as uncertain", () => {
  const image = { name: "poster.webp", sha256: "d".repeat(64) };
  const pack = structuredClone(defaultPolicy);
  pack.terms = [{ id: "rename", retired: "Nova Desk", preferred: "NovaDesk", sourceId: "TERM-001" }];
  const result = groundVisualResult({ visibleText: "Meet Nova Desk", observations: [{ sourceId: "invented", observation: "Unapproved logo", suggestedAction: "Replace logo" }, { sourceId: "ASSET-001", observation: "Graphic may use a different logo", suggestedAction: "Compare approved asset" }] }, image, pack, "test-model");
  assert.equal(result.findings.length, 2);
  assert.ok(result.findings.every(f => f.sourceId !== "invented" && f.evidenceStatus === "Review suggestion"));
  assert.ok(result.findings.some(f => f.id.startsWith("visual:ocr:") && f.explanation.includes("may have read")));
  assert.equal(groundVisualResult({ visibleText: 1, observations: [] }, image, pack, "test-model"), null);
});
test("visual review does not mistake an approved longer name or file-hash statement for an image defect", () => {
  const image = { name: "poster.webp", sha256: "e".repeat(64) };
  const pack = structuredClone(defaultPolicy);
  pack.terms = [{ id: "rename", retired: "NovaDesk", preferred: "NovaDesk One", sourceId: "TERM-001" }];
  const approved = groundVisualResult({ visibleText: "NovaDesk One", observations: [{ sourceId: "ASSET-001", observation: "The asset fingerprint does not match the approved library", suggestedAction: "Replace it" }] }, image, pack, "test-model");
  assert.equal(approved.findings.length, 0);
  const mixed = groundVisualResult({ visibleText: "NovaDesk One and NovaDesk", observations: [] }, image, pack, "test-model");
  assert.equal(mixed.findings.length, 1);
  assert.equal(mixed.findings[0].category, "Terminology");
});
test("visual review omits positive model observations with no corrective action", () => {
  const image = { name: "poster.webp", sha256: "f".repeat(64) };
  const result = groundVisualResult({ visibleText: "", observations: [
    { sourceId: "TERM-001", observation: "The text uses the approved product name", suggestedAction: "None required" },
    { sourceId: "TONE-001", observation: "The copy is compliant with the guideline", suggestedAction: "Continue using it" },
  ] }, image, defaultPolicy, "test-model");
  assert.equal(result.findings.length, 0);
});
