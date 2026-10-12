import { getTranslator } from "@zfunnel/i18n";
import { bookings, contacts, emailMessages, notify, sql } from "@zfunnel/db";
import { logActivity, system } from "@zfunnel/payments";
import { enqueue } from "@zfunnel/queue";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, publicPost } from "@/lib/api";
import { calendarBySlug, freeSlots } from "@/lib/booking";

const schema = z.object({
  slug: z.string().max(64),
  startAt: z.string().datetime(),
  name: z.string().trim().min(1, "errors.enterName").max(120),
  email: z.string().trim().toLowerCase().email("errors.invalidEmail").max(254),
  notes: z.string().trim().max(1000).optional(),
});

/** Books a slot. The slot is re-validated server-side and a unique index prevents double booking. */
export async function POST(req: Request) {
  const g = await publicPost(req, "book", 10);
  if ("error" in g) return g.error;
  const p = schema.safeParse(g.body);
  if (!p.success) return jsonError(p.error.issues[0]!.message);
  const cal = await calendarBySlug(g.ws.id, p.data.slug);
  if (!cal) return jsonError("errors.calendarClosed", 404);
  const start = new Date(p.data.startAt);
  if (!(await freeSlots(cal)).some((s) => s.getTime() === start.getTime())) return jsonError("errors.slotTaken", 409);
  const end = new Date(start.getTime() + cal.durationMinutes * 60_000);

  let result: { bookingId: string; contactId: string; messageId: string } | null = null;
  try {
    result = await system(async (tx) => {
      const [c] = await tx
        .insert(contacts)
        .values({
          workspaceId: g.ws.id,
          email: p.data.email,
          name: p.data.name,
          consentAt: new Date(),
          consentIp: g.ip,
        })
        .onConflictDoUpdate({
          target: [contacts.workspaceId, contacts.email],
          set: { deletedAt: null, name: sql`coalesce(${contacts.name}, excluded.name)`, updatedAt: new Date() },
        })
        .returning({ id: contacts.id });
      const [b] = await tx
        .insert(bookings)
        .values({
          workspaceId: g.ws.id,
          calendarId: cal.id,
          contactId: c!.id,
          name: p.data.name,
          email: p.data.email,
          notes: p.data.notes ?? "",
          startAt: start,
          endAt: end,
        })
        .returning({ id: bookings.id });
      await logActivity(tx, {
        workspaceId: g.ws.id,
        contactId: c!.id,
        type: "booking",
        body: cal.name,
        data: { bookingId: b!.id, startAt: start.toISOString() },
      });
      const [m] = await tx
        .insert(emailMessages)
        .values({
          workspaceId: g.ws.id,
          contactId: c!.id,
          toEmail: p.data.email,
          subject: getTranslator(g.ws.siteLocale)("emails.bookingSubject", { name: cal.name }),
          meta: { kind: "booking", bookingId: b!.id },
        })
        .returning({ id: emailMessages.id });
      await notify(tx, {
        workspaceId: g.ws.id,
        type: "booking",
        entityId: b!.id,
        data: { name: p.data.name, calendar: cal.name, calendarId: cal.id, startAt: start.toISOString() },
      });
      return { bookingId: b!.id, contactId: c!.id, messageId: m!.id };
    });
  } catch (err) {
    if ((err as { code?: string }).code === "23505" || /bookings_slot_uq/.test(String(err)))
      return jsonError("errors.slotTaken", 409);
    throw err;
  }
  await enqueue("email", { messageId: result.messageId }, { jobId: `msg-${result.messageId}` });
  await enqueue("workflow-events", {
    workspaceId: g.ws.id,
    contactId: result.contactId,
    type: "booked",
    data: { calendarId: cal.id, bookingId: result.bookingId },
  });
  return NextResponse.json({ ok: true, startAt: start.toISOString(), endAt: end.toISOString() });
}
