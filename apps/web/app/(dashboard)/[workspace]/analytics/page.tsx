import { EmptyState } from "@zfunnel/ui/empty-state";
import { cn } from "@zfunnel/ui/lib/utils";
import { BarChart3Icon, DollarSignIcon, MousePointerClickIcon, ShoppingCartIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { BarChart } from "@/components/bar-chart";
import { STEP_COLORS } from "@/components/funnels/step-type";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { CoachPanel } from "@/components/coach-panel";
import { aiConfigured } from "@/lib/ai";
import { desc, eq, funnelInsights } from "@zfunnel/db";
import { inWorkspace, listFunnels } from "@/lib/funnels";
import { funnelAnalytics, RANGES, type RangeKey } from "@/lib/analytics";
import { requireWorkspace } from "@/lib/context";
import { getFmt, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await getT())("analytics.title") };
}

export default async function AnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ funnel?: string; range?: string }>;
}) {
  const ctx = await requireWorkspace(params);
  const t = await getT();
  const fm = await getFmt();
  const sp = await searchParams;
  const range = (sp.range && sp.range in RANGES ? sp.range : "30") as RangeKey;
  const funnels = await listFunnels(ctx);
  const funnel = funnels.find((f) => f.id === sp.funnel) ?? null;
  const data = await funnelAnalytics(ctx, funnel?.id ?? null, RANGES[range]);
  const [insight] = funnel
    ? await inWorkspace(ctx, (tx) =>
        tx
          .select()
          .from(funnelInsights)
          .where(eq(funnelInsights.funnelId, funnel.id))
          .orderBy(desc(funnelInsights.createdAt))
          .limit(1),
      )
    : [];
  const ws = ctx.workspace.slug;
  const cur = data.totals.currency;
  const href = (o: { funnel?: string | null; range?: string }) => {
    const q = new URLSearchParams();
    const f = o.funnel === undefined ? funnel?.id : o.funnel;
    if (f) q.set("funnel", f);
    q.set("range", o.range ?? range);
    return `/${ws}/analytics?${q}`;
  };
  const pill = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1.5 font-medium whitespace-nowrap transition-all",
      active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <>
      <PageHeader title={t("analytics.title")} description={t("analytics.description")} />
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex max-w-full overflow-x-auto rounded-lg bg-muted p-1 text-sm">
          <Link href={href({ funnel: null })} className={pill(!funnel)}>
            {t("analytics.allFunnels")}
          </Link>
          {funnels.map((f) => (
            <Link key={f.id} href={href({ funnel: f.id })} className={pill(funnel?.id === f.id)}>
              {f.name}
            </Link>
          ))}
        </div>
        <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
          {Object.keys(RANGES).map((r) => (
            <Link key={r} href={href({ range: r })} className={pill(range === r)}>
              {t("analytics.rangeDays", { count: Number(r) })}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("analytics.uniqueVisitors")}
          value={fm.number(data.totals.visitors)}
          hint={t("analytics.pageViews", { count: data.totals.views, n: fm.number(data.totals.views) })}
          icon={UsersIcon}
        />
        <StatCard
          label={t("analytics.leads")}
          value={fm.number(data.totals.leads)}
          hint={
            data.totals.visitors
              ? t("analytics.ofVisitors", { percent: fm.percent(data.totals.leads / data.totals.visitors, 1) })
              : undefined
          }
          icon={MousePointerClickIcon}
        />
        <StatCard label={t("analytics.sales")} value={fm.number(data.totals.sales)} icon={ShoppingCartIcon} />
        <StatCard
          label={t("analytics.revenue")}
          value={fm.money(data.totals.revenue, cur)}
          hint={
            data.totals.otherCurrencies.length
              ? `+ ${data.totals.otherCurrencies.map((o) => fm.money(o.revenue, o.currency)).join(" + ")}`
              : data.totals.visitors
                ? t("analytics.perVisitor", {
                    amount: fm.money(Math.round(data.totals.revenue / data.totals.visitors), cur),
                  })
                : undefined
          }
          icon={DollarSignIcon}
        />
      </div>

      {data.totals.views === 0 ? (
        <EmptyState
          icon={<BarChart3Icon />}
          title={t("analytics.emptyTitle")}
          description={t("analytics.emptyDescription")}
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-5">
              <h2 className="mb-4 text-sm font-medium">{t("analytics.revenuePerDay")}</h2>
              <BarChart
                label={t("analytics.revenuePerDay")}
                data={data.series.map((d) => ({ day: d.day, value: d.revenue }))}
                unit={{ currency: cur }}
              />
            </div>
            <div className="rounded-xl border bg-card p-5">
              <h2 className="mb-4 text-sm font-medium">{t("analytics.visitorsPerDay")}</h2>
              <BarChart
                label={t("analytics.visitorsPerDay")}
                data={data.series.map((d) => ({ day: d.day, value: d.visitors }))}
                unit={{ noun: "visitors" }}
              />
            </div>
          </div>
          {funnel && (
            <CoachPanel
              workspaceSlug={ws}
              funnelId={funnel.id}
              range={range}
              aiReady={aiConfigured()}
              insight={
                insight
                  ? {
                      summary: insight.summary,
                      suggestions: insight.suggestions,
                      days: insight.days,
                      visitors: insight.visitors,
                      at: insight.createdAt.toISOString(),
                    }
                  : null
              }
            />
          )}
          {funnel ? (
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3">{t("analytics.step")}</th>
                    <th className="px-4 py-3 text-end">{t("analytics.visitors")}</th>
                    <th className="px-4 py-3">{t("analytics.conversion")}</th>
                    <th className="px-4 py-3 text-end">{t("analytics.revenue")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.steps.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-medium">
                          <span className="size-2 rounded-full" style={{ background: STEP_COLORS[s.type] }} />
                          {s.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums">{fm.number(s.visitors)}</td>
                      <td className="px-4 py-3">
                        {s.tracked ? (
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${Math.min(100, s.rate * 100)}%` }}
                              />
                            </div>
                            <span className="tabular-nums">
                              {fm.percent(s.rate, 1)} <span className="text-muted-foreground">({s.conversions})</span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-end font-medium tabular-nums">
                        {s.revenue ? fm.money(s.revenue, cur) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("analytics.pickFunnel")}</p>
          )}
        </>
      )}
    </>
  );
}
