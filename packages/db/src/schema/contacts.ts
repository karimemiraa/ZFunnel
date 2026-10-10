import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { funnels, funnelSteps } from "./funnels";
import { workspaces } from "./tenancy";

export type Attribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  referrer?: string;
};

export const contacts = pgTable(
  "contacts",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Stored lower-cased; unique per workspace. */
    email: text().notNull(),
    name: text(),
    phone: text(),
    tags: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    sourceFunnelId: uuid().references(() => funnels.id, { onDelete: "set null" }),
    sourceStepId: uuid().references(() => funnelSteps.id, { onDelete: "set null" }),
    attribution: jsonb().$type<Attribution>(),
    /** Values for workspace-defined custom fields, keyed by contact_fields.key. */
    fields: jsonb().$type<Record<string, string | number | boolean | null>>().notNull().default({}),
    /** Unsubscribed from marketing email (transactional email still goes out). */
    unsubscribedAt: timestamp({ withTimezone: true }),
    /** Proof of consent for GDPR: when, where, and what IP. */
    consentAt: timestamp({ withTimezone: true }),
    consentIp: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("contacts_workspace_email_uq").on(t.workspaceId, t.email),
    index("contacts_workspace_created_idx").on(t.workspaceId, t.createdAt),
  ],
);

export type Contact = typeof contacts.$inferSelect;
