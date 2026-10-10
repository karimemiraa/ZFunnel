import "server-only";

import { asc, eq, funnelSteps } from "@zfunnel/db";
import { sanitizeRichText } from "@zfunnel/email";
import { complete } from "./ai";
import { applyCopy, collectCopy } from "./copy-slots";
import { inWorkspace } from "./funnels";
import type { WorkspaceContext } from "./workspaces";

const SYSTEM = `You are a world-class direct-response copywriter. You rewrite every piece of copy in a sales funnel so it fits the user's business.
Rules:
- Keep each item's role and approximate length (a headline stays a short headline, a button stays 2-5 words).
- Items marked html must stay simple HTML using only <p>, <strong>, <em>, <ul>, <li>, <a href>.
- Never invent specific statistics, prices, testimonials from real people, awards or guarantees the brief doesn't mention. For testimonials, write clearly generic placeholders like "Customer name".
- Write in the language of the brief.
- Reply with ONLY a JSON object: {"items":[{"id":"…","text":"…"}]} containing every id you were given.`;

/**
 * Rewrites all copy of a freshly created funnel for the user's business. Best effort:
 * on any AI or parsing problem the template copy simply stays.
 */
export async function writeFunnelCopy(ctx: WorkspaceContext, funnelId: string, brief: string) {
  const steps = await inWorkspace(ctx, (tx) =>
    tx.select().from(funnelSteps).where(eq(funnelSteps.funnelId, funnelId)).orderBy(asc(funnelSteps.position)),
  );
  const slots = steps.flatMap((s, i) =>
    collectCopy(s.draft as { content?: unknown }).map((c) => ({ ...c, id: `${i}|${c.id}`, step: s.name })),
  );
  if (!slots.length) return { updated: 0 };
  const prompt = [
    `Business brief:\n${brief}`,
    `The funnel has these steps: ${steps.map((s) => `${s.name} (${s.type})`).join(", ")}.`,
    `Rewrite each item:\n${JSON.stringify(slots.map((s) => ({ id: s.id, step: s.step, html: s.html, text: s.text })))}`,
  ].join("\n\n");
  let parsed: { items?: { id?: unknown; text?: unknown }[] };
  try {
    const raw = await complete({ system: SYSTEM, prompt, maxTokens: 8000 });
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    parsed = JSON.parse(json) as typeof parsed;
  } catch (err) {
    console.error("[ai-funnel]", (err as Error).message);
    return { updated: 0, error: "The AI couldn't write this funnel. The template copy is ready to edit." };
  }
  const known = new Map(slots.map((s) => [s.id, s]));
  const byStep = new Map<number, { id: string; text: string }[]>();
  for (const item of parsed.items ?? []) {
    if (typeof item.id !== "string" || typeof item.text !== "string") continue;
    const slot = known.get(item.id); // only ids we sent: the AI can't touch anything else
    if (!slot || !item.text.trim()) continue;
    const text = slot.html
      ? sanitizeRichText(item.text)
      : item.text
          .replace(/<[^>]+>/g, "")
          .trim()
          .slice(0, 500);
    const [i, path] = [Number(item.id.split("|")[0]), item.id.slice(item.id.indexOf("|") + 1)];
    byStep.set(i, [...(byStep.get(i) ?? []), { id: path, text }]);
  }
  let updated = 0;
  await inWorkspace(ctx, async (tx) => {
    for (const [i, reps] of byStep) {
      const s = steps[i];
      if (!s) continue;
      await tx
        .update(funnelSteps)
        .set({ draft: applyCopy(s.draft, reps), draftUpdatedAt: new Date() })
        .where(eq(funnelSteps.id, s.id));
      updated += reps.length;
    }
  });
  return { updated };
}
