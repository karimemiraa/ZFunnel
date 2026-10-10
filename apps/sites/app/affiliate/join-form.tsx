"use client";

import { useState } from "react";

export function JoinForm({ signedIn }: { signedIn: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  if (state === "sent")
    return (
      <div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-semibold">You're in! Check your inbox.</p>
        <p className="mt-1">We sent a link to your affiliate dashboard.</p>
      </div>
    );
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        setError("");
        const f = new FormData(e.currentTarget);
        const res = await fetch("/api/affiliate/join", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(signedIn ? {} : { name: f.get("name"), email: f.get("email") }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string; signedIn?: boolean };
        if (!res.ok) {
          setError(json.error ?? "Something went wrong.");
          return setState("idle");
        }
        if (json.signedIn) window.location.reload();
        else setState("sent");
      }}
    >
      {!signedIn && (
        <>
          <input
            name="name"
            required
            placeholder="Your name"
            aria-label="Name"
            className="h-11 rounded-xl border border-zinc-300 px-4 outline-none focus:border-zinc-900"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            aria-label="Email"
            className="h-11 rounded-xl border border-zinc-300 px-4 outline-none focus:border-zinc-900"
          />
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={state === "sending"}
        className="h-11 rounded-xl bg-zinc-900 font-semibold text-white hover:bg-zinc-700 disabled:opacity-60"
      >
        {state === "sending" ? "Joining…" : "Become an affiliate"}
      </button>
    </form>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={url}
        aria-label="Your referral link"
        className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-4 text-sm"
        onFocus={(e) => e.target.select()}
      />
      <button
        type="button"
        className="h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500"
        onClick={() => {
          void navigator.clipboard.writeText(url);
          setCopied(true);
        }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
