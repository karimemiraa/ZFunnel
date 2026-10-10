"use server";

import { starterPage, TEMPLATES } from "@zfunnel/blocks";
import {
  and,
  eq,
  funnels,
  funnelSteps,
  getDb,
  inArray,
  pageVersions,
  STEP_TYPES,
  stepVariants,
  type Tx,
  withOrganization,
  workspaces,
} from "@zfunnel/db";
import { randomBytes } from "node:crypto";
import { RESERVED_SLUGS, slugSchema } from "@zfunnel/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  copySteps,
  createFunnelWithSteps,
  FUNNEL_PRESETS,
  inWorkspace,
  uniqueSlug,
  type FunnelPreset,
} from "./funnels";
import { aiConfigured, takeAiQuota } from "./ai";
import { writeFunnelCopy } from "./ai-funnel";
import { enforce } from "./billing";
import { requireUser } from "./session";
import { getSharedFunnel } from "./share";
import { getT, localizeMessage } from "./i18n";
import type { T } from "@zfunnel/i18n";
import { canManage, getWorkspaceForUser, recordAudit, type WorkspaceContext } from "./workspaces";

export type FormState = { error?: string; success?: string; fieldErrors?: Record<string, string[] | undefined> } | null;
type Result = { ok: true; message?: string } | { ok: false; error: string };

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const t = await getT();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error(t("ai.workspaceNotFound"));
  return { user, ctx, t };
}

/** Field errors in the dashboard language (schema messages may be i18n keys). */
function fieldErrorsOf(t: T, error: z.ZodError) {
  const errs = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    Object.entries(errs).map(([k, v]) => [k, v?.map((m) => localizeMessage(t, m) ?? m)]),
  ) as Record<string, string[] | undefined>;
}

const uuid = z.string().uuid();
const MAX_PAGE_BYTES = 2_000_000;

const pageSchema = z
  .object({
    root: z.object({ props: z.record(z.string(), z.unknown()).optional() }).passthrough(),
    content: z.array(z.unknown()),
  })
  .passthrough();

function revalidateFunnel(ws: string, funnelId: string) {
  revalidatePath(`/${ws}/funnels/${funnelId}`);
  revalidatePath(`/${ws}/funnels`);
}

/**
 * Foreign keys bypass row-level security, so link targets are checked explicitly:
 * every non-empty id must be a step of `funnelId` (which RLS already scopes to this workspace).
 */
async function stepsInFunnel(tx: Tx, funnelId: string, ids: string[]) {
  const wanted = ids.filter(Boolean);
  if (!wanted.length) return true;
  const rows = await tx
    .select({ id: funnelSteps.id })
    .from(funnelSteps)
    .where(and(eq(funnelSteps.funnelId, funnelId), inArray(funnelSteps.id, wanted)));
  return rows.length === new Set(wanted).size;
}

// ---------- Funnels ----------

const createFunnelSchema = z.object({
  name: z.string().trim().min(2, "funnels.errors.atLeast2").max(80),
  source: z.union([
    z.object({ preset: z.enum(Object.keys(FUNNEL_PRESETS) as [FunnelPreset, ...FunnelPreset[]]) }),
    z.object({ template: z.enum(TEMPLATES.map((t) => t.id) as [string, ...string[]]) }),
  ]),
});

