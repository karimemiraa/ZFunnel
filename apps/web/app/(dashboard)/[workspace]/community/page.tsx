import { communityComments, communityPosts, communitySpaces, courses, desc, eq, sql } from "@zfunnel/db";
import { ExternalLinkIcon } from "lucide-react";
import { Button } from "@zfunnel/ui/button";
import { ModerationFeed, SpacesPanel } from "@/components/community/community-admin";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/context";
import { inWorkspace } from "@/lib/funnels";
import { siteOrigin } from "@/lib/urls";

export const metadata = { title: "Community" };

export default async function CommunityAdmin({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const ws = ctx.workspace.slug;
  const data = await inWorkspace(ctx, async (tx) => {
    const spaces = await tx
      .select({
        s: communitySpaces,
        course: courses.title,
        posts: sql<number>`(select count(*)::int from community_posts p where p.space_id = "community_spaces"."id")`,
      })
      .from(communitySpaces)
      .leftJoin(courses, eq(courses.id, communitySpaces.courseId))
      .orderBy(communitySpaces.position, communitySpaces.name);
    const posts = await tx
      .select({ p: communityPosts, space: communitySpaces.name })
      .from(communityPosts)
      .innerJoin(communitySpaces, eq(communitySpaces.id, communityPosts.spaceId))
      .orderBy(desc(communityPosts.createdAt))
      .limit(40);
    const comments = await tx
      .select({ c: communityComments, title: communityPosts.title, space: communitySpaces.name })
      .from(communityComments)
      .innerJoin(communityPosts, eq(communityPosts.id, communityComments.postId))
      .innerJoin(communitySpaces, eq(communitySpaces.id, communityPosts.spaceId))
      .orderBy(desc(communityComments.createdAt))
      .limit(40);
    const courseList = await tx.select({ id: courses.id, title: courses.title }).from(courses);
    return { spaces, posts, comments, courseList };
  });
  const items = [
    ...data.posts.map(({ p, space }) => ({
      kind: "post" as const,
      id: p.id,
      space,
      author: p.authorName,
      title: p.title,
      body: p.body,
      hidden: p.hidden,
      pinned: p.pinned,
      at: p.createdAt.toISOString(),
    })),
    ...data.comments.map(({ c, space, title }) => ({
      kind: "comment" as const,
      id: c.id,
      space,
      author: c.authorName,
      title: `Re: ${title}`,
      body: c.body,
      hidden: c.hidden,
      pinned: false,
      at: c.createdAt.toISOString(),
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <>
      <PageHeader
        title="Community"
        description="A private space for your members and students to learn together. You moderate everything here."
        actions={
          <Button variant="outline" asChild>
            <a href={`${siteOrigin(ws)}/community`} target="_blank" rel="noreferrer">
              <ExternalLinkIcon /> Open community
            </a>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <SpacesPanel
          workspaceSlug={ws}
          siteUrl={siteOrigin(ws)}
          courses={data.courseList}
          spaces={data.spaces.map(({ s, course, posts }) => ({
            id: s.id,
            name: s.name,
            slug: s.slug,
            access: s.access,
            course,
            posts,
          }))}
        />
        <section>
          <h2 className="mb-3 font-semibold">Latest activity</h2>
          <ModerationFeed workspaceSlug={ws} items={items} />
        </section>
      </div>
    </>
  );
}
