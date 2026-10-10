import "server-only";

import { and, asc, eq, funnels, funnelSteps, getDb, isNull, withSystem } from "@zfunnel/db";

/** A shared funnel by its public token (cross-tenant read, so trusted system context). */
export async function getSharedFunnel(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  return withSystem(getDb(), async (tx) => {
    const [f] = await tx
      .select()
      .from(funnels)
      .where(and(eq(funnels.shareToken, token), isNull(funnels.archivedAt)));
    if (!f) return null;
    const steps = await tx
      .select()
      .from(funnelSteps)
      .where(eq(funnelSteps.funnelId, f.id))
      .orderBy(asc(funnelSteps.position));
    return { funnel: f, steps };
  });
}
