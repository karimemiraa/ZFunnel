import { and, contacts, desc, emailMessages, eq, sql } from "@zfunnel/db";
import { system } from "@zfunnel/payments";
import { enqueue } from "@zfunnel/queue";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, publicPost } from "@/lib/api";
import { requestOrigin } from "@/lib/customer";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(254),
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
    // At most one link per minute per contact.
    const [recent] = await tx
      .select({ id: emailMessages.id })
      .from(emailMessages)
      .where(
        and(
          eq(emailMessages.contactId, c.id),
          sql`${emailMessages.meta}->>'kind' = 'login'`,
          sql`${emailMessages.createdAt} > now() - interval '1 minute'`,
        ),
      )
      .orderBy(desc(emailMessages.createdAt))
      .limit(1);
    if (recent) return null;
    const [m] = await tx
      .insert(emailMessages)
      .values({
        workspaceId: g.ws.id,
        contactId: c.id,
        toEmail: parsed.data.email,
        subject: `Your sign-in link for ${g.ws.name}`,
        meta: { kind: "login", siteOrigin: origin },
      })
      .returning({ id: emailMessages.id });
    return m!.id;
  });
  if (messageId) await enqueue("email", { messageId }, { jobId: `msg-${messageId}` });
  return NextResponse.json({ ok: true });
}
