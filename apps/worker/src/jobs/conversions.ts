import { createHash } from "node:crypto";
import {
  and,
  contacts,
  conversionDeliveries,
  eq,
  getDb,
  orderItems,
  orders,
  prices,
  trackingSettings,
  withSystem,
  type ConversionPlatform,
} from "@zfunnel/db";
import { openSecret } from "@zfunnel/email";
import { queue, type ConversionContext, type ConversionJob, type WorkflowEvent } from "@zfunnel/queue";
import { minorUnits } from "@zfunnel/shared";

const db = () => getDb();

export type ConversionInput = {
  event: "Lead" | "Purchase";
  eventId: string;
  /** Unix seconds. */
  time: number;
  email: string;
  phone: string | null;
  contactId: string;
  ctx: ConversionContext;
  /** Major units (47.5), with currency, for purchases. */
  value?: number;
  currency?: string;
  orderId?: string;
};

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
const hashEmail = (e: string) => sha256(e.trim().toLowerCase());
/** E.164 digits only, as Meta and TikTok expect before hashing. */
const hashPhone = (p: string | null) => {
  const digits = p?.replace(/\D/g, "");
  return digits && digits.length >= 8 ? sha256(digits) : undefined;
};
const clean = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")) as T;

/** Meta Conversions API body (one event). */
export function buildMeta(i: ConversionInput, testCode?: string | null) {
  const phone = hashPhone(i.phone);
  return clean({
    data: [
      clean({
        event_name: i.event,
        event_time: i.time,
        event_id: i.eventId,
        action_source: "website",
        event_source_url: i.ctx.url,
        user_data: clean({
          em: [hashEmail(i.email)],
          ph: phone ? [phone] : undefined,
          external_id: [sha256(i.contactId)],
          client_ip_address: i.ctx.ip,
          client_user_agent: i.ctx.ua,
          fbp: i.ctx.fbp,
          fbc: i.ctx.fbc,
        }),
        custom_data:
          i.event === "Purchase"
            ? clean({ currency: i.currency?.toUpperCase(), value: i.value, order_id: i.orderId })
            : undefined,
      }),
    ],
    test_event_code: testCode || undefined,
  });
}

/** TikTok Events API 1.3 body (one event). */
export function buildTikTok(i: ConversionInput, pixelCode: string, testCode?: string | null) {
  return clean({
    event_source: "web",
    event_source_id: pixelCode,
    test_event_code: testCode || undefined,
    data: [
      clean({
        event: i.event === "Purchase" ? "CompletePayment" : "SubmitForm",
        event_time: i.time,
        event_id: i.eventId,
        user: clean({
          email: hashEmail(i.email),
          phone: hashPhone(i.phone),
          external_id: sha256(i.contactId),
          ip: i.ctx.ip,
          user_agent: i.ctx.ua,
          ttp: i.ctx.ttp,
          ttclid: i.ctx.ttclid,
        }),
        page: i.ctx.url ? { url: i.ctx.url } : undefined,
        properties:
          i.event === "Purchase"
            ? clean({
                currency: i.currency?.toUpperCase(),
                value: i.value,
                order_id: i.orderId,
                content_type: "product",
              })
            : undefined,
      }),
    ],
  });
}

/** GA4 Measurement Protocol body. Falls back to a stable id when there's no _ga cookie. */
export function buildGa4(i: ConversionInput) {
  return {
    client_id: i.ctx.gaClientId ?? `${parseInt(sha256(i.contactId).slice(0, 8), 16)}.${i.time}`,
    user_id: i.contactId,
    events: [
      {
        name: i.event === "Purchase" ? "purchase" : "generate_lead",
        params: clean({
          currency: i.currency?.toUpperCase(),
          value: i.value,
          transaction_id: i.event === "Purchase" ? i.eventId : undefined,
          page_location: i.ctx.url,
          engagement_time_msec: 1,
        }),
      },
    ],
  };
}

/** Value of the items this event is about: main + bumps at checkout, the accepted offer for upsells. */
async function purchaseValue(event: WorkflowEvent) {
  const orderId = event.data?.orderId;
  if (!orderId) return null;
  return withSystem(db(), async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId));
    if (!o || o.workspaceId !== event.workspaceId) return null;
    const upsell = event.data?.upsell === "1";
    const productIds = (event.data?.productIds ?? "").split(",").filter(Boolean);
    const items = await tx
      .select({ amount: orderItems.amount, role: orderItems.role, productId: prices.productId })
      .from(orderItems)
      .leftJoin(prices, eq(prices.id, orderItems.priceId))
      .where(and(eq(orderItems.orderId, o.id), eq(orderItems.status, "paid")));
    const picked = items.filter((it) =>
      upsell
        ? (it.role === "upsell" || it.role === "downsell") &&
          (!productIds.length || productIds.includes(it.productId ?? ""))
        : it.role === "main" || it.role === "bump",
    );
    const minor = picked.reduce((s, it) => s + it.amount, 0);
    return {
      orderId: o.id,
      currency: o.currency,
      value: minor / 10 ** minorUnits(o.currency),
      eventId: upsell ? `upsell-${o.id}-${productIds[0] ?? "x"}` : `order-${o.id}`,
    };
  });
}

