import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client";
import { organization } from "./schema/auth";
import { orgBilling } from "./schema/billing";
import { contacts } from "./schema/contacts";
import { organizationSuspensions, platformAuditLog } from "./schema/platform";
import { funnels, funnelSteps, pageVersions } from "./schema/funnels";
import { mediaFiles } from "./schema/media";
import { auditLogs, workspaces } from "./schema/tenancy";
import { withOrganization, withSystem, withWorkspace } from "./tenant";

// Needs a database owned by a NON-superuser role (superusers bypass RLS).
// Skipped locally without TEST_DATABASE_URL; in CI a missing URL fails loudly instead.
const url = process.env.TEST_DATABASE_URL;
if (!url && process.env.CI) throw new Error("TEST_DATABASE_URL must be set in CI");

describe.skipIf(!url)("row-level security", () => {
  let db: Db;
  const orgA = "org_a";
  const orgB = "org_b";
  let wsA = "";
  let wsB = "";

  beforeAll(async () => {
    db = createDb(url!, { max: 2, onnotice: () => {} });
    await db.execute(
      sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`,
    );
    await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });

    const [{ is_superuser }] = (await db.execute(
      sql`select current_setting('is_superuser') as is_superuser`,
    )) as unknown as [{ is_superuser: string }];
    if (is_superuser === "on") throw new Error("TEST_DATABASE_URL must use a non-superuser role");

    await db.insert(organization).values([
      { id: orgA, name: "A", slug: "a", createdAt: new Date() },
      { id: orgB, name: "B", slug: "b", createdAt: new Date() },
    ]);
    wsA = await withOrganization(db, orgA, async (tx) => {
      const [w] = await tx.insert(workspaces).values({ organizationId: orgA, name: "A1", slug: "a-one" }).returning();
      return w!.id;
    });
    wsB = await withOrganization(db, orgB, async (tx) => {
      const [w] = await tx.insert(workspaces).values({ organizationId: orgB, name: "B1", slug: "b-one" }).returning();
      return w!.id;
    });
    await withWorkspace(db, { organizationId: orgB, workspaceId: wsB }, (tx) =>
      tx.insert(auditLogs).values({ workspaceId: wsB, action: "workspace.created", entityType: "workspace" }),
    );
  });

  afterAll(async () => {
    await db?.$sql.end();
  });

  it("hides everything when no tenant context is set", async () => {
    expect(await db.select().from(workspaces)).toHaveLength(0);
    expect(await db.select().from(auditLogs)).toHaveLength(0);
  });

  it("shows an organization only its own workspaces", async () => {
    const rows = await withOrganization(db, orgA, (tx) => tx.select().from(workspaces));
    expect(rows.map((r) => r.slug)).toEqual(["a-one"]);
  });

  it("blocks reading another workspace's data even with an explicit filter", async () => {
    const rows = await withWorkspace(db, { organizationId: orgA, workspaceId: wsA }, (tx) =>
      tx.select().from(auditLogs).where(eq(auditLogs.workspaceId, wsB)),
    );
    expect(rows).toHaveLength(0);
  });

  it("blocks a workspace id that belongs to a different organization", async () => {
    const rows = await withWorkspace(db, { organizationId: orgA, workspaceId: wsB }, (tx) =>
      tx.select().from(auditLogs),
    );
    expect(rows).toHaveLength(0);
  });

  it("rejects writes into another tenant", async () => {
    await expect(
      withOrganization(db, orgA, (tx) =>
        tx.insert(workspaces).values({ organizationId: orgB, name: "x", slug: "sneaky" }),
      ),
    ).rejects.toThrow();
    await expect(
      withWorkspace(db, { organizationId: orgA, workspaceId: wsA }, (tx) =>
        tx.insert(auditLogs).values({ workspaceId: wsB, action: "x", entityType: "x" }),
      ),
    ).rejects.toThrow();
  });

  it("blocks updates and deletes across tenants", async () => {
    await withOrganization(db, orgA, (tx) =>
      tx.update(workspaces).set({ name: "hacked" }).where(eq(workspaces.id, wsB)),
    );
    await withOrganization(db, orgA, (tx) => tx.delete(workspaces).where(eq(workspaces.id, wsB)));
    const [b] = await withOrganization(db, orgB, (tx) => tx.select().from(workspaces));
    expect(b?.name).toBe("B1");
  });

  it("isolates every workspace-scoped table", async () => {
    const page = { root: {}, content: [] };
    const ctxB = { organizationId: orgB, workspaceId: wsB };
    await withWorkspace(db, ctxB, async (tx) => {
      const [f] = await tx.insert(funnels).values({ workspaceId: wsB, name: "F", slug: "f" }).returning();
      const [s] = await tx
        .insert(funnelSteps)
        .values({ workspaceId: wsB, funnelId: f!.id, name: "Opt-in", type: "optin", slug: "optin", draft: page })
        .returning();
      await tx.insert(pageVersions).values({ workspaceId: wsB, stepId: s!.id, data: page });
      await tx.insert(contacts).values({ workspaceId: wsB, email: "lead@example.com" });
    });
    const ctxA = { organizationId: orgA, workspaceId: wsA };
    for (const table of [funnels, funnelSteps, pageVersions, contacts]) {
      expect(await withWorkspace(db, ctxA, (tx) => tx.select().from(table))).toHaveLength(0);
      expect(await withWorkspace(db, ctxB, (tx) => tx.select().from(table))).toHaveLength(1);
    }
    await expect(
      withWorkspace(db, ctxA, (tx) => tx.insert(funnels).values({ workspaceId: wsB, name: "x", slug: "x" })),
    ).rejects.toThrow();
  });

  it("isolates imported media files", async () => {
    const ctxA = { organizationId: orgA, workspaceId: wsA };
    const ctxB = { organizationId: orgB, workspaceId: wsB };
    const file = { contentType: "image/png", size: 3, sha256: "abc", data: Buffer.from([1, 2, 3]) };
    await withWorkspace(db, ctxB, (tx) => tx.insert(mediaFiles).values({ workspaceId: wsB, ...file }));
    expect(await withWorkspace(db, ctxA, (tx) => tx.select().from(mediaFiles))).toHaveLength(0);
    const [own] = await withWorkspace(db, ctxB, (tx) => tx.select().from(mediaFiles));
    expect(own?.data).toEqual(Buffer.from([1, 2, 3]));
    await expect(
      withWorkspace(db, ctxA, (tx) => tx.insert(mediaFiles).values({ workspaceId: wsB, ...file, sha256: "x" })),
    ).rejects.toThrow();
  });

  it("isolates organization billing", async () => {
    await withOrganization(db, orgB, (tx) =>
      tx.insert(orgBilling).values({ organizationId: orgB, plan: "pro", status: "active", provider: "test" }),
    );
    expect(await withOrganization(db, orgA, (tx) => tx.select().from(orgBilling))).toHaveLength(0);
    expect(await withOrganization(db, orgB, (tx) => tx.select().from(orgBilling))).toHaveLength(1);
    await expect(
      withOrganization(db, orgA, (tx) =>
        tx.insert(orgBilling).values({ organizationId: orgB, plan: "scale", status: "active", provider: "test" }),
      ),
    ).rejects.toThrow();
  });

  it("enforces RLS on every table that has a workspace_id column", async () => {
    const rows = (await db.execute(sql`
      select c.relname as table, c.relrowsecurity as enabled, c.relforcerowsecurity as forced,
             (select count(*) from pg_policy p where p.polrelid = c.oid)::int as policies
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'workspace_id' and not a.attisdropped
      where c.relkind = 'r'`)) as unknown as { table: string; enabled: boolean; forced: boolean; policies: number }[];
    expect(rows.length).toBeGreaterThanOrEqual(15);
    const unprotected = rows.filter((r) => !r.enabled || !r.forced || r.policies === 0).map((r) => r.table);
    expect(unprotected).toEqual([]);
  });

  it("keeps the platform audit log to system code only", async () => {
    await withSystem(db, (tx) =>
      tx.insert(platformAuditLog).values({ action: "org.suspend", targetType: "organization", targetId: orgB }),
    );
    expect(await db.select().from(platformAuditLog)).toHaveLength(0);
    expect(await withOrganization(db, orgB, (tx) => tx.select().from(platformAuditLog))).toHaveLength(0);
    await expect(
      withOrganization(db, orgA, (tx) =>
        tx.insert(platformAuditLog).values({ action: "forged", targetType: "organization" }),
      ),
    ).rejects.toThrow();
    expect(await withSystem(db, (tx) => tx.select().from(platformAuditLog))).toHaveLength(1);
  });

  it("lets only system code suspend or unsuspend an organization", async () => {
    await expect(
      withOrganization(db, orgA, (tx) => tx.insert(organizationSuspensions).values({ organizationId: orgA })),
    ).rejects.toThrow();
    await withSystem(db, (tx) => tx.insert(organizationSuspensions).values({ organizationId: orgB }));
    // Readable without context (the dashboard checks it next to the membership lookup)...
    expect(await db.select().from(organizationSuspensions)).toHaveLength(1);
    // ...but a tenant cannot lift its own suspension.
    const lifted = await withOrganization(db, orgB, (tx) =>
      tx.delete(organizationSuspensions).where(eq(organizationSuspensions.organizationId, orgB)).returning(),
    );
    expect(lifted).toHaveLength(0);
    await withSystem(db, (tx) =>
      tx.delete(organizationSuspensions).where(eq(organizationSuspensions.organizationId, orgB)),
    );
    expect(await db.select().from(organizationSuspensions)).toHaveLength(0);
  });

  it("lets trusted system code see across tenants", async () => {
    const rows = await withSystem(db, (tx) => tx.select().from(workspaces));
    expect(rows).toHaveLength(2);
  });
});
