import "server-only";

import {
  and,
  asc,
  courseEnrollments,
  courseLessons,
  courseModules,
  courses,
  eq,
  inArray,
  isNull,
  lessonProgress,
} from "@zfunnel/db";
import { system } from "@zfunnel/payments";

const DAY = 86_400_000;

export async function myCourses(workspaceId: string, contactId: string) {
  return system(async (tx) => {
    const rows = await tx
      .select({ c: courses, enrolledAt: courseEnrollments.createdAt })
      .from(courseEnrollments)
      .innerJoin(courses, eq(courses.id, courseEnrollments.courseId))
      .where(
        and(
          eq(courseEnrollments.workspaceId, workspaceId),
          eq(courseEnrollments.contactId, contactId),
          isNull(courseEnrollments.revokedAt),
          eq(courses.status, "published"),
        ),
      )
      .orderBy(asc(courses.title));
    if (!rows.length) return [];
    const ids = rows.map((r) => r.c.id);
    const lessons = await tx
      .select({ id: courseLessons.id, courseId: courseLessons.courseId })
      .from(courseLessons)
      .where(inArray(courseLessons.courseId, ids));
    const done = lessons.length
      ? await tx
          .select({ lessonId: lessonProgress.lessonId })
          .from(lessonProgress)
          .where(
            and(
              eq(lessonProgress.contactId, contactId),
              inArray(
                lessonProgress.lessonId,
                lessons.map((l) => l.id),
              ),
            ),
          )
      : [];
    const doneSet = new Set(done.map((d) => d.lessonId));
    return rows.map((r) => {
      const ls = lessons.filter((l) => l.courseId === r.c.id);
      const completed = ls.filter((l) => doneSet.has(l.id)).length;
      return {
        ...r.c,
        lessons: ls.length,
        completed,
        percent: ls.length ? Math.round((completed / ls.length) * 100) : 0,
      };
    });
  });
}

/** A course as one student sees it: which lessons are open, locked by drip, or preview-only. */
export async function courseForStudent(workspaceId: string, slug: string, contactId: string | null) {
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return null;
  return system(async (tx) => {
    const [course] = await tx
      .select()
      .from(courses)
      .where(and(eq(courses.workspaceId, workspaceId), eq(courses.slug, slug), eq(courses.status, "published")));
    if (!course) return null;
    const [enrollment] = contactId
      ? await tx
          .select()
          .from(courseEnrollments)
          .where(
            and(
              eq(courseEnrollments.courseId, course.id),
              eq(courseEnrollments.contactId, contactId),
              isNull(courseEnrollments.revokedAt),
            ),
          )
      : [];
    const modules = await tx
      .select()
      .from(courseModules)
      .where(eq(courseModules.courseId, course.id))
      .orderBy(asc(courseModules.position));
    const lessons = await tx
      .select()
      .from(courseLessons)
      .where(eq(courseLessons.courseId, course.id))
      .orderBy(asc(courseLessons.position));
    const done = contactId
      ? new Set(
          (
            await tx
              .select({ id: lessonProgress.lessonId })
              .from(lessonProgress)
              .where(eq(lessonProgress.contactId, contactId))
          ).map((d) => d.id),
        )
      : new Set<string>();
    const now = Date.now();
    const shaped = modules.map((m) => ({
      ...m,
      lessons: lessons
        .filter((l) => l.moduleId === m.id)
        .map((l) => {
          const unlockAt = enrollment ? new Date(enrollment.createdAt.getTime() + l.dripDays * DAY) : null;
          const open = enrollment ? unlockAt!.getTime() <= now : l.freePreview;
          return { ...l, open, unlockAt: enrollment && !open ? unlockAt : null, done: done.has(l.id) };
        }),
    }));
    const flat = shaped.flatMap((m) => m.lessons);
    return {
      course,
      enrolled: Boolean(enrollment),
      modules: shaped,
      flat,
      completed: flat.filter((l) => l.done).length,
    };
  });
}

export async function setProgress(workspaceId: string, contactId: string, lessonId: string, done: boolean) {
  return system(async (tx) => {
    const [l] = await tx
      .select()
      .from(courseLessons)
      .where(and(eq(courseLessons.id, lessonId), eq(courseLessons.workspaceId, workspaceId)));
    if (!l) return false;
    const [e] = await tx
      .select()
      .from(courseEnrollments)
      .where(
        and(
          eq(courseEnrollments.courseId, l.courseId),
          eq(courseEnrollments.contactId, contactId),
          isNull(courseEnrollments.revokedAt),
        ),
      );
    if (!e) return false;
    if (done) await tx.insert(lessonProgress).values({ workspaceId, lessonId, contactId }).onConflictDoNothing();
    else
      await tx
        .delete(lessonProgress)
        .where(and(eq(lessonProgress.lessonId, lessonId), eq(lessonProgress.contactId, contactId)));
    return true;
  });
}
