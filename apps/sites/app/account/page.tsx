import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentCustomer, customerAccount } from "@/lib/customer";
import { currentWorkspace } from "@/lib/site";
import { LoginForm, SignOut, SubscriptionToggle } from "./account-client";
import { Brand } from "@/app/brand";
import { siteFormat } from "@/lib/format";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("account.title"), robots: { index: false } };
}

const STATUS = {
  active: { key: "account.statusActive", cls: "bg-emerald-100 text-emerald-800" },
  trialing: { key: "account.statusTrial", cls: "bg-sky-100 text-sky-800" },
  past_due: { key: "account.statusPastDue", cls: "bg-amber-100 text-amber-800" },
  canceled: { key: "account.statusCanceled", cls: "bg-zinc-100 text-zinc-600" },
} as const;

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const customer = await currentCustomer(ws.id);
  const { error } = await searchParams;
  const t = await getT();
  const { date, money } = siteFormat(ws.siteLocale);

  if (!customer)
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-4 text-zinc-900">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-zinc-500">{ws.name}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{t("account.title")}</h1>
          <p className="mt-2 mb-6 text-sm text-zinc-600">{t("account.intro")}</p>
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
              {t("account.myCourses")}
            </Link>
            <SignOut />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-3xl gap-8 px-4 py-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {customer.name?.split(" ")[0]
              ? t("account.hi", { name: customer.name.split(" ")[0]! })
              : t("account.hiThere")}
          </h1>
          <p className="mt-1 text-zinc-600">{customer.email}</p>
        </div>

        {subscriptions.length > 0 && (
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">{t("account.subscriptions")}</h2>
            {subscriptions.map(({ s, product, amount, currency, interval }) => {
              const st =
                s.cancelAtPeriodEnd && s.status !== "canceled"
                  ? { label: t("account.endsSoon"), cls: "bg-amber-100 text-amber-800" }
                  : s.status in STATUS
                    ? {
                        label: t(STATUS[s.status as keyof typeof STATUS].key),
                        cls: STATUS[s.status as keyof typeof STATUS].cls,
                      }
                    : { label: s.status, cls: "bg-zinc-100 text-zinc-600" };
              const live = ["active", "trialing", "past_due"].includes(s.status);
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{product ?? t("account.subscription")}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600">
                      {amount !== null && currency
                        ? t(interval === "year" ? "account.perYear" : "account.perMonth", {
                            price: money(amount, currency),
                          })
                        : ""}
                      {s.currentPeriodEnd && live
                        ? ` · ${t(s.cancelAtPeriodEnd ? "account.accessUntil" : "account.renews", { date: date(s.currentPeriodEnd) })}`
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
          <h2 className="text-lg font-semibold">{t("account.purchases")}</h2>
          {orders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              {t("account.noPurchases")}
            </p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="rounded-2xl border border-zinc-200 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-5 py-3 text-sm">
                  <span className="font-semibold">{t("account.order", { number: o.number })}</span>
                  <span className="text-zinc-500">
                    {date(o.paidAt ?? o.createdAt)}
                    {o.status !== "paid" && (
                      <span className="ms-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                        {t(o.status === "refunded" ? "account.refunded" : "account.partlyRefunded")}
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
                      <span className="tabular-nums">{money(i.amount, o.currency)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between px-5 py-3 text-sm font-semibold">
                  <span>{t("account.total")}</span>
                  <span className="tabular-nums">{money(o.total, o.currency)}</span>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
