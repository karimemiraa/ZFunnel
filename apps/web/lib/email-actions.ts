"use server";

import { broadcasts, emailMessages, emails, emailSettings, eq, segments } from "@zfunnel/db";
import { starterEmail } from "@zfunnel/email/editor";
import { enqueue } from "@zfunnel/queue";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audienceCount } from "./email";
import { inWorkspace } from "./funnels";
import { requireUser } from "./session";
import { canManage, getWorkspaceForUser, recordAudit } from "./workspaces";

type Result = { ok: true; message?: string; count?: number } | { ok: false; error: string };

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error("Workspace not found");
  return { user, ctx };
}

const settingsSchema = z.object({
  fromName: z.string().trim().min(2, "Sender name is required").max(80),
  replyTo: z.string().trim().toLowerCase().email("Enter a valid reply-to email"),
  postalAddress: z.string().trim().min(8, "A postal address is required by anti-spam laws (CAN-SPAM, GDPR)").max(300),
});

export async function saveEmailSettings(workspaceSlug: string, input: z.input<typeof settingsSchema>): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  if (!canManage(ctx.membership.role))
    return { ok: false, error: "Only owners and admins can change sender settings." };
  const s = settingsSchema.safeParse(input);
  if (!s.success) return { ok: false, error: s.error.issues[0]!.message };
  await inWorkspace(ctx, (tx) =>
    tx
      .insert(emailSettings)
      .values({ workspaceId: ctx.workspace.id, ...s.data })
      .onConflictDoUpdate({ target: emailSettings.workspaceId, set: s.data }),
  );
  await recordAudit(ctx, user.id, { action: "email.settings_updated", entityType: "email_settings" });
  revalidatePath(`/${workspaceSlug}/email`, "layout");
  return { ok: true, message: "Sender settings saved" };
}

export async function createBroadcast(workspaceSlug: string) {
  const { ctx } = await ctxFor(workspaceSlug);
  const id = await inWorkspace(ctx, async (tx) => {
    const [e] = await tx
      .insert(emails)
      .values({
        workspaceId: ctx.workspace.id,
        name: "Untitled broadcast",
        subject: "",
        preheader: "",
        content: starterEmail() as never,
        kind: "broadcast",
      })
      .returning();
    const [b] = await tx.insert(broadcasts).values({ workspaceId: ctx.workspace.id, emailId: e!.id }).returning();
    return b!.id;
  });
  redirect(`/${workspaceSlug}/email/${id}`);
}

const draftSchema = z.object({
  name: z.string().trim().max(120),
  subject: z.string().trim().max(200),
  preheader: z.string().trim().max(200),
  audience: z.string().max(80),
});

/** audience: "all" | "segment:<id>" | "tag:<name>" */
export async function saveBroadcastDraft(
  workspaceSlug: string,
  broadcastId: string,
  input: z.input<typeof draftSchema>,
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const d = draftSchema.safeParse(input);
  if (!d.success) return { ok: false, error: "Invalid input" };
  const segmentId = d.data.audience.startsWith("segment:") ? d.data.audience.slice(8) : null;
  const tag = d.data.audience.startsWith("tag:") ? d.data.audience.slice(4) : null;
  if (segmentId && !z.string().uuid().safeParse(segmentId).success) return { ok: false, error: "Invalid segment" };
  const err = await inWorkspace(ctx, async (tx) => {
    const [b] = await tx.select().from(broadcasts).where(eq(broadcasts.id, broadcastId));
    if (!b) return "Broadcast not found";
    if (b.status !== "draft" && b.status !== "scheduled") return "This broadcast was already sent.";
    if (segmentId) {
      const [s] = await tx.select({ id: segments.id }).from(segments).where(eq(segments.id, segmentId));
      if (!s) return "Segment not found";
    }
    await tx
      .update(emails)
      .set({ name: d.data.name || "Untitled broadcast", subject: d.data.subject, preheader: d.data.preheader })
      .where(eq(emails.id, b.emailId));
    await tx.update(broadcasts).set({ segmentId, tag }).where(eq(broadcasts.id, broadcastId));
    return null;
  });
  if (err) return { ok: false, error: err };
  const count = await audienceCount(ctx, { segmentId, tag });
  revalidatePath(`/${workspaceSlug}/email`, "layout");
  return { ok: true, count };
}

