import { env } from "cloudflare:workers";
import { z } from "zod";
import { runGroundedGeminiReview } from "../components/brandcheck/aiReview";
import { ReviewError } from "./shared-review";
import type { Policy } from "./policy";
import { reserveAIRequest } from "./ai-quota";
import { groundAIFinding } from "./grounded-assessment";
const outputSchema = z.object({
  assessment: z.object({ riskLevel: z.enum(["Low", "Moderate", "High", "Critical"]), score: z.number().finite().min(0).max(100), summary: z.string().max(8000), claimRiskNote: z.string().max(8000), toneRiskNote: z.string().max(8000), suggestedRewrite: z.string().max(5000) }),
  findings: z.array(z.object({ id: z.string().max(160), category: z.enum(["Terminology", "Claims", "Tone", "Accessibility", "Asset usage", "Messaging"]), severity: z.enum(["Needs attention", "Suggestion"]), evidenceStatus: z.enum(["Rule match", "Review suggestion", "Evidence needed"]), location: z.string().max(500), excerpt: z.string().min(1).max(5000), explanation: z.string().max(8000), sourceId: z.string().max(80), sourceVersion: z.string().max(80), suggestion: z.string().max(8000), replacement: z.object({ from: z.string().max(5000), to: z.string().max(5000) }).optional(), detectedBy: z.literal("ai").optional() })).max(60),
});
export async function runSavedAIReview(request: Request, title: string, text: string, pack: Policy) {
  if (!env.GEMINI_API_KEY) throw new ReviewError(503, "AI is not configured. You can still run rule checks.");
  if (!await reserveAIRequest(env.DB, request)) throw new ReviewError(429, "The current AI service allowance has been reached. Run rule checks or try again later.");
  const sources = pack.sources.filter(s => s.status === "Approved");
  const evidence = pack.evidence.filter(e => e.expiresAt >= new Date().toISOString().slice(0,10) && sources.some(s => s.id === e.sourceId && s.kind === "Evidence"));
  const model = env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const result = await runGroundedGeminiReview({ title, text, channel: "Workspace content", audience: "Brand audience", image: null }, sources, pack.terms.filter(t => sources.some(s => s.id === t.sourceId)), evidence, env.GEMINI_API_KEY, model, 22000);
  if (result.error || result.isSimulated) return { findings: [], assessment: null, isSimulated: true, error: "AI temporarily unavailable", model };
  const output = outputSchema.safeParse(result);
  if (!output.success) return { findings: [], assessment: null, isSimulated: true, error: "AI response failed validation", model };
  return { findings: output.data.findings.map(f => groundAIFinding(f, sources)).filter((f): f is NonNullable<typeof f> => f !== null), assessment: null, isSimulated: false, model };
}
