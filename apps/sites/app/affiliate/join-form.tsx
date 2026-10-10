"use client";

import { useT } from "@zfunnel/i18n/react";
import { useState } from "react";

export function JoinForm({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  if (state === "sent")
    return (
      <div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-semibold">{t("affiliate.joined")}</p>
        <p className="mt-1">{t("affiliate.linkSent")}</p>
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
          setError(json.error ?? t("common.somethingWrong"));
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
            placeholder={t("affiliate.yourName")}
            aria-label={t("affiliate.name")}
            className="h-11 rounded-xl border border-zinc-300 px-4 outline-none focus:border-zinc-900"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            aria-label={t("affiliate.email")}
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
        {state === "sending" ? t("affiliate.joining") : t("affiliate.become")}
      </button>
    </form>
  );
}

export function CopyLink({ url }: { url: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={url}
        aria-label={t("affiliate.yourLink")}
        dir="ltr"
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
        {copied ? t("affiliate.copied") : t("affiliate.copy")}
      </button>
    </div>
  );
}
