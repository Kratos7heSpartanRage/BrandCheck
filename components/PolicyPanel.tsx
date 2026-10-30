"use client";
import { useState } from "react";
import type { Policy } from "../lib/policy";
import BrandGuidelineForm from "./BrandGuidelineForm";
export type Proposal = { id: string; base_version: number; payload: string; state: string; origin: string; created_at: string; diff: unknown; comparison?: string };
export default function PolicyPanel({ current, proposals, admin, busy, run, sandbox = false }: { current: { version: number; pack: Policy }; proposals: Proposal[]; admin: boolean; busy: boolean; run: (action: Record<string, unknown>) => Promise<void>; sandbox?: boolean }) {
  const [json, setJson] = useState(JSON.stringify(current.pack, null, 2));
  const [url, setUrl] = useState(""); const [note, setNote] = useState(""); const [error, setError] = useState("");
  function renameExample() {
    const pack = structuredClone(current.pack); pack.name = "NovaDesk One naming update";
    pack.sources = pack.sources.map(source => source.id === "TERM-001" ? { ...source, version: `policy-${current.version + 1}`, body: "NovaDesk One is the approved name. NovaDesk and Flowly are retired." } : source.id === "MSG-001" ? { ...source, version: `policy-${current.version + 1}`, body: "NovaDesk One is designed to simplify daily work. This is approved positioning, not a quantified performance promise." } : source);
    pack.terms = [...pack.terms.filter(t => t.retired !== "NovaDesk").map(t => ({ ...t, preferred: "NovaDesk One" })), { id: "term-novadesk", retired: "NovaDesk", preferred: "NovaDesk One", sourceId: "TERM-001" }];
    setJson(JSON.stringify(pack, null, 2));
  }
  return <section><h2>Brand policy and regression review</h2><p>Active pack: <strong>{current.pack.name}</strong> · workspace policy version {current.version}. Policy changes require explicit admin approval.</p>
    <details><summary>View approved sources and terminology</summary><pre>{JSON.stringify(current.pack, null, 2)}</pre></details>
    {admin && <>{!sandbox && <BrandGuidelineForm pack={current.pack} busy={busy} propose={policy => { run({ action: "proposePolicy", policy }); }} />}<details open={sandbox}><summary>{sandbox ? "Try a policy change" : "Advanced import and example policy"}</summary><h3>Propose a policy change</h3><p>Paste an approved brand-pack JSON file or fetch one from a public GitHub raw URL. A fetch creates a proposal; it never silently replaces active rules.</p>
      <button disabled={busy} onClick={renameExample}>Prepare sample product rename</button>
      <label>Proposed policy JSON<textarea rows={12} value={json} onChange={e => setJson(e.target.value)} /></label>
      <button disabled={busy} onClick={() => { try { const policy = JSON.parse(json); setError(""); run({ action: "proposePolicy", policy }); } catch { setError("Enter valid JSON before proposing."); } }}>Create proposal</button>
      {error && <p role="alert">{error}</p>}
      {!sandbox && <><label>Public GitHub raw policy URL<input type="url" placeholder="https://raw.githubusercontent.com/owner/repo/main/brand-policy.json" value={url} onChange={e => setUrl(e.target.value)} /></label>
      <button disabled={busy || !url} onClick={() => run({ action: "syncPolicy", url })}>Fetch policy proposal</button>
      <small>Read-only, on-demand connector. No private repository access or background polling. Other policy platforms are not connected.</small></>}
      </details><label>Policy decision reason<textarea maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></label>
    </>}
    <h3>Policy proposals</h3>{proposals.length ? proposals.map(p => <article key={p.id}><strong>{p.state} · based on policy {p.base_version}</strong><p>Source: {p.origin}</p><small>{p.comparison || "Proposal comparison"}</small><pre>{JSON.stringify(p.diff, null, 2)}</pre><details><summary>Inspect proposed source material</summary><pre>{JSON.stringify(JSON.parse(p.payload), null, 2)}</pre></details>{admin && p.state === "pending" && <><button disabled={busy || !note.trim()} onClick={() => run({ action: "decidePolicy", proposalId: p.id, accept: true, note })}>Activate and recheck drafts</button><button disabled={busy || !note.trim()} onClick={() => run({ action: "decidePolicy", proposalId: p.id, accept: false, note })}>Reject proposal</button></>}</article>) : <p>No policy proposals yet.</p>}
    <p>{sandbox ? "This local sandbox rechecks the two example drafts. Open Shared workspaces for saved history, server-enforced roles and the live GitHub connector." : "Activation records the old and new packs, checks up to 100 workspace drafts, and marks affected submitted or approved drafts as needing review. Concurrently edited drafts are not overwritten; outdated policy versions are labelled for recheck."}</p>
  </section>;
}
