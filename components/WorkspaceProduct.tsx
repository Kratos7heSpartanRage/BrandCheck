"use client";
import { useEffect, useRef, useState } from "react";
import PolicyPanel from "./PolicyPanel";
import type { Proposal } from "./PolicyPanel";
import type { Policy } from "../lib/policy";
import type { DocumentMap } from "../lib/content";
import type { DraftAssessment, Finding } from "./brandcheck/model";
import { extractDocument } from "../lib/documents";
import "./workspace-product.css";

type Draft = { id: string; title: string; body: string; version: number; state: string; author_id: string; findings: string; policy_version: number; document: string | null; review_meta: string | null };
type Review = { mode: string; model: string | null; completedAt: string; notice: string; assessment: DraftAssessment | null };
type Workspace = { id: string; name: string; role: string };
type Data = { role: string; policy: { version: number; pack: Policy }; proposals: Proposal[]; drafts: Draft[]; members: { email: string; role: string }[]; events: { id: string; draft_id: string | null; actor_email: string; action: string; version: number | null; detail: string; created_at: string }[] };
async function api<T>(url: string, action?: unknown): Promise<T> {
  const response = await fetch(url, action ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) } : { cache: "no-store" });
  const value = await response.json() as { error?: string };
  if (!response.ok) throw new Error(value.error || "The request failed. Please retry.");
  return value as T;
}
function rebuildDocument(doc: DocumentMap, texts: string[]) {
  let offset = 0;
  const segments = doc.segments.map((part, index) => { const start = offset; offset += texts[index].length; const end = offset; offset += 2; return { label: part.label, start, end }; });
  return { body: texts.join("\n\n"), document: { ...doc, segments } };
}
export default function WorkspaceProduct() {
  const [user, setUser] = useState<{ userId: string; email: string } | null>(null);
  const [ready, setReady] = useState(false), [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState(""), [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState("content"), [filter, setFilter] = useState("all");
  const [draftId, setDraftId] = useState(""), [title, setTitle] = useState(""), [body, setBody] = useState("");
  const [document, setDocument] = useState<DocumentMap | null>(null);
  const [name, setName] = useState(""), [examplePack, setExamplePack] = useState(false);
  const [busy, setBusy] = useState(false), [pending, setPending] = useState(""), [message, setMessage] = useState("");
  const [note, setNote] = useState(""), [consent, setConsent] = useState(false);
  const [memberEmail, setMemberEmail] = useState(""), [memberRole, setMemberRole] = useState("reviewer"), [removalNote, setRemovalNote] = useState("");
  const fileInput = useRef<HTMLInputElement>(null); const loadSequence = useRef(0);
  const selected = data?.drafts.find(d => d.id === draftId);
  const findings = selected ? JSON.parse(selected.findings) as Finding[] : [];
  const review = selected?.review_meta ? JSON.parse(selected.review_meta) as Review : null;
  const editable = !selected ? data?.role !== "reviewer" : selected.author_id === user?.userId && data?.role !== "reviewer" && selected.state !== "submitted";
  const dirty = selected ? title !== selected.title || body !== selected.body || JSON.stringify(document) !== (selected.document || "null") : Boolean(title || body);
  const workspaceName = workspaces.find(w => w.id === workspaceId)?.name;
  async function list() { const result = await api<{ user: { userId: string; email: string }; workspaces: Workspace[] }>("/api/workspaces"); setUser(result.user); setWorkspaces(result.workspaces); return result.workspaces; }
  async function load(id: string) { const sequence = ++loadSequence.current; const value = await api<Data>(`/api/workspaces?workspaceId=${encodeURIComponent(id)}`); if (sequence === loadSequence.current) setData(value); return value; }
  function clearDraft() { setDraftId(""); setTitle(""); setBody(""); setDocument(null); setConsent(false); setNote(""); }
  useEffect(() => { list().then(items => { if (items[0]) setWorkspaceId(items[0].id); }).catch(error => setMessage(error.message)).finally(() => setReady(true)); }, []);
  useEffect(() => { setData(null); clearDraft(); if (workspaceId) load(workspaceId).catch(error => setMessage(error.message)); return () => { loadSequence.current++; }; }, [workspaceId]);
  function select(draft: Draft) { if (dirty && !window.confirm("Discard unsaved changes and open this draft?")) return; setDraftId(draft.id); setTitle(draft.title); setBody(draft.body); setDocument(draft.document ? JSON.parse(draft.document) : null); setConsent(false); setNote(""); setMessage(""); }
  async function run(action: Record<string, unknown>) {
    if (busy) return; setBusy(true); setPending(String(action.action)); setMessage("");
    try {
      const result = await api<{ workspaceId?: string; draftId?: string; rechecked?: number; skipped?: number }>("/api/workspaces", { workspaceId, ...action });
      if (result.workspaceId) { await list(); setWorkspaceId(result.workspaceId); setTab("brand"); }
      else {
        const updated = await load(workspaceId);
        const next = updated.drafts.find(d => d.id === (result.draftId || draftId));
        if (next) { setDraftId(next.id); setTitle(next.title); setBody(next.body); setDocument(next.document ? JSON.parse(next.document) : null); }
      }
      setNote(""); setMessage(result.rechecked !== undefined ? `Policy activated. ${result.rechecked} drafts rechecked; ${result.skipped || 0} concurrent edits skipped.` : "Changes saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save. Please retry."); }
    finally { setBusy(false); setPending(""); }
  }
  async function importDocument(file?: File) {
    if (!file) return; setBusy(true); setPending("import"); setMessage("");
    try {
      const extracted = await extractDocument(file); const texts = extracted.parts.map(p => p.text);
      const map: DocumentMap = { name: file.name.slice(0,200), type: file.name.split(".").pop()?.toLowerCase() as DocumentMap["type"], segments: extracted.parts.map(p => ({ label: p.label, start: 0, end: 0 })) };
      const rebuilt = rebuildDocument(map, texts);
      if (rebuilt.body.length > 5000) throw new Error("This workspace supports 5,000 characters per draft. Import a shorter document, or review the full file in Document review.");
      setTitle(file.name.slice(0,100)); setBody(rebuilt.body); setDocument(rebuilt.document);
      setMessage(extracted.warnings.length ? extracted.warnings.join(" ") : "Document imported. Save the draft to retain its page or paragraph locations.");
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); setPending(""); if (fileInput.current) fileInput.current.value = ""; }
  }
  function editPart(index: number, text: string) { if (!document) return; const texts = document.segments.map(s => body.slice(s.start, s.end)); texts[index] = text; const rebuilt = rebuildDocument(document, texts); if (rebuilt.body.length > 5000) { setMessage("This draft exceeds 5,000 characters. Shorten it before saving."); return; } setBody(rebuilt.body); setDocument(rebuilt.document); }
  function applyFinding(finding: Finding) {
    if (!finding.replacement) return;
    if (finding.location === "Draft title") setTitle(title.replace(finding.replacement.from, finding.replacement.to));
    else if (document) { const index = document.segments.findIndex(s => s.label === finding.location); if (index >= 0) editPart(index, body.slice(document.segments[index].start, document.segments[index].end).replace(finding.replacement.from, finding.replacement.to)); }
    else setBody(body.replace(finding.replacement.from, finding.replacement.to));
    setMessage("Suggested correction added. Save a new revision before reviewing again.");
  }
  const decisionsAllowed = selected?.state === "submitted" && selected.author_id !== user?.userId && ["admin", "reviewer"].includes(data?.role || "");
  return <div className="product-app">
    <aside className="product-sidebar"><a className="product-logo" href="/">◈ <span>BrandCheck</span></a><p className="product-caption">Your brand, consistently.</p><nav aria-label="Workspace navigation">{[["content", "Content", "▤"], ["brand", "Brand guidelines", "◈"], ["team", "People & access", "♧"], ["history", "Activity", "↺"]].map(([id,label,icon]) => <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}><span>{icon}</span>{label}</button>)}</nav><div className="product-sidebar-bottom"><a href="/documents">Document review</a><a href="/example">Explore example workspace</a><small>Human approval stays in control.</small></div></aside>
    <div className="product-main"><header className="product-topbar"><span>{workspaceName || "Your workspace"}</span><span className="product-account">{user ? <>{user.email} · <a href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a></> : "Brand governance"}</span></header>
    <main><div className="product-heading"><div><p className="product-eyebrow">BRAND GOVERNANCE</p><h1>{tab === "content" ? "Content workspace" : tab === "brand" ? "Brand guidelines" : tab === "team" ? "People & access" : "Activity & decisions"}</h1><p>Prepare content, check approved sources and bring the right people into the review.</p></div>{data && <span className="product-role">{data.role}</span>}</div>
    {busy && <div role="status" className="product-notice">{pending === "reviewAI" ? "Reviewing the saved revision with AI. Your content and policy are checked again before results are stored…" : pending === "import" ? "Extracting document text…" : "Saving changes…"}</div>}{message && <div className="product-notice" role="status">{message}</div>}
    {!ready ? <section><h2>Loading your workspace…</h2></section> : !user ? <section className="product-signin"><h2>Bring your brand into one workspace</h2><p>Sign in to save guidelines, collaborate on drafts and keep a record of every decision.</p><a className="product-button" target="_top" href="/signin-with-chatgpt?return_to=%2Fworkspace">Continue with ChatGPT</a><a href="/example">Try the example without signing in</a></section> : <>
      <section className="product-workspace-picker"><label>Workspace<select disabled={busy || dirty} value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}><option value="">Choose a workspace</option>{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><details open={!workspaces.length}><summary>Create a workspace</summary><form onSubmit={e => { e.preventDefault(); run({ action: "createWorkspace", name, useExamplePack: examplePack }); }}><label>Workspace name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Your team or brand" /></label><label className="product-check"><input type="checkbox" checked={examplePack} onChange={e => setExamplePack(e.target.checked)} /> Start with the fictional NovaDesk example</label><button disabled={busy}>Create workspace</button></form></details></section>
      {workspaceId && !data && <section><p>Loading workspace content…</p><button disabled={busy} onClick={() => load(workspaceId).catch(e => setMessage(e.message))}>Retry</button></section>}
      {data && <>
        {tab === "content" && <><div className="product-stats"><div><strong>{data.drafts.length}</strong><span>Content items</span></div><div><strong>{data.drafts.filter(d => ["submitted","needs_review"].includes(d.state)).length}</strong><span>Awaiting attention</span></div><div><strong>{data.drafts.filter(d => d.state === "approved").length}</strong><span>Approved</span></div><div><strong>{data.policy.version}</strong><span>Active policy version</span></div></div>
        <div className="product-editor-grid"><section className="product-queue"><div className="product-section-head"><h2>Content queue</h2><button disabled={busy || dirty} className="secondary" onClick={() => load(workspaceId).catch(e => setMessage(e.message))}>Refresh</button></div><label>Status<select value={filter} onChange={e => setFilter(e.target.value)}>{["all","draft","submitted","needs_review","approved","changes_requested"].map(value => <option key={value} value={value}>{value.replaceAll("_"," ")}</option>)}</select></label>{data.role !== "reviewer" && <button disabled={busy} onClick={() => { if (!dirty || window.confirm("Discard unsaved changes?")) clearDraft(); }}>+ New content</button>}
        {!data.drafts.length && <p className="product-empty">Your first draft belongs here. Write content or import a document to get started.</p>}{data.drafts.filter(d => filter === "all" || d.state === filter).map(d => <button className="product-draft" disabled={busy} key={d.id} aria-pressed={selected?.id === d.id} onClick={() => select(d)}><strong>{d.title}</strong><span className={`product-status status-${d.state}`}>{d.state.replaceAll("_"," ")}</span><small>Revision {d.version} · policy {d.policy_version}</small></button>)}</section>
        <section className="product-editor"><div className="product-section-head"><h2>{selected ? selected.title : "Create content"}</h2>{dirty && <span className="product-unsaved">Unsaved changes</span>}</div><p>Review uses <button className="text-button" onClick={() => setTab("brand")}>{data.policy.pack.name}</button>. Update guidelines before relying on them for your brand.</p>
        <label>Title<input value={title} maxLength={100} disabled={busy || !editable} onChange={e => setTitle(e.target.value)} /></label>
        {editable && <details><summary>Import a document</summary><label>PDF, DOCX, TXT or Markdown<input ref={fileInput} disabled={busy} type="file" accept=".pdf,.docx,.txt,.md" onChange={e => importDocument(e.target.files?.[0])} /></label><small>Import replaces the current editor text. Original files stay on your device; saving stores extracted text and location labels.</small></details>}
        {document ? <div className="product-document"><div className="product-section-head"><strong>{document.name}</strong>{editable && <button className="secondary" disabled={busy} onClick={() => setDocument(null)}>Use plain text</button>}</div>{document.segments.map((part,index) => <label id={`saved-part-${index}`} key={index}>{part.label}<textarea rows={5} maxLength={5000} disabled={busy || !editable} value={body.slice(part.start,part.end)} onChange={e => editPart(index,e.target.value)} /></label>)}</div> : <label>Content<textarea rows={10} maxLength={5000} value={body} disabled={busy || !editable} onChange={e => setBody(e.target.value)} placeholder="Write the content you want reviewed…" /></label>}
        <small>{body.length}/5,000 characters{selected ? ` · revision ${selected.version}` : ""}</small>
        {editable && <button disabled={busy || !title.trim() || (!dirty && Boolean(selected))} onClick={() => run({ action: selected ? "saveDraft" : "createDraft", draftId, version: selected?.version, title, body, document })}>Save {selected ? "new revision" : "draft"}</button>}
        {selected && <><div className="product-review-actions"><h3>Review saved content</h3><p>Rule checks run against approved sources. AI adds contextual suggestions and requires your permission to send content to Google.</p><label className="product-check"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> Allow this draft and approved guidelines to be sent to Google Gemini for AI review</label><button disabled={busy || dirty || !consent || !body.trim()} onClick={() => run({ action: "reviewAI", draftId, version: selected.version, consent: true })}>Run AI + rule review</button><button className="secondary" disabled={busy || dirty} onClick={() => run({ action: "recheckDraft", draftId, version: selected.version })}>Run rules only</button><small>Running a new review on submitted or approved content requires a new human decision. AI availability and usage limits may affect live review.</small></div>
        {review && <div className="product-review-summary"><strong>{review.mode === "hybrid" ? "Live AI + rules" : "Rules saved — AI unavailable"}</strong><p>{review.notice}</p><small>{review.model} · {new Date(review.completedAt).toLocaleString()}</small>{review.assessment && <><p>{review.assessment.summary}</p><small>AI risk estimate: {review.assessment.riskLevel}. This is an advisory assessment.</small>{editable && review.assessment.suggestedRewrite && <button className="secondary" disabled={busy} onClick={() => { if (window.confirm("Replace the editor text with this AI suggestion? Document location mapping will be cleared. Save and review the new revision before approval.")) { setBody(review.assessment!.suggestedRewrite); setDocument(null); } }}>Use suggested rewrite</button>}</>}</div>}
        <h3>Findings <span className="product-count">{findings.length}</span></h3>{dirty ? <p className="product-notice">The editor has changed. Findings below belong to the saved revision; save and review again.</p> : selected.policy_version !== data.policy.version ? <p className="product-notice">Guidelines changed since this review. Run a fresh check before approval.</p> : null}
        {!findings.length && <p className="product-empty">No stored findings. Run a review; a clear result still needs human judgment.</p>}{findings.map(f => { const index = document?.segments.findIndex(s => s.label === f.location) ?? -1; return <article className="product-finding" key={f.id}><div className="product-section-head"><strong>{f.category}</strong><small>{f.evidenceStatus}</small></div><blockquote>{f.excerpt}</blockquote><p>{f.explanation}</p><small>{index >= 0 ? <a href={`#saved-part-${index}`}>{f.location}</a> : f.location} · {f.sourceId} v{f.sourceVersion}</small><p>{f.suggestion}</p><details><summary>Approved source</summary><p>{data.policy.pack.sources.find(s => s.id === f.sourceId && s.version === f.sourceVersion)?.body || "Source is no longer in the active policy; inspect the recorded review in Activity."}</p></details>{editable && f.replacement && <button className="secondary" disabled={busy} onClick={() => applyFinding(f)}>Apply suggested correction</button>}</article>; })}
        <div className="product-decision"><h3>Human review</h3><p><span className={`product-status status-${selected.state}`}>{selected.state.replaceAll("_"," ")}</span> · exact revision {selected.version}</p>{selected.author_id === user.userId && <small>A separate reviewer must approve your content.</small>}
        {editable && ["draft", "needs_review", "changes_requested"].includes(selected.state) && <button disabled={busy || dirty || !body.trim()} onClick={() => run({ action: "submit", draftId, version: selected.version })}>Submit for approval</button>}
        <label>Comment or decision reason<textarea rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label><button className="secondary" disabled={busy || !note.trim()} onClick={() => run({ action: "comment", draftId, version: selected.version, note })}>Add comment</button>{decisionsAllowed && <><button disabled={busy || !note.trim()} onClick={() => run({ action: "decide", draftId, version: selected.version, decision: "approved", note })}>Approve revision</button><button className="secondary" disabled={busy || !note.trim()} onClick={() => run({ action: "decide", draftId, version: selected.version, decision: "changes_requested", note })}>Request changes</button></>}</div>
        </>}
        </section></div></>}
        {tab === "brand" && <><PolicyPanel key={`${workspaceId}:${data.policy.version}`} current={data.policy} proposals={data.proposals} admin={data.role === "admin"} busy={busy} run={run} /><section><h2>Policy impact</h2><p>Stored results across workspace content. Recheck outdated items before relying on these counts.</p>{data.drafts.map(d => <div className="product-impact-row" key={d.id}><strong>{d.title}</strong><span>{JSON.parse(d.findings).length} findings</span><span className={`product-status status-${d.state}`}>{d.state.replaceAll("_"," ")}</span><small>Policy {d.policy_version}{d.policy_version !== data.policy.version ? " · outdated" : ""}</small></div>)}</section></>}
        {tab === "team" && <section><h2>Workspace members</h2><p>Members can see this workspace's content. Creators write and submit; reviewers decide; admins manage guidelines and access.</p>{data.members.map(member => <div className="product-member" key={member.email}><span>{member.email}</span><span className="product-role">{member.role}</span>{data.role === "admin" && member.role !== "admin" && <button className="secondary" disabled={busy || !removalNote.trim()} onClick={() => run({ action: "removeMember", email: member.email, note: removalNote })}>Remove access</button>}</div>)}
        {data.role === "admin" && <><label>Reason for removing access<input maxLength={2000} value={removalNote} onChange={e => setRemovalNote(e.target.value)} /></label><hr/><form onSubmit={e => { e.preventDefault(); run({ action: "invite", email: memberEmail, role: memberRole }); }}><h3>Add a teammate</h3><label>Teammate's sign-in email<input type="email" required maxLength={254} value={memberEmail} onChange={e => setMemberEmail(e.target.value)} /></label><label>Role<select value={memberRole} onChange={e => setMemberRole(e.target.value)}><option value="reviewer">Reviewer</option><option value="creator">Creator</option></select></label><button disabled={busy}>Grant workspace access</button><small>Share this workspace page with your teammate; no invitation email is sent. They must sign in with this exact email.</small></form></>}
        </section>}
        {tab === "history" && <section><h2>Activity & revision history</h2><p>The latest 200 server-recorded events. Decisions retain their content, policy and review snapshots.</p>{!data.events.length && <p>No activity yet.</p>}{data.events.map(event => <details className="product-event" key={event.id}><summary><strong>{event.action.replaceAll("_"," ")}</strong> · {event.actor_email} · {new Date(event.created_at).toLocaleString()}{event.version ? ` · revision ${event.version}` : ""}</summary><pre>{JSON.stringify(JSON.parse(event.detail),null,2)}</pre></details>)}</section>}
      </>}
    </>}
    </main></div>
  </div>;
}
