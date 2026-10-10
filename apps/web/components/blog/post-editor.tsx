"use client";

import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { Textarea } from "@zfunnel/ui/textarea";
import { toast } from "@zfunnel/ui/toaster";
import { ExternalLinkIcon, Loader2Icon, SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { savePost } from "@/lib/blog-actions";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverUrl: string | null;
  seoTitle: string;
  seoDescription: string;
  status: "draft" | "published";
};

export function PostEditor({ workspaceSlug, post, blogUrl }: { workspaceSlug: string; post: Post; blogUrl: string }) {
  const router = useRouter();
  const [v, setV] = useState({ ...post, coverUrl: post.coverUrl ?? "" });
  const [pending, start] = useTransition();
  const save = (status: "draft" | "published") =>
    start(async () => {
      const r = await savePost(workspaceSlug, post.id, { ...v, status });
      if (!r.ok) return void toast.error(r.error);
      setV((x) => ({ ...x, status }));
      toast.success(r.message ?? "Saved");
      router.refresh();
    });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="grid content-start gap-4">
        <input
          aria-label="Post title"
          value={v.title}
          onChange={set("title")}
          placeholder="Post title"
          className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50"
        />
        <Textarea
          aria-label="Post content"
          rows={24}
          value={v.content}
          onChange={set("content")}
          className="font-[inherit] text-base leading-7"
          placeholder="Write your post. Leave a blank line between paragraphs. HTML for headings (<h2>), lists, quotes, links and images also works."
        />
      </div>
      <aside className="grid content-start gap-4">
        <div className="flex gap-2">
          <Button className="flex-1" disabled={pending} onClick={() => save("published")}>
            {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}{" "}
            {v.status === "published" ? "Update" : "Publish"}
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => save("draft")}>
            {v.status === "published" ? "Unpublish" : "Save draft"}
          </Button>
        </div>
        {v.status === "published" && (
          <a
            href={`${blogUrl}/${v.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View post <ExternalLinkIcon className="size-3.5" />
          </a>
        )}
        <section className="grid gap-3 rounded-xl border bg-card p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="p-slug">URL</Label>
            <Input id="p-slug" value={v.slug} onChange={set("slug")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-cover">Cover image URL</Label>
            <Input id="p-cover" value={v.coverUrl} onChange={set("coverUrl")} placeholder="https://" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-excerpt">Excerpt</Label>
            <Textarea
              id="p-excerpt"
              rows={3}
              value={v.excerpt}
              onChange={set("excerpt")}
              placeholder="Shown on the blog index"
            />
          </div>
        </section>
        <section className="grid gap-3 rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Search & social</h3>
          <div className="grid gap-1.5">
            <Label htmlFor="p-seo-title">SEO title</Label>
            <Input
              id="p-seo-title"
              maxLength={70}
              value={v.seoTitle}
              onChange={set("seoTitle")}
              placeholder={v.title}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-seo-desc">Meta description</Label>
            <Textarea
              id="p-seo-desc"
              rows={3}
              maxLength={170}
              value={v.seoDescription}
              onChange={set("seoDescription")}
              placeholder={v.excerpt}
            />
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="truncate text-sm text-[#1a0dab]">{v.seoTitle || v.title}</p>
            <p className="truncate text-xs text-emerald-700">{`${blogUrl}/${v.slug}`.replace(/^https?:\/\//, "")}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {v.seoDescription || v.excerpt || "Add a description to control how this post appears on Google."}
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
