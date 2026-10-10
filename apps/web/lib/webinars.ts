import "server-only";

import { asc, contacts, desc, eq, sql, webinarRegistrations, webinars } from "@zfunnel/db";
import { inWorkspace } from "./funnels";
import type { WorkspaceContext } from "./workspaces";

export async function listWebinars(ctx: WorkspaceContext) {
  return inWorkspace(ctx, (tx) =>
    tx
      .select({
        w: webinars,
        registrants: sql<number>`(select count(*)::int from webinar_registrations r where r.webinar_id = "webinars"."id")`,
        attended: sql<number>`(select count(*)::int from webinar_registrations r where r.webinar_id = "webinars"."id" and r.attended_at is not null)`,
      })
      .from(webinars)
      .orderBy(asc(webinars.title)),
  );
}

export async function getWebinar(ctx: WorkspaceContext, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return inWorkspace(ctx, async (tx) => {
    const [w] = await tx.select().from(webinars).where(eq(webinars.id, id));
    if (!w) return null;
    const registrants = await tx
      .select({
        id: webinarRegistrations.id,
        sessionAt: webinarRegistrations.sessionAt,
        attendedAt: webinarRegistrations.attendedAt,
        offerClickedAt: webinarRegistrations.offerClickedAt,
        createdAt: webinarRegistrations.createdAt,
        name: contacts.name,
        email: contacts.email,
        contactId: contacts.id,
      })
      .from(webinarRegistrations)
      .innerJoin(contacts, eq(contacts.id, webinarRegistrations.contactId))
      .where(eq(webinarRegistrations.webinarId, w.id))
      .orderBy(desc(webinarRegistrations.createdAt))
      .limit(500);
    return { w, registrants };
  });
}
