import { contacts, getDb, sql, withSystem } from "@zfunnel/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { resolveStepForWorkspace } from "@/lib/resolve";
import { currentWorkspace } from "@/lib/site";
import { track } from "@/lib/track";
import { logActivity } from "@zfunnel/payments";
import { enqueue } from "@zfunnel/queue";
import { conversionContext } from "@/lib/conversion-context";

const bodySchema = z.object({
  stepId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address.").max(254),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
});

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`optin:${ip}`, 10, 60_000))
    return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });

  const ws = await currentWorkspace();
  if (!ws) return NextResponse.json({ error: "Site not found." }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid form." }, { status: 400 });
  const { stepId, email, name, phone } = parsed.data;

  // The step must belong to the workspace serving this host: a form can't post leads into another tenant.
  const step = await resolveStepForWorkspace(ws.id, stepId);
  if (!step) return NextResponse.json({ error: "This form is no longer available." }, { status: 404 });

  const referrer = req.headers.get("referer") ?? undefined;
  const utm = referrer
    ? Object.fromEntries([...new URL(referrer).searchParams].filter(([k]) => k.startsWith("utm_")))
    : {};
  const attribution = {
    utmSource: utm.utm_source,
    utmMedium: utm.utm_medium,
    utmCampaign: utm.utm_campaign,
    utmContent: utm.utm_content,
    utmTerm: utm.utm_term,
  };

  const now = new Date();
  const contactId = await withSystem(getDb(), async (tx) => {
    const [c] = await tx
      .insert(contacts)
      .values({
        workspaceId: ws.id,
        email,
        name: name || null,
        phone: phone || null,
        sourceFunnelId: step.funnelId,
        sourceStepId: step.id,
        attribution,
        consentAt: now,
        consentIp: ip,
      })
      .onConflictDoUpdate({
        target: [contacts.workspaceId, contacts.email],
        // Keep the original source; fill in details the contact didn't give before.
        set: {
          name: sql`coalesce(excluded.name, ${contacts.name})`,
          phone: sql`coalesce(excluded.phone, ${contacts.phone})`,
          updatedAt: now,
        },
      })
      .returning({ id: contacts.id });
    await logActivity(tx, { workspaceId: ws.id, contactId: c!.id, type: "optin", body: "opt-in form" });
    return c!.id;
  });
  await enqueue("workflow-events", {
    workspaceId: ws.id,
    contactId,
    type: "optin",
    data: { funnelId: step.funnelId, stepId: step.id },
    ctx: conversionContext(req),
  });

  await track(req.headers, {
    workspaceId: ws.id,
    funnelId: step.funnelId,
    stepId: step.id,
    type: "optin",
    props: attribution,
  });
  return NextResponse.json({ ok: true, redirect: step.nextPath });
}
