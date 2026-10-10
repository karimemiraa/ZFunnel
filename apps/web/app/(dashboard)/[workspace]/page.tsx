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
  const allDone = steps.every((s) => s.done);
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
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t("overview.gettingStarted")}</CardTitle>
          <CardDescription>{allDone ? t("overview.allDone") : t("overview.gettingStartedHint")}</CardDescription>
          <ol className="mt-4 space-y-3">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-3 text-sm">
                {s.done ? (
                  <CheckCircle2Icon className="size-5 text-emerald-500" />
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
            <Link key={m.segment} href={`/${workspace.slug}/${m.segment}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardHeader>
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
