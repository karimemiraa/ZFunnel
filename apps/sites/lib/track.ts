import "server-only";

import { createHash, createHmac } from "node:crypto";
import { events, getDb, withSystem, type EventType } from "@zfunnel/db";
import { clientIp } from "./rate-limit";

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|monitor|curl|wget|python-requests/i;

function dailySalt() {
  const secret = process.env.ANALYTICS_SALT ?? process.env.BETTER_AUTH_SECRET ?? "zfunnel";
  return createHmac("sha256", secret).update(new Date().toISOString().slice(0, 10)).digest("hex");
}

/** Cookieless visitor id: rotates daily, can't be reversed to an IP. */
export function visitorId(workspaceId: string, headers: Headers) {
  const ua = headers.get("user-agent") ?? "";
  return createHash("sha256")
    .update(`${dailySalt()}|${workspaceId}|${clientIp(headers)}|${ua}`)
    .digest("base64url")
    .slice(0, 22);
}

export function isBot(headers: Headers) {
  return BOT.test(headers.get("user-agent") ?? "");
}

export async function track(
  headers: Headers,
  e: {
    workspaceId: string;
    funnelId: string;
    stepId: string;
    variantId?: string | null;
    type: EventType;
    revenue?: number;
    currency?: string;
    props?: Record<string, string | undefined>;
  },
) {
  if (isBot(headers)) return;
  try {
    await withSystem(getDb(), (tx) =>
      tx.insert(events).values({
        workspaceId: e.workspaceId,
        funnelId: e.funnelId,
        stepId: e.stepId,
        variantId: e.variantId ?? null,
        type: e.type,
        visitor: visitorId(e.workspaceId, headers),
        revenue: e.revenue ?? 0,
        currency: e.currency,
        props: e.props,
      }),
    );
  } catch (err) {
    // Analytics must never break a page or a purchase.
    console.error("[track]", (err as Error).message);
  }
}
