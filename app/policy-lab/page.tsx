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
  return <main className="policy-lab"><style>{`.policy-lab{max-width:1000px;margin:auto;padding:24px;font:16px/1.5 system-ui;color:#163c32}.policy-lab section,.policy-lab article{padding:18px;margin:15px 0;border:1px solid #cbdad2;border-radius:12px;background:white}.policy-lab textarea,.policy-lab input{display:block;padding:10px;width:100%;box-sizing:border-box;border:1px solid #96afa4;border-radius:7px;margin:8px 0;background:white;color:#163c32}.policy-lab button{padding:10px 14px;margin:5px 8px 5px 0;background:#164e43;border:0;border-radius:7px;color:white;cursor:pointer}.policy-lab button:disabled{opacity:.5}.policy-lab pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}.policy-lab .notice{background:#fff0c9;padding:15px}.policy-lab a{color:#145942}.policy-lab table{width:100%;border-collapse:collapse}.policy-lab th,.policy-lab td{padding:10px;text-align:left;border-bottom:1px solid #dce6df}`}</style>
    <a href="/">← BrandCheck</a> · <a href="/documents">Document review</a> · <a href="/workspace">Saved workspaces</a>
    <h1>Policy regression sandbox</h1><p className="notice">Public, device-local demonstration. Changes here are temporary and do not affect any shared workspace. Real permissions and saved policy history are available under Shared workspaces.</p>
    <p>Try: prepare a sample product rename → create proposal → enter a reason → activate and recheck. The approved announcement should become “needs review”; the unrelated newsletter stays unchanged.</p>
    {message && <p role="status" className="notice">{message}</p>}
    <section><h2>Content inventory</h2>{drafts.map(d => <article key={d.id}><strong>{d.title}</strong><p>{d.body}</p><small>Status: {d.state.replaceAll("_", " ")}</small></article>)}</section>
    <PolicyPanel key={current.version} current={current} proposals={proposals} admin busy={false} run={run} sandbox />
    {impact.length > 0 && <section><h2>Policy change impact</h2><table><thead><tr><th>Draft</th><th>Impact</th><th>Findings before → after</th></tr></thead><tbody>{impact.map(row => <tr key={row.title}><td>{row.title}</td><td>{row.affected ? "Affected — review needed" : "Unchanged"}</td><td>{row.before} → {row.after}</td></tr>)}</tbody></table></section>}
  </main>;
}
