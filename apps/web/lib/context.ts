import "server-only";

import { eq, getDb, schema, withSystem, workspaces } from "@zfunnel/db";
import { notFound } from "next/navigation";
import { getViewAs } from "./admin";
import { requireUser } from "./session";
import { findMemberWorkspace, type WorkspaceContext } from "./workspaces";

/** How the current user is looking at the workspace. */
export type Access = {
  /** The organization is suspended by the platform: the layout shows the suspended screen. */
  suspended: boolean;
  /** A platform admin in read-only "view as" mode (ADR-024). Never a member. */
  viewAs: boolean;
};

/**
 * Current user + workspace for a /[workspace] page, or 404 if not a member.
 * Only pages come through here. Server actions use getWorkspaceForUser, which never
 * returns a suspended organization or a "view as" workspace, so neither can mutate.
 */
export async function requireWorkspace(
  params: Promise<{ workspace: string }>,
): Promise<{ user: Awaited<ReturnType<typeof requireUser>> } & WorkspaceContext & Access> {
  const [{ workspace: slug }, user] = await Promise.all([params, requireUser()]);
  const ctx = await findMemberWorkspace(user.id, slug);
  if (ctx) return { user, ...ctx, suspended: ctx.membership.suspended, viewAs: false };

  const viewAs = await viewAsContext(user.id, slug);
  if (!viewAs) notFound();
  return { user, ...viewAs, suspended: false, viewAs: true };
}

/** Workspace the admin is viewing as, if the signed cookie names exactly this one. */
async function viewAsContext(userId: string, slug: string): Promise<WorkspaceContext | null> {
  const claim = await getViewAs(userId);
  if (!claim || claim.slug !== slug) return null;
  // The admin guard already passed inside getViewAs; this is the cross-tenant read it allows.
  const [row] = await withSystem(getDb(), (tx) =>
    tx
      .select({ workspace: workspaces, organizationName: schema.organization.name })
      .from(workspaces)
      .innerJoin(schema.organization, eq(schema.organization.id, workspaces.organizationId))
      .where(eq(workspaces.id, claim.workspaceId))
      .limit(1),
  );
  if (!row || row.workspace.slug !== slug) return null;
  return {
    workspace: row.workspace,
    // Least-privileged role, so pages hide owner-only controls too.
    membership: {
      organizationId: row.workspace.organizationId,
      organizationName: row.organizationName,
      role: "member",
      suspended: false,
    },
  };
}
