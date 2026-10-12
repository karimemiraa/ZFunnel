import {
  affiliateSettings,
  commissions,
  and,
  asc,
  contactActivities,
  contacts,
  eq,
  funnelSessions,
  getDb,
  notify,
  orderItems,
  orders,
  paymentAccounts,
  paymentProfiles,
  payments,
  prices,
  products,
  sql,
  stepOffers,
  subscriptions,
  withSystem,
  type OfferRole,
  type PaymentProvider,
  type Tx,
} from "@zfunnel/db";
import { stripeConfigured } from "./stripe";
import { testModeEnabled } from "./test-gateway";

/**
 * Order bookkeeping shared by the public checkout API and the Stripe webhook.
 * Runs in the system context; callers must have verified the workspace from the request host.
 */

export type OfferView = {
  offerId: string;
  role: OfferRole;
  priceId: string;
  productId: string;
  productName: string;
  productDescription: string | null;
  label: string | null;
  type: "one_time" | "recurring" | "payment_plan";
  amount: number;
  currency: string;
  interval: "month" | "year" | null;
  trialDays: number | null;
  installments: number | null;
  headline: string | null;
  description: string | null;
  stripePriceId: string | null;
};

export async function getStepOffers(tx: Tx, stepId: string): Promise<OfferView[]> {
  const rows = await tx
    .select({
      offerId: stepOffers.id,
      role: stepOffers.role,
      headline: stepOffers.headline,
      description: stepOffers.description,
      priceId: prices.id,
      label: prices.label,
      type: prices.type,
      amount: prices.amount,
      currency: prices.currency,
      interval: prices.interval,
      trialDays: prices.trialDays,
      installments: prices.installments,
      stripePriceId: prices.stripePriceId,
      productId: products.id,
      productName: products.name,
      productDescription: products.description,
    })
    .from(stepOffers)
    .innerJoin(prices, eq(prices.id, stepOffers.priceId))
    .innerJoin(products, eq(products.id, prices.productId))
    .where(and(eq(stepOffers.stepId, stepId), sql`${prices.archivedAt} is null`, sql`${products.archivedAt} is null`))
    .orderBy(asc(stepOffers.position));
  return rows as OfferView[];
}

export type PaymentSetup =
  { provider: "stripe"; accountId: string; publishableKey: string; livemode: boolean } | { provider: "test" } | null;

/** Which gateway a workspace's checkout uses: its Stripe account, or the test gateway in test mode. */
export async function getPaymentSetup(tx: Tx, workspaceId: string): Promise<PaymentSetup> {
  const [acct] = await tx
    .select()
    .from(paymentAccounts)
    .where(and(eq(paymentAccounts.workspaceId, workspaceId), eq(paymentAccounts.provider, "stripe")));
  // `||`: compose passes empty strings for unset keys.
  const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY;
  if (acct?.chargesEnabled && stripeConfigured() && pk)
    return { provider: "stripe", accountId: acct.externalId, publishableKey: pk, livemode: acct.livemode };
  if (testModeEnabled()) return { provider: "test" };
  return null;
}

export async function upsertContact(
  tx: Tx,
  workspaceId: string,
  input: { email: string; name?: string | null; funnelId?: string | null; stepId?: string | null; ip: string },
) {
  const now = new Date();
  const [c] = await tx
    .insert(contacts)
    .values({
      workspaceId,
      email: input.email,
      name: input.name || null,
      sourceFunnelId: input.funnelId ?? null,
      sourceStepId: input.stepId ?? null,
      consentAt: now,
      consentIp: input.ip,
    })
    .onConflictDoUpdate({
      target: [contacts.workspaceId, contacts.email],
      set: { deletedAt: null, name: sql`coalesce(excluded.name, ${contacts.name})`, updatedAt: now },
    })
    .returning();
  return c!;
}

/** Next human-readable order number for the workspace (starts at #1001). */
async function nextOrderNumber(tx: Tx, workspaceId: string) {
  // Serialize per workspace so two checkouts can't take the same number.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${workspaceId}))`);
  const [row] = await tx
    .select({ n: sql<number>`coalesce(max(${orders.number}), 1000)::int` })
    .from(orders)
    .where(eq(orders.workspaceId, workspaceId));
  return (row?.n ?? 1000) + 1;
}

