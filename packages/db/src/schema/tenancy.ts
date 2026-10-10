import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organization, user } from "./auth";

/**
 * A workspace is one brand/business inside an organization (ClickFunnels "workspace").
 * Its slug is the free subdomain: {slug}.zfunnel.app — so it is unique platform-wide.
 * Row-level security: visible only when app.organization_id matches (see migrations).
 */
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid().primaryKey().defaultRandom(),
    organizationId: text()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text().notNull(),
    slug: text().notNull().unique(),
    /** Funnel served at the root path "/" of this workspace's domains. */
    homeFunnelId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("workspaces_organization_id_idx").on(t.organizationId)],
);

/**
 * Append-only record of who changed what. The first workspace-scoped table;
 * every future tenant table follows the same workspace_id + RLS pattern.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    actorUserId: text().references(() => user.id, { onDelete: "set null" }),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text(),
    data: jsonb().$type<Record<string, unknown>>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_workspace_created_idx").on(t.workspaceId, t.createdAt)],
);

export type Workspace = typeof workspaces.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
