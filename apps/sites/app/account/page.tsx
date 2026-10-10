import { formatMoney } from "@zfunnel/payments/money";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentCustomer, customerAccount } from "@/lib/customer";
import { currentWorkspace } from "@/lib/site";
import { LoginForm, SignOut, SubscriptionToggle } from "./account-client";
import { Brand } from "@/app/brand";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

const date = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-emerald-100 text-emerald-800" },
  trialing: { label: "Free trial", cls: "bg-sky-100 text-sky-800" },
  past_due: { label: "Payment due", cls: "bg-amber-100 text-amber-800" },
  canceled: { label: "Cancelled", cls: "bg-zinc-100 text-zinc-600" },
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const customer = await currentCustomer(ws.id);
  const { error } = await searchParams;

  if (!customer)
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-4 text-zinc-900">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-zinc-500">{ws.name}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Your account</h1>
          <p className="mt-2 mb-6 text-sm text-zinc-600">
            See your purchases and manage subscriptions. We'll email you a secure sign-in link, no password needed.
          </p>
          <LoginForm error={error} />
        </div>
      </main>
    );

  const { orders, subscriptions } = await customerAccount(ws.id, customer.id);
  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Brand ws={ws} />
          <div className="flex items-center gap-6">
            <Link href="/courses" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
              My courses
            </Link>
            <SignOut />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-3xl gap-8 px-4 py-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Hi {customer.name?.split(" ")[0] || "there"} 👋</h1>
          <p className="mt-1 text-zinc-600">{customer.email}</p>
        </div>

        {subscriptions.length > 0 && (
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Subscriptions</h2>
            {subscriptions.map(({ s, product, amount, currency, interval }) => {
              const st =
                s.cancelAtPeriodEnd && s.status !== "canceled"
                  ? { label: "Ends soon", cls: "bg-amber-100 text-amber-800" }
                  : (STATUS[s.status] ?? { label: s.status, cls: "bg-zinc-100 text-zinc-600" });
              const live = ["active", "trialing", "past_due"].includes(s.status);
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{product ?? "Subscription"}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">
                      {amount !== null && currency ? `${formatMoney(amount, currency)}/${interval ?? "month"}` : ""}
                      {s.currentPeriodEnd && live
                        ? ` · ${s.cancelAtPeriodEnd ? "Access until" : "Renews"} ${date(s.currentPeriodEnd)}`
                        : ""}
                    </p>
                  </div>
                  {live && <SubscriptionToggle id={s.id} cancelling={s.cancelAtPeriodEnd} />}
                </div>
              );
            })}
          </section>
        )}

        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">Purchases</h2>
          {orders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              No purchases yet.
            </p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="rounded-2xl border border-zinc-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-3 text-sm">
                  <span className="font-semibold">Order #{o.number}</span>
                  <span className="text-zinc-500">
                    {date(o.paidAt ?? o.createdAt)}
                    {o.status !== "paid" && (
                      <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                        {o.status === "refunded" ? "Refunded" : "Partly refunded"}
                      </span>
                    )}
                  </span>
                </div>
                <ul className="divide-y divide-zinc-100">
                  {o.items.map((i, k) => (
                    <li key={k} className="flex justify-between gap-4 px-5 py-3 text-sm">
                      <span>
                        {i.name}
                        {i.label && <span className="text-zinc-500"> · {i.label}</span>}
                      </span>
                      <span className="tabular-nums">{formatMoney(i.amount, o.currency)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between px-5 py-3 text-sm font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatMoney(o.total, o.currency)}</span>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
