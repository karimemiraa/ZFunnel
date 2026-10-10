import { createHmac } from "node:crypto";
import {
  and,
  contacts,
  eq,
  getDb,
  webhookDeliveries,
  webhookEndpoints,
  withSystem,
  type WebhookEvent,
} from "@zfunnel/db";
import { queue, type WebhookJob, type WorkflowEvent } from "@zfunnel/queue";
import { isPublicUrl } from "./workflows";

const db = () => getDb();

const EVENT_MAP: Partial<Record<WorkflowEvent["type"], WebhookEvent>> = {
  optin: "contact.opted_in",
  tag_added: "contact.tagged",
  purchase: "order.paid",
  form_submitted: "form.submitted",
  booked: "booking.created",
};

/** Header value receivers verify: t=<unix>,v1=<hex HMAC-SHA256 of "t.body">. */
export function signPayload(secret: string, body: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

/** Turns an internal event into deliveries for every subscribed endpoint. */
export async function fanOutWebhooks(event: WorkflowEvent, eventId: string) {
  const name = EVENT_MAP[event.type];
  if (!name) return 0;
  const ids = await withSystem(db(), async (tx) => {
    const endpoints = (
      await tx
        .select()
        .from(webhookEndpoints)
        .where(and(eq(webhookEndpoints.workspaceId, event.workspaceId), eq(webhookEndpoints.status, "active")))
    ).filter((e) => e.events.includes(name));
    if (!endpoints.length) return [];
    const [c] = await tx.select().from(contacts).where(eq(contacts.id, event.contactId));
    const payload = {
      id: `evt_${eventId}`,
      type: name,
      createdAt: new Date().toISOString(),
      data: {
        contact: c && { id: c.id, email: c.email, name: c.name, phone: c.phone, tags: c.tags, fields: c.fields },
        ...event.data,
      },
    };
    const rows = await tx
      .insert(webhookDeliveries)
      .values(endpoints.map((e) => ({ workspaceId: e.workspaceId, endpointId: e.id, event: name, eventId, payload })))
      .onConflictDoNothing()
      .returning({ id: webhookDeliveries.id });
    return rows.map((r) => r.id);
  });
  for (const deliveryId of ids)
    await queue("webhooks").add(
      "webhook",
      { deliveryId },
      { jobId: `wh-${deliveryId}`, attempts: 6, backoff: { type: "exponential", delay: 10_000 } },
    );
  return ids.length;
}

export async function processWebhook({ deliveryId }: WebhookJob, attemptsMade: number, maxAttempts: number) {
  const row = await withSystem(db(), async (tx) => {
    const [d] = await tx.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, deliveryId));
    const [e] = d ? await tx.select().from(webhookEndpoints).where(eq(webhookEndpoints.id, d.endpointId)) : [];
    return d && e ? { d, e } : null;
  });
  if (!row || row.d.status === "succeeded") return { skipped: true };
  const { d, e } = row;
  const record = (set: Partial<typeof webhookDeliveries.$inferInsert>) =>
    withSystem(db(), (tx) =>
      tx
        .update(webhookDeliveries)
        .set({ ...set, attempts: attemptsMade + 1 })
        .where(eq(webhookDeliveries.id, d.id)),
    );
  if (!(await isPublicUrl(e.url))) {
    await record({ status: "failed", error: "Blocked: URL must be public http(s)" });
    return { blocked: true };
  }
  const body = JSON.stringify(d.payload);
  let code = 0;
  let error = "";
  try {
    const res = await fetch(e.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "ZFunnel-Webhooks/1.0",
        "zfunnel-signature": signPayload(e.secret, body),
        "zfunnel-event": d.event,
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    code = res.status;
    if (res.ok) {
      await record({ status: "succeeded", responseCode: code, error: null });
      return { delivered: true };
    }
    error = `HTTP ${code}`;
  } catch (err) {
    error = (err as Error).message.slice(0, 200);
  }
  const last = attemptsMade + 1 >= maxAttempts;
  await record({ status: last ? "failed" : "pending", responseCode: code || null, error });
  throw new Error(`webhook ${d.id}: ${error}`); // BullMQ retries with backoff
}
