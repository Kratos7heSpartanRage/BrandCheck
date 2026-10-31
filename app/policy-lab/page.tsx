"use client";
import { useState } from "react";
import PolicyPanel from "../../components/PolicyPanel";
import type { Proposal } from "../../components/PolicyPanel";
import { defaultPolicy, policySchema, policyDiff, checkPolicy, findingSignature } from "../../lib/policy";
import type { Finding } from "../../components/brandcheck/model";

interface ImpactResult {
  title: string;
  affected: boolean;
  beforeCount: number;
  afterCount: number;
  newFindings: Finding[];
  resolvedFindings: Finding[];
}

export default function PolicyLab() {
  const [current, setCurrent] = useState({ version: 0, pack: structuredClone(defaultPolicy) });
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState([
    { id: "launch", title: "Approved launch announcement", body: "NovaDesk is designed to simplify daily work for modern organizations.", state: "approved" },
    { id: "newsletter", title: "Customer newsletter", body: "Our support team can help you get started with your rollout.", state: "draft" },
    { id: "growth-campaign", title: "Q4 enterprise pitch", body: "Flowly guarantees 2x productivity for every team and eliminates repetitive manual coordination.", state: "draft" },
    { id: "case-study", title: "Customer case study", body: "Using NovaDesk, the organization streamlined collaboration across 40 distributed teams.", state: "approved" },
  ]);
  const [impact, setImpact] = useState<ImpactResult[]>([]);
  const [showAddDraft, setShowAddDraft] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newState, setNewState] = useState<"draft" | "approved">("draft");

  function addCustomDraft() {
    if (!newTitle.trim() || !newBody.trim()) return;
    setDrafts([...drafts, { id: crypto.randomUUID(), title: newTitle.trim(), body: newBody.trim(), state: newState }]);
    setNewTitle("");
    setNewBody("");
    setShowAddDraft(false);
    setMessage(`Added "${newTitle.trim()}" to sample content inventory.`);
  }

  async function run(action: Record<string, unknown>) {
    try {
      if (action.action === "syncPolicy") {
        setMessage("The live GitHub connector is available in authenticated Shared workspaces. This public sandbox uses pasted policy JSON.");
        return;
      }
      if (action.action === "proposePolicy") {
        const pack = policySchema.parse(action.policy);
        setProposals([{
          id: crypto.randomUUID(),
          base_version: current.version,
          payload: JSON.stringify(pack),
          state: "pending",
          origin: "Public local sandbox",
          created_at: new Date().toISOString(),
          diff: policyDiff(current.pack, pack)
        }, ...proposals]);
        setMessage("Proposal created. Active policy is unchanged until you activate it.");
      } else if (action.action === "decidePolicy") {
        const proposal = proposals.find(p => p.id === action.proposalId && p.state === "pending");
        if (!proposal) return;
        if (action.accept && proposal.base_version !== current.version) {
          setMessage("This proposal is stale. Create a new proposal against the active policy.");
          return;
        }
        if (action.accept) {
          const pack = policySchema.parse(JSON.parse(proposal.payload));
          const checks: ImpactResult[] = drafts.map(d => {
            const before = checkPolicy(current.pack, d.title, d.body);
            const after = checkPolicy(pack, d.title, d.body);
            const affected = findingSignature(before) !== findingSignature(after);
            const beforeKeys = new Set(before.map(f => `${f.category}:${f.excerpt}:${f.sourceId}`));
            const afterKeys = new Set(after.map(f => `${f.category}:${f.excerpt}:${f.sourceId}`));
            const newFindings = after.filter(f => !beforeKeys.has(`${f.category}:${f.excerpt}:${f.sourceId}`));
            const resolvedFindings = before.filter(f => !afterKeys.has(`${f.category}:${f.excerpt}:${f.sourceId}`));
            return {
              title: d.title,
              affected,
              beforeCount: before.length,
              afterCount: after.length,
              newFindings,
              resolvedFindings,
            };
          });
          setImpact(checks);
          setDrafts(drafts.map((d, i) => ({
            ...d,
            state: checks[i].affected && d.state === "approved" ? "needs_review" : d.state
          })));
          setCurrent({ version: current.version + 1, pack });
          const affectedCount = checks.filter(c => c.affected).length;
          setMessage(`Policy v${current.version + 1} activated. Evaluated against ${drafts.length} drafts: ${affectedCount} affected and flagged for review.`);
        } else {
          setMessage("Proposal rejected. Active guidelines are unchanged.");
        }
        setProposals(proposals.map(p => p.id === proposal.id ? { ...p, state: action.accept ? "accepted" : "rejected" } : p));
      }
    } catch {
      setMessage("The policy JSON is invalid. Check source IDs, active references and field limits.");
    }
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
          <span className="text-[var(--text-muted)] font-medium">Policy regression sandbox</span>
        </div>
        <div className="flex items-center gap-4 text-[var(--text-muted)]">
          <a href="/workspace" className="hover:text-[var(--text-main)] underline">Shared workspaces</a>
          <a href="/documents" className="hover:text-[var(--text-main)] underline">Document tools</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider text-[var(--text-subtle)] font-medium mb-1">Local Sandbox</p>
          <h1 className="text-3xl font-serif font-normal text-[var(--text-main)] tracking-tight">
            Policy regression sandbox
          </h1>
          <div className="p-3.5 rounded-[var(--radius-sm)] border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] text-xs text-[var(--status-warn-text)] my-3 leading-relaxed">
            Public device-local demonstration. Policy changes here are evaluated in memory and do not modify shared workspace databases.
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Workflow: Prepare sample product rename &rarr; create proposal &rarr; supply decision rationale &rarr; activate and observe automatic regression rechecking across stored content.
          </p>
        </div>

        {message && <div role="status" className="product-notice">{message}</div>}

        <section className="p-5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-serif text-[var(--text-main)] m-0">Sample content inventory ({drafts.length})</h2>
              <span className="text-xs text-[var(--text-muted)]">Drafts rechecked automatically upon brand policy activation.</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddDraft(!showAddDraft)}
              className="h-7 px-3 text-xs font-medium rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface-raised)] text-[var(--text-main)] hover:bg-[var(--bg-surface-sunken)] transition-colors"
            >
              {showAddDraft ? "Cancel" : "+ Add test draft"}
            </button>
          </div>

          {showAddDraft && (
            <div className="p-4 rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--bg-surface-raised)] space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-subtle)] m-0">New Test Draft</h3>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Draft Title (e.g. Q4 Billboard Copy)"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-main)]"
                />
                <textarea
                  rows={3}
                  placeholder="Draft content under test..."
                  value={newBody}
                  onChange={e => setNewBody(e.target.value)}
                  className="w-full p-2.5 text-xs border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-main)]"
                />
                <div className="flex items-center justify-between pt-1">
                  <label className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                    Initial state:
                    <select
                      value={newState}
                      onChange={e => setNewState(e.target.value as "draft" | "approved")}
                      className="text-xs h-7 px-2 border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)]"
                    >
                      <option value="approved">Approved</option>
                      <option value="draft">Draft</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={addCustomDraft}
                    disabled={!newTitle.trim() || !newBody.trim()}
                    className="h-7 px-4 text-xs font-medium rounded-[var(--radius-sm)] bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] disabled:opacity-50"
                  >
                    Add to Inventory
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {drafts.map(d => (
              <article key={d.id} className="p-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-sunken)] text-xs space-y-1">
                <strong className="block text-sm text-[var(--text-main)]">{d.title}</strong>
                <p className="text-[var(--text-muted)] leading-relaxed">{d.body}</p>
                <div className="pt-1">
                  <span className={`editorial-badge status-${d.state}`}>{d.state.replaceAll("_", " ")}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <PolicyPanel key={current.version} current={current} proposals={proposals} admin busy={false} run={run} sandbox />

        {impact.length > 0 && (
          <section className="p-5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[var(--border-subtle)]">
              <div>
                <h2 className="text-base font-serif text-[var(--text-main)] m-0">Regression recheck results (Policy v{current.version})</h2>
                <span className="text-xs text-[var(--text-muted)]">Automatic impact verification across stored content inventory.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="editorial-badge status-needs_review">
                  {impact.filter(r => r.affected).length} of {impact.length} drafts affected
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {impact.map(row => (
                <div key={row.title} className="p-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] text-xs space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm font-medium text-[var(--text-main)]">{row.title}</strong>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-[var(--text-muted)]">
                        {row.beforeCount} &rarr; {row.afterCount} findings
                      </span>
                      <span className={`editorial-badge ${row.affected ? "status-needs_review" : "status-draft"}`}>
                        {row.affected ? "Affected — review needed" : "Unchanged"}
                      </span>
                    </div>
                  </div>

                  {row.newFindings.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-[var(--border-subtle)]">
                      <span className="text-[11px] font-semibold text-rose-700 block">Newly triggered rule findings:</span>
                      {row.newFindings.map((f, i) => (
                        <div key={i} className="text-[11px] text-[var(--text-main)] pl-2 border-l-2 border-rose-400 bg-rose-50/50 py-0.5">
                          <strong>[{f.sourceId}]</strong> &ldquo;{f.excerpt}&rdquo; &mdash; {f.explanation}
                        </div>
                      ))}
                    </div>
                  )}

                  {row.resolvedFindings.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-[var(--border-subtle)]">
                      <span className="text-[11px] font-semibold text-emerald-700 block">Resolved rule findings:</span>
                      {row.resolvedFindings.map((f, i) => (
                        <div key={i} className="text-[11px] text-[var(--text-muted)] pl-2 border-l-2 border-emerald-400 bg-emerald-50/50 py-0.5">
                          <strong>[{f.sourceId}]</strong> &ldquo;{f.excerpt}&rdquo; (No longer flagged under active policy)
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
