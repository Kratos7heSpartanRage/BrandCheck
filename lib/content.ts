import { z } from "zod";
import type { Finding } from "../components/brandcheck/model";
import { checkPolicy } from "./policy";
import type { Policy } from "./policy";
export const documentSchema = z.object({ name: z.string().max(200), type: z.enum(["pdf", "docx", "txt", "md"]), segments: z.array(z.object({ label: z.string().min(1).max(80), start: z.number().int().min(0).max(5000), end: z.number().int().min(0).max(5000) })).min(1).max(200) });
export type DocumentMap = z.infer<typeof documentSchema>;
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
export function checkContent(pack: Policy, title: string, text: string, doc: DocumentMap | null): Finding[] {
  if (!doc) return checkPolicy(pack, title, text);
  return [...checkPolicy(pack, title, ""), ...doc.segments.flatMap((segment, index) => checkPolicy(pack, "", text.slice(segment.start, segment.end)).map(f => ({ ...f, id: `${f.id}:part-${index}`, location: segment.label })))];
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
