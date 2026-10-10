import { describe, expect, it } from "vitest";
import { formatMoney, minimumAmount, minorUnits, parseMoney, sumByCurrency } from "./money";

describe("money", () => {
  it("knows minor units", () => {
    expect(minorUnits("usd")).toBe(2);
    expect(minorUnits("JPY")).toBe(0);
    expect(minorUnits("kwd")).toBe(3);
  });
  it("parses into minor units", () => {
    expect(parseMoney("49")).toBe(4900);
    expect(parseMoney("$1,299.99")).toBe(129999);
    expect(parseMoney("19,5")).toBe(1950);
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("1.999")).toBeNull();
    expect(parseMoney("4,700", "jpy")).toBe(4700);
    expect(parseMoney("47.5", "jpy")).toBeNull();
    expect(parseMoney("12.345", "kwd")).toBe(12350);
    expect(parseMoney("12.5", "kwd")).toBe(12500);
  });
  it("formats minor units", () => {
    expect(formatMoney(4700, "usd")).toBe("$47");
    expect(formatMoney(4750, "eur")).toBe("€47.50");
    expect(formatMoney(4700, "jpy")).toBe("¥4,700");
    expect(formatMoney(12500, "kwd")).toMatch(/^KWD\s12\.500$/);
    expect(formatMoney(4750, "eur", "de-DE")).toMatch(/^47,50\s€$/);
  });
  it("has sane minimums and sums per currency", () => {
    expect(minimumAmount("usd")).toBe(50);
    expect(minimumAmount("jpy")).toBe(50);
    expect(minimumAmount("kwd")).toBe(500);
    expect(
      sumByCurrency([
        { amount: 100, currency: "usd" },
        { amount: 5, currency: "eur" },
        { amount: 50, currency: "usd" },
      ]),
    ).toEqual([
      { currency: "usd", amount: 150 },
      { currency: "eur", amount: 5 },
    ]);
  });
});
