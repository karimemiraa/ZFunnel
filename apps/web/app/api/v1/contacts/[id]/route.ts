import { and, contactActivities, contacts, desc, eq, isNull } from "@zfunnel/db";
import { apiError, authenticate, inApi } from "@/lib/api-auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authenticate(req);
  if (a instanceof Response) return a;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError(404, "Contact not found.");
  const r = await inApi(a, async (tx) => {
    const [c] = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)));
    if (!c) return null;
    const activity = await tx
      .select()
      .from(contactActivities)
      .where(eq(contactActivities.contactId, id))
      .orderBy(desc(contactActivities.createdAt))
      .limit(50);
    return { c, activity };
  });
  if (!r) return apiError(404, "Contact not found.");
  return Response.json({
    data: {
      id: r.c.id,
      email: r.c.email,
      name: r.c.name,
      phone: r.c.phone,
      tags: r.c.tags,
      fields: r.c.fields,
      unsubscribed: Boolean(r.c.unsubscribedAt),
      createdAt: r.c.createdAt.toISOString(),
      activity: r.activity.map((x) => ({ type: x.type, body: x.body, at: x.createdAt.toISOString() })),
    },
  });
}
