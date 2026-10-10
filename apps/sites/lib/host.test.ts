import { describe, expect, it } from "vitest";
import { subdomainFromHost } from "./host";

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
