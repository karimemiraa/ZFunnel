import { and, contacts, eq } from "@zfunnel/db";
import { system } from "@zfunnel/payments";
import { enqueue } from "@zfunnel/queue";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, publicPost } from "@/lib/api";
import { queueLoginLink, requestOrigin } from "@/lib/customer";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("errors.invalidEmail").max(254),
  // Same-site path only (never a full URL): prevents open redirects.
  next: z
    .string()
    .regex(/^\/[a-z0-9/_-]{0,200}$/i)
    .optional(),
});

/**
 * Sends a one-time sign-in link. Always answers the same way, so it can't be used
 * to find out who is a customer.
 */
export async function POST(req: Request) {
  const g = await publicPost(req, "account-login", 5);
  if ("error" in g) return g.error;
  const parsed = schema.safeParse(g.body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]!.message);
  const origin = requestOrigin(req.headers);
  const messageId = await system(async (tx) => {
    const [c] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.workspaceId, g.ws.id), eq(contacts.email, parsed.data.email)));
    if (!c) return null;
    return queueLoginLink(tx, {
      workspaceId: g.ws.id,
      workspaceName: g.ws.name,
      locale: g.ws.siteLocale,
      contactId: c.id,
      email: parsed.data.email,
      origin,
      next: parsed.data.next,
    });
  });
  if (messageId) await enqueue("email", { messageId }, { jobId: `msg-${messageId}` });
  return NextResponse.json({ ok: true });
}
