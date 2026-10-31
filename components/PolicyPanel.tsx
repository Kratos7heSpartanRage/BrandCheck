"use client";
import { useState } from "react";
import type { Policy } from "../lib/policy";
import BrandGuidelineForm from "./BrandGuidelineForm";

export type Proposal = {
  id: string;
  base_version: number;
  payload: string;
  state: string;
  origin: string;
  created_at: string;
  diff: unknown;
  comparison?: string;
};

export default function PolicyPanel({
  current,
  proposals,
  admin,
  busy,
  run,
  sandbox = false,
}: {
  current: { version: number; pack: Policy };
  proposals: Proposal[];
  admin: boolean;
  busy: boolean;
  run: (action: Record<string, unknown>) => Promise<void>;
  sandbox?: boolean;
}) {
  const [json, setJson] = useState(JSON.stringify(current.pack, null, 2));
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function renameExample() {
    const pack = structuredClone(current.pack);
    pack.name = "NovaDesk One naming update";
    pack.sources = pack.sources.map((source) =>
      source.id === "TERM-001"
        ? {
            ...source,
            version: `policy-${current.version + 1}`,
            body: "NovaDesk One is the approved name. NovaDesk and Flowly are retired.",
          }
        : source.id === "MSG-001"
          ? {
              ...source,
              version: `policy-${current.version + 1}`,
              body: "NovaDesk One is designed to simplify daily work. This is approved positioning, not a quantified performance promise.",
            }
          : source,
    );
    pack.terms = [
      ...pack.terms
        .filter((t) => t.retired !== "NovaDesk")
        .map((t) => ({ ...t, preferred: "NovaDesk One" })),
      {
        id: "term-novadesk",
        retired: "NovaDesk",
        preferred: "NovaDesk One",
        sourceId: "TERM-001",
      },
    ];
    setJson(JSON.stringify(pack, null, 2));
  }

  return (
    <div className="space-y-6">
      {/* Active Pack Status Card */}
      <section className="p-6 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
              Authoritative Guidelines
            </div>
            <h2 className="text-xl font-serif text-[var(--text-main)] mt-0.5">
              {current.pack.name}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="editorial-badge status-approved">
              Policy v{current.version} Active
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              {current.pack.sources.length} sources · {current.pack.terms.length} terms
            </span>
          </div>
        </div>

        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Active guidelines govern all content reviews in this workspace. Modifications follow an accountable proposal lifecycle requiring administrator confirmation.
        </p>

        <details className="text-xs group">
          <summary className="cursor-pointer font-medium text-[var(--text-main)] hover:text-[var(--accent-primary)] transition-colors py-1 flex items-center gap-2">
            <span>Inspect current sources, terms and policies JSON</span>
            <span className="text-[10px] text-[var(--text-subtle)] group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <pre className="mt-2 p-3 rounded-[var(--radius-sm)] bg-[var(--bg-surface-sunken)] border border-[var(--border-subtle)] font-mono text-[11px] text-[var(--text-muted)] max-h-64 overflow-auto">
            {JSON.stringify(current.pack, null, 2)}
          </pre>
        </details>
      </section>

      {/* Admin Proposal Creator */}
      {admin && (
        <section className="p-6 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-5">
          <div>
            <h3 className="text-base font-serif text-[var(--text-main)]">
              Propose Guideline Update
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Draft changes below. Creating a proposal stages the revision for impact analysis and approval; active rules remain unchanged until explicitly activated.
            </p>
          </div>

          {!sandbox && (
            <div className="border-b border-[var(--border-subtle)] pb-5">
              <BrandGuidelineForm
                pack={current.pack}
                busy={busy}
                propose={(policy) => {
                  run({ action: "proposePolicy", policy });
                }}
              />
            </div>
          )}

          <div className="space-y-4 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[var(--text-main)]">
                {sandbox ? "Try a policy change" : "Direct JSON import & sample presets"}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={renameExample}
                className="h-7 px-3 text-xs font-medium rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface-raised)] text-[var(--text-main)] hover:bg-[var(--bg-surface-sunken)] transition-colors"
              >
                ✦ Load sample product rename preset
              </button>
            </div>

            <label className="text-xs text-[var(--text-muted)] block space-y-1.5">
              <span className="font-medium">Proposed policy JSON</span>
              <textarea
                rows={10}
                value={json}
                onChange={(e) => setJson(e.target.value)}
                className="w-full p-2.5 font-mono text-xs border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-main)]"
              />
            </label>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  try {
                    const policy = JSON.parse(json);
                    setError("");
                    run({ action: "proposePolicy", policy });
                  } catch {
                    setError("Enter valid JSON before creating a proposal.");
                  }
                }}
                className="h-8 px-4 text-xs font-medium rounded-[var(--radius-sm)] bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors"
              >
                Create policy proposal
              </button>
            </div>

            {error && (
              <p role="alert" className="text-xs text-[#b91c1c] font-medium">
                {error}
              </p>
            )}

            {!sandbox && (
              <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2">
                <label className="text-xs text-[var(--text-muted)] block space-y-1.5">
                  <span className="font-medium">Public GitHub Raw Policy URL (Optional Sync)</span>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://raw.githubusercontent.com/owner/repo/main/brand-policy.json"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="flex-1 p-2 text-xs border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-main)]"
                    />
                    <button
                      type="button"
                      disabled={busy || !url}
                      onClick={() => run({ action: "syncPolicy", url })}
                      className="h-8 px-3 text-xs font-medium rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface-raised)] text-[var(--text-main)] hover:bg-[var(--bg-surface-sunken)] transition-colors whitespace-nowrap"
                    >
                      Fetch from GitHub
                    </button>
                  </div>
                </label>
                <small className="text-[11px] text-[var(--text-subtle)] block">
                  Read-only, on-demand connector. Validates schema and stages an incoming proposal without overwriting active guidelines.
                </small>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)]">
            <label className="text-xs text-[var(--text-muted)] block space-y-1.5">
              <span className="font-medium">Administrator Decision Note</span>
              <textarea
                maxLength={2000}
                rows={2}
                placeholder="Explain the rationale for activating or rejecting this proposal..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-2 text-xs border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-main)]"
              />
            </label>
          </div>
        </section>
      )}

      {/* Proposals Queue */}
      <section className="p-6 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
          <h3 className="text-base font-serif text-[var(--text-main)]">
            Policy Proposals & Impact History
          </h3>
          <span className="text-xs text-[var(--text-subtle)] font-medium">
            {proposals.length} proposal{proposals.length === 1 ? "" : "s"}
          </span>
        </div>

        {proposals.length ? (
          <div className="space-y-4">
            {proposals.map((p) => (
              <article
                key={p.id}
                className="p-4 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`editorial-badge ${
                        p.state === "accepted"
                          ? "status-approved"
                          : p.state === "pending"
                            ? "status-warn"
                            : "status-danger"
                      }`}
                    >
                      {p.state.toUpperCase()}
                    </span>
                    <span className="text-xs font-mono text-[var(--text-muted)]">
                      Based on Policy v{p.base_version}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--text-subtle)] font-mono">
                    {new Date(p.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="text-xs text-[var(--text-muted)]">
                  Origin: <strong className="text-[var(--text-main)]">{p.origin}</strong>
                </div>

                {p.comparison && (
                  <div className="text-xs text-[var(--text-main)] bg-[var(--bg-surface)] p-2.5 rounded border border-[var(--border-subtle)] font-mono">
                    {p.comparison}
                  </div>
                )}

                {p.diff && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-[var(--accent-primary)] font-medium py-0.5">
                      View policy diff
                    </summary>
                    <pre className="mt-1.5 p-2.5 rounded bg-[var(--bg-surface-sunken)] font-mono text-[11px] text-[var(--text-muted)] max-h-48 overflow-auto border border-[var(--border-subtle)]">
                      {JSON.stringify(p.diff, null, 2)}
                    </pre>
                  </details>
                )}

                <details className="text-xs">
                  <summary className="cursor-pointer text-[var(--text-subtle)] font-medium py-0.5">
                    Inspect complete payload
                  </summary>
                  <pre className="mt-1.5 p-2.5 rounded bg-[var(--bg-surface-sunken)] font-mono text-[11px] text-[var(--text-muted)] max-h-48 overflow-auto border border-[var(--border-subtle)]">
                    {JSON.stringify(JSON.parse(p.payload), null, 2)}
                  </pre>
                </details>

                {admin && p.state === "pending" && (
                  <div className="pt-2 flex flex-wrap items-center gap-2.5 border-t border-[var(--border-subtle)]">
                    <button
                      type="button"
                      disabled={busy || !note.trim()}
                      onClick={() =>
                        run({
                          action: "decidePolicy",
                          proposalId: p.id,
                          accept: true,
                          note,
                        })
                      }
                      className="h-8 px-3.5 text-xs font-medium rounded-[var(--radius-sm)] bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors disabled:opacity-50"
                    >
                      Activate & Recheck Stored Content
                    </button>
                    <button
                      type="button"
                      disabled={busy || !note.trim()}
                      onClick={() =>
                        run({
                          action: "decidePolicy",
                          proposalId: p.id,
                          accept: false,
                          note,
                        })
                      }
                      className="h-8 px-3.5 text-xs font-medium rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[#b91c1c] hover:bg-[#fde8e4] transition-colors disabled:opacity-50"
                    >
                      Reject Proposal
                    </button>
                    {!note.trim() && (
                      <span className="text-[11px] text-[var(--text-subtle)] italic">
                        (Enter an administrator decision note above to activate or reject)
                      </span>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--text-muted)] italic">
            No policy proposals recorded yet.
          </p>
        )}

        <p className="text-[11px] text-[var(--text-subtle)] pt-2 border-t border-[var(--border-subtle)]">
          {sandbox
            ? "This local sandbox rechecks sample drafts in memory. Authenticated workspaces provide persistent Cloudflare D1 storage, multi-tenant RBAC, and live regression rechecks."
            : "Activating a proposal writes an immutable audit ledger entry, updates the active brand pack version, and automatically triggers regression scans across all stored workspace content."}
        </p>
      </section>
    </div>
  );
}
