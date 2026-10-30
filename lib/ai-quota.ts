export async function reserveAIRequest(db: D1Database | undefined, request: Request): Promise<boolean> {
  if (!db) return false;
  const now = Date.now(), day = new Date(now).toISOString().slice(0, 10);
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${day}:${ip}`));
  const fingerprint = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
  const expires = Math.floor(now / 1000) + 172800;
  const statement = "INSERT INTO review_usage (bucket, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET count = count + 1 WHERE count < ? RETURNING count";
  const results = await db.batch([
    db.prepare(statement).bind(`day:${day}`, expires, 180),
    db.prepare(statement).bind(`visitor:${fingerprint}:${Math.floor(now / 600_000)}`, expires, 20),
    db.prepare("DELETE FROM review_usage WHERE expires_at < ?").bind(Math.floor(now / 1000)),
  ]);
  return results[0].results.length > 0 && results[1].results.length > 0;
}