export async function createFunnel(workspaceSlug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  const choice = String(formData.get("source") ?? "");
  const parsed = createFunnelSchema.safeParse({
    name: formData.get("name"),
    source: choice.startsWith("template:") ? { template: choice.slice(9) } : { preset: choice.replace(/^preset:/, "") },
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(t, parsed.error) };
  const blocked = await enforce(ctx.membership.organizationId, "funnels");
  if (blocked) return { error: blocked };
  const brief = String(formData.get("brief") ?? "")
    .trim()
    .slice(0, 1500);
  const useAi = brief.length >= 10 && "template" in parsed.data.source && aiConfigured();
  if (useAi) {
    const aiBlocked = await enforce(ctx.membership.organizationId, "ai");
    if (aiBlocked) return { error: aiBlocked };
    if (!takeAiQuota(ctx.workspace.id)) return { error: t("ai.rateLimit") };
  }
  const funnel = await createFunnelWithSteps(ctx, parsed.data.name, parsed.data.source);
  if (useAi) await writeFunnelCopy(ctx, funnel.id, brief);
  await recordAudit(ctx, user.id, {
    action: "funnel.created",
    entityType: "funnel",
    entityId: funnel.id,
    data: { name: funnel.name },
  });
  redirect(`/${workspaceSlug}/funnels/${funnel.id}`);
}

const funnelSettingsSchema = z.object({ name: z.string().trim().min(2).max(80), slug: slugSchema });

export async function updateFunnel(
  workspaceSlug: string,
  funnelId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  const parsed = funnelSettingsSchema.safeParse({ name: formData.get("name"), slug: formData.get("slug") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(t, parsed.error) };
  try {
    await inWorkspace(ctx, (tx) => tx.update(funnels).set(parsed.data).where(eq(funnels.id, funnelId)));
  } catch {
    return { fieldErrors: { slug: [t("funnels.errors.funnelSlugTaken")] } };
  }
  const isHome = formData.get("home") === "on";
  await setHomeFunnelInternal(ctx, isHome ? funnelId : null, funnelId);
  await recordAudit(ctx, user.id, {
    action: "funnel.updated",
    entityType: "funnel",
    entityId: funnelId,
    data: parsed.data,
  });
  revalidateFunnel(workspaceSlug, funnelId);
  return { success: t("funnels.errors.saved") };
}

async function setHomeFunnelInternal(ctx: WorkspaceContext, homeId: string | null, funnelId: string) {
  const current = ctx.workspace.homeFunnelId;
  // Only touch the setting if this funnel is becoming home, or stops being home.
  if (homeId === null && current !== funnelId) return;
  if (homeId !== null && current === homeId) return;
  await withOrganization(getDb(), ctx.membership.organizationId, (tx) =>
    tx.update(workspaces).set({ homeFunnelId: homeId }).where(eq(workspaces.id, ctx.workspace.id)),
  );
}

export async function archiveFunnel(workspaceSlug: string, funnelId: string) {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  if (!canManage(ctx.membership.role)) throw new Error(t("funnels.errors.onlyAdminsDelete"));
  await inWorkspace(ctx, (tx) => tx.update(funnels).set({ archivedAt: new Date() }).where(eq(funnels.id, funnelId)));
  await setHomeFunnelInternal(ctx, null, funnelId);
  await recordAudit(ctx, user.id, { action: "funnel.deleted", entityType: "funnel", entityId: funnelId });
  revalidatePath(`/${workspaceSlug}/funnels`);
  redirect(`/${workspaceSlug}/funnels`);
}

export async function duplicateFunnel(workspaceSlug: string, funnelId: string): Promise<Result | void> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  const blocked = await enforce(ctx.membership.organizationId, "funnels");
  if (blocked) return { ok: false, error: blocked };
  const copy = await inWorkspace(ctx, async (tx) => {
    const [src] = await tx.select().from(funnels).where(eq(funnels.id, funnelId));
    if (!src) throw new Error(t("ai.funnelNotFound"));
    const taken = new Set((await tx.select({ slug: funnels.slug }).from(funnels)).map((f) => f.slug));
    const [f] = await tx
      .insert(funnels)
      .values({
        workspaceId: ctx.workspace.id,
        name: t("funnels.copyName", { name: src.name }),
        slug: uniqueSlug(`${src.slug}-copy`, taken),
      })
      .returning();
    const steps = await tx.select().from(funnelSteps).where(eq(funnelSteps.funnelId, funnelId));
    await copySteps(tx, steps, ctx.workspace.id, f!.id);
    return f!;
  });
  await recordAudit(ctx, user.id, {
    action: "funnel.duplicated",
    entityType: "funnel",
    entityId: copy.id,
    data: { from: funnelId },
  });
  revalidatePath(`/${workspaceSlug}/funnels`);
  redirect(`/${workspaceSlug}/funnels/${copy.id}`);
}

// ---------- Steps ----------

const addStepSchema = z.object({ name: z.string().trim().min(1).max(60), type: z.enum(STEP_TYPES) });

export async function addStep(
  workspaceSlug: string,
  funnelId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx, t } = await ctxFor(workspaceSlug);
  const parsed = addStepSchema.safeParse({ name: formData.get("name"), type: formData.get("type") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(t, parsed.error) };
  await inWorkspace(ctx, async (tx) => {
    const steps = await tx.select().from(funnelSteps).where(eq(funnelSteps.funnelId, funnelId));
    const last = steps.sort((a, b) => b.position - a.position)[0];
    const [created] = await tx
      .insert(funnelSteps)
      .values({
        workspaceId: ctx.workspace.id,
        funnelId,
        name: parsed.data.name,
        type: parsed.data.type,
        slug: uniqueSlug(parsed.data.name, new Set(steps.map((s) => s.slug))),
        position: (last?.position ?? -1) + 1,
        mapX: (last?.mapX ?? -300) + 300,
        mapY: last?.mapY ?? 0,
        draft: starterPage(parsed.data.type, parsed.data.name, undefined, ctx.workspace.siteLocale),
      })
      .returning();
    // Append to the flow: the previous final step now continues here.
    if (last && !last.nextStepId)
      await tx.update(funnelSteps).set({ nextStepId: created!.id }).where(eq(funnelSteps.id, last.id));
  });
  revalidateFunnel(workspaceSlug, funnelId);
  return { success: t("funnels.errors.stepAdded") };
}

const stepSettingsSchema = z.object({
  name: z.string().trim().min(1).max(60),
  slug: slugSchema,
  type: z.enum(STEP_TYPES),
  nextStepId: z.union([uuid, z.literal("")]),
  declineStepId: z.union([uuid, z.literal("")]),
});

export async function updateStep(
  workspaceSlug: string,
  stepId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { ctx, t } = await ctxFor(workspaceSlug);
  const parsed = stepSettingsSchema.safeParse(
    Object.fromEntries(["name", "slug", "type", "nextStepId", "declineStepId"].map((k) => [k, formData.get(k) ?? ""])),
  );
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(t, parsed.error) };
  const { nextStepId, declineStepId, ...rest } = parsed.data;
  if (nextStepId === stepId || declineStepId === stepId) return { error: t("funnels.errors.selfLink") };
  let funnelId = "";
  try {
    const bad = await inWorkspace(ctx, async (tx) => {
      const [current] = await tx
        .select({ funnelId: funnelSteps.funnelId })
        .from(funnelSteps)
        .where(eq(funnelSteps.id, stepId));
      if (!current) return t("funnels.errors.stepNotFound");
      if (!(await stepsInFunnel(tx, current.funnelId, [nextStepId, declineStepId])))
        return t("funnels.errors.linksInFunnel");
      funnelId = current.funnelId;
      await tx
        .update(funnelSteps)
        .set({ ...rest, nextStepId: nextStepId || null, declineStepId: declineStepId || null })
        .where(eq(funnelSteps.id, stepId));
      return null;
    });
    if (bad) return { error: bad };
  } catch {
    return { fieldErrors: { slug: [t("funnels.errors.stepSlugTaken")] } };
  }
  revalidateFunnel(workspaceSlug, funnelId);
  return { success: t("funnels.errors.saved") };
}