export async function createPendingOrder(
  tx: Tx,
  input: {
    workspaceId: string;
    contactId: string;
    funnelId: string | null;
    stepId: string | null;
    provider: PaymentProvider;
    test: boolean;
    items: OfferView[];
    affiliateId?: string | null;
    shipping?: (typeof orders.$inferInsert)["shipping"];
  },
) {
  const number = await nextOrderNumber(tx, input.workspaceId);
  const currency = input.items[0]!.currency;
  const [order] = await tx
    .insert(orders)
    .values({
      workspaceId: input.workspaceId,
      number,
      contactId: input.contactId,
      funnelId: input.funnelId,
      stepId: input.stepId,
      provider: input.provider,
      test: input.test,
      currency,
      affiliateId: input.affiliateId ?? null,
      shipping: input.shipping ?? null,
    })
    .returning();
  await tx.insert(orderItems).values(
    input.items.map((o) => ({
      workspaceId: input.workspaceId,
      orderId: order!.id,
      priceId: o.priceId,
      role: o.role,
      productName: o.productName,
      priceLabel: o.label,
      amount: o.trialDays ? 0 : o.amount,
    })),
  );
  return order!;
}

/** Marks a payment and its order items as paid, and recomputes the order total. Idempotent. */
export async function markPaymentSucceeded(tx: Tx, paymentId: string, raw?: unknown) {
  const [p] = await tx.select().from(payments).where(eq(payments.id, paymentId));
  if (!p || p.status === "succeeded") return p ?? null;
  await tx
    .update(payments)
    .set({ status: "succeeded", raw: (raw as object) ?? p.raw })
    .where(eq(payments.id, paymentId));
  await tx.update(orderItems).set({ status: "paid" }).where(eq(orderItems.paymentId, paymentId));
  await recomputeOrder(tx, p.orderId);
  await grantCoursesForPayment(tx, paymentId);
  await decrementStock(tx, paymentId);
  return p;
}

/** Store inventory: one unit per paid item, never below zero. */
async function decrementStock(tx: Tx, paymentId: string) {
  await tx.execute(sql`
    update products pr set stock = greatest(pr.stock - x.n, 0)
    from (select p.product_id, count(*)::int as n from order_items oi join prices p on p.id = oi.price_id
          where oi.payment_id = ${paymentId} and oi.status = 'paid' group by p.product_id) x
    where pr.id = x.product_id and pr.stock is not null`);
}

/** A store product's price as a checkout offer (validates visibility and stock). */
export async function getStoreOffer(
  tx: Tx,
  workspaceId: string,
  priceId: string,
): Promise<(OfferView & { requiresShipping: boolean }) | null> {
  const [r] = await tx
    .select({
      priceId: prices.id,
      productId: products.id,
      label: prices.label,
      type: prices.type,
      amount: prices.amount,
      currency: prices.currency,
      interval: prices.interval,
      trialDays: prices.trialDays,
      installments: prices.installments,
      stripePriceId: prices.stripePriceId,
      productName: products.name,
      productDescription: products.description,
      stock: products.stock,
      requiresShipping: products.requiresShipping,
    })
    .from(prices)
    .innerJoin(products, eq(products.id, prices.productId))
    .where(
      and(
        eq(prices.id, priceId),
        eq(products.workspaceId, workspaceId),
        eq(products.inStore, true),
        sql`${prices.archivedAt} is null`,
        sql`${products.archivedAt} is null`,
      ),
    );
  if (!r || (r.stock !== null && r.stock <= 0)) return null;
  const { stock: _stock, ...rest } = r;
  return { ...rest, offerId: r.priceId, role: "main", headline: null, description: null } as OfferView & {
    requiresShipping: boolean;
  };
}

/** Enrolls the buyer in every course linked to the products just paid for (idempotent). */
export async function grantCoursesForPayment(tx: Tx, paymentId: string) {
  await tx.execute(sql`
    insert into course_enrollments (workspace_id, course_id, contact_id, source)
    select distinct cp.workspace_id, cp.course_id, o.contact_id, 'purchase'
    from order_items oi
    join orders o on o.id = oi.order_id and o.contact_id is not null
    join prices pr on pr.id = oi.price_id
    join course_products cp on cp.product_id = pr.product_id
    where oi.payment_id = ${paymentId} and oi.status = 'paid'
    on conflict (course_id, contact_id) do update set revoked_at = null`);
}

