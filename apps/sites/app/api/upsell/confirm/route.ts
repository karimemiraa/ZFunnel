import { and, eq, payments } from "@zfunnel/db";
import { getPaymentSetup, markPaymentSucceeded, retrievePaymentIntent, system } from "@zfunnel/payments";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, publicPost } from "@/lib/api";
import { resolveStepForWorkspace } from "@/lib/resolve";

/** After the buyer completes 3-D Secure for an upsell in the browser, verify and finalize it. */
export async function POST(req: Request) {
  const g = await publicPost(req, "upsell-confirm");
  if ("error" in g) return g.error;
  const parsed = z.object({ paymentId: z.string().uuid(), stepId: z.string().uuid() }).safeParse(g.body);
  if (!parsed.success) return jsonError("Invalid request.");

  const loaded = await system(async (tx) => {
    const [p] = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.id, parsed.data.paymentId), eq(payments.workspaceId, g.ws.id)));
    return { payment: p, setup: await getPaymentSetup(tx, g.ws.id) };
  });
  if (!loaded.payment?.externalId || loaded.setup?.provider !== "stripe") return jsonError("Payment not found.", 404);
  const pi = await retrievePaymentIntent(loaded.setup.accountId, loaded.payment.externalId);
  if (pi.status !== "succeeded") return jsonError("The payment wasn't confirmed.", 402);
  await system((tx) => markPaymentSucceeded(tx, loaded.payment!.id));
  const step = await resolveStepForWorkspace(g.ws.id, parsed.data.stepId);
  return NextResponse.json({ ok: true, redirect: step?.nextPath ?? null });
}
