import { z } from "zod";
import { seedSources, seedTerms } from "../components/brandcheck/model";
import type { Finding } from "../components/brandcheck/model";
import { reviewDraft } from "../components/brandcheck/review";

const short = z.string().trim().min(1).max(80);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const parsed = new Date(value); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; }, "Use a real calendar date.");
const sourceSchema = z.object({ id: short, title: z.string().min(1).max(200), body: z.string().max(2000), version: short, updated: z.string().max(40), status: z.enum(["Approved", "Retired"]), kind: z.enum(["Terminology", "Messaging", "Claim policy", "Accessibility", "Asset policy", "Evidence"]) });
export const policySchema = z.object({
  name: z.string().trim().min(1).max(100),
  sources: z.array(sourceSchema).min(1).max(40),
  terms: z.array(z.object({ id: short, retired: short, preferred: short, sourceId: short })).max(40),
  evidence: z.array(z.object({ id: short, claim: z.string().min(1).max(200), reference: z.string().max(500), expiresAt: date, sourceId: short })).max(40),
}).superRefine((value, ctx) => {
  const ids = new Set(value.sources.map(s => s.id));
  if (ids.size !== value.sources.length) ctx.addIssue({ code: "custom", message: "Source IDs must be unique." });
  if (new Set(value.terms.map(t => t.id)).size !== value.terms.length) ctx.addIssue({ code: "custom", message: "Term IDs must be unique." });
  for (const term of value.terms) if (!value.sources.some(s => s.id === term.sourceId && s.status === "Approved")) ctx.addIssue({ code: "custom", message: "Term rules must reference approved sources." });
  for (const record of value.evidence) if (!value.sources.some(s => s.id === record.sourceId && s.kind === "Evidence" && s.status === "Approved")) ctx.addIssue({ code: "custom", message: "Evidence must reference an approved Evidence source." });
});
export type Policy = z.infer<typeof policySchema>;
export const defaultPolicy: Policy = { name: "NovaDesk demonstration pack", sources: seedSources, terms: seedTerms, evidence: [] };
export function checkPolicy(policy: Policy, title: string, body: string): Finding[] {
  return reviewDraft({ title, text: body, channel: "Shared draft", audience: "General", image: null }, policy.sources, policy.terms, policy.evidence);
}
export async function currentPolicy(db: D1Database, workspaceId: string): Promise<{ version: number; pack: Policy }> {
  const row = await db.prepare("SELECT version, payload FROM workspace_policies WHERE workspace_id = ?").bind(workspaceId).first<{ version: number; payload: string }>();
  return row ? { version: row.version, pack: policySchema.parse(JSON.parse(row.payload)) } : { version: 0, pack: defaultPolicy };
}
export function policyDiff(before: Policy, after: Policy) {
  function diff<T extends { id: string }>(a: T[], b: T[]) {
    const canonical = (item: T) => JSON.stringify(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
    return { added: b.filter(x => !a.some(y => y.id === x.id)).map(x => x.id), removed: a.filter(x => !b.some(y => y.id === x.id)).map(x => x.id), changed: b.filter(x => a.some(y => y.id === x.id && canonical(y) !== canonical(x))).map(x => x.id) };
  }
  return { sources: diff(before.sources, after.sources), terms: diff(before.terms, after.terms), evidence: diff(before.evidence, after.evidence) };
}
export function findingSignature(findings: Finding[]) {
  return JSON.stringify(findings.map(f => [f.id, f.excerpt, f.sourceId, f.sourceVersion, f.severity]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
}
export async function fetchGitHubPolicy(url: string): Promise<Policy> {
  const location = new URL(url);
  if (location.protocol !== "https:" || location.hostname !== "raw.githubusercontent.com" || location.port || location.username || location.password || location.search || location.hash || location.pathname.split("/").filter(Boolean).length < 4) throw new Error("Use an HTTPS raw.githubusercontent.com policy JSON URL.");
  const response = await fetch(location, { redirect: "error", signal: AbortSignal.timeout(8000), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("GitHub could not return this public policy file.");
  const reader = response.body?.getReader(); if (!reader) throw new Error("The policy file is empty.");
  let size = 0; const chunks: Uint8Array[] = [];
  while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 48_000) { await reader.cancel(); throw new Error("Policy file exceeds 48 KB."); } chunks.push(part.value); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return policySchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
}
