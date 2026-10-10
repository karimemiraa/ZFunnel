import { verifyToken } from "@zfunnel/email";
import { emailMessages, eq } from "@zfunnel/db";
import { system } from "@zfunnel/payments";
import { NextResponse } from "next/server";
import {
  CUSTOMER_COOKIE,
  customerCookieOptions,
  customerCookieValue,
  LOGIN_LINK_MINUTES,
  requestOrigin,
} from "@/lib/customer";
import { currentWorkspace } from "@/lib/site";

/** Magic-link landing: single use, expires after LOGIN_LINK_MINUTES, bound to this site. */
export async function GET(req: Request) {
  const origin = requestOrigin(req.headers);
  const fail = NextResponse.redirect(`${origin}/account?error=link`, 303);
  const ws = await currentWorkspace();
  const id = verifyToken("l", new URL(req.url).searchParams.get("t") ?? "");
  if (!ws || !id) return fail;
  let next = "/account";
  const contactId = await system(async (tx) => {
    const [m] = await tx.select().from(emailMessages).where(eq(emailMessages.id, id)).for("update");
    if (!m || m.workspaceId !== ws.id || m.meta?.kind !== "login" || m.meta.usedAt || !m.contactId) return null;
    if (Date.now() - m.createdAt.getTime() > LOGIN_LINK_MINUTES * 60_000) return null;
    if (m.meta.next && /^\/[a-z0-9/_-]{0,200}$/i.test(m.meta.next)) next = m.meta.next;
    await tx
      .update(emailMessages)
      .set({ meta: { ...m.meta, usedAt: new Date().toISOString() } })
      .where(eq(emailMessages.id, id));
    return m.contactId;
  });
  if (!contactId) return fail;
  const res = NextResponse.redirect(`${origin}${next}`, 303);
  res.cookies.set(CUSTOMER_COOKIE, customerCookieValue(contactId, ws.id), customerCookieOptions);
  return res;
}
