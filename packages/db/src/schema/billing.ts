import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { organization } from "./auth";

export type BillingStatus = "active" | "trialing" | "past_due" | "canceled" | "incomplete";

/** ZFunnel's own subscription, one per organization. No row = still on the free trial. */
export const orgBilling = pgTable("org_billing", {
  organizationId: text()
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  plan: text().$type<"starter" | "pro" | "scale">().notNull(),
  status: text().$type<BillingStatus>().notNull(),
  /** "stripe" or "test" (test mode activates plans without payment). */
  provider: text().$type<"stripe" | "test">().notNull(),
  stripeCustomerId: text(),
  stripeSubscriptionId: text().unique(),
  currentPeriodEnd: timestamp({ withTimezone: true }),
  cancelAtPeriodEnd: boolean().notNull().default(false),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
export type OrgBilling = typeof orgBilling.$inferSelect;
