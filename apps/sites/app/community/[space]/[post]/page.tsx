import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { postWithComments, spaceBySlug, spacesFor } from "@/lib/community";
import { currentCustomer } from "@/lib/customer";
import { currentWorkspace } from "@/lib/site";
import { CommentForm } from "../../community-ui";
import { CommunityShell } from "../../shell";

export const metadata: Metadata = { title: "Community", robots: { index: false } };

export default async function PostPage({ params }: { params: Promise<{ space: string; post: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const me = await currentCustomer(ws.id);
  if (!me) redirect("/community");
  const { space: slug, post: postId } = await params;
  const space = await spaceBySlug(ws.id, slug, me.id);
  if (!space) notFound();
  const [spaces, data] = await Promise.all([spacesFor(ws.id, me.id), postWithComments(space.id, postId)]);
  if (!data) notFound();
  const { p, comments } = data;
  return (
    <CommunityShell siteName={ws.name} spaces={spaces} active={space.slug}>
      <Link href={`/community/${space.slug}`} className="text-sm text-zinc-500 hover:text-zinc-900">
        ← # {space.name}
      </Link>
      <article className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6">
        <p className="text-xs text-zinc-500">
          <span className="font-medium text-zinc-700">{p.authorName}</span> · {p.createdAt.toLocaleString()}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{p.title}</h1>
        {/* Sanitized when saved. */}
        <div className="zf-lesson mt-4 leading-7 text-zinc-700" dangerouslySetInnerHTML={{ __html: p.body }} />
      </article>
      <section className="mt-6 grid gap-3">
        <h2 className="font-semibold">
          {comments.length} {comments.length === 1 ? "reply" : "replies"}
        </h2>
        {comments.map((c) => (
          <div key={c.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">
              <span className="font-medium text-zinc-700">{c.authorName}</span> · {c.createdAt.toLocaleString()}
            </p>
            <div className="zf-lesson mt-2 text-sm text-zinc-700" dangerouslySetInnerHTML={{ __html: c.body }} />
          </div>
        ))}
        <CommentForm postId={p.id} />
      </section>
    </CommunityShell>
  );
}
