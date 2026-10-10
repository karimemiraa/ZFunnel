import { randomBytes } from "node:crypto";
import { and, emailMessages, eq, webinarRegistrations } from "@zfunnel/db";
import { system, upsertContact } from "@zfunnel/payments";
import { enqueue } from "@zfunnel/queue";
import { upcomingSessions } from "@zfunnel/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, publicPost } from "@/lib/api";
import { conversionContext } from "@/lib/conversion-context";
import { requestOrigin } from "@/lib/customer";
import { publishedWebinar } from "@/lib/webinar";

const schema = z.object({
  slug: z.string().max(60),
  sessionAt: z.string().datetime({ offset: true }),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(254),
});

const HOUR = 3_600_000;

/** Registers a visitor for one session; queues the confirmation and reminder emails. */
export async function POST(req: Request) {
  const g = await publicPost(req, "webinar-register", 10);
  if ("error" in g) return g.error;
  const p = schema.safeParse(g.body);
  if (!p.success) return jsonError(p.error.issues[0]!.message);
  const w = await publishedWebinar(g.ws.id, p.data.slug);
  if (!w) return jsonError("This webinar isn't available.", 404);
  // Only a session we actually offer (a few minutes of grace for slow forms).
  const at = new Date(p.data.sessionAt);
  const offered = upcomingSessions(w.schedule, w.timezone, new Date(), 8, 10).some((s) => s.getTime() === at.getTime());
  if (!offered) return jsonError("That session is no longer available. Please pick another time.");

  const origin = requestOrigin(req.headers);
  const result = await system(async (tx) => {
    const contact = await upsertContact(tx, g.ws.id, { email: p.data.email, name: p.data.name, ip: g.ip });
    const [existing] = await tx
      .select()
      .from(webinarRegistrations)
      .where(
        and(
          eq(webinarRegistrations.webinarId, w.id),
          eq(webinarRegistrations.contactId, contact.id),
          eq(webinarRegistrations.sessionAt, at),
        ),
      );
    if (existing) return { token: existing.token, contactId: contact.id, isNew: false, mails: [] };
    const token = randomBytes(24).toString("base64url");
    const [r] = await tx
      .insert(webinarRegistrations)
      .values({ workspaceId: g.ws.id, webinarId: w.id, contactId: contact.id, sessionAt: at, token })
      .returning({ id: webinarRegistrations.id });
    const until = at.getTime() - Date.now();
    const plan: { kind: "webinar_confirm" | "webinar_reminder"; delay: number; subject: string }[] = [
      { kind: "webinar_confirm", delay: 0, subject: `You're registered: ${w.title}` },
    ];
    if (until > 25 * HOUR)
      plan.push({ kind: "webinar_reminder", delay: until - 24 * HOUR, subject: `Tomorrow: ${w.title}` });
    if (until > 70 * 60_000)
      plan.push({ kind: "webinar_reminder", delay: until - HOUR, subject: `Starting in 1 hour: ${w.title}` });
    const mails = await tx
      .insert(emailMessages)
      .values(
        plan.map((m) => ({
          workspaceId: g.ws.id,
          contactId: contact.id,
          toEmail: p.data.email,
          subject: m.subject,
          meta: { kind: m.kind, registrationId: r!.id, siteOrigin: origin },
        })),
      )
      .returning({ id: emailMessages.id });
    return {
      token,
      contactId: contact.id,
      isNew: true,
      mails: mails.map((m, i) => ({ id: m.id, delay: plan[i]!.delay })),
    };
  });
  for (const m of result.mails) await enqueue("email", { messageId: m.id }, { jobId: `msg-${m.id}`, delay: m.delay });
  if (result.isNew)
    await enqueue("workflow-events", {
      workspaceId: g.ws.id,
      contactId: result.contactId,
      type: "webinar_registered",
      data: { webinarId: w.id, sessionAt: at.toISOString() },
      ctx: conversionContext(req),
    });
  return NextResponse.json({ ok: true, token: result.token });
}
