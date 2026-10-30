import { env } from "cloudflare:workers";
import { ZodError } from "zod";
import { getChatGPTUser } from "../../chatgpt-auth";
import { listWorkspaces, readWorkspace, mutateWorkspace, ReviewError } from "../../../lib/shared-review";
import { runSavedAIReview } from "../../../lib/ai-server";
import { runSavedVisualReview } from "../../../lib/visual-review";

export const dynamic = "force-dynamic";
function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store", "Vary": "Cookie" } }); }
async function handle(request: Request, write: boolean) {
  try {
    if (write) {
      // Cookie-authenticated writes require a same-origin browser request.
      if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Use this site's workspace page." }, 403);
      if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Send JSON." }, 415);
    }
    const user = await getChatGPTUser();
    if (!user) return json({ error: "Sign in to use shared workspaces." }, 401);
    if (!env.DB) return json({ error: "Shared storage is unavailable." }, 503);
    if (!write) {
      const workspaceId = new URL(request.url).searchParams.get("workspaceId");
      return json(workspaceId ? await readWorkspace(env.DB, user, workspaceId) : { user: { userId: user.userId, email: user.email }, workspaces: await listWorkspaces(env.DB, user) });
    }
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Missing request body." }, 400);
    const chunks: Uint8Array[] = []; let bytes = 0;
    while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.byteLength; if (bytes > 160_000) { await reader.cancel(); return json({ error: "Request exceeds 160 KB." }, 413); } chunks.push(next.value); }
    const data = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    return json(await mutateWorkspace(env.DB, user, JSON.parse(new TextDecoder().decode(data)), { aiReview: (title, text, pack) => runSavedAIReview(request, title, text, pack), visualReview: (image, pack) => runSavedVisualReview(request, image, pack) }));
  } catch (error) {
    if (error instanceof ReviewError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError || error instanceof SyntaxError) return json({ error: "Check the request fields and limits." }, 400);
    return json({ error: "The workspace could not be updated. Refresh and retry." }, 503);
  }
}
export function GET(request: Request) { return handle(request, false); }
export function POST(request: Request) { return handle(request, true); }
