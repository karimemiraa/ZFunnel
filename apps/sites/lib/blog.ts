import "server-only";

import { and, calendars, desc, eq, funnels, funnelSteps, isNotNull, isNull, posts } from "@zfunnel/db";
import { system } from "@zfunnel/payments";

export async function publishedPosts(workspaceId: string, limit = 100) {
  return system((tx) =>
    tx
      .select()
      .from(posts)
      .where(and(eq(posts.workspaceId, workspaceId), eq(posts.status, "published")))
      .orderBy(desc(posts.publishedAt))
      .limit(limit),
  );
}

export async function postBySlug(workspaceId: string, slug: string) {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const [p] = await system((tx) =>
    tx
      .select()
      .from(posts)
      .where(and(eq(posts.workspaceId, workspaceId), eq(posts.slug, slug), eq(posts.status, "published"))),
  );
  return p ?? null;
}

/** Every public, indexable URL path of a workspace site. */
export async function sitePaths(workspaceId: string) {
  return system(async (tx) => {
    const steps = await tx
      .select({ funnel: funnels.slug, step: funnelSteps.slug, at: funnelSteps.publishedAt, type: funnelSteps.type })
      .from(funnelSteps)
      .innerJoin(funnels, eq(funnels.id, funnelSteps.funnelId))
      .where(
        and(
          eq(funnels.workspaceId, workspaceId),
          isNull(funnels.archivedAt),
          isNotNull(funnelSteps.publishedVersionId),
        ),
      );
    const blog = await tx
      .select({ slug: posts.slug, at: posts.updatedAt })
      .from(posts)
      .where(and(eq(posts.workspaceId, workspaceId), eq(posts.status, "published")));
    const cals = await tx
      .select({ slug: calendars.slug })
      .from(calendars)
      .where(and(eq(calendars.workspaceId, workspaceId), eq(calendars.status, "active")));
    return [
      // Thank-you, upsell and checkout steps are not landing pages.
      ...steps
        .filter((s) => !["thankyou", "upsell", "downsell", "checkout"].includes(s.type))
        .map((s) => ({ path: `/${s.funnel}/${s.step}`, at: s.at })),
      ...(blog.length ? [{ path: "/blog", at: blog[0]!.at }] : []),
      ...blog.map((b) => ({ path: `/blog/${b.slug}`, at: b.at })),
      ...cals.map((c) => ({ path: `/book/${c.slug}`, at: null })),
    ];
  });
}
