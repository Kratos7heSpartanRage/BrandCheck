"use client";
import { useState } from "react";
import PolicyPanel from "../../components/PolicyPanel";
import type { Proposal } from "../../components/PolicyPanel";
import { defaultPolicy, policySchema, policyDiff, checkPolicy, findingSignature } from "../../lib/policy";

export default function PolicyLab() {
  const [current, setCurrent] = useState({ version: 0, pack: structuredClone(defaultPolicy) });
  const [proposals, setProposals] = useState<Proposal[]>([]); const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState([{ id: "launch", title: "Approved announcement", body: "NovaDesk is designed to simplify daily work.", state: "approved" }, { id: "newsletter", title: "Newsletter", body: "Our support team can help you get started.", state: "draft" }]);
  const [impact, setImpact] = useState<{ title: string; affected: boolean; before: number; after: number }[]>([]);
  async function run(action: Record<string, unknown>) {
    try {
      if (action.action === "syncPolicy") { setMessage("The live GitHub connector is available in authenticated Shared workspaces. This public sandbox uses pasted policy JSON."); return; }
      if (action.action === "proposePolicy") {
        const pack = policySchema.parse(action.policy);
        setProposals([{ id: crypto.randomUUID(), base_version: current.version, payload: JSON.stringify(pack), state: "pending", origin: "Public local sandbox", created_at: new Date().toISOString(), diff: policyDiff(current.pack, pack) }, ...proposals]);
        setMessage("Proposal created. Active policy is unchanged until you activate it.");
      } else if (action.action === "decidePolicy") {
        const proposal = proposals.find(p => p.id === action.proposalId && p.state === "pending"); if (!proposal) return;
        if (action.accept && proposal.base_version !== current.version) { setMessage("This proposal is stale. Create a new proposal against the active policy."); return; }
        if (action.accept) {
          const pack = policySchema.parse(JSON.parse(proposal.payload));
          const checks = drafts.map(d => { const before = checkPolicy(current.pack, d.title, d.body), after = checkPolicy(pack, d.title, d.body); return { title: d.title, affected: findingSignature(before) !== findingSignature(after), before: before.length, after: after.length }; });
          setImpact(checks); setDrafts(drafts.map((d, i) => ({ ...d, state: checks[i].affected && d.state === "approved" ? "needs_review" : d.state }))); setCurrent({ version: current.version + 1, pack });
          setMessage("Policy activated in this browser sandbox. Affected approvals now require review.");
        } else setMessage("Proposal rejected. Active guidelines are unchanged.");
        setProposals(proposals.map(p => p.id === proposal.id ? { ...p, state: action.accept ? "accepted" : "rejected" } : p));
      }
    } catch { setMessage("The policy JSON is invalid. Check source IDs, active references and field limits."); }
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

        <section className="p-5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] mb-6 space-y-3">
          <h2 className="text-base font-serif text-[var(--text-main)]">Sample content inventory</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {drafts.map(d => (
              <article key={d.id} className="p-3 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-sunken)] text-xs space-y-1">
                <strong className="block text-sm text-[var(--text-main)]">{d.title}</strong>
                <p className="text-[var(--text-muted)]">{d.body}</p>
                <span className={`editorial-badge status-${d.state}`}>{d.state.replaceAll("_", " ")}</span>
              </article>
            ))}
          </div>
        </section>

        <PolicyPanel key={current.version} current={current} proposals={proposals} admin busy={false} run={run} sandbox />

        {impact.length > 0 && (
          <section className="p-5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] mt-6 space-y-3">
            <h2 className="text-base font-serif text-[var(--text-main)]">Regression recheck results</h2>
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] text-[var(--text-subtle)] uppercase">
                  <th className="py-2">Draft</th>
                  <th className="py-2">Impact status</th>
                  <th className="py-2">Findings before &rarr; after</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {impact.map(row => (
                  <tr key={row.title}>
                    <td className="py-2 font-medium text-[var(--text-main)]">{row.title}</td>
                    <td className="py-2">
                      <span className={`editorial-badge ${row.affected ? "status-needs_review" : "status-draft"}`}>
                        {row.affected ? "Affected — review needed" : "Unchanged"}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-[var(--text-muted)]">{row.before} &rarr; {row.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  );
}
