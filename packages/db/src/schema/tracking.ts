import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./tenancy";

const ws = () =>
  uuid()
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

/**
 * Server-side conversion APIs. Tokens are encrypted (sealSecret). A platform is on when its id
 * and token are both set.
 */
export const trackingSettings = pgTable("tracking_settings", {
  workspaceId: ws().primaryKey(),
  metaPixelId: text(),
  metaTokenSealed: text(),
  metaTestCode: text(),
  tiktokPixelCode: text(),
  tiktokTokenSealed: text(),
  tiktokTestCode: text(),
  ga4MeasurementId: text(),
  ga4SecretSealed: text(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ConversionPlatform = "meta" | "tiktok" | "ga4";

/** One server-side event per platform. The payload holds hashed identifiers only (plus IP and user agent). */
export const conversionDeliveries = pgTable(
  "conversion_deliveries",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: ws(),
    platform: text().$type<ConversionPlatform>().notNull(),
    /** Lead or Purchase. */
    event: text().notNull(),
    /** Shared with the browser pixel for deduplication. */
    eventId: text().notNull(),
    payload: jsonb().$type<Record<string, unknown>>().notNull(),
    status: text().$type<"pending" | "sent" | "failed">().notNull().default("pending"),
    responseCode: integer(),
    error: text(),
    attempts: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("conversion_deliveries_event_uq").on(t.platform, t.eventId),
    index("conversion_deliveries_ws_idx").on(t.workspaceId, t.createdAt),
  ],
);
