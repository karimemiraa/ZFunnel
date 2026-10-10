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
import { starterEmail } from "@zfunnel/email/editor";
import { enqueue } from "@zfunnel/queue";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { inWorkspace } from "./funnels";
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
const triggerSchema: z.ZodType<WorkflowTrigger> = z.union([
  z.object({ type: z.literal("optin"), funnelId: uuid.nullish() }),
  z.object({ type: z.literal("purchase"), productId: uuid.nullish() }),
  z.object({ type: z.literal("tag_added"), tag: z.string().trim().min(1, "Choose a tag").max(40) }),
  z.object({ type: z.literal("form_submitted"), funnelId: uuid.nullish() }),
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
]);
const graphSchema = z.object({ start: ref.transform((v) => v ?? null), nodes: z.record(z.string(), nodeSchema) });

const RECIPES = {
  blank: { trigger: null, emails: [] as { name: string; subject: string; preheader: string }[] },
  welcome: {
    trigger: { type: "optin" } as WorkflowTrigger,
    emails: [
      {
        name: "Welcome",
        subject: "Welcome, {{first_name|friend}}! Here's your guide",
        preheader: "Everything you need to get started",
      },
      { name: "Follow-up", subject: "Did you get a chance to look?", preheader: "A quick tip to get results faster" },
    ],
  },
  customer: {
    trigger: { type: "purchase" } as WorkflowTrigger,
    emails: [
      {
        name: "Thank you",
        subject: "Thank you for your order, {{first_name|friend}}!",
        preheader: "Here's how to get started",
      },
    ],
  },
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
  const name = z.string().trim().min(1, "Name your automation").max(80).safeParse(input.name);
  if (!name.success) return { ok: false, error: name.error.issues[0]!.message };
  const trigger = triggerSchema.safeParse(input.trigger);
  if (!trigger.success) return { ok: false, error: trigger.error.issues[0]!.message };
  const recipe: Recipe = input.recipe && input.recipe in RECIPES ? input.recipe : "blank";
  const [w] = await inWorkspace(ctx, async (tx) => {
    const ids: string[] = [];
    for (const e of RECIPES[recipe].emails) {
      const [row] = await tx
        .insert(emails)
        .values({ workspaceId: ctx.workspace.id, ...e, content: starterEmail() as never, kind: "automation" })
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
  const set: Partial<typeof workflows.$inferInsert> = {};
  if (input.name !== undefined) {
    const n = z.string().trim().min(1).max(80).safeParse(input.name);
    if (!n.success) return { ok: false, error: "Name your automation" };
    set.name = n.data;
  }
  if (input.trigger !== undefined) {
    const t = triggerSchema.safeParse(input.trigger);
    if (!t.success) return { ok: false, error: t.error.issues[0]!.message };
    set.trigger = t.data;
  }
  if (input.graph !== undefined) {
    const g = graphSchema.safeParse(input.graph);
    if (!g.success) return { ok: false, error: "This automation has an invalid step." };
    const err = validateGraph(g.data as WorkflowGraph);
    if (err) return { ok: false, error: err };
    set.graph = g.data as WorkflowGraph;
  }
  if (input.allowReentry !== undefined) set.allowReentry = Boolean(input.allowReentry);
  const [w] = await inWorkspace(ctx, (tx) =>
    tx.update(workflows).set(set).where(eq(workflows.id, workflowId)).returning({ id: workflows.id }),
  );
  if (!w) return { ok: false, error: "Automation not found" };
  return { ok: true };
}

export async function setWorkflowStatus(
  workspaceSlug: string,
  workflowId: string,
  status: "active" | "paused",
): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const err = await inWorkspace(ctx, async (tx) => {
    const [w] = await tx.select().from(workflows).where(eq(workflows.id, workflowId));
    if (!w) return "Automation not found";
    if (status === "active") {
      const nodes = Object.values(w.graph.nodes);
      if (!nodes.length) return "Add at least one step before activating.";
      for (const n of nodes) {
        if (n.type === "send_email" && !n.emailId) return "Every “Send email” step needs an email.";
        if ((n.type === "add_tag" || n.type === "remove_tag") && !n.tag.trim()) return "Every tag step needs a tag.";
        if (n.type === "webhook" && !/^https?:\/\/.+/.test(n.url)) return "Every webhook step needs a valid URL.";
        if (n.type === "condition" && !n.rule) return "Every condition needs a rule.";
      }
      const emailIds = nodes.flatMap((n) => (n.type === "send_email" && n.emailId ? [n.emailId] : []));
      if (emailIds.length) {
        const [settings] = await tx.select().from(emailSettings);
        if (!settings) return "Set up your sender details first (Email → Sender).";
        const rows = await tx
          .select({ id: emails.id, subject: emails.subject })
          .from(emails)
          .where(inArray(emails.id, emailIds));
        if (rows.length !== new Set(emailIds).size) return "An email used in this automation was deleted.";
        if (rows.some((r) => !r.subject.trim())) return "Every email needs a subject line.";
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
  return { ok: true, message: status === "active" ? "Automation is live" : "Automation paused" };
}

export async function createAutomationEmail(workspaceSlug: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const [e] = await inWorkspace(ctx, (tx) =>
    tx
      .insert(emails)
      .values({
        workspaceId: ctx.workspace.id,
        name: "Automation email",
        subject: "",
        content: starterEmail() as never,
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
  if (!d.success || !uuid.safeParse(emailId).success) return { ok: false, error: "Invalid input" };
  await inWorkspace(ctx, (tx) =>
    tx
      .update(emails)
      .set({ ...d.data, name: d.data.name || "Automation email" })
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
  return { ok: true, message: "Contact removed from automation" };
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
  if (!uuid.safeParse(contactId).success || !uuid.safeParse(workflowId).success)
    return { ok: false, error: "Invalid request" };
  const [w] = await inWorkspace(ctx, (tx) => tx.select().from(workflows).where(eq(workflows.id, workflowId)));
  if (!w || w.status !== "active") return { ok: false, error: "That automation isn't live." };
  const ok = await enqueue("workflow-events", {
    workspaceId: ctx.workspace.id,
    contactId,
    type: "manual",
    data: { workflowId, by: user.id },
  });
  if (!ok) return { ok: false, error: "The automation queue is unavailable. Is the worker running?" };
  return { ok: true, message: `Added to “${w.name}”` };
}
