/**
 * Booking slot computation (pure, no dependencies). Availability is defined in the
 * calendar's IANA timezone; slots are returned as UTC instants.
 */
export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export type Availability = Partial<Record<Weekday, { start: string; end: string }[]>>;

export type SlotRules = {
  timezone: string;
  availability: Availability;
  durationMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
};

const MIN = 60_000;

/** Offset (ms) of `tz` from UTC at instant `date`. */
export function tzOffset(date: Date, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Wall-clock time in `tz` → UTC instant (handles DST by re-checking the offset). */
export function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - tzOffset(new Date(guess), tz);
  t = guess - tzOffset(new Date(t), tz);
  return new Date(t);
}

/** Calendar date (y, m, d) and weekday of an instant in `tz`. */
export function zonedDate(date: Date, tz: string) {
  const s = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => s.find((p) => p.type === t)!.value;
  return {
    y: +get("year"),
    m: +get("month"),
    d: +get("day"),
    weekday: get("weekday").toLowerCase().slice(0, 3) as Weekday,
  };
}

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/**
 * Free slot start times from `now` until maxDaysAhead, skipping anything that would
 * overlap an existing booking (plus buffer) or fall inside the minimum notice.
 */
export function computeSlots(rules: SlotRules, busy: { start: Date; end: Date }[], now = new Date()): Date[] {
  const out: Date[] = [];
  const earliest = now.getTime() + rules.minNoticeHours * 60 * MIN;
  const dur = rules.durationMinutes * MIN;
  const buf = rules.bufferMinutes * MIN;
  const step = Math.max(15, rules.durationMinutes + rules.bufferMinutes) * MIN;
  const startDay = zonedDate(now, rules.timezone);
  for (let i = 0; i <= rules.maxDaysAhead; i++) {
    // Noon UTC of the i-th local day avoids DST edge cases when walking days.
    const probe = new Date(Date.UTC(startDay.y, startDay.m - 1, startDay.d + i, 12));
    const { y, m, d, weekday } = { ...zonedDate(probe, "UTC"), weekday: WEEKDAYS[probe.getUTCDay()]! };
    for (const win of rules.availability[weekday] ?? []) {
      const winStart = zonedToUtc(
        y,
        m,
        d,
        Math.floor(toMin(win.start) / 60),
        toMin(win.start) % 60,
        rules.timezone,
      ).getTime();
      const winEnd = zonedToUtc(
        y,
        m,
        d,
        Math.floor(toMin(win.end) / 60),
        toMin(win.end) % 60,
        rules.timezone,
      ).getTime();
      for (let t = winStart; t + dur <= winEnd; t += step) {
        if (t < earliest) continue;
        const clash = busy.some((b) => t < b.end.getTime() + buf && t + dur + buf > b.start.getTime());
        if (!clash) out.push(new Date(t));
      }
    }
  }
  return out;
}
