import { contacts, courseEnrollments, courses, eq } from "@zfunnel/db";
import { z } from "zod";
import { apiError, authenticate, inApi, readJson } from "@/lib/api-auth";

/** POST /api/v1/courses/{id}/enrollments { email, name? }: give someone access to a course. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authenticate(req);
  if (a instanceof Response) return a;
  const { id } = await params;
  const p = z
    .object({ email: z.string().trim().toLowerCase().email(), name: z.string().trim().max(120).optional() })
    .safeParse(await readJson(req));
  if (!p.success) return apiError(422, "Send a valid email.");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError(404, "Course not found.");
  const r = await inApi(a, async (tx) => {
    const [course] = await tx.select({ id: courses.id }).from(courses).where(eq(courses.id, id));
    if (!course) return null;
    const [c] = await tx
      .insert(contacts)
      .values({ workspaceId: a.workspaceId, email: p.data.email, name: p.data.name ?? null })
      .onConflictDoUpdate({
        target: [contacts.workspaceId, contacts.email],
        set: { deletedAt: null, updatedAt: new Date() },
      })
      .returning({ id: contacts.id });
    const [e] = await tx
      .insert(courseEnrollments)
      .values({ workspaceId: a.workspaceId, courseId: id, contactId: c!.id, source: "api" })
      .onConflictDoUpdate({
        target: [courseEnrollments.courseId, courseEnrollments.contactId],
        set: { revokedAt: null },
      })
      .returning();
    return { enrollmentId: e!.id, contactId: c!.id };
  });
  if (!r) return apiError(404, "Course not found.");
  return Response.json({ data: r }, { status: 201 });
}
