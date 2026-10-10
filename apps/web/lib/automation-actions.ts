"use server";

import {
  emails,
  emailSettings,
  eq,
  workflowRuns,
  workflows,
  and,
  inArray,
  type WorkflowGraph,
  type WorkflowNode,
  type WorkflowTrigger,
} from "@zfunnel/db";
import { enqueue } from "@zfunnel/queue";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { enforce } from "./billing";
import { localizedStarterEmail } from "./email";
import { getTranslator, type T } from "@zfunnel/i18n";
import { inWorkspace } from "./funnels";
import { getT, localizeMessage } from "./i18n";
import { ruleSchema } from "./rule-schema";
import { requireUser } from "./session";
import { validateGraph } from "./workflow-graph";
import { getWorkspaceForUser, recordAudit } from "./workspaces";

type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error("Workspace not found");
  return { user, ctx };
}

const uuid = z.string().uuid();
/** Trigger schema messages are i18n keys; zod's own messages fall back to "Invalid input". */
const triggerError = (t: T, msg: string | undefined) =>
  msg?.startsWith("automations.") ? localizeMessage(t, msg)! : t("automations.actions.invalidInput");
const triggerSchema: z.ZodType<WorkflowTrigger> = z.union([
  z.object({ type: z.literal("optin"), funnelId: uuid.nullish() }),
  z.object({ type: z.literal("purchase"), productId: uuid.nullish() }),
  z.object({ type: z.literal("tag_added"), tag: z.string().trim().min(1, "automations.actions.chooseTag").max(40) }),
  z.object({ type: z.literal("form_submitted"), funnelId: uuid.nullish() }),
  z.object({ type: z.literal("booked"), calendarId: uuid.nullish() }),
  z.object({ type: z.enum(["webinar_registered", "webinar_attended"]), webinarId: uuid.nullish() }),
  z.object({ type: z.literal("manual") }),
]);

const id = z.string().regex(/^n_[a-z0-9]{4,16}$/);
const ref = id.nullish();
const nodeSchema: z.ZodType<WorkflowNode> = z.union([
  z.object({ id, type: z.literal("send_email"), emailId: uuid.nullable(), next: ref }),
  z.object({
    id,
    type: z.literal("wait"),
    amount: z.number().int().min(1).max(365),
    unit: z.enum(["minutes", "hours", "days"]),
    next: ref,
  }),
  z.object({ id, type: z.enum(["add_tag", "remove_tag"]), tag: z.string().trim().max(40), next: ref }),
  z.object({ id, type: z.literal("condition"), rule: ruleSchema.nullable(), yes: ref, no: ref }),
  z.object({ id, type: z.literal("webhook"), url: z.string().trim().max(500), next: ref }),
  z.object({ id, type: z.literal("grant_course"), courseId: uuid.nullable(), next: ref }),
  z.object({ id, type: z.literal("send_sms"), message: z.string().max(1600), next: ref }),
]);
const graphSchema = z.object({ start: ref.transform((v) => v ?? null), nodes: z.record(z.string(), nodeSchema) });

/** Starter emails per recipe; their copy is written in the workspace's site language. */
const RECIPES = {
  blank: { trigger: null, emails: [] as const },
  welcome: { trigger: { type: "optin" } as WorkflowTrigger, emails: ["welcome", "followUp"] as const },
  customer: { trigger: { type: "purchase" } as WorkflowTrigger, emails: ["thanks"] as const },
} as const;
export type Recipe = keyof typeof RECIPES;

/** Builds the starter steps for a recipe (emails are created by the caller). */
function recipeGraph(recipe: Recipe, emailIds: string[]): WorkflowGraph {
  if (recipe === "welcome")
    return {
      start: "n_welcome1",
      nodes: {
        n_welcome1: { id: "n_welcome1", type: "send_email", emailId: emailIds[0]!, next: "n_wait1" },
        n_wait1: { id: "n_wait1", type: "wait", amount: 2, unit: "days", next: "n_welcome2" },
        n_welcome2: { id: "n_welcome2", type: "send_email", emailId: emailIds[1]!, next: null },
      },
    };
  if (recipe === "customer")
    return {
      start: "n_tag1",
      nodes: {
        n_tag1: { id: "n_tag1", type: "add_tag", tag: "customer", next: "n_thanks" },
        n_thanks: { id: "n_thanks", type: "send_email", emailId: emailIds[0]!, next: null },
      },
    };
  return { start: null, nodes: {} };
}

