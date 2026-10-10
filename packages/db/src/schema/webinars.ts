import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { workspaces } from "./tenancy";

const ws = () =>
  uuid()
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

/** Mirrors WebinarSchedule in @zfunnel/shared. */
export type WebinarScheduleJson =
  { kind: "evergreen"; days: number[]; times: string[]; justInTime: boolean } | { kind: "live"; startAt: string };

export const webinars = pgTable(
  "webinars",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: ws(),
    title: text().notNull(),
    slug: text().notNull(),
    description: text().notNull().default(""),
    /** YouTube / Vimeo / .mp4 link (a live stream link for live webinars). */
    videoUrl: text().notNull().default(""),
    schedule: jsonb().$type<WebinarScheduleJson>().notNull(),
    timezone: text().notNull().default("UTC"),
    durationMinutes: integer().notNull().default(60),
    /** Hours the replay stays available after the session ends (0 = no replay). */
    replayHours: integer().notNull().default(48),
    /** Call to action shown from `offerAtMinute` (null = no offer). */
    offerLabel: text(),
    offerUrl: text(),
    offerAtMinute: integer(),
    status: text().$type<"draft" | "published">().notNull().default("draft"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("webinars_ws_slug_uq").on(t.workspaceId, t.slug)],
);

export const webinarRegistrations = pgTable(
  "webinar_registrations",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: ws(),
    webinarId: uuid()
      .notNull()
      .references(() => webinars.id, { onDelete: "cascade" }),
    contactId: uuid()
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    sessionAt: timestamp({ withTimezone: true }).notNull(),
    /** Secret in the personal watch link. */
    token: text().notNull().unique(),
    attendedAt: timestamp({ withTimezone: true }),
    offerClickedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("webinar_registrations_once_uq").on(t.webinarId, t.contactId, t.sessionAt),
    index("webinar_registrations_webinar_idx").on(t.webinarId, t.sessionAt),
  ],
);
