import {
  and,
  broadcasts,
  contacts,
  emailMessages,
  emails,
  emailSettings,
  eq,
  getDb,
  isNull,
  segmentCondition,
  segments,
  sql,
  withSystem,
  type Tx,
} from "@zfunnel/db";
import { renderEmail, trackingUrls, type EmailDoc } from "@zfunnel/email";
import { isHardBounce, sendEmail } from "@zfunnel/email/send";
import { queue, type BroadcastJob, type EmailJob } from "@zfunnel/queue";

const db = () => getDb();
const APP_URL = () => process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

/** Variables available in templates: {{first_name}}, {{name}}, {{email}} and custom field keys. */
export function contactVars(c: { email: string; name: string | null; fields: Record<string, unknown> | null }) {
  const first = c.name?.trim().split(/\s+/)[0] ?? "";
  return {
    ...Object.fromEntries(Object.entries(c.fields ?? {}).map(([k, v]) => [k.toLowerCase(), v as string])),
    first_name: first,
    name: c.name ?? "",
    email: c.email,
  };
}

/** Expands a broadcast into one message per eligible contact, then queues them. Safe to retry. */
export async function processBroadcast({ broadcastId }: BroadcastJob) {
  const ids = await withSystem(db(), async (tx) => {
    const [b] = await tx.select().from(broadcasts).where(eq(broadcasts.id, broadcastId));
    if (!b || b.status === "sent" || b.status === "draft") return [];
    const [email] = await tx.select().from(emails).where(eq(emails.id, b.emailId));
    if (!email) {
      await tx.update(broadcasts).set({ status: "failed" }).where(eq(broadcasts.id, b.id));
      return [];
    }
    await tx.update(broadcasts).set({ status: "sending" }).where(eq(broadcasts.id, b.id));
    const [seg] = b.segmentId ? await tx.select().from(segments).where(eq(segments.id, b.segmentId)) : [];
    const audience = and(
      eq(contacts.workspaceId, b.workspaceId),
      isNull(contacts.unsubscribedAt),
      seg ? segmentCondition(seg.match, seg.rules) : undefined,
      b.tag ? segmentCondition("all", [{ field: "tag", op: "has", value: b.tag }]) : undefined,
    );
    // One INSERT…SELECT: the unique (broadcast, contact) index makes retries no-ops.
    await tx.execute(sql`
      insert into email_messages (workspace_id, contact_id, email_id, broadcast_id, to_email, subject)
      select ${b.workspaceId}, ${contacts.id}, ${email.id}, ${b.id}, ${contacts.email}, ${email.subject}
      from ${contacts} where ${audience}
      on conflict do nothing`);
    const queued = await tx
      .select({ id: emailMessages.id })
      .from(emailMessages)
      .where(and(eq(emailMessages.broadcastId, b.id), eq(emailMessages.status, "queued")));
    const [{ n }] = (await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(emailMessages)
      .where(eq(emailMessages.broadcastId, b.id))) as [{ n: number }];
    await tx
      .update(broadcasts)
      .set({ recipients: n, status: "sent", sentAt: new Date() })
      .where(eq(broadcasts.id, b.id));
    return queued.map((q) => q.id);
  });
  for (let i = 0; i < ids.length; i += 500)
    await queue("email").addBulk(
      ids
        .slice(i, i + 500)
        .map((messageId) => ({ name: "email", data: { messageId }, opts: { jobId: `msg-${messageId}` } })),
    );
  return { queued: ids.length };
}

async function loadMessage(tx: Tx, messageId: string) {
  const [m] = await tx.select().from(emailMessages).where(eq(emailMessages.id, messageId));
  if (!m || m.status !== "queued") return null;
  const [email] = m.emailId ? await tx.select().from(emails).where(eq(emails.id, m.emailId)) : [];
  const [settings] = await tx.select().from(emailSettings).where(eq(emailSettings.workspaceId, m.workspaceId));
  const [contact] = m.contactId ? await tx.select().from(contacts).where(eq(contacts.id, m.contactId)) : [];
  return { m, email, settings, contact };
}

/** Sends one message. Unsubscribed contacts are skipped; hard bounces stop future sends. */
export async function processEmail({ messageId }: EmailJob) {
  const loaded = await withSystem(db(), (tx) => loadMessage(tx, messageId));
  if (!loaded) return { skipped: "not queued" };
  const { m, email, settings, contact } = loaded;
  const mark = (set: Partial<typeof emailMessages.$inferInsert>) =>
    withSystem(db(), (tx) => tx.update(emailMessages).set(set).where(eq(emailMessages.id, m.id)));
  if (!email || !settings) {
    await mark({
      status: "failed",
      error: !settings ? "Sender settings missing (Email → Settings)" : "Email design deleted",
    });
    return { failed: true };
  }
  if (contact?.unsubscribedAt && !m.meta?.test) {
    await mark({ status: "skipped", error: "Unsubscribed" });
    return { skipped: "unsubscribed" };
  }
  const urls = trackingUrls(APP_URL(), m.id);
  const vars = contact ? contactVars(contact) : { email: m.toEmail, first_name: "", name: "" };
  const { html, text } = renderEmail(email.content as unknown as EmailDoc, {
    preheader: email.preheader,
    vars,
    footer: { fromName: settings.fromName, postalAddress: settings.postalAddress, unsubscribeUrl: urls.unsubscribe },
    rewriteLink: urls.click,
    openPixelUrl: urls.open,
  });
  const subject = email.subject.replace(/\{\{\s*([a-z0-9_]+)\s*(?:\|\s*([^}]*))?\}\}/gi, (_m, k: string, fb?: string) =>
    String((vars as Record<string, unknown>)[k.toLowerCase()] || fb || "").trim(),
  );
  try {
    const r = await sendEmail({
      fromName: settings.fromName,
      replyTo: settings.replyTo,
      to: m.toEmail,
      subject,
      html,
      text,
      unsubscribeUrl: urls.unsubscribe,
      unsubscribePostUrl: urls.unsubscribe,
      messageId: m.id,
    });
    await mark({ status: "sent", sentAt: new Date(), providerMessageId: r.providerMessageId, subject });
    return { sent: true };
  } catch (err) {
    if (isHardBounce(err)) {
      await mark({ status: "bounced", error: (err as Error).message.slice(0, 500) });
      // Never email a dead address again (protects sender reputation).
      if (m.contactId)
        await withSystem(db(), (tx) =>
          tx.update(contacts).set({ unsubscribedAt: new Date() }).where(eq(contacts.id, m.contactId!)),
        );
      return { bounced: true };
    }
    throw err; // transient: BullMQ retries with backoff
  }
}
