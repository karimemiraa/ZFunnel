import "server-only";

import { notFound } from "next/navigation";
import { requireUser } from "./session";
import { getWorkspaceForUser } from "./workspaces";

/** Current user + workspace for a /[workspace] route, or 404 if not a member. */
export async function requireWorkspace(params: Promise<{ workspace: string }>) {
  const [{ workspace: slug }, user] = await Promise.all([params, requireUser()]);
  const ctx = await getWorkspaceForUser(user.id, slug);
  if (!ctx) notFound();
  return { user, ...ctx };
}
