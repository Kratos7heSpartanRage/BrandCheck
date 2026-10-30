type EventRow = { id: string; draft_id: string | null; action: string; version: number | null; detail: string; created_at: string };
export type ContentSnapshot = { title: string; body: string; image?: { sha256?: string; alt?: string; name?: string } | null };
export type RevisionChoice = { id: string; label: string; version: number; snapshot: ContentSnapshot };

export function revisionChoices(events: EventRow[], draftId: string, currentVersion: number): RevisionChoice[] {
  const choices: RevisionChoice[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    if (event.draft_id !== draftId || !event.version || event.version > currentVersion) continue;
    let detail: { snapshot?: unknown };
    try { detail = JSON.parse(event.detail); } catch { continue; }
    const snapshot = (event.action === "draft_created" ? detail : detail.snapshot) as ContentSnapshot | undefined;
    if (!snapshot || typeof snapshot.title !== "string" || typeof snapshot.body !== "string") continue;
    const identity = `${event.version}:${snapshot.title}:${snapshot.body}:${snapshot.image?.sha256 || ""}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    choices.push({ id: event.id, version: event.version, label: `Revision ${event.version} · ${event.action.replaceAll("_", " ")} · ${new Date(event.created_at).toLocaleString()}`, snapshot });
  }
  return choices;
}

export type DiffPart = { kind: "same" | "added" | "removed"; text: string };
export function diffText(before: string, after: string): DiffPart[] {
  const a = before.split(/(?<=\n)/), b = after.split(/(?<=\n)/);
  // A 5,000-character draft may contain thousands of one-character lines.
  if (a.length * b.length > 100_000) return before === after ? [{ kind: "same", text: before }] : [{ kind: "removed", text: before }, { kind: "added", text: after }];
  const dp = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length-1; i >= 0; i--) for (let j = b.length-1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? 1 + dp[i+1][j+1] : Math.max(dp[i+1][j], dp[i][j+1]);
  const parts: DiffPart[] = []; let i = 0, j = 0;
  const push = (kind: DiffPart["kind"], text: string) => { if (parts.at(-1)?.kind === kind) parts[parts.length-1].text += text; else parts.push({ kind, text }); };
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { push("same", a[i]); i++; j++; }
    else if (j < b.length && (i === a.length || dp[i][j+1] >= dp[i+1][j])) push("added", b[j++]);
    else push("removed", a[i++]);
  }
  return parts;
}
