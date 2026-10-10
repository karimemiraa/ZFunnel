import { Button } from "@zfunnel/ui/button";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { ExternalLinkIcon, NewspaperIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createPost } from "@/lib/blog-actions";
import { listPosts } from "@/lib/blog";
import { requireWorkspace } from "@/lib/context";
import { siteOrigin } from "@/lib/urls";

export const metadata = { title: "Blog" };

export default async function BlogPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const ws = ctx.workspace.slug;
  const list = await listPosts(ctx);
  const newButton = (
    <form action={createPost.bind(null, ws)}>
      <Button type="submit">
        <PlusIcon /> New post
      </Button>
    </form>
  );
  return (
    <>
      <PageHeader
        title="Blog"
        description="Publish articles that rank on Google and feed your funnels. Includes sitemap and RSS."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href={`${siteOrigin(ws)}/blog`} target="_blank" rel="noreferrer">
                <ExternalLinkIcon /> View blog
              </a>
            </Button>
            {newButton}
          </div>
        }
      />
      {list.length === 0 ? (
        <EmptyState
          icon={<NewspaperIcon />}
          title="Write your first post"
          description="Blog posts bring free traffic from search. Link them to your opt-in funnels to turn readers into leads."
          action={newButton}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Post</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-end max-sm:hidden">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/${ws}/blog/${p.id}`} className="font-medium hover:underline">
                      {p.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">/blog/{p.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.status === "published"
                          ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                          : "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                      }
                    >
                      {p.status === "published" ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end text-muted-foreground max-sm:hidden">
                    {p.updatedAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
