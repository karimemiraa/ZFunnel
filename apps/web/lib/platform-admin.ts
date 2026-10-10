import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Pure helpers for the platform admin area (no Next.js imports, so they are unit tested).
 * The server-side guard that uses them lives in ./admin.ts.
 */

/** Parses PLATFORM_ADMIN_EMAILS: comma-separated, whitespace-tolerant, case-insensitive. */
export function parseAdminEmails(raw: string | undefined | null): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@")),
  );
}

/** A platform admin is a user whose email is listed AND verified. */
export function isPlatformAdminUser(
  user: { email: string; emailVerified: boolean } | null | undefined,
  raw: string | undefined | null,
): boolean {
  if (!user?.emailVerified) return false;
  return parseAdminEmails(raw).has(user.email.trim().toLowerCase());
}

/** Read-only "view as" session: which admin, which workspace, until when. */
export type ViewAsClaim = { adminUserId: string; workspaceId: string; slug: string; expiresAt: number };

export const VIEW_AS_COOKIE = "zf_view_as";
export const VIEW_AS_TTL_MS = 30 * 60_000;

function mac(payload: string, secret: string) {
  return createHmac("sha256", `view-as:${secret}`).update(payload).digest("base64url");
}

export function signViewAs(claim: ViewAsClaim, secret: string): string {
  const payload = Buffer.from(JSON.stringify(claim)).toString("base64url");
  return `${payload}.${mac(payload, secret)}`;
}

/** Returns the claim when the signature is valid and it has not expired, else null. */
export function verifyViewAs(token: string | undefined | null, secret: string, now = Date.now()): ViewAsClaim | null {
  if (!token || !secret) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(mac(payload, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString()) as ViewAsClaim;
    if (
      typeof claim.adminUserId !== "string" ||
      typeof claim.workspaceId !== "string" ||
      typeof claim.slug !== "string" ||
      typeof claim.expiresAt !== "number" ||
      claim.expiresAt <= now
    )
      return null;
    return claim;
  } catch {
    return null;
  }
}
