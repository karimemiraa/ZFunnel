import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("checkDomainDns", async () => {
  process.env.ROOT_DOMAIN = "zfunnel.app";
  const { checkDomainDns } = await import("./domains");
  const resolver = (txt: string[][], cname: string[]) => ({
    resolveTxt: vi.fn(async () => txt),
    resolveCname: vi.fn(async () => cname),
    resolve4: vi.fn(async () => [] as string[]),
  });

  it("passes when both records are set", async () => {
    const r = await checkDomainDns("offer.acme.com", "zf-abc", resolver([["zf-abc"]], ["sites.zfunnel.app."]) as never);
    expect(r).toEqual({ ownership: true, routing: true, problems: [] });
  });
  it("explains what's missing", async () => {
    const r = await checkDomainDns("offer.acme.com", "zf-abc", resolver([["other"]], []) as never);
    expect(r.ownership).toBe(false);
    expect(r.routing).toBe(false);
    expect(r.problems).toHaveLength(2);
  });
  it("treats DNS errors as not found", async () => {
    const failing = {
      resolveTxt: vi.fn(async () => Promise.reject(new Error("ENOTFOUND"))),
      resolveCname: vi.fn(async () => Promise.reject(new Error("ENODATA"))),
      resolve4: vi.fn(async () => []),
    };
    const r = await checkDomainDns("offer.acme.com", "zf-abc", failing as never);
    expect(r.ownership).toBe(false);
  });
});
