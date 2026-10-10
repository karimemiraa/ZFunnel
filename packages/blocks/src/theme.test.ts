import { describe, expect, it } from "vitest";
import { contrastText, isDark, themeVars } from "./theme";

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
