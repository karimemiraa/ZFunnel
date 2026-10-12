import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./tenancy";

export type NotificationType = "order" | "lead" | "chat" | "payment_failed" | "booking";

/**
 * Dashboard notifications center (Phase 8.5i). Workspace-scoped events written best-effort
 * where they happen (checkout, webhooks, public forms, chat, bookings). The text is rendered
 * from `type` + `data` in the viewer's language, so nothing language-specific is stored.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    type: text().$type<NotificationType>().notNull(),
    /** The record it is about (order, contact, conversation, booking), for the link. */
    entityId: uuid(),
    /** Small display payload: names, amounts, order numbers. Never card data. */
    data: jsonb().$type<Record<string, string | number | null>>().notNull().default({}),
    /** Users (auth user ids) who have read it: read state is per user, the event is shared. */
    readBy: text().array().notNull().default([]),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_ws_created_idx").on(t.workspaceId, t.createdAt)],
);
