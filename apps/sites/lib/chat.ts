import "server-only";

import { and, asc, chatSettings, conversationMessages, conversations, eq } from "@zfunnel/db";
import { system } from "@zfunnel/payments";

export const CHAT_COOKIE = "zf_chat";
export const chatCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 180 * 86_400,
};

export async function chatConfig(workspaceId: string) {
  const [s] = await system((tx) => tx.select().from(chatSettings).where(eq(chatSettings.workspaceId, workspaceId)));
  return s?.enabled ? s : null;
}

/** The visitor's conversation (by cookie token) with its messages, or null. */
export async function visitorThread(workspaceId: string, token: string | undefined) {
  if (!token || !/^[A-Za-z0-9_-]{32,64}$/.test(token)) return null;
  return system(async (tx) => {
    const [c] = await tx
      .select()
      .from(conversations)
      .where(and(eq(conversations.workspaceId, workspaceId), eq(conversations.visitorToken, token)));
    if (!c) return null;
    const messages = await tx
      .select({
        id: conversationMessages.id,
        sender: conversationMessages.sender,
        body: conversationMessages.body,
        createdAt: conversationMessages.createdAt,
      })
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, c.id))
      .orderBy(asc(conversationMessages.createdAt))
      .limit(500);
    return { conversation: c, messages };
  });
}
