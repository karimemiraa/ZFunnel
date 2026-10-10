"use server";

import { and, eq, posts, sql } from "@zfunnel/db";
import { toSafeHtml } from "@zfunnel/email";
import { slugify } from "@zfunnel/shared";
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

export async function createPost(workspaceSlug: string) {
  const { ctx } = await ctxFor(workspaceSlug);
  const id = await inWorkspace(ctx, async (tx) => {
    const taken = new Set((await tx.select({ slug: posts.slug }).from(posts)).map((p) => p.slug));
    let slug = "untitled-post";
    for (let i = 2; taken.has(slug); i++) slug = `untitled-post-${i}`;
    const [p] = await tx
      .insert(posts)
      .values({ workspaceId: ctx.workspace.id, title: "Untitled post", slug })
      .returning({ id: posts.id });
    return p!.id;
  });
  redirect(`/${workspaceSlug}/blog/${id}`);
}

const schema = z.object({
  title: z.string().trim().min(1, "Give the post a title").max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{1,80}$/, "Use lowercase letters, numbers and dashes"),
  excerpt: z.string().trim().max(400),
  content: z.string().max(200_000),
  coverUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https:\/\//.test(v), "Cover must be an https:// URL"),
  seoTitle: z.string().trim().max(70),
  seoDescription: z.string().trim().max(170),
  status: z.enum(["draft", "published"]),
});

export async function savePost(workspaceSlug: string, id: string, input: z.input<typeof schema>): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const d = schema.safeParse({ ...input, slug: input.slug || slugify(input.title ?? "") });
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const err = await inWorkspace(ctx, async (tx) => {
    const [clash] = await tx
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.slug, d.data.slug), sql`${posts.id} <> ${id}`));
    if (clash) return "Another post already uses that URL.";
    const [cur] = await tx
      .select({ publishedAt: posts.publishedAt, status: posts.status })
      .from(posts)
      .where(eq(posts.id, id));
    if (!cur) return "Post not found";
    await tx
      .update(posts)
      .set({
        ...d.data,
        coverUrl: d.data.coverUrl || null,
        content: toSafeHtml(d.data.content, { article: true }),
        // First publish sets the date; later edits keep it.
        publishedAt: d.data.status === "published" ? (cur.publishedAt ?? new Date()) : cur.publishedAt,
      })
      .where(eq(posts.id, id));
    return null;
  });
  if (err) return { ok: false, error: err };
  if (d.data.status === "published")
    await recordAudit(ctx, user.id, { action: "post.published", entityType: "post", entityId: id });
  revalidatePath(`/${workspaceSlug}/blog`, "layout");
  return { ok: true, message: d.data.status === "published" ? "Published" : "Draft saved" };
}

export async function deletePost(workspaceSlug: string, id: string) {
  const { ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.delete(posts).where(eq(posts.id, id)));
  revalidatePath(`/${workspaceSlug}/blog`);
  redirect(`/${workspaceSlug}/blog`);
}