export async function deleteStep(workspaceSlug: string, stepId: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  let funnelId = "";
  await inWorkspace(ctx, async (tx) => {
    const [step] = await tx.select().from(funnelSteps).where(eq(funnelSteps.id, stepId));
    if (!step) return;
    funnelId = step.funnelId;
    // Heal the flow: anything pointing at this step now points where it pointed.
    await tx
      .update(funnelSteps)
      .set({ nextStepId: step.nextStepId })
      .where(and(eq(funnelSteps.funnelId, step.funnelId), eq(funnelSteps.nextStepId, stepId)));
    await tx
      .update(funnelSteps)
      .set({ declineStepId: step.nextStepId })
      .where(and(eq(funnelSteps.funnelId, step.funnelId), eq(funnelSteps.declineStepId, stepId)));
    await tx.delete(funnelSteps).where(eq(funnelSteps.id, stepId));
  });
  revalidateFunnel(workspaceSlug, funnelId);
  return { ok: true };
}

export async function reorderSteps(workspaceSlug: string, funnelId: string, orderedIds: string[]): Promise<Result> {
  const { ctx, t } = await ctxFor(workspaceSlug);
  if (!orderedIds.every((id) => uuid.safeParse(id).success))
    return { ok: false, error: t("funnels.errors.invalidSteps") };
  await inWorkspace(ctx, async (tx) => {
    for (const [i, id] of orderedIds.entries())
      await tx
        .update(funnelSteps)
        .set({ position: i })
        .where(and(eq(funnelSteps.id, id), eq(funnelSteps.funnelId, funnelId)));
  });
  revalidateFunnel(workspaceSlug, funnelId);
  return { ok: true };
}