export async function createWorkflow(
  workspaceSlug: string,
  input: { name: string; trigger: unknown; recipe?: Recipe },
): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const t = await getT();
  const name = z.string().trim().min(1).max(80).safeParse(input.name);
  if (!name.success) return { ok: false, error: t("automations.actions.nameRequired") };
  const trigger = triggerSchema.safeParse(input.trigger);
  if (!trigger.success) return { ok: false, error: triggerError(t, trigger.error.issues[0]?.message) };
  const site = getTranslator(ctx.workspace.siteLocale);
  const recipe: Recipe = input.recipe && input.recipe in RECIPES ? input.recipe : "blank";
  const [w] = await inWorkspace(ctx, async (tx) => {
    const ids: string[] = [];
    for (const key of RECIPES[recipe].emails) {
      const [row] = await tx
        .insert(emails)
        .values({
          workspaceId: ctx.workspace.id,
          name: site(`automations.recipes.${key}.name`),
          subject: site(`automations.recipes.${key}.subject`),
          preheader: site(`automations.recipes.${key}.preheader`),
          content: localizedStarterEmail(ctx.workspace.siteLocale) as never,
          kind: "automation",
        })
        .returning({ id: emails.id });
      ids.push(row!.id);
    }
    return tx
      .insert(workflows)
      .values({
        workspaceId: ctx.workspace.id,
        name: name.data,
        trigger: trigger.data,
        graph: recipeGraph(recipe, ids),
      })
      .returning();
  });
  await recordAudit(ctx, user.id, { action: "automation.created", entityType: "workflow", entityId: w!.id });
  revalidatePath(`/${workspaceSlug}/automations`);
  return { ok: true, id: w!.id };
}

export async function saveWorkflow(
  workspaceSlug: string,
  workflowId: string,
  input: { name?: string; trigger?: unknown; graph?: unknown; allowReentry?: boolean },
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const t = await getT();
  const set: Partial<typeof workflows.$inferInsert> = {};
  if (input.name !== undefined) {
    const n = z.string().trim().min(1).max(80).safeParse(input.name);
    if (!n.success) return { ok: false, error: t("automations.actions.nameRequired") };
    set.name = n.data;
  }
  if (input.trigger !== undefined) {
    const tr = triggerSchema.safeParse(input.trigger);
    if (!tr.success) return { ok: false, error: triggerError(t, tr.error.issues[0]?.message) };
    set.trigger = tr.data;
  }
  if (input.graph !== undefined) {
    const g = graphSchema.safeParse(input.graph);
    if (!g.success) return { ok: false, error: t("automations.actions.invalidStep") };
    const err = validateGraph(g.data as WorkflowGraph, t);
    if (err) return { ok: false, error: err };
    set.graph = g.data as WorkflowGraph;
  }
  if (input.allowReentry !== undefined) set.allowReentry = Boolean(input.allowReentry);
  const [w] = await inWorkspace(ctx, (tx) =>
    tx.update(workflows).set(set).where(eq(workflows.id, workflowId)).returning({ id: workflows.id }),
  );
  if (!w) return { ok: false, error: t("automations.actions.notFound") };
  return { ok: true };
}

