import "server-only";

import { contacts, desc, emails, eq, inArray, sql, workflowRunLogs, workflowRuns, workflows } from "@zfunnel/db";
import { inWorkspace } from "./funnels";
import type { WorkspaceContext } from "./workspaces";

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function listWorkflows(ctx: WorkspaceContext) {
  return inWorkspace(ctx, (tx) =>
    tx
      .select({
        w: workflows,
        inProgress: sql<number>`(select count(*)::int from workflow_runs r where r.workflow_id = "workflows"."id" and r.status in ('active','waiting'))`,
        completed: sql<number>`(select count(*)::int from workflow_runs r where r.workflow_id = "workflows"."id" and r.status = 'completed')`,
        total: sql<number>`(select count(*)::int from workflow_runs r where r.workflow_id = "workflows"."id")`,
      })
      .from(workflows)
      .orderBy(desc(workflows.updatedAt)),
  );
}

export async function getWorkflow(ctx: WorkspaceContext, id: string) {
  if (!isUuid(id)) return null;
  const [w] = await inWorkspace(ctx, (tx) => tx.select().from(workflows).where(eq(workflows.id, id)));
  return w ?? null;
}

/** Emails the builder can pick from, with the fields shown in the step panel. */
export async function listAutomationEmails(ctx: WorkspaceContext) {
  return inWorkspace(ctx, (tx) =>
    tx
      .select({ id: emails.id, name: emails.name, subject: emails.subject, preheader: emails.preheader })
      .from(emails)
      .where(eq(emails.kind, "automation"))
      .orderBy(desc(emails.updatedAt)),
  );
}

export async function listRuns(ctx: WorkspaceContext, workflowId: string, limit = 50) {
  return inWorkspace(ctx, async (tx) => {
    const runs = await tx
      .select({ r: workflowRuns, email: contacts.email, name: contacts.name })
      .from(workflowRuns)
      .innerJoin(contacts, eq(contacts.id, workflowRuns.contactId))
      .where(eq(workflowRuns.workflowId, workflowId))
      .orderBy(desc(workflowRuns.startedAt))
      .limit(limit);
    const logs = runs.length
      ? await tx
          .select()
          .from(workflowRunLogs)
          .where(
            inArray(
              workflowRunLogs.runId,
              runs.map((r) => r.r.id),
            ),
          )
          .orderBy(workflowRunLogs.createdAt)
      : [];
    return runs.map((r) => ({ ...r, logs: logs.filter((l) => l.runId === r.r.id) }));
  });
}
