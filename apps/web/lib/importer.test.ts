import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./funnels", () => ({ inWorkspace: vi.fn() }));
const { parseUrlList, sniffImage } = await import("./importer");

describe("parseUrlList", () => {
  it("keeps order, trims, dedupes and adds https:// when missing", () => {
    expect(
      parseUrlList(" https://a.example/optin \n\nacme.myclickfunnels.com/thanks\nhttps://a.example/optin\n"),
    ).toEqual({
      ok: true,
      urls: ["https://a.example/optin", "https://acme.myclickfunnels.com/thanks"],
    });
  });
  it("rejects empty input, too many URLs and non-web schemes", () => {
    expect(parseUrlList("  \n")).toEqual({ ok: false, error: "none" });
    expect(parseUrlList(Array.from({ length: 11 }, (_, i) => `https://x.example/${i}`).join("\n"))).toEqual({
      ok: false,
      error: "tooMany",
    });
    expect(parseUrlList("ftp://x.example/a")).toMatchObject({ ok: false, error: "invalid" });
    expect(parseUrlList("https://user:pw@x.example/")).toMatchObject({ ok: false, error: "invalid" });
  });
});

describe("sniffImage", () => {
  it("detects raster formats from their bytes and refuses SVG/HTML", () => {
    const pad = Buffer.alloc(16);
    expect(sniffImage(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), pad]))).toBe("image/png");
    expect(sniffImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), pad]))).toBe("image/jpeg");
    expect(sniffImage(Buffer.concat([Buffer.from("GIF89a"), pad]))).toBe("image/gif");
    expect(sniffImage(Buffer.concat([Buffer.from("RIFF\0\0\0\0WEBP"), pad]))).toBe("image/webp");
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    expect(sniffImage(Buffer.from("<html><body>hi</body></html>"))).toBeNull();
  });
});
