import "server-only";

import { and, eq, webinarRegistrations, webinars } from "@zfunnel/db";
import { system } from "@zfunnel/payments";

export async function publishedWebinar(workspaceId: string, slug: string) {
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return null;
  const [w] = await system((tx) =>
    tx
      .select()
      .from(webinars)
      .where(and(eq(webinars.workspaceId, workspaceId), eq(webinars.slug, slug), eq(webinars.status, "published"))),
  );
  return w ?? null;
}

/** A registration by its secret watch token, with its webinar (published or not: links in emails keep working). */
export async function registrationByToken(workspaceId: string, token: string) {
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) return null;
  const [row] = await system((tx) =>
    tx
      .select({ r: webinarRegistrations, w: webinars })
      .from(webinarRegistrations)
      .innerJoin(webinars, eq(webinars.id, webinarRegistrations.webinarId))
      .where(and(eq(webinarRegistrations.workspaceId, workspaceId), eq(webinarRegistrations.token, token))),
  );
  return row ?? null;
}
