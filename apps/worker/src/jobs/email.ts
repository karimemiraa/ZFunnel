import {
  and,
  bookings,
  broadcasts,
  calendars,
  contacts,
  conversationMessages,
  desc,
  emailMessages,
  emails,
  emailSettings,
  eq,
  getDb,
  isNull,
  segmentCondition,
  segments,
  sql,
  type Tx,
  webinarRegistrations,
  webinars,
  withSystem,
  workspaces,
} from "@zfunnel/db";
import { esc, renderEmail, signToken, trackingUrls, type EmailDoc } from "@zfunnel/email";
import { dir, getTranslator, intlLocale, type Locale } from "@zfunnel/i18n";
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
      isNull(contacts.deletedAt),
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
  const [ws] = await tx
    .select({ siteLocale: workspaces.siteLocale })
    .from(workspaces)
    .where(eq(workspaces.id, m.workspaceId));
  return { m, email, settings, contact, locale: ws?.siteLocale ?? "en" };
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
  if (m.meta?.kind === "chat_reply") return sendChatReply(m, settings, mark);
  if (m.meta?.kind === "webinar_confirm" || m.meta?.kind === "webinar_reminder")
    return sendWebinarEmail(m, settings, mark);
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
  if (contact?.deletedAt && !m.meta?.test) {
    await mark({ status: "skipped", error: "Contact deleted" });
    return { skipped: "deleted" };
  }
  const urls = trackingUrls(APP_URL(), m.id);
  const vars = contact ? contactVars(contact) : { email: m.toEmail, first_name: "", name: "" };
  const { html, text } = renderEmail(email.content as unknown as EmailDoc, {
    preheader: email.preheader,
    vars,
    footer: { fromName: settings.fromName, postalAddress: settings.postalAddress, unsubscribeUrl: urls.unsubscribe },
    rewriteLink: urls.click,
    openPixelUrl: urls.open,
    locale: loaded.locale,
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

const brandSelect = {
  name: workspaces.name,
  logoUrl: workspaces.logoUrl,
  brandColor: workspaces.brandColor,
  siteLocale: workspaces.siteLocale,
};
type WsBrand = { name: string; logoUrl: string | null; brandColor: string; siteLocale: Locale } | undefined;

/** Safe brand color for inline styles (falls back to indigo). */
const brandColor = (ws: WsBrand) => (ws && /^#[0-9a-f]{6}$/i.test(ws.brandColor) ? ws.brandColor : "#4f46e5");

/** Optional logo row at the top of built-in emails (white-label). */
const logoRow = (ws: WsBrand) =>
  ws?.logoUrl && /^https:\/\//.test(ws.logoUrl)
    ? `<tr><td style="padding:28px 36px 0"><img src="${esc(ws.logoUrl)}" alt="${esc(ws.name)}" height="32" style="height:32px;width:auto;border:0"></td></tr>`
    : "";

/** Built-in emails speak the site's language (and read right-to-left in Arabic). */
const emailT = (ws: WsBrand) => getTranslator(ws?.siteLocale ?? "en");
const emailDate = (ws: WsBrand, d: Date, timeZone: string, year = false) =>
  d.toLocaleString(intlLocale(ws?.siteLocale ?? "en"), {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

/** Card layout shared by the built-in emails. */
function layout(ws: WsBrand, rows: string, maxWidth = 520) {
  const locale = ws?.siteLocale ?? "en";
  const rtl = dir(locale) === "rtl";
  const font = rtl ? "Tahoma,'Segoe UI',Arial,sans-serif" : "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
  return `<!doctype html><html lang="${locale}" dir="${dir(locale)}"><body style="margin:0;background:#f4f4f7;font-family:${font}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="${dir(locale)}"><tr><td align="center" style="padding:40px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${maxWidth}px;background:#fff;border-radius:14px;text-align:${rtl ? "right" : "left"}">
${logoRow(ws)}
${rows}
</table></td></tr></table></body></html>`;
}

const button = (ws: WsBrand, href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:${brandColor(ws)};color:#fff;text-decoration:none;font-weight:600;padding:13px 26px;border-radius:10px">${esc(label)}</a>`;

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
    tx.select(brandSelect).from(workspaces).where(eq(workspaces.id, m.workspaceId)),
  );
  const t = emailT(ws);
  const fromName = settings?.fromName ?? ws?.name ?? "Customer center";
  const url = `${origin}/account/verify?t=${signToken("l", m.id)}`;
  const html = layout(
    ws,
    `<tr><td style="padding:36px 36px 8px;font-size:22px;font-weight:700;color:#111827">${esc(t("emails.loginTitle"))}</td></tr>
<tr><td style="padding:0 36px 24px;font-size:15px;line-height:1.6;color:#4b5563">${esc(t("emails.loginText", { name: fromName }))}</td></tr>
<tr><td style="padding:0 36px 32px">${button(ws, url, t("emails.loginButton"))}</td></tr>
<tr><td style="padding:0 36px 32px;font-size:12px;color:#9ca3af">${esc(t("emails.loginIgnore"))}</td></tr>`,
    480,
  );
  const r = await sendEmail({
    fromName,
    replyTo: settings?.replyTo,
    to: m.toEmail,
    subject: m.subject,
    html,
    text: t("emails.loginPlain", { url }),
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
    const [ws] = await tx.select(brandSelect).from(workspaces).where(eq(workspaces.id, m.workspaceId));
    return b && c ? { b, c, ws, wsName: ws?.name ?? "" } : null;
  });
  if (!row) {
    await mark({ status: "skipped", error: "Booking not found" });
    return { skipped: true };
  }
  const { b, c, ws, wsName } = row;
  const t = emailT(ws);
  const fromName = settings?.fromName ?? wsName;
  const when = emailDate(ws, b.startAt, c.timezone, true);
  const duration = t("emails.minutes", { count: c.durationMinutes });
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${c.name} (${fromName})`)}&dates=${stamp(b.startAt)}/${stamp(b.endAt)}&location=${encodeURIComponent(c.location)}&details=${encodeURIComponent(c.description)}`;
  const html = layout(
    ws,
    `<tr><td style="padding:36px 36px 8px;font-size:13px;font-weight:600;color:#059669">${esc(t("emails.bookingConfirmed"))}</td></tr>
<tr><td style="padding:0 36px 8px;font-size:22px;font-weight:700;color:#111827">${esc(c.name)}</td></tr>
<tr><td style="padding:0 36px 4px;font-size:15px;color:#374151">📅 ${esc(when)}</td></tr>
<tr><td style="padding:0 36px 4px;font-size:15px;color:#374151">⏱ ${esc(duration)}</td></tr>
${c.location ? `<tr><td style="padding:0 36px 4px;font-size:15px;color:#374151">📍 ${esc(c.location)}</td></tr>` : ""}
<tr><td style="padding:24px 36px 32px">${button(ws, gcal, t("emails.addToGoogle"))}</td></tr>
<tr><td style="padding:0 36px 32px;font-size:13px;color:#6b7280">${esc(t("emails.changeTime"))}</td></tr>`,
  );
  const r = await sendEmail({
    fromName,
    replyTo: settings?.replyTo,
    to: m.toEmail,
    subject: m.subject,
    html,
    text: `${t("emails.bookingPlain", { name: c.name, when, duration })}${c.location ? `\n${c.location}` : ""}\n\n${t("emails.addToGoogle")}: ${gcal}`,
    messageId: m.id,
  });
  await mark({ status: "sent", sentAt: new Date(), providerMessageId: r.providerMessageId });
  return { sent: true };
}

/** Built-in transactional email: the owner's reply to a site chat, with the recent thread. */
async function sendChatReply(
  m: typeof emailMessages.$inferSelect,
  settings: typeof emailSettings.$inferSelect | undefined,
  mark: (set: Partial<typeof emailMessages.$inferInsert>) => Promise<unknown>,
) {
  const row = await withSystem(db(), async (tx) => {
    const id = m.meta?.conversationId;
    const msgs = id
      ? await tx
          .select()
          .from(conversationMessages)
          .where(eq(conversationMessages.conversationId, id))
          .orderBy(desc(conversationMessages.createdAt))
          .limit(6)
      : [];
    const [ws] = await tx.select(brandSelect).from(workspaces).where(eq(workspaces.id, m.workspaceId));
    return { msgs: msgs.reverse(), ws, wsName: ws?.name ?? "" };
  });
  if (!row.msgs.length) {
    await mark({ status: "skipped", error: "Conversation not found" });
    return { skipped: true };
  }
  const t = emailT(row.ws);
  const fromName = settings?.fromName ?? row.wsName;
  const you = t("emails.you");
  const origin = m.meta?.siteOrigin && /^https?:\/\/[^/]+$/.test(m.meta.siteOrigin) ? m.meta.siteOrigin : null;
  const lines = row.msgs
    .map(
      (x) =>
        `<tr><td style="padding:0 36px 12px"><div style="font-size:12px;color:#9ca3af;margin-bottom:4px">${esc(x.sender === "owner" ? fromName : you)}</div><div dir="auto" style="font-size:15px;line-height:1.55;color:#111827;white-space:pre-wrap;${x.sender === "owner" ? "background:#eef2ff" : "background:#f4f4f5"};border-radius:12px;padding:10px 14px">${esc(x.body)}</div></td></tr>`,
    )
    .join("");
  const site = origin
    ? `<a href="${esc(origin)}" style="color:${brandColor(row.ws)}">${esc(origin.replace(/^https?:\/\//, ""))}</a>`
    : "";
  const footer = origin
    ? esc(t("emails.continueChatOn", { site: "\u0000" })).replace("\u0000", site)
    : esc(t("emails.replyToContinue"));
  const html = layout(
    row.ws,
    `<tr><td style="padding:32px 36px 16px;font-size:20px;font-weight:700;color:#111827">${esc(t("emails.chatTitle", { name: fromName }))}</td></tr>
${lines}
<tr><td style="padding:12px 36px 32px;font-size:13px;color:#6b7280">${footer}</td></tr>`,
  );
  const text = row.msgs.map((x) => `${x.sender === "owner" ? fromName : you}: ${x.body}`).join("\n\n");
  const r = await sendEmail({
    fromName,
    replyTo: settings?.replyTo,
    to: m.toEmail,
    subject: m.subject,
    html,
    text,
    messageId: m.id,
  });
  await mark({ status: "sent", sentAt: new Date(), providerMessageId: r.providerMessageId });
  return { sent: true };
}

/** Built-in transactional email: webinar confirmation and reminders, with the personal watch link. */
async function sendWebinarEmail(
  m: typeof emailMessages.$inferSelect,
  settings: typeof emailSettings.$inferSelect | undefined,
  mark: (set: Partial<typeof emailMessages.$inferInsert>) => Promise<unknown>,
) {
  const origin = m.meta?.siteOrigin;
  const row = await withSystem(db(), async (tx) => {
    const [r] = m.meta?.registrationId
      ? await tx.select().from(webinarRegistrations).where(eq(webinarRegistrations.id, m.meta.registrationId))
      : [];
    const [w] = r ? await tx.select().from(webinars).where(eq(webinars.id, r.webinarId)) : [];
    const [ws] = await tx.select(brandSelect).from(workspaces).where(eq(workspaces.id, m.workspaceId));
    return r && w ? { r, w, ws } : null;
  });
  if (!row || !origin || !/^https?:\/\/[^/]+$/.test(origin)) {
    await mark({ status: "skipped", error: "Registration not found" });
    return { skipped: true };
  }
  const { r, w, ws } = row;
  // A reminder for a session that already started is pointless (e.g. a delayed job after downtime).
  if (m.meta?.kind === "webinar_reminder" && r.sessionAt.getTime() < Date.now()) {
    await mark({ status: "skipped", error: "Session already started" });
    return { skipped: true };
  }
  const t = emailT(ws);
  const fromName = settings?.fromName ?? ws?.name ?? "";
  const url = `${origin}/webinar/watch/${r.token}`;
  const when = emailDate(ws, r.sessionAt, w.timezone);
  const confirm = m.meta?.kind === "webinar_confirm";
  const heading = t(confirm ? "emails.webinarRegistered" : "emails.webinarSoon");
  const html = layout(
    ws,
    `<tr><td style="padding:32px 36px 8px;font-size:13px;font-weight:600;color:${brandColor(ws)}">${esc(heading.toUpperCase())}</td></tr>
<tr><td style="padding:0 36px 8px;font-size:22px;font-weight:700;color:#111827">${esc(w.title)}</td></tr>
<tr><td style="padding:0 36px 4px;font-size:15px;color:#374151">📅 ${esc(when)}</td></tr>
<tr><td style="padding:0 36px 4px;font-size:15px;color:#374151">⏱ ${esc(t("emails.minutes", { count: w.durationMinutes }))}</td></tr>
<tr><td style="padding:24px 36px 32px">${button(ws, url, t(confirm ? "emails.openRoom" : "emails.joinWebinar"))}</td></tr>
<tr><td style="padding:0 36px 32px;font-size:13px;color:#6b7280">${esc(t("emails.personalLink"))}</td></tr>`,
  );
  const r2 = await sendEmail({
    fromName,
    replyTo: settings?.replyTo,
    to: m.toEmail,
    subject: m.subject,
    html,
    text: `${heading} ${w.title}\n${when}\n\n${t("emails.joinHere", { url })}`,
    messageId: m.id,
  });
  await mark({ status: "sent", sentAt: new Date(), providerMessageId: r2.providerMessageId });
  return { sent: true };
}
