import "server-only";

import { eq, getDb, withSystem, workspaces } from "@zfunnel/db";
import { cache } from "react";

/** Public lookup: the renderer has no user session, so it uses the trusted system context. */
export const resolveWorkspace = cache(async (slug: string) => {
  const [row] = await withSystem(getDb(), (tx) =>
    tx.select({ id: workspaces.id, name: workspaces.name }).from(workspaces).where(eq(workspaces.slug, slug)).limit(1),
  );
  return row ?? null;
});
