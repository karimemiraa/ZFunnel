import { and, eq, subscriptions } from "@zfunnel/db";
import { getPaymentSetup, setCancelAtPeriodEnd, system } from "@zfunnel/payments";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, publicPost } from "@/lib/api";
import { currentCustomer } from "@/lib/customer";

const schema = z.object({ id: z.string().uuid(), cancel: z.boolean() });

/** Cancel at period end (or resume) one of the signed-in customer's subscriptions. */
export async function POST(req: Request) {
  const g = await publicPost(req, "account-sub", 10);
  if ("error" in g) return g.error;
  const customer = await currentCustomer(g.ws.id);
  if (!customer) return jsonError("Please sign in again.", 401);
  const parsed = schema.safeParse(g.body);
  if (!parsed.success) return jsonError("Invalid request.");
  const { id, cancel } = parsed.data;
  const sub = await system(async (tx) => {
    const [s] = await tx
      .select()
      .from(subscriptions)
      .where(
        and(eq(subscriptions.id, id), eq(subscriptions.workspaceId, g.ws.id), eq(subscriptions.contactId, customer.id)),
      );
    return s ?? null;
  });
  if (!sub) return jsonError("Subscription not found.", 404);
  if (!["active", "trialing", "past_due"].includes(sub.status))
    return jsonError("This subscription has already ended.");
  if (sub.provider === "stripe") {
    const setup = await system((tx) => getPaymentSetup(tx, g.ws.id));
    if (setup?.provider !== "stripe" || !sub.externalId) return jsonError("Payments are unavailable right now.", 503);
    try {
      await setCancelAtPeriodEnd(setup.accountId, sub.externalId, cancel);
    } catch (err) {
      console.error("[account] cancel", (err as Error).message);
      return jsonError("We couldn't update your subscription. Please try again.", 502);
    }
  }
  await system((tx) => tx.update(subscriptions).set({ cancelAtPeriodEnd: cancel }).where(eq(subscriptions.id, sub.id)));
  return NextResponse.json({ ok: true });
}
