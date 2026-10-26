import type {
  ApprovedAsset,
  DraftBody,
  EvidenceRecord,
  Finding,
  Source,
  TermRule,
} from "./model";

const makeFinding = (
  source: Source,
  fields: Omit<Finding, "sourceId" | "sourceVersion">,
): Finding => ({
  ...fields,
  sourceId: source.id,
  sourceVersion: source.version,
});

export function reviewDraft(
  body: DraftBody,
  sources: Source[],
  terms: TermRule[],
  evidence: EvidenceRecord[] = [],
  approvedAssets: ApprovedAsset[] = [],
): Finding[] {
  const active = new Map(
    sources
      .filter((source) => source.status === "Approved")
      .map((source) => [source.id, source]),
  );
  const findings: Finding[] = [];
  const text = body.text.trim();
  if (!text) return findings;

  for (const term of terms) {
    const source = active.get(term.sourceId);
    if (!source || !term.retired.trim() || !term.preferred.trim()) continue;
    const escaped = term.retired.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`\\b${escaped}\\b`, "i"));
    if (match)
      findings.push(
        makeFinding(source, {
          id: `term:${term.id}`,
          category: "Terminology",
          severity: "Needs attention",
          evidenceStatus: "Rule match",
          location: "Draft text",
          excerpt: match[0],
          explanation: `“${term.retired}” is a retired name. The approved term is “${term.preferred}”.`,
          suggestion: `Replace “${match[0]}” with “${term.preferred}”.`,
          replacement: { from: match[0], to: term.preferred },
        }),
      );
  }

  const claimSource = active.get("CLAIM-001");
  const numericClaims = [
    ...text.matchAll(
      /\b(?:\d+(?:\.\d+)?\s?(?:x|×|%|percent|times)(?!\w)|double\b|triple\b)/gi,
    ),
  ];
  for (const [index, numericClaim] of numericClaims.entries()) {
    const start = numericClaim.index ?? 0;
    const nextStart = numericClaims[index + 1]?.index ?? text.length;
    const excerpt = text
      .slice(start, Math.min(nextStart, start + 60))
      .split(/[.!?\n]/, 1)[0]
      .trim();
    const supportedClaim = evidence.some(
      (record) =>
        active.has(record.sourceId) &&
        record.expiresAt >= new Date().toISOString().slice(0, 10) &&
        excerpt.toLowerCase().includes(record.claim.trim().toLowerCase()),
    );
    if (claimSource && !supportedClaim)
      findings.push(
        makeFinding(claimSource, {
          id: `claim:numeric:${index}`,
          category: "Claims",
          severity: "Needs attention",
          evidenceStatus: "Evidence needed",
          location: "Draft text",
          excerpt,
          explanation:
            "This sounds like a measurable performance claim. The approved pack does not contain evidence for it. BrandCheck has not determined whether it is true or false.",
          suggestion:
            "Link current approved evidence for reviewer assessment, or use the approved non-quantified description: “designed to simplify daily work.”",
        }),
      );
  }

  const toneSource = active.get("TONE-001");
  const absolute = text.match(
    /\b(?:guarantee(?:s|d)?|always|never|every team|perfect|best ever)\b/i,
  );
  if (toneSource && absolute)
    findings.push(
      makeFinding(toneSource, {
        id: "tone:absolute",
        category: "Tone",
        severity: "Suggestion",
        evidenceStatus: "Review suggestion",
        location: "Draft text",
        excerpt: absolute[0],
        explanation:
          "This wording may sound more absolute than the approved clear, specific voice. A person should decide in context.",
        suggestion:
          "Describe the product benefit specifically, without an absolute promise.",
      }),
    );

  if (body.image) {
    const accessSource = active.get("ACCESS-001");
    if (accessSource && !body.image.decorative && !body.image.alt.trim())
      findings.push(
        makeFinding(accessSource, {
          id: "access:alt",
          category: "Accessibility",
          severity: "Needs attention",
          evidenceStatus: "Rule match",
          location: `Image: ${body.image.name}`,
          excerpt: "Alternative text is empty",
          explanation:
            "The image is marked meaningful but has no alternative text for people who cannot see it.",
          suggestion:
            "Describe the information conveyed by the image, or mark it decorative if it adds no information.",
        }),
      );
    const assetSource = active.get("ASSET-001");
    if (
      assetSource &&
      body.image.source === "upload" &&
      !approvedAssets.some((asset) => asset.sha256 === body.image?.sha256)
    )
      findings.push(
        makeFinding(assetSource, {
          id: "asset:unapproved",
          category: "Asset usage",
          severity: "Needs attention",
          evidenceStatus: "Evidence needed",
          location: `Image: ${body.image.name}`,
          excerpt: body.image.name,
          explanation:
            "The uploaded file fingerprint is not in this demo’s approved asset library. This does not prove the visual is off-brand.",
          suggestion:
            "Ask an authorised reviewer to confirm the visual, or choose the approved NovaDesk launch asset.",
        }),
      );
  }
  return findings;
}
