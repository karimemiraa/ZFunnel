import { bigserial, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./tenancy";
import { funnels } from "./funnels";

export type EventType = "view" | "optin" | "purchase" | "upsell" | "downsell";

/**
 * Funnel events (Umami-style, cookieless): `visitor` is a daily-rotating hash of
 * workspace + IP + user agent, so no personal data or cookies are stored.
 */
export const events = pgTable(
  "events",
  {
    id: bigserial({ mode: "number" }).primaryKey(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    funnelId: uuid().notNull(),
    stepId: uuid().notNull(),
    type: text().$type<EventType>().notNull(),
    /** Split-test variant shown (views only); null = the original page (A). */
    variantId: uuid(),
    visitor: text().notNull(),
    /** Cents, for purchase/upsell/downsell. */
    revenue: integer().notNull().default(0),
    currency: text(),
    props: jsonb().$type<{
      utmSource?: string;
      utmMedium?: string;
      utmCampaign?: string;
      referrer?: string;
      device?: "mobile" | "desktop" | "tablet";
    }>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_funnel_time_idx").on(t.workspaceId, t.funnelId, t.createdAt),
    index("events_step_type_idx").on(t.stepId, t.type),
    index("events_step_variant_idx").on(t.stepId, t.variantId, t.createdAt),
  ],
);

export type AnalyticsEvent = typeof events.$inferSelect;

export type CoachSuggestion = {
  title: string;
  /** Step name the advice is about, or null for the whole funnel. */
  step: string | null;
  why: string;
  change: string;
  impact: "high" | "medium" | "low";
};

/** AI conversion coach results; the newest row per funnel is shown. */
export const funnelInsights = pgTable(
  "funnel_insights",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    funnelId: uuid()
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    summary: text().notNull(),
    suggestions: jsonb().$type<CoachSuggestion[]>().notNull(),
    /** Range (days) and visitor count the advice was based on. */
    days: integer().notNull(),
    visitors: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("funnel_insights_funnel_idx").on(t.funnelId, t.createdAt)],
);
