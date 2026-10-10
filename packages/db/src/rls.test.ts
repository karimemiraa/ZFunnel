import { eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client";
import { organization } from "./schema/auth";
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

  it("lets trusted system code see across tenants", async () => {
    const rows = await withSystem(db, (tx) => tx.select().from(workspaces));
    expect(rows).toHaveLength(2);
  });
});
