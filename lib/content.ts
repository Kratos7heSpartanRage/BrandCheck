import { z } from "zod";
import type { Finding } from "../components/brandcheck/model";
import { reviewDraft } from "../components/brandcheck/review";
import { checkPolicy } from "./policy";
import type { Policy } from "./policy";
export const documentSchema = z.object({ name: z.string().max(200), type: z.enum(["pdf", "docx", "txt", "md"]), segments: z.array(z.object({ label: z.string().min(1).max(80), start: z.number().int().min(0).max(5000), end: z.number().int().min(0).max(5000) })).min(1).max(200) });
export type DocumentMap = z.infer<typeof documentSchema>;
export const imageSchema = z.object({
  name: z.string().trim().min(1).max(200), mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
  bytes: z.number().int().min(1).max(5_000_000), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  alt: z.string().max(500), decorative: z.boolean(), visualType: z.enum(["brand-graphic", "photo"]),
  dominantColor: z.string().regex(/^#[a-fA-F0-9]{6}$/).nullable(),
  previewDataUrl: z.string().max(64_000).regex(/^data:image\/(?:webp|jpeg);base64,[a-zA-Z0-9+/=]+$/).nullable(),
});
export type ImageMeta = z.infer<typeof imageSchema>;
export function validDocument(text: string, doc: DocumentMap | null) {
  if (!doc) return true;
  if (new Set(doc.segments.map(s => s.label)).size !== doc.segments.length) return false;
  let end = 0;
  for (const segment of doc.segments) {
    if (segment.start < end || segment.end < segment.start || segment.end > text.length || text.slice(end, segment.start).trim()) return false;
    end = segment.end;
  }
  return !text.slice(end).trim();
}
export function checkContent(pack: Policy, title: string, text: string, doc: DocumentMap | null, image: ImageMeta | null = null): Finding[] {
  const textFindings = !doc ? checkPolicy(pack, title, text) : [...checkPolicy(pack, title, ""), ...doc.segments.flatMap((segment, index) => checkPolicy(pack, "", text.slice(segment.start, segment.end)).map(f => ({ ...f, id: `${f.id}:part-${index}`, location: segment.label })))];
  if (!image) return textFindings;
  const imageFindings = reviewDraft({ title: "", text: "", channel: "Workspace", audience: "General", image: { ...image, source: "upload" } }, pack.sources, [], [], pack.approvedAssets ?? []);
  if (!pack.sources.some(s => s.id === "ACCESS-001" && s.status === "Approved") && !image.decorative && !image.alt.trim()) imageFindings.push({ id: "access:alt", category: "Accessibility", severity: "Needs attention", evidenceStatus: "Rule match", location: `Image: ${image.name}`, excerpt: "Alternative text is empty", explanation: "The image is marked meaningful but has no alternative text. This is a built-in accessibility check while the workspace has no approved image-description guideline.", sourceId: "BASE-ACCESS", sourceVersion: "1", suggestion: "Describe what the image conveys or mark it decorative if it adds no information." });
  if (!pack.sources.some(s => s.id === "ASSET-001" && s.status === "Approved")) imageFindings.push({ id: "asset:policy-missing", category: "Asset usage", severity: "Suggestion", evidenceStatus: "Evidence needed", location: `Image: ${image.name}`, excerpt: image.name, explanation: "This workspace has no approved visual-asset guideline, so BrandCheck cannot establish whether the image is approved.", sourceId: "BASE-ASSET", sourceVersion: "1", suggestion: "Ask an admin to define approved assets in Brand guidelines, then run the review again." });
  const palette = pack.palette ?? [];
  const source = pack.sources.find(s => s.id === "ASSET-001" && s.kind === "Asset policy" && s.status === "Approved");
  const color = image.dominantColor;
  if (source && image.visualType === "brand-graphic" && color && palette.length && !(pack.approvedAssets ?? []).some(a => a.sha256 === image.sha256)) {
    const rgb = (hex: string) => [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
    const actual = rgb(color);
    const closest = Math.min(...palette.map(hex => Math.hypot(...actual.map((value,i) => value - rgb(hex)[i]))));
    if (closest > 75) imageFindings.push({ id: "asset:palette", category: "Asset usage", severity: "Suggestion", evidenceStatus: "Review suggestion", location: `Image: ${image.name}`, excerpt: color, explanation: `The graphic's sampled dominant colour ${color} differs from the approved palette (${palette.join(", ")}). This is a colour heuristic, not a visual brand verdict.`, sourceId: source.id, sourceVersion: source.version, suggestion: "Check the graphic against the approved palette or ask a reviewer to confirm the exception." });
  }
  return [...textFindings, ...imageFindings];
}
export function locateFinding(finding: Finding, title: string, text: string, doc: DocumentMap | null): Finding {
  if (!doc) return finding;
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();
  const quote = normalize(finding.excerpt);
  if (!quote) return finding;
  if (normalize(title).includes(quote)) return { ...finding, location: "Draft title" };
  const segment = doc.segments.find(s => normalize(text.slice(s.start, s.end)).includes(quote));
  return segment ? { ...finding, location: segment.label } : finding;
}
