import "server-only";

import {
  and,
  asc,
  communityComments,
  communityPosts,
  communitySpaces,
  courseEnrollments,
  desc,
  eq,
  isNull,
  sql,
} from "@zfunnel/db";
import { system } from "@zfunnel/payments";

type Space = typeof communitySpaces.$inferSelect;

async function canAccess(space: Space, contactId: string) {
  if (space.access === "members") return true;
  if (!space.courseId) return false;
  const [e] = await system((tx) =>
    tx
      .select({ id: courseEnrollments.id })
      .from(courseEnrollments)
      .where(
        and(
          eq(courseEnrollments.courseId, space.courseId!),
          eq(courseEnrollments.contactId, contactId),
          isNull(courseEnrollments.revokedAt),
        ),
      ),
  );
  return Boolean(e);
}

export async function spacesFor(workspaceId: string, contactId: string) {
  const all = await system((tx) =>
    tx
      .select()
      .from(communitySpaces)
      .where(eq(communitySpaces.workspaceId, workspaceId))
      .orderBy(asc(communitySpaces.position), asc(communitySpaces.name)),
  );
  const out = [];
  for (const s of all) if (await canAccess(s, contactId)) out.push(s);
  return out;
}

export async function spaceBySlug(workspaceId: string, slug: string, contactId: string) {
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return null;
  const [s] = await system((tx) =>
    tx
      .select()
      .from(communitySpaces)
      .where(and(eq(communitySpaces.workspaceId, workspaceId), eq(communitySpaces.slug, slug))),
  );
  return s && (await canAccess(s, contactId)) ? s : null;
}

export async function spaceById(workspaceId: string, id: string, contactId: string) {
  const [s] = await system((tx) =>
    tx
      .select()
      .from(communitySpaces)
      .where(and(eq(communitySpaces.workspaceId, workspaceId), eq(communitySpaces.id, id))),
  );
  return s && (await canAccess(s, contactId)) ? s : null;
}

export async function feed(spaceId: string) {
  return system((tx) =>
    tx
      .select({
        p: communityPosts,
        comments: sql<number>`(select count(*)::int from community_comments c where c.post_id = "community_posts"."id" and not c.hidden)`,
      })
      .from(communityPosts)
      .where(and(eq(communityPosts.spaceId, spaceId), eq(communityPosts.hidden, false)))
      .orderBy(desc(communityPosts.pinned), desc(communityPosts.createdAt))
      .limit(100),
  );
}

export async function postWithComments(spaceId: string, postId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return null;
  return system(async (tx) => {
    const [p] = await tx
      .select()
      .from(communityPosts)
      .where(and(eq(communityPosts.id, postId), eq(communityPosts.spaceId, spaceId), eq(communityPosts.hidden, false)));
    if (!p) return null;
    const comments = await tx
      .select()
      .from(communityComments)
      .where(and(eq(communityComments.postId, postId), eq(communityComments.hidden, false)))
      .orderBy(asc(communityComments.createdAt));
    return { p, comments };
  });
}
