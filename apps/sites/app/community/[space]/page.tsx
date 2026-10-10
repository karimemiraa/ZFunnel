import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { feed, spaceBySlug, spacesFor } from "@/lib/community";
import { currentCustomer } from "@/lib/customer";
import { currentWorkspace } from "@/lib/site";
import { NewPost } from "../community-ui";
import { CommunityShell } from "../shell";

export const metadata: Metadata = { title: "Community", robots: { index: false } };

const ago = (d: Date) => {
  const m = Math.round((Date.now() - d.getTime()) / 60_000);
  return m < 60
    ? `${Math.max(1, m)}m`
    : m < 1440
      ? `${Math.round(m / 60)}h`
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export default async function SpacePage({ params }: { params: Promise<{ space: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const me = await currentCustomer(ws.id);
  if (!me) redirect("/community");
  const { space: slug } = await params;
  const space = await spaceBySlug(ws.id, slug, me.id);
  if (!space) notFound();
  const [spaces, posts] = await Promise.all([spacesFor(ws.id, me.id), feed(space.id)]);
  return (
    <CommunityShell siteName={ws.name} spaces={spaces} active={space.slug}>
      <h1 className="text-2xl font-bold tracking-tight"># {space.name}</h1>
      {space.description && <p className="mt-1 text-zinc-600">{space.description}</p>}
      <div className="mt-6 grid gap-3">
        <NewPost spaceId={space.id} />
        {posts.map(({ p, comments }) => (
          <Link
            key={p.id}
            href={`/community/${space.slug}/${p.id}`}
            className="block rounded-2xl border border-zinc-200 bg-white p-5 transition hover:border-indigo-300"
          >
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="flex size-6 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">
                {p.authorName.slice(0, 1).toUpperCase()}
              </span>
              <span className="font-medium text-zinc-700">{p.authorName}</span>· {ago(p.createdAt)}
              {p.pinned && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">Pinned</span>
              )}
            </div>
            <h2 className="mt-2 font-semibold">{p.title}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{p.body.replace(/<[^>]+>/g, " ")}</p>
            <p className="mt-3 text-xs text-zinc-500">
              💬 {comments} {comments === 1 ? "reply" : "replies"}
            </p>
          </Link>
        ))}
      </div>
    </CommunityShell>
  );
}
