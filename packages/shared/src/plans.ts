/**
 * ZFunnel's own subscription plans. PRICES AND LIMITS ARE PLACEHOLDERS: the business owner
 * sets them here (one place); Stripe prices are created from these values automatically.
 * `null` = unlimited.
 */
export type PlanId = "trial" | "starter" | "pro" | "scale";
export type LimitKey = "workspaces" | "funnels" | "contacts" | "emailsPerMonth" | "domains" | "members";
export type FeatureKey = "automations" | "splitTests" | "ai" | "whiteLabel";

export type Plan = {
  id: PlanId;
  name: string;
  /** Monthly price in USD cents (0 for the trial). */
  monthly: number;
  tagline: string;
  limits: Record<LimitKey, number | null>;
  features: Record<FeatureKey, boolean>;
};

export const TRIAL_DAYS = 14;

export const PLANS: Record<PlanId, Plan> = {
  trial: {
    id: "trial",
    name: "Free trial",
    monthly: 0,
    tagline: `Everything, free for ${TRIAL_DAYS} days`,
    limits: { workspaces: 1, funnels: 5, contacts: 500, emailsPerMonth: 1_000, domains: 1, members: 2 },
    features: { automations: true, splitTests: true, ai: true, whiteLabel: false },
  },
  starter: {
    id: "starter",
    name: "Starter",
    monthly: 4_900,
    tagline: "For your first funnels",
    limits: { workspaces: 1, funnels: 10, contacts: 2_500, emailsPerMonth: 10_000, domains: 1, members: 2 },
    features: { automations: true, splitTests: false, ai: false, whiteLabel: false },
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthly: 9_900,
    tagline: "For growing businesses",
    limits: { workspaces: 3, funnels: 50, contacts: 15_000, emailsPerMonth: 75_000, domains: 5, members: 5 },
    features: { automations: true, splitTests: true, ai: true, whiteLabel: true },
  },
  scale: {
    id: "scale",
    name: "Scale",
    monthly: 24_900,
    tagline: "For agencies and big lists",
    limits: { workspaces: 10, funnels: null, contacts: 100_000, emailsPerMonth: 500_000, domains: 25, members: 20 },
    features: { automations: true, splitTests: true, ai: true, whiteLabel: true },
  },
};

export const PAID_PLANS = [PLANS.starter, PLANS.pro, PLANS.scale];

/** English labels; the dashboard shows the localized `billing.limits.*` / `billing.features.*` keys. */
export const LIMIT_LABELS: Record<LimitKey, string> = {
  workspaces: "Workspaces",
  funnels: "Funnels",
  contacts: "Contacts",
  emailsPerMonth: "Emails this month",
  domains: "Custom domains",
  members: "Team members",
};

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  automations: "Automations",
  splitTests: "A/B split tests",
  ai: "AI copywriter",
  whiteLabel: "White-label (remove “Powered by”)",
};
