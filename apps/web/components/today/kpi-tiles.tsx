"use client";

import { useT } from "@zfunnel/i18n/react";
import { cn } from "@zfunnel/ui/lib/utils";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { useState } from "react";
import type { Delta, Period } from "@/lib/today-math";
import { useFmt } from "@/lib/use-fmt";

type Metric = { current: number; previous: number; delta: Delta };
export type KpiPeriod = {
  revenue: Metric;
  orders: Metric;
  leads: Metric;
  conversion: Metric;
  otherRevenue: { currency: string; amount: number }[];
};

const LABEL: Record<Period, "today" | "week" | "month"> = { today: "today", "7d": "week", "30d": "month" };

/** KPI row: revenue, orders, new leads and conversion, each against the previous period. */
export function KpiTiles({
  periods,
  currency,
  initial = "7d",
}: {
  periods: Record<Period, KpiPeriod>;
  currency: string;
  initial?: Period;
}) {
  const t = useT();
  const f = useFmt();
  const [period, setPeriod] = useState<Period>(initial);
  const p = periods[period];
  const vs = t(`today.vsPrevious.${LABEL[period]}`);

  const tiles = [
    {
      key: "revenue",
      label: t("today.revenue"),
      value: f.money(p.revenue.current, currency),
      metric: p.revenue,
      extra: p.otherRevenue.length
        ? t("today.alsoIn", {
            amounts: p.otherRevenue.map((o) => `\u2066${f.money(o.amount, o.currency)}\u2069`).join(" · "),
          })
        : null,
    },
    { key: "orders", label: t("today.orders"), value: f.number(p.orders.current), metric: p.orders, extra: null },
    { key: "leads", label: t("today.leads"), value: f.number(p.leads.current), metric: p.leads, extra: null },
    {
      key: "conversion",
      label: t("today.conversion"),
      value: f.percent(p.conversion.current, 1),
      metric: p.conversion,
      extra: null,
      points: true,
    },
  ];

  return (
    <section aria-label={t("today.periodsLabel")} className="space-y-3">
      <div className="inline-flex rounded-lg bg-muted p-1 text-sm" role="tablist" aria-label={t("today.periodsLabel")}>
        {(["today", "7d", "30d"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={period === k}
            onClick={() => setPeriod(k)}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium whitespace-nowrap transition-all",
              period === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`today.periods.${LABEL[k]}`)}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.key} className="rounded-xl border bg-card p-5" data-testid={`kpi-${tile.key}`}>
            <div className="text-sm font-medium text-muted-foreground">{tile.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">
              <span dir="ltr">{tile.value}</span>
            </div>
            <DeltaLine metric={tile.metric} points={Boolean(tile.points)} vs={vs} />
            {tile.extra && <div className="mt-1 truncate text-xs text-muted-foreground">{tile.extra}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

function DeltaLine({ metric, points, vs }: { metric: Metric; points: boolean; vs: string }) {
  const t = useT();
  const f = useFmt();
  const { delta } = metric;
  const noBase = points ? metric.previous === 0 && metric.current === 0 : delta.ratio === null;
  if (noBase) return <div className="mt-1 text-xs text-muted-foreground">{t("today.noComparison")}</div>;
  const Icon =
    delta.direction === "up" ? ArrowUpRightIcon : delta.direction === "down" ? ArrowDownRightIcon : MinusIcon;
  const amount = points
    ? t("today.points", {
        delta: `${metric.current >= metric.previous ? "+" : "−"}${Math.abs((metric.current - metric.previous) * 100).toFixed(1)}`,
      })
    : `${delta.ratio! >= 0 ? "+" : "−"}${f.percent(Math.abs(delta.ratio!), Math.abs(delta.ratio!) < 0.1 ? 1 : 0)}`;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "inline-flex items-center gap-0.5 font-medium tabular-nums",
          delta.direction === "up" && "text-emerald-700 dark:text-emerald-400",
          delta.direction === "down" && "text-rose-700 dark:text-rose-400",
        )}
        dir="ltr"
      >
        <Icon className="size-3.5" aria-hidden />
        {amount}
      </span>
      <span>{vs}</span>
    </div>
  );
}
