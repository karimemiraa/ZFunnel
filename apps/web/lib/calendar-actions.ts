"use server";

import { bookings, calendars, eq } from "@zfunnel/db";
import { isValidTimezone, slugify, WEEKDAYS } from "@zfunnel/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { inWorkspace } from "./funnels";
import { requireUser } from "./session";
import { getWorkspaceForUser, recordAudit } from "./workspaces";

type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error("Workspace not found");
  return { user, ctx };
}

const WORKDAY = [{ start: "09:00", end: "17:00" }];
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const availabilitySchema = z
  .record(
    z.enum(WEEKDAYS as [string, ...string[]]),
    z
      .array(
        z.object({ start: time, end: time }).refine((w) => w.start < w.end, "Each window must end after it starts"),
      )
      .max(6),
  )
  .refine((a) => Object.values(a).some((w) => w.length), "Add at least one available time");

export async function createCalendar(workspaceSlug: string, name: string, timezone: string): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const n = z.string().trim().min(2, "Name your calendar").max(80).safeParse(name);
  if (!n.success) return { ok: false, error: n.error.issues[0]!.message };
  const tz = isValidTimezone(timezone) ? timezone : "UTC";
  const id = await inWorkspace(ctx, async (tx) => {
    const taken = new Set((await tx.select({ slug: calendars.slug }).from(calendars)).map((c) => c.slug));
    const root = slugify(n.data) || "meeting";
    let slug = root;
    for (let i = 2; taken.has(slug); i++) slug = `${root}-${i}`;
    const [c] = await tx
      .insert(calendars)
      .values({
        workspaceId: ctx.workspace.id,
        name: n.data,
        slug,
        timezone: tz,
        availability: { mon: WORKDAY, tue: WORKDAY, wed: WORKDAY, thu: WORKDAY, fri: WORKDAY },
      })
      .returning({ id: calendars.id });
    return c!.id;
  });
  await recordAudit(ctx, user.id, { action: "calendar.created", entityType: "calendar", entityId: id });
  revalidatePath(`/${workspaceSlug}/calendars`);
  return { ok: true, id };
}

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{1,64}$/, "Use lowercase letters, numbers and dashes"),
  description: z.string().trim().max(1000),
  location: z.string().trim().max(300),
  durationMinutes: z.number().int().min(5).max(480),
  bufferMinutes: z.number().int().min(0).max(240),
  minNoticeHours: z.number().int().min(0).max(720),
  maxDaysAhead: z.number().int().min(1).max(365),
  timezone: z.string().refine(isValidTimezone, "Unknown timezone"),
  status: z.enum(["active", "paused"]),
  availability: availabilitySchema,
});

export async function saveCalendar(
  workspaceSlug: string,
  id: string,
  input: z.input<typeof settingsSchema>,
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const d = settingsSchema.safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  try {
    await inWorkspace(ctx, (tx) => tx.update(calendars).set(d.data).where(eq(calendars.id, id)));
  } catch {
    return { ok: false, error: "Another calendar already uses that URL." };
  }
  revalidatePath(`/${workspaceSlug}/calendars`, "layout");
  return { ok: true, message: "Calendar saved" };
}

export async function cancelBooking(workspaceSlug: string, bookingId: string): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, bookingId)));
  await recordAudit(ctx, user.id, { action: "booking.cancelled", entityType: "booking", entityId: bookingId });
  revalidatePath(`/${workspaceSlug}/calendars`, "layout");
  return { ok: true, message: "Booking cancelled. The time is open again." };
}

export async function deleteCalendar(workspaceSlug: string, id: string) {
  const { ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.delete(calendars).where(eq(calendars.id, id)));
  revalidatePath(`/${workspaceSlug}/calendars`);
  redirect(`/${workspaceSlug}/calendars`);
}
