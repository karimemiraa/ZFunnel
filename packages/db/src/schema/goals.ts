import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./tenancy";

/**
 * Monthly revenue goals. `month` is "YYYY-MM" for a one-month override, or "" for the
 * workspace default that applies to every month without an override.
 */
export const revenueGoals = pgTable(
  "revenue_goals",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    month: text().notNull().default(""),
    /** Smallest currency unit (cents). */
    amount: integer().notNull(),
    currency: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("revenue_goals_ws_month_uq").on(t.workspaceId, t.month)],
);

export type RevenueGoal = typeof revenueGoals.$inferSelect;
