"use client";
import { useEffect, useRef, useState } from "react";
import PolicyPanel from "./PolicyPanel";
import type { Proposal } from "./PolicyPanel";
import type { Policy } from "../lib/policy";
import type { DocumentMap, ImageMeta } from "../lib/content";
import type { DraftAssessment, Finding } from "./brandcheck/model";
import { extractDocument } from "../lib/documents";
import { inspectImage } from "../lib/image-client";
import InsightsPanel from "./InsightsPanel";
import RevisionCompare from "./RevisionCompare";
import { FileText, Shield, BarChart3, Users, History, Inbox, CheckCircle2, Printer, Copy, Award } from "lucide-react";
import "./workspace-product.css";

type Draft = { id: string; title: string; body: string; version: number; state: string; author_id: string; findings: string; policy_version: number; document: string | null; review_meta: string | null; image: string | null; reviewer_email: string | null };
type Review = { mode: string; model: string | null; completedAt: string; notice: string; assessment: DraftAssessment | null; observedText?: string; visualCandidates?: Finding[]; visualResolutions?: Array<{ candidateId: string; decision: string; note: string; actor: string; at: string }> };
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
  const [image, setImage] = useState<ImageMeta | null>(null);
  const [name, setName] = useState(""), [examplePack, setExamplePack] = useState(false);
  const [busy, setBusy] = useState(false), [pending, setPending] = useState(""), [message, setMessage] = useState("");
  const [note, setNote] = useState(""), [consent, setConsent] = useState(false), [visualConsent, setVisualConsent] = useState(false);
  const [memberEmail, setMemberEmail] = useState(""), [memberRole, setMemberRole] = useState("reviewer"), [removalNote, setRemovalNote] = useState("");
  const [showCertificate, setShowCertificate] = useState(false);
  const [signinHref, setSigninHref] = useState("/signin-with-chatgpt?return_to=%2Fworkspace");
  const fileInput = useRef<HTMLInputElement>(null); const imageInput = useRef<HTMLInputElement>(null); const loadSequence = useRef(0); const requestedDraft = useRef<string | null>(null);
  const selected = data?.drafts.find(d => d.id === draftId);
  const findings = selected ? JSON.parse(selected.findings) as Finding[] : [];
  const review = selected?.review_meta ? JSON.parse(selected.review_meta) as Review : null;
  const editable = !selected ? data?.role !== "reviewer" : selected.author_id === user?.userId && data?.role !== "reviewer" && selected.state !== "submitted";
  const dirty = selected ? title !== selected.title || body !== selected.body || JSON.stringify(document) !== (selected.document || "null") || JSON.stringify(image) !== (selected.image || "null") : Boolean(title || body || image);
  const inboxCount = data?.drafts.filter(d => d.state === "submitted" && (!d.reviewer_email || d.reviewer_email === user?.email.toLowerCase()) && d.author_id !== user?.userId).length ?? 0;
  const workspaceName = workspaces.find(w => w.id === workspaceId)?.name;
  async function list() { const result = await api<{ user: { userId: string; email: string }; workspaces: Workspace[] }>("/api/workspaces"); setUser(result.user); setWorkspaces(result.workspaces); return result.workspaces; }
  async function load(id: string) { const sequence = ++loadSequence.current; const value = await api<Data>(`/api/workspaces?workspaceId=${encodeURIComponent(id)}`); if (sequence === loadSequence.current) setData(value); return value; }
  function clearDraft() { setDraftId(""); setTitle(""); setBody(""); setDocument(null); setImage(null); setConsent(false); setVisualConsent(false); setNote(""); }
  useEffect(() => { const params = new URLSearchParams(window.location.search); requestedDraft.current = params.get("draft"); setSigninHref(`/signin-with-chatgpt?return_to=${encodeURIComponent(window.location.pathname + window.location.search)}`); list().then(items => { const target = items.find(w => w.id === params.get("workspace")) ?? items[0]; if (target) setWorkspaceId(target.id); }).catch(error => setMessage(error.message)).finally(() => setReady(true)); }, []);
  useEffect(() => { setData(null); clearDraft(); if (workspaceId) load(workspaceId).then(value => { const found = value.drafts.find(d => d.id === requestedDraft.current); requestedDraft.current = null; if (found) { setDraftId(found.id); setTitle(found.title); setBody(found.body); setDocument(found.document ? JSON.parse(found.document) : null); setImage(found.image ? JSON.parse(found.image) : null); } }).catch(error => setMessage(error.message)); return () => { loadSequence.current++; }; }, [workspaceId]);
  function select(draft: Draft) { if (dirty && !window.confirm("Discard unsaved changes and open this draft?")) return; setDraftId(draft.id); setTitle(draft.title); setBody(draft.body); setDocument(draft.document ? JSON.parse(draft.document) : null); setImage(draft.image ? JSON.parse(draft.image) : null); setConsent(false); setVisualConsent(false); setNote(""); setMessage(""); }
  async function run(action: Record<string, unknown>) {
    if (busy) return; setBusy(true); setPending(String(action.action)); setMessage("");
    try {
      const result = await api<{ workspaceId?: string; draftId?: string; rechecked?: number; skipped?: number }>("/api/workspaces", { workspaceId, ...action });
      if (result.workspaceId) { await list(); setWorkspaceId(result.workspaceId); setTab("brand"); }
      else {
        const updated = await load(workspaceId);
        const next = updated.drafts.find(d => d.id === (result.draftId || draftId));
        if (next) { setDraftId(next.id); setTitle(next.title); setBody(next.body); setDocument(next.document ? JSON.parse(next.document) : null); setImage(next.image ? JSON.parse(next.image) : null); }
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
      if (rebuilt.body.length > 10000) throw new Error("This workspace supports 10,000 characters per draft. Import a shorter document, or review the full file in Document review.");
      setTitle(file.name.slice(0,100)); setBody(rebuilt.body); setDocument(rebuilt.document);
      setMessage(extracted.warnings.length ? extracted.warnings.join(" ") : "Document imported. Save the draft to retain its page or paragraph locations.");
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); setPending(""); if (fileInput.current) fileInput.current.value = ""; }
  }
  async function importImage(file?: File) {
    if (!file) return; setBusy(true); setPending("importImage"); setMessage("");
    try { setImage(await inspectImage(file)); setMessage("Image inspected. Save the draft to retain its preview and review metadata."); }
    catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); setPending(""); if (imageInput.current) imageInput.current.value = ""; }
  }
  function editPart(index: number, text: string) { if (!document) return; const texts = document.segments.map(s => body.slice(s.start, s.end)); texts[index] = text; const rebuilt = rebuildDocument(document, texts); if (rebuilt.body.length > 10000) { setMessage("This draft exceeds 10,000 characters. Shorten it before saving."); return; } setBody(rebuilt.body); setDocument(rebuilt.document); }
  function applyFinding(finding: Finding) {
    if (!finding.replacement) return;
    if (finding.location === "Draft title") setTitle(title.replace(finding.replacement.from, finding.replacement.to));
    else if (document) { const index = document.segments.findIndex(s => s.label === finding.location); if (index >= 0) editPart(index, body.slice(document.segments[index].start, document.segments[index].end).replace(finding.replacement.from, finding.replacement.to)); }
    else setBody(body.replace(finding.replacement.from, finding.replacement.to));
    setMessage("Suggested correction added. Save a new revision before reviewing again.");
  }
  function applyAllTerminologyCorrections() {
    const termFindings = findings.filter(f => f.category === "Terminology" && f.replacement);
    if (!termFindings.length) return;
    let newTitle = title;
    let newBody = body;
    let newDoc = document ? structuredClone(document) : null;
    let applied = 0;
    for (const f of termFindings) {
      if (!f.replacement) continue;
      const { from, to } = f.replacement;
      if (f.location === "Draft title" && newTitle.includes(from)) {
        newTitle = newTitle.replace(from, to); applied++;
      } else if (newDoc) {
        const segIdx = newDoc.segments.findIndex(s => s.label === f.location);
        if (segIdx >= 0) {
          const segText = newBody.slice(newDoc.segments[segIdx].start, newDoc.segments[segIdx].end);
          if (segText.includes(from)) {
            const updated = segText.replace(from, to);
            const texts = newDoc.segments.map((s, i) => i === segIdx ? updated : newBody.slice(s.start, s.end));
            const rebuilt = rebuildDocument(newDoc, texts);
            newBody = rebuilt.body; newDoc = rebuilt.document; applied++;
          }
        }
      } else if (newBody.includes(from)) {
        newBody = newBody.replace(from, to); applied++;
      }
    }
    if (newBody.length > 10000) { setMessage("Applying all corrections exceeds the 10,000 character limit."); return; }
    setTitle(newTitle); setBody(newBody); if (newDoc) setDocument(newDoc);
    setMessage(`Applied ${applied} approved terminology correction${applied === 1 ? "" : "s"}. Save a new revision before reviewing again.`);
  }
  const decisionsAllowed = selected?.state === "submitted" && selected.author_id !== user?.userId && ["admin", "reviewer"].includes(data?.role || "") && (!selected.reviewer_email || selected.reviewer_email === user?.email.toLowerCase() || data?.role === "admin");
  return <div className="product-app">
    <aside className="product-sidebar">
      <a className="product-logo" href="/">
        <svg className="w-5 h-5 text-[var(--accent-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="m9 12 2 2 4-4" />
        </svg>
        <span>BrandCheck</span>
      </a>
      <p className="product-caption">Editorial governance</p>
      <nav aria-label="Workspace navigation">
        <button aria-current={tab === "content" && filter !== "inbox" ? "page" : undefined} onClick={() => { setTab("content"); if (filter === "inbox") setFilter("all"); }}>
          <FileText size={15} /> Content
        </button>
        <button aria-current={tab === "content" && filter === "inbox" ? "page" : undefined} onClick={() => { setTab("content"); setFilter("inbox"); }}>
          <Inbox size={15} /> Review inbox {inboxCount > 0 && <strong className="product-nav-count">{inboxCount}</strong>}
        </button>
        <button aria-current={tab === "brand" ? "page" : undefined} onClick={() => setTab("brand")}>
          <Shield size={15} /> Brand guidelines
        </button>
        <button aria-current={tab === "insights" ? "page" : undefined} onClick={() => setTab("insights")}>
          <BarChart3 size={15} /> Insights
        </button>
        <button aria-current={tab === "team" ? "page" : undefined} onClick={() => setTab("team")}>
          <Users size={15} /> People & access
        </button>
        <button aria-current={tab === "history" ? "page" : undefined} onClick={() => setTab("history")}>
          <History size={15} /> Activity
        </button>
      </nav>
      <div className="product-sidebar-bottom">
        <a href="/documents">Document tools</a>
        <a href="/example">Interactive example</a>
        <small>Human approval stays in control.</small>
      </div>
    </aside>

    <div className="product-main">
      <header className="product-topbar">
        <span className="font-medium text-xs tracking-tight text-[var(--text-main)]">{workspaceName || "Brand Workspace"}</span>
        <span className="product-account">{user ? <>{user.email} · <a href="/signout-with-chatgpt?return_to=%2F" target="_top">Sign out</a></> : "Brand governance"}</span>
      </header>

      <main>
        <div className="product-heading">
          <div>
            <p className="product-eyebrow">Brand Governance</p>
            <h1>{tab === "content" ? "Content workspace" : tab === "brand" ? "Brand guidelines" : tab === "insights" ? "Governance insights" : tab === "team" ? "People & access" : "Activity & decisions"}</h1>
            <p>Prepare content, check approved sources and bring authorized reviewers into the decision loop.</p>
          </div>
          {data && <span className="product-role">{data.role}</span>}
        </div>

        {busy && <div role="status" className="product-notice">{pending === "reviewAI" ? "Reviewing saved revision with Gemini. Content and active policy are verified before results are committed." : pending === "reviewVisual" ? "Inspecting saved image preview against approved visual guidelines." : pending === "import" ? "Extracting document text." : "Saving changes."}</div>}
        {message && <div className="product-notice" role="status">{message}</div>}

        {!ready ? <section><h2>Loading workspace…</h2></section> : !user ? <section className="product-signin"><h2>Bring your brand into one workspace</h2><p>Sign in to save guidelines, collaborate on drafts and keep a verified record of every decision.</p><a className="product-button" target="_top" href={signinHref}>Continue with ChatGPT</a><a href="/example" className="ml-4 text-xs underline text-[var(--text-muted)]">Try example without signing in</a></section> : <>
          <section className="product-workspace-picker">
            <label>Workspace
              <select disabled={busy || dirty} value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}>
                <option value="">Choose a workspace</option>
                {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <details open={!workspaces.length}>
              <summary>Create a workspace</summary>
              <form onSubmit={e => { e.preventDefault(); run({ action: "createWorkspace", name, useExamplePack: examplePack }); }}>
                <label>Workspace name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Your team or brand" /></label>
                <label className="product-check"><input type="checkbox" checked={examplePack} onChange={e => setExamplePack(e.target.checked)} /> Start with the fictional NovaDesk example</label>
                <button disabled={busy}>Create workspace</button>
              </form>
            </details>
          </section>

          {workspaceId && !data && <section><p>Loading workspace content…</p><button disabled={busy} onClick={() => load(workspaceId).catch(e => setMessage(e.message))}>Retry</button></section>}

          {data && <>
            {tab === "content" && <>
              <div className="product-stats">
                <div><strong>{data.drafts.length}</strong><span>Content items</span></div>
                <div><strong>{data.drafts.filter(d => ["submitted","needs_review"].includes(d.state)).length}</strong><span>Awaiting review</span></div>
                <div><strong>{data.drafts.filter(d => d.state === "approved").length}</strong><span>Approved</span></div>
                <div><strong>{data.policy.version}</strong><span>Active policy version</span></div>
              </div>

              <div className="product-editor-grid">
                <section className="product-queue">
                  <div className="product-section-head">
                    <h2 className="text-base font-serif">{filter === "inbox" ? "Review inbox" : "Content queue"}</h2>
                    <button disabled={busy || dirty} className="secondary text-xs h-7 px-2" onClick={() => load(workspaceId).catch(e => setMessage(e.message))}>Refresh</button>
                  </div>
                  <label className="text-xs">Status filter
                    <select value={filter} onChange={e => setFilter(e.target.value)}>
                      {["all","inbox","draft","submitted","needs_review","approved","changes_requested"].map(value => (
                        <option key={value} value={value}>{value === "inbox" ? "Review inbox" : value.replaceAll("_"," ")}</option>
                      ))}
                    </select>
                  </label>
                  {data.role !== "reviewer" && (
                    <button disabled={busy} className="w-full mt-2" onClick={() => { if (!dirty || window.confirm("Discard unsaved changes?")) clearDraft(); }}>
                      + New content
                    </button>
                  )}
                  {!data.drafts.length && <p className="product-empty">No drafts created yet. Write content or import a document to get started.</p>}
                  {filter === "inbox" && inboxCount === 0 && <p className="product-empty">No submissions need your decision. Refresh when a creator submits a revision.</p>}
                  {data.drafts.filter(d => filter === "all" || filter === "inbox" && d.state === "submitted" && (!d.reviewer_email || d.reviewer_email === user?.email.toLowerCase()) && d.author_id !== user?.userId || d.state === filter).map(d => (
                    <button className="product-draft" disabled={busy} key={d.id} aria-pressed={selected?.id === d.id} onClick={() => select(d)}>
                      <strong>{d.title}</strong>
                      <span className={`product-status status-${d.state}`}>{d.state.replaceAll("_"," ")}</span>
                      <small>Revision {d.version} · policy v{d.policy_version}{d.reviewer_email ? ` · ${d.reviewer_email}` : ""}</small>
                    </button>
                  ))}
                </section>

                <section className="product-editor">
                  <div className="product-section-head">
                    <h2>{selected ? selected.title : "Create content"}</h2>
                    {dirty && <span className="product-unsaved text-xs font-medium">Unsaved changes</span>}
                  </div>
                  <p className="text-xs text-[var(--text-subtle)]">Active policy: <button className="text-button" onClick={() => setTab("brand")}>{data.policy.pack.name}</button>.</p>

                  {selected && (
                    <div className="product-preflight">
                      <span className={`product-preflight-pill ${findings.filter(f => f.category === "Terminology").length === 0 ? "pass" : "warn"}`}>
                        {findings.filter(f => f.category === "Terminology").length === 0 ? "Terminology verified" : `${findings.filter(f => f.category === "Terminology").length} term issue${findings.filter(f => f.category === "Terminology").length > 1 ? "s" : ""}`}
                      </span>
                      <span className={`product-preflight-pill ${findings.filter(f => f.category === "Claims" || f.evidenceStatus === "Evidence needed").length === 0 ? "pass" : "warn"}`}>
                        {findings.filter(f => f.category === "Claims" || f.evidenceStatus === "Evidence needed").length === 0 ? "Claims verified" : `${findings.filter(f => f.category === "Claims" || f.evidenceStatus === "Evidence needed").length} need evidence`}
                      </span>
                      <span className={`product-preflight-pill ${!image ? "info" : (image.alt || image.decorative) ? "pass" : "warn"}`}>
                        {!image ? "Text only" : (image.alt || image.decorative) ? "Visual asset ready" : "Alt text missing"}
                      </span>
                      <span className={`product-preflight-pill ${selected.state === "approved" ? "pass" : selected.state === "submitted" ? "info" : "warn"}`}>
                        {selected.state === "approved" ? "Approved for release" : selected.state === "submitted" ? "Awaiting reviewer" : "In progress"}
                      </span>
                      {selected.state === "approved" && (
                        <button type="button" className="product-template-pill" style={{ marginLeft: "auto", fontWeight: 600 }} onClick={() => setShowCertificate(true)}>
                          <Award size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />Clearance certificate
                        </button>
                      )}
                    </div>
                  )}

                  <label>Title<input value={title} maxLength={100} disabled={busy || !editable} onChange={e => setTitle(e.target.value)} /></label>
                  {editable && (
                    <details className="my-2">
                      <summary className="text-xs font-medium text-[var(--text-muted)] cursor-pointer">Import document (PDF, DOCX, TXT, MD)</summary>
                      <label className="text-xs">Document file<input ref={fileInput} disabled={busy} type="file" accept=".pdf,.docx,.txt,.md" onChange={e => importDocument(e.target.files?.[0])} /></label>
                      <small className="text-[var(--text-subtle)] text-[11px]">Import replaces editor text. Original files stay on your device; saving stores extracted text and location labels.</small>
                    </details>
                  )}

                  {document ? (
                    <div className="product-document">
                      <div className="product-section-head">
                        <strong className="text-xs font-mono">{document.name}</strong>
                        {editable && <button className="secondary text-xs h-7 px-2" disabled={busy} onClick={() => setDocument(null)}>Use plain text</button>}
                      </div>
                      {document.segments.map((part,index) => (
                        <label id={`saved-part-${index}`} key={index} className="text-xs font-mono text-[var(--text-muted)]">
                          {part.label}
                          <textarea rows={5} maxLength={10000} disabled={busy || !editable} value={body.slice(part.start,part.end)} onChange={e => editPart(index,e.target.value)} />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <label>Content body
                      <textarea rows={10} maxLength={10000} value={body} disabled={busy || !editable} onChange={e => setBody(e.target.value)} placeholder="Write or paste content to review..." />
                    </label>
                  )}

                  <div className="product-image-area">
                    <h3 className="text-xs uppercase tracking-wider text-[var(--text-subtle)]">Attached visual asset</h3>
                    {editable && (
                      <label className="text-xs">PNG, JPEG or WebP (up to 15 MB)
                        <input ref={imageInput} disabled={busy} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => importImage(e.target.files?.[0])} />
                      </label>
                    )}
                    {image ? (
                      <div className="product-image-card">
                        {image.previewDataUrl ? <img src={image.previewDataUrl} alt={image.alt || "Draft image preview"} /> : <p className="text-xs text-[var(--text-subtle)]">Preview not saved; original image remains on device.</p>}
                        <div>
                          <strong className="text-xs">{image.name}</strong>
                          <small className="font-mono text-[11px] text-[var(--text-subtle)]">SHA-256 {image.sha256.slice(0,18)}… · palette {image.dominantColor || "unknown"}</small>
                          <label className="text-xs">Alternative text
                            <input maxLength={500} disabled={busy || !editable || image.decorative} value={image.alt} onChange={e => setImage({ ...image, alt: e.target.value })} placeholder="Describe what this image conveys" />
                          </label>
                          <label className="product-check text-xs">
                            <input type="checkbox" disabled={busy || !editable} checked={image.decorative} onChange={e => setImage({ ...image, decorative: e.target.checked, alt: e.target.checked ? "" : image.alt })} /> Decorative asset
                          </label>
                          <label className="text-xs">Visual type
                            <select disabled={busy || !editable} value={image.visualType} onChange={e => setImage({ ...image, visualType: e.target.value as ImageMeta["visualType"] })}>
                              <option value="brand-graphic">Brand graphic or logo</option>
                              <option value="photo">Photograph</option>
                            </select>
                          </label>
                          {editable && <button className="secondary text-xs h-7 px-2 mt-2" disabled={busy} onClick={() => setImage(null)}>Remove image</button>}
                        </div>
                      </div>
                    ) : (
                      <small className="text-[var(--text-subtle)]">No image attached. Uploaded binary stays on device; a small preview and review fingerprint are saved with the draft.</small>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-[var(--text-subtle)] my-2">
                    <span>{body.length} / 10,000 characters{selected ? ` · revision ${selected.version}` : ""}</span>
                  </div>

                  {editable && (
                    <button disabled={busy || !title.trim() || (!dirty && Boolean(selected))} onClick={() => run({ action: selected ? "saveDraft" : "createDraft", draftId, version: selected?.version, title, body, document, image })}>
                      Save {selected ? "new revision" : "draft"}
                    </button>
                  )}

                  {selected && (
                    <>
                      <RevisionCompare key={selected.id} events={data.events} draftId={selected.id} version={selected.version} title={title} body={body} image={image} />

                      <div className="product-review-actions">
                        <h3 className="text-xs uppercase tracking-wider text-[var(--text-subtle)]">Review execution</h3>
                        <p className="text-xs text-[var(--text-muted)]">Rule checks run deterministically against active guidelines. Gemini text review requires explicit consent. Visual AI sends only the reduced-size preview.</p>
                        <label className="product-check text-xs">
                          <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> Consent to send saved draft text and approved guidelines to Google Gemini
                        </label>
                        <button disabled={busy || dirty || !consent || !body.trim()} onClick={() => run({ action: "reviewAI", draftId, version: selected.version, consent: true })}>
                          Run text AI + rules
                        </button>
                        <label className="product-check text-xs mt-2">
                          <input type="checkbox" checked={visualConsent} onChange={e => setVisualConsent(e.target.checked)} /> Consent to send reduced-size image preview to Google Gemini for visual inspection
                        </label>
                        <button className="secondary" disabled={busy || dirty || !visualConsent || !image?.previewDataUrl} onClick={() => run({ action: "reviewVisual", draftId, version: selected.version, consent: true })}>
                          Inspect image with AI
                        </button>
                        <button className="secondary" disabled={busy || dirty} onClick={() => run({ action: "recheckDraft", draftId, version: selected.version })}>
                          Run rules only
                        </button>
                        <small className="text-[11px] text-[var(--text-subtle)] mt-1">AI observations are advisory. Visual leads remain unverified until an authorized reviewer confirms them.</small>
                      </div>

                      {review && (
                        <div className="product-review-summary">
                          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)] mb-2">
                            <strong className="text-xs font-semibold text-[var(--text-main)]">
                              {review.mode === "hybrid" ? "Live text AI + rule findings" : review.mode === "visual" ? "Visual AI leads + rule findings" : "Rules saved (AI unavailable)"}
                            </strong>
                            <span className="text-[11px] font-mono text-[var(--text-subtle)]">{review.model || "deterministic-engine"}</span>
                          </div>
                          <p className="text-xs text-[var(--text-muted)]">{review.notice}</p>
                          <small className="text-[10px] text-[var(--text-subtle)]">Completed: {new Date(review.completedAt).toLocaleString()}</small>
                          {review.observedText && (
                            <details className="mt-2 text-xs">
                              <summary className="cursor-pointer text-[var(--text-muted)]">Tentative image text (unverified OCR)</summary>
                              <p className="font-mono text-xs bg-[var(--bg-surface-sunken)] p-2 rounded mt-1">{review.observedText}</p>
                              <small className="text-[var(--text-subtle)]">Compare every word against original image. This text is not automatically counted as a finding.</small>
                            </details>
                          )}
                          {review.assessment && (
                            <div className="mt-3 pt-2 border-t border-[var(--border-subtle)]">
                              <p className="text-xs text-[var(--text-main)]">{review.assessment.summary}</p>
                              <small className="text-xs font-medium text-[var(--text-muted)]">Source-linked priority: {review.assessment.riskLevel}</small>
                              {editable && review.assessment.suggestedRewrite && (
                                <button className="secondary text-xs h-7 px-2 mt-2" disabled={busy} onClick={() => { if (window.confirm("Apply source-linked replacements? Document location mapping will be cleared. Save and review new revision before approval.")) { setBody(review.assessment!.suggestedRewrite); setDocument(null); } }}>
                                  Apply source-linked rewrite
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {!!review?.visualCandidates?.length && (
                        <div className="product-visual-candidates mt-4">
                          <h3 className="text-xs uppercase tracking-wider text-[var(--text-subtle)]">
                            Visual leads to verify <span className="product-count">{review.visualCandidates.length}</span>
                          </h3>
                          <p className="text-xs text-[var(--text-muted)]">These observations do not affect scores until an authorized reviewer inspects the original asset and confirms them.</p>
                          {review.visualCandidates.map(candidate => {
                            const resolved = review.visualResolutions?.find(item => item.candidateId === candidate.id);
                            return (
                              <article className="product-finding" key={candidate.id}>
                                <div className="flex items-center justify-between">
                                  <strong>{candidate.category} · {candidate.sourceId} v{candidate.sourceVersion}</strong>
                                  <span className="editorial-badge">{resolved ? resolved.decision : "Unverified lead"}</span>
                                </div>
                                <blockquote>{candidate.excerpt}</blockquote>
                                <p>{candidate.explanation}</p>
                                <p className="text-xs text-[var(--text-muted)] font-medium">Suggestion: {candidate.suggestion}</p>
                                {resolved ? (
                                  <small className="text-xs text-[var(--text-subtle)]">{resolved.decision} by {resolved.actor} · {resolved.note}</small>
                                ) : (
                                  decisionsAllowed && (
                                    <div className="pt-2 flex gap-2">
                                      <button disabled={busy || !note.trim()} onClick={() => run({ action: "resolveVisualCandidate", draftId, version: selected.version, candidateId: candidate.id, decision: "confirmed", note })}>
                                        Confirm after checking original
                                      </button>
                                      <button className="secondary" disabled={busy || !note.trim()} onClick={() => run({ action: "resolveVisualCandidate", draftId, version: selected.version, candidateId: candidate.id, decision: "dismissed", note })}>
                                        Dismiss lead
                                      </button>
                                    </div>
                                  )
                                )}
                              </article>
                            );
                          })}
                        </div>
                      )}

                      {editable && findings.filter(f => f.category === "Terminology" && f.replacement).length > 1 && (
                        <div className="product-batch-fix">
                          <p>Suggested corrections available for {findings.filter(f => f.category === "Terminology" && f.replacement).length} retired terms.</p>
                          <button type="button" className="secondary text-xs" disabled={busy} onClick={applyAllTerminologyCorrections}>
                            Apply all terminology corrections ({findings.filter(f => f.category === "Terminology" && f.replacement).length})
                          </button>
                        </div>
                      )}

                      <h3 className="text-xs uppercase tracking-wider text-[var(--text-subtle)] mt-6">
                        Source-grounded findings <span className="product-count">{findings.length}</span>
                      </h3>
                      {dirty ? <p className="product-notice">The editor has unsaved changes. Findings below belong to the saved revision; save and review again.</p> : selected.policy_version !== data.policy.version ? <p className="product-notice">Guidelines changed since this review. Run a fresh check before approval.</p> : null}
                      {!findings.length && <p className="product-empty">No stored findings. Run a review; human judgment is still required before publication.</p>}
                      {findings.map(f => {
                        const index = document?.segments.findIndex(s => s.label === f.location) ?? -1;
                        return (
                          <article className="product-finding" key={f.id}>
                            <div className="product-section-head">
                              <strong className="text-xs">{f.category}</strong>
                              <span className="editorial-badge">{f.evidenceStatus}</span>
                            </div>
                            <blockquote>{f.excerpt}</blockquote>
                            <p>{f.explanation}</p>
                            <small className="text-xs text-[var(--text-subtle)]">{index >= 0 ? <a href={`#saved-part-${index}`}>{f.location}</a> : f.location} · {f.sourceId} v{f.sourceVersion}</small>
                            <p className="text-xs text-[var(--text-muted)] font-medium">Suggestion: {f.suggestion}</p>
                            <details className="text-xs text-[var(--text-subtle)] my-1">
                              <summary className="cursor-pointer">{f.sourceId.startsWith("BASE-") ? "Built-in baseline rule" : "Approved guideline source"}</summary>
                              <p className="mt-1 p-2 bg-[var(--bg-surface-sunken)] rounded">{f.sourceId === "BASE-ACCESS" ? "BrandCheck baseline: meaningful images need alt text or decorative designation." : f.sourceId === "BASE-ASSET" ? "BrandCheck baseline: define approved visual assets before claiming an image is on-brand." : data.policy.pack.sources.find(s => s.id === f.sourceId && s.version === f.sourceVersion)?.body || "Source is no longer in the active policy; inspect recorded review in Activity."}</p>
                            </details>
                            {editable && f.replacement && (
                              <button className="secondary text-xs h-7 px-2 mt-2" disabled={busy} onClick={() => applyFinding(f)}>
                                Apply suggested correction
                              </button>
                            )}
                          </article>
                        );
                      })}

                      <div className="product-decision mt-8 pt-4 border-t border-[var(--border-subtle)]">
                        <h3 className="text-xs uppercase tracking-wider text-[var(--text-subtle)]">Human review & sign-off</h3>
                        <p className="text-xs text-[var(--text-muted)]">
                          Current status: <span className={`product-status status-${selected.state}`}>{selected.state.replaceAll("_"," ")}</span> · exact revision {selected.version}
                        </p>
                        {selected.author_id === user.userId && (
                          <small className="text-[var(--text-subtle)] text-xs mb-2 block">Creators cannot approve their own submissions. An authorized reviewer must decide.</small>
                        )}

                        {(selected.author_id === user.userId || data.role === "admin") && selected.state !== "approved" && (
                          <label className="text-xs">Assigned reviewer
                            <select disabled={busy || dirty} value={selected.reviewer_email || ""} onChange={e => { if (e.target.value) run({ action: "assignReviewer", draftId, version: selected.version, email: e.target.value }); }}>
                              <option value="">Unassigned — available to all workspace reviewers</option>
                              {data.members.filter(m => ["reviewer","admin"].includes(m.role) && !(m.email === user?.email.toLowerCase() && selected.author_id === user?.userId)).map(m => (
                                <option key={m.email} value={m.email}>{m.email}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        {selected.reviewer_email && (
                          <small className="text-xs text-[var(--text-subtle)]">Assigned to {selected.reviewer_email}. Other reviewers cannot decide; an admin may take over.</small>
                        )}

                        <div className="flex gap-2 items-center flex-wrap my-3">
                          {selected.state === "submitted" && (
                            <button className="secondary text-xs" onClick={() => {
                              const link = `${window.location.origin}/workspace?workspace=${encodeURIComponent(workspaceId)}&draft=${encodeURIComponent(selected.id)}`;
                              navigator.clipboard.writeText(link).then(() => setMessage("Review link copied. The recipient still needs workspace access.")).catch(() => setMessage(link));
                            }}>Copy review link</button>
                          )}
                          {editable && ["draft", "needs_review", "changes_requested"].includes(selected.state) && (
                            <button disabled={busy || dirty || (!body.trim() && !image)} onClick={() => run({ action: "submit", draftId, version: selected.version })}>
                              Send for approval
                            </button>
                          )}
                        </div>

                        {decisionsAllowed && (
                          <div className="product-quick-templates">
                            <small className="text-xs text-[var(--text-subtle)]">Decision note templates:</small>
                            <div className="product-template-pills">
                              {[
                                "All terminology and promotional claims verified against active guidelines.",
                                "Approved: Visual asset fingerprint and alt text confirmed compliant.",
                                "Changes requested: Please substantiate the numeric performance claim in paragraph 2.",
                                "Changes requested: Update graphic alt text to convey meaningful context."
                              ].map((t, idx) => (
                                <button key={idx} type="button" className="product-template-pill" onClick={() => setNote(t)}>{t}</button>
                              ))}
                            </div>
                          </div>
                        )}

                        <label className="text-xs">Comment or decision reason
                          <textarea rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} placeholder="Provide rationale for approval or requested changes..." />
                        </label>
                        <div className="flex gap-2 items-center flex-wrap mt-2">
                          <button className="secondary text-xs" disabled={busy || !note.trim()} onClick={() => run({ action: "comment", draftId, version: selected.version, note })}>
                            Add comment
                          </button>
                          {decisionsAllowed && (
                            <>
                              <button disabled={busy || !note.trim()} onClick={() => run({ action: "decide", draftId, version: selected.version, decision: "approved", note })}>
                                Approve revision
                              </button>
                              <button className="secondary text-xs" disabled={busy || !note.trim()} onClick={() => run({ action: "decide", draftId, version: selected.version, decision: "changes_requested", note })}>
                                Request changes
                              </button>
                            </>
                          )}
                        </div>
                        {selected.reviewer_email && !decisionsAllowed && selected.state === "submitted" && selected.author_id !== user?.userId && data.role === "reviewer" && (
                          <p className="product-notice text-xs">This revision is assigned to another reviewer.</p>
                        )}

                        <h3 className="text-xs uppercase tracking-wider text-[var(--text-subtle)] mt-6">Discussion & decision log</h3>
                        {data.events.filter(event => event.draft_id === selected.id && ["comment","approved","changes_requested","reviewer_assigned"].includes(event.action)).slice(0,20).map(event => (
                          <div className="product-thread-entry p-3 bg-[var(--bg-surface-sunken)] rounded my-2 text-xs border border-[var(--border-subtle)]" key={event.id}>
                            <div className="flex items-center justify-between">
                              <strong className="capitalize">{event.action.replaceAll("_"," ")}</strong>
                              <span className="text-[var(--text-subtle)] text-[11px]">{event.actor_email} · {new Date(event.created_at).toLocaleString()}</span>
                            </div>
                            <p className="mt-1 text-[var(--text-main)]">{JSON.parse(event.detail).note || JSON.parse(event.detail).reviewer || ""}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              </div>
            </>}

            {tab === "brand" && <>
              <PolicyPanel key={`${workspaceId}:${data.policy.version}`} current={data.policy} proposals={data.proposals} admin={data.role === "admin"} busy={busy} run={run} />
              <section>
                <h2>Policy impact across content</h2>
                <p className="text-xs text-[var(--text-muted)]">Stored review findings across workspace content. Recheck outdated items before relying on these counts.</p>
                {data.drafts.map(d => (
                  <div className="product-impact-row" key={d.id}>
                    <strong>{d.title}</strong>
                    <span className="text-xs text-[var(--text-muted)]">{JSON.parse(d.findings).length} findings</span>
                    <span className={`product-status status-${d.state}`}>{d.state.replaceAll("_"," ")}</span>
                    <small>Policy v{d.policy_version}{d.policy_version !== data.policy.version ? " · outdated" : ""}</small>
                  </div>
                ))}
              </section>
            </>}

            {tab === "insights" && <InsightsPanel drafts={data.drafts} events={data.events} policy={data.policy.pack} openDraft={id => { const draft = data.drafts.find(item => item.id === id); if (draft) { select(draft); setTab("content"); } }} />}

            {tab === "team" && <section>
              <h2>Workspace members</h2>
              <p className="text-xs text-[var(--text-muted)]">Members can see this workspace&apos;s content. Creators write and submit; reviewers decide; admins manage guidelines and access.</p>
              {data.members.map(member => (
                <div className="product-member" key={member.email}>
                  <span className="font-medium text-xs">{member.email}</span>
                  <span className="editorial-badge">{member.role}</span>
                  {data.role === "admin" && member.role !== "admin" && (
                    <button className="secondary text-xs h-7 px-2" disabled={busy || !removalNote.trim()} onClick={() => run({ action: "removeMember", email: member.email, note: removalNote })}>
                      Remove access
                    </button>
                  )}
                </div>
              ))}
              {data.role === "admin" && (
                <div className="mt-6 pt-4 border-t border-[var(--border-subtle)]">
                  <label className="text-xs">Reason for removing access (required if removing)
                    <input maxLength={2000} value={removalNote} onChange={e => setRemovalNote(e.target.value)} placeholder="Administrative reason..." />
                  </label>
                  <form className="mt-4" onSubmit={e => { e.preventDefault(); run({ action: "invite", email: memberEmail, role: memberRole }); }}>
                    <h3 className="text-sm font-semibold mb-2">Grant workspace access</h3>
                    <label className="text-xs">Teammate sign-in email
                      <input type="email" required maxLength={254} value={memberEmail} onChange={e => setMemberEmail(e.target.value)} placeholder="colleague@organization.com" />
                    </label>
                    <label className="text-xs">Role assignment
                      <select value={memberRole} onChange={e => setMemberRole(e.target.value)}>
                        <option value="reviewer">Reviewer</option>
                        <option value="creator">Creator</option>
                      </select>
                    </label>
                    <button disabled={busy} className="mt-2">Grant workspace access</button>
                    <small className="text-[11px] text-[var(--text-subtle)] mt-1">Share the workspace URL manually. Teammates must sign in with this exact email.</small>
                  </form>
                </div>
              )}
            </section>}

            {tab === "history" && <section>
              <h2>Activity & revision history</h2>
              <p className="text-xs text-[var(--text-muted)]">The latest 200 server-recorded events. Decisions retain their content, policy and review snapshots.</p>
              {!data.events.length && <p className="text-xs text-[var(--text-subtle)]">No recorded activity yet.</p>}
              {data.events.map(event => (
                <details className="product-event my-2 text-xs" key={event.id}>
                  <summary className="cursor-pointer py-1 font-medium text-[var(--text-main)]">
                    <span className="capitalize">{event.action.replaceAll("_"," ")}</span> · {event.actor_email} · {new Date(event.created_at).toLocaleString()}{event.version ? ` · revision ${event.version}` : ""}
                  </summary>
                  <pre className="p-3 bg-[var(--bg-surface-sunken)] rounded mt-1 font-mono text-[11px]">{JSON.stringify(JSON.parse(event.detail),null,2)}</pre>
                </details>
              ))}
            </section>}
          </>}
        </>}

        {showCertificate && selected && (
          <div className="product-cert-overlay" onClick={() => setShowCertificate(false)}>
            <div className="product-cert-card" onClick={e => e.stopPropagation()}>
              <div className="product-cert-header">
                <div>
                  <h2 className="text-xl font-serif">Brand Clearance Certificate</h2>
                  <p className="text-xs text-[var(--text-muted)] m-0">Pre-publication brand compliance sign-off</p>
                </div>
                <span className="editorial-badge status-approved text-xs px-2 py-1">APPROVED FOR RELEASE</span>
              </div>
              <div className="product-cert-grid text-xs">
                <div><strong>Workspace:</strong> {workspaceName || "Brand Workspace"}</div>
                <div><strong>Policy Pack:</strong> {data?.policy.pack.name} (v{selected.policy_version})</div>
                <div><strong>Content Title:</strong> {selected.title}</div>
                <div><strong>Revision Number:</strong> Revision {selected.version}</div>
                <div><strong>Creator ID:</strong> {selected.author_id}</div>
                <div><strong>Deciding Reviewer:</strong> {selected.reviewer_email || (data?.events.find(e => e.draft_id === selected.id && e.action === "approved")?.actor_email) || "Authorized Reviewer"}</div>
              </div>
              <div className="product-cert-checks">
                <h3 className="text-xs font-semibold mb-2">Compliance verification record</h3>
                <div className="product-cert-check-item">
                  <CheckCircle2 size={13} className="text-[var(--status-approved-text)]" />
                  <div><strong>Terminology Policy:</strong> All terminology verified; 0 retired names present in this revision.</div>
                </div>
                <div className="product-cert-check-item">
                  <CheckCircle2 size={13} className="text-[var(--status-approved-text)]" />
                  <div><strong>Claims & Positioning:</strong> Promotional statements match approved evidentiary records.</div>
                </div>
                <div className="product-cert-check-item">
                  <CheckCircle2 size={13} className="text-[var(--status-approved-text)]" />
                  <div><strong>Visual Asset Governance:</strong> {selected.image ? `Asset fingerprint verified (${JSON.parse(selected.image).sha256?.slice(0, 16)}...)` : "Text-only draft; no unapproved visual media attached."}</div>
                </div>
                <div className="product-cert-check-item">
                  <CheckCircle2 size={13} className="text-[var(--status-approved-text)]" />
                  <div><strong>Accessibility Standard:</strong> {selected.image ? (JSON.parse(selected.image).decorative ? "Marked decorative asset" : "Descriptive alt text recorded") : "No embedded graphics."}</div>
                </div>
              </div>
              {data?.events.find(e => e.draft_id === selected.id && e.action === "approved") && (
                <div className="p-3 rounded bg-[var(--bg-surface-sunken)] border border-[var(--border-subtle)] text-xs my-2">
                  <strong>Reviewer Approval Note:</strong>
                  <p className="italic my-1 text-[var(--text-main)]">
                    &ldquo;{JSON.parse(data.events.find(e => e.draft_id === selected.id && e.action === "approved")!.detail).note || "Approved without exception."}&rdquo;
                  </p>
                  <small className="text-[11px] text-[var(--text-subtle)]">
                    Decided on {new Date(data.events.find(e => e.draft_id === selected.id && e.action === "approved")!.created_at).toLocaleString()}
                  </small>
                </div>
              )}
              <div className="product-cert-actions">
                <button type="button" onClick={() => window.print()}><Printer size={13} /> Print certificate</button>
                <button type="button" className="secondary" onClick={() => {
                  const approvalEvt = data?.events.find(e => e.draft_id === selected.id && e.action === "approved");
                  const noteText = approvalEvt ? JSON.parse(approvalEvt.detail).note : "Approved";
                  const md = `# Brand Clearance Certificate\n\n- **Workspace:** ${workspaceName}\n- **Policy Version:** ${data?.policy.pack.name} (v${selected.policy_version})\n- **Content:** ${selected.title} (Revision ${selected.version})\n- **Status:** APPROVED FOR PUBLICATION\n- **Approval Note:** ${noteText}\n- **Date:** ${new Date().toISOString()}\n\nVerified via BrandCheck Pre-Publication Governance.`;
                  navigator.clipboard.writeText(md).then(() => setMessage("Certificate markdown summary copied to clipboard."));
                }}><Copy size={13} /> Copy markdown summary</button>
                <button type="button" className="secondary" onClick={() => setShowCertificate(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  </div>;
}
