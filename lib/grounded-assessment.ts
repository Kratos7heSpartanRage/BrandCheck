import type { DraftAssessment, Finding, Source } from "../components/brandcheck/model";

export function groundedAssessment(findings: Finding[], body: string): DraftAssessment {
  const attention = findings.filter(f => f.severity === "Needs attention");
  const citations = [...new Set(findings.map(f => `${f.sourceId} v${f.sourceVersion}`))];
  const riskLevel = attention.length >= 3 ? "Critical" : attention.length >= 2 ? "High" : attention.length ? "Moderate" : findings.length ? "Low" : "Low";
  const references = citations.length ? ` Approved sources: ${citations.join(", ")}.` : " No source-linked issues were found.";
  let suggestedRewrite = body;
  let changed = false;
  for (const finding of findings) {
    const replacement = finding.replacement;
    if (replacement && replacement.from && suggestedRewrite.includes(replacement.from)) {
      suggestedRewrite = suggestedRewrite.replace(replacement.from, replacement.to);
      changed = true;
    }
  }
  return {
    riskLevel,
    score: Math.max(0, 100 - attention.length * 15 - (findings.length - attention.length) * 5),
    summary: `${findings.length} source-linked finding${findings.length === 1 ? "" : "s"}; ${attention.length} need${attention.length === 1 ? "s" : ""} attention.${references} Priority is a review heuristic, not a legal or factual verdict.`,
    claimRiskNote: findings.filter(f => f.category === "Claims").map(f => `${f.excerpt} — ${f.sourceId} v${f.sourceVersion}`).join("; "),
    toneRiskNote: findings.filter(f => f.category === "Tone").map(f => `${f.excerpt} — ${f.sourceId} v${f.sourceVersion}`).join("; "),
    suggestedRewrite: changed ? suggestedRewrite : "",
  };
}

const compatibleKinds: Record<Finding["category"], Source["kind"][]> = {
  Terminology: ["Terminology"], Claims: ["Claim policy", "Evidence"],
  Tone: ["Messaging"], Messaging: ["Messaging"], Accessibility: ["Accessibility"],
  "Asset usage": ["Asset policy"],
};

export function groundAIFinding(finding: Finding, sources: Source[]): Finding | null {
  const source = sources.find(s => s.id === finding.sourceId && s.status === "Approved");
  if (!source || !compatibleKinds[finding.category]?.includes(source.kind)) return null;
  return {
    ...finding,
    sourceVersion: source.version,
    explanation: finding.explanation || `AI located this excerpt for human review against approved source “${source.title}” (${source.id} v${source.version}). The source says: ${source.body}`,
    suggestion: finding.suggestion || "Compare this wording with the approved source and revise it if the guideline applies.",
    replacement: finding.replacement,
  };
}
