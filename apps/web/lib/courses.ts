import "server-only";

import {
  and,
  asc,
  contacts,
  courseEnrollments,
  courseLessons,
  courseModules,
  courseProducts,
  courses,
  desc,
  eq,
  isNull,
  sql,
} from "@zfunnel/db";
import { inWorkspace } from "./funnels";
import type { WorkspaceContext } from "./workspaces";

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

export async function listCourses(ctx: WorkspaceContext) {
  return inWorkspace(ctx, (tx) =>
    tx
      .select({
        c: courses,
        lessons: sql<number>`(select count(*)::int from course_lessons l where l.course_id = "courses"."id")`,
        students: sql<number>`(select count(*)::int from course_enrollments e where e.course_id = "courses"."id" and e.revoked_at is null)`,
      })
      .from(courses)
      .orderBy(desc(courses.createdAt)),
  );
}

export async function getCourseEditor(ctx: WorkspaceContext, id: string) {
  if (!isUuid(id)) return null;
  return inWorkspace(ctx, async (tx) => {
    const [course] = await tx.select().from(courses).where(eq(courses.id, id));
    if (!course) return null;
    const [modules, lessons, productLinks] = await Promise.all([
      tx.select().from(courseModules).where(eq(courseModules.courseId, id)).orderBy(asc(courseModules.position)),
      tx.select().from(courseLessons).where(eq(courseLessons.courseId, id)).orderBy(asc(courseLessons.position)),
      tx.select({ productId: courseProducts.productId }).from(courseProducts).where(eq(courseProducts.courseId, id)),
    ]);
    return {
      course,
      modules: modules.map((m) => ({ ...m, lessons: lessons.filter((l) => l.moduleId === m.id) })),
      productIds: productLinks.map((p) => p.productId),
      lessonCount: lessons.length,
    };
  });
}

export async function listStudents(ctx: WorkspaceContext, courseId: string, lessonCount: number) {
  return inWorkspace(ctx, (tx) =>
    tx
      .select({
        e: courseEnrollments,
        email: contacts.email,
        name: contacts.name,
        completed: sql<number>`(select count(*)::int from lesson_progress p join course_lessons l on l.id = p.lesson_id
          where p.contact_id = ${courseEnrollments.contactId} and l.course_id = ${courseId})`,
      })
      .from(courseEnrollments)
      .innerJoin(contacts, and(eq(contacts.id, courseEnrollments.contactId), isNull(contacts.deletedAt)))
      .where(and(eq(courseEnrollments.courseId, courseId)))
      .orderBy(desc(courseEnrollments.createdAt))
      .limit(500),
  ).then((rows) =>
    rows.map((r) => ({ ...r, percent: lessonCount ? Math.round((r.completed / lessonCount) * 100) : 0 })),
  );
}
