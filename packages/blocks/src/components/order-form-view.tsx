"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { CheckIcon, CreditCardIcon, Loader2Icon, LockIcon, ShieldCheckIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { describePrice, formatMoney, type BlockRuntime, type RuntimeOffer } from "../runtime";
import { cx } from "../utils";

export type OrderFormSettings = {
  layout: "one-step" | "two-step";
  contactTitle: string;
  paymentTitle: string;
  buttonLabel: string;
  showSummary: boolean;
  guarantee: string;
};

type Props = OrderFormSettings & { runtime: BlockRuntime };

const field =
  "h-12 w-full min-w-0 rounded-[calc(var(--zf-radius)*0.75)] border px-3.5 text-[15px] outline-none transition bg-[var(--zf-bg)] text-[var(--zf-text)] border-[color-mix(in_srgb,var(--zf-text)_16%,transparent)] focus:border-[var(--zf-primary)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--zf-primary)_18%,transparent)]";
const label = "mb-1.5 block text-[13px] font-medium opacity-80";

const stripeCache = new Map<string, Promise<Stripe | null>>();
function getStripe(pk: string, accountId?: string) {
  const key = `${pk}:${accountId}`;
  if (!stripeCache.has(key)) stripeCache.set(key, loadStripe(pk, accountId ? { stripeAccount: accountId } : undefined));
  return stripeCache.get(key)!;
}

/** Deferred-intent Elements: the intent is created on submit, so bumps can change the amount. */
function elementsOptions(main: RuntimeOffer, dueNow: number, currency: string): StripeElementsOptions {
  const appearance = {
    theme: "stripe" as const,
    variables: { colorPrimary: "#4f46e5", borderRadius: "10px", fontFamily: "Inter, system-ui, sans-serif" },
  };
  if (main.trialDays) return { mode: "setup", currency, appearance };
  if (main.type === "one_time")
    return { mode: "payment", amount: Math.max(dueNow, 50), currency, setupFutureUsage: "off_session", appearance };
  return { mode: "subscription", amount: Math.max(dueNow, 50), currency, appearance };
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
  return json;
}

type StartResponse = {
  orderId: string;
  provider: "stripe" | "test";
  clientSecret?: string;
  secretType?: "payment" | "setup";
};
type CompleteResponse = { redirect: string | null };

