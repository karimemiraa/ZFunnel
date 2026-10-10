import { lookup as dnsLookup } from "node:dns";
import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import zlib from "node:zlib";

/**
 * Server-side fetching of user-supplied URLs (SSRF protection).
 * Server-only: imports node built-ins, so it lives on its own subpath (`@zfunnel/shared/net`).
 */

/** True for private, loopback, link-local (incl. cloud metadata), CGNAT, multicast and reserved addresses. */
export function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const l = ip.toLowerCase().replace(/^\[|\]$/g, "");
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(l);
    if (mapped) return isPrivateIp(mapped[1]!);
    if (/^::ffff:[0-9a-f]{1,4}:[0-9a-f]{1,4}$/.test(l)) return true; // hex-form IPv4-mapped: refuse
    return (
      l === "::1" ||
      l === "::" ||
      l.startsWith("fc") ||
      l.startsWith("fd") ||
      /^fe[89ab]/.test(l) || // fe80::/10 link-local
      l.startsWith("ff") || // multicast
      l.startsWith("64:ff9b:") || // NAT64 can reach IPv4 private space
      l.startsWith("2001:db8") ||
      l.startsWith("fec0")
    );
  }
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts as [number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) || // link-local, incl. 169.254.169.254 metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/** Origins (e.g. `http://127.0.0.1:4013`) exempt from the private-address check. Test setups only. */
function allowedOrigins(): Set<string> {
  return new Set(
    (process.env.FETCH_ALLOW_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Parses `raw` and accepts only absolute http(s) URLs without credentials. */
export function parsePublicHttpUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  return u;
}

/** Checks the URL's scheme and every address its host resolves to. */
export async function isPublicUrl(raw: string) {
  const u = parsePublicHttpUrl(raw);
  if (!u) return false;
  if (allowedOrigins().has(u.origin)) return true;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (!addrs.length) return false;
  return addrs.every((a) => !isPrivateIp(a));
}

export class SafeFetchError extends Error {
  constructor(
    readonly code: "blocked" | "timeout" | "too_large" | "http" | "redirects" | "network",
    message: string,
  ) {
    super(message);
  }
}

/**
 * DNS lookup used for the actual connection: it validates the resolved address, so a host that
 * re-resolves to a private IP after the pre-check (DNS rebinding) still can't be reached.
 */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as { address: string; family: number }[];
    const bad = list.find((a) => isPrivateIp(a.address));
    if (!list.length || bad) {
      return callback(Object.assign(new Error(`Blocked address for ${hostname}`), { code: "EBLOCKED" }), "", 4);
    }
    if (options.all) return (callback as unknown as (e: null, a: typeof list) => void)(null, list);
    callback(null, list[0]!.address, list[0]!.family);
  });
};

export type SafeFetchOptions = {
  /** Total time for the whole request including redirects (ms). */
  timeoutMs?: number;
  /** Maximum decoded body size in bytes. */
  maxBytes?: number;
  maxRedirects?: number;
  /** Accept header. */
  accept?: string;
};

export type SafeFetchResult = { url: string; status: number; contentType: string; body: Buffer };

/**
 * GET a user-supplied URL safely: http(s) only, every hop (including redirects) must resolve to a
 * public address, the connection is pinned to the validated address, and time and size are capped.
 */
export async function safeFetch(raw: string, opts: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const { timeoutMs = 10_000, maxBytes = 2_000_000, maxRedirects = 5 } = opts;
  const deadline = Date.now() + timeoutMs;
  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = parsePublicHttpUrl(current);
    if (!u) throw new SafeFetchError("blocked", "Only public http(s) URLs can be fetched");
    const exempt = allowedOrigins().has(u.origin);
    if (!exempt && !(await isPublicUrl(u.href)))
      throw new SafeFetchError("blocked", "This address is private or can't be resolved");
    const res = await requestOnce(u, exempt, deadline - Date.now(), maxBytes, opts.accept ?? "*/*");
    if (res.status >= 300 && res.status < 400 && res.location) {
      current = new URL(res.location, u).href;
      continue;
    }
    if (res.status < 200 || res.status >= 300) throw new SafeFetchError("http", `HTTP ${res.status}`);
    return { url: u.href, status: res.status, contentType: res.contentType, body: res.body };
  }
  throw new SafeFetchError("redirects", "Too many redirects");
}

function requestOnce(
  u: URL,
  exempt: boolean,
  remainingMs: number,
  maxBytes: number,
  accept: string,
): Promise<{ status: number; location?: string; contentType: string; body: Buffer }> {
  if (remainingMs <= 0) return Promise.reject(new SafeFetchError("timeout", "Timed out"));
  const mod = u.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request(
      u,
      {
        method: "GET",
        lookup: exempt ? undefined : guardedLookup,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; ZFunnelImporter/1.0)",
          accept,
          "accept-encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location, contentType: "", body: Buffer.alloc(0) });
        }
        const declared = Number(res.headers["content-length"] ?? 0);
        if (declared > maxBytes && !res.headers["content-encoding"]) {
          res.destroy();
          return reject(new SafeFetchError("too_large", "Response is too large"));
        }
        const enc = String(res.headers["content-encoding"] ?? "").toLowerCase();
        const stream =
          enc === "gzip"
            ? res.pipe(zlib.createGunzip())
            : enc === "deflate"
              ? res.pipe(zlib.createInflate())
              : enc === "br"
                ? res.pipe(zlib.createBrotliDecompress())
                : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            req.destroy();
            stream.destroy();
            reject(new SafeFetchError("too_large", "Response is too large"));
            return;
          }
          chunks.push(c);
        });
        stream.on("end", () =>
          resolve({ status, contentType: String(res.headers["content-type"] ?? ""), body: Buffer.concat(chunks) }),
        );
        stream.on("error", (e) => reject(new SafeFetchError("network", e.message)));
      },
    );
    req.setTimeout(remainingMs, () => {
      req.destroy();
      reject(new SafeFetchError("timeout", "Timed out"));
    });
    const timer = setTimeout(() => {
      req.destroy();
      reject(new SafeFetchError("timeout", "Timed out"));
    }, remainingMs);
    req.on("close", () => clearTimeout(timer));
    req.on("error", (e: NodeJS.ErrnoException) =>
      reject(new SafeFetchError(e.code === "EBLOCKED" ? "blocked" : "network", e.message)),
    );
    req.end();
  });
}
