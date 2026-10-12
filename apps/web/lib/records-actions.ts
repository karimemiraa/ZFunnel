"use server";

import {
  and,
  broadcasts,
  contactActivities,
  contacts,
  emails,
  eq,
  formSubmissions,
  funnels,
  funnelSteps,
  inArray,
  isNotNull,
  isNull,
  orders,
  prices,
  products,
  savedViews,
  sql,
  workflowRuns,
  workflows,
  workspaces,
  withOrganization,
  getDb,
  type Tx,
  type WorkflowGraph,
} from "@zfunnel/db";
import { enqueue, enqueueMany } from "@zfunnel/queue";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { enforce } from "./billing";
import { matchingContactIds } from "./crm";
import { matchingOrderIds } from "./commerce";
import { inWorkspace } from "./funnels";
import { getT } from "./i18n";
import { cleanFilters, type ListFilters, type ListResource } from "./list-filters";
import { parseFormKey, usedIn, type UsedInItem, type UsedInKind } from "./records";
import { requireUser } from "./session";
import { canManage, getWorkspaceForUser, recordAudit, type WorkspaceContext } from "./workspaces";

type Fail = { ok: false; error: string };
export type ActionResult = { ok: true; message?: string; count?: number; id?: string } | Fail;

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error("Workspace not found");
  return { user, ctx, t: await getT() };
}

const uuid = z.string().uuid();
const MAX_IDS = 10_000;

// ---------- Soft delete & undo (ADR-026) ----------

export type TrashKind = "contact" | "funnel" | "step" | "product" | "form" | "workflow";

/** What undo needs to put back. Returned to the client by `trash` and handed to `restore`. */
export type UndoToken = { kind: TrashKind; ids: string[]; homeFunnelId?: string | null };

const MANAGERS_ONLY: TrashKind[] = ["contact", "funnel"];

function validIds(kind: TrashKind, ids: string[]) {
  const ok = kind === "form" ? ids.filter((k) => parseFormKey(k)) : ids.filter((i) => uuid.safeParse(i).success);
  return [...new Set(ok)].slice(0, MAX_IDS);
}

function revalidateKind(ws: string, kind: TrashKind) {
  const path = {
    contact: "contacts",
    funnel: "funnels",
    step: "funnels",
    product: "products",
    form: "forms",
    workflow: "automations",
  }[kind];
  revalidatePath(`/${ws}/${path}`, "layout");
  if (kind === "step" || kind === "funnel") revalidatePath(`/${ws}/funnels`, "layout");
}

/**
 * Soft-deletes records: they disappear everywhere at once and can be restored with `restore`
 * (the 10-second undo toast) until the worker purges them. Products and funnels use their
 * existing `archived_at` column; the others use `deleted_at` (ADR-026).
 */
