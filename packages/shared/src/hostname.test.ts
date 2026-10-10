import { describe, expect, it } from "vitest";
import { isUnderDomain, normalizeHostname } from "./hostname";

describe("normalizeHostname", () => {
  it("cleans up typical input", () => {
    expect(normalizeHostname("https://Offer.Acme.com/path?x=1")).toBe("offer.acme.com");
    expect(normalizeHostname("www.acme.co.uk.")).toBe("www.acme.co.uk");
    expect(normalizeHostname("acme.com:443")).toBe("acme.com");
  });
  it("rejects junk", () => {
    expect(normalizeHostname("localhost")).toBeNull();
    expect(normalizeHostname("192.168.0.1")).toBeNull();
    expect(normalizeHostname("-bad.com")).toBeNull();
    expect(normalizeHostname("a b.com")).toBeNull();
  });
  it("detects platform domains", () => {
    expect(isUnderDomain("x.zfunnel.app", "zfunnel.app")).toBe(true);
    expect(isUnderDomain("zfunnel.app", "zfunnel.app")).toBe(true);
    expect(isUnderDomain("evilzfunnel.app", "zfunnel.app")).toBe(false);
  });
});
