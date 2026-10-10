import { communityComments, communityPosts, eq } from "@zfunnel/db";
import { toSafeHtml } from "@zfunnel/email";
import { system } from "@zfunnel/payments";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, publicPost } from "@/lib/api";
import { spaceById } from "@/lib/community";
import { currentCustomer } from "@/lib/customer";

const schema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1, "errors.writeComment").max(5_000),
});

export async function POST(req: Request) {
  const g = await publicPost(req, "community-comment", 20);
  if ("error" in g) return g.error;
  const me = await currentCustomer(g.ws.id);
  if (!me) return jsonError("errors.signInAgain", 401);
  const p = schema.safeParse(g.body);
  if (!p.success) return jsonError(p.error.issues[0]!.message);
  const [post] = await system((tx) => tx.select().from(communityPosts).where(eq(communityPosts.id, p.data.postId)));
  if (!post || post.workspaceId !== g.ws.id || post.hidden || !(await spaceById(g.ws.id, post.spaceId, me.id)))
    return jsonError("errors.postNotFound", 404);
  await system((tx) =>
    tx.insert(communityComments).values({
      workspaceId: g.ws.id,
      postId: post.id,
      contactId: me.id,
      authorName: me.name || me.email.split("@")[0]!,
      body: toSafeHtml(p.data.body),
    }),
  );
  return NextResponse.json({ ok: true });
}