export async function trash(
  workspaceSlug: string,
  kind: TrashKind,
  rawIds: string[],
): Promise<(ActionResult & { undo?: UndoToken }) | Fail> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  if (MANAGERS_ONLY.includes(kind) && !canManage(ctx.membership.role))
    return { ok: false, error: t("records.errors.onlyManagers") };
  const ids = validIds(kind, rawIds);
  if (!ids.length) return { ok: false, error: t("records.errors.nothingSelected") };
  const now = new Date();
  let homeFunnelId: string | null = null;
  const done = await inWorkspace(ctx, async (tx) => {
    switch (kind) {
      case "contact":
        return (
          await tx
            .update(contacts)
            .set({ deletedAt: now })
            .where(and(inArray(contacts.id, ids), isNull(contacts.deletedAt)))
            .returning({ id: contacts.id })
        ).map((r) => r.id);
      case "funnel":
        return (
          await tx
            .update(funnels)
            .set({ archivedAt: now })
            .where(and(inArray(funnels.id, ids), isNull(funnels.archivedAt)))
            .returning({ id: funnels.id })
        ).map((r) => r.id);
      case "product":
        // Step offers stay: checkout and the editor skip archived products, so undo brings them back intact.
        return (
          await tx
            .update(products)
            .set({ archivedAt: now })
            .where(and(inArray(products.id, ids), isNull(products.archivedAt)))
            .returning({ id: products.id })
        ).map((r) => r.id);
      case "workflow":
        return (
          await tx
            .update(workflows)
            .set({ deletedAt: now })
            .where(and(inArray(workflows.id, ids), isNull(workflows.deletedAt)))
            .returning({ id: workflows.id })
        ).map((r) => r.id);
      case "form": {
        const out: string[] = [];
        for (const key of ids) {
          const f = parseFormKey(key)!;
          const rows = await tx
            .update(formSubmissions)
            .set({ deletedAt: now })
            .where(
              and(
                eq(formSubmissions.stepId, f.stepId),
                eq(formSubmissions.blockId, f.blockId),
                isNull(formSubmissions.deletedAt),
              ),
            )
            .returning({ id: formSubmissions.id });
          if (rows.length) out.push(key);
        }
        return out;
      }
      case "step": {
        const out: string[] = [];
        for (const id of ids) if (await trashStep(tx, id, now)) out.push(id);
        return out;
      }
    }
  });
  if (kind === "funnel" && done.length) {
    homeFunnelId = done.includes(ctx.workspace.homeFunnelId ?? "") ? ctx.workspace.homeFunnelId : null;
    if (homeFunnelId) await setHome(ctx, null);
  }
  await recordAudit(ctx, user.id, {
    action: `${kind}.deleted`,
    entityType: kind,
    entityId: done.length === 1 ? done[0] : undefined,
    data: { ids: done.slice(0, 100), count: done.length, soft: true },
  });
  revalidateKind(workspaceSlug, kind);
  return {
    ok: true,
    count: done.length,
    message: t("records.deletedCount", { count: done.length }),
    undo: { kind, ids: done, homeFunnelId },
  };
}

/** Deletes one step and heals the flow around it, remembering what it re-pointed. */
async function trashStep(tx: Tx, stepId: string, now: Date) {
  const [step] = await tx
    .select()
    .from(funnelSteps)
    .where(and(eq(funnelSteps.id, stepId), isNull(funnelSteps.deletedAt)));
  if (!step) return false;
  const next = await tx
    .update(funnelSteps)
    .set({ nextStepId: step.nextStepId })
    .where(and(eq(funnelSteps.funnelId, step.funnelId), eq(funnelSteps.nextStepId, stepId)))
    .returning({ id: funnelSteps.id });
  const decline = await tx
    .update(funnelSteps)
    .set({ declineStepId: step.nextStepId })
    .where(and(eq(funnelSteps.funnelId, step.funnelId), eq(funnelSteps.declineStepId, stepId)))
    .returning({ id: funnelSteps.id });
  await tx
    .update(funnelSteps)
    .set({ deletedAt: now, deletedLinks: { next: next.map((r) => r.id), decline: decline.map((r) => r.id) } })
    .where(eq(funnelSteps.id, stepId));
  return true;
}

async function setHome(ctx: WorkspaceContext, homeId: string | null) {
  await withOrganization(getDb(), ctx.membership.organizationId, (tx) =>
    tx.update(workspaces).set({ homeFunnelId: homeId }).where(eq(workspaces.id, ctx.workspace.id)),
  );
}

