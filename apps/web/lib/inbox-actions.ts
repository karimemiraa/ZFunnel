"use server";

import { chatSettings, conversationMessages, conversations, emailMessages, eq } from "@zfunnel/db";
import { getTranslator } from "@zfunnel/i18n";
import { enqueue } from "@zfunnel/queue";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inWorkspace } from "./funnels";
import { requireUser } from "./session";
import { siteOrigin } from "./urls";
import { getWorkspaceForUser } from "./workspaces";

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error("Workspace not found");
  return ctx;
}
const refresh = (ws: string) => revalidatePath(`/${ws}/inbox`);

const settingsSchema = z.object({
  enabled: z.boolean(),
  greeting: z.string().trim().min(1, "Write a greeting").max(300),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, "Pick a color"),
});

export async function saveChatSettings(workspaceSlug: string, input: z.input<typeof settingsSchema>): Promise<Result> {
  const ctx = await ctxFor(workspaceSlug);
  const d = settingsSchema.safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  await inWorkspace(ctx, (tx) =>
    tx
      .insert(chatSettings)
      .values({ workspaceId: ctx.workspace.id, ...d.data })
      .onConflictDoUpdate({ target: chatSettings.workspaceId, set: { ...d.data, updatedAt: new Date() } }),
  );
  refresh(workspaceSlug);
  return { ok: true, message: d.data.enabled ? "Chat is live on your site" : "Chat settings saved" };
}

/** Owner reply: saved in the thread and emailed to the visitor. */
export async function replyToConversation(workspaceSlug: string, id: string, body: string): Promise<Result> {
  const ctx = await ctxFor(workspaceSlug);
  const text = body.trim();
  if (!text || text.length > 4_000) return { ok: false, error: "Write a reply (up to 4,000 characters)." };
  const messageId = await inWorkspace(ctx, async (tx) => {
    const [c] = await tx.select().from(conversations).where(eq(conversations.id, id));
    if (!c) return null;
    await tx
      .insert(conversationMessages)
      .values({ workspaceId: ctx.workspace.id, conversationId: c.id, sender: "owner", body: text });
    await tx.update(conversations).set({ unread: false, lastMessageAt: new Date() }).where(eq(conversations.id, c.id));
    let origin = siteOrigin(ctx.workspace.slug);
    try {
      if (c.pageUrl) origin = new URL(c.pageUrl).origin;
    } catch {
      // Malformed page URL: fall back to the workspace site.
    }
    const [m] = await tx
      .insert(emailMessages)
      .values({
        workspaceId: ctx.workspace.id,
        contactId: c.contactId,
        toEmail: c.email,
        subject: getTranslator(ctx.workspace.siteLocale)("emails.chatSubject", { name: ctx.workspace.name }),
        meta: { kind: "chat_reply", conversationId: c.id, siteOrigin: origin },
      })
      .returning({ id: emailMessages.id });
    return m!.id;
  });
  if (!messageId) return { ok: false, error: "Conversation not found." };
  const queued = await enqueue("email", { messageId }, { jobId: `msg-${messageId}` });
  refresh(workspaceSlug);
  return { ok: true, message: queued ? "Reply sent" : "Reply saved. The email will go out when the worker is back." };
}

export async function setConversationStatus(
  workspaceSlug: string,
  id: string,
  status: "open" | "closed",
): Promise<Result> {
  const ctx = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) =>
    tx.update(conversations).set({ status, unread: false }).where(eq(conversations.id, id)),
  );
  refresh(workspaceSlug);
  return { ok: true, message: status === "closed" ? "Conversation closed" : "Conversation reopened" };
}

export async function markConversationRead(workspaceSlug: string, id: string) {
  const ctx = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.update(conversations).set({ unread: false }).where(eq(conversations.id, id)));
}
