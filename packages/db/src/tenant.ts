import { sql } from "drizzle-orm";
import type { Db } from "./client";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * Tenant scoping. Every tenant table has FORCE ROW LEVEL SECURITY with policies
 * that read these transaction-local settings, so a query that forgets its
 * WHERE clause still cannot see another tenant's rows.
 */
async function scoped<T>(db: Db, settings: Record<string, string>, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(settings)) {
      await tx.execute(sql`select set_config(${key}, ${value}, true)`);
    }
    return fn(tx);
  });
}

/** Run queries as a member of one organization (sees that org's workspaces). */
export function withOrganization<T>(db: Db, organizationId: string, fn: (tx: Tx) => Promise<T>) {
  return scoped(db, { "app.organization_id": organizationId }, fn);
}

/** Run queries inside one workspace (sees that workspace's tenant data). */
export function withWorkspace<T>(
  db: Db,
  ctx: { organizationId: string; workspaceId: string },
  fn: (tx: Tx) => Promise<T>,
) {
  return scoped(db, { "app.organization_id": ctx.organizationId, "app.workspace_id": ctx.workspaceId }, fn);
}

/**
 * Bypass tenant policies. Only for trusted platform code that must work across
 * tenants (e.g. the public renderer resolving a hostname, background workers).
 * Never call this with input-derived scoping decisions from a dashboard request.
 */
export function withSystem<T>(db: Db, fn: (tx: Tx) => Promise<T>) {
  return scoped(db, { "app.system": "on" }, fn);
}
