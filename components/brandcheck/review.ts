import type {
  ApprovedAsset,
  DraftAssessment,
  DraftBody,
  EvidenceRecord,
  Finding,
  Source,
  TermRule,
} from "./model";
import { runGroundedGeminiReview } from "./aiReview";
import { DEFAULT_GEMINI_MODEL } from "./model";

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
  for (const section of [
    { key: "title", location: "Draft title", text: body.title },
    { key: "text", location: "Draft text", text: body.text },
  ]) {
    const text = section.text.trim();
    if (!text) continue;

    for (const term of terms) {
      const source = active.get(term.sourceId);
      if (!source || !term.retired.trim() || !term.preferred.trim()) continue;
      const escaped = term.retired.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const candidates = text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu"));
      const match = Array.from(candidates).find(candidate => {
        const start = candidate.index ?? 0;
        const offset = term.preferred.toLowerCase().indexOf(term.retired.toLowerCase());
        if (offset < 0 || start < offset) return true;
        const preferredStart = start - offset;
        const end = preferredStart + term.preferred.length;
        const isPreferred = text.slice(preferredStart, end).toLowerCase() === term.preferred.toLowerCase()
          && !/[\p{L}\p{N}]/u.test(text[end] || " ");
        return !isPreferred;
      });
      if (match)
        findings.push(
          makeFinding(source, {
            id: `term:${section.key}:${term.id}`,
            category: "Terminology",
            severity: "Needs attention",
            evidenceStatus: "Rule match",
            location: section.location,
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
      const tail = text
        .slice(start + numericClaim[0].length, Math.min(nextStart, start + 100))
        .split(/[.!?\n]/, 1)[0]
        .trim();
      const excerpt = `${numericClaim[0]}${tail ? ` ${tail}` : ""}`;
      const supportedClaim = evidence.some((record) => {
        const phrase = record.claim.trim().replace(/\s+/g, " ");
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return (
          phrase.length > 0 &&
          active.has(record.sourceId) &&
          active.get(record.sourceId)?.kind === "Evidence" &&
          record.expiresAt >= new Date().toISOString().slice(0, 10) &&
          new RegExp(
            `(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`,
            "iu",
          ).test(excerpt.replace(/\s+/g, " "))
        );
      });
      if (claimSource && !supportedClaim)
        findings.push(
          makeFinding(claimSource, {
            id: `claim:${section.key}:${index}`,
            category: "Claims",
            severity: "Needs attention",
            evidenceStatus: "Evidence needed",
            location: section.location,
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
          id: `tone:${section.key}:absolute`,
          category: "Tone",
          severity: "Suggestion",
          evidenceStatus: "Review suggestion",
          location: section.location,
          excerpt: absolute[0],
          explanation:
            "This wording may sound more absolute than the approved clear, specific voice. A person should decide in context.",
          suggestion:
            "Describe the product benefit specifically, without an absolute promise.",
        }),
      );
  }

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

export interface HybridReviewOptions {
  mode: "hybrid" | "rules";
  apiKey?: string;
  modelName?: string;
}

export interface HybridReviewOutput {
  findings: Finding[];
  assessment: DraftAssessment | null;
  notice: string | null;
  isSimulated: boolean;
}

/**
 * Hybrid review pipeline:
 * Combines fast deterministic rules with grounded Gemini AI analysis
 * for nuanced tone, multi-claim verification, and executive assessment.
 */
export async function reviewDraftHybrid(
  body: DraftBody,
  sources: Source[],
  terms: TermRule[],
  evidence: EvidenceRecord[] = [],
  approvedAssetsOrOptions?: ApprovedAsset[] | HybridReviewOptions,
  maybeOptions?: HybridReviewOptions,
): Promise<HybridReviewOutput> {
  let approvedAssets: ApprovedAsset[] = [];
  let options: HybridReviewOptions = { mode: "hybrid" };

  if (Array.isArray(approvedAssetsOrOptions)) {
    approvedAssets = approvedAssetsOrOptions;
    if (maybeOptions) options = maybeOptions;
  } else if (
    approvedAssetsOrOptions &&
    typeof approvedAssetsOrOptions === "object"
  ) {
    options = approvedAssetsOrOptions;
  }

  const deterministicFindings = reviewDraft(
    body,
    sources,
    terms,
    evidence,
    approvedAssets,
  );

  if (options.mode === "rules") {
    return {
      findings: deterministicFindings,
      assessment: null,
      notice: null,
      isSimulated: false,
    };
  }

  // Run Grounded Gemini AI
  const aiResult = await runGroundedGeminiReview(
    body,
    sources,
    terms,
    evidence,
    options.apiKey,
    options.modelName || DEFAULT_GEMINI_MODEL,
  );

  // Merge findings: prioritize deterministic findings, append non-overlapping AI findings
  const merged: Finding[] = [...deterministicFindings];

  for (const aiFinding of aiResult.findings) {
    const isDuplicate = merged.some(
      (existing) =>
        existing.category === aiFinding.category &&
        (existing.excerpt
          .toLowerCase()
          .includes(aiFinding.excerpt.toLowerCase()) ||
          aiFinding.excerpt
            .toLowerCase()
            .includes(existing.excerpt.toLowerCase())),
    );

    if (!isDuplicate) {
      merged.push(aiFinding);
    }
  }

  let notice: string | null = null;
  if (aiResult.error) {
    notice = `AI Review notice: ${aiResult.error} (Fallback active)`;
  } else if (aiResult.isSimulated) {
    notice = options.apiKey?.trim()
      ? "AI review simulation completed."
      : "Gemini offline demo active. Enter a Gemini API Key in settings for live SOTA reasoning.";
  } else {
    notice = `Analyzed live using Google Gemini (${options.modelName || DEFAULT_GEMINI_MODEL}).`;
  }

  return {
    findings: merged,
    assessment: aiResult.assessment,
    notice,
    isSimulated: Boolean(aiResult.isSimulated),
  };
}
