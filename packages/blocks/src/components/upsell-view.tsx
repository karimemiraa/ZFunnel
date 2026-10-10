"use client";

import { loadStripe } from "@stripe/stripe-js";
import { ArrowRightIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { blockT, describePrice, formatLocale, type BlockRuntime } from "../runtime";

export type UpsellSettings = { acceptLabel: string; acceptSublabel: string; declineLabel: string; showPrice: boolean };

async function post<T>(url: string, body: unknown, fallbackError: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? fallbackError);
  return json;
}

type AcceptResponse = {
  redirect?: string | null;
  requiresAction?: boolean;
  clientSecret?: string;
  paymentId?: string;
  accountId?: string;
  publishableKey?: string;
};

export function UpsellView({ runtime: rt, ...p }: UpsellSettings & { runtime: BlockRuntime }) {
  const t = blockT(rt);
  const failed = t("common.somethingWrong");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const offer = rt.offers?.find((o) => o.role === "upsell" || o.role === "downsell");
  const live = rt.mode === "live";
  const api = rt.apiBase ?? "/api";

  async function accept() {
    if (!live) return;
    setBusy(true);
    setError("");
    try {
      let r = await post<AcceptResponse>(`${api}/upsell`, { stepId: rt.stepId, offerId: offer?.id }, failed);
      if (r.requiresAction && r.clientSecret && r.publishableKey) {
        // The bank asked for 3-D Secure: confirm in the browser, then finalize.
        const stripe = await loadStripe(r.publishableKey, { stripeAccount: r.accountId });
        const result = await stripe!.handleNextAction({ clientSecret: r.clientSecret });
        if (result.error) throw new Error(result.error.message);
        r = await post<AcceptResponse>(`${api}/upsell/confirm`, { paymentId: r.paymentId, stepId: rt.stepId }, failed);
      }
      if (r.redirect) window.location.assign(r.redirect);
      else setBusy(false);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-4 text-center">
      <button
        type="button"
        onClick={() => void accept()}
        disabled={busy}
        className="group inline-flex min-h-16 w-full flex-col items-center justify-center px-8 py-3 font-bold transition hover:-translate-y-0.5 disabled:opacity-70"
        style={{
          borderRadius: "var(--zf-btn-radius)",
          background: "var(--zf-primary)",
          color: "var(--zf-on-primary)",
          boxShadow: "0 14px 36px -12px color-mix(in srgb, var(--zf-primary) 75%, transparent)",
        }}
      >
        <span className="inline-flex items-center gap-2 text-xl">
          {busy && <Loader2Icon className="size-5 animate-spin" />}
          {p.acceptLabel}
          {p.showPrice && offer ? ` (${describePrice(offer, t, formatLocale(rt))})` : ""}
          {!busy && (
            <ArrowRightIcon className="size-5 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" />
          )}
        </span>
        {p.acceptSublabel && <span className="mt-0.5 text-sm font-normal opacity-85">{p.acceptSublabel}</span>}
      </button>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      <a href={rt.declineUrl ?? "#"} className="text-sm underline underline-offset-4 opacity-60 hover:opacity-90">
        {p.declineLabel}
      </a>
      {!live && !offer && <p className="text-xs opacity-50">{t("forms.upsellEditorHint")}</p>}
    </div>
  );
}