/** Puts back what `trash` removed (the undo button). */
export async function restore(workspaceSlug: string, token: UndoToken): Promise<ActionResult> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  const kind = token.kind;
  if (MANAGERS_ONLY.includes(kind) && !canManage(ctx.membership.role))
    return { ok: false, error: t("records.errors.onlyManagers") };
  const ids = validIds(kind, token.ids ?? []);
  if (!ids.length) return { ok: false, error: t("records.errors.nothingSelected") };
  if (kind === "funnel") {
    const blocked = await enforce(ctx.membership.organizationId, "funnels", ids.length);
    if (blocked) return { ok: false, error: blocked };
  }
  if (kind === "contact") {
    const blocked = await enforce(ctx.membership.organizationId, "contacts", ids.length);
    if (blocked) return { ok: false, error: blocked };
  }
  const { restored, runIds } = await inWorkspace(ctx, async (tx) => {
    let restored: string[] = [];
    let runIds: string[] = [];
    switch (kind) {
      case "contact":
        restored = (
          await tx
            .update(contacts)
            .set({ deletedAt: null })
            .where(and(inArray(contacts.id, ids), isNotNull(contacts.deletedAt)))
            .returning({ id: contacts.id })
        ).map((r) => r.id);
        if (restored.length) runIds = await heldRuns(tx, inArray(workflowRuns.contactId, restored));
        break;
      case "funnel":
        restored = (
          await tx
            .update(funnels)
            .set({ archivedAt: null })
            .where(and(inArray(funnels.id, ids), isNotNull(funnels.archivedAt)))
            .returning({ id: funnels.id })
        ).map((r) => r.id);
        break;
      case "product":
        restored = (
          await tx
            .update(products)
            .set({ archivedAt: null })
            .where(and(inArray(products.id, ids), isNotNull(products.archivedAt)))
            .returning({ id: products.id })
        ).map((r) => r.id);
        break;
      case "workflow":
        restored = (
          await tx
            .update(workflows)
            .set({ deletedAt: null })
            .where(and(inArray(workflows.id, ids), isNotNull(workflows.deletedAt)))
            .returning({ id: workflows.id })
        ).map((r) => r.id);
        if (restored.length) runIds = await heldRuns(tx, inArray(workflowRuns.workflowId, restored));
        break;
      case "form":
        for (const key of ids) {
          const f = parseFormKey(key)!;
          const rows = await tx
            .update(formSubmissions)
            .set({ deletedAt: null })
            .where(
              and(
                eq(formSubmissions.stepId, f.stepId),
                eq(formSubmissions.blockId, f.blockId),
                isNotNull(formSubmissions.deletedAt),
              ),
            )
            .returning({ id: formSubmissions.id });
          if (rows.length) restored.push(key);
        }
        break;
      case "step":
        for (const id of ids) if (await restoreStep(tx, id)) restored.push(id);
        break;
    }
    return { restored, runIds };
  });
  if (kind === "funnel" && token.homeFunnelId && restored.includes(token.homeFunnelId))
    await setHome(ctx, token.homeFunnelId);
  // Runs held while their contact or automation was deleted pick up where they stopped.
  for (const runId of runIds)
    await enqueue("workflow-runs", { runId }, { jobId: `run-${runId}-restore-${Date.now()}` });
  await recordAudit(ctx, user.id, {
    action: `${kind}.restored`,
    entityType: kind,
    entityId: restored.length === 1 ? restored[0] : undefined,
    data: { ids: restored.slice(0, 100), count: restored.length },
  });
  revalidateKind(workspaceSlug, kind);
  return { ok: true, count: restored.length, message: t("records.restoredCount", { count: restored.length }) };
}

async function heldRuns(tx: Tx, where: ReturnType<typeof inArray>) {
  const rows = await tx
    .select({ id: workflowRuns.id })
    .from(workflowRuns)
    .where(and(where, inArray(workflowRuns.status, ["active", "waiting"])));
  return rows.map((r) => r.id);
}

async function restoreStep(tx: Tx, stepId: string) {
  const [step] = await tx
    .select()
    .from(funnelSteps)
    .where(and(eq(funnelSteps.id, stepId), isNotNull(funnelSteps.deletedAt)));
  if (!step) return false;
  const links = step.deletedLinks ?? { next: [], decline: [] };
  // Only re-point links nobody has changed since the delete.
  if (links.next.length)
    await tx
      .update(funnelSteps)
      .set({ nextStepId: stepId })
      .where(
        and(
          inArray(funnelSteps.id, links.next),
          step.nextStepId ? eq(funnelSteps.nextStepId, step.nextStepId) : isNull(funnelSteps.nextStepId),
        ),
      );
  if (links.decline.length)
    await tx
      .update(funnelSteps)
      .set({ declineStepId: stepId })
      .where(
        and(
          inArray(funnelSteps.id, links.decline),
          step.nextStepId ? eq(funnelSteps.declineStepId, step.nextStepId) : isNull(funnelSteps.declineStepId),
        ),
      );
  await tx.update(funnelSteps).set({ deletedAt: null, deletedLinks: null }).where(eq(funnelSteps.id, stepId));
  return true;
}

// ---------- "Used in" ----------

export async function getUsedIn(workspaceSlug: string, kind: UsedInKind, id: string): Promise<UsedInItem[]> {
  const { ctx } = await ctxFor(workspaceSlug);
  return usedIn(ctx, kind, id);
}

// ---------- Bulk actions (8.5c) ----------

