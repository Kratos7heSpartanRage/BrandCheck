import type { Finding } from "../components/brandcheck/model";

type DraftRow = { id: string; findings: string; state: string; policy_version: number };
type EventRow = { id: string; draft_id: string | null; action: string; version: number | null; detail: string; created_at: string };

function parseFindings(value: string): Finding[] {
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is Finding => !!item && typeof item.sourceId === "string" && typeof item.category === "string") : []; }
  catch { return []; }
}

export function buildInsights(drafts: DraftRow[], events: EventRow[]) {
  type Row = { sourceId: string; category: string; drafts: number; findings: number; evidenceNeeded: number; reviewOccurrences: number; clearedLater: number; approvedWithFinding: number; changesRequestedWithFinding: number };
  const active = new Map<string, Row>();
  const rowFor = (key: string) => {
    const [sourceId, category] = key.split("\u0000");
    const row = active.get(key) ?? { sourceId, category, drafts: 0, findings: 0, evidenceNeeded: 0, reviewOccurrences: 0, clearedLater: 0, approvedWithFinding: 0, changesRequestedWithFinding: 0 };
    active.set(key, row); return row;
  };
  for (const draft of drafts) {
    const seen = new Set<string>();
    for (const finding of parseFindings(draft.findings)) {
      const key = `${finding.sourceId}\u0000${finding.category}`;
      const row = rowFor(key);
      row.findings++;
      if (!seen.has(key)) { row.drafts++; seen.add(key); }
      if (finding.evidenceStatus === "Evidence needed") row.evidenceNeeded++;
    }
  }
  // Audit events are a bounded sample. Count only explicit review runs, not submissions
  // (which would count the same findings a second time).
  const seenReviews = new Set<string>();
  const previousReview = new Map<string, Set<string>>();
  const pendingDecision = new Map<string, Set<string>>();
  for (const event of [...events].sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))) {
    if (!event.draft_id) continue;
    let detail: { findings?: unknown };
    try { detail = JSON.parse(event.detail); } catch { continue; }
    if (event.action === "approved" || event.action === "changes_requested") {
      for (const key of pendingDecision.get(event.draft_id) || []) {
        const row = rowFor(key);
        if (event.action === "approved") row.approvedWithFinding++; else row.changesRequestedWithFinding++;
      }
      pendingDecision.delete(event.draft_id); continue;
    }
    if (event.action === "submit" && Array.isArray(detail.findings)) {
      pendingDecision.set(event.draft_id, new Set((detail.findings as Finding[]).filter(f => f && typeof f.sourceId === "string" && typeof f.category === "string").map(f => `${f.sourceId}\u0000${f.category}`)));
      continue;
    }
    if (!["reviewAI", "reviewVisual", "recheckDraft", "policy_recheck"].includes(event.action)) continue;
    const reviewKey = `${event.draft_id}:${event.version}:${event.action}`;
    if (seenReviews.has(reviewKey)) continue;
    seenReviews.add(reviewKey);
    if (!Array.isArray(detail.findings)) continue;
    const sources = new Set<string>();
    for (const finding of detail.findings as Finding[]) if (finding && typeof finding.sourceId === "string" && typeof finding.category === "string") sources.add(`${finding.sourceId}\u0000${finding.category}`);
    for (const key of sources) rowFor(key).reviewOccurrences++;
    for (const key of previousReview.get(event.draft_id) || []) if (!sources.has(key)) rowFor(key).clearedLater++;
    previousReview.set(event.draft_id, sources);
  }
  const rows = [...active.values()].sort((a,b) => b.drafts-a.drafts || b.reviewOccurrences-a.reviewOccurrences || a.sourceId.localeCompare(b.sourceId));
  const decisionCounts = { approved: 0, changesRequested: 0 };
  for (const event of events) {
    if (event.action === "approved") decisionCounts.approved++;
    if (event.action === "changes_requested") decisionCounts.changesRequested++;
  }
  return {
    rows,
    policyGaps: rows.filter(row => row.sourceId.startsWith("BASE-") && row.drafts > 0),
    draftsWithFindings: drafts.filter(draft => parseFindings(draft.findings).length > 0).length,
    awaitingDecision: drafts.filter(draft => draft.state === "submitted").length,
    decisions: decisionCounts,
    sampledDrafts: drafts.length,
    sampledEvents: events.length,
  };
}