export function OrderFormView(p: Props) {
  const rt = p.runtime;
  const live = rt.mode === "live";
  const offers = rt.offers?.length ? rt.offers : rt.mode === "editor" ? [] : [];
  const mains = offers.filter((o) => o.role === "main");
  const bumps = offers.filter((o) => o.role === "bump");
  const [mainId, setMainId] = useState(mains[0]?.id ?? "");
  const [bumpIds, setBumpIds] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [ship, setShip] = useState({ line1: "", line2: "", city: "", postalCode: "", region: "", country: "" });
  const [stage, setStage] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [test, setTest] = useState({ card: "", expiry: "", cvc: "" });

  const main = mains.find((m) => m.id === mainId) ?? mains[0];
  const chosenBumps = bumps.filter((b) => bumpIds.includes(b.id));
  const lines = main ? [main, ...chosenBumps] : [];
  const dueNow = lines.reduce((s, o) => s + (o.trialDays ? 0 : o.amount), 0);
  const currency = main?.currency ?? "usd";
  const provider = rt.payments?.provider ?? (live ? null : "test");
  const twoStep = p.layout === "two-step";
  const stripeReady = provider === "stripe" && rt.payments?.publishableKey;
  const stripePromise = useMemo(
    () => (stripeReady ? getStripe(rt.payments!.publishableKey!, rt.payments!.accountId) : null),
    [stripeReady, rt.payments],
  );

  // Redirect-based payment methods come back here with ?zf_order=…; finish the order automatically.
  useEffect(() => {
    if (!live) return;
    const params = new URLSearchParams(window.location.search);
    const orderId = params.get("zf_order");
    if (!orderId || !params.get("redirect_status")) return;
    void post<CompleteResponse>(`${rt.apiBase ?? "/api"}/checkout/complete`, { orderId })
      .then((r) => (r.redirect ? window.location.assign(r.redirect) : setDone(true)))
      .catch((e: Error) => setError(e.message));
  }, [live, rt.apiBase]);

  if (!live && mains.length === 0)
    return (
      <div
        className="w-full rounded-[var(--zf-radius)] border-2 border-dashed p-6 text-center text-sm"
        style={{ borderColor: "color-mix(in srgb, var(--zf-fg) 20%, transparent)" }}
      >
        <CreditCardIcon className="mx-auto mb-2 size-6 opacity-60" />
        <strong>Order form</strong>
        <p className="mt-1 opacity-70">
          Attach a product to this step (Funnel → step → Products) to show the real checkout here.
        </p>
      </div>
    );

  if (done)
    return (
      <div
        className="flex w-full items-center justify-center gap-2 rounded-[var(--zf-radius)] p-6 text-lg font-semibold"
        role="status"
      >
        <CheckIcon className="size-6" style={{ color: "var(--zf-primary)" }} /> Payment received. Thank you!
      </div>
    );

  async function start() {
    const who = { email, name };
    if (rt.store)
      return post<StartResponse>(`${rt.apiBase ?? "/api"}/checkout/start`, {
        ...who,
        storePriceId: rt.store.priceId,
        shipping: rt.store.shipping
          ? { name, ...ship, line2: ship.line2 || undefined, region: ship.region || undefined }
          : undefined,
      });
    return post<StartResponse>(`${rt.apiBase ?? "/api"}/checkout/start`, {
      ...who,
      stepId: rt.stepId,
      mainOfferId: main!.id,
      bumpOfferIds: bumpIds,
    });
  }
  async function complete(orderId: string, extra?: object) {
    const r = await post<CompleteResponse>(`${rt.apiBase ?? "/api"}/checkout/complete`, { orderId, ...extra });
    if (r.redirect) window.location.assign(r.redirect);
    else setDone(true);
  }

  async function payTest() {
    if (!live) return;
    setBusy(true);
    setError("");
    try {
      const s = await start();
      await complete(s.orderId, { test });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const contact = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-1">
        <label className={label} htmlFor="zf-name">
          Full name
        </label>
        <input
          id="zf-name"
          className={field}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="sm:col-span-1">
        <label className={label} htmlFor="zf-email">
          Email
        </label>
        <input
          id="zf-email"
          className={field}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {rt.store?.shipping &&
        (
          [
            ["line1", "Address", "address-line1", true, "sm:col-span-2"],
            ["line2", "Apartment, suite (optional)", "address-line2", false, "sm:col-span-2"],
            ["city", "City", "address-level2", true, ""],
            ["postalCode", "Postal code", "postal-code", true, ""],
            ["region", "State / region (optional)", "address-level1", false, ""],
            ["country", "Country", "country-name", true, ""],
          ] as const
        ).map(([k, l, ac, req, span]) => (
          <div key={k} className={span}>
            <label className={label} htmlFor={`zf-ship-${k}`}>
              {l}
            </label>
            <input
              id={`zf-ship-${k}`}
              className={field}
              autoComplete={`shipping ${ac}`}
              value={ship[k]}
              onChange={(e) => setShip({ ...ship, [k]: e.target.value })}
              required={req}
            />
          </div>
        ))}
    </div>
  );

  const productChoice =
    mains.length > 1 ? (
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Choose your option">
        {mains.map((m) => (
          <label
            key={m.id}
            className="flex cursor-pointer items-center gap-3 rounded-[calc(var(--zf-radius)*0.75)] border p-3.5 transition"
            style={{
              borderColor:
                m.id === main?.id ? "var(--zf-primary)" : "color-mix(in srgb, var(--zf-fg) 14%, transparent)",
              background: m.id === main?.id ? "color-mix(in srgb, var(--zf-primary) 6%, transparent)" : undefined,
            }}
          >
            <input
              type="radio"
              name="zf-main"
              className="size-4 accent-[var(--zf-primary)]"
              checked={m.id === main?.id}
              onChange={() => setMainId(m.id)}
            />
            <span className="flex-1">
              <span className="block font-semibold">{m.label || m.name}</span>
              {m.description && <span className="block text-sm opacity-65">{m.description}</span>}
            </span>
            <span className="font-semibold">{describePrice(m, rt.locale)}</span>
          </label>
        ))}
      </div>
    ) : null;

  const bumpBoxes = bumps.map((b) => {
    const on = bumpIds.includes(b.id);
    return (
      <label
        key={b.id}
        className="block cursor-pointer rounded-[calc(var(--zf-radius)*0.75)] border-2 border-dashed p-4 transition"
        style={{
          borderColor: on ? "var(--zf-primary)" : "color-mix(in srgb, #f59e0b 70%, transparent)",
          background: on
            ? "color-mix(in srgb, var(--zf-primary) 6%, transparent)"
            : "color-mix(in srgb, #fef3c7 60%, transparent)",
        }}
      >
        <span className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-[var(--zf-primary)]"
            checked={on}
            onChange={() => setBumpIds((ids) => (on ? ids.filter((x) => x !== b.id) : [...ids, b.id]))}
          />
          <span className="text-[#1c1917]">
            <span className="block font-bold">
              <span className="mr-1 text-[#dc2626]">➜</span>
              {b.headline || `Yes! Add ${b.name}`}{" "}
              <span className="whitespace-nowrap">for {describePrice(b, rt.locale)}</span>
            </span>
            {b.description && <span className="mt-1 block text-sm opacity-75">{b.description}</span>}
          </span>
        </span>
      </label>
    );
  });

  const summary = p.showSummary && main && (
    <div
      className="rounded-[calc(var(--zf-radius)*0.75)] p-4 text-[15px]"
      style={{ background: "color-mix(in srgb, var(--zf-fg) 4%, transparent)" }}
    >
      {lines.map((l) => (
        <div key={l.id} className="flex justify-between gap-4 py-1">
          <span className="opacity-80">{l.label || l.name}</span>
          <span className="font-medium">
            {l.trialDays ? "Free trial" : formatMoney(l.amount, l.currency, rt.locale)}
          </span>
        </div>
      ))}
      <div
        className="mt-2 flex justify-between border-t pt-3 text-lg font-bold"
        style={{ borderColor: "color-mix(in srgb, var(--zf-fg) 12%, transparent)" }}
      >
        <span>Due today</span>
        <span>{formatMoney(dueNow, currency, rt.locale)}</span>
      </div>
      {main.type !== "one_time" && (
        <p className="mt-1 text-xs opacity-60">
          Then {describePrice({ ...main, trialDays: null }, rt.locale)} until cancelled.
        </p>
      )}
    </div>
  );

  const payButtonLabel = `${p.buttonLabel || "Complete order"}${dueNow ? ` · ${formatMoney(dueNow, currency, rt.locale)}` : ""}`;
  const contactValid = /\S+@\S+\.\S+/.test(email) && name.trim().length > 0;

  const testFields = (
    <div className="flex flex-col gap-3">
      <div className="rounded-md px-3 py-2 text-xs font-semibold" style={{ background: "#fef3c7", color: "#92400e" }}>
        TEST MODE · No real charge. Use card 4242 4242 4242 4242, any future date, any CVC.
      </div>
      <div>
        <label className={label} htmlFor="zf-card">
          Card number
        </label>
        <input
          id="zf-card"
          className={field}
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="4242 4242 4242 4242"
          value={test.card}
          onChange={(e) => setTest({ ...test, card: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} htmlFor="zf-exp">
            Expiry
          </label>
          <input
            id="zf-exp"
            className={field}
            autoComplete="cc-exp"
            placeholder="MM / YY"
            value={test.expiry}
            onChange={(e) => setTest({ ...test, expiry: e.target.value })}
          />
        </div>
        <div>
          <label className={label} htmlFor="zf-cvc">
            CVC
          </label>
          <input
            id="zf-cvc"
            className={field}
            autoComplete="cc-csc"
            inputMode="numeric"
            placeholder="123"
            value={test.cvc}
            onChange={(e) => setTest({ ...test, cvc: e.target.value })}
          />
        </div>
      </div>
    </div>
  );

  const submitButton = (onClick?: () => void, disabled?: boolean) => (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={busy || disabled}
      className="inline-flex min-h-14 w-full items-center justify-center gap-2 px-6 text-lg font-bold transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
      style={{
        borderRadius: "var(--zf-btn-radius)",
        background: "var(--zf-primary)",
        color: "var(--zf-on-primary)",
        boxShadow: "0 12px 30px -12px color-mix(in srgb, var(--zf-primary) 75%, transparent)",
      }}
    >
      {busy ? <Loader2Icon className="size-5 animate-spin" /> : <LockIcon className="size-4" />}
      {payButtonLabel}
    </button>
  );

  const paymentSection =
    provider === "stripe" && stripePromise && main ? (
      <Elements stripe={stripePromise} options={elementsOptions(main, dueNow, currency)}>
        <StripePay
          start={start}
          complete={complete}
          busy={busy}
          setBusy={setBusy}
          setError={setError}
          contactValid={contactValid}
          submitButton={submitButton}
        />
      </Elements>
    ) : provider === "test" ? (
      <>
        {testFields}
        {submitButton(live ? () => void payTest() : undefined, !contactValid && live)}
      </>
    ) : (
      <p className="rounded-md p-3 text-sm" style={{ background: "#fee2e2", color: "#991b1b" }}>
        Payments aren&apos;t set up for this store yet.
      </p>
    );

  return (
    <div
      className="w-full rounded-[var(--zf-radius)] border p-5 text-left shadow-[0_20px_60px_-30px_rgba(0,0,0,.35)] sm:p-7"
      style={{
        background: "var(--zf-bg)",
        color: "var(--zf-text)",
        borderColor: "color-mix(in srgb, var(--zf-text) 10%, transparent)",
      }}
    >
      {twoStep && (
        <div className="mb-5 grid grid-cols-2 gap-2 text-sm font-semibold">
          {[p.contactTitle || "Your details", p.paymentTitle || "Payment"].map((t, i) => (
            <div
              key={t}
              className="flex items-center gap-2 rounded-md px-3 py-2"
              style={{
                background:
                  stage === i + 1 ? "var(--zf-primary)" : "color-mix(in srgb, var(--zf-text) 6%, transparent)",
                color: stage === i + 1 ? "var(--zf-on-primary)" : undefined,
              }}
            >
              <span
                className="flex size-5 items-center justify-center rounded-full text-xs"
                style={{ background: "rgba(255,255,255,.25)" }}
              >
                {i + 1}
              </span>
              {t}
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (twoStep && stage === 1 && contactValid) setStage(2);
        }}
        className="flex flex-col gap-5"
      >
        {(!twoStep || stage === 1) && (
          <>
            {!twoStep && <h3 className="text-lg font-bold">{p.contactTitle || "Your details"}</h3>}
            {contact}
            {productChoice}
            {twoStep && (
              <button
                type="submit"
                disabled={live && !contactValid}
                className="inline-flex min-h-14 w-full items-center justify-center px-6 text-lg font-bold disabled:opacity-60"
                style={{
                  borderRadius: "var(--zf-btn-radius)",
                  background: "var(--zf-primary)",
                  color: "var(--zf-on-primary)",
                }}
              >
                Continue to payment →
              </button>
            )}
          </>
        )}
      </form>

      {(!twoStep || stage === 2) && (
        <div className={cx("flex flex-col gap-5", !twoStep && "mt-6")}>
          {!twoStep && <h3 className="text-lg font-bold">{p.paymentTitle || "Payment"}</h3>}
          {bumpBoxes}
          {summary}
          {paymentSection}
          {error && (
            <p role="alert" className="text-center text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs opacity-60">
        <span className="inline-flex items-center gap-1">
          <LockIcon className="size-3" /> Secure 256-bit SSL checkout
        </span>
        {p.guarantee && (
          <span className="inline-flex items-center gap-1">
            <ShieldCheckIcon className="size-3" /> {p.guarantee}
          </span>
        )}
      </div>
    </div>
  );
}

function StripePay({
  start,
  complete,
  busy,
  setBusy,
  setError,
  contactValid,
  submitButton,
}: {
  start: () => Promise<StartResponse>;
  complete: (orderId: string) => Promise<void>;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (e: string) => void;
  contactValid: boolean;
  submitButton: (onClick?: () => void, disabled?: boolean) => React.ReactNode;
}) {
  const stripe = useStripe();
  const elements = useElements();

  async function pay() {
    if (!stripe || !elements) return;
    if (!contactValid) return setError("Please enter your name and email.");
    setBusy(true);
    setError("");
    try {
      const submitted = await elements.submit();
      if (submitted.error) throw new Error(submitted.error.message);
      const s = await start();
      if (!s.clientSecret) throw new Error("We couldn't start your payment.");
      const returnUrl = `${window.location.origin}${window.location.pathname}?zf_order=${s.orderId}`;
      const result =
        s.secretType === "setup"
          ? await stripe.confirmSetup({
              elements,
              clientSecret: s.clientSecret,
              confirmParams: { return_url: returnUrl },
              redirect: "if_required",
            })
          : await stripe.confirmPayment({
              elements,
              clientSecret: s.clientSecret,
              confirmParams: { return_url: returnUrl },
              redirect: "if_required",
            });
      if (result.error) throw new Error(result.error.message);
      await complete(s.orderId);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <PaymentElement options={{ layout: "tabs" }} />
      {submitButton(() => void pay(), !stripe || busy)}
    </>
  );
}
