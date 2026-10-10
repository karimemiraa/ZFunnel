import { describe, expect, it } from "vitest";
import { formatMoney, parseMoney } from "./money";

describe("money", () => {
  it("parses amounts into cents", () => {
    expect(parseMoney("49")).toBe(4900);
    expect(parseMoney("$1,299.99")).toBe(129999);
    expect(parseMoney("19,5")).toBe(1950);
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("1.999")).toBeNull();
  });
  it("formats cents", () => {
    expect(formatMoney(4700, "usd")).toBe("$47");
    expect(formatMoney(4750, "eur")).toBe("€47.50");
  });
});
