import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/**
 * Platform tables: owned by ZFunnel itself, not by a tenant. They have FORCE ROW LEVEL
 * SECURITY with system-only write policies, so only `withSystem` code behind the platform
 * admin guard can change them (migration 0052, ADR-024).
 */

/** Append-only record of every platform admin action (suspend, plan override, view as...). */
export const platformAuditLog = pgTable(
  "platform_audit_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    adminUserId: text().references(() => user.id, { onDelete: "set null" }),
    action: text().notNull(),
    /** What was acted on, e.g. "organization" + its id. */
    targetType: text().notNull(),
    targetId: text(),
    metadata: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("platform_audit_log_created_idx").on(t.createdAt)],
);

/** A row here means the organization is suspended: dashboard locked, public sites unavailable. */
export const organizationSuspensions = pgTable("organization_suspensions", {
  organizationId: text()
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  reason: text(),
  suspendedByUserId: text().references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type PlatformAuditEntry = typeof platformAuditLog.$inferSelect;
