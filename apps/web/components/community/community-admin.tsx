"use client";

import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { NativeSelect } from "@zfunnel/ui/select";
import { Textarea } from "@zfunnel/ui/textarea";
import { toast } from "@zfunnel/ui/toaster";
import { EyeIcon, EyeOffIcon, Loader2Icon, PinIcon, PinOffIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSpace, deleteSpace, moderate, postAsOwner } from "@/lib/community-actions";

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? "Something went wrong");
      if (r.message) toast.success(r.message);
      after?.();
      router.refresh();
    });
  return { pending, run };
}

type Space = { id: string; name: string; slug: string; access: string; course: string | null; posts: number };

export function SpacesPanel({
  workspaceSlug,
  spaces,
  courses,
  siteUrl,
}: {
  workspaceSlug: string;
  spaces: Space[];
  courses: { id: string; title: string }[];
  siteUrl: string;
}) {
  const { pending, run } = useRun();
  const [v, setV] = useState({
    name: "",
    description: "",
    access: "members" as "members" | "course",
    courseId: null as string | null,
  });
  const [post, setPost] = useState({ spaceId: "", title: "", body: "", pin: true });
  // The list can change after creating a space; fall back to the first one.
  const postSpace = spaces.some((s) => s.id === post.spaceId) ? post.spaceId : (spaces[0]?.id ?? "");
  return (
    <div className="grid content-start gap-6">
      <section className="grid gap-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Spaces</h2>
        {spaces.length === 0 && (
          <p className="text-sm text-muted-foreground">Create your first space, e.g. “General” or “Wins”.</p>
        )}
        <ul className="divide-y rounded-lg border">
          {spaces.map((s) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <a
                href={`${siteUrl}/community/${s.slug}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 font-medium hover:underline"
              >
                # {s.name}
              </a>
              <span className="text-xs text-muted-foreground">
                {s.access === "course" ? `Students of ${s.course ?? "a course"}` : "All members"} · {s.posts} posts
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 hover:text-destructive"
                aria-label="Delete space"
                onClick={() =>
                  confirm(`Delete #${s.name} and all its posts?`) && run(() => deleteSpace(workspaceSlug, s.id))
                }
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createSpace(workspaceSlug, v),
              () => setV({ ...v, name: "", description: "" }),
            );
          }}
        >
          <Input
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
            placeholder="New space name"
            aria-label="Space name"
          />
          <Input
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
            placeholder="Description (optional)"
            aria-label="Space description"
          />
          <NativeSelect
            aria-label="Who can access"
            value={v.access}
            onChange={(e) => setV({ ...v, access: e.target.value as "members" | "course" })}
          >
            <option value="members">All signed-in members</option>
            <option value="course">Only students of a course</option>
          </NativeSelect>
          {v.access === "course" && (
            <NativeSelect
              aria-label="Course"
              value={v.courseId ?? ""}
              onChange={(e) => setV({ ...v, courseId: e.target.value || null })}
            >
              <option value="">Choose a course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </NativeSelect>
          )}
          <Button type="submit" disabled={pending || !v.name.trim()}>
            Create space
          </Button>
        </form>
      </section>
      {spaces.length > 0 && (
        <form
          className="grid gap-2 rounded-xl border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => postAsOwner(workspaceSlug, { ...post, spaceId: postSpace }),
              () => setPost({ ...post, title: "", body: "" }),
            );
          }}
        >
          <h2 className="font-semibold">Post an announcement</h2>
          <NativeSelect
            aria-label="Space"
            value={postSpace}
            onChange={(e) => setPost({ ...post, spaceId: e.target.value })}
          >
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                # {s.name}
              </option>
            ))}
          </NativeSelect>
          <Input
            value={post.title}
            onChange={(e) => setPost({ ...post, title: e.target.value })}
            placeholder="Title"
            aria-label="Announcement title"
          />
          <Textarea
            rows={4}
            value={post.body}
            onChange={(e) => setPost({ ...post, body: e.target.value })}
            placeholder="Message"
            aria-label="Announcement message"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={post.pin}
              onChange={(e) => setPost({ ...post, pin: e.target.checked })}
            />{" "}
            Pin to top
          </label>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />} Post
          </Button>
        </form>
      )}
    </div>
  );
}

type Item = {
  kind: "post" | "comment";
  id: string;
  space: string;
  author: string;
  title: string;
  body: string;
  hidden: boolean;
  pinned: boolean;
  at: string;
};

export function ModerationFeed({ workspaceSlug, items }: { workspaceSlug: string; items: Item[] }) {
  const { pending, run } = useRun();
  if (!items.length)
    return (
      <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No activity yet. Members' posts and replies show up here.
      </p>
    );
  return (
    <ul className="grid gap-2">
      {items.map((i) => (
        <li key={`${i.kind}-${i.id}`} className={`rounded-xl border bg-card p-4 ${i.hidden ? "opacity-50" : ""}`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5 font-semibold uppercase">
              {i.kind === "post" ? "Post" : "Reply"}
            </span>
            <span className="font-medium text-foreground">{i.author}</span> in # {i.space} ·{" "}
            {new Date(i.at).toLocaleString()}
            {i.pinned && <span className="text-amber-600">· Pinned</span>}
            <span className="ms-auto flex gap-1">
              {i.kind === "post" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={i.pinned ? "Unpin" : "Pin"}
                  disabled={pending}
                  onClick={() => run(() => moderate(workspaceSlug, "post", i.id, i.pinned ? "unpin" : "pin"))}
                >
                  {i.pinned ? <PinOffIcon /> : <PinIcon />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={i.hidden ? "Show" : "Hide"}
                disabled={pending}
                onClick={() => run(() => moderate(workspaceSlug, i.kind, i.id, i.hidden ? "show" : "hide"))}
              >
                {i.hidden ? <EyeIcon /> : <EyeOffIcon />}
              </Button>
            </span>
          </div>
          {i.title && <p className="mt-1.5 font-semibold">{i.title}</p>}
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{i.body.replace(/<[^>]+>/g, " ")}</p>
        </li>
      ))}
    </ul>
  );
}
