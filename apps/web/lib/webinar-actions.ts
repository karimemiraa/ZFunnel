"use server";

import { eq, webinars } from "@zfunnel/db";
import { isValidTimezone, parseVideoUrl, slugify } from "@zfunnel/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inWorkspace } from "./funnels";
import { requireUser } from "./session";
import { getWorkspaceForUser, recordAudit } from "./workspaces";

type Result = { ok: true; id?: string; message?: string } | { ok: false; error: string };

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error("Workspace not found");
  return { user, ctx };
}
const refresh = (ws: string) => revalidatePath(`/${ws}/webinars`, "layout");

export async function createWebinar(workspaceSlug: string, title: string, timezone: string): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const t = title.trim();
  if (t.length < 3 || t.length > 120) return { ok: false, error: "Give the webinar a title (3–120 characters)." };
  const tz = isValidTimezone(timezone) ? timezone : "UTC";
  const id = await inWorkspace(ctx, async (tx) => {
    const taken = new Set((await tx.select({ slug: webinars.slug }).from(webinars)).map((w) => w.slug));
    const root = slugify(t) || "webinar";
    let slug = root;
    for (let i = 2; taken.has(slug); i++) slug = `${root}-${i}`;
    const [w] = await tx
      .insert(webinars)
      .values({
        workspaceId: ctx.workspace.id,
        title: t,
        slug,
        timezone: tz,
        schedule: { kind: "evergreen", days: [1, 2, 3, 4, 5], times: ["11:00", "19:00"], justInTime: true },
      })
      .returning({ id: webinars.id });
    return w!.id;
  });
  await recordAudit(ctx, user.id, { action: "webinar.created", entityType: "webinar", entityId: id });
  refresh(workspaceSlug);
  return { ok: true, id };
}

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const schema = z
  .object({
    title: z.string().trim().min(3, "Give the webinar a title").max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]{2,60}$/, "Use lowercase letters, numbers and dashes"),
    description: z.string().trim().max(3000),
    videoUrl: z.string().trim().max(500),
    timezone: z.string().refine(isValidTimezone, "Pick a valid timezone"),
    durationMinutes: z.number().int().min(5).max(600),
    replayHours: z
      .number()
      .int()
      .min(0)
      .max(24 * 30),
    schedule: z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("evergreen"),
        days: z.array(z.number().int().min(0).max(6)).max(7),
        times: z.array(hhmm).max(12),
        justInTime: z.boolean(),
      }),
      z.object({ kind: z.literal("live"), startAt: z.string().datetime({ offset: true }) }),
    ]),
    offerLabel: z.string().trim().max(80),
    offerUrl: z.string().trim().max(500),
    offerAtMinute: z.number().int().min(0).max(600).nullable(),
  })
  .superRefine((v, c) => {
    if (v.videoUrl && !parseVideoUrl(v.videoUrl))
      c.addIssue({ code: "custom", path: ["videoUrl"], message: "Use a YouTube, Vimeo or https .mp4 link" });
    if (
      v.schedule.kind === "evergreen" &&
      !v.schedule.justInTime &&
      (!v.schedule.days.length || !v.schedule.times.length)
    )
      c.addIssue({
        code: "custom",
        path: ["schedule"],
        message: "Pick at least one day and time, or turn on “just in time”",
      });
    if (v.offerLabel && !/^https:\/\/\S+$/.test(v.offerUrl))
      c.addIssue({ code: "custom", path: ["offerUrl"], message: "The offer link must start with https://" });
  });

export async function saveWebinar(workspaceSlug: string, id: string, input: z.input<typeof schema>): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const d = schema.safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const v = d.data;
  const err = await inWorkspace(ctx, async (tx) => {
    const [clash] = await tx.select({ id: webinars.id }).from(webinars).where(eq(webinars.slug, v.slug));
    if (clash && clash.id !== id) return "Another webinar already uses this link.";
    const res = await tx
      .update(webinars)
      .set({
        ...v,
        offerLabel: v.offerLabel || null,
        offerUrl: v.offerLabel ? v.offerUrl : null,
        offerAtMinute: v.offerLabel ? (v.offerAtMinute ?? 0) : null,
      })
      .where(eq(webinars.id, id))
      .returning({ id: webinars.id });
    return res.length ? null : "Webinar not found.";
  });
  if (err) return { ok: false, error: err };
  refresh(workspaceSlug);
  return { ok: true, message: "Webinar saved" };
}

export async function setWebinarStatus(
  workspaceSlug: string,
  id: string,
  status: "draft" | "published",
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const err = await inWorkspace(ctx, async (tx) => {
    const [w] = await tx.select().from(webinars).where(eq(webinars.id, id));
    if (!w) return "Webinar not found.";
    if (status === "published" && !parseVideoUrl(w.videoUrl)) return "Add a video link before publishing.";
    await tx.update(webinars).set({ status }).where(eq(webinars.id, id));
    return null;
  });
  if (err) return { ok: false, error: err };
  refresh(workspaceSlug);
  return { ok: true, message: status === "published" ? "Registration page is live" : "Webinar unpublished" };
}

export async function deleteWebinar(workspaceSlug: string, id: string): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.delete(webinars).where(eq(webinars.id, id)));
  await recordAudit(ctx, user.id, { action: "webinar.deleted", entityType: "webinar", entityId: id });
  refresh(workspaceSlug);
  return { ok: true, message: "Webinar deleted" };
}