/** Which rows a bulk action covers: picked ids, or every row matching the list's filters. */
export type Selection =
  { mode: "ids"; ids: string[] } | { mode: "all"; filters: ListFilters; segmentId?: string | null };

export type BulkAction =
  | { type: "tag"; tag: string }
  | { type: "untag"; tag: string }
  | { type: "enroll"; workflowId: string }
  | { type: "delete" };

async function resolveSelection(ctx: WorkspaceContext, resource: ListResource, sel: Selection) {
  if (sel.mode === "ids") return sel.ids.filter((i) => uuid.safeParse(i).success).slice(0, MAX_IDS);
  const filters = cleanFilters(resource, sel.filters as Record<string, unknown>);
  return resource === "contacts"
    ? matchingContactIds(ctx, filters, sel.segmentId ?? undefined, MAX_IDS)
    : matchingOrderIds(ctx, filters, MAX_IDS);
}

const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(40)
  .regex(/^[\p{L}\p{N} _-]+$/u);

/** Bulk action on contacts, or on the buyers of the selected orders. */
export async function bulkAction(
  workspaceSlug: string,
  resource: ListResource,
  selection: Selection,
  action: BulkAction,
): Promise<ActionResult & { undo?: UndoToken }> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  const ids = await resolveSelection(ctx, resource, selection);
  if (!ids.length) return { ok: false, error: t("records.errors.nothingSelected") };
  if (action.type === "delete") {
    // Orders are financial records: they are never deleted from the dashboard.
    if (resource !== "contacts") return { ok: false, error: t("records.errors.cantDeleteOrders") };
    return trash(workspaceSlug, "contact", ids);
  }
  const contactIds =
    resource === "contacts"
      ? ids
      : await inWorkspace(ctx, async (tx) =>
          (
            await tx
              .selectDistinct({ id: orders.contactId })
              .from(orders)
              .innerJoin(contacts, and(eq(contacts.id, orders.contactId), isNull(contacts.deletedAt)))
              .where(inArray(orders.id, ids))
          ).flatMap((r) => (r.id ? [r.id] : [])),
        );
  if (!contactIds.length) return { ok: false, error: t("records.errors.noContacts") };

  if (action.type === "tag" || action.type === "untag") {
    const tag = tagSchema.safeParse(action.tag);
    if (!tag.success) return { ok: false, error: t("records.errors.badTag") };
    const add = action.type === "tag";
    const changed = await inWorkspace(ctx, async (tx) => {
      const rows = await tx
        .update(contacts)
        .set({
          tags: add
            ? sql`array_append(${contacts.tags}, ${tag.data}::text)`
            : sql`array_remove(${contacts.tags}, ${tag.data}::text)`,
        })
        .where(
          and(
            inArray(contacts.id, contactIds),
            isNull(contacts.deletedAt),
            add ? sql`not (${tag.data} = any(${contacts.tags}))` : sql`${tag.data} = any(${contacts.tags})`,
          ),
        )
        .returning({ id: contacts.id });
      for (let i = 0; i < rows.length; i += 1000)
        await tx.insert(contactActivities).values(
          rows.slice(i, i + 1000).map((r) => ({
            workspaceId: ctx.workspace.id,
            contactId: r.id,
            type: add ? ("tag_added" as const) : ("tag_removed" as const),
            body: tag.data,
            actorUserId: user.id,
          })),
        );
      return rows.map((r) => r.id);
    });
    if (add && changed.length)
      await enqueueMany(
        "workflow-events",
        changed.map((contactId) => ({
          workspaceId: ctx.workspace.id,
          contactId,
          type: "tag_added" as const,
          data: { tag: tag.data },
        })),
      );
    await recordAudit(ctx, user.id, {
      action: add ? "contacts.bulk_tagged" : "contacts.bulk_untagged",
      entityType: "contact",
      data: { tag: tag.data, count: changed.length, via: resource },
    });
    revalidatePath(`/${workspaceSlug}/contacts`, "layout");
    revalidatePath(`/${workspaceSlug}/orders`, "layout");
    return {
      ok: true,
      count: changed.length,
      message: t(add ? "records.bulk.tagged" : "records.bulk.untagged", { count: changed.length, tag: tag.data }),
    };
  }

  // enroll
  if (!uuid.safeParse(action.workflowId).success) return { ok: false, error: t("records.errors.badAutomation") };
  const [w] = await inWorkspace(ctx, (tx) =>
    tx
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, action.workflowId), isNull(workflows.deletedAt))),
  );
  if (!w || w.status !== "active") return { ok: false, error: t("records.errors.automationNotLive") };
  const ok = await enqueueMany(
    "workflow-events",
    contactIds.map((contactId) => ({
      workspaceId: ctx.workspace.id,
      contactId,
      type: "manual" as const,
      data: { workflowId: w.id, by: user.id },
    })),
  );
  if (!ok) return { ok: false, error: t("records.errors.queueDown") };
  await recordAudit(ctx, user.id, {
    action: "contacts.bulk_enrolled",
    entityType: "workflow",
    entityId: w.id,
    data: { count: contactIds.length, via: resource },
  });
  return {
    ok: true,
    count: contactIds.length,
    message: t("records.bulk.enrolled", { count: contactIds.length, name: w.name }),
  };
}

