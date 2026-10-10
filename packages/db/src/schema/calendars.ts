import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { workspaces } from "./tenancy";

export type Availability = Partial<
  Record<"sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat", { start: string; end: string }[]>
>;

export const calendars = pgTable(
  "calendars",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text().notNull(),
    slug: text().notNull(),
    description: text().notNull().default(""),
    location: text().notNull().default(""),
    durationMinutes: integer().notNull().default(30),
    bufferMinutes: integer().notNull().default(0),
    minNoticeHours: integer().notNull().default(12),
    maxDaysAhead: integer().notNull().default(30),
    timezone: text().notNull().default("UTC"),
    availability: jsonb().$type<Availability>().notNull(),
    status: text().$type<"active" | "paused">().notNull().default("active"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("calendars_ws_slug_uq").on(t.workspaceId, t.slug)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    calendarId: uuid()
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    contactId: uuid().references(() => contacts.id, { onDelete: "set null" }),
    name: text().notNull(),
    email: text().notNull(),
    notes: text().notNull().default(""),
    startAt: timestamp({ withTimezone: true }).notNull(),
    endAt: timestamp({ withTimezone: true }).notNull(),
    status: text().$type<"confirmed" | "cancelled">().notNull().default("confirmed"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Two people can never book the same start time (race-safe).
    uniqueIndex("bookings_slot_uq")
      .on(t.calendarId, t.startAt)
      .where(sql`status = 'confirmed'`),
    index("bookings_calendar_time_idx").on(t.calendarId, t.startAt),
  ],
);
export type Calendar = typeof calendars.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
