import { describe, expect, it } from "vitest";
import { compare, goalPace, lastDays, monthKey, periodWindows, rate, resolveGoal } from "./today-math";

const at = (s: string) => new Date(s);

describe("periodWindows", () => {
  it("compares today so far with the same hours yesterday", () => {
    const { current, previous } = periodWindows("today", at("2026-10-12T15:30:00Z"));
    expect(current.from.toISOString()).toBe("2026-10-12T00:00:00.000Z");
    expect(previous.from.toISOString()).toBe("2026-10-11T00:00:00.000Z");
    expect(previous.to.toISOString()).toBe("2026-10-11T15:30:00.000Z");
  });

  it("uses back-to-back rolling windows for 7d and 30d", () => {
    const now = at("2026-10-12T12:00:00Z");
    const w7 = periodWindows("7d", now);
    expect(w7.current.from.toISOString()).toBe("2026-10-05T12:00:00.000Z");
    expect(w7.previous.from.toISOString()).toBe("2026-09-28T12:00:00.000Z");
    expect(w7.previous.to.toISOString()).toBe(w7.current.from.toISOString());
    const w30 = periodWindows("30d", now);
    expect(w30.previous.to.getTime()).toBe(w30.current.from.getTime());
    expect(now.getTime() - w30.current.from.getTime()).toBe(30 * 86_400_000);
  });
});

describe("compare", () => {
  it("returns the relative change and direction", () => {
    expect(compare(150, 100)).toEqual({ ratio: 0.5, direction: "up" });
    expect(compare(50, 100)).toEqual({ ratio: -0.5, direction: "down" });
    expect(compare(100, 100)).toEqual({ ratio: 0, direction: "flat" });
  });
  it("has no ratio when the previous period was empty", () => {
    expect(compare(10, 0)).toEqual({ ratio: null, direction: "up" });
    expect(compare(0, 0)).toEqual({ ratio: null, direction: "flat" });
  });
  it("computes safe rates", () => {
    expect(rate(1, 4)).toBe(0.25);
    expect(rate(3, 0)).toBe(0);
  });
});

describe("goals", () => {
  const goals = [
    { month: "", amount: 1000 },
    { month: "2026-12", amount: 5000 },
  ];
  it("prefers a month override over the default", () => {
    expect(resolveGoal(goals, "2026-12")?.amount).toBe(5000);
    expect(resolveGoal(goals, "2026-10")?.amount).toBe(1000);
    expect(resolveGoal([], "2026-10")).toBeNull();
    expect(monthKey(at("2026-01-31T23:59:00Z"))).toBe("2026-01");
  });

  it("is on track at an even pace and projects linearly", () => {
    // Halfway through a 30-day month (Nov 16 00:00 UTC), half the goal reached.
    const p = goalPace(300_000, 150_000, at("2026-11-16T00:00:00Z"));
    expect(p.elapsed).toBeCloseTo(0.5);
    expect(p.expected).toBe(150_000);
    expect(p.projected).toBe(300_000);
    expect(p.status).toBe("on_track");
    expect(p.neededPerDay).toBe(10_000);
  });

  it("flags behind, ahead and met", () => {
    const now = at("2026-11-16T00:00:00Z");
    expect(goalPace(300_000, 100_000, now).status).toBe("behind");
    expect(goalPace(300_000, 200_000, now).status).toBe("ahead");
    const met = goalPace(300_000, 320_000, now);
    expect(met.status).toBe("met");
    expect(met.neededPerDay).toBe(0);
    expect(met.progress).toBeCloseTo(320_000 / 300_000);
  });

  it("does not explode in the first minutes of a month", () => {
    const p = goalPace(100_000, 5_000, at("2026-11-01T00:01:00Z"));
    expect(p.projected).toBe(5_000 * 30 * 24);
  });
});

it("lists continuous days ending today", () => {
  expect(lastDays(3, at("2026-03-01T10:00:00Z"))).toEqual(["2026-02-27", "2026-02-28", "2026-03-01"]);
});
