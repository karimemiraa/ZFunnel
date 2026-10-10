import { Card, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { cn } from "@zfunnel/ui/lib/utils";
import { CheckCircle2Icon, CircleIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/context";
import { ROOT_DOMAIN } from "@/lib/env";
import { domains, funnels, paymentAccounts, sql } from "@zfunnel/db";
import { inWorkspace } from "@/lib/funnels";
import { getT } from "@/lib/i18n";
import { NAV_MODULES, navText } from "@/lib/nav";

export async function generateMetadata() {
  return { title: (await getT())("overview.title") };
}

export default async function OverviewPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const { user, workspace } = ctx;
  const t = await getT();
  const progress = await inWorkspace(ctx, async (tx) => {
    const one = async (q: Promise<{ n: number }[]>) => ((await q)[0]?.n ?? 0) > 0;
    const count = sql<number>`count(*)::int`;
    return {
      payments: await one(
        tx
          .select({ n: count })
          .from(paymentAccounts)
          .where(sql`${paymentAccounts.chargesEnabled}`),
      ),
      funnel: await one(tx.select({ n: count }).from(funnels)),
      domain: await one(
        tx
          .select({ n: count })
          .from(domains)
          .where(sql`${domains.status} = 'active'`),
      ),
    };
  });
  const steps = [
    { done: true, label: t("overview.stepWorkspace") },
    { done: progress.payments, label: t("overview.stepPayments") },
    { done: progress.funnel, label: t("overview.stepFunnel") },
    { done: progress.domain, label: t("overview.stepDomain") },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const siteUrl = `${workspace.slug}.${ROOT_DOMAIN}`;

  return (
    <>
      <PageHeader
        title={t("overview.welcome", { name: user.name.split(" ")[0]! })}
        description={t("overview.happening", { workspace: workspace.name })}
        actions={
          <a
            href={`${ROOT_DOMAIN.startsWith("localhost") ? "http" : "https"}://${siteUrl}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            {siteUrl} <ExternalLinkIcon className="size-3.5" />
          </a>
        }
      />
      <Card className="mb-10 overflow-hidden">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
            <div className="space-y-1.5">
              <CardTitle className="text-lg">{t("overview.gettingStarted")}</CardTitle>
              <CardDescription>{allDone ? t("overview.allDone") : t("overview.gettingStartedHint")}</CardDescription>
            </div>
            <span className="text-sm font-medium text-muted-foreground tabular-nums">
              {t("overview.progress", { done: doneCount, total: steps.length })}
            </span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full bg-brand-orange transition-[width]"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </div>
          <ol className="mt-5 space-y-3">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-3 text-sm">
                {s.done ? (
                  <CheckCircle2Icon className="size-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <CircleIcon className="size-5 text-muted-foreground" />
                )}
                <span className={cn(s.done && "text-muted-foreground line-through")}>{s.label}</span>
              </li>
            ))}
          </ol>
        </CardHeader>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_MODULES.filter((m) => m.segment).map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.segment} href={`/${workspace.slug}/${m.segment}`} className="group rounded-xl outline-none">
              <Card className="h-full transition-[border-color,box-shadow] group-hover:border-brand-orange/50 group-hover:shadow-md group-focus-visible:border-brand-orange">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-brand-navy/[0.06] text-brand-navy transition-colors group-hover:bg-brand-orange/15 group-hover:text-brand-orange-text dark:bg-white/[0.08] dark:text-white">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-base">{navText(t, m.segment, "label")}</CardTitle>
                  <CardDescription>{navText(t, m.segment, "description")}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
