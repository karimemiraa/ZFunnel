import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { workspaces } from "./tenancy";

export type SavedViewResource = "contacts" | "orders";

/** List filters, the same shape the list pages read from the URL (apps/web/lib/list-filters.ts). */
export type SavedViewFilters = {
  q?: string;
  tags?: string[];
  from?: string;
  to?: string;
  funnel?: string;
  status?: string;
  min?: number;
  max?: number;
};

/** A named filter set on the contacts or orders list, shared by everyone in the workspace. */
export const savedViews = pgTable(
  "saved_views",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    resource: text().$type<SavedViewResource>().notNull(),
    name: text().notNull(),
    filters: jsonb().$type<SavedViewFilters>().notNull(),
    createdBy: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("saved_views_workspace_resource_idx").on(t.workspaceId, t.resource)],
);
export type SavedView = typeof savedViews.$inferSelect;
