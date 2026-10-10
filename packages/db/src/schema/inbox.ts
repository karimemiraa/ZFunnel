import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { workspaces } from "./tenancy";

const ws = () =>
  uuid()
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

/** Site chat widget: one row per workspace (absent = off). */
export const chatSettings = pgTable("chat_settings", {
  workspaceId: ws().primaryKey(),
  enabled: boolean().notNull().default(false),
  greeting: text().notNull().default("Hi there 👋 How can we help?"),
  color: text().notNull().default("#4f46e5"),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const conversations = pgTable(
  "conversations",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: ws(),
    contactId: uuid().references(() => contacts.id, { onDelete: "set null" }),
    /** Random secret kept in the visitor's cookie; proves they own the thread. */
    visitorToken: text().notNull().unique(),
    name: text().notNull().default(""),
    email: text().notNull(),
    status: text().$type<"open" | "closed">().notNull().default("open"),
    /** The owner hasn't read the latest visitor message. */
    unread: boolean().notNull().default(true),
    /** Page the chat was started on. */
    pageUrl: text().notNull().default(""),
    lastMessageAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversations_ws_last_idx").on(t.workspaceId, t.status, t.lastMessageAt)],
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: ws(),
    conversationId: uuid()
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    sender: text().$type<"visitor" | "owner">().notNull(),
    /** Plain text (rendered escaped, never as HTML). */
    body: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("conversation_messages_conv_idx").on(t.conversationId, t.createdAt)],
);
