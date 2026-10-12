import { and, contacts, desc, eq, isNull, lt, sql } from "@zfunnel/db";
import { enqueueMany } from "@zfunnel/queue";
import { z } from "zod";
import { apiError, authenticate, inApi, readJson } from "@/lib/api-auth";
import { enforce } from "@/lib/billing";

const shape = (c: typeof contacts.$inferSelect) => ({
  id: c.id,
  email: c.email,
  name: c.name,
  phone: c.phone,
  tags: c.tags,
  fields: c.fields,
  unsubscribed: Boolean(c.unsubscribedAt),
  createdAt: c.createdAt.toISOString(),
});

/** GET /api/v1/contacts?email=&limit=50&before=<createdAt ISO> */
export async function GET(req: Request) {
  const a = await authenticate(req);
  if (a instanceof Response) return a;
  const q = new URL(req.url).searchParams;
  const limit = Math.min(200, Math.max(1, Number(q.get("limit")) || 50));
  const email = q.get("email")?.toLowerCase();
  const before = q.get("before");
  const rows = await inApi(a, (tx) =>
    tx
      .select()
      .from(contacts)
      .where(
        and(
          isNull(contacts.deletedAt),
          email ? eq(contacts.email, email) : undefined,
          before && !Number.isNaN(Date.parse(before)) ? lt(contacts.createdAt, new Date(before)) : undefined,
        ),
      )
      .orderBy(desc(contacts.createdAt))
      .limit(limit),
  );
  const data = rows.map(shape);
  return Response.json({ data, nextBefore: data.length === limit ? data.at(-1)!.createdAt : null });
}

const body = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(50).optional(),
  fields: z
    .record(
      z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
      z.union([z.string().max(500), z.number(), z.boolean(), z.null()]),
    )
    .optional(),
});

/** POST /api/v1/contacts: create or update by email (tags are added, never removed). */
export async function POST(req: Request) {
  const a = await authenticate(req);
  if (a instanceof Response) return a;
  const p = body.safeParse(await readJson(req));
  if (!p.success)
    return apiError(422, p.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; "));
  const d = p.data;
  const tags = [...new Set(d.tags ?? [])];
  const result = await inApi(a, async (tx) => {
    const [existing] = await tx.select().from(contacts).where(eq(contacts.email, d.email));
    if (!existing) {
      const blocked = await enforce(a.organizationId, "contacts");
      if (blocked) return { blocked };
    }
    const [c] = await tx
      .insert(contacts)
      .values({
        workspaceId: a.workspaceId,
        email: d.email,
        name: d.name ?? null,
        phone: d.phone ?? null,
        tags,
        fields: d.fields ?? {},
      })
      .onConflictDoUpdate({
        target: [contacts.workspaceId, contacts.email],
        set: {
          deletedAt: null,
          name: sql`coalesce(excluded.name, ${contacts.name})`,
          phone: sql`coalesce(excluded.phone, ${contacts.phone})`,
          tags: sql`(select array(select distinct unnest(${contacts.tags} || excluded.tags)))`,
          fields: sql`${contacts.fields} || excluded.fields`,
          updatedAt: new Date(),
        },
      })
      .returning();
    const added = tags.filter((t) => !(existing?.tags ?? []).includes(t));
    return { contact: c!, created: !existing, added };
  });
  if ("blocked" in result) return apiError(402, result.blocked!);
  if (result.added.length)
    await enqueueMany(
      "workflow-events",
      result.added.map((tag) => ({
        workspaceId: a.workspaceId,
        contactId: result.contact.id,
        type: "tag_added" as const,
        data: { tag },
      })),
    );
  return Response.json(
    { data: shape(result.contact), created: result.created },
    { status: result.created ? 201 : 200 },
  );
}
