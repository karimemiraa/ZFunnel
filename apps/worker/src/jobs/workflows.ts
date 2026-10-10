import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  and,
  contactActivities,
  contacts,
  courseEnrollments,
  courses,
  emailMessages,
  emails,
  eq,
  getDb,
  ruleCondition,
  sql,
  withSystem,
  workflowRunLogs,
  workflowRuns,
  workflows,
  type Tx,
  type WorkflowNode,
  type WorkflowTrigger,
} from "@zfunnel/db";
import { queue, type WorkflowEvent, type WorkflowRunJob } from "@zfunnel/queue";

const db = () => getDb();
/** Guards against accidental infinite loops inside one job. */
const MAX_STEPS_PER_JOB = 50;
const UNIT_MS = { minutes: 60_000, hours: 3_600_000, days: 86_400_000 } as const;

/** Does an event satisfy a workflow's trigger? */
export function triggerMatches(trigger: WorkflowTrigger, event: WorkflowEvent) {
  if (trigger.type !== event.type) return false;
  const d = event.data ?? {};
  switch (trigger.type) {
    case "optin":
    case "form_submitted":
      return !trigger.funnelId || trigger.funnelId === d.funnelId;
    case "purchase":
      return !trigger.productId || (d.productIds ?? "").split(",").includes(trigger.productId);
    case "booked":
      return !trigger.calendarId || trigger.calendarId === d.calendarId;
    case "tag_added":
      return trigger.tag.toLowerCase() === (d.tag ?? "").toLowerCase();
    case "manual":
      return false; // enrolled explicitly by workflow id, see processWorkflowEvent
  }
}

/** Enrolls the contact in every active automation whose trigger matches. Idempotent per event. */
export async function processWorkflowEvent(event: WorkflowEvent, eventId: string) {
  const runIds = await withSystem(db(), async (tx) => {
    const list = await tx
      .select()
      .from(workflows)
      .where(and(eq(workflows.workspaceId, event.workspaceId), eq(workflows.status, "active")));
    const ids: string[] = [];
    for (const wf of list) {
      const matches = event.type === "manual" ? event.data?.workflowId === wf.id : triggerMatches(wf.trigger, event);
      if (!matches) continue;
      const [run] = await tx
        .insert(workflowRuns)
        .values({
          workspaceId: wf.workspaceId,
          workflowId: wf.id,
          contactId: event.contactId,
          entryKey: wf.allowReentry ? eventId : "once",
          currentNodeId: wf.graph.start,
        })
        .onConflictDoNothing()
        .returning({ id: workflowRuns.id });
      if (!run) continue;
      ids.push(run.id);
      await tx.insert(contactActivities).values({
        workspaceId: wf.workspaceId,
        contactId: event.contactId,
        type: "automation",
        body: `Entered “${wf.name}”`,
        data: { workflowId: wf.id, runId: run.id },
      });
    }
    return ids;
  });
  for (const runId of runIds) await queue("workflow-runs").add("run", { runId }, { jobId: `run-${runId}-start` });
  return { enrolled: runIds.length };
}

/** Blocks webhooks to private, loopback and link-local addresses (SSRF). */
export async function isPublicUrl(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addrs.length) return false;
  return addrs.every((a) => !isPrivate(a));
}
function isPrivate(ip: string) {
  if (ip.includes(":")) {
    const l = ip.toLowerCase();
    if (l.startsWith("::ffff:")) return isPrivate(l.slice(7));
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number) as [number, number];
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

type StepResult = {
  next: string | null;
  wait?: number;
  status: "ok" | "skipped" | "error";
  message?: string;
  emailMessageId?: string;
};

async function runStep(
  tx: Tx,
  node: WorkflowNode,
  ctx: { workspaceId: string; contactId: string; runId: string; workflowId: string },
): Promise<StepResult> {
  const [contact] = await tx.select().from(contacts).where(eq(contacts.id, ctx.contactId));
  if (!contact) return { next: null, status: "error", message: "Contact was deleted" };
  switch (node.type) {
    case "send_email": {
      const next = node.next ?? null;
      if (!node.emailId) return { next, status: "skipped", message: "No email selected" };
      if (contact.unsubscribedAt) return { next, status: "skipped", message: "Contact unsubscribed" };
      const [email] = await tx.select().from(emails).where(eq(emails.id, node.emailId));
      if (!email) return { next, status: "skipped", message: "Email was deleted" };
      const [m] = await tx
        .insert(emailMessages)
        .values({
          workspaceId: ctx.workspaceId,
          emailId: email.id,
          contactId: contact.id,
          toEmail: contact.email,
          subject: email.subject,
          meta: { workflowId: ctx.workflowId, runId: ctx.runId },
        })
        .returning({ id: emailMessages.id });
      return { next, status: "ok", message: email.subject, emailMessageId: m!.id };
    }
    case "wait":
      return {
        next: node.next ?? null,
        wait: Math.max(1, node.amount) * UNIT_MS[node.unit],
        status: "ok",
        message: `${node.amount} ${node.unit}`,
      };
    case "add_tag":
    case "remove_tag": {
      const tag = node.tag.trim();
      if (!tag) return { next: node.next ?? null, status: "skipped", message: "No tag set" };
      await tx
        .update(contacts)
        .set({
          tags:
            node.type === "add_tag"
              ? sql`(select array(select distinct unnest(array_append(${contacts.tags}, ${tag}::text))))`
              : sql`array_remove(${contacts.tags}, ${tag}::text)`,
        })
        .where(eq(contacts.id, contact.id));
      return { next: node.next ?? null, status: "ok", message: tag };
    }
    case "condition": {
      if (!node.rule) return { next: node.no ?? null, status: "skipped", message: "No condition set → No" };
      const [r] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, contact.id), ruleCondition(node.rule)));
      return { next: (r ? node.yes : node.no) ?? null, status: "ok", message: r ? "Yes" : "No" };
    }
    case "grant_course": {
      const next = node.next ?? null;
      if (!node.courseId) return { next, status: "skipped", message: "No course selected" };
      const [c] = await tx.select({ title: courses.title }).from(courses).where(eq(courses.id, node.courseId));
      if (!c) return { next, status: "skipped", message: "Course was deleted" };
      await tx
        .insert(courseEnrollments)
        .values({ workspaceId: ctx.workspaceId, courseId: node.courseId, contactId: contact.id, source: "automation" })
        .onConflictDoUpdate({
          target: [courseEnrollments.courseId, courseEnrollments.contactId],
          set: { revokedAt: null },
        });
      return { next, status: "ok", message: c.title };
    }
    case "webhook":
      // Performed outside the transaction (network call); see runWorkflow.
      return { next: node.next ?? null, status: "ok" };
  }
}