// ---------- Saved views (8.5d) ----------

export async function saveView(
  workspaceSlug: string,
  resource: ListResource,
  name: string,
  filters: ListFilters,
): Promise<ActionResult> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  const n = name.trim().slice(0, 60);
  if (!n) return { ok: false, error: t("records.errors.viewName") };
  if (resource !== "contacts" && resource !== "orders") return { ok: false, error: t("records.errors.viewName") };
  const clean = cleanFilters(resource, filters as Record<string, unknown>);
  const id = await inWorkspace(ctx, async (tx) => {
    const [{ count }] = (await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(savedViews)
      .where(eq(savedViews.resource, resource))) as [{ count: number }];
    if (count >= 50) return null;
    const [v] = await tx
      .insert(savedViews)
      .values({ workspaceId: ctx.workspace.id, resource, name: n, filters: clean, createdBy: user.id })
      .returning({ id: savedViews.id });
    return v!.id;
  });
  if (!id) return { ok: false, error: t("records.errors.tooManyViews") };
  revalidatePath(`/${workspaceSlug}/${resource}`);
  return { ok: true, id, message: t("records.views.saved", { name: n }) };
}

export async function deleteView(workspaceSlug: string, viewId: string): Promise<ActionResult> {
  const { ctx, t } = await ctxFor(workspaceSlug);
  if (!uuid.safeParse(viewId).success) return { ok: false, error: t("records.errors.nothingSelected") };
  const [v] = await inWorkspace(ctx, (tx) =>
    tx.delete(savedViews).where(eq(savedViews.id, viewId)).returning({ resource: savedViews.resource }),
  );
  if (v) revalidatePath(`/${workspaceSlug}/${v.resource}`);
  return { ok: true, message: t("records.views.deleted") };
}

// ---------- Duplicate (8.5f) ----------

/** Copies a product and its current prices. Stripe ids are not copied: prices are mirrored again on first sale. */
export async function duplicateProduct(workspaceSlug: string, productId: string): Promise<ActionResult> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  if (!uuid.safeParse(productId).success) return { ok: false, error: t("records.errors.notFound") };
  const id = await inWorkspace(ctx, async (tx) => {
    const [p] = await tx.select().from(products).where(eq(products.id, productId));
    if (!p) return null;
    const [copy] = await tx
      .insert(products)
      .values({
        workspaceId: ctx.workspace.id,
        name: t("records.copyName", { name: p.name }).slice(0, 120),
        description: p.description,
        imageUrl: p.imageUrl,
        // A copy starts hidden from the store, so a half-edited duplicate is never on sale.
        inStore: false,
        stock: p.stock,
        requiresShipping: p.requiresShipping,
      })
      .returning({ id: products.id });
    const live = await tx
      .select()
      .from(prices)
      .where(and(eq(prices.productId, p.id), isNull(prices.archivedAt)));
    if (live.length)
      await tx.insert(prices).values(
        live.map((pr) => ({
          workspaceId: ctx.workspace.id,
          productId: copy!.id,
          label: pr.label,
          type: pr.type,
          amount: pr.amount,
          currency: pr.currency,
          interval: pr.interval,
          trialDays: pr.trialDays,
          installments: pr.installments,
          stripeProductId: null,
          stripePriceId: null,
        })),
      );
    return copy!.id;
  });
  if (!id) return { ok: false, error: t("records.errors.notFound") };
  await recordAudit(ctx, user.id, {
    action: "product.duplicated",
    entityType: "product",
    entityId: id,
    data: { from: productId },
  });
  revalidatePath(`/${workspaceSlug}/products`, "layout");
  return { ok: true, id, message: t("records.duplicated") };
}

