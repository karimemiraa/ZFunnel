"use server";

import { sanitizeRichText } from "@zfunnel/email";
import {
  and,
  contacts,
  courseEnrollments,
  courseLessons,
  courseModules,
  courseProducts,
  courses,
  eq,
  sql,
} from "@zfunnel/db";
import { slugify } from "@zfunnel/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { inWorkspace } from "./funnels";
import { requireUser } from "./session";
import { getWorkspaceForUser, recordAudit } from "./workspaces";

type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };
const uuid = z.string().uuid();

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error("Workspace not found");
  return { user, ctx };
}
const refresh = (ws: string, courseId?: string) =>
  revalidatePath(courseId ? `/${ws}/courses/${courseId}` : `/${ws}/courses`, "layout");

/** Plain text becomes paragraphs; HTML is sanitized. */
function toLessonHtml(input: string) {
  const t = input.trim();
  if (!t) return "";
  if (/<[a-z][\s\S]*>/i.test(t)) return sanitizeRichText(t);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return t
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export async function createCourse(workspaceSlug: string, title: string): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const t = z.string().trim().min(2, "Give your course a title").max(120).safeParse(title);
  if (!t.success) return { ok: false, error: t.error.issues[0]!.message };
  const id = await inWorkspace(ctx, async (tx) => {
    const taken = new Set((await tx.select({ slug: courses.slug }).from(courses)).map((c) => c.slug));
    const root = slugify(t.data) || "course";
    let slug = root;
    for (let i = 2; taken.has(slug); i++) slug = `${root}-${i}`;
    const [c] = await tx
      .insert(courses)
      .values({ workspaceId: ctx.workspace.id, title: t.data, slug })
      .returning({ id: courses.id });
    const [m] = await tx
      .insert(courseModules)
      .values({ workspaceId: ctx.workspace.id, courseId: c!.id, title: "Getting started", position: 0 })
      .returning({ id: courseModules.id });
    await tx.insert(courseLessons).values({
      workspaceId: ctx.workspace.id,
      courseId: c!.id,
      moduleId: m!.id,
      title: "Welcome",
      position: 0,
      content: "<p>Welcome to the course! Start here.</p>",
      freePreview: true,
    });
    return c!.id;
  });
  await recordAudit(ctx, user.id, { action: "course.created", entityType: "course", entityId: id });
  refresh(workspaceSlug);
  return { ok: true, id };
}

const settingsSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{1,64}$/, "Use lowercase letters, numbers and dashes"),
  description: z.string().trim().max(2000),
  imageUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https:\/\//.test(v), "Image must be an https:// URL"),
  status: z.enum(["draft", "published"]),
  productIds: z.array(uuid).max(50),
});

export async function saveCourseSettings(
  workspaceSlug: string,
  courseId: string,
  input: z.input<typeof settingsSchema>,
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const d = settingsSchema.safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const err = await inWorkspace(ctx, async (tx) => {
    const [clash] = await tx
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.slug, d.data.slug), sql`${courses.id} <> ${courseId}`));
    if (clash) return "Another course already uses that URL.";
    await tx
      .update(courses)
      .set({
        title: d.data.title,
        slug: d.data.slug,
        description: d.data.description,
        imageUrl: d.data.imageUrl || null,
        status: d.data.status,
      })
      .where(eq(courses.id, courseId));
    await tx.delete(courseProducts).where(eq(courseProducts.courseId, courseId));
    if (d.data.productIds.length)
      await tx
        .insert(courseProducts)
        .values(d.data.productIds.map((productId) => ({ workspaceId: ctx.workspace.id, courseId, productId })));
    return null;
  });
  if (err) return { ok: false, error: err };
  refresh(workspaceSlug, courseId);
  return { ok: true, message: "Course saved" };
}

export async function addModule(workspaceSlug: string, courseId: string, title: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const t = z.string().trim().min(1).max(120).safeParse(title);
  if (!t.success) return { ok: false, error: "Name the module" };
  await inWorkspace(ctx, async (tx) => {
    const [{ n }] = (await tx
      .select({ n: sql<number>`coalesce(max(${courseModules.position}), -1)::int + 1` })
      .from(courseModules)
      .where(eq(courseModules.courseId, courseId))) as [{ n: number }];
    await tx.insert(courseModules).values({ workspaceId: ctx.workspace.id, courseId, title: t.data, position: n });
  });
  refresh(workspaceSlug, courseId);
  return { ok: true };
}

export async function renameModule(workspaceSlug: string, moduleId: string, title: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const t = z.string().trim().min(1).max(120).safeParse(title);
  if (!t.success) return { ok: false, error: "Name the module" };
  await inWorkspace(ctx, (tx) => tx.update(courseModules).set({ title: t.data }).where(eq(courseModules.id, moduleId)));
  return { ok: true };
}

