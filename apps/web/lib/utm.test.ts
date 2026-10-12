import { describe, expect, it } from "vitest";
import { buildUtmUrl, normalizeUtmValue, qrFileName } from "./utm";

describe("UTM builder", () => {
  it("adds only the filled parameters, normalized", () => {
    expect(buildUtmUrl("https://acme.zfunnel.app/f/sales", { source: "Facebook", medium: "paid social" })).toBe(
      "https://acme.zfunnel.app/f/sales?utm_source=facebook&utm_medium=paid_social",
    );
  });
  it("keeps other parameters and the hash, and replaces old utm values", () => {
    expect(buildUtmUrl("https://a.co/p?ref=1&utm_source=old#buy", { source: "google", campaign: "Spring 2026" })).toBe(
      "https://a.co/p?ref=1&utm_source=google&utm_campaign=spring_2026#buy",
    );
    expect(buildUtmUrl("https://a.co/p?utm_term=x", {})).toBe("https://a.co/p");
  });
  it("keeps Arabic campaign names readable once decoded", () => {
    const url = buildUtmUrl("https://a.co/p", { campaign: "عروض رمضان" })!;
    expect(new URL(url).searchParams.get("utm_campaign")).toBe("عروض_رمضان");
  });
  it("refuses non-web URLs", () => {
    expect(buildUtmUrl("javascript:alert(1)", { source: "x" })).toBeNull();
    expect(buildUtmUrl("not a url", {})).toBeNull();
  });
  it("normalizes values and names QR files", () => {
    expect(normalizeUtmValue("  Big  Sale ")).toBe("big_sale");
    expect(qrFileName("sales-page", { source: "Instagram", campaign: "launch!" }, "svg")).toBe(
      "qr-sales-page-instagram-launch.svg",
    );
  });
});
