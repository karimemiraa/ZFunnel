import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { contacts } from "./contacts";
import { workspaces } from "./tenancy";

export type FieldType = "text" | "number" | "date" | "select" | "checkbox" | "url";

/** Workspace-defined contact fields (values live in contacts.fields). */
export const contactFields = pgTable(
  "contact_fields",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    key: text().notNull(),
    label: text().notNull(),
    type: text().$type<FieldType>().notNull(),
    options: jsonb().$type<string[]>(),
    position: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("contact_fields_ws_key_uq").on(t.workspaceId, t.key)],
);

export type ActivityType =
  | "note"
  | "optin"
  | "purchase"
  | "upsell"
  | "tag_added"
  | "tag_removed"
  | "email_sent"
  | "email_opened"
  | "email_clicked"
  | "unsubscribed"
  | "booking"
  | "deal_moved"
  | "automation"
  | "form";

/** Contact timeline: system events and manual notes. */
export const contactActivities = pgTable(
  "contact_activities",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contactId: uuid()
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    type: text().$type<ActivityType>().notNull(),
    body: text(),
    data: jsonb().$type<Record<string, unknown>>(),
    actorUserId: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contact_activities_contact_idx").on(t.contactId, t.createdAt)],
);

/** Saved contact filter. `rules` is evaluated by packages/crm/segments. */
export type SegmentRule =
  | { field: "tag"; op: "has" | "not_has"; value: string }
  | { field: "email" | "name"; op: "contains"; value: string }
  | { field: "created"; op: "within_days" | "older_than_days"; value: number }
  | { field: "customer"; op: "is" | "is_not" }
  | { field: "source_funnel"; op: "is"; value: string }
  | { field: "custom"; key: string; op: "equals" | "contains" | "is_set"; value?: string };

export const segments = pgTable("segments", {
  id: uuid().primaryKey().defaultRandom(),
  workspaceId: uuid()
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text().notNull(),
  match: text().$type<"all" | "any">().notNull().default("all"),
  rules: jsonb().$type<SegmentRule[]>().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const pipelines = pgTable("pipelines", {
  id: uuid().primaryKey().defaultRandom(),
  workspaceId: uuid()
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: text().notNull(),
  position: integer().notNull().default(0),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    pipelineId: uuid()
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    name: text().notNull(),
    color: text().notNull().default("#6366f1"),
    /** Won/lost stages close the deal. */
    kind: text().$type<"open" | "won" | "lost">().notNull().default("open"),
    position: integer().notNull().default(0),
  },
  (t) => [index("pipeline_stages_pipeline_idx").on(t.pipelineId, t.position)],
);

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    pipelineId: uuid()
      .notNull()
      .references(() => pipelines.id, { onDelete: "cascade" }),
    stageId: uuid()
      .notNull()
      .references(() => pipelineStages.id, { onDelete: "restrict" }),
    contactId: uuid().references(() => contacts.id, { onDelete: "set null" }),
    title: text().notNull(),
    /** Cents. */
    value: integer().notNull().default(0),
    currency: text().notNull().default("usd"),
    ownerUserId: text().references(() => user.id, { onDelete: "set null" }),
    position: integer().notNull().default(0),
    closedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("opportunities_stage_idx").on(t.stageId, t.position)],
);

export type ContactField = typeof contactFields.$inferSelect;
export type ContactActivity = typeof contactActivities.$inferSelect;
export type Segment = typeof segments.$inferSelect;
export type Pipeline = typeof pipelines.$inferSelect;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
