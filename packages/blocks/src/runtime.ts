/**
 * Context passed to blocks via Puck `metadata`. The editor passes `{ mode: "editor" }`;
 * the public renderer fills in the funnel URLs and endpoints for the current step.
 */
export type BlockRuntime = {
  /** editor: inside Puck · preview: dashboard draft preview (forms don't submit) · live: published page. */
  mode: "editor" | "preview" | "live";
  /** Where "next step" buttons and successful forms go (accept path). */
  nextUrl?: string;
  /** Where "No thanks" links go on upsell steps. */
  declineUrl?: string;
  stepId?: string;
  /** Store checkout (no funnel step): the price being bought and whether to ask for an address. */
  store?: { priceId: string; shipping: boolean };
  /** Public API base for forms and checkout, e.g. "/api". */
  apiBase?: string;
  /** Offers attached to this step, resolved server-side (Phase 1.7+). */
  offers?: RuntimeOffer[];
  /** Payment provider info for checkout blocks. */
  payments?: { provider: "stripe" | "test"; publishableKey?: string; accountId?: string } | null;
};

export type RuntimeOffer = {
  id: string;
  role: "main" | "bump" | "upsell" | "downsell";
  name: string;
  label?: string | null;
  description?: string | null;
  type: "one_time" | "recurring" | "payment_plan";
  amount: number;
  currency: string;
  interval?: "month" | "year" | null;
  trialDays?: number | null;
  installments?: number | null;
  /** Bump copy shown in the checkbox box. */
  headline?: string | null;
};

/** "$47", "$29/month", "3 × $99/month", "7-day free trial, then $29/month". */
export function describePrice(
  o: Pick<RuntimeOffer, "amount" | "currency" | "type" | "interval" | "trialDays" | "installments">,
) {
  const money = formatMoney(o.amount, o.currency);
  if (o.type === "one_time") return money;
  const per = `${money}/${o.interval ?? "month"}`;
  const base = o.type === "payment_plan" && o.installments ? `${o.installments} × ${per}` : per;
  return o.trialDays ? `${o.trialDays}-day free trial, then ${base}` : base;
}

/** Placeholder offers so checkout blocks look real in the editor before products are attached. */
export const SAMPLE_OFFERS: RuntimeOffer[] = [
  {
    id: "sample-main",
    role: "main",
    name: "Complete Course",
    description: "Lifetime access",
    type: "one_time",
    amount: 9700,
    currency: "usd",
  },
  {
    id: "sample-bump",
    role: "bump",
    name: "Done-for-you templates",
    headline: "Yes! Add the templates",
    description: "Save 20+ hours with ready-made swipe files.",
    type: "one_time",
    amount: 2700,
    currency: "usd",
  },
  {
    id: "sample-upsell",
    role: "upsell",
    name: "VIP Coaching",
    description: "4 private calls",
    type: "one_time",
    amount: 19700,
    currency: "usd",
  },
];

export function getRuntime(metadata: unknown): BlockRuntime {
  const m = (metadata ?? {}) as Partial<BlockRuntime>;
  return { ...m, mode: m.mode ?? "editor" };
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}