export async function saveEmailDesign(
  workspaceSlug: string,
  emailId: string,
  data: unknown,
): Promise<Result & { savedAt?: string }> {
  const { ctx } = await ctxFor(workspaceSlug);
  const parsed = z
    .object({ root: z.object({}).passthrough(), content: z.array(z.unknown()).max(200) })
    .passthrough()
    .safeParse(data);
  if (!parsed.success || JSON.stringify(data).length > 500_000)
    return { ok: false, error: "This email is invalid or too large." };
  await inWorkspace(ctx, (tx) =>
    tx
      .update(emails)
      .set({ content: parsed.data as never })
      .where(eq(emails.id, emailId)),
  );
  return { ok: true, savedAt: new Date().toISOString() };
}

async function ready(ctx: Awaited<ReturnType<typeof ctxFor>>["ctx"], broadcastId: string) {
  return inWorkspace(ctx, async (tx) => {
    const [settings] = await tx.select().from(emailSettings);
    const [row] = await tx
      .select({ b: broadcasts, e: emails })
      .from(broadcasts)
      .innerJoin(emails, eq(emails.id, broadcasts.emailId))
      .where(eq(broadcasts.id, broadcastId));
    if (!settings)
      return { error: "Add your sender name, reply-to and postal address first (Email → Settings)." } as const;
    if (!row) return { error: "Broadcast not found" } as const;
    if (!row.e.subject.trim()) return { error: "Add a subject line first." } as const;
    return { row } as const;
  });
}

export async function sendTestEmail(workspaceSlug: string, broadcastId: string): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const r = await ready(ctx, broadcastId);
  if ("error" in r) return { ok: false, error: r.error! };
  const [m] = await inWorkspace(ctx, (tx) =>
    tx
      .insert(emailMessages)
      .values({
        workspaceId: ctx.workspace.id,
        emailId: r.row.e.id,
        toEmail: user.email,
        subject: `[TEST] ${r.row.e.subject}`,
        meta: { test: true },
      })
      .returning(),
  );
  const ok = await enqueue("email", { messageId: m!.id });
  if (!ok) return { ok: false, error: "The email queue is unavailable. Is the worker/Redis running?" };
  return { ok: true, message: `Test sent to ${user.email}` };
}

export async function sendBroadcast(workspaceSlug: string, broadcastId: string, when: string | null): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const r = await ready(ctx, broadcastId);
  if ("error" in r) return { ok: false, error: r.error! };
  if (r.row.b.status !== "draft" && r.row.b.status !== "scheduled") return { ok: false, error: "Already sent." };
  const at = when ? new Date(when) : null;
  if (at && (Number.isNaN(at.getTime()) || at.getTime() < Date.now() - 60_000))
    return { ok: false, error: "Pick a time in the future." };
  const count = await audienceCount(ctx, { segmentId: r.row.b.segmentId, tag: r.row.b.tag });
  if (!count) return { ok: false, error: "This audience has no subscribed contacts." };
  await inWorkspace(ctx, (tx) =>
    tx
      .update(broadcasts)
      .set({ status: "scheduled", scheduledAt: at ?? new Date() })
      .where(eq(broadcasts.id, broadcastId)),
  );
  const queued = await enqueue(
    "broadcast",
    { broadcastId },
    {
      jobId: `broadcast-${broadcastId}-${(at ?? new Date()).getTime()}`,
      delay: at ? Math.max(0, at.getTime() - Date.now()) : 0,
    },
  );
  if (!queued) {
    await inWorkspace(ctx, (tx) =>
      tx.update(broadcasts).set({ status: "draft" }).where(eq(broadcasts.id, broadcastId)),
    );
    return { ok: false, error: "The email queue is unavailable. Is the worker/Redis running?" };
  }
  await recordAudit(ctx, user.id, {
    action: at ? "broadcast.scheduled" : "broadcast.sent",
    entityType: "broadcast",
    entityId: broadcastId,
    data: { recipients: count },
  });
  revalidatePath(`/${workspaceSlug}/email`, "layout");
  return { ok: true, message: at ? `Scheduled for ${count} contacts` : `Sending to ${count} contacts…`, count };
}

export async function cancelSchedule(workspaceSlug: string, broadcastId: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  // The delayed job still fires, but processBroadcast ignores drafts.
  await inWorkspace(ctx, (tx) =>
    tx.update(broadcasts).set({ status: "draft", scheduledAt: null }).where(eq(broadcasts.id, broadcastId)),
  );
  revalidatePath(`/${workspaceSlug}/email`, "layout");
  return { ok: true, message: "Back to draft" };
}

export async function deleteBroadcast(workspaceSlug: string, broadcastId: string) {
  const { ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, async (tx) => {
    const [b] = await tx.select().from(broadcasts).where(eq(broadcasts.id, broadcastId));
    if (b) await tx.delete(emails).where(eq(emails.id, b.emailId));
  });
  revalidatePath(`/${workspaceSlug}/email`);
  redirect(`/${workspaceSlug}/email`);
}
