import { z } from "zod";
import type { Finding } from "../components/brandcheck/model";
import type { ImageMeta } from "./content";
import type { Policy } from "./policy";

const responseSchema = z.object({
  visibleText: z.string().max(1200).default(""),
  observations: z.array(z.object({ sourceId: z.string().max(80), observation: z.string().min(5).max(300), suggestedAction: z.string().min(5).max(300) })).max(5),
});
export type VisualResult = { findings: Finding[]; observedText: string; model: string };

export function groundVisualResult(raw: unknown, image: ImageMeta, pack: Policy, model: string): VisualResult | null {
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success) return null;
  const sources = new Map(pack.sources.filter(s => s.status === "Approved" && ["Asset policy", "Accessibility", "Messaging", "Terminology"].includes(s.kind)).map(s => [s.id, s]));
  const findings: Finding[] = [];
  for (const [index, observation] of parsed.data.observations.entries()) {
    const source = sources.get(observation.sourceId);
    if (!source) continue;
    findings.push({
      id: `visual:${image.sha256.slice(0,12)}:${index}`,
      category: source.kind === "Accessibility" ? "Accessibility" : source.kind === "Messaging" ? "Messaging" : source.kind === "Terminology" ? "Terminology" : "Asset usage",
      severity: "Suggestion", evidenceStatus: "Review suggestion", location: `Image: ${image.name}`, excerpt: observation.observation,
      explanation: `AI visual observation from a reduced-size preview; verify it against the original image. Approved ${source.id} says: ${source.body}`,
      sourceId: source.id, sourceVersion: source.version,
      suggestion: `${observation.suggestedAction} A human reviewer must confirm whether this applies.`, detectedBy: "ai",
    });
  }
  const visible = parsed.data.visibleText.toLocaleLowerCase();
  for (const term of pack.terms) {
    const source = sources.get(term.sourceId);
    if (!source || source.kind !== "Terminology" || !visible.includes(term.retired.toLocaleLowerCase()) || findings.some(f => f.sourceId === source.id && f.excerpt.toLocaleLowerCase().includes(term.retired.toLocaleLowerCase()))) continue;
    findings.push({
      id: `visual:ocr:${image.sha256.slice(0,12)}:${term.id}`,
      category: "Terminology", severity: "Suggestion", evidenceStatus: "Review suggestion", location: `Image: ${image.name}`, excerpt: term.retired,
      explanation: `AI may have read “${term.retired}” in the reduced-size preview. Verify the lettering against the original image. Approved ${source.id} says: ${source.body}`,
      sourceId: source.id, sourceVersion: source.version,
      suggestion: `If the text is present, consider the approved term “${term.preferred}”. A human reviewer must confirm the image text.`, detectedBy: "ai",
    });
  }
  return { findings, observedText: parsed.data.visibleText, model };
}
