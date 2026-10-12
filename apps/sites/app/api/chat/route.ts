import { randomBytes } from "node:crypto";
import { conversationMessages, conversations, eq, notify } from "@zfunnel/db";
import { system, upsertContact } from "@zfunnel/payments";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, publicPost } from "@/lib/api";
import { CHAT_COOKIE, chatConfig, chatCookieOptions, visitorThread } from "@/lib/chat";
import { currentWorkspace } from "@/lib/site";

/** Widget bootstrap + polling: settings and the visitor's own messages. */
export async function GET() {
  const ws = await currentWorkspace();
  const cfg = ws ? await chatConfig(ws.id) : null;
  if (!ws || !cfg) return NextResponse.json({ enabled: false });
  const thread = await visitorThread(ws.id, (await cookies()).get(CHAT_COOKIE)?.value);
  return NextResponse.json({
    enabled: true,
    name: ws.name,
    greeting: cfg.greeting,
    color: cfg.color,
    started: !!thread,
    messages: thread?.messages ?? [],
  });
}

const schema = z.object({
  body: z.string().trim().min(1, "errors.writeMessage").max(4_000),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().toLowerCase().email("errors.invalidEmail").max(254).optional(),
  pageUrl: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const g = await publicPost(req, "chat", 15);
  if ("error" in g) return g.error;
  if (!(await chatConfig(g.ws.id))) return jsonError("errors.chatOff", 404);
  const p = schema.safeParse(g.body);
  if (!p.success) return jsonError(p.error.issues[0]!.message);
  const jar = await cookies();
  const thread = await visitorThread(g.ws.id, jar.get(CHAT_COOKIE)?.value);
  if (thread) {
    await system(async (tx) => {
      await tx.insert(conversationMessages).values({
        workspaceId: g.ws.id,
        conversationId: thread.conversation.id,
        sender: "visitor",
        body: p.data.body,
      });
      await tx
        .update(conversations)
        .set({ unread: true, status: "open", lastMessageAt: new Date() })
        .where(eq(conversations.id, thread.conversation.id));
      // One notification per unread burst, not one per message.
      if (!thread.conversation.unread)
        await notify(tx, {
          workspaceId: g.ws.id,
          type: "chat",
          entityId: thread.conversation.id,
          data: { name: thread.conversation.name || thread.conversation.email, preview: p.data.body.slice(0, 120) },
        });
    });
    return NextResponse.json({ ok: true });
  }
  // First message: we need an email so the owner can answer.
  if (!p.data.email) return jsonError("errors.enterEmailForReply");
  const token = randomBytes(24).toString("base64url");
  await system(async (tx) => {
    const contact = await upsertContact(tx, g.ws.id, { email: p.data.email!, name: p.data.name, ip: g.ip });
    const [c] = await tx
      .insert(conversations)
      .values({
        workspaceId: g.ws.id,
        contactId: contact.id,
        visitorToken: token,
        name: p.data.name ?? "",
        email: p.data.email!,
        pageUrl: p.data.pageUrl ?? "",
      })
      .returning({ id: conversations.id });
    await tx
      .insert(conversationMessages)
      .values({ workspaceId: g.ws.id, conversationId: c!.id, sender: "visitor", body: p.data.body });
    await notify(tx, {
      workspaceId: g.ws.id,
      type: "chat",
      entityId: c!.id,
      data: { name: p.data.name || p.data.email!, preview: p.data.body.slice(0, 120) },
    });
  });
  jar.set(CHAT_COOKIE, token, chatCookieOptions);
  return NextResponse.json({ ok: true });
}
