import {
  and,
  bookings,
  broadcasts,
  calendars,
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
  workspaces,
  type Tx,
} from "@zfunnel/db";
import { esc, renderEmail, signToken, trackingUrls, type EmailDoc } from "@zfunnel/email";
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
  if (m.meta?.kind === "login") return sendLoginLink(m, settings, mark);
  if (m.meta?.kind === "booking") return sendBookingConfirmation(m, settings, mark);
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

/** Built-in transactional email: the customer-center sign-in link (no tracking, no unsubscribe). */
async function sendLoginLink(
  m: typeof emailMessages.$inferSelect,
  settings: typeof emailSettings.$inferSelect | undefined,
  mark: (set: Partial<typeof emailMessages.$inferInsert>) => Promise<unknown>,
) {
  const origin = m.meta?.siteOrigin;
  if (!origin || !/^https?:\/\/[^/]+$/.test(origin)) {
    await mark({ status: "failed", error: "Missing site origin" });
    return { failed: true };
  }
  const [ws] = await withSystem(db(), (tx) =>
    tx.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, m.workspaceId)),
  );
  const fromName = settings?.fromName ?? ws?.name ?? "Customer center";
  const url = `${origin}/account/verify?t=${signToken("l", m.id)}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border-radius:14px">
<tr><td style="padding:36px 36px 8px;font-size:22px;font-weight:700;color:#111827">Sign in to your account</td></tr>
<tr><td style="padding:0 36px 24px;font-size:15px;line-height:1.6;color:#4b5563">Click the button below to see your purchases and manage your subscriptions with ${esc(fromName)}. This link works once and expires in 30 minutes.</td></tr>
<tr><td style="padding:0 36px 32px"><a href="${esc(url)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:13px 26px;border-radius:10px">Sign in</a></td></tr>
<tr><td style="padding:0 36px 32px;font-size:12px;color:#9ca3af">If you didn't ask for this, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`;
  const r = await sendEmail({
    fromName,
    replyTo: settings?.replyTo,
    to: m.toEmail,
    subject: m.subject,
    html,
    text: `Sign in to your account: ${url}\n\nThis link works once and expires in 30 minutes.`,
    messageId: m.id,
  });
  await mark({ status: "sent", sentAt: new Date(), providerMessageId: r.providerMessageId });
  return { sent: true };
}

/** Built-in transactional email: booking confirmation with an "Add to Google Calendar" link. */
async function sendBookingConfirmation(
  m: typeof emailMessages.$inferSelect,
  settings: typeof emailSettings.$inferSelect | undefined,
  mark: (set: Partial<typeof emailMessages.$inferInsert>) => Promise<unknown>,
) {
  const row = await withSystem(db(), async (tx) => {
    const [b] = m.meta?.bookingId ? await tx.select().from(bookings).where(eq(bookings.id, m.meta.bookingId)) : [];
    const [c] = b ? await tx.select().from(calendars).where(eq(calendars.id, b.calendarId)) : [];
    const [ws] = await tx.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, m.workspaceId));
    return b && c ? { b, c, wsName: ws?.name ?? "" } : null;
  });
  if (!row) {
    await mark({ status: "skipped", error: "Booking not found" });
    return { skipped: true };
  }
  const { b, c, wsName } = row;
  const fromName = settings?.fromName ?? wsName;
  const when = b.startAt.toLocaleString("en-US", {
    timeZone: c.timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${c.name} (${fromName})`)}&dates=${stamp(b.startAt)}/${stamp(b.endAt)}&location=${encodeURIComponent(c.location)}&details=${encodeURIComponent(c.description)}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:14px">
<tr><td style="padding:36px 36px 8px;font-size:13px;font-weight:600;color:#059669">BOOKING CONFIRMED</td></tr>
<tr><td style="padding:0 36px 8px;font-size:22px;font-weight:700;color:#111827">${esc(c.name)}</td></tr>
<tr><td style="padding:0 36px 4px;font-size:15px;color:#374151">📅 ${esc(when)}</td></tr>
<tr><td style="padding:0 36px 4px;font-size:15px;color:#374151">⏱ ${c.durationMinutes} minutes</td></tr>
${c.location ? `<tr><td style="padding:0 36px 4px;font-size:15px;color:#374151">📍 ${esc(c.location)}</td></tr>` : ""}
<tr><td style="padding:24px 36px 32px"><a href="${esc(gcal)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">Add to Google Calendar</a></td></tr>
<tr><td style="padding:0 36px 32px;font-size:13px;color:#6b7280">Need to change the time? Just reply to this email.</td></tr>
</table></td></tr></table></body></html>`;
  const r = await sendEmail({
    fromName,
    replyTo: settings?.replyTo,
    to: m.toEmail,
    subject: m.subject,
    html,
    text: `Booking confirmed: ${c.name}\n${when}\n${c.durationMinutes} minutes${c.location ? `\n${c.location}` : ""}\n\nAdd to Google Calendar: ${gcal}`,
    messageId: m.id,
  });
  await mark({ status: "sent", sentAt: new Date(), providerMessageId: r.providerMessageId });
  return { sent: true };
}
