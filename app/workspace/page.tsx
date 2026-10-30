"use client";

import { useEffect, useState } from "react";
import PolicyPanel from "../../components/PolicyPanel";
import type { Proposal } from "../../components/PolicyPanel";
import type { Policy } from "../../lib/policy";

type Workspace = { id: string; name: string; role: string };
type Draft = { id: string; title: string; body: string; version: number; state: string; author_id: string; findings: string; policy_version: number };
type Data = { role: string; policy: { version: number; pack: Policy }; proposals: Proposal[]; drafts: Draft[]; events: { id: string; draft_id: string | null; actor_email: string; action: string; version: number | null; detail: string; created_at: string }[]; members: { email: string; role: string }[] };
async function api<T>(path: string, action?: unknown): Promise<T> {
  const response = await fetch(path, action ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) } : { cache: "no-store" });
  const value = await response.json() as { error?: string };
  if (!response.ok) throw new Error(value.error || "Request failed.");
  return value as T;
}
export default function SharedWorkspace() {
  const [user, setUser] = useState<{ userId: string; email: string } | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [draftId, setDraftId] = useState("");
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [note, setNote] = useState(""); const [name, setName] = useState("");
  const [inviteEmail, setInviteEmail] = useState(""); const [role, setRole] = useState("reviewer");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const selected = data?.drafts.find(d => d.id === draftId);
  const submission = selected && selected.findings ? { findings: JSON.parse(selected.findings) as { id: string; location: string; excerpt: string; explanation: string; sourceId: string; sourceVersion: string; suggestion: string }[] } : null;
  async function loadList() {
    const result = await api<{ user: { userId: string; email: string }; workspaces: Workspace[] }>("/api/workspaces"); setUser(result.user); setWorkspaces(result.workspaces);
    return result.workspaces as Workspace[];
  }
  async function load(id: string) { setData(await api<Data>(`/api/workspaces?workspaceId=${encodeURIComponent(id)}`)); }
  useEffect(() => { loadList().then(list => { if (list[0]) setWorkspaceId(list[0].id); }).catch(error => setMessage(error.message)).finally(() => setReady(true)); }, []);
  useEffect(() => { if (workspaceId) { setData(null); setDraftId(""); setTitle(""); setBody(""); load(workspaceId).catch(error => setMessage(error.message)); } }, [workspaceId]);
  function select(draft: Draft) { setDraftId(draft.id); setTitle(draft.title); setBody(draft.body); setNote(""); setMessage(""); }
  async function run(action: Record<string, unknown>) {
    if (busy) return; setBusy(true); setMessage("");
    try {
      const result = await api<{ workspaceId?: string; draftId?: string; rechecked?: number; skipped?: number }>("/api/workspaces", { workspaceId, ...action });
      if (result.workspaceId) { await loadList(); setWorkspaceId(result.workspaceId); }
      else { await load(workspaceId); if (result.draftId) setDraftId(result.draftId); }
      setNote(""); setMessage(result.rechecked !== undefined ? `Policy activated. Rechecked ${result.rechecked} drafts; ${result.skipped || 0} concurrent edits skipped. Inspect policy versions before approving.` : "Saved to shared workspace.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed."); }
    finally { setBusy(false); }
  }
  const canEdit = user && selected?.author_id === user.userId && data?.role !== "reviewer";
  const canDecide = selected?.state === "submitted" && selected.author_id !== user?.userId && ["admin", "reviewer"].includes(data?.role || "");
  return <main className="shared-workspace">
    <style>{`
      .shared-workspace{max-width:1120px;margin:auto;padding:28px;color:#182d2a;font:16px/1.5 system-ui}
      .shared-workspace h1{font-size:32px}.shared-workspace h2{font-size:21px;margin:0 0 12px}
      .shared-workspace section{background:white;border:1px solid #cbd9d4;border-radius:12px;padding:20px;margin:16px 0}
      .shared-workspace input,.shared-workspace textarea,.shared-workspace select{display:block;width:100%;padding:10px;border:1px solid #8da79e;border-radius:6px;margin:5px 0 12px;background:white;color:#182d2a;box-sizing:border-box}
      .shared-workspace button,.shared-workspace .signin{background:#164e43;color:white;border:0;border-radius:7px;padding:10px 14px;margin:4px 8px 4px 0;cursor:pointer;display:inline-block}
      .shared-workspace button:disabled{opacity:.5;cursor:default}.shared-workspace a{color:#135c48;text-decoration:underline}
      .shared-workspace .signin{color:white}.shared-grid{display:grid;grid-template-columns:280px 1fr;gap:20px}
      .shared-workspace .draft-option{display:block;width:100%;text-align:left;background:#edf5f0;color:#182d2a;border:1px solid #cbd9d4}
      .shared-workspace .draft-option[aria-pressed=true]{border:2px solid #135c48}.shared-workspace pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.5 system-ui}
      .shared-workspace .notice{padding:12px;background:#fff2cd;border-radius:8px}.shared-workspace small{display:block;color:#52645e}
      @media(max-width:720px){.shared-grid{grid-template-columns:1fr}.shared-workspace{padding:16px}}
    `}</style>
    <a href="/">← BrandCheck review demo</a> · <a href="/documents">Document review</a> · <a href="/policy-lab">Policy sandbox</a>
    <h1>Shared review workspace</h1>
    <p>Drafts and review decisions saved on the server, with separate authenticated creators and reviewers.</p>
    {message && <p className="notice" role="status">{message}</p>}
    {!ready ? <p>Loading identity…</p> : !user ? <section><h2>Sign in for shared work</h2><p>The public review demo remains available without sign-in. Shared workspaces require an authenticated account. Only explicitly invited accounts can access a workspace.</p><a className="signin" target="_top" href="/signin-with-chatgpt?return_to=%2Fworkspace">Sign in with ChatGPT</a><p>Use synthetic content while testing. Workspace members can read its drafts, comments and history.</p></section> : <>
      <p>Signed in as <strong>{user.email}</strong> · <a target="_top" href="/signout-with-chatgpt?return_to=%2Fworkspace">Sign out</a></p>
      <section><h2>Your workspaces</h2><label>Workspace<select value={workspaceId} disabled={busy} onChange={e => setWorkspaceId(e.target.value)}><option value="">Choose workspace</option>{workspaces.map(w => <option key={w.id} value={w.id}>{w.name} · {w.role}</option>)}</select></label>
        <form onSubmit={e => { e.preventDefault(); run({ action: "createWorkspace", name }); }}><label>New workspace name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label><button disabled={busy}>Create workspace</button></form>
      </section>
      {data && <><div className="shared-grid"><section><h2>Draft queue</h2><small>Your role: {data.role}. Refresh to see another person's changes.</small><button disabled={busy} onClick={() => { setDraftId(""); setTitle(""); setBody(""); setNote(""); load(workspaceId).catch(e => setMessage(e.message)); }}>Refresh queue</button>
        {data.drafts.map(d => <button disabled={busy} className="draft-option" aria-pressed={draftId === d.id} key={d.id} onClick={() => select(d)}>{d.title}<small>{d.state.replaceAll("_", " ")} · revision {d.version}</small></button>)}
        {data.role !== "reviewer" && <button disabled={busy} onClick={() => { setDraftId(""); setTitle(""); setBody(""); }}>New draft</button>}
      </section><section><h2>{selected ? "Review revision" : "Create a draft"}</h2>
        <p>Submitting runs server-side rule checks against this workspace's active approved policy. Sources and findings are saved with the revision. Live AI remains available in the separate public review desk.</p>
        <label>Title<input maxLength={100} value={title} disabled={busy || (!!selected && (!canEdit || selected.state === "submitted"))} onChange={e => setTitle(e.target.value)} /></label>
        <label>Draft text<textarea rows={10} maxLength={5000} value={body} disabled={busy || (!!selected && (!canEdit || selected.state === "submitted"))} onChange={e => setBody(e.target.value)} /></label>
        <small>{body.length}/5,000 characters</small>
        {!selected && data.role !== "reviewer" && <button disabled={busy || !title.trim()} onClick={() => run({ action: "createDraft", title, body })}>Create shared draft</button>}
        {selected && <><p>Status: <strong>{selected.state.replaceAll("_", " ")}</strong> · revision {selected.version} · checked policy {selected.policy_version}</p>{selected.policy_version !== data.policy.version && <p className="notice">Policy has changed. Save a new revision and submit it for a current review.</p>}
          <button disabled={busy} onClick={() => run({ action: "recheckDraft", draftId, version: selected.version })}>Recheck current policy</button>
          {canEdit && selected.state !== "submitted" && <button disabled={busy || !title.trim()} onClick={() => run({ action: "saveDraft", draftId, version: selected.version, title, body })}>Save new revision</button>}
          {canEdit && selected.state === "draft" && <button disabled={busy || title !== selected.title || body !== selected.body || !body.trim()} onClick={() => run({ action: "submit", draftId, version: selected.version })}>Submit saved revision</button>}
          <label>Comment or decision reason<textarea rows={3} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label>
          <button disabled={busy || !note.trim()} onClick={() => run({ action: "comment", draftId, version: selected.version, note })}>Add comment</button>
          {submission && <div><h3>Latest stored rule findings</h3><small>Source-linked checks for policy {selected.policy_version}. Draft edits clear prior findings; submit the saved text to check it again. An approval reason must explain any accepted issues.</small>{submission.findings?.length ? submission.findings.map(f => <article key={f.id}><strong>{f.excerpt}</strong><small>{f.location}</small><p>{f.explanation}</p><small>{f.sourceId} · v{f.sourceVersion}</small><p>Suggested action: {f.suggestion}</p></article>) : <p>No stored rule findings. This is not a guarantee that the content is compliant.</p>}</div>}
          {canDecide && <><button disabled={busy || !note.trim()} onClick={() => run({ action: "decide", draftId, version: selected.version, decision: "changes_requested", note })}>Request changes</button><button disabled={busy || !note.trim()} onClick={() => run({ action: "decide", draftId, version: selected.version, decision: "approved", note })}>Approve revision</button></>}
          {selected.author_id === user.userId && <small>A separate reviewer must decide on your submission.</small>}
        </>}
      </section></div>
      <PolicyPanel key={`${workspaceId}:${data.policy.version}`} current={data.policy} proposals={data.proposals} admin={data.role === "admin"} busy={busy} run={run} />
      <section><h2>Policy impact and recurring issues</h2><p>Current stored checks across this workspace. Recheck stale drafts before relying on these counts.</p>{data.drafts.length ? <ul>{data.drafts.map(d => <li key={d.id}>{d.title}: {JSON.parse(d.findings).length} findings · {d.state.replaceAll("_", " ")} · policy {d.policy_version}{d.policy_version !== data.policy.version ? " (outdated — recheck)" : ""}</li>)}</ul> : <p>No drafts yet.</p>}<details><summary>Issue categories across stored drafts</summary><pre>{JSON.stringify(data.drafts.flatMap(d => JSON.parse(d.findings) as { category: string }[]).reduce<Record<string, number>>((counts, finding) => { counts[finding.category] = (counts[finding.category] || 0) + 1; return counts; }, {}), null, 2)}</pre></details></section>
      <section><h2>Members</h2>{data.members.map(m => <p key={m.email}>{m.email} · {m.role}</p>)}
        {data.role === "admin" && <form onSubmit={e => { e.preventDefault(); run({ action: "invite", email: inviteEmail, role }); }}><label>Teammate's sign-in email<input required type="email" maxLength={254} value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} /></label><label>Role<select value={role} onChange={e => setRole(e.target.value)}><option value="reviewer">Reviewer</option><option value="creator">Creator</option></select></label><button disabled={busy}>Grant workspace access</button><small>No email is sent. Share this site's /workspace link; the teammate signs in using this exact email.</small></form>}
      </section>
      <section><h2>Activity and revision history</h2><p>Server-recorded events and revision snapshots. This is an application audit trail, not a cryptographically signed ledger.</p>{data.events.map(event => <details key={event.id}><summary>{event.action.replaceAll("_", " ")} · {event.actor_email} · {new Date(event.created_at).toLocaleString()} {event.version ? `· revision ${event.version}` : ""}</summary><pre>{JSON.stringify(JSON.parse(event.detail), null, 2)}</pre></details>)}</section>
      </>}
    </>}
  </main>;
}
