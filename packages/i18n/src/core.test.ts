import { describe, expect, it } from "vitest";
import { createTranslator, negotiate } from "./core";

const en = { a: { hi: "Hi {name}", items: { zero: "No items", one: "One item", other: "{count} items" } } };
const ar = {
  a: {
    hi: "أهلًا {name}",
    items: {
      zero: "لا عناصر",
      one: "عنصر واحد",
      two: "عنصران",
      few: "{count} عناصر",
      many: "{count} عنصرًا",
      other: "{count} عنصر",
    },
  },
};

describe("translator", () => {
  it("interpolates and pluralizes English", () => {
    const t = createTranslator<typeof en>("en", en);
    expect(t("a.hi", { name: "Sam" })).toBe("Hi Sam");
    expect(t("a.items", { count: 0 })).toBe("No items");
    expect(t("a.items", { count: 1 })).toBe("One item");
    expect(t("a.items", { count: 1500 })).toBe("1,500 items");
  });
  it("uses all Arabic plural forms with Western digits", () => {
    const t = createTranslator<typeof en>("ar", ar);
    expect([0, 1, 2, 3, 11, 100].map((count) => t("a.items", { count }))).toEqual([
      "لا عناصر",
      "عنصر واحد",
      "عنصران",
      "3 عناصر",
      "11 عنصرًا",
      "100 عنصر",
    ]);
  });
  it("falls back to the key when missing", () => {
    const t = createTranslator<typeof en>("en", en);
    expect(t("a.nope" as never)).toBe("a.nope");
  });
  it("negotiates from Accept-Language", () => {
    expect(negotiate("ar-SA,ar;q=0.9,en;q=0.8")).toBe("ar");
    expect(negotiate("fr-FR,en;q=0.5")).toBe("en");
    expect(negotiate(null)).toBe("en");
  });
});
