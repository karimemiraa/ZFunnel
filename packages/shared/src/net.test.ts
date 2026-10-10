import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { isPrivateIp, isPublicUrl, parsePublicHttpUrl, safeFetch, SafeFetchError } from "./net";

describe("isPrivateIp", () => {
  it("flags private, loopback, link-local, metadata and reserved ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.0.10",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "255.255.255.255",
      "::1",
      "::",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:7f00:1",
      "64:ff9b::a00:1",
      "999.1.1.1",
    ])
      expect(isPrivateIp(ip), ip).toBe(true);
  });
  it("accepts public addresses", () => {
    for (const ip of ["1.1.1.1", "8.8.8.8", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])
      expect(isPrivateIp(ip), ip).toBe(false);
  });
});

describe("parsePublicHttpUrl / isPublicUrl", () => {
  it("rejects other schemes and credentials", () => {
    expect(parsePublicHttpUrl("file:///etc/passwd")).toBeNull();
    expect(parsePublicHttpUrl("gopher://x")).toBeNull();
    expect(parsePublicHttpUrl("javascript:alert(1)")).toBeNull();
    expect(parsePublicHttpUrl("https://user:pw@example.com")).toBeNull();
    expect(parsePublicHttpUrl("https://example.com/a")?.hostname).toBe("example.com");
  });
  it("blocks private literals and decimal/hex IPv4 forms", async () => {
    for (const u of [
      "http://127.0.0.1/",
      "http://2130706433/",
      "http://0x7f000001/",
      "http://[::1]/",
      "http://169.254.169.254/latest/meta-data",
      "http://localhost/",
    ])
      expect(await isPublicUrl(u), u).toBe(false);
  });
  it("allows a public IP literal", async () => {
    expect(await isPublicUrl("https://1.1.1.1/")).toBe(true);
  });
});

describe("safeFetch", () => {
  let server: http.Server;
  let base = "";
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === "/ok") return res.end("<h1>hi</h1>");
      if (req.url === "/big") return res.end("x".repeat(5000));
      if (req.url === "/to-private") {
        res.writeHead(302, { location: "http://169.254.169.254/latest" });
        return res.end();
      }
      if (req.url === "/to-ok") {
        res.writeHead(301, { location: "/ok" });
        return res.end();
      }
      if (req.url === "/loop") {
        res.writeHead(302, { location: "/loop" });
        return res.end();
      }
      if (req.url === "/slow") return setTimeout(() => res.end("late"), 2000);
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise((r) => server.close(r)));
  afterEach(() => {
    delete process.env.FETCH_ALLOW_ORIGINS;
  });

  const code = async (p: Promise<unknown>) => {
    try {
      await p;
      return "ok";
    } catch (e) {
      return e instanceof SafeFetchError ? e.code : String(e);
    }
  };

  it("refuses loopback servers by default", async () => {
    expect(await code(safeFetch(`${base}/ok`))).toBe("blocked");
  });

  it("fetches an allow-listed test origin and follows safe redirects", async () => {
    process.env.FETCH_ALLOW_ORIGINS = base;
    const r = await safeFetch(`${base}/to-ok`);
    expect(r.body.toString()).toBe("<h1>hi</h1>");
    expect(r.url).toBe(`${base}/ok`);
  });

  it("re-checks every redirect hop", async () => {
    process.env.FETCH_ALLOW_ORIGINS = base;
    expect(await code(safeFetch(`${base}/to-private`))).toBe("blocked");
  });

  it("caps redirects, size and time", async () => {
    process.env.FETCH_ALLOW_ORIGINS = base;
    expect(await code(safeFetch(`${base}/loop`, { maxRedirects: 3 }))).toBe("redirects");
    expect(await code(safeFetch(`${base}/big`, { maxBytes: 1000 }))).toBe("too_large");
    expect(await code(safeFetch(`${base}/slow`, { timeoutMs: 200 }))).toBe("timeout");
    expect(await code(safeFetch(`${base}/missing`))).toBe("http");
  });
});
