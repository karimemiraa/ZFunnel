import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { affiliateDashboard, affiliateProgram } from "@/lib/affiliate";
import { currentCustomer, requestOrigin } from "@/lib/customer";
import { currentWorkspace } from "@/lib/site";
import { LoginForm, SignOut } from "../account/account-client";
import { CopyLink, JoinForm } from "./join-form";
import { Brand } from "@/app/brand";
import { siteFormat } from "@/lib/format";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("affiliate.metaTitle"), robots: { index: false } };
}

export default async function AffiliatePage() {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const program = await affiliateProgram(ws.id);
  if (!program) notFound();
  const me = await currentCustomer(ws.id);
  const dash = me ? await affiliateDashboard(ws.id, me.id) : null;
  const t = await getT();
  const fmt = siteFormat(ws.siteLocale);

  if (!dash)
    return (
      <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-indigo-50 to-zinc-50 p-4 text-zinc-900">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-indigo-600">{t("affiliate.partnerProgram", { name: ws.name })}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            {t("affiliate.earn", { percent: program.commissionPercent })}
          </h1>
          <p className="mt-3 text-sm text-zinc-600">{t("affiliate.howItWorks", { count: program.cookieDays })}</p>
          {program.terms && (
            <p className="mt-3 rounded-xl bg-zinc-50 p-3 text-xs whitespace-pre-line text-zinc-600">{program.terms}</p>
          )}
          <div className="mt-6">
            <JoinForm signedIn={Boolean(me)} />
          </div>
          {!me && (
            <details className="mt-5 text-sm">
              <summary className="cursor-pointer text-zinc-500">{t("affiliate.alreadyAffiliate")}</summary>
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
  const money = (n: number) => fmt.money(n, dash.currency);
  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <Brand ws={ws} suffix={t("affiliate.suffix")} />
          <SignOut />
        </div>
      </header>
      <div className="mx-auto grid max-w-4xl gap-6 px-4 py-10">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <h1 className="text-xl font-bold">{t("affiliate.yourLink")}</h1>
          <p className="mt-1 mb-4 text-sm text-zinc-600">
            {t("affiliate.addParam", { param: `?aff=${dash.a.code}`, percent: program.commissionPercent })}
          </p>
          <CopyLink url={link} />
        </section>
        <section className="grid gap-4 sm:grid-cols-4">
          {[
            [t("affiliate.clicks"), dash.a.clicks.toLocaleString("en-US")],
            [t("affiliate.referrals"), dash.referrals.toLocaleString("en-US")],
            [t("affiliate.pending"), money(dash.pending)],
            [t("affiliate.paidOut"), money(dash.paid)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="text-sm text-zinc-500">{k}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{v}</p>
            </div>
          ))}
        </section>
        <section className="rounded-2xl border border-zinc-200 bg-white">
          <h2 className="border-b border-zinc-100 px-6 py-4 font-semibold">{t("affiliate.commissions")}</h2>
          {dash.list.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">{t("affiliate.noReferrals")}</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {dash.list.map(({ c, number }) => (
                <li key={c.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <span>{t("affiliate.order", { number: number ?? "", date: fmt.date(c.createdAt) })}</span>
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
                      {t(
                        c.status === "paid"
                          ? "affiliate.statusPaid"
                          : c.status === "void"
                            ? "affiliate.statusVoid"
                            : "affiliate.statusPending",
                      )}
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
