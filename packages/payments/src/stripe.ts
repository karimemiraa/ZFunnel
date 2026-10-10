import Stripe from "stripe";

/**
 * Stripe Connect with direct charges: every call runs on the workspace's connected
 * account (`stripeAccount`), so money goes straight to our customer, never through us.
 */
let client: Stripe | null = null;

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key, {
      appInfo: { name: "ZFunnel" },
      maxNetworkRetries: 2,
      // Lets tests point the SDK at stripe-mock.
      ...(process.env.STRIPE_API_HOST
        ? {
            host: process.env.STRIPE_API_HOST,
            port: Number(process.env.STRIPE_API_PORT ?? 12111),
            protocol: "http" as const,
          }
        : {}),
    });
  }
  return client;
}

// ---------- Connect onboarding ----------

export async function createConnectedAccount(input: { email?: string; workspaceId: string }) {
  return stripe().accounts.create({
    email: input.email,
    // A "standard"-style account: the merchant gets the full Stripe dashboard and owns disputes/fees.
    controller: { stripe_dashboard: { type: "full" }, fees: { payer: "account" }, losses: { payments: "stripe" } },
    metadata: { zfunnel_workspace_id: input.workspaceId },
  });
}

export async function createOnboardingLink(accountId: string, urls: { refreshUrl: string; returnUrl: string }) {
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: urls.refreshUrl,
    return_url: urls.returnUrl,
  });
  return link.url;
}

export async function getAccountStatus(accountId: string) {
  const a = await stripe().accounts.retrieve(accountId);
  return {
    chargesEnabled: Boolean(a.charges_enabled),
    detailsSubmitted: Boolean(a.details_submitted),
    displayName: a.business_profile?.name ?? a.settings?.dashboard?.display_name ?? a.email ?? null,
  };
}

// ---------- Customers & payments ----------

export async function ensureCustomer(
  accountId: string,
  input: { customerId?: string | null; email: string; name?: string | null; contactId: string },
) {
  if (input.customerId) return input.customerId;
  const c = await stripe().customers.create(
    { email: input.email, name: input.name ?? undefined, metadata: { zfunnel_contact_id: input.contactId } },
    { stripeAccount: accountId },
  );
  return c.id;
}

/** First charge in a funnel: saves the card for one-click upsells. */
export async function createPaymentIntent(
  accountId: string,
  input: {
    amount: number;
    currency: string;
    customerId: string;
    description: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
  },
) {
  return stripe().paymentIntents.create(
    {
      amount: input.amount,
      currency: input.currency,
      customer: input.customerId,
      description: input.description,
      setup_future_usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata: input.metadata,
    },
    { stripeAccount: accountId, idempotencyKey: input.idempotencyKey },
  );
}

export async function retrievePaymentIntent(accountId: string, id: string) {
  return stripe().paymentIntents.retrieve(id, { expand: ["payment_method"] }, { stripeAccount: accountId });
}

export type OffSessionResult =
  | { status: "succeeded"; intentId: string }
  | { status: "requires_action"; intentId: string; clientSecret: string }
  | { status: "failed"; intentId?: string; message: string };

/** One-click upsell: charge the saved card without the buyer re-entering it. */
export async function chargeOffSession(
  accountId: string,
  input: {
    amount: number;
    currency: string;
    customerId: string;
    paymentMethodId: string;
    description: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
  },
): Promise<OffSessionResult> {
  try {
    const pi = await stripe().paymentIntents.create(
      {
        amount: input.amount,
        currency: input.currency,
        customer: input.customerId,
        payment_method: input.paymentMethodId,
        description: input.description,
        off_session: true,
        confirm: true,
        metadata: input.metadata,
      },
      { stripeAccount: accountId, idempotencyKey: input.idempotencyKey },
    );
    if (pi.status === "succeeded") return { status: "succeeded", intentId: pi.id };
    if (pi.status === "requires_action" && pi.client_secret)
      return { status: "requires_action", intentId: pi.id, clientSecret: pi.client_secret };
    return { status: "failed", intentId: pi.id, message: "The payment could not be completed." };
  } catch (err) {
    const e = err as {
      code?: string;
      raw?: { payment_intent?: { id: string; client_secret?: string } };
      message?: string;
    };
    // The bank wants the buyer to confirm (SCA / 3-D Secure): finish on-session.
    if (e.code === "authentication_required" && e.raw?.payment_intent?.client_secret)
      return {
        status: "requires_action",
        intentId: e.raw.payment_intent.id,
        clientSecret: e.raw.payment_intent.client_secret,
      };
    return { status: "failed", intentId: e.raw?.payment_intent?.id, message: e.message ?? "Your card was declined." };
  }
}

