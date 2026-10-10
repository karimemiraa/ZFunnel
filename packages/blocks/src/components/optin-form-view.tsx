"use client";

import { ArrowRightIcon, CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@zfunnel/i18n";
import { blockT } from "../runtime";
import { cx } from "../utils";

type Props = {
  askName: boolean;
  askPhone: boolean;
  buttonLabel: string;
  privacyNote: string;
  layout: "stacked" | "inline";
  successMessage: string;
  live: boolean;
  stepId?: string;
  apiBase: string;
  nextUrl?: string;
  lang?: Locale;
};

const input =
  "h-13 w-full min-w-0 rounded-[var(--zf-radius)] border px-4 text-base outline-none transition focus:ring-4 bg-[var(--zf-bg)] text-[var(--zf-text)] border-[color-mix(in_srgb,var(--zf-text)_18%,transparent)] focus:border-[var(--zf-primary)] focus:ring-[color-mix(in_srgb,var(--zf-primary)_20%,transparent)]";

export function OptInFormView(p: Props) {
  const t = blockT(p);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!p.live) return; // editor preview: never submit
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setState("sending");
    setError("");
    try {
      const res = await fetch(`${p.apiBase}/optin`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...data, stepId: p.stepId }),
      });
      const json = (await res.json().catch(() => ({}))) as { redirect?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? t("common.somethingWrong"));
      if (json.redirect) {
        window.location.assign(json.redirect);
        return;
      }
      setState("done");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : t("common.somethingWrong"));
    }
  }

  if (state === "done")
    return (
      <div className="flex items-center justify-center gap-2 text-lg font-semibold" role="status">
        <CheckCircle2Icon className="size-6" style={{ color: "var(--zf-primary)" }} /> {p.successMessage}
      </div>
    );

  const inline = p.layout === "inline" && !p.askName && !p.askPhone;
  return (
    <form
      onSubmit={onSubmit}
      className={cx("mx-auto flex w-full max-w-md flex-col gap-3", inline && "max-w-xl")}
      noValidate={false}
    >
      <div className={cx("flex gap-3", inline ? "flex-col sm:flex-row" : "flex-col")}>
        {p.askName && (
          <input
            className={input}
            name="name"
            autoComplete="name"
            placeholder={t("forms.firstName")}
            required
            aria-label={t("forms.name")}
          />
        )}
        <input
          className={input}
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t("forms.bestEmail")}
          required
          aria-label={t("forms.email")}
        />
        {p.askPhone && (
          <input
            className={input}
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder={t("forms.phone")}
            aria-label={t("forms.phoneLabel")}
          />
        )}
        <button
          type="submit"
          disabled={state === "sending"}
          className={cx(
            "inline-flex min-h-13 shrink-0 items-center justify-center gap-2 px-7 text-lg font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-70",
            !inline && "w-full",
          )}
          style={{
            borderRadius: "var(--zf-btn-radius)",
            background: "var(--zf-primary)",
            color: "var(--zf-on-primary)",
            boxShadow: "0 10px 30px -10px color-mix(in srgb, var(--zf-primary) 70%, transparent)",
          }}
        >
          {state === "sending" ? <Loader2Icon className="size-5 animate-spin" /> : null}
          {p.buttonLabel}
          {state !== "sending" && <ArrowRightIcon className="size-5 rtl:-scale-x-100" />}
        </button>
      </div>
      {state === "error" && (
        <p role="alert" className="text-center text-sm font-medium text-red-500">
          {error}
        </p>
      )}
      {p.privacyNote && <p className="text-center text-xs opacity-60">🔒 {p.privacyNote}</p>}
    </form>
  );
}
