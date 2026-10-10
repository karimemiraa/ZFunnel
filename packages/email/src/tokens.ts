import { createHmac, timingSafeEqual } from "node:crypto";

/** Signed, URL-safe tokens for open/click/unsubscribe links (no guessable ids). */
function secret() {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is not set");
  return s;
}

/** o = open pixel, c = click, u = unsubscribe, l = customer-center login link. */
export function signToken(kind: "o" | "c" | "u" | "l", messageId: string) {
  const mac = createHmac("sha256", secret()).update(`${kind}:${messageId}`).digest("base64url").slice(0, 22);
  return `${messageId}.${mac}`;
}

export function verifyToken(kind: "o" | "c" | "u" | "l", token: string): string | null {
  const [id, mac] = token.split(".");
  if (!id || !mac || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const expected = signToken(kind, id).split(".")[1]!;
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export function trackingUrls(appUrl: string, messageId: string) {
  const base = appUrl.replace(/\/$/, "");
  return {
    open: `${base}/e/o/${signToken("o", messageId)}`,
    click: (url: string) => `${base}/e/c/${signToken("c", messageId)}?u=${encodeURIComponent(url)}`,
    unsubscribe: `${base}/e/u/${signToken("u", messageId)}`,
  };
}

/** Signs an arbitrary value (e.g. a customer session) for one purpose. */
export function signValue(purpose: string, value: string) {
  const mac = createHmac("sha256", secret()).update(`${purpose}:${value}`).digest("base64url").slice(0, 32);
  return `${value}.${mac}`;
}

export function verifyValue(purpose: string, token: string): string | null {
  const i = token.lastIndexOf(".");
  if (i < 1) return null;
  const value = token.slice(0, i);
  const a = Buffer.from(token.slice(i + 1));
  const b = Buffer.from(signValue(purpose, value).slice(i + 1));
  return a.length === b.length && timingSafeEqual(a, b) ? value : null;
}
