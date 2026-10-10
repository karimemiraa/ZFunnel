import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { orders } from "./commerce";
import { contacts } from "./contacts";
import { workspaces } from "./tenancy";

export const affiliateSettings = pgTable("affiliate_settings", {
  workspaceId: uuid()
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  enabled: boolean().notNull().default(false),
  commissionPercent: integer().notNull().default(30),
  cookieDays: integer().notNull().default(30),
  terms: text().notNull().default(""),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const affiliates = pgTable(
  "affiliates",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contactId: uuid()
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    /** Used in links: ?aff=code */
    code: text().notNull(),
    status: text().$type<"active" | "disabled">().notNull().default("active"),
    clicks: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("affiliates_ws_code_uq").on(t.workspaceId, t.code),
    uniqueIndex("affiliates_ws_contact_uq").on(t.workspaceId, t.contactId),
  ],
);

/** One commission per referred order, kept in sync with what was paid and refunded. */
export const commissions = pgTable(
  "commissions",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    affiliateId: uuid()
      .notNull()
      .references(() => affiliates.id, { onDelete: "cascade" }),
    orderId: uuid()
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    amount: integer().notNull(),
    currency: text().notNull(),
    status: text().$type<"pending" | "paid" | "void">().notNull().default("pending"),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("commissions_affiliate_idx").on(t.affiliateId, t.status)],
);
