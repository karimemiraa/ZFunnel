"use client";

import { useT } from "@zfunnel/i18n/react";
import { useState } from "react";

const btn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:opacity-60";

export function LoginForm({ error, next }: { error?: string; next?: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [message, setMessage] = useState(error === "link" ? t("account.linkExpired") : "");
  if (state === "sent")
    return (
      <div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
        <p className="font-semibold">{t("account.checkInbox")}</p>
        <p className="mt-1 text-emerald-800">{t("account.linkSent")}</p>
      </div>
    );
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        setMessage("");
        const email = String(new FormData(e.currentTarget).get("email"));
        const res = await fetch("/api/account/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, next }),
        });
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setMessage(json.error ?? t("common.somethingWrong"));
          return setState("idle");
        }
        setState("sent");
      }}
    >
      <label htmlFor="email" className="text-sm font-medium text-zinc-700">
        {t("account.emailAddress")}
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder={t("account.emailPlaceholder")}
        dir="ltr"
        className="h-11 rounded-xl border border-zinc-300 px-4 text-base outline-none focus:border-zinc-900 focus:ring-4 focus:ring-zinc-900/10"
      />
      {message && (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      )}
      <button type="submit" className={btn} disabled={state === "sending"}>
        {state === "sending" ? t("account.sending") : t("account.emailMeLink")}
      </button>
    </form>
  );
}

export function SignOut() {
  const t = useT();
  return (
    <button
      type="button"
      className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
      onClick={async () => {
        await fetch("/api/account/logout", { method: "POST" });
        window.location.reload();
      }}
    >
      {t("account.signOut")}
    </button>
  );
}

export function SubscriptionToggle({ id, cancelling }: { id: string; cancelling: boolean }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        className={
          cancelling
            ? btn
            : "inline-flex h-10 items-center rounded-xl border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 transition hover:border-red-300 hover:text-red-600 disabled:opacity-60"
        }
        onClick={async () => {
          if (!cancelling && !confirm(t("account.confirmCancel"))) return;
          setBusy(true);
          setError("");
          const res = await fetch("/api/account/subscription", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id, cancel: !cancelling }),
          });
          const json = (await res.json().catch(() => ({}))) as { error?: string };
          if (!res.ok) {
            setError(json.error ?? t("common.somethingWrong"));
            return setBusy(false);
          }
          window.location.reload();
        }}
      >
        {busy ? t("common.saving") : cancelling ? t("account.keepSubscription") : t("account.cancelSubscription")}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