/** Turns an opt-in or purchase into one delivery per configured platform. */
export async function fanOutConversions(event: WorkflowEvent, jobId: string) {
  if (event.type !== "optin" && event.type !== "purchase") return 0;
  const [settings] = await withSystem(db(), (tx) =>
    tx.select().from(trackingSettings).where(eq(trackingSettings.workspaceId, event.workspaceId)),
  );
  if (!settings) return 0;
  const platforms: ConversionPlatform[] = [];
  if (settings.metaPixelId && settings.metaTokenSealed) platforms.push("meta");
  if (settings.tiktokPixelCode && settings.tiktokTokenSealed) platforms.push("tiktok");
  if (settings.ga4MeasurementId && settings.ga4SecretSealed) platforms.push("ga4");
  if (!platforms.length) return 0;

  const [contact] = await withSystem(db(), (tx) => tx.select().from(contacts).where(eq(contacts.id, event.contactId)));
  if (!contact) return 0;
  const purchase = event.type === "purchase" ? await purchaseValue(event) : null;
  if (event.type === "purchase" && (!purchase || purchase.value <= 0)) return 0;
  const input: ConversionInput = {
    event: event.type === "purchase" ? "Purchase" : "Lead",
    eventId: purchase?.eventId ?? `lead-${jobId}`,
    time: Math.floor(Date.now() / 1000),
    email: contact.email,
    phone: contact.phone,
    contactId: contact.id,
    ctx: event.ctx ?? {},
    value: purchase?.value,
    currency: purchase?.currency,
    orderId: purchase?.orderId,
  };
  const payloadFor = (p: ConversionPlatform) =>
    p === "meta"
      ? buildMeta(input, settings.metaTestCode)
      : p === "tiktok"
        ? buildTikTok(input, settings.tiktokPixelCode!, settings.tiktokTestCode)
        : buildGa4(input);
  const ids = await withSystem(db(), async (tx) => {
    const rows = await tx
      .insert(conversionDeliveries)
      .values(
        platforms.map((platform) => ({
          workspaceId: event.workspaceId,
          platform,
          event: input.event,
          eventId: input.eventId,
          payload: payloadFor(platform),
        })),
      )
      .onConflictDoNothing()
      .returning({ id: conversionDeliveries.id });
    return rows.map((r) => r.id);
  });
  for (const deliveryId of ids)
    await queue("conversions").add(
      "conversion",
      { deliveryId },
      { jobId: `cv-${deliveryId}`, attempts: 5, backoff: { type: "exponential", delay: 30_000 } },
    );
  return ids.length;
}

const META_BASE = () => process.env.META_GRAPH_BASE ?? "https://graph.facebook.com/v21.0";
const TIKTOK_BASE = () => process.env.TIKTOK_API_BASE ?? "https://business-api.tiktok.com/open_api/v1.3";
const GA4_BASE = () => process.env.GA4_MP_BASE ?? "https://www.google-analytics.com";

class Permanent extends Error {}

export async function processConversion({ deliveryId }: ConversionJob, attemptsMade: number, maxAttempts: number) {
  const row = await withSystem(db(), async (tx) => {
    const [d] = await tx.select().from(conversionDeliveries).where(eq(conversionDeliveries.id, deliveryId));
    const [s] = d
      ? await tx.select().from(trackingSettings).where(eq(trackingSettings.workspaceId, d.workspaceId))
      : [];
    return d && s ? { d, s } : null;
  });
  if (!row || row.d.status === "sent") return { skipped: true };
  const { d, s } = row;
  const record = (set: Partial<typeof conversionDeliveries.$inferInsert>) =>
    withSystem(db(), (tx) =>
      tx
        .update(conversionDeliveries)
        .set({ ...set, attempts: attemptsMade + 1 })
        .where(eq(conversionDeliveries.id, d.id)),
    );
  try {
    let url: string;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (d.platform === "meta") {
      const token = s.metaTokenSealed && openSecret(s.metaTokenSealed);
      if (!s.metaPixelId || !token) throw new Permanent("Meta is no longer configured");
      url = `${META_BASE()}/${encodeURIComponent(s.metaPixelId)}/events?access_token=${encodeURIComponent(token)}`;
    } else if (d.platform === "tiktok") {
      const token = s.tiktokTokenSealed && openSecret(s.tiktokTokenSealed);
      if (!token) throw new Permanent("TikTok is no longer configured");
      url = `${TIKTOK_BASE()}/event/track/`;
      headers["Access-Token"] = token;
    } else {
      const secret = s.ga4SecretSealed && openSecret(s.ga4SecretSealed);
      if (!s.ga4MeasurementId || !secret) throw new Permanent("GA4 is no longer configured");
      url = `${GA4_BASE()}/mp/collect?measurement_id=${encodeURIComponent(s.ga4MeasurementId)}&api_secret=${encodeURIComponent(secret)}`;
    }
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(d.payload),
      signal: AbortSignal.timeout(10_000),
    });
    const text = (await res.text()).slice(0, 500);
    // TikTok answers 200 with a non-zero "code" on errors.
    const tiktokCode = d.platform === "tiktok" ? (JSON.parse(text || "{}") as { code?: number }).code : 0;
    if (res.ok && !tiktokCode) {
      await record({ status: "sent", responseCode: res.status, error: null, sentAt: new Date() });
      return { sent: true };
    }
    const msg = `HTTP ${res.status}: ${text}`;
    if (res.status >= 400 && res.status < 500 && res.status !== 429) throw new Permanent(msg);
    if (tiktokCode) throw new Permanent(msg);
    throw new Error(msg);
  } catch (err) {
    const permanent = err instanceof Permanent;
    const last = permanent || attemptsMade + 1 >= maxAttempts;
    await record({ status: last ? "failed" : "pending", error: (err as Error).message.slice(0, 500) });
    if (!last) throw err;
    return { failed: true };
  }
}
