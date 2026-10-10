"use client";

import { useT } from "@zfunnel/i18n/react";
import { useState } from "react";

const field =
  "w-full rounded-xl border border-zinc-300 px-4 py-2.5 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10";

export function NewPost({ spaceId }: { spaceId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-start text-zinc-500 transition hover:border-indigo-300"
      >
        {t("community.startDiscussion")}
      </button>
    );
  return (
    <form
      className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        const res = await fetch("/api/community/post", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ spaceId, title: f.get("title"), body: f.get("body") }),
        });
        const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        setBusy(false);
        if (!res.ok) return setError(json.error ?? t("common.somethingWrong"));
        window.location.assign(json.url!);
      }}
    >
      <input
        name="title"
        required
        maxLength={160}
        placeholder={t("community.titlePlaceholder")}
        aria-label={t("community.postTitle")}
        className={`${field} font-semibold`}
      />
      <textarea
        name="body"
        required
        rows={5}
        maxLength={10000}
        placeholder={t("community.bodyPlaceholder")}
        aria-label={t("community.postBody")}
        className={field}
      />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {busy ? t("community.posting") : t("community.post")}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-10 px-3 text-sm text-zinc-500">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}

export function CommentForm({ postId }: { postId: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="grid gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        const res = await fetch("/api/community/comment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ postId, body: f.get("body") }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setBusy(false);
        if (!res.ok) return setError(json.error ?? t("common.somethingWrong"));
        window.location.reload();
      }}
    >
      <textarea
        name="body"
        required
        rows={3}
        maxLength={5000}
        placeholder={t("community.writeReply")}
        aria-label={t("community.reply")}
        className={field}
      />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div>
        <button
          type="submit"
          disabled={busy}
          className="h-10 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {busy ? t("community.sending") : t("community.reply")}
        </button>
      </div>
    </form>
  );
}
