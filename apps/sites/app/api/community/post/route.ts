import { communityPosts } from "@zfunnel/db";
import { toSafeHtml } from "@zfunnel/email";
import { system } from "@zfunnel/payments";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, publicPost } from "@/lib/api";
import { spaceById } from "@/lib/community";
import { currentCustomer } from "@/lib/customer";

const schema = z.object({
  spaceId: z.string().uuid(),
  title: z.string().trim().min(3, "errors.addTitle").max(160),
  body: z.string().trim().min(1, "errors.writeSomething").max(10_000),
});

export async function POST(req: Request) {
  const g = await publicPost(req, "community-post", 10);
  if ("error" in g) return g.error;
  const me = await currentCustomer(g.ws.id);
  if (!me) return jsonError("errors.signInAgain", 401);
  const p = schema.safeParse(g.body);
  if (!p.success) return jsonError(p.error.issues[0]!.message);
  const space = await spaceById(g.ws.id, p.data.spaceId, me.id);
  if (!space) return jsonError("errors.noSpaceAccess", 403);
  const [post] = await system((tx) =>
    tx
      .insert(communityPosts)
      .values({
        workspaceId: g.ws.id,
        spaceId: space.id,
        contactId: me.id,
        authorName: me.name || me.email.split("@")[0]!,
        title: p.data.title,
        body: toSafeHtml(p.data.body),
      })
      .returning({ id: communityPosts.id }),
  );
  return NextResponse.json({ ok: true, url: `/community/${space.slug}/${post!.id}` });
}
