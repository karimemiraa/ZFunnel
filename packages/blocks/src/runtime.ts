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
  description?: string | null;
  amount: number;
  currency: string;
  interval?: "month" | "year" | null;
  /** Bump copy shown in the checkbox box. */
  headline?: string | null;
};

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
