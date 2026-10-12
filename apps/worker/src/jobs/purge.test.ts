import { describe, expect, it } from "vitest";
import { PURGE_AFTER_DAYS, purgeCutoff } from "./purge";

describe("purgeCutoff", () => {
  it("keeps soft-deleted rows for 30 days", () => {
    expect(PURGE_AFTER_DAYS).toBe(30);
    const now = new Date("2026-10-31T12:00:00Z");
    expect(purgeCutoff(now).toISOString()).toBe("2026-10-01T12:00:00.000Z");
    expect(purgeCutoff(now, 1).toISOString()).toBe("2026-10-30T12:00:00.000Z");
  });
});
