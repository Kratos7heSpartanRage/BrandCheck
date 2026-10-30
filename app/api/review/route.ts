import { env } from "cloudflare:workers";
import { z } from "zod";
import { runGroundedGeminiReview } from "../../../components/brandcheck/aiReview";
import { reserveAIRequest } from "../../../lib/ai-quota";

const sourceSchema = z.object({
  id: z.string().min(1).max(80), title: z.string().max(200),
  body: z.string().max(2_000), version: z.string().max(40),
  updated: z.string().max(40), status: z.enum(["Approved", "Retired"]),
  kind: z.enum(["Terminology", "Messaging", "Claim policy", "Accessibility", "Asset policy", "Evidence"]),
});
const inputSchema = z.object({
  body: z.object({
    title: z.string().max(100), channel: z.string().max(80),
    audience: z.string().max(200), text: z.string().max(10_000),
    image: z.object({
      name: z.string().max(200), mime: z.string().max(80), bytes: z.number().int().min(0).max(750_000),
      sha256: z.string().max(128), alt: z.string().max(1_000), decorative: z.boolean(),
      source: z.enum(["approved-demo", "upload"]),
    }).nullable(),
  }),
  sources: z.array(sourceSchema).min(1).max(40),
  terms: z.array(z.object({ id: z.string().max(80), retired: z.string().max(80), preferred: z.string().max(80), sourceId: z.string().max(80) })).max(40),
  evidence: z.array(z.object({ id: z.string().max(80), claim: z.string().max(200), reference: z.string().max(500), expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), sourceId: z.string().max(80) })).max(40),
});
const assessmentSchema = z.object({
  riskLevel: z.enum(["Low", "Moderate", "High", "Critical"]), score: z.number().finite().min(0).max(100),
  summary: z.string().max(8_000), claimRiskNote: z.string().max(8_000), toneRiskNote: z.string().max(8_000), suggestedRewrite: z.string().max(10_000),
});
const findingSchema = z.object({
  id: z.string().max(160), category: z.enum(["Terminology", "Claims", "Tone", "Accessibility", "Asset usage", "Messaging"]),
  severity: z.enum(["Needs attention", "Suggestion"]), evidenceStatus: z.enum(["Rule match", "Review suggestion", "Evidence needed"]),
  location: z.string().max(500), excerpt: z.string().max(10_000), explanation: z.string().max(8_000),
  sourceId: z.string().max(80), sourceVersion: z.string().max(40), suggestion: z.string().max(8_000),
  replacement: z.object({ from: z.string().max(10_000), to: z.string().max(10_000) }).optional(), detectedBy: z.literal("ai").optional(),
});
function json(value: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", ...extraHeaders } });
}
async function readJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > 48_000) { await reader.cancel(); throw new Error("Request too large"); }
    chunks.push(part.value);
  }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(data));
}
async function reserveReview(request: Request): Promise<boolean> {
  return reserveAIRequest(env.DB, request);
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Review requests must come from this demo." }, 403);
  if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Send a JSON draft." }, 415);
  let raw: unknown;
  try { raw = await readJson(request); } catch { return json({ error: "Use a valid draft and a brand pack under 48 KB." }, 400); }
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) return json({ error: "This draft or brand pack has unsupported fields or exceeds the demo limits." }, 400);
  if (!env.GEMINI_API_KEY) return json({ error: "Live review is not configured. Local brand checks are still available." }, 503);
  if (!parsed.data.body.text.trim() && !parsed.data.body.image) return json({ error: "Add draft text or an image before reviewing." }, 400);
  try {
    if (!await reserveReview(request)) return json({ error: "The shared demo review limit has been reached. Use local rules or try again later." }, 429, { "Retry-After": "600" });
    const { body, sources, terms, evidence } = parsed.data;
    const approved = sources.filter(source => source.status === "Approved");
    const sourceIds = new Set(approved.map(source => source.id));
    const date = new Date().toISOString().slice(0, 10);
    const activeEvidence = evidence.filter(record => record.expiresAt >= date && approved.some(source => source.id === record.sourceId && source.kind === "Evidence"));
    const run = () => runGroundedGeminiReview(body, approved, terms.filter(term => sourceIds.has(term.sourceId)), activeEvidence, env.GEMINI_API_KEY, env.GEMINI_MODEL || "gemini-3.1-flash-lite", 22_000);
    let result = await run();
    if (result.error && /demand|temporar|network|timeout|overload|unavailable|rate|quota/i.test(result.error)) {
      await new Promise(resolve => setTimeout(resolve, 800));
      result = await run();
    }
    if (result.isSimulated || result.error) return json({ error: "Google Gemini is temporarily unavailable. Local brand checks are still available; please retry the live review." }, 503);
    const output = z.object({ findings: z.array(findingSchema).max(60), assessment: assessmentSchema, isSimulated: z.literal(false) }).safeParse(result);
    if (!output.success) return json({ error: "The AI response could not be validated. Please retry or use local rules." }, 502);
    return json({ ...output.data, model: env.GEMINI_MODEL || "gemini-3.1-flash-lite" });
  } catch {
    return json({ error: "The live review service is unavailable. Please retry or use local rules." }, 503);
  }
}
export function GET() {
  return json({ service: "BrandCheck live review", configured: Boolean(env.GEMINI_API_KEY), model: env.GEMINI_MODEL || "gemini-3.1-flash-lite" });
}
