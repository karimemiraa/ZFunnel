import "server-only";

import { and, asc, bookings, calendars, desc, eq, gte, lt, sql } from "@zfunnel/db";
import { inWorkspace } from "./funnels";
import type { WorkspaceContext } from "./workspaces";

export async function listCalendars(ctx: WorkspaceContext) {
  return inWorkspace(ctx, (tx) =>
    tx
      .select({
        c: calendars,
        upcoming: sql<number>`(select count(*)::int from bookings b where b.calendar_id = "calendars"."id" and b.status = 'confirmed' and b.start_at >= now())`,
      })
      .from(calendars)
      .orderBy(asc(calendars.name)),
  );
}

export async function getCalendar(ctx: WorkspaceContext, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [c] = await inWorkspace(ctx, (tx) => tx.select().from(calendars).where(eq(calendars.id, id)));
  return c ?? null;
}

export async function listBookings(ctx: WorkspaceContext, opts: { calendarId?: string; past?: boolean } = {}) {
  return inWorkspace(ctx, (tx) =>
    tx
      .select({ b: bookings, calendar: calendars.name, tz: calendars.timezone })
      .from(bookings)
      .innerJoin(calendars, eq(calendars.id, bookings.calendarId))
      .where(
        and(
          opts.calendarId ? eq(bookings.calendarId, opts.calendarId) : undefined,
          opts.past ? lt(bookings.startAt, sql`now()`) : gte(bookings.startAt, sql`now()`),
        ),
      )
      .orderBy(opts.past ? desc(bookings.startAt) : asc(bookings.startAt))
      .limit(200),
  );
}
