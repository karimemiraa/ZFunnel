import { describe, expect, it } from "vitest";
import { isPublicUrl, triggerMatches } from "./workflows";

const ev = (type: "optin" | "purchase" | "tag_added", data: Record<string, string> = {}) => ({
  workspaceId: "w",
  contactId: "c",
  type,
  data,
});

describe("triggerMatches", () => {
  it("matches any funnel or a specific one", () => {
    expect(triggerMatches({ type: "optin" }, ev("optin", { funnelId: "f1" }))).toBe(true);
    expect(triggerMatches({ type: "optin", funnelId: "f1" }, ev("optin", { funnelId: "f1" }))).toBe(true);
    expect(triggerMatches({ type: "optin", funnelId: "f2" }, ev("optin", { funnelId: "f1" }))).toBe(false);
  });
  it("matches purchases by product", () => {
    expect(triggerMatches({ type: "purchase", productId: "p2" }, ev("purchase", { productIds: "p1,p2" }))).toBe(true);
    expect(triggerMatches({ type: "purchase", productId: "p3" }, ev("purchase", { productIds: "p1,p2" }))).toBe(false);
  });
  it("matches tags case-insensitively and never across event types", () => {
    expect(triggerMatches({ type: "tag_added", tag: "VIP" }, ev("tag_added", { tag: "vip" }))).toBe(true);
    expect(triggerMatches({ type: "tag_added", tag: "vip" }, ev("optin"))).toBe(false);
  });
});

describe("isPublicUrl", () => {
  it("blocks private, loopback and metadata addresses", async () => {
    for (const u of [
      "http://127.0.0.1/x",
      "http://10.0.0.5",
      "http://169.254.169.254/latest",
      "http://[::1]/",
      "http://192.168.1.1",
      "file:///etc/passwd",
      "not a url",
    ])
      expect(await isPublicUrl(u), u).toBe(false);
  });
  it("allows public IPs", async () => {
    expect(await isPublicUrl("https://1.1.1.1/hook")).toBe(true);
  });
});
