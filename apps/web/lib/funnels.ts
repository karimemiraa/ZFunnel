import "server-only";

import { starterPage, type StarterStepType } from "@zfunnel/blocks";
import { and, asc, desc, eq, funnels, funnelSteps, getDb, sql, withWorkspace, type Tx } from "@zfunnel/db";
import { slugify } from "@zfunnel/shared";
import type { WorkspaceContext } from "./workspaces";

export type StepType = StarterStepType;

export const STEP_TYPE_META: Record<StepType, { label: string; color: string; description: string }> = {
  optin: { label: "Opt-in", color: "#0ea5e9", description: "Capture name & email" },
  sales: { label: "Sales page", color: "#8b5cf6", description: "Sell your offer" },
  checkout: { label: "Checkout", color: "#10b981", description: "Take payment" },
  upsell: { label: "Upsell", color: "#f59e0b", description: "One-click add-on offer" },
  downsell: { label: "Downsell", color: "#f97316", description: "Cheaper alternative" },
  thankyou: { label: "Thank you", color: "#ec4899", description: "Confirm & deliver" },
  page: { label: "Page", color: "#64748b", description: "Any other page" },
};

export const FUNNEL_PRESETS = {
  lead: {
    label: "Lead magnet",
    description: "Opt-in → Thank you",
    steps: [
      ["Opt-in", "optin"],
      ["Thank you", "thankyou"],
    ],
  },
  sales: {
    label: "Sales funnel",
    description: "Sales → Checkout → Upsell → Downsell → Thank you",
    steps: [
      ["Sales page", "sales"],
      ["Checkout", "checkout"],
      ["Upsell", "upsell"],
      ["Downsell", "downsell"],
      ["Thank you", "thankyou"],
    ],
  },
  tripwire: {
    label: "Tripwire",
    description: "Opt-in → Checkout → Upsell → Thank you",
    steps: [
      ["Opt-in", "optin"],
      ["Checkout", "checkout"],
      ["Upsell", "upsell"],
      ["Thank you", "thankyou"],
    ],
  },
  blank: { label: "Blank", description: "A single page you build from scratch", steps: [["Home", "page"]] },
} satisfies Record<string, { label: string; description: string; steps: [string, StepType][] }>;
export type FunnelPreset = keyof typeof FUNNEL_PRESETS;

function scope(ctx: WorkspaceContext) {
  return { organizationId: ctx.membership.organizationId, workspaceId: ctx.workspace.id };
}

export function inWorkspace<T>(ctx: WorkspaceContext, fn: (tx: Tx) => Promise<T>) {
  return withWorkspace(getDb(), scope(ctx), fn);
}

export async function listFunnels(ctx: WorkspaceContext) {
  return inWorkspace(ctx, (tx) =>
    tx
      .select({
        id: funnels.id,
        name: funnels.name,
        slug: funnels.slug,
        updatedAt: funnels.updatedAt,
        stepCount: sql<number>`(select count(*)::int from funnel_steps s where s.funnel_id = ${funnels.id})`,
        publishedCount: sql<number>`(select count(*)::int from funnel_steps s where s.funnel_id = ${funnels.id} and s.published_version_id is not null)`,
        firstStepId: sql<
          string | null
        >`(select s.id from funnel_steps s where s.funnel_id = ${funnels.id} order by s.position limit 1)`,
      })
      .from(funnels)
      .where(sql`${funnels.archivedAt} is null`)
      .orderBy(desc(funnels.updatedAt)),
  );
}

export async function getFunnel(ctx: WorkspaceContext, funnelId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(funnelId)) return null;
  return inWorkspace(ctx, async (tx) => {
    const [funnel] = await tx.select().from(funnels).where(eq(funnels.id, funnelId));
    if (!funnel || funnel.archivedAt) return null;
    const steps = await tx
      .select({
        id: funnelSteps.id,
        name: funnelSteps.name,
        slug: funnelSteps.slug,
        type: funnelSteps.type,
        position: funnelSteps.position,
        nextStepId: funnelSteps.nextStepId,
        declineStepId: funnelSteps.declineStepId,
        mapX: funnelSteps.mapX,
        mapY: funnelSteps.mapY,
        draftUpdatedAt: funnelSteps.draftUpdatedAt,
        publishedAt: funnelSteps.publishedAt,
        publishedVersionId: funnelSteps.publishedVersionId,
      })
      .from(funnelSteps)
      .where(eq(funnelSteps.funnelId, funnelId))
      .orderBy(asc(funnelSteps.position));
    return { funnel, steps };
  });
}
export type FunnelDetail = NonNullable<Awaited<ReturnType<typeof getFunnel>>>;
export type StepSummary = FunnelDetail["steps"][number];

export async function getStepWithDraft(ctx: WorkspaceContext, stepId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(stepId)) return null;
  return inWorkspace(ctx, async (tx) => {
    const [row] = await tx
      .select({ step: funnelSteps, funnel: funnels })
      .from(funnelSteps)
      .innerJoin(funnels, eq(funnels.id, funnelSteps.funnelId))
      .where(and(eq(funnelSteps.id, stepId), sql`${funnels.archivedAt} is null`));
    return row ?? null;
  });
}

/** Picks `base`, or `base-2`, `base-3`… if taken. */
export function uniqueSlug(base: string, taken: Set<string>) {
  const root = slugify(base) || "page";
  if (!taken.has(root)) return root;
  for (let i = 2; ; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
}

export async function createFunnelWithSteps(ctx: WorkspaceContext, name: string, preset: FunnelPreset) {
  return inWorkspace(ctx, async (tx) => {
    const existing = await tx.select({ slug: funnels.slug }).from(funnels);
    const slug = uniqueSlug(name, new Set(existing.map((f) => f.slug)));
    const [funnel] = await tx.insert(funnels).values({ workspaceId: ctx.workspace.id, name, slug }).returning();
    const spec = FUNNEL_PRESETS[preset].steps;
    const taken = new Set<string>();
    const rows = await tx
      .insert(funnelSteps)
      .values(
        spec.map(([stepName, type], i) => {
          const s = uniqueSlug(stepName, taken);
          taken.add(s);
          return {
            workspaceId: ctx.workspace.id,
            funnelId: funnel!.id,
            name: stepName,
            type,
            slug: s,
            position: i,
            mapX: i * 300,
            mapY: type === "downsell" ? 200 : 0,
            draft: starterPage(type, stepName),
          };
        }),
      )
      .returning({ id: funnelSteps.id, type: funnelSteps.type, position: funnelSteps.position });

    // Wire the flow: each step → the next; upsell "no thanks" → downsell; downsell → after it.
    const ordered = rows.sort((a, b) => a.position - b.position);
    for (let i = 0; i < ordered.length; i++) {
      const cur = ordered[i]!;
      let next = ordered[i + 1];
      let decline: (typeof ordered)[number] | undefined;
      if (cur.type === "upsell" && next?.type === "downsell") {
        decline = next;
        next = ordered[i + 2];
      } else if (cur.type === "upsell" || cur.type === "downsell") {
        decline = next;
      }
      await tx
        .update(funnelSteps)
        .set({ nextStepId: next?.id ?? null, declineStepId: decline?.id ?? null })
        .where(eq(funnelSteps.id, cur.id));
    }
    return funnel!;
  });
}
