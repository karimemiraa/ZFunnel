import { zonedDate, zonedToUtc } from "./slots";

export type WebinarSchedule =
  /** Repeats on these weekdays (0 = Sunday) at these local times ("HH:MM"). */
  | { kind: "evergreen"; days: number[]; times: string[]; justInTime: boolean }
  /** One live session. */
  | { kind: "live"; startAt: string };

const MIN = 60_000;

/**
 * Next session start times (UTC) after `now`, earliest first. A session that started
 * less than `graceMinutes` ago still counts, so people can join late.
 * "Just in time" adds a session at the next quarter hour that is at least 5 minutes away.
 */
export function upcomingSessions(
  schedule: WebinarSchedule,
  timezone: string,
  now = new Date(),
  count = 3,
  graceMinutes = 0,
): Date[] {
  const from = now.getTime() - graceMinutes * MIN;
  if (schedule.kind === "live") {
    const t = new Date(schedule.startAt);
    return Number.isNaN(t.getTime()) || t.getTime() < from ? [] : [t];
  }
  const out: Date[] = [];
  if (schedule.justInTime) {
    const q = 15 * MIN;
    out.push(new Date(Math.ceil((now.getTime() + 5 * MIN) / q) * q));
  }
  const times = schedule.times
    .map((t) => /^(\d{2}):(\d{2})$/.exec(t))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => [Number(m[1]), Number(m[2])] as const)
    .sort((a, b) => a[0] * 60 + a[1] - (b[0] * 60 + b[1]));
  if (times.length && schedule.days.length) {
    const today = zonedDate(now, timezone);
    for (let i = 0; i < 15 && out.length < count + 1; i++) {
      const d = new Date(Date.UTC(today.y, today.m - 1, today.d + i));
      if (!schedule.days.includes(d.getUTCDay())) continue;
      for (const [hh, mm] of times) {
        const t = zonedToUtc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hh, mm, timezone);
        if (t.getTime() >= from) out.push(t);
      }
    }
  }
  const seen = new Set<number>();
  return out
    .sort((a, b) => a.getTime() - b.getTime())
    .filter((d) => (seen.has(d.getTime()) ? false : (seen.add(d.getTime()), true)))
    .slice(0, count);
}

export type WebinarPhase = "waiting" | "live" | "replay" | "ended";

/** Where a viewer is relative to their session: before, during, replay window, or over. */
export function webinarPhase(
  sessionAt: Date,
  durationMinutes: number,
  replayHours: number,
  now = new Date(),
): { phase: WebinarPhase; elapsedSeconds: number } {
  const elapsed = Math.floor((now.getTime() - sessionAt.getTime()) / 1000);
  if (elapsed < 0) return { phase: "waiting", elapsedSeconds: elapsed };
  if (elapsed < durationMinutes * 60) return { phase: "live", elapsedSeconds: elapsed };
  if (elapsed < durationMinutes * 60 + replayHours * 3600) return { phase: "replay", elapsedSeconds: elapsed };
  return { phase: "ended", elapsedSeconds: elapsed };
}

export type VideoSource =
  { kind: "youtube"; id: string } | { kind: "vimeo"; id: string } | { kind: "file"; url: string };

/** Accepts YouTube (watch, youtu.be, live, embed, shorts), Vimeo and direct .mp4/.webm https links. */
export function parseVideoUrl(input: string): VideoSource | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^(www|m)\./, "");
  const yt = /^[\w-]{11}$/;
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|live|shorts)\/([\w-]{11})/)?.[1];
    return v && yt.test(v) ? { kind: "youtube", id: v } : null;
  }
  if (host === "youtu.be") {
    const v = u.pathname.slice(1, 12);
    return yt.test(v) ? { kind: "youtube", id: v } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = u.pathname.match(/\/(?:video\/)?(\d{6,12})/)?.[1];
    return id ? { kind: "vimeo", id } : null;
  }
  if (/\.(mp4|webm)$/i.test(u.pathname)) return { kind: "file", url: u.toString() };
  return null;
}
