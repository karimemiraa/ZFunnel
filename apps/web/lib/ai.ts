import "server-only";

/**
 * Minimal Anthropic Messages API client (fetch, no SDK). AI features are optional:
 * without ANTHROPIC_API_KEY they are hidden in the UI and the actions refuse politely.
 */
export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const MODEL = () => process.env.AI_MODEL ?? "claude-sonnet-5-5";

export async function complete(input: { system: string; prompt: string; maxTokens?: number }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("AI is not configured");
  const base = (process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com").replace(/\/$/, "");
  const res = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: MODEL(),
      max_tokens: input.maxTokens ?? 800,
      system: input.system,
      messages: [{ role: "user", content: input.prompt }],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[ai]", res.status, body.slice(0, 300));
    throw new Error(res.status === 429 ? "The AI is busy right now. Try again in a moment." : "The AI request failed.");
  }
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (json.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
}

// Simple per-workspace hourly limit (per process).
const usage = new Map<string, { hour: number; n: number }>();
export function takeAiQuota(workspaceId: string, perHour = 60) {
  const hour = Math.floor(Date.now() / 3_600_000);
  const u = usage.get(workspaceId);
  if (!u || u.hour !== hour) {
    usage.set(workspaceId, { hour, n: 1 });
    return true;
  }
  if (u.n >= perHour) return false;
  u.n++;
  return true;
}
