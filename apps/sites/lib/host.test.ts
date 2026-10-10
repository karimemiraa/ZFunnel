import { describe, expect, it } from "vitest";
import { isPlatformHost, subdomainFromHost } from "./host";

describe("subdomainFromHost", () => {
  it("extracts a single-label subdomain", () => {
    expect(subdomainFromHost("acme.zfunnel.app", "zfunnel.app")).toBe("acme");
    expect(subdomainFromHost("ACME.zfunnel.app", "zfunnel.app")).toBe("acme");
    expect(subdomainFromHost("acme.localhost:3001", "localhost:3001")).toBe("acme");
  });

  it("ignores the root, nested and foreign hosts", () => {
    expect(subdomainFromHost("zfunnel.app", "zfunnel.app")).toBeNull();
    expect(subdomainFromHost("a.b.zfunnel.app", "zfunnel.app")).toBeNull();
    expect(subdomainFromHost("evilzfunnel.app", "zfunnel.app")).toBeNull();
    expect(subdomainFromHost("shop.example.com", "zfunnel.app")).toBeNull();
    expect(subdomainFromHost(null, "zfunnel.app")).toBeNull();
  });
});

describe("isPlatformHost", () => {
  it("approves the platform's own hosts only", () => {
    expect(isPlatformHost("zfunnel.app", "zfunnel.app")).toBe(true);
    expect(isPlatformHost("app.zfunnel.app", "zfunnel.app")).toBe(true);
    expect(isPlatformHost("sites.zfunnel.app", "zfunnel.app")).toBe(true);
    expect(isPlatformHost("evil.zfunnel.app", "zfunnel.app")).toBe(false);
    expect(isPlatformHost("app.evil.com", "zfunnel.app")).toBe(false);
  });
});