export async function duplicateStep(workspaceSlug: string, stepId: string): Promise<Result> {
  const { ctx, t } = await ctxFor(workspaceSlug);
  let funnelId = "";
  await inWorkspace(ctx, async (tx) => {
    const [s] = await tx.select().from(funnelSteps).where(eq(funnelSteps.id, stepId));
    if (!s) return;
    funnelId = s.funnelId;
    const siblings = await tx.select().from(funnelSteps).where(eq(funnelSteps.funnelId, s.funnelId));
    for (const sib of siblings)
      if (sib.position > s.position)
        await tx
          .update(funnelSteps)
          .set({ position: sib.position + 1 })
          .where(eq(funnelSteps.id, sib.id));
    await tx.insert(funnelSteps).values({
      workspaceId: ctx.workspace.id,
      funnelId: s.funnelId,
      name: t("funnels.copyName", { name: s.name }),
      type: s.type,
      slug: uniqueSlug(`${s.slug}-copy`, new Set(siblings.map((x) => x.slug))),
      position: s.position + 1,
      mapX: s.mapX + 40,
      mapY: s.mapY + 140,
      draft: s.draft,
    });
  });
  revalidateFunnel(workspaceSlug, funnelId);
  return { ok: true };
}

// ---------- Map ----------

export async function saveMapPositions(
  workspaceSlug: string,
  funnelId: string,
  positions: { id: string; x: number; y: number }[],
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const valid = positions.filter((p) => uuid.safeParse(p.id).success && Number.isFinite(p.x) && Number.isFinite(p.y));
  await inWorkspace(ctx, async (tx) => {
    for (const p of valid)
      await tx
        .update(funnelSteps)
        .set({ mapX: p.x, mapY: p.y })
        .where(and(eq(funnelSteps.id, p.id), eq(funnelSteps.funnelId, funnelId)));
  });
  return { ok: true };
}

