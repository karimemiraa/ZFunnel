"use server";

import { communityComments, communityPosts, communitySpaces, eq } from "@zfunnel/db";
import { toSafeHtml } from "@zfunnel/email";
import { slugify } from "@zfunnel/shared";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inWorkspace } from "./funnels";
import { requireUser } from "./session";
import { getWorkspaceForUser, recordAudit } from "./workspaces";

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error("Workspace not found");
  return { user, ctx };
}
const refresh = (ws: string) => revalidatePath(`/${ws}/community`);

const spaceSchema = z.object({
  name: z.string().trim().min(2, "Name the space").max(60),
  description: z.string().trim().max(300),
  access: z.enum(["members", "course"]),
  courseId: z.string().uuid().nullable(),
});

export async function createSpace(workspaceSlug: string, input: z.input<typeof spaceSchema>): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const d = spaceSchema.safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  if (d.data.access === "course" && !d.data.courseId)
    return { ok: false, error: "Choose the course whose students can join." };
  await inWorkspace(ctx, async (tx) => {
    const taken = new Set((await tx.select({ slug: communitySpaces.slug }).from(communitySpaces)).map((s) => s.slug));
    const root = slugify(d.data.name) || "space";
    let slug = root;
    for (let i = 2; taken.has(slug); i++) slug = `${root}-${i}`;
    await tx.insert(communitySpaces).values({
      workspaceId: ctx.workspace.id,
      ...d.data,
      courseId: d.data.access === "course" ? d.data.courseId : null,
      slug,
    });
  });
  refresh(workspaceSlug);
  return { ok: true, message: "Space created" };
}

export async function deleteSpace(workspaceSlug: string, id: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.delete(communitySpaces).where(eq(communitySpaces.id, id)));
  refresh(workspaceSlug);
  return { ok: true, message: "Space deleted" };
}

/** Announcement from the business, shown with the workspace name as author. */
export async function postAsOwner(
  workspaceSlug: string,
  input: { spaceId: string; title: string; body: string; pin: boolean },
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const d = z
    .object({
      spaceId: z.string().uuid(),
      title: z.string().trim().min(3).max(160),
      body: z.string().trim().min(1).max(10_000),
      pin: z.boolean(),
    })
    .safeParse(input);
  if (!d.success) return { ok: false, error: "Add a title and a message." };
  await inWorkspace(ctx, (tx) =>
    tx.insert(communityPosts).values({
      workspaceId: ctx.workspace.id,
      spaceId: d.data.spaceId,
      authorName: ctx.workspace.name,
      title: d.data.title,
      body: toSafeHtml(d.data.body),
      pinned: d.data.pin,
    }),
  );
  refresh(workspaceSlug);
  return { ok: true, message: "Posted" };
}

export async function moderate(
  workspaceSlug: string,
  kind: "post" | "comment",
  id: string,
  action: "hide" | "show" | "pin" | "unpin",
): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => {
    if (kind === "comment")
      return tx
        .update(communityComments)
        .set({ hidden: action === "hide" })
        .where(eq(communityComments.id, id));
    const set = action === "pin" || action === "unpin" ? { pinned: action === "pin" } : { hidden: action === "hide" };
    return tx.update(communityPosts).set(set).where(eq(communityPosts.id, id));
  });
  await recordAudit(ctx, user.id, { action: `community.${kind}_${action}`, entityType: kind, entityId: id });
  refresh(workspaceSlug);
  return { ok: true };
}
