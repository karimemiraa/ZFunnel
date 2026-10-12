/** Pure date and pace math for the Today home (no I/O, unit-tested). Days are UTC days. */

const DAY = 86_400_000;

export const PERIODS = ["today", "7d", "30d"] as const;
export type Period = (typeof PERIODS)[number];

export type Window = { from: Date; to: Date };

/** Start of the UTC day containing `d`. */
export const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * The current window for a period and the window it is compared with.
 * "today" is midnight → now, compared with yesterday's midnight → the same time yesterday,
 * so a morning is never compared with a full day. 7d/30d are rolling windows ending now,
 * compared with the window of the same length just before.
 */
export function periodWindows(period: Period, now: Date): { current: Window; previous: Window } {
  const from = period === "today" ? startOfDay(now) : new Date(now.getTime() - (period === "7d" ? 7 : 30) * DAY);
  const len = period === "today" ? DAY : now.getTime() - from.getTime();
  return {
    current: { from, to: now },
    previous: { from: new Date(from.getTime() - len), to: new Date(now.getTime() - len) },
  };
}

export type Delta = { ratio: number | null; direction: "up" | "down" | "flat" };

/** Change versus the previous period. `ratio` is null when there is nothing to compare with. */
export function compare(current: number, previous: number): Delta {
  if (current === previous) return { ratio: previous === 0 ? null : 0, direction: "flat" };
  const direction = current > previous ? "up" : "down";
  return { ratio: previous === 0 ? null : (current - previous) / previous, direction };
}

/** Conversion rate, 0 when there were no visitors. */
export const rate = (conversions: number, visitors: number) => (visitors > 0 ? conversions / visitors : 0);

/** "YYYY-MM" of a date (UTC). */
export const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

export function monthBounds(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end, days: Math.round((end.getTime() - start.getTime()) / DAY) };
}

/** The goal for a month: its own override, else the workspace default (month ""). */
export function resolveGoal<G extends { month: string }>(goals: G[], month: string): G | null {
  return goals.find((g) => g.month === month) ?? goals.find((g) => g.month === "") ?? null;
}

export type PaceStatus = "met" | "ahead" | "on_track" | "behind";

export type Pace = {
  /** Revenue / goal, uncapped. */
  progress: number;
  /** Share of the month that has passed. */
  elapsed: number;
  /** Revenue the month should have reached by now at an even pace. */
  expected: number;
  /** Month-end revenue if the current daily average holds. */
  projected: number;
  status: PaceStatus;
  /** Revenue still needed per remaining day to hit the goal (0 once met). */
  neededPerDay: number;
};

/**
 * Pace against a monthly goal. Projection is a straight-line run rate; at least one hour of
 * the month counts as elapsed, so a sale in the first minutes doesn't project to millions.
 * "On track" allows a 5% tolerance below the even-pace line; 10% above it is "ahead".
 */
export function goalPace(goal: number, revenue: number, now: Date): Pace {
  const { start, days } = monthBounds(now);
  const monthMs = days * DAY;
  const elapsedMs = Math.min(monthMs, Math.max(3_600_000, now.getTime() - start.getTime()));
  const elapsed = elapsedMs / monthMs;
  const expected = Math.round(goal * elapsed);
  const projected = Math.round(revenue / elapsed);
  const remainingDays = Math.max(1, Math.ceil((monthMs - elapsedMs) / DAY));
  const status: PaceStatus =
    revenue >= goal ? "met" : revenue >= expected * 1.1 ? "ahead" : revenue >= expected * 0.95 ? "on_track" : "behind";
  return {
    progress: goal > 0 ? revenue / goal : 0,
    elapsed,
    expected,
    projected,
    status,
    neededPerDay: revenue >= goal ? 0 : Math.ceil((goal - revenue) / remainingDays),
  };
}

/** Continuous list of UTC days ("YYYY-MM-DD") ending today. */
export function lastDays(n: number, now: Date) {
  const today = startOfDay(now).getTime();
  return Array.from({ length: n }, (_, i) => new Date(today - (n - 1 - i) * DAY).toISOString().slice(0, 10));
}
