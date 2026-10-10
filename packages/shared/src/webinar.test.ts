import { describe, expect, it } from "vitest";
import { parseVideoUrl, upcomingSessions, webinarPhase } from "./webinar";

describe("webinar sessions", () => {
  // Saturday 2026-10-10 15:07 UTC = 17:07 in Berlin (CEST, UTC+2).
  const now = new Date("2026-10-10T15:07:00Z");

  it("lists the next evergreen sessions in the webinar's timezone", () => {
    const s = upcomingSessions(
      { kind: "evergreen", days: [0, 6], times: ["19:00", "10:00"], justInTime: false },
      "Europe/Berlin",
      now,
      3,
    );
    expect(s.map((d) => d.toISOString())).toEqual([
      "2026-10-10T17:00:00.000Z", // Sat 19:00 Berlin
      "2026-10-11T08:00:00.000Z", // Sun 10:00
      "2026-10-11T17:00:00.000Z", // Sun 19:00
    ]);
  });

  it("adds a just-in-time session at the next quarter hour, 5+ minutes away", () => {
    const s = upcomingSessions({ kind: "evergreen", days: [], times: [], justInTime: true }, "UTC", now, 3);
    expect(s.map((d) => d.toISOString())).toEqual(["2026-10-10T15:15:00.000Z"]);
  });

  it("returns a live session until it has started (plus grace)", () => {
    const live = { kind: "live" as const, startAt: "2026-10-10T15:00:00Z" };
    expect(upcomingSessions(live, "UTC", now)).toEqual([]);
    expect(upcomingSessions(live, "UTC", now, 3, 15)).toHaveLength(1);
  });

  it("computes the viewer's phase", () => {
    const at = new Date("2026-10-10T15:00:00Z");
    expect(webinarPhase(at, 60, 48, new Date("2026-10-10T14:59:00Z")).phase).toBe("waiting");
    expect(webinarPhase(at, 60, 48, now)).toEqual({ phase: "live", elapsedSeconds: 420 });
    expect(webinarPhase(at, 60, 48, new Date("2026-10-11T15:00:00Z")).phase).toBe("replay");
    expect(webinarPhase(at, 60, 0, new Date("2026-10-10T16:01:00Z")).phase).toBe("ended");
  });
});

describe("video links", () => {
  it("parses common formats", () => {
    expect(parseVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3")).toEqual({
      kind: "youtube",
      id: "dQw4w9WgXcQ",
    });
    expect(parseVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({ kind: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseVideoUrl("https://youtube.com/live/dQw4w9WgXcQ?si=x")).toEqual({ kind: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseVideoUrl("https://vimeo.com/76979871")).toEqual({ kind: "vimeo", id: "76979871" });
    expect(parseVideoUrl("https://cdn.example.com/talk.mp4")).toEqual({
      kind: "file",
      url: "https://cdn.example.com/talk.mp4",
    });
  });
  it("rejects anything else", () => {
    expect(parseVideoUrl("http://youtu.be/dQw4w9WgXcQ")).toBeNull();
    expect(parseVideoUrl("javascript:alert(1)")).toBeNull();
    expect(parseVideoUrl("https://evil.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });
});
