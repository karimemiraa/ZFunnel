"use client";

import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { useState } from "react";

export function CompleteButton({
  lessonId,
  done,
  nextHref,
}: {
  lessonId: string;
  done: boolean;
  nextHref: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const [isDone, setDone] = useState(done);
  return (
    <button
      type="button"
      disabled={busy}
      className={
        isDone
          ? "inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 text-sm font-semibold text-emerald-800"
          : "inline-flex h-11 items-center gap-2 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white hover:bg-zinc-700"
      }
      onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/courses/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lessonId, done: !isDone }),
        });
        setBusy(false);
        if (!res.ok) return;
        const now = !isDone;
        setDone(now);
        if (now && nextHref) window.location.assign(nextHref);
        else window.location.reload();
      }}
    >
      {isDone ? <CheckCircle2Icon className="size-5" /> : <CircleIcon className="size-5" />}
      {isDone ? "Completed" : nextHref ? "Complete & continue" : "Mark complete"}
    </button>
  );
}
