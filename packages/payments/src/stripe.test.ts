import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type * as StripeModule from "./stripe";

/**
 * Contract tests against stripe-mock (Stripe's official API mock). They check that every
 * request we build is accepted by Stripe's OpenAPI spec. Run with STRIPE_MOCK=1 and
 * stripe-mock listening on :12111.
 */
const enabled = Boolean(process.env.STRIPE_MOCK);

describe.skipIf(!enabled)("stripe requests (stripe-mock)", () => {
  let s: typeof StripeModule;
  beforeAll(async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.STRIPE_API_HOST = "localhost";
    process.env.STRIPE_API_PORT = "12111";
    s = await import("./stripe");
  });
  afterAll(() => {
    delete process.env.STRIPE_API_HOST;
  });

  it("creates a connected account and onboarding link", async () => {
    const acct = await s.createConnectedAccount({ email: "owner@example.com", workspaceId: "ws_1" });
    expect(acct.id).toMatch(/^acct_/);
    const url = await s.createOnboardingLink(acct.id, {
      refreshUrl: "https://app.example.com/r",
      returnUrl: "https://app.example.com/d",
    });
    expect(url).toMatch(/^https?:/);
    const status = await s.getAccountStatus(acct.id);
    expect(typeof status.chargesEnabled).toBe("boolean");
  });

  it("creates a customer and a payment intent that saves the card", async () => {
    const cus = await s.ensureCustomer("acct_1", { email: "buyer@example.com", name: "Buyer", contactId: "c1" });
    expect(cus).toMatch(/^cus_/);
    const pi = await s.createPaymentIntent("acct_1", {
      amount: 4700,
      currency: "usd",
      customerId: cus,
      description: "Order #1",
      metadata: { order: "1" },
      idempotencyKey: "k1",
    });
    expect(pi.id).toMatch(/^pi_/);
  });

  it("charges off-session for one-click upsells", async () => {
    const r = await s.chargeOffSession("acct_1", {
      amount: 9700,
      currency: "usd",
      customerId: "cus_1",
      paymentMethodId: "pm_1",
      description: "Upsell",
      metadata: {},
      idempotencyKey: "k2",
    });
    expect(["succeeded", "requires_action", "failed"]).toContain(r.status);
  });

  it("creates prices and subscriptions", async () => {
    const price = await s.ensureStripePrice("acct_1", {
      productName: "Membership",
      amount: 2900,
      currency: "usd",
      interval: "month",
      zfPriceId: "p1",
    });
    expect(price).toMatch(/^price_/);
    const bump = await s.ensureStripePrice("acct_1", {
      productName: "Bump",
      amount: 1900,
      currency: "usd",
      interval: null,
      zfPriceId: "p2",
    });
    const sub = await s.createSubscription("acct_1", {
      customerId: "cus_1",
      stripePriceId: price,
      trialDays: 7,
      extraPriceIds: [bump],
      metadata: {},
      idempotencyKey: "k3",
    });
    expect(sub.subscription.id).toMatch(/^sub_/);
    const upsellSub = await s.createSubscription("acct_1", {
      customerId: "cus_1",
      stripePriceId: price,
      extraPriceIds: [],
      paymentMethodId: "pm_1",
      metadata: {},
      idempotencyKey: "k4",
    });
    expect(upsellSub.subscription.id).toMatch(/^sub_/);
  });

  it("refunds", async () => {
    const r = await s.refundPayment("acct_1", "pi_1", 500);
    expect(r.id).toMatch(/^re_/);
  });
});
