import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./tenancy";

const ws = () =>
  uuid()
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

/** API keys are shown once; only a SHA-256 hash is stored. */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: ws(),
    name: text().notNull(),
    /** First characters, to recognise a key in the list. */
    prefix: text().notNull(),
    hash: text().notNull().unique(),
    lastUsedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("api_keys_ws_idx").on(t.workspaceId)],
);

export const WEBHOOK_EVENTS = [
  "contact.opted_in",
  "contact.tagged",
  "order.paid",
  "form.submitted",
  "booking.created",
  "webinar.registered",
  "webinar.attended",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: ws(),
    url: text().notNull(),
    events: jsonb().$type<WebhookEvent[]>().notNull(),
    /** Signing secret (whsec_…), shown to the owner so receivers can verify signatures. */
    secret: text().notNull(),
    status: text().$type<"active" | "disabled">().notNull().default("active"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_endpoints_ws_idx").on(t.workspaceId)],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: ws(),
    endpointId: uuid()
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    event: text().notNull(),
    /** Source event id: makes fan-out idempotent when a job is retried. */
    eventId: text().notNull(),
    payload: jsonb().notNull(),
    status: text().$type<"pending" | "succeeded" | "failed">().notNull().default("pending"),
    responseCode: integer(),
    error: text(),
    attempts: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("webhook_deliveries_endpoint_idx").on(t.endpointId, t.createdAt),
    uniqueIndex("webhook_deliveries_event_uq").on(t.endpointId, t.eventId),
  ],
);