// ---------- Subscriptions ----------

/**
 * Mirrors our price on the connected account (needed for subscriptions and their add-on items).
 * `interval: null` creates a one-time price. Returns the Stripe price id.
 */
export async function ensureStripePrice(
  accountId: string,
  input: {
    stripePriceId?: string | null;
    productName: string;
    amount: number;
    currency: string;
    interval: "month" | "year" | null;
    zfPriceId: string;
  },
) {
  if (input.stripePriceId) return input.stripePriceId;
  const price = await stripe().prices.create(
    {
      currency: input.currency,
      unit_amount: input.amount,
      ...(input.interval ? { recurring: { interval: input.interval } } : {}),
      product_data: { name: input.productName, metadata: { zfunnel_price_id: input.zfPriceId } },
      metadata: { zfunnel_price_id: input.zfPriceId },
    },
    { stripeAccount: accountId },
  );
  return price.id;
}

export async function createSubscription(
  accountId: string,
  input: {
    customerId: string;
    stripePriceId: string;
    trialDays?: number | null;
    /** One-time Stripe prices (e.g. order bumps) billed on the first invoice. */
    extraPriceIds: string[];
    /** Set for upsells: charge the saved card immediately. */
    paymentMethodId?: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
    /** Payment plans end automatically after N installments. */
    cancelAt?: number;
  },
) {
  const sub = await stripe().subscriptions.create(
    {
      customer: input.customerId,
      items: [{ price: input.stripePriceId }],
      add_invoice_items: input.extraPriceIds.map((price) => ({ price })),
      trial_period_days: input.trialDays || undefined,
      cancel_at: input.cancelAt,
      metadata: input.metadata,
      ...(input.paymentMethodId
        ? {
            default_payment_method: input.paymentMethodId,
            off_session: true,
            payment_behavior: "error_if_incomplete" as const,
          }
        : {
            payment_behavior: "default_incomplete" as const,
            payment_settings: { save_default_payment_method: "on_subscription" as const },
          }),
      expand: ["latest_invoice.confirmation_secret", "pending_setup_intent"],
    },
    { stripeAccount: accountId, idempotencyKey: input.idempotencyKey },
  );
  const invoice = sub.latest_invoice && typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
  const setup =
    sub.pending_setup_intent && typeof sub.pending_setup_intent === "object" ? sub.pending_setup_intent : null;
  return {
    subscription: sub,
    /** Payment Element secret: invoice payment, or a setup intent when there's a free trial. */
    clientSecret: invoice?.confirmation_secret?.client_secret ?? setup?.client_secret ?? null,
    secretType: invoice?.confirmation_secret ? ("payment" as const) : ("setup" as const),
  };
}

export async function retrieveSubscription(accountId: string, id: string) {
  return stripe().subscriptions.retrieve(
    id,
    { expand: ["default_payment_method", "latest_invoice"] },
    { stripeAccount: accountId },
  );
}

/** Customer center: cancel at the end of the paid period, or undo that. */
export async function setCancelAtPeriodEnd(accountId: string, subscriptionId: string, cancel: boolean) {
  return stripe().subscriptions.update(subscriptionId, { cancel_at_period_end: cancel }, { stripeAccount: accountId });
}

export async function refundPayment(accountId: string, paymentIntentId: string, amount?: number) {
  return stripe().refunds.create({ payment_intent: paymentIntentId, amount }, { stripeAccount: accountId });
}

export function constructWebhookEvent(payload: string, signature: string) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return stripe().webhooks.constructEvent(payload, signature, secret);
}

export type { Stripe };
