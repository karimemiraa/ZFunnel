import { formatMoney } from "@zfunnel/payments/money";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { affiliateDashboard, affiliateProgram } from "@/lib/affiliate";
import { currentCustomer, requestOrigin } from "@/lib/customer";
import { currentWorkspace } from "@/lib/site";
import { LoginForm, SignOut } from "../account/account-client";
import { CopyLink, JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Affiliate program", robots: { index: false } };

export default async function AffiliatePage() {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const program = await affiliateProgram(ws.id);
  if (!program) notFound();
  const me = await currentCustomer(ws.id);
  const dash = me ? await affiliateDashboard(ws.id, me.id) : null;

  if (!dash)
    return (
      <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-indigo-50 to-zinc-50 p-4 text-zinc-900">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-indigo-600">{ws.name} partner program</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Earn {program.commissionPercent}% on every sale you refer
          </h1>
          <p className="mt-3 text-sm text-zinc-600">
            Share your link. When someone buys within {program.cookieDays} days, you earn a commission, including on
            upsells.
          </p>
          {program.terms && (
            <p className="mt-3 rounded-xl bg-zinc-50 p-3 text-xs whitespace-pre-line text-zinc-600">{program.terms}</p>
          )}
          <div className="mt-6">
            <JoinForm signedIn={Boolean(me)} />
          </div>
          {!me && (
            <details className="mt-5 text-sm">
              <summary className="cursor-pointer text-zinc-500">Already an affiliate? Sign in</summary>
              <div className="mt-3">
                <LoginForm next="/affiliate" />
              </div>
            </details>
          )}
        </div>
      </main>
    );

  const origin = requestOrigin(await headers());
  const link = `${origin}/?aff=${dash.a.code}`;
  const money = (n: number) => formatMoney(n, dash.currency);
  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <span className="font-semibold">{ws.name} · Affiliate</span>
          <SignOut />
        </div>
      </header>
      <div className="mx-auto grid max-w-4xl gap-6 px-4 py-10">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h1 className="text-xl font-bold">Your referral link</h1>
          <p className="mt-1 mb-4 text-sm text-zinc-600">
            Add <code className="rounded bg-zinc-100 px-1">?aff={dash.a.code}</code> to any page link of this site. You
            earn {program.commissionPercent}%.
          </p>
          <CopyLink url={link} />
        </section>
        <section className="grid gap-4 sm:grid-cols-4">
          {[
            ["Clicks", dash.a.clicks.toLocaleString()],
            ["Referrals", dash.referrals.toLocaleString()],
            ["Pending", money(dash.pending)],
            ["Paid out", money(dash.paid)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="text-sm text-zinc-500">{k}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{v}</p>
            </div>
          ))}
        </section>
        <section className="rounded-2xl border border-zinc-200 bg-white">
          <h2 className="border-b border-zinc-100 px-6 py-4 font-semibold">Commissions</h2>
          {dash.list.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">No referrals yet. Share your link to get started!</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {dash.list.map(({ c, number }) => (
                <li key={c.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <span>
                    Order #{number} · {c.createdAt.toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-3">
                    <span
                      className={
                        c.status === "paid"
                          ? "text-emerald-600"
                          : c.status === "void"
                            ? "text-zinc-400 line-through"
                            : "text-amber-600"
                      }
                    >
                      {c.status}
                    </span>
                    <span className="font-semibold tabular-nums">{money(c.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
