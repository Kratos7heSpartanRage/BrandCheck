import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { dateLabel, demoBody, FINGERPRINT, makeInitialState } from "./model";
import type { AppState, DraftBody, Finding, Persona, Screen } from "./model";
import { reviewDraft } from "./review";

const STORAGE_KEY = "brandcheck-demo-v1";
const MAX_IMAGE = 750_000;

function loadState(): AppState {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed: AppState = JSON.parse(saved);
      if (
        parsed &&
        Array.isArray(parsed.sources) &&
        Array.isArray(parsed.versions)
      )
        return {
          ...parsed,
          evidence: parsed.evidence ?? [],
          reviewRuns: parsed.reviewRuns ?? 0,
        };
    }
  } catch {
    /* storage may be disabled */
  }
  return makeInitialState();
}

const time = () => new Date().toISOString();
const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function sourceLabel(finding: Finding) {
  return `${finding.sourceId} · v${finding.sourceVersion}`;
}

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [toast, setToast] = useState("");
  const [dismissInputs, setDismissInputs] = useState<Record<string, string>>(
    {},
  );
  const [commentInput, setCommentInput] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [newRetired, setNewRetired] = useState("");
  const [newPreferred, setNewPreferred] = useState("");
  const [claimPhrase, setClaimPhrase] = useState("");
  const [claimReference, setClaimReference] = useState("");
  const [claimExpiry, setClaimExpiry] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const currentReview = state.reviewedFingerprint === FINGERPRINT(state.body);
  const latest = state.versions.at(-1);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      setToast(
        "Browser session storage is unavailable. Your changes may not survive a reload.",
      );
    }
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const patch = (changes: Partial<AppState>) =>
    setState((previous) => ({ ...previous, ...changes }));
  const updateBody = (changes: Partial<DraftBody>) =>
    setState((previous) => ({
      ...previous,
      body: { ...previous.body, ...changes },
      reviewedFingerprint: null,
      status: previous.status === "approved" ? "draft" : previous.status,
    }));
  const updateImage = (changes: Partial<NonNullable<DraftBody["image"]>>) => {
    if (!state.body.image) return;
    updateBody({ image: { ...state.body.image, ...changes } });
  };
  const startDemo = () => {
    const initial = makeInitialState();
    initial.started = true;
    initial.versions = [
      {
        id: 1,
        at: time(),
        by: "creator",
        body: structuredClone(demoBody),
        findings: [],
        dismissals: [],
        note: "Original sample draft",
      },
    ];
    setState(initial);
    setToast("Demo ready. Review the draft to see its source-linked findings.");
  };
  const resetDemo = () => {
    if (
      !window.confirm(
        "Reset this browser-tab demo and remove its revisions, comments and decisions?",
      )
    )
      return;
    sessionStorage.removeItem(STORAGE_KEY);
    setState(makeInitialState());
    setToast("Demo reset.");
  };
  const runReview = () => {
    if (!state.body.text.trim()) {
      setToast("Add some draft text before reviewing.");
      return;
    }
    const findings = reviewDraft(
      state.body,
      state.sources,
      state.terms,
      state.evidence,
    );
    setState((previous) => ({
      ...previous,
      findings,
      reviewedFingerprint: FINGERPRINT(previous.body),
      dismissals: [],
      status:
        previous.status === "approved" &&
        previous.reviewedFingerprint === FINGERPRINT(previous.body)
          ? "approved"
          : "draft",
      reviewRuns: previous.reviewRuns + 1,
      reviewEvents: [
        ...previous.reviewEvents,
        ...findings.map((finding) => ({
          at: time(),
          category: finding.category,
          sourceId: finding.sourceId,
        })),
      ],
    }));
    setToast(
      findings.length
        ? `${findings.length} finding${findings.length === 1 ? "" : "s"} to review.`
        : "No issues found by the current checks. Human review is still needed.",
    );
  };
  const applySuggestion = (finding: Finding) => {
    if (!finding.replacement) return;
    const from = finding.replacement.from;
    updateBody({ text: state.body.text.replace(from, finding.replacement.to) });
    setToast("Suggestion applied. Run review again before submitting.");
  };
  const dismissFinding = (finding: Finding) => {
    const reason = (dismissInputs[finding.id] ?? "").trim();
    if (reason.length < 8) {
      setToast("Enter a reason of at least 8 characters for the reviewer.");
      return;
    }
    patch({
      dismissals: [
        ...state.dismissals.filter((item) => item.findingId !== finding.id),
        { findingId: finding.id, reason },
      ],
    });
    setToast("Dismissal recorded. The reviewer will see your reason.");
  };
  const submitRevision = () => {
    if (state.persona !== "creator") return;
    if (!currentReview) {
      setToast("Run review on the current draft before submitting.");
      return;
    }
    const id = (latest?.id ?? 0) + 1;
    const version = {
      id,
      at: time(),
      by: "creator" as Persona,
      body: structuredClone(state.body),
      findings: structuredClone(state.findings),
      dismissals: structuredClone(state.dismissals),
      note:
        state.status === "changes_requested"
          ? "Revised after reviewer feedback"
          : "Submitted for approval",
    };
    setState((previous) => ({
      ...previous,
      status: "awaiting",
      versions: [...previous.versions, version],
    }));
    setToast(`Version ${id} submitted. Switch to Demo reviewer to decide.`);
  };
  const addComment = () => {
    const value = commentInput.trim();
    if (!value || !latest) return;
    patch({
      comments: [
        ...state.comments,
        {
          id: uid(),
          at: time(),
          by: state.persona,
          text: value,
          versionId: latest.id,
        },
      ],
    });
    setCommentInput("");
    setToast("Comment added to the latest version.");
  };
  const decide = (action: "approved" | "changes_requested") => {
    if (state.persona !== "reviewer" || state.status !== "awaiting" || !latest)
      return;
    const reason = decisionReason.trim();
    if (action === "changes_requested" && reason.length < 8) {
      setToast("Explain the change request in at least 8 characters.");
      return;
    }
    const decision = {
      id: uid(),
      at: time(),
      by: "reviewer" as const,
      action,
      reason: reason || "Reviewed and approved by demo reviewer.",
      versionId: latest.id,
    };
    patch({ status: action, decisions: [...state.decisions, decision] });
    setDecisionReason("");
    setToast(
      action === "approved"
        ? "Version approved by the demo reviewer."
        : "Changes requested. Return to the creator view to revise.",
    );
  };
  const addTerm = () => {
    const retired = newRetired.trim(),
      preferred = newPreferred.trim();
    if (retired.length < 2 || preferred.length < 2) {
      setToast("Enter both a retired and approved term.");
      return;
    }
    if (
      state.terms.some(
        (term) => term.retired.toLowerCase() === retired.toLowerCase(),
      )
    ) {
      setToast("That retired term is already defined.");
      return;
    }
    const number =
      Math.max(
        1,
        ...state.sources
          .filter((source) => source.id.startsWith("TERM-"))
          .map((source) => Number(source.id.split("-")[1]) || 0),
      ) + 1;
    const id = `TERM-${String(number).padStart(3, "0")}`;
    setState((previous) => ({
      ...previous,
      sources: [
        ...previous.sources,
        {
          id,
          title: "Custom terminology",
          body: `Use “${preferred}” instead of “${retired}”. Added in this demo session.`,
          version: "1.0",
          updated: new Date().toISOString().slice(0, 10),
          kind: "Terminology",
          status: "Approved",
        },
      ],
      terms: [
        ...previous.terms,
        { id: uid(), retired, preferred, sourceId: id },
      ],
      reviewedFingerprint: null,
    }));
    setNewRetired("");
    setNewPreferred("");
    setToast(`${id} added. Run review again to use the new source.`);
  };
  const addEvidence = () => {
    if (state.persona !== "reviewer") return;
    const claim = claimPhrase.trim(),
      reference = claimReference.trim();
    if (claim.length < 4 || reference.length < 8 || !claimExpiry) {
      setToast("Enter a claim phrase, reference and expiry date.");
      return;
    }
    if (claimExpiry < new Date().toISOString().slice(0, 10)) {
      setToast("Evidence expiry must be today or later.");
      return;
    }
    const number = state.evidence.length + 1;
    const id = `EVID-${String(number).padStart(3, "0")}`;
    setState((previous) => ({
      ...previous,
      sources: [
        ...previous.sources,
        {
          id,
          title: "Demo claim evidence",
          body: `Claim phrase: “${claim}”. Reference entered by demo reviewer: ${reference}. Expires ${claimExpiry}. This reference is not independently verified by BrandCheck.`,
          version: "1.0",
          updated: new Date().toISOString().slice(0, 10),
          kind: "Evidence",
          status: "Approved",
        },
      ],
      evidence: [
        ...previous.evidence,
        { id: uid(), claim, reference, expiresAt: claimExpiry, sourceId: id },
      ],
      reviewedFingerprint: null,
    }));
    setClaimPhrase("");
    setClaimReference("");
    setClaimExpiry("");
    setToast(
      "Demo evidence recorded. A fresh review will check exact phrase and expiry.",
    );
  };
  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setToast("Choose a PNG, JPEG or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE) {
      setToast("For this browser-only demo, images must be under 750 KB.");
      event.target.value = "";
      return;
    }
    try {
      const bytes = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      updateBody({
        image: {
          name: file.name,
          mime: file.type,
          bytes: file.size,
          sha256,
          dataUrl,
          alt: "",
          decorative: false,
          source: "upload",
        },
      });
      setToast(
        "Image attached. Run review to check alt text and approved asset status.",
      );
    } catch {
      setToast("Could not read this image. Try a different file.");
    }
    event.target.value = "";
  };

  const evidenceBuilder = (
    <section className="card evidence-builder">
      <div>
        <div className="small-label">APPROVED FACTS</div>
        <h2>Record claim evidence</h2>
        <p>
          A demo reviewer can enter a claim phrase and a dated reference. The
          checker treats an exact matching phrase as supported until expiry; it
          does not verify the reference itself.
        </p>
      </div>
      {state.persona === "reviewer" ? (
        <div className="evidence-form">
          <label>
            Claim phrase
            <input
              value={claimPhrase}
              onChange={(event) => setClaimPhrase(event.target.value)}
              placeholder="e.g. 2x productivity"
              maxLength={120}
            />
          </label>
          <label>
            Reference
            <input
              value={claimReference}
              onChange={(event) => setClaimReference(event.target.value)}
              placeholder="e.g. Internal test report 2026-Q4"
              maxLength={160}
            />
          </label>
          <label>
            Expiry
            <input
              type="date"
              value={claimExpiry}
              onChange={(event) => setClaimExpiry(event.target.value)}
            />
          </label>
          <button className="dark-button" onClick={addEvidence}>
            Record demo evidence
          </button>
        </div>
      ) : (
        <div className="reviewer-only">
          Switch to <strong>Reviewer · demo</strong> to record an approved
          evidence reference.
        </div>
      )}
    </section>
  );
  const nav = (screen: Screen, label: string, icon: string) => (
    <button
      className={`nav-item ${state.screen === screen ? "active" : ""}`}
      onClick={() => patch({ screen })}
      aria-current={state.screen === screen ? "page" : undefined}
    >
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </button>
  );

  if (!state.started)
    return (
      <div className="welcome-shell">
        <div className="welcome-glow" />
        <div className="welcome-top">
          <div className="brand-mark">
            B<span>✦</span>
          </div>
          <span>
            BRANDCHECK <i>·</i> ROUND 2 DEMO
          </span>
        </div>
        <main className="welcome-main">
          <div className="eyebrow light">
            A calmer way to publish with confidence
          </div>
          <h1>
            Good content.
            <br />
            <em>Grounded in your brand.</em>
          </h1>
          <p>
            Review a draft against approved terms, claims and accessibility
            guidance. Every finding points to a source; a person makes the final
            call.
          </p>
          <button className="primary large" onClick={startDemo}>
            Try the guided demo <span>→</span>
          </button>
          <div className="welcome-note">
            No account required · Fictional brand · Stored in this browser tab
          </div>
        </main>
        <div className="welcome-preview">
          <div className="preview-top">
            <span>LIVE PREVIEW</span>
            <span className="preview-dot" />
          </div>
          <div className="preview-card">
            <div className="preview-line">
              <span className="mini-icon">Aa</span>
              <div>
                <small>Draft submitted</small>
                <strong>“Flowly guarantees 2x productivity.”</strong>
              </div>
            </div>
            <div className="preview-line">
              <span className="mini-icon amber">!</span>
              <div>
                <small>BrandCheck found</small>
                <strong>
                  Retired name · Evidence needed · Missing alt text
                </strong>
              </div>
            </div>
            <div className="preview-line">
              <span className="mini-icon green">✓</span>
              <div>
                <small>Next step</small>
                <strong>Revise, then ask a human reviewer to approve</strong>
              </div>
            </div>
          </div>
        </div>
        <footer className="welcome-footer">
          Built for careful teams. Demonstration only; no external service or server
          receives content.
        </footer>
      </div>
    );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-lockup">
            <div className="brand-mark">
              B<span>✦</span>
            </div>
            <div>
              <strong>BrandCheck</strong>
              <small>Review workspace</small>
            </div>
          </div>
          <div className="workspace-tag">
            <span className="workspace-avatar">N</span>
            <div>
              <strong>NovaDesk</strong>
              <small>Fictional demo brand</small>
            </div>
            <span className="chevron">⌄</span>
          </div>
          <nav aria-label="Main navigation">
            <div className="nav-caption">WORKSPACE</div>
            {nav("workspace", "Content review", "▤")}
            {nav("sources", "Approved sources", "◈")}
            {nav("activity", "Activity & insights", "◷")}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-help">
            <span className="help-icon">✳</span>
            <strong>How this demo works</strong>
            <p>
              Review the sample, revise it, then switch to Demo reviewer to make
              a decision.
            </p>
          </div>
          <button className="reset-button" onClick={resetDemo}>
            ↻ <span>Reset demo session</span>
          </button>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            NovaDesk <span>/</span>{" "}
            {state.screen === "workspace"
              ? "Content review"
              : state.screen === "sources"
                ? "Approved sources"
                : "Activity & insights"}
          </div>
          <div className="top-actions">
            <span className="local-badge">
              <span /> Local demo
            </span>
            <div className="persona-control">
              <label htmlFor="persona">Viewing as</label>
              <select
                id="persona"
                value={state.persona}
                onChange={(event) =>
                  patch({ persona: event.target.value as Persona })
                }
              >
                <option value="creator">Creator · demo</option>
                <option value="reviewer">Reviewer · demo</option>
              </select>
            </div>
          </div>
        </header>
        {state.screen === "workspace" && (
          <main className="page workspace-page">
            <div className="page-heading">
              <div>
                <div className="eyebrow">CONTENT GOVERNANCE / 01</div>
                <h1>Content review</h1>
                <p>
                  Check the draft, resolve findings, and send a version to a
                  human reviewer.
                </p>
              </div>
              <div className={`status-pill ${state.status}`}>
                ●{" "}
                {state.status === "draft"
                  ? "Working draft"
                  : state.status === "awaiting"
                    ? "Awaiting approval"
                    : state.status === "changes_requested"
                      ? "Changes requested"
                      : "Approved"}
              </div>
            </div>
            <div className="workflow-strip">
              <div className="step done">
                <b>1</b>
                <span>Prepare draft</span>
              </div>
              <span className="step-line" />
              <div
                className={`step ${state.findings.length || currentReview ? "done" : ""}`}
              >
                <b>2</b>
                <span>Check sources</span>
              </div>
              <span className="step-line" />
              <div className={`step ${state.status !== "draft" ? "done" : ""}`}>
                <b>3</b>
                <span>Human decision</span>
              </div>
            </div>
            <div className="workspace-grid">
              <section className="card editor-card">
                <div className="card-heading">
                  <div>
                    <div className="small-label">DRAFT EDITOR</div>
                    <h2>{state.body.title || "Untitled draft"}</h2>
                  </div>
                  <span className="card-meta">Version {latest?.id ?? 1}</span>
                </div>
                <div className="field-grid">
                  <label>
                    Channel
                    <select
                      value={state.body.channel}
                      onChange={(event) =>
                        updateBody({ channel: event.target.value })
                      }
                      disabled={
                        state.persona === "reviewer" ||
                        state.status === "awaiting"
                      }
                    >
                      <option>LinkedIn</option>
                      <option>Website</option>
                      <option>Email</option>
                      <option>Social post</option>
                    </select>
                  </label>
                  <label>
                    Audience
                    <input
                      value={state.body.audience}
                      onChange={(event) =>
                        updateBody({ audience: event.target.value })
                      }
                      disabled={
                        state.persona === "reviewer" ||
                        state.status === "awaiting"
                      }
                    />
                  </label>
                </div>
                <label className="full-field">
                  Draft text
                  <textarea
                    value={state.body.text}
                    onChange={(event) =>
                      updateBody({ text: event.target.value })
                    }
                    disabled={
                      state.persona === "reviewer" ||
                      state.status === "awaiting"
                    }
                    rows={7}
                    maxLength={5000}
                  />
                  <small>{state.body.text.length} / 5,000 characters</small>
                </label>
                <div className="asset-section">
                  <div className="section-heading">
                    <div>
                      <h3>Visual asset</h3>
                      <p>Check usage and accessible description.</p>
                    </div>
                    {state.persona === "creator" &&
                      state.status !== "awaiting" && (
                        <button
                          className="link-button"
                          onClick={() => fileInput.current?.click()}
                        >
                          Upload image
                        </button>
                      )}
                  </div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={uploadImage}
                  />
                  {state.body.image ? (
                    <div className="image-row">
                      <img
                        src={
                          state.body.image.dataUrl ||
                          `${import.meta.env.BASE_URL}novadesk-launch.svg`
                        }
                        alt="Draft visual preview"
                      />
                      <div className="image-details">
                        <strong>{state.body.image.name}</strong>
                        <small>
                          {state.body.image.source === "approved-demo"
                            ? "Approved demo asset"
                            : `Uploaded image · ${(state.body.image.bytes / 1024).toFixed(0)} KB`}
                        </small>
                        <button
                          className="text-danger"
                          onClick={() => updateBody({ image: null })}
                          disabled={
                            state.persona === "reviewer" ||
                            state.status === "awaiting"
                          }
                        >
                          Remove asset
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-image">
                      No image attached. Text-only content is supported.
                    </div>
                  )}
                  {state.body.image && (
                    <>
                      <label className="full-field alt-field">
                        Alternative text
                        <input
                          value={state.body.image.alt}
                          onChange={(event) =>
                            updateImage({ alt: event.target.value })
                          }
                          placeholder="Describe the image's meaning"
                          disabled={
                            state.persona === "reviewer" ||
                            state.status === "awaiting" ||
                            state.body.image.decorative
                          }
                        />
                      </label>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          checked={state.body.image.decorative}
                          onChange={(event) =>
                            updateImage({
                              decorative: event.target.checked,
                              alt: event.target.checked
                                ? ""
                                : (state.body.image?.alt ?? ""),
                            })
                          }
                          disabled={
                            state.persona === "reviewer" ||
                            state.status === "awaiting"
                          }
                        />{" "}
                        This image is purely decorative
                      </label>
                    </>
                  )}
                </div>
                <div className="editor-actions">
                  <button
                    className="primary"
                    onClick={runReview}
                    disabled={
                      state.persona !== "creator" || state.status === "awaiting"
                    }
                  >
                    Run brand review <span>→</span>
                  </button>
                  <small>
                    {currentReview
                      ? "This version has been checked"
                      : "Review required after every edit"}
                  </small>
                </div>
              </section>
              <section className="card findings-card">
                <div className="card-heading">
                  <div>
                    <div className="small-label">SOURCE-LINKED REVIEW</div>
                    <h2>
                      Findings{" "}
                      <span className="count-badge">
                        {state.findings.length}
                      </span>
                    </h2>
                  </div>
                  <span className="card-meta">
                    {currentReview ? "Current draft" : "Check required"}
                  </span>
                </div>
                {!currentReview && (
                  <div className="review-placeholder">
                    <div className="placeholder-symbol">✦</div>
                    <h3>Ready when your draft is</h3>
                    <p>
                      Run brand review to compare this content with the approved
                      NovaDesk sources.
                    </p>
                    <div className="checks-list">
                      <span>✓ Terminology</span>
                      <span>✓ Claims & tone</span>
                      <span>✓ Image accessibility</span>
                    </div>
                  </div>
                )}
                {currentReview && state.findings.length === 0 && (
                  <div className="review-placeholder success">
                    <div className="placeholder-symbol">✓</div>
                    <h3>No issues found by these checks</h3>
                    <p>
                      This is a limited rule-based review. A person should still
                      confirm the content before publication.
                    </p>
                  </div>
                )}
                {currentReview && state.findings.length > 0 && (
                  <div className="findings-list">
                    {state.findings.map((finding) => {
                      const dismissed = state.dismissals.find(
                        (item) => item.findingId === finding.id,
                      );
                      return (
                        <article
                          className={`finding ${dismissed ? "dismissed" : ""}`}
                          key={finding.id}
                        >
                          <div className="finding-top">
                            <span
                              className={`category-dot ${finding.category.toLowerCase().replace(" ", "-")}`}
                            />
                            <strong>{finding.category}</strong>
                            <span
                              className={`severity ${finding.severity === "Suggestion" ? "soft" : ""}`}
                            >
                              {finding.severity}
                            </span>
                          </div>
                          <div className="finding-excerpt">
                            “{finding.excerpt}”
                          </div>
                          <p>{finding.explanation}</p>
                          <div className="evidence-row">
                            <span>{finding.evidenceStatus}</span>
                            <button
                              onClick={() => patch({ screen: "sources" })}
                            >
                              {sourceLabel(finding)} ↗
                            </button>
                          </div>
                          <div className="suggestion">
                            <small>SUGGESTED NEXT STEP</small>
                            <p>{finding.suggestion}</p>
                          </div>
                          {state.persona === "creator" &&
                            state.status !== "awaiting" &&
                            !dismissed && (
                              <div className="finding-actions">
                                {finding.replacement && (
                                  <button
                                    className="subtle-button"
                                    onClick={() => applySuggestion(finding)}
                                  >
                                    Apply term fix
                                  </button>
                                )}
                                <input
                                  aria-label={`Reason to dismiss ${finding.category} finding`}
                                  placeholder="Or enter reason to dismiss"
                                  value={dismissInputs[finding.id] ?? ""}
                                  onChange={(event) =>
                                    setDismissInputs((current) => ({
                                      ...current,
                                      [finding.id]: event.target.value,
                                    }))
                                  }
                                />
                                <button
                                  className="subtle-button"
                                  onClick={() => dismissFinding(finding)}
                                >
                                  Dismiss
                                </button>
                              </div>
                            )}
                          {dismissed && (
                            <div className="dismissed-note">
                              <strong>Creator dismissed:</strong>{" "}
                              {dismissed.reason}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
            <section className="decision-card">
              <div>
                <div className="small-label">HUMAN CONTROL</div>
                <h2>
                  {state.status === "approved"
                    ? "Approved for this version"
                    : state.status === "awaiting"
                      ? "Waiting for a reviewer"
                      : "Ready for a decision?"}
                </h2>
                <p>
                  {state.status === "approved"
                    ? "Any new edit needs a fresh review and a new approval."
                    : "Suggestions never replace the creator’s words automatically. The reviewer sees the exact submitted version and any dismissed findings."}
                </p>
              </div>
              <div className="decision-actions">
                {state.persona === "creator" && (
                  <button
                    className="dark-button"
                    onClick={submitRevision}
                    disabled={!currentReview || state.status === "awaiting"}
                  >
                    Submit version for approval →
                  </button>
                )}
                {state.persona === "reviewer" && (
                  <>
                    <textarea
                      value={decisionReason}
                      onChange={(event) =>
                        setDecisionReason(event.target.value)
                      }
                      placeholder="Decision note or reason for changes"
                      rows={2}
                      disabled={state.status !== "awaiting"}
                    />
                    <div className="reviewer-buttons">
                      <button
                        className="outline-button"
                        onClick={() => decide("changes_requested")}
                        disabled={state.status !== "awaiting"}
                      >
                        Request changes
                      </button>
                      <button
                        className="dark-button"
                        onClick={() => decide("approved")}
                        disabled={state.status !== "awaiting"}
                      >
                        Approve version ✓
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>
            {state.persona === "reviewer" && latest && (
              <section className="card reviewer-context">
                <div className="card-heading">
                  <div>
                    <div className="small-label">REVIEWER CONTEXT</div>
                    <h2>What changed in version {latest.id}</h2>
                  </div>
                  <span className="card-meta">{dateLabel(latest.at)}</span>
                </div>
                <div className="compare-grid">
                  <div>
                    <small>ORIGINAL DRAFT · V1</small>
                    <p>{state.versions[0]?.body.text}</p>
                  </div>
                  <div>
                    <small>LATEST SUBMITTED · V{latest.id}</small>
                    <p>{latest.body.text}</p>
                  </div>
                </div>
                <div className="reviewer-summary">
                  {latest.findings.length} findings at submission ·{" "}
                  {latest.dismissals.length} dismissed with reason
                  {latest.dismissals.length === 1 ? "" : "s"}
                  {latest.dismissals.length > 0 && (
                    <ul>
                      {latest.dismissals.map((item) => (
                        <li key={item.findingId}>
                          <strong>{item.findingId}</strong>: {item.reason}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )}
            <section className="card comment-card">
              <div className="card-heading">
                <div>
                  <div className="small-label">DISCUSSION</div>
                  <h2>
                    Comments{" "}
                    <span className="count-badge">{state.comments.length}</span>
                  </h2>
                </div>
              </div>
              {state.comments.length ? (
                <div className="comment-list">
                  {state.comments.map((comment) => (
                    <div className="comment" key={comment.id}>
                      <span className="comment-avatar">
                        {comment.by === "creator" ? "C" : "R"}
                      </span>
                      <div>
                        <strong>
                          {comment.by === "creator"
                            ? "Demo creator"
                            : "Demo reviewer"}{" "}
                          <small>
                            · v{comment.versionId} · {dateLabel(comment.at)}
                          </small>
                        </strong>
                        <p>{comment.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-comments">
                  No comments yet. Add context for the other person reviewing
                  this draft.
                </p>
              )}
              <div className="comment-compose">
                <input
                  value={commentInput}
                  onChange={(event) => setCommentInput(event.target.value)}
                  placeholder="Leave a comment on the latest version"
                  maxLength={500}
                />
                <button className="subtle-button" onClick={addComment}>
                  Post comment
                </button>
              </div>
            </section>
          </main>
        )}
        {state.screen === "sources" && (
          <main className="page">
            <div className="page-heading">
              <div>
                <div className="eyebrow">BRAND GOVERNANCE / 02</div>
                <h1>Approved sources</h1>
                <p>
                  Each finding cites an active rule from this versioned
                  fictional brand pack.
                </p>
              </div>
              <span className="pack-version">NOVA DESK PACK · V1.0</span>
            </div>
            <div className="info-banner">
              <span>ⓘ</span>
              <p>
                These are synthetic sample policies for a product demonstration.
                Do not use real confidential brand documents in this public
                browser demo.
              </p>
            </div>
            <div className="sources-grid">
              {state.sources.map((source) => (
                <article className="card source-card" key={source.id}>
                  <div className="source-top">
                    <span className="source-id">{source.id}</span>
                    <span
                      className={`source-status ${source.status.toLowerCase()}`}
                    >
                      {source.status}
                    </span>
                  </div>
                  <h2>{source.title}</h2>
                  <p>{source.body}</p>
                  <div className="source-footer">
                    <span>{source.kind}</span>
                    <span>
                      v{source.version} · {source.updated}
                    </span>
                  </div>
                </article>
              ))}
            </div>
            <section className="card term-builder">
              <div>
                <div className="small-label">DEFINE A RULE</div>
                <h2>Add an approved terminology pair</h2>
                <p>
                  Create a source-backed term rule in this browser tab. New
                  reviews use it immediately; existing findings stay tied to the
                  source version that produced them.
                </p>
              </div>
              <div className="term-form">
                <label>
                  Retired term
                  <input
                    value={newRetired}
                    onChange={(event) => setNewRetired(event.target.value)}
                    placeholder="Old product name"
                    maxLength={60}
                  />
                </label>
                <label>
                  Approved term
                  <input
                    value={newPreferred}
                    onChange={(event) => setNewPreferred(event.target.value)}
                    placeholder="Current product name"
                    maxLength={60}
                  />
                </label>
                <button className="dark-button" onClick={addTerm}>
                  Add terminology rule
                </button>
              </div>
            </section>
            {evidenceBuilder}
          </main>
        )}
        {state.screen === "activity" && (
          <main className="page">
            <div className="page-heading">
              <div>
                <div className="eyebrow">GOVERNANCE SIGNALS / 03</div>
                <h1>Activity & insights</h1>
                <p>
                  See how decisions were reached and which rules surface most
                  often.
                </p>
              </div>
              <span className="pack-version">THIS BROWSER SESSION</span>
            </div>
            <div className="metric-grid">
              <div className="metric-card">
                <small>REVIEWS RUN</small>
                <strong>{state.reviewRuns}</strong>
                <span>Sample review activity</span>
              </div>
              <div className="metric-card">
                <small>ISSUES FLAGGED</small>
                <strong>{state.reviewEvents.length}</strong>
                <span>Across all checks</span>
              </div>
              <div className="metric-card">
                <small>DISMISSED</small>
                <strong>
                  {state.versions.reduce(
                    (count, version) => count + version.dismissals.length,
                    0,
                  )}
                </strong>
                <span>With creator reason</span>
              </div>
              <div className="metric-card">
                <small>DECISIONS</small>
                <strong>{state.decisions.length}</strong>
                <span>By demo reviewer</span>
              </div>
            </div>
            <div className="insights-grid">
              <section className="card insight-card">
                <div className="card-heading">
                  <div>
                    <div className="small-label">RECURRING ISSUES</div>
                    <h2>By category</h2>
                  </div>
                </div>
                {state.reviewEvents.length ? (
                  <div className="bars">
                    {(
                      [
                        "Terminology",
                        "Claims",
                        "Tone",
                        "Accessibility",
                        "Asset usage",
                      ] as const
                    ).map((category) => {
                      const count = state.reviewEvents.filter(
                        (event) => event.category === category,
                      ).length;
                      return (
                        <div className="bar-row" key={category}>
                          <span>{category}</span>
                          <div className="bar-track">
                            <div
                              style={{
                                width: `${(count / Math.max(1, state.reviewEvents.length)) * 100}%`,
                              }}
                            />
                          </div>
                          <strong>{count}</strong>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">
                    Run a review to see issue patterns here.
                  </p>
                )}
                <p className="insight-note">
                  Counts reflect demo reviews, not unique published pieces. No
                  draft text is used in this chart.
                </p>
              </section>
              <section className="card insight-card">
                <div className="card-heading">
                  <div>
                    <div className="small-label">REVISION HISTORY</div>
                    <h2>Versions & decisions</h2>
                  </div>
                </div>
                <div className="timeline">
                  {[...state.versions].reverse().map((version) => (
                    <div className="timeline-item" key={version.id}>
                      <span className="timeline-dot" />
                      <div>
                        <strong>
                          Version {version.id} · {version.note}
                        </strong>
                        <small>
                          {dateLabel(version.at)} · Demo {version.by}
                        </small>
                        <p>{version.body.text}</p>
                        <span>
                          {version.findings.length} findings ·{" "}
                          {version.dismissals.length} dismissals
                        </span>
                      </div>
                    </div>
                  ))}
                  {[...state.decisions].reverse().map((decision) => (
                    <div className="timeline-item decision" key={decision.id}>
                      <span className="timeline-dot" />
                      <div>
                        <strong>
                          {decision.action === "approved"
                            ? "Approved"
                            : "Changes requested"}{" "}
                          · Version {decision.versionId}
                        </strong>
                        <small>{dateLabel(decision.at)} · Demo reviewer</small>
                        <p>{decision.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
            <div className="privacy-note">
              <strong>Demo privacy:</strong> Content and image previews stay in
              this browser tab’s session storage. No external service, analytics
              service or server is called. Closing the tab clears this demo
              state. This is not a secure shared workspace.
            </div>
          </main>
        )}
        <footer className="app-footer">
          BrandCheck demo · Rule-based and heuristic checks · Human approval
          required · Built by team mayankkumar.prof
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
