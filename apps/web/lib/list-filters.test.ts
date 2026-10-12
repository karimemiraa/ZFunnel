import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  cleanFilters,
  dateRange,
  filtersFromParams,
  filtersToQuery,
  hasFilters,
  sameFilters,
  toCents,
} from "./list-filters";

const FUNNEL = "4f7c2b1e-1111-4a2b-9c3d-0123456789ab";

describe("list filters", () => {
  it("keeps valid filters and drops everything else", () => {
    expect(
      cleanFilters("contacts", {
        q: "  lena ",
        tags: "VIP, buyer ,,bad;tag",
        from: "2026-01-01",
        to: "2026-13-40",
        funnel: FUNNEL,
        status: "customer",
        min: "10.5",
        max: "-3",
        evil: "drop table",
      }),
    ).toEqual({ q: "lena", tags: ["vip", "buyer"], from: "2026-01-01", funnel: FUNNEL, status: "customer", min: 10.5 });
  });

  it("only accepts statuses of the right list", () => {
    expect(cleanFilters("contacts", { status: "paid" }).status).toBeUndefined();
    expect(cleanFilters("orders", { status: "paid" }).status).toBe("paid");
    expect(cleanFilters("orders", { status: "customer" }).status).toBeUndefined();
  });

  it("rejects a funnel that is not a uuid", () => {
    expect(cleanFilters("orders", { funnel: "../etc" }).funnel).toBeUndefined();
  });

  it("still understands the old single ?tag= link", () => {
    expect(filtersFromParams("contacts", { tag: "VIP" }).tags).toEqual(["vip"]);
  });

  it("round-trips through the URL in a stable order", () => {
    const f = cleanFilters("orders", { max: 99, tags: ["b", "a"], status: "refunded", from: "2026-02-01" });
    const q = filtersToQuery(f);
    expect(q).toBe("tags=b%2Ca&from=2026-02-01&status=refunded&max=99");
    expect(filtersFromParams("orders", Object.fromEntries(new URLSearchParams(q)))).toEqual(f);
    expect(sameFilters(f, { ...f })).toBe(true);
    expect(sameFilters(f, { ...f, max: 100 })).toBe(false);
  });

  it("counts active filters for the badge, not the search", () => {
    expect(activeFilterCount({ q: "x" })).toBe(0);
    expect(hasFilters({ q: "x" })).toBe(true);
    expect(activeFilterCount({ tags: ["a", "b"], from: "2026-01-01", to: "2026-01-02", min: 1, max: 2 })).toBe(4);
  });

  it("turns the date range into an inclusive UTC window", () => {
    const { start, end } = dateRange({ from: "2026-03-01", to: "2026-03-01" });
    expect(start?.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(end?.toISOString()).toBe("2026-03-02T00:00:00.000Z");
    expect(dateRange({})).toEqual({ start: undefined, end: undefined });
  });

  it("converts amounts to cents", () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents(undefined)).toBeUndefined();
  });
});
