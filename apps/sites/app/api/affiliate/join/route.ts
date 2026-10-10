import { affiliates, contacts, sql } from "@zfunnel/db";
import { system } from "@zfunnel/payments";
import { enqueue } from "@zfunnel/queue";
import { slugify } from "@zfunnel/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { affiliateProgram } from "@/lib/affiliate";
import { jsonError, publicPost } from "@/lib/api";
import { currentCustomer, queueLoginLink, requestOrigin } from "@/lib/customer";

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(120).optional(),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(254).optional(),
});

/** Joins the affiliate program. Signed-in customers join directly; others get a sign-in link. */
export async function POST(req: Request) {
  const g = await publicPost(req, "affiliate-join", 5);
  if ("error" in g) return g.error;
  const program = await affiliateProgram(g.ws.id);
  if (!program) return jsonError("The affiliate program isn't open.", 404);
  const p = schema.safeParse(g.body);
  if (!p.success) return jsonError(p.error.issues[0]!.message);
  const me = await currentCustomer(g.ws.id);
  const email = me?.email ?? p.data.email;
  if (!email) return jsonError("Please enter your email.");
  const origin = requestOrigin(req.headers);
  const messageId = await system(async (tx) => {
    const [c] = await tx
      .insert(contacts)
      .values({ workspaceId: g.ws.id, email, name: p.data.name ?? null, consentAt: new Date(), consentIp: g.ip })
      .onConflictDoUpdate({
        target: [contacts.workspaceId, contacts.email],
        set: { name: sql`coalesce(${contacts.name}, excluded.name)`, updatedAt: new Date() },
      })
      .returning({ id: contacts.id, name: contacts.name });
    const base = (slugify(c!.name ?? email.split("@")[0]!) || "partner").slice(0, 20);
    // Random suffix: codes are public and must not be guessable from a name.
    const code = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    await tx.insert(affiliates).values({ workspaceId: g.ws.id, contactId: c!.id, code }).onConflictDoNothing();
    return me
      ? null
      : queueLoginLink(tx, {
          workspaceId: g.ws.id,
          workspaceName: g.ws.name,
          contactId: c!.id,
          email,
          origin,
          next: "/affiliate",
        });
  });
  if (messageId) await enqueue("email", { messageId }, { jobId: `msg-${messageId}` });
  return NextResponse.json({ ok: true, signedIn: Boolean(me) });
}