/** Copies a broadcast's email design into a new draft broadcast with the same audience. */
export async function duplicateBroadcast(workspaceSlug: string, broadcastId: string): Promise<ActionResult> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  if (!uuid.safeParse(broadcastId).success) return { ok: false, error: t("records.errors.notFound") };
  const id = await inWorkspace(ctx, async (tx) => {
    const [b] = await tx.select().from(broadcasts).where(eq(broadcasts.id, broadcastId));
    if (!b) return null;
    const [e] = await tx.select().from(emails).where(eq(emails.id, b.emailId));
    if (!e) return null;
    const [ne] = await tx
      .insert(emails)
      .values({
        workspaceId: ctx.workspace.id,
        name: t("records.copyName", { name: e.name }).slice(0, 120),
        subject: e.subject,
        preheader: e.preheader,
        content: e.content,
        kind: e.kind,
      })
      .returning({ id: emails.id });
    const [nb] = await tx
      .insert(broadcasts)
      .values({ workspaceId: ctx.workspace.id, emailId: ne!.id, segmentId: b.segmentId, tag: b.tag })
      .returning({ id: broadcasts.id });
    return nb!.id;
  });
  if (!id) return { ok: false, error: t("records.errors.notFound") };
  await recordAudit(ctx, user.id, {
    action: "broadcast.duplicated",
    entityType: "broadcast",
    entityId: id,
    data: { from: broadcastId },
  });
  revalidatePath(`/${workspaceSlug}/email`, "layout");
  return { ok: true, id, message: t("records.duplicated") };
}

/**
 * Copies an automation as a draft (never live). Its automation emails are copied too, so
 * editing the copy's emails can't change the original's.
 */
export async function duplicateWorkflow(workspaceSlug: string, workflowId: string): Promise<ActionResult> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  if (!uuid.safeParse(workflowId).success) return { ok: false, error: t("records.errors.notFound") };
  const id = await inWorkspace(ctx, async (tx) => {
    const [w] = await tx
      .select()
      .from(workflows)
      .where(and(eq(workflows.id, workflowId), isNull(workflows.deletedAt)));
    if (!w) return null;
    const emailIds = [
      ...new Set(
        Object.values(w.graph.nodes).flatMap((n) => (n.type === "send_email" && n.emailId ? [n.emailId] : [])),
      ),
    ];
    const owned = emailIds.length
      ? await tx
          .select()
          .from(emails)
          .where(and(inArray(emails.id, emailIds), eq(emails.kind, "automation")))
      : [];
    const map = new Map<string, string>();
    for (const e of owned) {
      const [ne] = await tx
        .insert(emails)
        .values({
          workspaceId: ctx.workspace.id,
          name: e.name,
          subject: e.subject,
          preheader: e.preheader,
          content: e.content,
          kind: "automation",
        })
        .returning({ id: emails.id });
      map.set(e.id, ne!.id);
    }
    const graph: WorkflowGraph = {
      start: w.graph.start,
      nodes: Object.fromEntries(
        Object.entries(w.graph.nodes).map(([k, n]) => [
          k,
          n.type === "send_email" && n.emailId ? { ...n, emailId: map.get(n.emailId) ?? n.emailId } : n,
        ]),
      ),
    };
    const [copy] = await tx
      .insert(workflows)
      .values({
        workspaceId: ctx.workspace.id,
        name: t("records.copyName", { name: w.name }).slice(0, 120),
        status: "draft",
        trigger: w.trigger,
        graph,
        allowReentry: w.allowReentry,
      })
      .returning({ id: workflows.id });
    return copy!.id;
  });
  if (!id) return { ok: false, error: t("records.errors.notFound") };
  await recordAudit(ctx, user.id, {
    action: "automation.duplicated",
    entityType: "workflow",
    entityId: id,
    data: { from: workflowId },
  });
  revalidatePath(`/${workspaceSlug}/automations`, "layout");
  return { ok: true, id, message: t("records.duplicated") };
}
