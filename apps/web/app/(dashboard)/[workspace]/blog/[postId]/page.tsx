import { Button } from "@zfunnel/ui/button";
import { ArrowLeftIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PostEditor } from "@/components/blog/post-editor";
import { deletePost } from "@/lib/blog-actions";
import { getPost } from "@/lib/blog";
import { requireWorkspace } from "@/lib/context";
import { getT } from "@/lib/i18n";
import { siteOrigin } from "@/lib/urls";

export async function generateMetadata() {
  return { title: (await getT())("blogAdmin.editPost") };
}

export default async function PostPage({ params }: { params: Promise<{ workspace: string; postId: string }> }) {
  const ctx = await requireWorkspace(params);
  const t = await getT();
  const { postId } = await params;
  const post = await getPost(ctx, postId);
  if (!post) notFound();
  const ws = ctx.workspace.slug;
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/${ws}/blog`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4 rtl:-scale-x-100" /> {t("blogAdmin.title")}
        </Link>
        <form action={deletePost.bind(null, ws, post.id)}>
          <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
            <Trash2Icon /> {t("blogAdmin.delete")}
          </Button>
        </form>
      </div>
      <PostEditor
        workspaceSlug={ws}
        blogUrl={`${siteOrigin(ws)}/blog`}
        post={{
          id: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt,
          content: post.content,
          coverUrl: post.coverUrl,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          status: post.status,
        }}
      />
    </>
  );
}
