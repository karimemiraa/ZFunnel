"use server";

import { starterPage, TEMPLATES } from "@zfunnel/blocks";
import {
  and,
  eq,
  funnels,
  inArray,
  type Tx,
  funnelSteps,
  getDb,
  pageVersions,
  STEP_TYPES,
  withOrganization,
  workspaces,
} from "@zfunnel/db";
import { slugSchema } from "@zfunnel/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createFunnelWithSteps, FUNNEL_PRESETS, inWorkspace, uniqueSlug, type FunnelPreset } from "./funnels";
import { requireUser } from "./session";
import { canManage, getWorkspaceForUser, recordAudit, type WorkspaceContext } from "./workspaces";

export type FormState = { error?: string; success?: string; fieldErrors?: Record<string, string[] | undefined> } | null;
type Result = { ok: true } | { ok: false; error: string };

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error("Workspace not found");
  return { user, ctx };
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
  name: z.string().trim().min(2, "At least 2 characters").max(80),
  source: z.union([
    z.object({ preset: z.enum(Object.keys(FUNNEL_PRESETS) as [FunnelPreset, ...FunnelPreset[]]) }),
    z.object({ template: z.enum(TEMPLATES.map((t) => t.id) as [string, ...string[]]) }),
  ]),
});

export async function createFunnel(workspaceSlug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const choice = String(formData.get("source") ?? "");
  const parsed = createFunnelSchema.safeParse({
    name: formData.get("name"),
    source: choice.startsWith("template:") ? { template: choice.slice(9) } : { preset: choice.replace(/^preset:/, "") },
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const funnel = await createFunnelWithSteps(ctx, parsed.data.name, parsed.data.source);
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
  const { user, ctx } = await ctxFor(workspaceSlug);
  const parsed = funnelSettingsSchema.safeParse({ name: formData.get("name"), slug: formData.get("slug") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  try {
    await inWorkspace(ctx, (tx) => tx.update(funnels).set(parsed.data).where(eq(funnels.id, funnelId)));
  } catch {
    return { fieldErrors: { slug: ["Another funnel already uses this URL."] } };
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
  return { success: "Saved." };
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
  const { user, ctx } = await ctxFor(workspaceSlug);
  if (!canManage(ctx.membership.role)) throw new Error("Only owners and admins can delete funnels.");
  await inWorkspace(ctx, (tx) => tx.update(funnels).set({ archivedAt: new Date() }).where(eq(funnels.id, funnelId)));
  await setHomeFunnelInternal(ctx, null, funnelId);
  await recordAudit(ctx, user.id, { action: "funnel.deleted", entityType: "funnel", entityId: funnelId });
  revalidatePath(`/${workspaceSlug}/funnels`);
  redirect(`/${workspaceSlug}/funnels`);
}

export async function duplicateFunnel(workspaceSlug: string, funnelId: string) {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const copy = await inWorkspace(ctx, async (tx) => {
    const [src] = await tx.select().from(funnels).where(eq(funnels.id, funnelId));
    if (!src) throw new Error("Funnel not found");
    const taken = new Set((await tx.select({ slug: funnels.slug }).from(funnels)).map((f) => f.slug));
    const [f] = await tx
      .insert(funnels)
      .values({
        workspaceId: ctx.workspace.id,
        name: `${src.name} (copy)`,
        slug: uniqueSlug(`${src.slug}-copy`, taken),
      })
      .returning();
    const steps = await tx.select().from(funnelSteps).where(eq(funnelSteps.funnelId, funnelId));
    const idMap = new Map<string, string>();
    for (const s of steps) {
      const [n] = await tx
        .insert(funnelSteps)
        .values({
          workspaceId: ctx.workspace.id,
          funnelId: f!.id,
          name: s.name,
          type: s.type,
          slug: s.slug,
          position: s.position,
          mapX: s.mapX,
          mapY: s.mapY,
          draft: s.draft,
        })
        .returning({ id: funnelSteps.id });
      idMap.set(s.id, n!.id);
    }
    for (const s of steps)
      await tx
        .update(funnelSteps)
        .set({
          nextStepId: s.nextStepId ? (idMap.get(s.nextStepId) ?? null) : null,
          declineStepId: s.declineStepId ? (idMap.get(s.declineStepId) ?? null) : null,
        })
        .where(eq(funnelSteps.id, idMap.get(s.id)!));
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
  const { ctx } = await ctxFor(workspaceSlug);
  const parsed = addStepSchema.safeParse({ name: formData.get("name"), type: formData.get("type") });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
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
        draft: starterPage(parsed.data.type, parsed.data.name),
      })
      .returning();
    // Append to the flow: the previous final step now continues here.
    if (last && !last.nextStepId)
      await tx.update(funnelSteps).set({ nextStepId: created!.id }).where(eq(funnelSteps.id, last.id));
  });
  revalidateFunnel(workspaceSlug, funnelId);
  return { success: "Step added." };
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
  const { ctx } = await ctxFor(workspaceSlug);
  const parsed = stepSettingsSchema.safeParse(
    Object.fromEntries(["name", "slug", "type", "nextStepId", "declineStepId"].map((k) => [k, formData.get(k) ?? ""])),
  );
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const { nextStepId, declineStepId, ...rest } = parsed.data;
  if (nextStepId === stepId || declineStepId === stepId) return { error: "A step can't link to itself." };
  let funnelId = "";
  try {
    const bad = await inWorkspace(ctx, async (tx) => {
      const [current] = await tx
        .select({ funnelId: funnelSteps.funnelId })
        .from(funnelSteps)
        .where(eq(funnelSteps.id, stepId));
      if (!current) return "Step not found.";
      if (!(await stepsInFunnel(tx, current.funnelId, [nextStepId, declineStepId])))
        return "Links must point to steps in this funnel.";
      funnelId = current.funnelId;
      await tx
        .update(funnelSteps)
        .set({ ...rest, nextStepId: nextStepId || null, declineStepId: declineStepId || null })
        .where(eq(funnelSteps.id, stepId));
      return null;
    });
    if (bad) return { error: bad };
  } catch {
    return { fieldErrors: { slug: ["Another step in this funnel already uses this URL."] } };
  }
  revalidateFunnel(workspaceSlug, funnelId);
  return { success: "Saved." };
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
  const { ctx } = await ctxFor(workspaceSlug);
  if (!orderedIds.every((id) => uuid.safeParse(id).success)) return { ok: false, error: "Invalid steps" };
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
  const { ctx } = await ctxFor(workspaceSlug);
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
      name: `${s.name} (copy)`,
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
  const { ctx } = await ctxFor(workspaceSlug);
  if (!uuid.safeParse(sourceId).success || (targetId && !uuid.safeParse(targetId).success))
    return { ok: false, error: "Invalid step" };
  if (sourceId === targetId) return { ok: false, error: "A step can't link to itself." };
  const ok = await inWorkspace(ctx, async (tx) => {
    if (!(await stepsInFunnel(tx, funnelId, [sourceId, targetId ?? ""]))) return false;
    await tx
      .update(funnelSteps)
      .set(kind === "next" ? { nextStepId: targetId } : { declineStepId: targetId })
      .where(and(eq(funnelSteps.id, sourceId), eq(funnelSteps.funnelId, funnelId)));
    return true;
  });
  if (!ok) return { ok: false, error: "Steps must belong to this funnel." };
  revalidateFunnel(workspaceSlug, funnelId);
  return { ok: true };
}

// ---------- Editor ----------

export async function saveDraft(
  workspaceSlug: string,
  stepId: string,
  data: unknown,
): Promise<Result & { savedAt?: string }> {
  const { ctx } = await ctxFor(workspaceSlug);
  const parsed = pageSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "This page data is invalid." };
  if (JSON.stringify(parsed.data).length > MAX_PAGE_BYTES)
    return { ok: false, error: "This page is too large (2 MB max). Remove some content." };
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
  const { user, ctx } = await ctxFor(workspaceSlug);
  if (data !== undefined) {
    const saved = await saveDraft(workspaceSlug, stepId, data);
    if (!saved.ok) return saved;
  }
  const now = new Date();
  const funnelId = await inWorkspace(ctx, async (tx) => {
    const [step] = await tx.select().from(funnelSteps).where(eq(funnelSteps.id, stepId));
    if (!step) throw new Error("Step not found");
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
