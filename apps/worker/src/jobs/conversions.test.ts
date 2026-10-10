import { describe, expect, it } from "vitest";
import { buildGa4, buildMeta, buildTikTok, sha256, type ConversionInput } from "./conversions";

const base: ConversionInput = {
  event: "Purchase",
  eventId: "order-1",
  time: 1_700_000_000,
  email: "  Ann@Example.com ",
  phone: "+1 (415) 555-0100",
  contactId: "c1",
  ctx: { ip: "203.0.113.9", ua: "UA", url: "https://shop.test/checkout", fbp: "fb.1.1.2", ttclid: "tt1" },
  value: 47.5,
  currency: "usd",
  orderId: "o1",
};

describe("conversion payloads", () => {
  it("hashes identifiers and never sends them in clear text", () => {
    const meta = JSON.stringify(buildMeta(base));
    expect(meta).not.toContain("Ann@Example.com");
    expect(meta).not.toContain("ann@example.com");
    expect(meta).toContain(sha256("ann@example.com"));
    expect(meta).toContain(sha256("14155550100"));
  });
  it("builds a Meta purchase with dedup id and value", () => {
    const b = buildMeta(base, "TEST123") as { data: Record<string, unknown>[]; test_event_code: string };
    expect(b.test_event_code).toBe("TEST123");
    expect(b.data[0]).toMatchObject({
      event_name: "Purchase",
      event_id: "order-1",
      action_source: "website",
      custom_data: { currency: "USD", value: 47.5, order_id: "o1" },
      user_data: { client_ip_address: "203.0.113.9", fbp: "fb.1.1.2" },
    });
  });
  it("maps leads to TikTok SubmitForm without properties", () => {
    const b = buildTikTok({ ...base, event: "Lead", value: undefined, currency: undefined }, "PIX") as {
      event_source_id: string;
      data: Record<string, unknown>[];
    };
    expect(b.event_source_id).toBe("PIX");
    expect(b.data[0]!.event).toBe("SubmitForm");
    expect(b.data[0]!.properties).toBeUndefined();
    expect(b.data[0]!.user).toMatchObject({ ttclid: "tt1" });
  });
  it("builds GA4 events with a stable client id fallback", () => {
    const a = buildGa4(base);
    expect(a.events[0]).toMatchObject({ name: "purchase", params: { currency: "USD", value: 47.5 } });
    expect(buildGa4(base).client_id).toBe(a.client_id);
    expect(buildGa4({ ...base, ctx: { gaClientId: "123.456" } }).client_id).toBe("123.456");
  });
});
