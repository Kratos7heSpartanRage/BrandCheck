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
  function autoFixContrast() {
    const hexToRgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const rgbToHex = (r: number, g: number, b: number) => "#" + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
    const [br, bg, bb] = hexToRgb(background);
    const bgLum = 0.2126 * (br / 255) + 0.7152 * (bg / 255) + 0.0722 * (bb / 255);
    let [fr, fg, fb] = hexToRgb(foreground);
    for (let step = 0; step < 120; step++) {
      const curRatio = contrastRatio(rgbToHex(fr, fg, fb), background);
      if (curRatio >= 4.55) break;
      if (bgLum > 0.5) { fr = Math.max(0, fr - 4); fg = Math.max(0, fg - 4); fb = Math.max(0, fb - 4); }
      else { fr = Math.min(255, fr + 4); fg = Math.min(255, fg + 4); fb = Math.min(255, fb + 4); }
    }
    const optimized = rgbToHex(fr, fg, fb);
    setForeground(optimized);
    setMessage(`Optimized text color to ${optimized} for compliant 4.5:1 contrast.`);
  }
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
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] font-sans">
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-6 sm:px-10 h-14 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <a href="/" className="font-serif font-semibold text-[var(--text-main)] no-underline flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            BrandCheck
          </a>
          <span className="text-[var(--text-subtle)]">/</span>
          <span className="text-[var(--text-muted)] font-medium">Document review desk</span>
        </div>
        <div className="flex items-center gap-4 text-[var(--text-muted)]">
          <a href="/workspace" className="hover:text-[var(--text-main)] underline">Shared workspaces</a>
          <a href="/example" className="hover:text-[var(--text-main)] underline">Guest example</a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider text-[var(--text-subtle)] font-medium mb-1">Local Processing</p>
          <h1 className="text-3xl font-serif font-normal text-[var(--text-main)] tracking-tight">
            Document review and visual checks
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-2 max-w-2xl leading-relaxed">
            Extract text from PDF, DOCX, text or Markdown files with location-linked findings mapped directly to pages or paragraphs. Text parsing and rule execution run entirely on your device.
          </p>
        </div>

        {/* Section 1: Import Document */}
        <section className="p-6 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] mb-6 space-y-4">
          <h2 className="text-lg font-serif text-[var(--text-main)]">1. Import content</h2>
          <label className="text-xs text-[var(--text-muted)] block">
            PDF, DOCX, TXT or Markdown (up to 15 MB)
            <input
              ref={input}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              disabled={busy}
              onChange={e => importFile(e.target.files?.[0])}
              className="mt-1 block w-full text-xs border border-[var(--border-strong)] rounded-[var(--radius-sm)] p-2 bg-[var(--bg-surface)]"
            />
          </label>
          <div className="flex items-center gap-3">
            <button
              disabled={busy}
              onClick={() => {
                setDocument({
                  name: "Example launch document",
                  parts: [
                    { label: "Page 1", text: "NovaDesk is designed to simplify daily work." },
                    { label: "Page 2", text: "Flowly guarantees 2x productivity for every team." }
                  ],
                  warnings: ["This is a built-in sample document, not an uploaded PDF."]
                });
                setReviewed(false);
                setFindings([]);
                setMessage("");
              }}
              className="h-8 px-3 text-xs font-medium rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface-raised)] text-[var(--text-main)] hover:bg-[var(--bg-surface-sunken)] transition-colors"
            >
              Load two-page sample
            </button>
          </div>
          <small className="text-[11px] text-[var(--text-subtle)] block">
            Supports up to 40 PDF pages, 400 DOCX paragraphs and 80,000 extracted characters. Scanned PDFs without a text layer require OCR and are not supported.
          </small>
        </section>

        {busy && <p role="status" className="text-xs text-[var(--text-muted)] italic my-2">Processing document or workspace request...</p>}
        {message && <div role="status" className="product-notice">{message}</div>}

        {document && (
          <>
            <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] mb-6 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div>
                <strong className="font-mono text-[var(--text-main)]">{document.name}</strong> · {document.parts.length} sections ({document.parts.map(p => p.text).join("\n\n").length.toLocaleString()} characters)
                <span className="text-[var(--text-subtle)] block mt-0.5">Evaluated against {defaultPolicy.name}</span>
              </div>
              <button
                onClick={review}
                className="h-8 px-4 text-xs font-medium rounded-[var(--radius-sm)] bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors"
              >
                2. Review extracted text
              </button>
            </div>

            {document.warnings.map((warning, i) => (
              <div className="product-notice my-2" key={i}>{warning}</div>
            ))}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Left Column: Extracted Text */}
              <section className="p-5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
                  Extracted text sections
                </h3>
                {document.parts.map((part, index) => (
                  <article
                    id={`document-part-${index}`}
                    className={`p-3 rounded-[var(--radius-sm)] border transition-all ${focused === index ? "border-[var(--accent-primary)] ring-1 ring-[var(--accent-primary)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface-sunken)]"}`}
                    key={index}
                  >
                    <label className="text-xs font-mono text-[var(--text-muted)] block mb-1">
                      {part.label}
                      <textarea
                        rows={5}
                        value={part.text}
                        onChange={e => {
                          setDocument({
                            ...document,
                            parts: document.parts.map((p, i) => i === index ? { ...p, text: e.target.value } : p)
                          });
                          setReviewed(false);
                          setFindings([]);
                        }}
                        maxLength={10000}
                        className="w-full mt-1 p-2 text-xs font-mono border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-main)]"
                      />
                    </label>
                  </article>
                ))}
              </section>

              {/* Right Column: Explained Findings */}
              <section className="p-5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
                    Explained findings {reviewed ? `(${findings.length})` : ""}
                  </h3>
                </div>
                {!reviewed ? (
                  <p className="text-xs text-[var(--text-subtle)]">Run review to inspect source-grounded findings.</p>
                ) : findings.length ? (
                  findings.map(({ part, finding }, index) => (
                    <article className="product-finding" key={index}>
                      <div className="flex items-center justify-between">
                        <a
                          href={`#document-part-${part}`}
                          onClick={() => setFocused(part)}
                          className="font-mono text-xs font-semibold underline text-[var(--text-main)]"
                        >
                          {document.parts[part].label}
                        </a>
                        <span className="editorial-badge">{finding.category}</span>
                      </div>
                      <blockquote>{finding.excerpt}</blockquote>
                      <p>{finding.explanation}</p>
                      <small className="text-[11px] text-[var(--text-subtle)]">
                        {finding.sourceId} v{finding.sourceVersion} · {finding.evidenceStatus}
                      </small>
                      <p className="text-xs text-[var(--text-muted)] font-medium mt-1">Suggested action: {finding.suggestion}</p>
                    </article>
                  ))
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">No rule findings detected. Human review is still required before publication.</p>
                )}
              </section>
            </div>

            {/* Section 3: Workspace Handoff */}
            <section className="p-6 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] mb-8 space-y-4">
              <h2 className="text-lg font-serif text-[var(--text-main)]">3. Hand off for human approval</h2>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Send extracted text to an authenticated workspace. This saves a new draft with its section location map; the original file stays on your device. Workspace drafts support up to 10,000 characters.
              </p>

              {document.parts.map(p => p.text).join("\n\n").length > 10000 && (
                <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] text-xs text-[var(--status-warn-text)] space-y-2">
                  <p>Extracted text is {document.parts.map(p => p.text).join("\n\n").length.toLocaleString()} characters, exceeding the 10,000-character shared workspace limit.</p>
                  <button
                    type="button"
                    onClick={() => {
                      let accumulated = 0;
                      const newParts: { label: string; text: string }[] = [];
                      for (const part of document.parts) {
                        const added = (newParts.length ? 2 : 0) + part.text.length;
                        if (accumulated + added <= 10000) {
                          newParts.push(part);
                          accumulated += added;
                        } else {
                          const remaining = 10000 - accumulated - (newParts.length ? 2 : 0);
                          if (remaining > 0) newParts.push({ label: part.label, text: part.text.slice(0, remaining) });
                          break;
                        }
                      }
                      setDocument({
                        ...document,
                        parts: newParts,
                        warnings: [...document.warnings, "Text was truncated to 10,000 characters for workspace handoff."]
                      });
                      setReviewed(false);
                      setFindings([]);
                      setMessage("Document truncated to 10,000 characters for workspace handoff.");
                    }}
                    className="h-7 px-3 text-xs font-medium rounded-[var(--radius-sm)] border border-[var(--status-warn-border)] bg-white text-[var(--status-warn-text)] hover:bg-[var(--bg-surface-raised)]"
                  >
                    Truncate to first 10,000 characters
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const data = await shared();
                      const options = data.workspaces?.filter(w => w.role !== "reviewer") || [];
                      setWorkspaces(options);
                      setWorkspaceId(options[0]?.id || "");
                      if (!options.length) setMessage("Create a workspace first, then return here to hand off your document.");
                    } catch (error) {
                      setMessage((error as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                  className="secondary h-8 px-3 text-xs"
                >
                  Load shared workspaces
                </button>

                {workspaces && (
                  <>
                    <select
                      value={workspaceId}
                      onChange={e => setWorkspaceId(e.target.value)}
                      className="text-xs h-8 px-2 border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)]"
                    >
                      {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>

                    <button
                      disabled={busy || !workspaceId || document.parts.map(p => p.text).join("\n\n").length > 10000}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await shared({
                            action: "createDraft",
                            workspaceId,
                            title: document.name.slice(0, 100),
                            body: document.parts.map(p => p.text).join("\n\n"),
                            document: documentPayload()
                          });
                          setMessage("Shared draft created. Open Shared workspaces to submit it for review.");
                        } catch (error) {
                          setMessage((error as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className="h-8 px-3 text-xs"
                    >
                      Create shared draft ({document.parts.map(p => p.text).join("\n\n").length.toLocaleString()} / 10,000 chars)
                    </button>
                  </>
                )}
                <a href="/workspace" className="text-xs text-[var(--accent-primary)] font-medium underline ml-auto">
                  Open shared workspaces &rarr;
                </a>
              </div>
            </section>
          </>
        )}

        {/* Section 4: WCAG 2.2 Text Contrast & Accessibility */}
        <section className="p-6 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
          <h2 className="text-lg font-serif text-[var(--text-main)]">
            Text contrast check & accessibility compliance
          </h2>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Verify an explicit foreground and background color pair against WCAG 2.2 contrast ratios. This does not infer complex background images or certify overall accessibility.
          </p>

          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="text-xs font-mono text-[var(--text-muted)] flex items-center gap-2">
              Text: <span className="font-semibold">{foreground}</span>
              <input
                type="color"
                value={foreground}
                onChange={e => setForeground(e.target.value)}
                className="w-8 h-8 rounded border border-[var(--border-strong)] cursor-pointer"
              />
            </label>
            <label className="text-xs font-mono text-[var(--text-muted)] flex items-center gap-2">
              Background: <span className="font-semibold">{background}</span>
              <input
                type="color"
                value={background}
                onChange={e => setBackground(e.target.value)}
                className="w-8 h-8 rounded border border-[var(--border-strong)] cursor-pointer"
              />
            </label>
            {ratio < 4.5 && (
              <button
                type="button"
                onClick={autoFixContrast}
                className="secondary h-8 px-3 text-xs"
              >
                Auto-adjust to 4.5:1 contrast
              </button>
            )}
          </div>

          <div
            style={{ backgroundColor: background, color: foreground }}
            className="p-5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-sm font-medium my-4 leading-relaxed"
          >
            Brand preview sample: &ldquo;NovaDesk helps teams review content before publication.&rdquo;
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
            <span className="font-mono font-semibold text-[var(--text-main)]">
              Contrast {ratio.toFixed(2)}:1
            </span>
            <span className={`editorial-badge ${ratio >= 4.5 ? "status-approved" : "status-danger"}`}>
              WCAG AA Normal Text (4.5:1): {ratio >= 4.5 ? "Pass" : "Fail"}
            </span>
            <span className={`editorial-badge ${ratio >= 3.0 ? "status-approved" : "status-danger"}`}>
              WCAG AA Large Text (3.0:1): {ratio >= 3.0 ? "Pass" : "Fail"}
            </span>
            <span className={`editorial-badge ${ratio >= 7.0 ? "status-approved" : "status-draft"}`}>
              WCAG AAA Enhanced (7.0:1): {ratio >= 7.0 ? "Pass" : "Not met"}
            </span>
          </div>
        </section>
      </main>
    </div>
  );
}
}
