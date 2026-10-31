"use client";
import { useRef, useState } from "react";
import { extractDocument, contrastRatio } from "../../lib/documents";
import type { ExtractedDocument } from "../../lib/documents";
import { checkPolicy, defaultPolicy } from "../../lib/policy";
import { groundedAssessment } from "../../lib/grounded-assessment";
import type { DraftAssessment, Finding } from "../../components/brandcheck/model";

export default function DocumentReview() {
  const [document, setDocument] = useState<ExtractedDocument | null>(null);
  const [findings, setFindings] = useState<{ part: number; finding: Finding }[]>([]);
  const [assessment, setAssessment] = useState<DraftAssessment | null>(null);
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
    if (!file) return; setBusy(true); setMessage(""); setDocument(null); setFindings([]); setAssessment(null); setReviewed(false);
    try { setDocument(await extractDocument(file)); } catch (error) { setMessage(error instanceof Error ? error.message : "Cannot import this document."); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  }

  function review() {
    if (!document) return;
    if (document.parts.reduce((n, part) => n + part.text.length, 0) > 80_000) { setMessage("Edited document exceeds 80,000 characters. Shorten it before review."); return; }
    const checked = document.parts.flatMap((part, index) => checkPolicy(defaultPolicy, "", part.text).map(finding => ({ part: index, finding })));
    setFindings(checked.slice(0, 200));
    const fullText = document.parts.map(p => p.text).join("\n\n");
    const evalAssessment = groundedAssessment(checked.map(c => c.finding), fullText);
    setAssessment(evalAssessment);
    setReviewed(true);
    setMessage(checked.length > 200 ? `Found ${checked.length} rule findings; showing the first 200. Review a shorter document to inspect the rest.` : `Review complete: ${checked.length} findings evaluated against active brand rules.`);
  }

  const [filter, setFilter] = useState<"all" | "attention" | "suggestion">("all");

  function applyCompliantRewrites() {
    if (!document || !findings.length) return;
    let fixedCount = 0;
    const newParts = document.parts.map(part => {
      let text = part.text;
      for (const { finding } of findings) {
        if (finding.replacement && finding.replacement.from && text.includes(finding.replacement.from)) {
          text = text.replaceAll(finding.replacement.from, finding.replacement.to);
          fixedCount++;
        }
      }
      return { ...part, text };
    });
    setDocument({ ...document, parts: newParts });
    const checked = newParts.flatMap((part, index) => checkPolicy(defaultPolicy, "", part.text).map(finding => ({ part: index, finding })));
    setFindings(checked.slice(0, 200));
    const fullText = newParts.map(p => p.text).join("\n\n");
    setAssessment(groundedAssessment(checked.map(c => c.finding), fullText));
    setMessage(`Applied ${fixedCount} compliant replacement${fixedCount === 1 ? "" : "s"} across document sections.`);
  }

  function applySingleFix(partIndex: number, from: string, to: string) {
    if (!document) return;
    const newParts = document.parts.map((p, i) =>
      i === partIndex ? { ...p, text: p.text.replaceAll(from, to) } : p
    );
    setDocument({ ...document, parts: newParts });
    const checked = newParts.flatMap((part, index) =>
      checkPolicy(defaultPolicy, "", part.text).map(finding => ({ part: index, finding }))
    );
    setFindings(checked.slice(0, 200));
    const fullText = newParts.map(p => p.text).join("\n\n");
    setAssessment(groundedAssessment(checked.map(c => c.finding), fullText));
    setMessage(`Replaced “${from}” with “${to}” in ${document.parts[partIndex].label}.`);
  }

  const displayedFindings = findings.filter(f => {
    if (filter === "attention") return f.finding.severity === "Needs attention";
    if (filter === "suggestion") return f.finding.severity === "Suggestion";
    return true;
  });
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
    return { name: document.name.slice(0, 200), type: ["pdf", "docx", "txt", "md"].includes(extension || "") ? extension : "txt", segments };
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
          <div className="flex flex-wrap items-center gap-3">
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
            <button
              disabled={busy}
              onClick={() => {
                setDocument({
                  name: "Q4 Enterprise Campaign Brief",
                  parts: [
                    { label: "Executive Summary", text: "NovaDesk is designed to simplify daily work for modern organizations." },
                    { label: "Product Positioning", text: "Flowly guarantees 10x productivity for every team and eliminates 99% of inefficiencies." },
                    { label: "Competitive Benchmark", text: "Our revolutionary platform delivers results that are guaranteed 100% better than every competitor." },
                    { label: "Customer ROI Pledges", text: "Customers experience guaranteed 300% ROI within 30 days without hiring additional staff." }
                  ],
                  warnings: ["This is a built-in multi-section campaign sample."]
                });
                setReviewed(false);
                setFindings([]);
                setMessage("");
              }}
              className="h-8 px-3 text-xs font-medium rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface-raised)] text-[var(--text-main)] hover:bg-[var(--bg-surface-sunken)] transition-colors"
            >
              Load 4-section campaign brief
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

            {reviewed && assessment && (
              <div className="workspace-assessment-card mb-6 p-6 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-subtle)] block mb-1">
                      Document Governance Scorecard
                    </span>
                    <h3 className="text-xl font-serif text-[var(--text-main)] m-0">
                      Pre-Publication Compliance Assessment
                    </h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`editorial-badge ws-risk-badge font-medium text-xs px-3 py-1 rounded-full ${assessment.riskLevel === "Critical"
                      ? "status-danger"
                      : assessment.riskLevel === "High"
                        ? "status-needs_review"
                        : assessment.riskLevel === "Moderate"
                          ? "status-draft"
                          : "status-approved"
                      }`}>
                      {assessment.riskLevel} Exposure
                    </span>
                    <div className="flex items-center gap-2 pl-3 border-l border-[var(--border-subtle)]">
                      <span className="text-xs text-[var(--text-muted)] font-medium">Compliance Index:</span>
                      <strong className="text-lg font-mono text-[var(--text-main)]">{assessment.score}/100</strong>
                    </div>
                  </div>
                </div>

                <div className="w-full bg-[var(--bg-surface-sunken)] rounded-full h-2 overflow-hidden border border-[var(--border-subtle)]">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${assessment.score >= 85
                      ? "bg-emerald-600"
                      : assessment.score >= 60
                        ? "bg-amber-600"
                        : "bg-rose-600"
                      }`}
                    style={{ width: `${assessment.score}%` }}
                  />
                </div>

                <p className="text-xs text-[var(--text-main)] leading-relaxed m-0 font-medium">
                  {assessment.summary}
                </p>

                {(assessment.claimRiskNote || assessment.toneRiskNote) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {assessment.claimRiskNote && (
                      <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] text-xs text-[var(--status-warn-text)] space-y-1">
                        <strong className="block font-semibold">Claim Substantiation Alert</strong>
                        <p className="m-0 leading-relaxed">{assessment.claimRiskNote}</p>
                      </div>
                    )}
                    {assessment.toneRiskNote && (
                      <div className="p-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-sunken)] text-xs text-[var(--text-muted)] space-y-1">
                        <strong className="block font-semibold text-[var(--text-main)]">Voice & Tone Notes</strong>
                        <p className="m-0 leading-relaxed">{assessment.toneRiskNote}</p>
                      </div>
                    )}
                  </div>
                )}

                {findings.some(f => f.finding.replacement) && (
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)]">
                    <span className="text-xs text-[var(--text-muted)]">
                      Automated replacements available for {findings.filter(f => f.finding.replacement).length} finding(s).
                    </span>
                    <button
                      type="button"
                      onClick={applyCompliantRewrites}
                      className="h-8 px-4 text-xs font-medium rounded-[var(--radius-sm)] bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <span>✦ Apply All Compliant Fixes across Sections</span>
                    </button>
                  </div>
                )}
              </div>
            )}

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
                          setAssessment(null);
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
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[var(--border-subtle)]">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-subtle)] m-0">
                    Explained findings {reviewed ? `(${findings.length})` : ""}
                  </h3>
                  {reviewed && findings.length > 0 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setFilter("all")}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${filter === "all" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)]"}`}
                      >
                        All ({findings.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilter("attention")}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${filter === "attention" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)]"}`}
                      >
                        Attention ({findings.filter(f => f.finding.severity === "Needs attention").length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilter("suggestion")}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${filter === "suggestion" ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--bg-surface-raised)]"}`}
                      >
                        Suggestions ({findings.filter(f => f.finding.severity === "Suggestion").length})
                      </button>
                    </div>
                  )}
                </div>
                {!reviewed ? (
                  <p className="text-xs text-[var(--text-subtle)]">Run review to inspect source-grounded findings.</p>
                ) : displayedFindings.length ? (
                  displayedFindings.map(({ part, finding }, index) => (
                    <article className="product-finding" key={index}>
                      <div className="flex items-center justify-between">
                        <a
                          href={`#document-part-${part}`}
                          onClick={() => setFocused(part)}
                          className="font-mono text-xs font-semibold underline text-[var(--text-main)]"
                        >
                          {document.parts[part].label}
                        </a>
                        <span className={`editorial-badge ${finding.severity === "Needs attention" ? "status-danger" : "status-draft"}`}>
                          {finding.category} · {finding.severity}
                        </span>
                      </div>
                      <blockquote>{finding.excerpt}</blockquote>
                      <p>{finding.explanation}</p>
                      <small className="text-[11px] text-[var(--text-subtle)]">
                        {finding.sourceId} v{finding.sourceVersion} · {finding.evidenceStatus}
                      </small>
                      <p className="text-xs text-[var(--text-muted)] font-medium mt-1">Suggested action: {finding.suggestion}</p>
                      {finding.replacement && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => applySingleFix(part, finding.replacement!.from, finding.replacement!.to)}
                            className="h-6 px-2.5 text-[11px] font-medium rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface-raised)] text-[var(--accent-primary)] hover:bg-[var(--bg-surface-sunken)] transition-colors flex items-center gap-1"
                          >
                            <span>Replace with &ldquo;{finding.replacement.to}&rdquo;</span>
                          </button>
                        </div>
                      )}
                    </article>
                  ))
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">No findings match this filter.</p>
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
                className="h-8 px-3 text-xs font-medium rounded-[var(--radius-sm)] bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors shadow-sm flex items-center gap-1.5"
              >
                <span>✦ Auto-optimize to WCAG 4.5:1</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[var(--text-muted)]">
            <span className="text-[11px] font-medium text-[var(--text-subtle)]">Try presets:</span>
            <button
              type="button"
              onClick={() => { setForeground("#1a4332"); setBackground("#ffffff"); }}
              className="px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] text-[11px] hover:bg-[var(--bg-surface-sunken)] transition-colors"
            >
              NovaDesk Dark Green (#1a4332 on #fff)
            </button>
            <button
              type="button"
              onClick={() => { setForeground("#5a625c"); setBackground("#fbfbfa"); }}
              className="px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] text-[11px] hover:bg-[var(--bg-surface-sunken)] transition-colors"
            >
              Muted Body (#5a625c on #fbfbfa)
            </button>
            <button
              type="button"
              onClick={() => { setForeground("#858e87"); setBackground("#ffffff"); }}
              className="px-2.5 py-1 rounded-[var(--radius-sm)] border border-[#fca5a5] bg-[#fde8e4] text-[#b91c1c] text-[11px] hover:opacity-90 transition-opacity"
            >
              Subtle Gray (#858e87 on #fff) — Fails AA
            </button>
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
