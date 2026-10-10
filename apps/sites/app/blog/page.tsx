import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publishedPosts } from "@/lib/blog";
import { currentWorkspace } from "@/lib/site";
import { siteFormat } from "@/lib/format";
import { getT } from "@/lib/i18n";
import { Brand } from "@/app/brand";

export async function generateMetadata(): Promise<Metadata> {
  const ws = await currentWorkspace();
  const t = await getT();
  return {
    title: ws ? t("blog.metaTitle", { name: ws.name }) : t("blog.blog"),
    alternates: { types: { "application/rss+xml": "/blog/rss.xml" } },
  };
}

export default async function BlogIndex() {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const list = await publishedPosts(ws.id);
  const t = await getT();
  const { longDate } = siteFormat(ws.siteLocale);
  const fmt = (d: Date | null) => (d ? longDate(d) : "");
  const [hero, ...rest] = list;
  return (
    <main className="min-h-dvh bg-white text-zinc-900">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/blog">
            <Brand ws={ws} />
          </Link>
          <a href="/blog/rss.xml" className="text-sm text-zinc-500 hover:text-zinc-900">
            {t("blog.rss")}
          </a>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-12">
        <h1 className="text-4xl font-bold tracking-tight">{t("blog.blog")}</h1>
        {!hero && <p className="mt-6 text-zinc-500">{t("blog.empty")}</p>}
        {hero && (
          <Link href={`/blog/${hero.slug}`} className="group mt-8 grid gap-6 md:grid-cols-2">
            <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-50">
              {hero.coverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hero.coverUrl}
                  alt=""
                  className="size-full object-cover transition group-hover:scale-[1.02]"
                />
              )}
            </div>
            <div className="self-center">
              <p className="text-sm text-zinc-500">{fmt(hero.publishedAt)}</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight group-hover:underline">{hero.title}</h2>
              {hero.excerpt && <p className="mt-3 text-zinc-600">{hero.excerpt}</p>}
            </div>
          </Link>
        )}
        {rest.length > 0 && (
          <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="group">
                <div className="aspect-[16/10] overflow-hidden rounded-xl bg-gradient-to-br from-indigo-100 to-violet-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.coverUrl && <img src={p.coverUrl} alt="" className="size-full object-cover" />}
                </div>
                <p className="mt-3 text-xs text-zinc-500">{fmt(p.publishedAt)}</p>
                <h3 className="mt-1 text-lg font-semibold group-hover:underline">{p.title}</h3>
                {p.excerpt && <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{p.excerpt}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
