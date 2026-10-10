"use server";

import { asc, eq, funnelInsights, funnels, funnelSteps, inArray, pageVersions } from "@zfunnel/db";
import { revalidatePath } from "next/cache";
import { aiConfigured, complete, takeAiQuota } from "./ai";
import { funnelAnalytics, RANGES, type RangeKey } from "./analytics";
import { enforce } from "./billing";
import { COACH_SYSTEM, coachPrompt, parseCoach } from "./coach";
import { collectCopy } from "./copy-slots";
import { inWorkspace } from "./funnels";
import { requireUser } from "./session";
import { getWorkspaceForUser } from "./workspaces";

type Result = { ok: true } | { ok: false; error: string };

/** Asks the AI coach to review a funnel's numbers and copy; stores the advice. */
export async function runCoach(workspaceSlug: string, funnelId: string, range: string): Promise<Result> {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) return { ok: false, error: "Workspace not found" };
  if (!aiConfigured()) return { ok: false, error: "AI isn't set up on this server yet (ANTHROPIC_API_KEY)." };
  const blocked = await enforce(ctx.membership.organizationId, "ai");
  if (blocked) return { ok: false, error: blocked };
  if (!takeAiQuota(ctx.workspace.id, 30))
    return { ok: false, error: "You've reached the hourly AI limit. Try again later." };
  const days = RANGES[(range in RANGES ? range : "30") as RangeKey];

  const loaded = await inWorkspace(ctx, async (tx) => {
    const [f] = await tx.select().from(funnels).where(eq(funnels.id, funnelId));
    if (!f) return null;
    const steps = await tx
      .select()
      .from(funnelSteps)
      .where(eq(funnelSteps.funnelId, f.id))
      .orderBy(asc(funnelSteps.position));
    const versionIds = steps.flatMap((s) => (s.publishedVersionId ? [s.publishedVersionId] : []));
    const versions = versionIds.length
      ? await tx.select().from(pageVersions).where(inArray(pageVersions.id, versionIds))
      : [];
    // What visitors actually see: the published page, else the draft.
    const content = new Map(
      steps.map((s) => [
        s.id,
        (versions.find((v) => v.id === s.publishedVersionId)?.data ?? s.draft) as { content?: unknown },
      ]),
    );
    return { f, content };
  });
  if (!loaded) return { ok: false, error: "Funnel not found" };
  const stats = await funnelAnalytics(ctx, funnelId, days);
  if (!stats.steps.length) return { ok: false, error: "Add steps to this funnel first." };

  const steps = stats.steps.map((s) => ({
    name: s.name,
    type: s.type,
    visitors: s.visitors,
    conversions: s.conversions,
    rate: s.rate,
    tracked: s.tracked,
    revenue: s.revenue,
    copy: collectCopy(loaded.content.get(s.id) ?? {}).map((c) => c.text),
  }));
  let parsed: ReturnType<typeof parseCoach> = null;
  try {
    const raw = await complete({
      system: COACH_SYSTEM,
      prompt: coachPrompt({ funnelName: loaded.f.name, days, currency: stats.totals.currency, steps }),
      maxTokens: 2000,
    });
    parsed = parseCoach(
      raw,
      steps.map((s) => s.name),
    );
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  if (!parsed) return { ok: false, error: "The coach's answer couldn't be read. Please try again." };
  const visitors = Math.max(0, ...steps.map((s) => s.visitors));
  await inWorkspace(ctx, (tx) =>
    tx.insert(funnelInsights).values({
      workspaceId: ctx.workspace.id,
      funnelId,
      summary: parsed.summary,
      suggestions: parsed.suggestions,
      days,
      visitors,
    }),
  );
  revalidatePath(`/${workspaceSlug}/analytics`);
  return { ok: true };
}
