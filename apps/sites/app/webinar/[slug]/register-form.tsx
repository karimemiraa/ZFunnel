"use client";

import { useRouter } from "next/navigation";
import { useIntlLocale, useT } from "@zfunnel/i18n/react";
import { useState } from "react";

export function RegisterForm({
  slug,
  color,
  sessions,
  live,
  serverNow,
}: {
  serverNow: string;
  slug: string;
  color: string;
  sessions: string[];
  live: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const tag = useIntlLocale();
  const [pick, setPick] = useState(sessions[0]!);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const label = (iso: string) => {
    const d = new Date(iso);
    const mins = Math.round((d.getTime() - new Date(serverNow).getTime()) / 60_000);
    if (mins < 0) return t("webinar.liveNow", { count: -mins });
    // "Just in time" sessions are at most 20 minutes away (5 minutes + rounding to the quarter hour).
    if (mins <= 20) return t("webinar.startingIn", { count: mins });
    return d.toLocaleString(tag, {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        const r = await fetch("/api/webinar/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slug, sessionAt: pick, name: f.get("name") || undefined, email: f.get("email") }),
        }).catch(() => null);
        const d = (await r?.json().catch(() => null)) as { token?: string; error?: string } | null;
        if (!r?.ok || !d?.token) {
          setBusy(false);
          return setError(d?.error ?? t("webinar.couldNotRegister"));
        }
        router.push(`/webinar/watch/${d.token}`);
      }}
      className="space-y-4"
    >
      <h2 className="text-xl font-bold">{t("webinar.saveSeat")}</h2>
      {!live && (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium text-zinc-600">{t("webinar.pickTime")}</legend>
          {sessions.map((s) => (
            <label
              key={s}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm transition-colors has-[:checked]:border-transparent has-[:checked]:ring-2"
              style={{ "--tw-ring-color": color } as React.CSSProperties}
            >
              <input
                type="radio"
                name="session"
                value={s}
                checked={pick === s}
                onChange={() => setPick(s)}
                className="size-4"
                style={{ accentColor: color }}
              />
              <span suppressHydrationWarning>{label(s)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {live && (
        <p className="rounded-lg bg-zinc-100 px-3 py-2.5 text-sm font-medium" suppressHydrationWarning>
          {label(sessions[0]!)}
        </p>
      )}
      <input
        name="name"
        aria-label={t("webinar.yourName")}
        placeholder={t("webinar.yourName")}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 outline-none focus:border-zinc-500"
      />
      <input
        name="email"
        type="email"
        required
        aria-label={t("webinar.yourEmail")}
        placeholder={t("webinar.bestEmail")}
        className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 outline-none focus:border-zinc-500"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg py-3 font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60"
        style={{ background: color }}
      >
        {busy ? t("webinar.saving") : t("webinar.register")}
      </button>
      <p className="text-center text-xs text-zinc-500">{t("webinar.reminderNote")}</p>
    </form>
  );
}
