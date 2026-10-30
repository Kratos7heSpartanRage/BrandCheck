"use client";
import { useRef, useState } from "react";
import { extractDocument, contrastRatio } from "../../lib/documents";
import type { ExtractedDocument } from "../../lib/documents";
import { checkPolicy, defaultPolicy } from "../../lib/policy";
import type { Finding } from "../../components/brandcheck/model";

export default function DocumentReview() {
  const [document, setDocument] = useState<ExtractedDocument | null>(null);
  const [findings, setFindings] = useState<{ part: number; finding: Finding }[]>([]);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [reviewed, setReviewed] = useState(false); const [focused, setFocused] = useState<number | null>(null);
  const [foreground, setForeground] = useState("#777777"); const [background, setBackground] = useState("#FFFFFF");
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[] | null>(null); const [workspaceId, setWorkspaceId] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const ratio = contrastRatio(foreground, background);
  async function importFile(file?: File) {
    if (!file) return; setBusy(true); setMessage(""); setDocument(null); setFindings([]); setReviewed(false);
    try { setDocument(await extractDocument(file)); } catch (error) { setMessage(error instanceof Error ? error.message : "Cannot import this document."); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  function review() {
    if (!document) return;
    if (document.parts.reduce((n, part) => n + part.text.length, 0) > 80_000) { setMessage("Edited document exceeds 80,000 characters. Shorten it before review."); return; }
    const checked = document.parts.flatMap((part, index) => checkPolicy(defaultPolicy, "", part.text).map(finding => ({ part: index, finding })));
    setFindings(checked.slice(0, 200));
    setReviewed(true); setMessage(checked.length > 200 ? `Found ${checked.length} rule findings; showing the first 200. Review a shorter document to inspect the rest.` : "Review complete. Inspect findings and extracted text before making a publication decision.");
  }
  async function shared(action?: unknown) {
    const response = await fetch("/api/workspaces", action ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) } : { cache: "no-store" });
    const result = await response.json() as { error?: string; workspaces?: { id: string; name: string; role: string }[] };
    if (!response.ok) throw new Error(result.error || "Unable to reach shared workspace."); return result;
  }
  function documentPayload() {
    if (!document) return null;
    let offset = 0;
    const segments = document.parts.map(part => { const start = offset; offset += part.text.length; const end = offset; offset += 2; return { label: part.label, start, end }; });
    const extension = document.name.split(".").pop()?.toLowerCase();
    return { name: document.name.slice(0,200), type: ["pdf","docx","txt","md"].includes(extension || "") ? extension : "txt", segments };
  }
  return <main className="document-desk">
    <style>{`.document-desk{max-width:1100px;margin:auto;padding:24px;font:16px/1.5 system-ui;color:#163c32}.document-desk section,.document-desk article{padding:20px;background:white;border:1px solid #cbdad2;border-radius:12px;margin:16px 0}.document-desk button,.document-desk .button{padding:10px 15px;border:0;border-radius:7px;background:#164e43;color:white;margin:5px 8px 5px 0;cursor:pointer;display:inline-block}.document-desk button:disabled{opacity:.5;cursor:default}.document-desk textarea,.document-desk select{display:block;padding:10px;width:100%;box-sizing:border-box;border:1px solid #96afa4;border-radius:8px;background:white;color:#163c32}.document-columns{display:grid;grid-template-columns:1fr 1fr;gap:20px}.document-desk a{color:#145942;text-decoration:underline}.document-desk .notice{padding:14px;background:#fff0c9}.document-desk .focused{outline:3px solid #207660}.document-desk small{display:block}.document-desk label{display:block;margin:12px 0}.document-desk input[type=color]{margin-left:10px;width:70px;height:40px}@media(max-width:720px){.document-columns{grid-template-columns:1fr}.document-desk{padding:14px}}`}</style>
    <a href="/">← BrandCheck review desk</a> · <a href="/workspace">Shared workspaces</a>
    <h1>Document review and visual checks</h1><p>Import a document, inspect source-linked findings and jump to its page or paragraph. Parsing and these rule checks run on your device.</p>
    <section><h2>1. Import content</h2><label>PDF, DOCX, text or Markdown (up to 15 MB)<input ref={input} type="file" accept=".pdf,.docx,.txt,.md" disabled={busy} onChange={e => importFile(e.target.files?.[0])} /></label>
      <button disabled={busy} onClick={() => { setDocument({ name: "Example launch document", parts: [{ label: "Page 1", text: "NovaDesk is designed to simplify daily work." }, { label: "Page 2", text: "Flowly guarantees 2x productivity for every team." }], warnings: ["This is a built-in sample, not an uploaded PDF."] }); setReviewed(false); setFindings([]); setMessage(""); }}>Try a two-page example</button>
      <small>Up to 40 PDF pages, 400 DOCX paragraphs and 80,000 extracted characters. Scanned PDFs need OCR and will be identified as unsupported. Page links are text-location links, not pixel-coordinate highlights.</small>
    </section>
    {busy && <p role="status">Processing document or workspace request…</p>}{message && <p className="notice" role="status">{message}</p>}
    {document && <><p><strong>{document.name}</strong> · {document.parts.length} text sections ({document.parts.map(p => p.text).join("\n\n").length.toLocaleString()} characters). Source policy: {defaultPolicy.name}.</p>{document.warnings.map((warning, i) => <p className="notice" key={i}>{warning}</p>)}
      <button onClick={review}>2. Review extracted text</button><small>Editing a section clears findings; run review again. No content is sent to an AI service on this page.</small>
      <div className="document-columns"><section><h2>Document text</h2>{document.parts.map((part, index) => <article id={`document-part-${index}`} className={focused === index ? "focused" : ""} key={index}><label>{part.label}<textarea rows={6} value={part.text} onChange={e => { setDocument({ ...document, parts: document.parts.map((p, i) => i === index ? { ...p, text: e.target.value } : p) }); setReviewed(false); setFindings([]); }} maxLength={10000} /></label></article>)}</section>
      <section><h2>Explained findings {reviewed ? `(${findings.length})` : ""}</h2>{!reviewed ? <p>Run review to see findings.</p> : findings.length ? findings.map(({ part, finding }, index) => <article key={index}><a href={`#document-part-${part}`} onClick={() => setFocused(part)}>{document.parts[part].label}</a> · {finding.category}<blockquote>{finding.excerpt}</blockquote><p>{finding.explanation}</p><small>{finding.sourceId} · v{finding.sourceVersion} · {finding.evidenceStatus}</small><p>Suggested action: {finding.suggestion}</p></article>) : <p>No rule findings. Human review is still required; these checks cannot establish that all claims are true.</p>}</section></div>
      <section><h2>3. Hand off for human approval</h2><p>Send extracted text to an authenticated workspace. This saves a new draft with its page or paragraph locations; the original file stays on your device. Workspace drafts support up to 10,000 characters.</p>
        {document.parts.map(p => p.text).join("\n\n").length > 10000 && <div className="notice" style={{ background: "#fff2d6", border: "1px solid #d4a34b", padding: "10px", borderRadius: "6px", margin: "10px 0" }}>⚠️ Extracted text is {document.parts.map(p => p.text).join("\n\n").length.toLocaleString()} characters, exceeding the 10,000-character shared workspace limit. <button type="button" onClick={() => {
          let accumulated = 0; const newParts: { label: string; text: string }[] = [];
          for (const part of document.parts) {
            const added = (newParts.length ? 2 : 0) + part.text.length;
            if (accumulated + added <= 10000) { newParts.push(part); accumulated += added; }
            else { const remaining = 10000 - accumulated - (newParts.length ? 2 : 0); if (remaining > 0) newParts.push({ label: part.label, text: part.text.slice(0, remaining) }); break; }
          }
          setDocument({ ...document, parts: newParts, warnings: [...document.warnings, "Text was truncated to 10,000 characters for workspace handoff."] }); setReviewed(false); setFindings([]); setMessage("Document truncated to 10,000 characters for workspace handoff.");
        }}>Truncate to first 10,000 characters</button></div>}
        <button disabled={busy} onClick={async () => { setBusy(true); try { const data = await shared(); const options = data.workspaces?.filter(w => w.role !== "reviewer") || []; setWorkspaces(options); setWorkspaceId(options[0]?.id || ""); if (!options.length) setMessage("Create a workspace first, then return here to hand off your document."); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); } }}>Load my shared workspaces</button>
        {workspaces && <><label>Destination workspace<select value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}>{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><button disabled={busy || !workspaceId || document.parts.map(p => p.text).join("\n\n").length > 10000} onClick={async () => { setBusy(true); try { await shared({ action: "createDraft", workspaceId, title: document.name.slice(0, 100), body: document.parts.map(p => p.text).join("\n\n"), document: documentPayload() }); setMessage("Shared draft created. Open Shared workspaces to submit it for review."); } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); } }}>Create shared draft ({document.parts.map(p => p.text).join("\n\n").length.toLocaleString()} / 10,000 chars)</button></>}
        <a className="button" href="/workspace">Open shared workspaces</a>
      </section>
    </>}
    <section><h2>Text contrast check</h2><p>Check an explicit foreground/background pair against text contrast thresholds. This does not inspect logo clear space, infer image backgrounds or certify full accessibility.</p><label>Text colour<input type="color" value={foreground} onChange={e => setForeground(e.target.value)} /></label><label>Background colour<input type="color" value={background} onChange={e => setBackground(e.target.value)} /></label><p style={{ background, color: foreground, padding: 18 }}>Brand message preview</p><strong>Contrast {ratio.toFixed(2)}:1</strong><p>{ratio >= 4.5 ? "Passes the 4.5:1 threshold for normal text." : ratio >= 3 ? "Passes 3:1 for qualifying large text; fails 4.5:1 for normal text." : "Below both normal-text and large-text thresholds. Choose a higher-contrast pair."}</p></section>
  </main>;
}
