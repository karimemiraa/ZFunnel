import "server-only";

import { getDb, platformAuditLog, withSystem, type Tx } from "@zfunnel/db";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getSession } from "./session";
import { isPlatformAdminUser, VIEW_AS_COOKIE, verifyViewAs, type ViewAsClaim } from "./platform-admin";

/**
 * Platform admin guard (ADR-024). Admins are listed in PLATFORM_ADMIN_EMAILS and must have a
 * verified email. Everyone else, signed in or not, gets a plain 404: the area does not exist.
 */
export const currentAdmin = cache(async () => {
  const session = await getSession();
  return session && isPlatformAdminUser(session.user, process.env.PLATFORM_ADMIN_EMAILS) ? session.user : null;
});

/** For pages and server actions under /admin. Never returns for non-admins. */
export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) notFound();
  return admin;
}

/** Cross-tenant queries for the admin area: the guard runs first, then the system context. */
export async function asAdmin<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  await requireAdmin();
  return withSystem(getDb(), fn);
}

/** Every admin action lands in platform_audit_log. */
export async function logAdminAction(
  adminUserId: string,
  entry: { action: string; targetType: string; targetId?: string | null; metadata?: Record<string, unknown> },
) {
  await withSystem(getDb(), (tx) => tx.insert(platformAuditLog).values({ adminUserId, ...entry }));
}

export function viewAsSecret() {
  return process.env.BETTER_AUTH_SECRET ?? "";
}

/**
 * The current read-only "view as" session for this user, if any. Valid only while the
 * signature holds, it has not expired, it was issued to this user, and they are still an admin.
 */
export async function getViewAs(userId: string): Promise<ViewAsClaim | null> {
  const claim = verifyViewAs((await cookies()).get(VIEW_AS_COOKIE)?.value, viewAsSecret());
  if (!claim || claim.adminUserId !== userId) return null;
  return (await currentAdmin())?.id === userId ? claim : null;
}
