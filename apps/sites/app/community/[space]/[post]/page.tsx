import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { postWithComments, spaceBySlug, spacesFor } from "@/lib/community";
import { currentCustomer } from "@/lib/customer";
import { currentWorkspace } from "@/lib/site";
import { CommentForm } from "../../community-ui";
import { CommunityShell } from "../../shell";
import { siteFormat } from "@/lib/format";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("community.title"), robots: { index: false } };
}

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
  const t = await getT();
  const { dateTime } = siteFormat(ws.siteLocale);
  return (
    <CommunityShell siteName={ws.name} spaces={spaces} active={space.slug} t={t}>
      <Link href={`/community/${space.slug}`} className="text-sm text-zinc-500 hover:text-zinc-900">
        {t("community.back", { space: space.name })}
      </Link>
      <article className="mt-4 rounded-2xl border border-zinc-200 bg-white p-6">
        <p className="text-xs text-zinc-500">
          <span className="font-medium text-zinc-700">{p.authorName}</span> · {dateTime(p.createdAt)}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{p.title}</h1>
        {/* Sanitized when saved. */}
        <div className="zf-lesson mt-4 leading-7 text-zinc-700" dangerouslySetInnerHTML={{ __html: p.body }} />
      </article>
      <section className="mt-6 grid gap-3">
        <h2 className="font-semibold">{t("community.replies", { count: comments.length })}</h2>
        {comments.map((c) => (
          <div key={c.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">
              <span className="font-medium text-zinc-700">{c.authorName}</span> · {dateTime(c.createdAt)}
            </p>
            <div className="zf-lesson mt-2 text-sm text-zinc-700" dangerouslySetInnerHTML={{ __html: c.body }} />
          </div>
        ))}
        <CommentForm postId={p.id} />
      </section>
    </CommunityShell>
  );
}
