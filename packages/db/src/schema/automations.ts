import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import type { SegmentRule } from "./crm";
import { workspaces } from "./tenancy";

export type WorkflowTrigger =
  | { type: "optin"; funnelId?: string | null }
  | { type: "purchase"; productId?: string | null }
  | { type: "tag_added"; tag: string }
  | { type: "form_submitted"; funnelId?: string | null }
  | { type: "manual" };

/** One step of an automation. Steps form a tree: `next`, or `yes`/`no` for conditions. */
export type WorkflowNode =
  | { id: string; type: "send_email"; emailId: string | null; next?: string | null }
  | { id: string; type: "wait"; amount: number; unit: "minutes" | "hours" | "days"; next?: string | null }
  | { id: string; type: "add_tag" | "remove_tag"; tag: string; next?: string | null }
  | { id: string; type: "condition"; rule: SegmentRule | null; yes?: string | null; no?: string | null }
  | { id: string; type: "webhook"; url: string; next?: string | null }
  | { id: string; type: "grant_course"; courseId: string | null; next?: string | null };

export type WorkflowGraph = { start: string | null; nodes: Record<string, WorkflowNode> };
export type WorkflowStatus = "draft" | "active" | "paused";

export const workflows = pgTable(
  "workflows",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text().notNull(),
    status: text().$type<WorkflowStatus>().notNull().default("draft"),
    trigger: jsonb().$type<WorkflowTrigger>().notNull(),
    graph: jsonb().$type<WorkflowGraph>().notNull(),
    /** false: a contact goes through this automation at most once. */
    allowReentry: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("workflows_workspace_status_idx").on(t.workspaceId, t.status)],
);

export type RunStatus = "active" | "waiting" | "completed" | "failed" | "cancelled";

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    workflowId: uuid()
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    contactId: uuid()
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    /** "once" when re-entry is off; otherwise the triggering event's id. Makes enrollment idempotent. */
    entryKey: text().notNull(),
    status: text().$type<RunStatus>().notNull().default("active"),
    currentNodeId: text(),
    resumeAt: timestamp({ withTimezone: true }),
    error: text(),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("workflow_runs_entry_uq").on(t.workflowId, t.contactId, t.entryKey),
    index("workflow_runs_workflow_idx").on(t.workflowId, t.startedAt),
  ],
);

export const workflowRunLogs = pgTable(
  "workflow_run_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    runId: uuid()
      .notNull()
      .references(() => workflowRuns.id, { onDelete: "cascade" }),
    nodeId: text().notNull(),
    nodeType: text().notNull(),
    status: text().$type<"ok" | "skipped" | "error">().notNull(),
    message: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("workflow_run_logs_run_idx").on(t.runId, t.createdAt)],
);

export type Workflow = typeof workflows.$inferSelect;
export type WorkflowRun = typeof workflowRuns.$inferSelect;
