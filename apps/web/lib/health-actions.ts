"use server";

import { asc, eq, funnelSteps } from "@zfunnel/db";
import { revalidatePath } from "next/cache";
import { saveDraft } from "./funnel-actions";
import { applySeoFix, nextStepFor, type PageLike } from "./funnel-health";
import { inWorkspace } from "./funnels";
import { getT } from "./i18n";
import { requireUser } from "./session";
import { getWorkspaceForUser } from "./workspaces";

type Result = { ok: true } | { ok: false; error: string };

async function load(workspaceSlug: string, stepId: string) {
  const user = await requireUser();
  const t = await getT();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx || !/^[0-9a-f-]{36}$/i.test(stepId)) return { t, ctx: null, step: null };
  const step = await inWorkspace(ctx, async (tx) => {
    const [s] = await tx.select().from(funnelSteps).where(eq(funnelSteps.id, stepId));
    return s ?? null;
  });
  return { t, ctx, step };
}

/** One-click fix: fills the step's empty SEO title, description and share image from its own content. */
export async function fixStepSeo(workspaceSlug: string, stepId: string): Promise<Result> {
  const { t, ctx, step } = await load(workspaceSlug, stepId);
  if (!ctx || !step) return { ok: false, error: t("funnels.errors.stepNotFound") };
  const fixed = applySeoFix((step.draft ?? {}) as PageLike);
  if (!fixed) return { ok: false, error: t("health.nothingToFix") };
  const saved = await saveDraft(workspaceSlug, stepId, fixed);
  if (!saved.ok) return saved;
  revalidatePath(`/${workspaceSlug}/funnels/${step.funnelId}`);
  return { ok: true };
}

/** One-click fix: points the step's "next" at the step after it, when it has none or a missing one. */
export async function linkStepToNext(workspaceSlug: string, stepId: string): Promise<Result> {
  const { t, ctx, step } = await load(workspaceSlug, stepId);
  if (!ctx || !step) return { ok: false, error: t("funnels.errors.stepNotFound") };
  const done = await inWorkspace(ctx, async (tx) => {
    const steps = await tx
      .select({ id: funnelSteps.id })
      .from(funnelSteps)
      .where(eq(funnelSteps.funnelId, step.funnelId))
      .orderBy(asc(funnelSteps.position));
    const linked = step.nextStepId && steps.some((s) => s.id === step.nextStepId);
    const next = nextStepFor(steps, stepId);
    if (linked || !next) return false;
    await tx.update(funnelSteps).set({ nextStepId: next }).where(eq(funnelSteps.id, stepId));
    return true;
  });
  if (!done) return { ok: false, error: t("health.nothingToFix") };
  revalidatePath(`/${workspaceSlug}/funnels/${step.funnelId}`);
  return { ok: true };
}
