import "server-only";

import {
  auditLogs,
  desc,
  eq,
  getDb,
  schema,
  withOrganization,
  withSystem,
  withWorkspace,
  workspaces,
  type Workspace,
} from "@zfunnel/db";
import type { Role } from "@zfunnel/shared";
import { cache } from "react";

export type Membership = { organizationId: string; organizationName: string; role: Role };
export type WorkspaceContext = { workspace: Workspace; membership: Membership };

/** Organizations the user belongs to (auth tables are not tenant-scoped). */
export const getMemberships = cache(async (userId: string): Promise<Membership[]> => {
  const rows = await getDb()
    .select({
      organizationId: schema.member.organizationId,
      organizationName: schema.organization.name,
      role: schema.member.role,
    })
    .from(schema.member)
    .innerJoin(schema.organization, eq(schema.member.organizationId, schema.organization.id))
    .where(eq(schema.member.userId, userId))
    .orderBy(schema.organization.name);
  return rows.map((r) => ({ ...r, role: r.role as Role }));
});

/** All workspaces the user can open, grouped by organization. */
export const listUserWorkspaces = cache(async (userId: string) => {
  const memberships = await getMemberships(userId);
  return Promise.all(
    memberships.map(async (membership) => ({
      membership,
      workspaces: await withOrganization(getDb(), membership.organizationId, (tx) =>
        tx.select().from(workspaces).orderBy(workspaces.name),
      ),
    })),
  );
});

/** Resolves a workspace slug for this user, or null if they are not a member. */
export const getWorkspaceForUser = cache(async (userId: string, slug: string): Promise<WorkspaceContext | null> => {
  for (const { membership, workspaces: list } of await listUserWorkspaces(userId)) {
    const workspace = list.find((w) => w.slug === slug);
    if (workspace) return { workspace, membership };
  }
  return null;
});

export async function recordAudit(
  ctx: WorkspaceContext,
  actorUserId: string,
  entry: { action: string; entityType: string; entityId?: string; data?: Record<string, unknown> },
) {
  await withWorkspace(getDb(), { organizationId: ctx.membership.organizationId, workspaceId: ctx.workspace.id }, (tx) =>
    tx.insert(auditLogs).values({ workspaceId: ctx.workspace.id, actorUserId, ...entry }),
  );
}

export async function listAuditLogs(ctx: WorkspaceContext, limit = 50) {
  return withWorkspace(
    getDb(),
    { organizationId: ctx.membership.organizationId, workspaceId: ctx.workspace.id },
    (tx) =>
      tx
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          data: auditLogs.data,
          createdAt: auditLogs.createdAt,
          actorName: schema.user.name,
        })
        .from(auditLogs)
        .leftJoin(schema.user, eq(auditLogs.actorUserId, schema.user.id))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit),
  );
}

export function canManage(role: Role) {
  return role === "owner" || role === "admin";
}

/** Postgres unique_violation, unwrapped from Drizzle's error wrapper. */
export function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/**
 * Subdomains are a platform-wide namespace, so availability must look across tenants.
 * Uses the system context but only ever returns a boolean.
 */
export async function isSlugAvailable(slug: string): Promise<boolean> {
  const rows = await withSystem(getDb(), (tx) =>
    tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.slug, slug)).limit(1),
  );
  return rows.length === 0;
}