export async function markPaymentFailed(tx: Tx, paymentId: string, message: string) {
  await tx.update(payments).set({ status: "failed", failureMessage: message }).where(eq(payments.id, paymentId));
  await tx.update(orderItems).set({ status: "failed" }).where(eq(orderItems.paymentId, paymentId));
  const [p] = await tx.select({ orderId: payments.orderId }).from(payments).where(eq(payments.id, paymentId));
  if (p) await recomputeOrder(tx, p.orderId);
}

export async function recomputeOrder(tx: Tx, orderId: string) {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const paid = items.filter((i) => i.status === "paid");
  const total = paid.reduce((sum, i) => sum + i.amount, 0);
  const allFailed = items.length > 0 && items.every((i) => i.status === "failed");
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return;
  const status = paid.length
    ? order.status === "refunded" || order.status === "partially_refunded"
      ? order.status
      : "paid"
    : allFailed
      ? "failed"
      : order.status;
  await tx
    .update(orders)
    .set({ total, status, paidAt: paid.length && !order.paidAt ? new Date() : order.paidAt })
    .where(eq(orders.id, orderId));
  await syncCommission(tx, orderId);
  // Notifications center: the first time an order is paid, or when its payment fails.
  const becamePaid = status === "paid" && !order.paidAt;
  const becameFailed = status === "failed" && order.status !== "failed";
  if (becamePaid || becameFailed) {
    const [c] = order.contactId
      ? await tx
          .select({ name: contacts.name, email: contacts.email })
          .from(contacts)
          .where(eq(contacts.id, order.contactId))
      : [];
    await notify(tx, {
      workspaceId: order.workspaceId,
      type: becamePaid ? "order" : "payment_failed",
      entityId: order.id,
      data: { number: order.number, amount: total, currency: order.currency, name: c?.name || c?.email || null },
    });
  }
}

/**
 * Keeps the affiliate commission equal to percent × (paid − refunded). Already-paid
 * commissions are never changed; a commission that drops to zero is voided.
 */
export async function syncCommission(tx: Tx, orderId: string) {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId));
  if (!o?.affiliateId) return;
  const [settings] = await tx.select().from(affiliateSettings).where(eq(affiliateSettings.workspaceId, o.workspaceId));
  const pct = settings?.commissionPercent ?? 0;
  const amount = Math.max(0, Math.round(((o.total - o.refundedAmount) * pct) / 100));
  const [existing] = await tx.select().from(commissions).where(eq(commissions.orderId, orderId));
  if (existing?.status === "paid") return;
  if (!existing) {
    if (amount > 0)
      await tx
        .insert(commissions)
        .values({ workspaceId: o.workspaceId, affiliateId: o.affiliateId, orderId, amount, currency: o.currency });
    return;
  }
  await tx
    .update(commissions)
    .set({ amount, status: amount > 0 ? "pending" : "void" })
    .where(eq(commissions.id, existing.id));
}

export async function saveProfile(
  tx: Tx,
  input: {
    workspaceId: string;
    contactId: string;
    provider: PaymentProvider;
    customerId: string;
    paymentMethodId?: string | null;
    brand?: string | null;
    last4?: string | null;
  },
) {
  await tx
    .insert(paymentProfiles)
    .values({ ...input, cardBrand: input.brand, cardLast4: input.last4 })
    .onConflictDoUpdate({
      target: [paymentProfiles.contactId, paymentProfiles.provider],
      set: {
        customerId: input.customerId,
        paymentMethodId: input.paymentMethodId ?? sql`${paymentProfiles.paymentMethodId}`,
        cardBrand: input.brand ?? sql`${paymentProfiles.cardBrand}`,
        cardLast4: input.last4 ?? sql`${paymentProfiles.cardLast4}`,
        updatedAt: new Date(),
      },
    });
}

export async function getProfile(tx: Tx, contactId: string, provider: PaymentProvider) {
  const [p] = await tx
    .select()
    .from(paymentProfiles)
    .where(and(eq(paymentProfiles.contactId, contactId), eq(paymentProfiles.provider, provider)));
  return p ?? null;
}

export const SESSION_COOKIE = "zf_fs";
export const SESSION_TTL_MS = 6 * 60 * 60 * 1000;

export async function startFunnelSession(
  tx: Tx,
  input: { workspaceId: string; funnelId: string; contactId: string; orderId: string },
) {
  const [s] = await tx
    .insert(funnelSessions)
    .values({ ...input, expiresAt: new Date(Date.now() + SESSION_TTL_MS) })
    .returning();
  return s!;
}

