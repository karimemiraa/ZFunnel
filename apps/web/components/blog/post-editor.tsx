"use client";

import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { Textarea } from "@zfunnel/ui/textarea";
import { toast } from "@zfunnel/ui/toaster";
import { useT } from "@zfunnel/i18n/react";
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
  const t = useT();
  const [v, setV] = useState({ ...post, coverUrl: post.coverUrl ?? "" });
  const [pending, start] = useTransition();
  const save = (status: "draft" | "published") =>
    start(async () => {
      const r = await savePost(workspaceSlug, post.id, { ...v, status });
      if (!r.ok) return void toast.error(r.error);
      setV((x) => ({ ...x, status }));
      toast.success(r.message ?? t("blogAdmin.saved"));
      router.refresh();
    });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV({ ...v, [k]: e.target.value });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="grid content-start gap-4">
        <input
          aria-label={t("blogAdmin.postTitle")}
          value={v.title}
          onChange={set("title")}
          placeholder={t("blogAdmin.postTitle")}
          className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50"
        />
        <Textarea
          aria-label={t("blogAdmin.postContent")}
          rows={24}
          value={v.content}
          onChange={set("content")}
          className="font-[inherit] text-base leading-7"
          placeholder={t("blogAdmin.contentPlaceholder")}
        />
      </div>
      <aside className="grid content-start gap-4">
        <div className="flex gap-2">
          <Button className="flex-1" disabled={pending} onClick={() => save("published")}>
            {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}{" "}
            {v.status === "published" ? t("blogAdmin.update") : t("blogAdmin.publish")}
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => save("draft")}>
            {v.status === "published" ? t("blogAdmin.unpublish") : t("blogAdmin.saveDraft")}
          </Button>
        </div>
        {v.status === "published" && (
          <a
            href={`${blogUrl}/${v.slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {t("blogAdmin.viewPost")} <ExternalLinkIcon className="size-3.5" />
          </a>
        )}
        <section className="grid gap-3 rounded-xl border bg-card p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="p-slug">{t("blogAdmin.url")}</Label>
            <Input id="p-slug" dir="ltr" value={v.slug} onChange={set("slug")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-cover">{t("blogAdmin.coverImage")}</Label>
            <Input id="p-cover" dir="ltr" value={v.coverUrl} onChange={set("coverUrl")} placeholder="https://" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-excerpt">{t("blogAdmin.excerpt")}</Label>
            <Textarea
              id="p-excerpt"
              rows={3}
              value={v.excerpt}
              onChange={set("excerpt")}
              placeholder={t("blogAdmin.excerptPlaceholder")}
            />
          </div>
        </section>
        <section className="grid gap-3 rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">{t("blogAdmin.searchSocial")}</h3>
          <div className="grid gap-1.5">
            <Label htmlFor="p-seo-title">{t("blogAdmin.seoTitle")}</Label>
            <Input
              id="p-seo-title"
              maxLength={70}
              value={v.seoTitle}
              onChange={set("seoTitle")}
              placeholder={v.title}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-seo-desc">{t("blogAdmin.metaDescription")}</Label>
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
            <p className="truncate text-xs text-emerald-700" dir="ltr">
              {`${blogUrl}/${v.slug}`.replace(/^https?:\/\//, "")}
            </p>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {v.seoDescription || v.excerpt || t("blogAdmin.seoFallback")}
            </p>
          </div>
        </section>
      </aside>
    </div>
  );
}