export async function connectSteps(
  workspaceSlug: string,
  funnelId: string,
  sourceId: string,
  kind: "next" | "decline",
  targetId: string | null,
): Promise<Result> {
  const { ctx, t } = await ctxFor(workspaceSlug);
  if (!uuid.safeParse(sourceId).success || (targetId && !uuid.safeParse(targetId).success))
    return { ok: false, error: t("funnels.errors.invalidStep") };
  if (sourceId === targetId) return { ok: false, error: t("funnels.errors.selfLink") };
  const ok = await inWorkspace(ctx, async (tx) => {
    if (!(await stepsInFunnel(tx, funnelId, [sourceId, targetId ?? ""]))) return false;
    await tx
      .update(funnelSteps)
      .set(kind === "next" ? { nextStepId: targetId } : { declineStepId: targetId })
      .where(and(eq(funnelSteps.id, sourceId), eq(funnelSteps.funnelId, funnelId)));
    return true;
  });
  if (!ok) return { ok: false, error: t("funnels.errors.stepsInFunnel") };
  revalidateFunnel(workspaceSlug, funnelId);
  return { ok: true };
}

// ---------- Editor ----------

export async function saveDraft(
  workspaceSlug: string,
  stepId: string,
  data: unknown,
): Promise<Result & { savedAt?: string }> {
  const { ctx, t } = await ctxFor(workspaceSlug);
  const parsed = pageSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: t("funnels.errors.invalidPage") };
  if (JSON.stringify(parsed.data).length > MAX_PAGE_BYTES)
    return { ok: false, error: t("funnels.errors.pageTooLarge") };
  const now = new Date();
  await inWorkspace(ctx, (tx) =>
    tx
      .update(funnelSteps)
      .set({ draft: parsed.data as never, draftUpdatedAt: now })
      .where(eq(funnelSteps.id, stepId)),
  );
  return { ok: true, savedAt: now.toISOString() };
}

export async function publishStep(
  workspaceSlug: string,
  stepId: string,
  data?: unknown,
): Promise<Result & { publishedAt?: string }> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  if (data !== undefined) {
    const saved = await saveDraft(workspaceSlug, stepId, data);
    if (!saved.ok) return saved;
  }
  const now = new Date();
  const funnelId = await inWorkspace(ctx, async (tx) => {
    const [step] = await tx.select().from(funnelSteps).where(eq(funnelSteps.id, stepId));
    if (!step) throw new Error(t("funnels.errors.stepNotFound"));
    const [v] = await tx
      .insert(pageVersions)
      .values({ workspaceId: ctx.workspace.id, stepId, data: step.draft, createdBy: user.id })
      .returning();
    await tx.update(funnelSteps).set({ publishedVersionId: v!.id, publishedAt: now }).where(eq(funnelSteps.id, stepId));
    return step.funnelId;
  });
  await recordAudit(ctx, user.id, { action: "page.published", entityType: "step", entityId: stepId });
  revalidateFunnel(workspaceSlug, funnelId);
  return { ok: true, publishedAt: now.toISOString() };
}

export async function publishFunnel(workspaceSlug: string, funnelId: string): Promise<Result & { count?: number }> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const now = new Date();
  const count = await inWorkspace(ctx, async (tx) => {
    const steps = await tx.select().from(funnelSteps).where(eq(funnelSteps.funnelId, funnelId));
    for (const step of steps) {
      const [v] = await tx
        .insert(pageVersions)
        .values({ workspaceId: ctx.workspace.id, stepId: step.id, data: step.draft, createdBy: user.id })
        .returning();
      await tx
        .update(funnelSteps)
        .set({ publishedVersionId: v!.id, publishedAt: now })
        .where(eq(funnelSteps.id, step.id));
    }
    return steps.length;
  });
  await recordAudit(ctx, user.id, {
    action: "funnel.published",
    entityType: "funnel",
    entityId: funnelId,
    data: { steps: count },
  });
  revalidateFunnel(workspaceSlug, funnelId);
  return { ok: true, count };
}

export async function unpublishStep(workspaceSlug: string, stepId: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  let funnelId = "";
  await inWorkspace(ctx, async (tx) => {
    const [row] = await tx
      .update(funnelSteps)
      .set({ publishedVersionId: null, publishedAt: null })
      .where(eq(funnelSteps.id, stepId))
      .returning();
    funnelId = row?.funnelId ?? "";
  });
  revalidateFunnel(workspaceSlug, funnelId);
  return { ok: true };
}

