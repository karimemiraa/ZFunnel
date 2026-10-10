import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { segments } from "./crm";
import type { PageJson } from "./funnels";
import { workspaces } from "./tenancy";

/** Sender identity + legally required footer (CAN-SPAM/GDPR need a postal address). */
export const emailSettings = pgTable("email_settings", {
  workspaceId: uuid()
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  fromName: text().notNull(),
  replyTo: text().notNull(),
  postalAddress: text().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** An email design (Puck JSON with email-safe blocks). */
export const emails = pgTable(
  "emails",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text().notNull(),
    subject: text().notNull().default(""),
    preheader: text().notNull().default(""),
    content: jsonb().$type<PageJson>().notNull(),
    /** Broadcast designs are listed with their broadcast; automation emails belong to a workflow. */
    kind: text().$type<"broadcast" | "automation" | "template">().notNull().default("broadcast"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("emails_workspace_idx").on(t.workspaceId)],
);

export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

export const broadcasts = pgTable(
  "broadcasts",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    emailId: uuid()
      .notNull()
      .references(() => emails.id, { onDelete: "cascade" }),
    /** Audience: a saved segment, a tag, or everyone (both null). */
    segmentId: uuid().references(() => segments.id, { onDelete: "set null" }),
    tag: text(),
    status: text().$type<BroadcastStatus>().notNull().default("draft"),
    scheduledAt: timestamp({ withTimezone: true }),
    sentAt: timestamp({ withTimezone: true }),
    recipients: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("broadcasts_workspace_idx").on(t.workspaceId, t.createdAt)],
);

export type MessageStatus = "queued" | "sent" | "failed" | "bounced" | "skipped";

/** One email to one contact (from a broadcast, an automation or a test send). */
export const emailMessages = pgTable(
  "email_messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contactId: uuid().references(() => contacts.id, { onDelete: "set null" }),
    emailId: uuid().references(() => emails.id, { onDelete: "set null" }),
    broadcastId: uuid().references(() => broadcasts.id, { onDelete: "cascade" }),
    workflowRunId: uuid(),
    toEmail: text().notNull(),
    subject: text().notNull(),
    status: text().$type<MessageStatus>().notNull().default("queued"),
    error: text(),
    providerMessageId: text(),
    sentAt: timestamp({ withTimezone: true }),
    openedAt: timestamp({ withTimezone: true }),
    clickedAt: timestamp({ withTimezone: true }),
    openCount: integer().notNull().default(0),
    clickCount: integer().notNull().default(0),
    meta: jsonb().$type<{ test?: boolean; clicks?: string[]; workflowId?: string; runId?: string }>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("email_messages_broadcast_idx").on(t.broadcastId, t.status),
    index("email_messages_contact_idx").on(t.contactId, t.createdAt),
    // A broadcast never goes to the same contact twice, even if a job is retried.
    uniqueIndex("email_messages_broadcast_contact_uq").on(t.broadcastId, t.contactId),
  ],
);

export type EmailSettings = typeof emailSettings.$inferSelect;
export type Email = typeof emails.$inferSelect;
export type Broadcast = typeof broadcasts.$inferSelect;
export type EmailMessage = typeof emailMessages.$inferSelect;
