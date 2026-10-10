import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { postBySlug } from "@/lib/blog";
import { currentWorkspace } from "@/lib/site";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const ws = await currentWorkspace();
  const post = ws ? await postBySlug(ws.id, (await params).slug) : null;
  if (!post) return { title: "Not found" };
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || undefined;
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      images: post.coverUrl ? [post.coverUrl] : undefined,
      publishedTime: post.publishedAt?.toISOString(),
    },
  };
}

export default async function PostPage({ params }: P) {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const post = await postBySlug(ws.id, (await params).slug);
  if (!post) notFound();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    image: post.coverUrl ?? undefined,
    publisher: { "@type": "Organization", name: ws.name },
  };
  return (
    <main className="min-h-dvh bg-white text-zinc-900">
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex h-16 max-w-3xl items-center px-4">
          <Link href="/blog" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
            ← {ws.name} blog
          </Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 py-12">
        <p className="text-sm text-zinc-500">
          {post.publishedAt?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">{post.title}</h1>
        {post.excerpt && <p className="mt-4 text-xl text-zinc-600">{post.excerpt}</p>}
        {post.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverUrl} alt="" className="mt-8 w-full rounded-2xl object-cover" />
        )}
        {/* Sanitized when saved. */}
        <div className="zf-article mt-10" dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
    </main>
  );
}
