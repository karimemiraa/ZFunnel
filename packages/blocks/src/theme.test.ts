import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ARABIC_FONTS, arabicFontFor, contrastText, FONTS, fontStack, isDark, themeVars } from "./theme";

describe("theme", () => {
  it("picks readable text on buttons", () => {
    expect(contrastText("#ffffff")).toBe("#0b0b0f");
    expect(contrastText("#4f46e5")).toBe("#ffffff");
    expect(contrastText("#fde047")).toBe("#0b0b0f");
  });
  it("detects dark backgrounds", () => {
    expect(isDark("#0b0b14")).toBe(true);
    expect(isDark("#fffaf5")).toBe(false);
  });
  it("falls back to defaults for unknown values", () => {
    const v = themeVars({ headingFont: "nope" as never, radius: "huge" as never }) as Record<string, string>;
    expect(v["--zf-heading-font"]).toContain("Inter");
    expect(v["--zf-radius"]).toBe("12px");
  });
});

describe("Arabic font pairing", () => {
  it("pairs every Latin font with a registered Arabic font", () => {
    for (const f of Object.values(FONTS)) expect(ARABIC_FONTS).toHaveProperty(f.arabic);
    // At least six distinct Arabic faces are in use as pairs (success criterion 3).
    expect(new Set(Object.values(FONTS).map((f) => f.arabic)).size).toBeGreaterThanOrEqual(6);
  });

  it("uses the pair on auto and a user's choice otherwise", () => {
    expect(arabicFontFor("jakarta", "auto")).toBe("cairo");
    expect(arabicFontFor("playfair")).toBe("amiri");
    expect(arabicFontFor("jakarta", "tajawal")).toBe("tajawal");
    expect(arabicFontFor("jakarta", "bogus")).toBe("cairo");
    expect(arabicFontFor("bogus", "auto")).toBe("plex");
  });

  it("puts the Arabic face first on Arabic sites and the Latin face first elsewhere", () => {
    expect(fontStack("jakarta", "auto", "ar")).toMatch(/^'Cairo Variable', 'Plus Jakarta Sans Variable'/);
    expect(fontStack("jakarta", "auto", "en")).toMatch(/^'Plus Jakarta Sans Variable', 'Cairo Variable'/);
    expect(fontStack("playfair", "auto", "ar")).toContain("ui-serif");
    expect(fontStack("inter", "noto", "ar")).toBe(
      "'Noto Sans Arabic Variable', 'Inter Variable', ui-sans-serif, system-ui, sans-serif",
    );
  });

  it("feeds the stacks into the theme variables by site language", () => {
    const v = themeVars({ headingFont: "outfit", arabicBodyFont: "amiri" }, "ar") as Record<string, string>;
    expect(v["--zf-heading-font"]).toMatch(/^'Readex Pro Variable'/);
    expect(v["--zf-body-font"]).toMatch(/^'Amiri'/);
  });

  it("registers every Arabic family in fonts.css", () => {
    const css = readFileSync(new URL("./fonts.css", import.meta.url), "utf8");
    for (const pkg of [
      "noto-sans-arabic",
      "cairo",
      "tajawal",
      "ibm-plex-sans-arabic",
      "almarai",
      "readex-pro",
      "noto-kufi-arabic",
      "amiri",
      "el-messiri",
    ])
      expect(css).toContain(pkg);
  });
});