export async function getFunnelSession(tx: Tx, workspaceId: string, sessionId: string | undefined) {
  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) return null;
  const [s] = await tx
    .select()
    .from(funnelSessions)
    .where(and(eq(funnelSessions.id, sessionId), eq(funnelSessions.workspaceId, workspaceId)));
  if (!s || s.expiresAt.getTime() < Date.now()) return null;
  return s;
}

/** Atomically claims a step on the session; false if it was already accepted/declined (no double charge). */
export async function claimStep(tx: Tx, sessionId: string, stepId: string) {
  const rows = await tx
    .update(funnelSessions)
    .set({ handledSteps: sql`array_append(${funnelSessions.handledSteps}, ${stepId})` })
    .where(and(eq(funnelSessions.id, sessionId), sql`not (${stepId} = any(${funnelSessions.handledSteps}))`))
    .returning({ id: funnelSessions.id });
  return rows.length > 0;
}

export async function releaseStep(tx: Tx, sessionId: string, stepId: string) {
  await tx
    .update(funnelSessions)
    .set({ handledSteps: sql`array_remove(${funnelSessions.handledSteps}, ${stepId})` })
    .where(eq(funnelSessions.id, sessionId));
}

export async function recordSubscription(
  tx: Tx,
  input: {
    workspaceId: string;
    contactId: string;
    priceId: string | null;
    orderId: string;
    provider: PaymentProvider;
    externalId: string;
    status: string;
    currentPeriodEnd?: Date | null;
  },
) {
  const [s] = await tx
    .insert(subscriptions)
    .values(input)
    .onConflictDoUpdate({
      target: [subscriptions.provider, subscriptions.externalId],
      set: { status: input.status, currentPeriodEnd: input.currentPeriodEnd ?? null },
    })
    .returning();
  return s!;
}

/**
 * Test gateway: records a subscription for every paid recurring item of an order, as
 * Stripe would. Idempotent (one subscription per order item).
 */
export async function recordTestSubscriptions(
  tx: Tx,
  input: { workspaceId: string; contactId: string; orderId: string },
) {
  const rows = await tx
    .select({ itemId: orderItems.id, priceId: prices.id, interval: prices.interval, trialDays: prices.trialDays })
    .from(orderItems)
    .innerJoin(prices, eq(prices.id, orderItems.priceId))
    .where(
      and(
        eq(orderItems.orderId, input.orderId),
        eq(orderItems.status, "paid"),
        sql`${prices.type} in ('recurring', 'payment_plan')`,
      ),
    );
  for (const r of rows) {
    const end = new Date();
    if (r.trialDays) end.setDate(end.getDate() + r.trialDays);
    else if (r.interval === "year") end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    await recordSubscription(tx, {
      workspaceId: input.workspaceId,
      contactId: input.contactId,
      priceId: r.priceId,
      orderId: input.orderId,
      provider: "test",
      externalId: `test_sub_${r.itemId}`,
      status: r.trialDays ? "trialing" : "active",
      currentPeriodEnd: end,
    });
  }
}

export function system<T>(fn: (tx: Tx) => Promise<T>) {
  return withSystem(getDb(), fn);
}

/** Shape the public page needs (no internal ids beyond the offer id). */
export function toRuntimeOffers(offers: OfferView[]) {
  return offers.map((o) => ({
    id: o.offerId,
    role: o.role,
    name: o.productName,
    label: o.label,
    description: o.role === "bump" ? o.description : o.productDescription,
    headline: o.headline,
    type: o.type,
    amount: o.amount,
    currency: o.currency,
    interval: o.interval,
    trialDays: o.trialDays,
    installments: o.installments,
  }));
}

/** Adds an entry to a contact's timeline (shown in the CRM). */
export async function logActivity(
  tx: Tx,
  input: {
    workspaceId: string;
    contactId: string;
    type:
      | "optin"
      | "purchase"
      | "upsell"
      | "form"
      | "automation"
      | "email_sent"
      | "email_opened"
      | "email_clicked"
      | "booking";
    body?: string | null;
    data?: Record<string, unknown>;
  },
) {
  await tx.insert(contactActivities).values({
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    type: input.type,
    body: input.body ?? null,
    data: input.data,
  });
}
