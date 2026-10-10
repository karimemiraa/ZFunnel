import { describe, expect, it } from "vitest";
import { computeSlots, isValidTimezone, zonedToUtc, type SlotRules } from "./slots";

const rules: SlotRules = {
  timezone: "America/New_York",
  availability: { mon: [{ start: "09:00", end: "11:00" }] },
  durationMinutes: 30,
  bufferMinutes: 0,
  minNoticeHours: 0,
  maxDaysAhead: 7,
};
// Sunday 2026-10-11 12:00 UTC
const now = new Date("2026-10-11T12:00:00Z");

describe("slots", () => {
  it("converts wall-clock time across DST", () => {
    expect(zonedToUtc(2026, 7, 1, 9, 0, "America/New_York").toISOString()).toBe("2026-07-01T13:00:00.000Z"); // EDT
    expect(zonedToUtc(2026, 12, 1, 9, 0, "America/New_York").toISOString()).toBe("2026-12-01T14:00:00.000Z"); // EST
    expect(zonedToUtc(2026, 7, 1, 9, 0, "Asia/Dubai").toISOString()).toBe("2026-07-01T05:00:00.000Z");
  });

  it("produces slots inside availability, in the calendar's timezone", () => {
    const s = computeSlots(rules, [], now);
    expect(s.map((d) => d.toISOString())).toEqual([
      "2026-10-12T13:00:00.000Z",
      "2026-10-12T13:30:00.000Z",
      "2026-10-12T14:00:00.000Z",
      "2026-10-12T14:30:00.000Z",
    ]);
  });

  it("skips booked times (with buffer) and respects minimum notice", () => {
    const busy = [{ start: new Date("2026-10-12T13:30:00Z"), end: new Date("2026-10-12T14:00:00Z") }];
    const s = computeSlots({ ...rules, bufferMinutes: 15 }, busy, now).map((d) => d.toISOString());
    expect(s).not.toContain("2026-10-12T13:30:00.000Z");
    expect(computeSlots({ ...rules, minNoticeHours: 48 }, [], now)).toHaveLength(0);
  });

  it("validates timezones", () => {
    expect(isValidTimezone("Europe/Berlin")).toBe(true);
    expect(isValidTimezone("Mars/Base")).toBe(false);
  });
});
