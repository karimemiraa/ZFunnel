import "server-only";

import { and, bookings, calendars, eq, gte } from "@zfunnel/db";
import { system } from "@zfunnel/payments";
import { computeSlots } from "@zfunnel/shared";

export async function calendarBySlug(workspaceId: string, slug: string) {
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return null;
  const [c] = await system((tx) =>
    tx
      .select()
      .from(calendars)
      .where(and(eq(calendars.workspaceId, workspaceId), eq(calendars.slug, slug), eq(calendars.status, "active"))),
  );
  return c ?? null;
}

export async function freeSlots(cal: NonNullable<Awaited<ReturnType<typeof calendarBySlug>>>, now = new Date()) {
  const busy = await system((tx) =>
    tx
      .select({ start: bookings.startAt, end: bookings.endAt })
      .from(bookings)
      .where(and(eq(bookings.calendarId, cal.id), eq(bookings.status, "confirmed"), gte(bookings.endAt, now))),
  );
  return computeSlots(
    {
      timezone: cal.timezone,
      availability: cal.availability,
      durationMinutes: cal.durationMinutes,
      bufferMinutes: cal.bufferMinutes,
      minNoticeHours: cal.minNoticeHours,
      maxDaysAhead: cal.maxDaysAhead,
    },
    busy,
    now,
  );
}