// ── Split tests ──────────────────────────────────────────────────────────────

/** Starts an A/B test: variant B begins as a copy of the step's current draft. */
export async function createVariant(workspaceSlug: string, stepId: string): Promise<Result & { id?: string }> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  const blocked = await enforce(ctx.membership.organizationId, "splitTests");
  if (blocked) return { ok: false, error: blocked };
  const res = await inWorkspace(ctx, async (tx) => {
    const [step] = await tx.select().from(funnelSteps).where(eq(funnelSteps.id, stepId));
    if (!step) return { error: t("funnels.errors.stepNotFound") };
    if (!step.publishedVersionId) return { error: t("funnels.errors.publishBeforeVariant") };
    const existing = await tx.select({ id: stepVariants.id }).from(stepVariants).where(eq(stepVariants.stepId, stepId));
    if (existing.length) return { error: t("funnels.errors.splitRunning") };
    const [v] = await tx
      .insert(stepVariants)
      .values({ workspaceId: ctx.workspace.id, stepId, name: "B", draft: step.draft, weight: 50 })
      .returning({ id: stepVariants.id });
    return { id: v!.id, funnelId: step.funnelId };
  });
  if ("error" in res) return { ok: false, error: res.error! };
  await recordAudit(ctx, user.id, { action: "split_test.started", entityType: "step", entityId: stepId });
  revalidateFunnel(workspaceSlug, res.funnelId);
  return { ok: true, id: res.id };
}

export async function saveVariantDraft(
  workspaceSlug: string,
  variantId: string,
  data: unknown,
): Promise<Result & { savedAt?: string }> {
  const { ctx, t } = await ctxFor(workspaceSlug);
  const parsed = pageSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: t("funnels.errors.invalidPage") };
  if (JSON.stringify(parsed.data).length > MAX_PAGE_BYTES)
    return { ok: false, error: t("funnels.errors.pageTooLarge") };
  const now = new Date();
  await inWorkspace(ctx, (tx) =>
    tx
      .update(stepVariants)
      .set({ draft: parsed.data as never, draftUpdatedAt: now })
      .where(eq(stepVariants.id, variantId)),
  );
  return { ok: true, savedAt: now.toISOString() };
}

export async function publishVariant(
  workspaceSlug: string,
  variantId: string,
  data?: unknown,
): Promise<Result & { publishedAt?: string }> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  if (data !== undefined) {
    const saved = await saveVariantDraft(workspaceSlug, variantId, data);
    if (!saved.ok) return saved;
  }
  const now = new Date();
  const funnelId = await inWorkspace(ctx, async (tx) => {
    const [row] = await tx
      .select({ v: stepVariants, funnelId: funnelSteps.funnelId })
      .from(stepVariants)
      .innerJoin(funnelSteps, eq(funnelSteps.id, stepVariants.stepId))
      .where(eq(stepVariants.id, variantId));
    if (!row) throw new Error(t("funnels.errors.variantNotFound"));
    const [pv] = await tx
      .insert(pageVersions)
      .values({ workspaceId: ctx.workspace.id, stepId: row.v.stepId, data: row.v.draft, createdBy: user.id })
      .returning();
    await tx
      .update(stepVariants)
      .set({ publishedVersionId: pv!.id, publishedAt: now })
      .where(eq(stepVariants.id, variantId));
    return row.funnelId;
  });
  await recordAudit(ctx, user.id, {
    action: "split_test.variant_published",
    entityType: "variant",
    entityId: variantId,
  });
  revalidateFunnel(workspaceSlug, funnelId);
  return { ok: true, publishedAt: now.toISOString() };
}