async function callWebhook(url: string, payload: unknown) {
  if (!(await isPublicUrl(url))) return { ok: false, message: "Blocked: URL must be public http(s)" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "ZFunnel-Webhook/1.0" },
      body: JSON.stringify(payload),
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: res.ok, message: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, message: (err as Error).message.slice(0, 200) };
  }
}

/** Advances one run until it finishes or hits a wait. Each step commits before the next starts. */
export async function processWorkflowRun({ runId }: WorkflowRunJob) {
  for (let i = 0; i < MAX_STEPS_PER_JOB; i++) {
    const step = await withSystem(db(), async (tx) => {
      // Row lock: two jobs for the same run can never execute a step twice.
      const [run] = await tx.select().from(workflowRuns).where(eq(workflowRuns.id, runId)).for("update");
      if (!run || (run.status !== "active" && run.status !== "waiting")) return { done: true as const };
      if (run.status === "waiting" && run.resumeAt && run.resumeAt.getTime() > Date.now() + 1000)
        return { done: true as const };
      const [wf] = await tx.select().from(workflows).where(eq(workflows.id, run.workflowId));
      const finish = async (status: "completed" | "cancelled" | "failed", error?: string) => {
        await tx
          .update(workflowRuns)
          .set({ status, finishedAt: new Date(), currentNodeId: null, error: error ?? null })
          .where(eq(workflowRuns.id, run.id));
        return { done: true as const };
      };
      if (!wf || wf.status !== "active") return finish("cancelled", "Automation was paused or deleted");
      const node = run.currentNodeId ? wf.graph.nodes[run.currentNodeId] : undefined;
      if (!node) return finish("completed");
      const ctx = { workspaceId: run.workspaceId, contactId: run.contactId, runId: run.id, workflowId: wf.id };
      if (node.type === "webhook") {
        const [contact] = await tx.select().from(contacts).where(eq(contacts.id, run.contactId));
        return { webhook: { node, run, contact, wf } };
      }
      const r = await runStep(tx, node, ctx);
      await tx.insert(workflowRunLogs).values({
        workspaceId: run.workspaceId,
        runId: run.id,
        nodeId: node.id,
        nodeType: node.type,
        status: r.status,
        message: r.message ?? null,
      });
      if (r.status === "error") return finish("failed", r.message);
      const resumeAt = r.wait ? new Date(Date.now() + r.wait) : null;
      await tx
        .update(workflowRuns)
        .set({ currentNodeId: r.next, status: resumeAt ? "waiting" : "active", resumeAt })
        .where(eq(workflowRuns.id, run.id));
      return { emailMessageId: r.emailMessageId, resumeAt };
    });

    if ("done" in step) return { finished: true };
    if ("webhook" in step && step.webhook) {
      const { node, run, contact, wf } = step.webhook;
      const res = await callWebhook(node.url, {
        event: "automation.step",
        automation: { id: wf.id, name: wf.name },
        contact: contact && {
          id: contact.id,
          email: contact.email,
          name: contact.name,
          tags: contact.tags,
          fields: contact.fields,
        },
        sentAt: new Date().toISOString(),
      });
      await withSystem(db(), async (tx) => {
        await tx.insert(workflowRunLogs).values({
          workspaceId: run.workspaceId,
          runId: run.id,
          nodeId: node.id,
          nodeType: node.type,
          status: res.ok ? "ok" : "error",
          message: res.message,
        });
        // A failing webhook is logged but does not stop the automation.
        await tx
          .update(workflowRuns)
          .set({ currentNodeId: node.next ?? null })
          .where(and(eq(workflowRuns.id, run.id), eq(workflowRuns.currentNodeId, node.id)));
      });
      continue;
    }
    if (step.emailMessageId)
      await queue("email").add("email", { messageId: step.emailMessageId }, { jobId: `msg-${step.emailMessageId}` });
    if (step.resumeAt) {
      await queue("workflow-runs").add(
        "run",
        { runId },
        { jobId: `run-${runId}-${step.resumeAt.getTime()}`, delay: step.resumeAt.getTime() - Date.now() },
      );
      return { waiting: step.resumeAt.toISOString() };
    }
  }
  // Long chains continue in a fresh job.
  await queue("workflow-runs").add("run", { runId }, { jobId: `run-${runId}-cont-${Date.now()}` });
  return { continued: true };
}
