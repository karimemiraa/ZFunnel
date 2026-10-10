import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client";
import { organization } from "./schema/auth";
import { contacts } from "./schema/contacts";
import type { SegmentRule } from "./schema/crm";
import { workspaces } from "./schema/tenancy";
import { segmentCondition } from "./segments";
import { withSystem } from "./tenant";

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("segments", () => {
  let db: Db;
  beforeAll(async () => {
    db = createDb(url!, { max: 2, onnotice: () => {} });
    await db.execute(
      sql`drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;`,
    );
    await migrate(db, { migrationsFolder: new URL("../migrations", import.meta.url).pathname });
    await withSystem(db, async (tx) => {
      await tx.insert(organization).values({ id: "o", name: "O", slug: "o", createdAt: new Date() });
      const [w] = await tx.insert(workspaces).values({ organizationId: "o", name: "W", slug: "w-seg" }).returning();
      await tx.insert(contacts).values([
        { workspaceId: w!.id, email: "anna@acme.com", name: "Anna", tags: ["vip", "webinar"], fields: { plan: "pro" } },
        { workspaceId: w!.id, email: "ben@gmail.com", name: "Ben", tags: ["webinar"], fields: { plan: "free" } },
        {
          workspaceId: w!.id,
          email: "cara_x@acme.com",
          name: null,
          tags: [],
          fields: {},
          createdAt: new Date(Date.now() - 40 * 86400000),
        },
      ]);
    });
  });
  afterAll(async () => db?.$sql.end());

  const emails = async (match: "all" | "any", rules: SegmentRule[]) =>
    (
      await withSystem(db, (tx) =>
        tx.select({ e: contacts.email }).from(contacts).where(segmentCondition(match, rules)).orderBy(contacts.email),
      )
    ).map((r) => r.e);

  it("filters by tags", async () => {
    expect(await emails("all", [{ field: "tag", op: "has", value: "webinar" }])).toEqual([
      "anna@acme.com",
      "ben@gmail.com",
    ]);
    expect(await emails("all", [{ field: "tag", op: "not_has", value: "vip" }])).toEqual([
      "ben@gmail.com",
      "cara_x@acme.com",
    ]);
  });
  it("combines rules with all/any", async () => {
    const rules: SegmentRule[] = [
      { field: "tag", op: "has", value: "vip" },
      { field: "email", op: "contains", value: "gmail" },
    ];
    expect(await emails("all", rules)).toEqual([]);
    expect(await emails("any", rules)).toEqual(["anna@acme.com", "ben@gmail.com"]);
  });
  it("supports dates, custom fields and safe LIKE escaping", async () => {
    expect(await emails("all", [{ field: "created", op: "older_than_days", value: 30 }])).toEqual(["cara_x@acme.com"]);
    expect(await emails("all", [{ field: "custom", key: "plan", op: "equals", value: "pro" }])).toEqual([
      "anna@acme.com",
    ]);
    // "_" is a LIKE wildcard; it must be matched literally.
    expect(await emails("all", [{ field: "email", op: "contains", value: "a_x" }])).toEqual(["cara_x@acme.com"]);
    expect(await emails("all", [{ field: "email", op: "contains", value: "'; drop table contacts; --" }])).toEqual([]);
  });
  it("matches everyone without rules", async () => {
    expect(await emails("all", [])).toHaveLength(3);
  });
});