export async function deleteModule(workspaceSlug: string, courseId: string, moduleId: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.delete(courseModules).where(eq(courseModules.id, moduleId)));
  refresh(workspaceSlug, courseId);
  return { ok: true, message: "Module deleted" };
}

export async function addLesson(workspaceSlug: string, courseId: string, moduleId: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const id = await inWorkspace(ctx, async (tx) => {
    const [{ n }] = (await tx
      .select({ n: sql<number>`coalesce(max(${courseLessons.position}), -1)::int + 1` })
      .from(courseLessons)
      .where(eq(courseLessons.moduleId, moduleId))) as [{ n: number }];
    const [l] = await tx
      .insert(courseLessons)
      .values({ workspaceId: ctx.workspace.id, courseId, moduleId, title: "New lesson", position: n })
      .returning({ id: courseLessons.id });
    return l!.id;
  });
  refresh(workspaceSlug, courseId);
  return { ok: true, id };
}

const lessonSchema = z.object({
  title: z.string().trim().min(1, "Give the lesson a title").max(160),
  videoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https:\/\//.test(v), "Video must be an https:// link"),
  content: z.string().max(100_000),
  dripDays: z.number().int().min(0).max(3650),
  freePreview: z.boolean(),
});

export async function saveLesson(
  workspaceSlug: string,
  courseId: string,
  lessonId: string,
  input: z.input<typeof lessonSchema>,
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const d = lessonSchema.safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const content = toLessonHtml(d.data.content);
  await inWorkspace(ctx, (tx) =>
    tx
      .update(courseLessons)
      .set({ ...d.data, videoUrl: d.data.videoUrl || null, content })
      .where(eq(courseLessons.id, lessonId)),
  );
  refresh(workspaceSlug, courseId);
  return { ok: true, message: "Lesson saved" };
}

export async function deleteLesson(workspaceSlug: string, courseId: string, lessonId: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.delete(courseLessons).where(eq(courseLessons.id, lessonId)));
  refresh(workspaceSlug, courseId);
  return { ok: true, message: "Lesson deleted" };
}

/** Moves a module or lesson one place up or down among its siblings. */
export async function moveItem(
  workspaceSlug: string,
  courseId: string,
  kind: "module" | "lesson",
  id: string,
  dir: -1 | 1,
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, async (tx) => {
    const table = kind === "module" ? courseModules : courseLessons;
    const [item] = await tx.select().from(table).where(eq(table.id, id));
    if (!item) return;
    const siblings =
      kind === "module"
        ? await tx
            .select()
            .from(courseModules)
            .where(eq(courseModules.courseId, courseId))
            .orderBy(courseModules.position)
        : await tx
            .select()
            .from(courseLessons)
            .where(eq(courseLessons.moduleId, (item as { moduleId: string }).moduleId))
            .orderBy(courseLessons.position);
    const i = siblings.findIndex((s) => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= siblings.length) return;
    const order = siblings.map((s) => s.id);
    [order[i], order[j]] = [order[j]!, order[i]!];
    for (const [pos, sid] of order.entries()) await tx.update(table).set({ position: pos }).where(eq(table.id, sid));
  });
  refresh(workspaceSlug, courseId);
  return { ok: true };
}

export async function enrollByEmail(workspaceSlug: string, courseId: string, email: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const e = z.string().trim().toLowerCase().email("Enter a valid email").safeParse(email);
  if (!e.success) return { ok: false, error: e.error.issues[0]!.message };
  await inWorkspace(ctx, async (tx) => {
    const [c] = await tx
      .insert(contacts)
      .values({ workspaceId: ctx.workspace.id, email: e.data })
      .onConflictDoUpdate({ target: [contacts.workspaceId, contacts.email], set: { updatedAt: new Date() } })
      .returning({ id: contacts.id });
    await tx
      .insert(courseEnrollments)
      .values({ workspaceId: ctx.workspace.id, courseId, contactId: c!.id, source: "manual" })
      .onConflictDoUpdate({
        target: [courseEnrollments.courseId, courseEnrollments.contactId],
        set: { revokedAt: null },
      });
  });
  refresh(workspaceSlug, courseId);
  return { ok: true, message: `Enrolled ${e.data}` };
}

export async function setEnrollmentAccess(
  workspaceSlug: string,
  courseId: string,
  enrollmentId: string,
  revoke: boolean,
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) =>
    tx
      .update(courseEnrollments)
      .set({ revokedAt: revoke ? new Date() : null })
      .where(eq(courseEnrollments.id, enrollmentId)),
  );
  refresh(workspaceSlug, courseId);
  return { ok: true, message: revoke ? "Access removed" : "Access restored" };
}

export async function deleteCourse(workspaceSlug: string, courseId: string) {
  const { user, ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.delete(courses).where(eq(courses.id, courseId)));
  await recordAudit(ctx, user.id, { action: "course.deleted", entityType: "course", entityId: courseId });
  refresh(workspaceSlug);
  redirect(`/${workspaceSlug}/courses`);
}
