import "server-only";

import { asc, domains, eq, funnels, funnelSteps, inArray, mediaFiles, sql, stepOffers, workflows } from "@zfunnel/db";
import { inWorkspace } from "./funnels";
import { blocksOf, checkFunnel, healthScore, type HealthInput, type PageLike } from "./funnel-health";
import type { WorkspaceContext } from "./workspaces";

const MEDIA = /\/api\/media\/([0-9a-f-]{36})/gi;

/** Loads what the health check needs (drafts, offers, domain, automations, image sizes) and runs it. */
export async function getFunnelHealth(ctx: WorkspaceContext, funnelId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(funnelId)) return null;
  const input = await inWorkspace(ctx, async (tx): Promise<HealthInput | null> => {
    const [funnel] = await tx.select().from(funnels).where(eq(funnels.id, funnelId));
    if (!funnel || funnel.archivedAt) return null;
    const steps = await tx
      .select()
      .from(funnelSteps)
      .where(eq(funnelSteps.funnelId, funnelId))
      .orderBy(asc(funnelSteps.position));
    const ids = steps.map((s) => s.id);
    const [offers, domainRows, automations] = await Promise.all([
      ids.length
        ? tx
            .select({ stepId: stepOffers.stepId, role: stepOffers.role, n: sql<number>`count(*)::int` })
            .from(stepOffers)
            .where(inArray(stepOffers.stepId, ids))
            .groupBy(stepOffers.stepId, stepOffers.role)
        : Promise.resolve([]),
      tx.select({ id: domains.id }).from(domains).where(eq(domains.status, "active")).limit(1),
      tx.select({ trigger: workflows.trigger }).from(workflows).where(eq(workflows.status, "active")),
    ]);
    const mediaIds = [
      ...new Set(steps.flatMap((s) => [...JSON.stringify(s.draft ?? {}).matchAll(MEDIA)].map((m) => m[1]!))),
    ];
    const sizes = mediaIds.length
      ? await tx
          .select({ id: mediaFiles.id, size: mediaFiles.size })
          .from(mediaFiles)
          .where(inArray(mediaFiles.id, mediaIds))
      : [];
    const count = (stepId: string, roles: string[]) =>
      offers.filter((o) => o.stepId === stepId && roles.includes(o.role)).reduce((n, o) => n + o.n, 0);
    return {
      funnelSlug: funnel.slug,
      steps: steps.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
        type: s.type,
        nextStepId: s.nextStepId,
        declineStepId: s.declineStepId,
        published: !!s.publishedAt,
        changed: !!s.publishedAt && s.draftUpdatedAt.getTime() > s.publishedAt.getTime() + 1000,
        page: (s.draft ?? {}) as PageLike,
        offers: { main: count(s.id, ["main"]), upsell: count(s.id, ["upsell", "downsell", "main"]) },
      })),
      hasFavicon: !!ctx.workspace.logoUrl,
      hasDomain: domainRows.length > 0,
      hasFormAutomation: automations.some(
        (a) =>
          (a.trigger.type === "optin" || a.trigger.type === "form_submitted") &&
          (!a.trigger.funnelId || a.trigger.funnelId === funnelId),
      ),
      imageBytes: Object.fromEntries(sizes.map((m) => [m.id, m.size])),
    };
  });
  if (!input) return null;
  const issues = checkFunnel(input);
  return {
    issues,
    score: healthScore(issues),
    checkedSteps: input.steps.length,
    checkedBlocks: input.steps.reduce((n, s) => n + blocksOf(s.page).length, 0),
  };
}

export type FunnelHealth = NonNullable<Awaited<ReturnType<typeof getFunnelHealth>>>;
