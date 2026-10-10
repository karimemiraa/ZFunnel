import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { funnels, funnelSteps } from "./funnels";
import { workspaces } from "./tenancy";

export type PaymentProvider = "stripe" | "test";

/** A workspace's connected payment account (Stripe Connect: acct_…). */
export const paymentAccounts = pgTable(
  "payment_accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: text().$type<PaymentProvider>().notNull(),
    externalId: text().notNull(),
    chargesEnabled: boolean().notNull().default(false),
    detailsSubmitted: boolean().notNull().default(false),
    livemode: boolean().notNull().default(false),
    displayName: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("payment_accounts_workspace_provider_uq").on(t.workspaceId, t.provider),
    uniqueIndex("payment_accounts_external_uq").on(t.provider, t.externalId),
  ],
);

export const products = pgTable(
  "products",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text().notNull(),
    description: text(),
    imageUrl: text(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("products_workspace_idx").on(t.workspaceId)],
);

export type PriceType = "one_time" | "recurring" | "payment_plan";
export type PriceInterval = "month" | "year";

export const prices = pgTable(
  "prices",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** Shown to buyers, e.g. "Lifetime access" or "Monthly". */
    label: text(),
    type: text().$type<PriceType>().notNull(),
    /** In the smallest currency unit (cents). For payment plans: the amount per installment. */
    amount: integer().notNull(),
    currency: text().notNull().default("usd"),
    interval: text().$type<PriceInterval>(),
    trialDays: integer(),
    /** Payment plans: number of installments before the subscription ends. */
    installments: integer(),
    /** Mirror objects on the connected account, created lazily. */
    stripeProductId: text(),
    stripePriceId: text(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("prices_product_idx").on(t.productId)],
);

export type OfferRole = "main" | "bump" | "upsell" | "downsell";

/** Which prices are sold on a funnel step, and how. */
export const stepOffers = pgTable(
  "step_offers",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    stepId: uuid()
      .notNull()
      .references(() => funnelSteps.id, { onDelete: "cascade" }),
    priceId: uuid()
      .notNull()
      .references(() => prices.id, { onDelete: "cascade" }),
    role: text().$type<OfferRole>().notNull(),
    position: integer().notNull().default(0),
    /** Order-bump checkbox copy. */
    headline: text(),
    description: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("step_offers_step_idx").on(t.stepId, t.position)],
);

/** Saved customer + payment method per provider, enabling one-click upsells. */
export const paymentProfiles = pgTable(
  "payment_profiles",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contactId: uuid()
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    provider: text().$type<PaymentProvider>().notNull(),
    customerId: text().notNull(),
    paymentMethodId: text(),
    cardBrand: text(),
    cardLast4: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("payment_profiles_contact_provider_uq").on(t.contactId, t.provider)],
);

export type OrderStatus = "pending" | "paid" | "failed" | "refunded" | "partially_refunded";

export const orders = pgTable(
  "orders",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Human-friendly per-workspace number, e.g. #1042. */
    number: integer().notNull(),
    contactId: uuid().references(() => contacts.id, { onDelete: "set null" }),
    funnelId: uuid().references(() => funnels.id, { onDelete: "set null" }),
    stepId: uuid().references(() => funnelSteps.id, { onDelete: "set null" }),
    status: text().$type<OrderStatus>().notNull().default("pending"),
    provider: text().$type<PaymentProvider>().notNull(),
    test: boolean().notNull().default(false),
    currency: text().notNull(),
    /** Sum of paid items, in cents. */
    total: integer().notNull().default(0),
    refundedAmount: integer().notNull().default(0),
    /** Referring affiliate (set at checkout from the zf_aff cookie). */
    affiliateId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("orders_workspace_number_uq").on(t.workspaceId, t.number),
    index("orders_workspace_created_idx").on(t.workspaceId, t.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    priceId: uuid().references(() => prices.id, { onDelete: "set null" }),
    role: text().$type<OfferRole>().notNull(),
    /** Snapshot so the order stays readable if the product changes later. */
    productName: text().notNull(),
    priceLabel: text(),
    amount: integer().notNull(),
    status: text().$type<"pending" | "paid" | "failed">().notNull().default("pending"),
    paymentId: uuid(),
    subscriptionId: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text().$type<PaymentProvider>().notNull(),
    /** pi_… / in_… / test_… */
    externalId: text(),
    kind: text().$type<"checkout" | "upsell">().notNull(),
    amount: integer().notNull(),
    /** Cumulative refunded amount for this payment (cents). */
    refundedAmount: integer().notNull().default(0),
    currency: text().notNull(),
    status: text()
      .$type<"pending" | "requires_action" | "succeeded" | "failed" | "refunded">()
      .notNull()
      .default("pending"),
    failureMessage: text(),
    raw: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("payments_order_idx").on(t.orderId), uniqueIndex("payments_external_uq").on(t.provider, t.externalId)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contactId: uuid().references(() => contacts.id, { onDelete: "set null" }),
    priceId: uuid().references(() => prices.id, { onDelete: "set null" }),
    orderId: uuid().references(() => orders.id, { onDelete: "set null" }),
    provider: text().$type<PaymentProvider>().notNull(),
    externalId: text(),
    status: text().notNull(),
    currentPeriodEnd: timestamp({ withTimezone: true }),
    cancelAtPeriodEnd: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("subscriptions_workspace_idx").on(t.workspaceId),
    uniqueIndex("subscriptions_external_uq").on(t.provider, t.externalId),
  ],
);

/**
 * A visitor's journey through one funnel (cookie `zf_fs`). After checkout it links the
 * order and saved payment profile so upsells can be charged with one click.
 */
export const funnelSessions = pgTable(
  "funnel_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    funnelId: uuid()
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    contactId: uuid().references(() => contacts.id, { onDelete: "set null" }),
    orderId: uuid().references(() => orders.id, { onDelete: "set null" }),
    /** Steps whose upsell was already accepted or declined (prevents double charges). */
    handledSteps: text()
      .array()
      .notNull()
      .default([] as string[]),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("funnel_sessions_workspace_idx").on(t.workspaceId)],
);

export type Product = typeof products.$inferSelect;
export type Price = typeof prices.$inferSelect;
export type StepOffer = typeof stepOffers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type PaymentAccount = typeof paymentAccounts.$inferSelect;