export async function setVariantWeight(workspaceSlug: string, variantId: string, weight: number): Promise<Result> {
  const { ctx, t } = await ctxFor(workspaceSlug);
  const w = z.number().int().min(0).max(100).safeParse(weight);
  if (!w.success) return { ok: false, error: t("funnels.errors.splitRange") };
  await inWorkspace(ctx, (tx) => tx.update(stepVariants).set({ weight: w.data }).where(eq(stepVariants.id, variantId)));
  return { ok: true };
}

/** Ends the test. If the variant wins, it becomes the step's draft and live page. */
export async function endSplitTest(workspaceSlug: string, stepId: string, winner: "a" | string): Promise<Result> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  const funnelId = await inWorkspace(ctx, async (tx) => {
    const [step] = await tx.select().from(funnelSteps).where(eq(funnelSteps.id, stepId));
    if (!step) throw new Error(t("funnels.errors.stepNotFound"));
    if (winner !== "a") {
      const [v] = await tx
        .select()
        .from(stepVariants)
        .where(and(eq(stepVariants.id, winner), eq(stepVariants.stepId, stepId)));
      if (!v) throw new Error(t("funnels.errors.variantNotFound"));
      const now = new Date();
      await tx
        .update(funnelSteps)
        .set({
          draft: v.draft,
          draftUpdatedAt: now,
          ...(v.publishedVersionId ? { publishedVersionId: v.publishedVersionId, publishedAt: now } : {}),
        })
        .where(eq(funnelSteps.id, stepId));
    }
    await tx.delete(stepVariants).where(eq(stepVariants.stepId, stepId));
    return step.funnelId;
  });
  await recordAudit(ctx, user.id, {
    action: "split_test.ended",
    entityType: "step",
    entityId: stepId,
    data: { winner: winner === "a" ? "original" : "variant" },
  });
  revalidateFunnel(workspaceSlug, funnelId);
  return {
    ok: true,
    message: winner === "a" ? t("funnels.errors.keptOriginal") : t("funnels.errors.variantLive"),
  };
}

// ── Share funnels ────────────────────────────────────────────────────────────

export async function setFunnelSharing(
  workspaceSlug: string,
  funnelId: string,
  enabled: boolean,
): Promise<Result & { token?: string | null }> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const token = enabled ? randomBytes(18).toString("base64url") : null;
  await inWorkspace(ctx, (tx) => tx.update(funnels).set({ shareToken: token }).where(eq(funnels.id, funnelId)));
  await recordAudit(ctx, user.id, {
    action: enabled ? "funnel.share_enabled" : "funnel.share_disabled",
    entityType: "funnel",
    entityId: funnelId,
  });
  revalidatePath(`/${workspaceSlug}/funnels/${funnelId}`);
  return { ok: true, token };
}

/** Imports a full copy of a shared funnel into a workspace the user can manage. */
export async function importSharedFunnel(token: string, workspaceSlug: string): Promise<Result | void> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  const shared = await getSharedFunnel(token);
  if (!shared) return { ok: false, error: t("funnels.errors.shareInactive") };
  const blocked = await enforce(ctx.membership.organizationId, "funnels");
  if (blocked) return { ok: false, error: blocked };
  const f = await inWorkspace(ctx, async (tx) => {
    const taken = new Set([
      ...(await tx.select({ slug: funnels.slug }).from(funnels)).map((x) => x.slug),
      ...RESERVED_SLUGS,
    ]);
    const [n] = await tx
      .insert(funnels)
      .values({ workspaceId: ctx.workspace.id, name: shared.funnel.name, slug: uniqueSlug(shared.funnel.slug, taken) })
      .returning();
    await copySteps(tx, shared.steps, ctx.workspace.id, n!.id);
    return n!;
  });
  await recordAudit(ctx, user.id, {
    action: "funnel.imported",
    entityType: "funnel",
    entityId: f.id,
    data: { from: "share" },
  });
  revalidatePath(`/${workspaceSlug}/funnels`);
  redirect(`/${workspaceSlug}/funnels/${f.id}`);
}