export async function setWorkflowStatus(
  workspaceSlug: string,
  workflowId: string,
  status: "active" | "paused",
): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const t = await getT();
  if (status === "active") {
    const blocked = await enforce(ctx.membership.organizationId, "automations");
    if (blocked) return { ok: false, error: blocked };
  }
  const err = await inWorkspace(ctx, async (tx) => {
    const [w] = await tx.select().from(workflows).where(eq(workflows.id, workflowId));
    if (!w) return t("automations.actions.notFound");
    if (status === "active") {
      const nodes = Object.values(w.graph.nodes);
      if (!nodes.length) return t("automations.actions.needStep");
      for (const n of nodes) {
        if (n.type === "send_email" && !n.emailId) return t("automations.actions.needEmail");
        if ((n.type === "add_tag" || n.type === "remove_tag") && !n.tag.trim()) return t("automations.actions.needTag");
        if (n.type === "webhook" && !/^https?:\/\/.+/.test(n.url)) return t("automations.actions.needUrl");
        if (n.type === "condition" && !n.rule) return t("automations.actions.needRule");
        if (n.type === "send_sms" && !n.message.trim()) return t("automations.actions.needSms");
        if (n.type === "grant_course" && !n.courseId) return t("automations.actions.needCourse");
      }
      const emailIds = nodes.flatMap((n) => (n.type === "send_email" && n.emailId ? [n.emailId] : []));
      if (emailIds.length) {
        const [settings] = await tx.select().from(emailSettings);
        if (!settings) return t("automations.actions.needSender");
        const rows = await tx
          .select({ id: emails.id, subject: emails.subject })
          .from(emails)
          .where(inArray(emails.id, emailIds));
        if (rows.length !== new Set(emailIds).size) return t("automations.actions.emailDeleted");
        if (rows.some((r) => !r.subject.trim())) return t("automations.actions.needSubject");
      }
    }
    await tx.update(workflows).set({ status }).where(eq(workflows.id, workflowId));
    // Pausing stops contacts where they are; waiting runs are cancelled when they wake.
    return null;
  });
  if (err) return { ok: false, error: err };
  await recordAudit(ctx, user.id, {
    action: `automation.${status === "active" ? "activated" : "paused"}`,
    entityType: "workflow",
    entityId: workflowId,
  });
  revalidatePath(`/${workspaceSlug}/automations`, "layout");
  return { ok: true, message: t(status === "active" ? "automations.actions.live" : "automations.actions.paused") };
}

export async function createAutomationEmail(workspaceSlug: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const t = await getT();
  const [e] = await inWorkspace(ctx, (tx) =>
    tx
      .insert(emails)
      .values({
        workspaceId: ctx.workspace.id,
        name: t("automations.actions.automationEmail"),
        subject: "",
        content: localizedStarterEmail(ctx.workspace.siteLocale) as never,
        kind: "automation",
      })
      .returning({ id: emails.id }),
  );
  return { ok: true, id: e!.id };
}

export async function updateAutomationEmail(
  workspaceSlug: string,
  emailId: string,
  input: { name: string; subject: string; preheader: string },
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const d = z
    .object({
      name: z.string().trim().max(120),
      subject: z.string().trim().max(200),
      preheader: z.string().trim().max(200),
    })
    .safeParse(input);
  const t = await getT();
  if (!d.success || !uuid.safeParse(emailId).success)
    return { ok: false, error: t("automations.actions.invalidInput") };
  await inWorkspace(ctx, (tx) =>
    tx
      .update(emails)
      .set({ ...d.data, name: d.data.name || t("automations.actions.automationEmail") })
      .where(and(eq(emails.id, emailId), eq(emails.kind, "automation"))),
  );
  return { ok: true };
}

export async function cancelRun(workspaceSlug: string, runId: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) =>
    tx
      .update(workflowRuns)
      .set({ status: "cancelled", finishedAt: new Date(), currentNodeId: null })
      .where(and(eq(workflowRuns.id, runId), inArray(workflowRuns.status, ["active", "waiting"]))),
  );
  revalidatePath(`/${workspaceSlug}/automations`, "layout");
  return { ok: true, message: (await getT())("automations.actions.removed") };
}

export async function deleteWorkflow(workspaceSlug: string, workflowId: string) {
  const { user, ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.delete(workflows).where(eq(workflows.id, workflowId)));
  await recordAudit(ctx, user.id, { action: "automation.deleted", entityType: "workflow", entityId: workflowId });
  revalidatePath(`/${workspaceSlug}/automations`);
  redirect(`/${workspaceSlug}/automations`);
}

/** "Add to automation" from a contact's profile. Works for any live automation. */
export async function enrollContact(workspaceSlug: string, contactId: string, workflowId: string): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const t = await getT();
  if (!uuid.safeParse(contactId).success || !uuid.safeParse(workflowId).success)
    return { ok: false, error: t("automations.actions.invalidRequest") };
  const [w] = await inWorkspace(ctx, (tx) => tx.select().from(workflows).where(eq(workflows.id, workflowId)));
  if (!w || w.status !== "active") return { ok: false, error: t("automations.actions.notLive") };
  const ok = await enqueue("workflow-events", {
    workspaceId: ctx.workspace.id,
    contactId,
    type: "manual",
    data: { workflowId, by: user.id },
  });
  if (!ok) return { ok: false, error: t("automations.actions.queueDown") };
  return { ok: true, message: t("automations.actions.addedTo", { name: w.name }) };
}
