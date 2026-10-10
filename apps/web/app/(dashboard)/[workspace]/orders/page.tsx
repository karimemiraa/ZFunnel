import { EmptyState } from "@zfunnel/ui/empty-state";
import { cn } from "@zfunnel/ui/lib/utils";
import { CreditCardIcon, DollarSignIcon, ReceiptIcon, RepeatIcon, TrendingUpIcon } from "lucide-react";
import Link from "next/link";
import { OrderStatus } from "@/components/commerce/order-status";
import { Button } from "@zfunnel/ui/button";
import { UserRoundIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { StatCard } from "@/components/stat-card";
import { listOrders, orderStats } from "@/lib/commerce";
import { requireWorkspace } from "@/lib/context";
import { getFmt, getT } from "@/lib/i18n";
import { siteOrigin } from "@/lib/urls";

export async function generateMetadata() {
  return { title: (await getT())("orders.title") };
}

const FILTERS = ["all", "paid", "pending", "failed", "refunded"] as const;

export default async function OrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const ctx = await requireWorkspace(params);
  const { q, status = "all" } = await searchParams;
  const [orders, stats] = await Promise.all([listOrders(ctx, { q, status }), orderStats(ctx)]);
  const ws = ctx.workspace.slug;
  const cur = stats.currency;
  const t = await getT();
  const f = await getFmt();
  const formatMoney = f.money;

  return (
    <>
      <PageHeader
        title={t("orders.title")}
        description={t("orders.description")}
        actions={
          <Button variant="outline" asChild>
            <a href={`${siteOrigin(ctx.workspace.slug)}/account`} target="_blank" rel="noreferrer">
              <UserRoundIcon /> {t("orders.customerCenter")}
            </a>
          </Button>
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("orders.totalRevenue")}
          value={formatMoney(stats.revenue, cur)}
          hint={
            stats.others.length
              ? `+ ${stats.others.map((o) => formatMoney(o.revenue, o.currency)).join(" + ")}`
              : undefined
          }
          icon={DollarSignIcon}
        />
        <StatCard label={t("orders.last30")} value={formatMoney(stats.last30, cur)} icon={TrendingUpIcon} />
        <StatCard
          label={t("orders.paidOrders")}
          value={f.number(stats.paidCount)}
          hint={
            stats.paidCount
              ? t("orders.avgPerOrder", { amount: formatMoney(Math.round(stats.revenue / stats.paidCount), cur) })
              : undefined
          }
          icon={ReceiptIcon}
        />
        <StatCard
          label={t("orders.activeSubscriptions")}
          value={f.number(stats.activeSubscriptions)}
          icon={RepeatIcon}
        />
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
          {FILTERS.map((key) => (
            <Link
              key={key}
              href={`/${ws}/orders?status=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-all",
                status === key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`orders.filters.${key}`)}
            </Link>
          ))}
        </div>
        <SearchInput placeholder={t("orders.searchPlaceholder")} />
      </div>
      {orders.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon />}
          title={q || status !== "all" ? t("orders.noMatching") : t("orders.noOrders")}
          description={t("orders.emptyDescription")}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">{t("orders.colOrder")}</th>
                <th className="px-4 py-3">{t("orders.colCustomer")}</th>
                <th className="px-4 py-3 max-lg:hidden">{t("orders.colItems")}</th>
                <th className="px-4 py-3 max-sm:hidden">{t("orders.colStatus")}</th>
                <th className="px-4 py-3 text-end">{t("orders.colTotal")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o.id} className="align-top hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">#{o.number}</div>
                    <div className="text-xs text-muted-foreground">{f.timeAgo(o.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[16rem] truncate font-medium">{o.name ?? "—"}</div>
                    <div className="max-w-[16rem] truncate text-xs text-muted-foreground">{o.email}</div>
                    {o.shipping && (
                      <div
                        className="mt-1 max-w-[16rem] truncate text-xs text-muted-foreground"
                        title={[
                          o.shipping.name,
                          o.shipping.line1,
                          o.shipping.line2,
                          `${o.shipping.postalCode} ${o.shipping.city}`,
                          o.shipping.region,
                          o.shipping.country,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      >
                        {t("orders.shipTo", { city: o.shipping.city, country: o.shipping.country })}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 max-lg:hidden">
                    <ul className="space-y-0.5">
                      {o.items.map((i) => (
                        <li
                          key={i.id}
                          className={cn(
                            "flex items-center gap-1.5 text-xs",
                            i.status === "failed" && "text-muted-foreground line-through",
                          )}
                        >
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                            {t(`orders.roles.${i.role}`)}
                          </span>
                          {i.productName}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 max-sm:hidden">
                    <OrderStatus status={o.status} test={o.test} />
                  </td>
                  <td className="px-4 py-3 text-end font-semibold tabular-nums">{formatMoney(o.total, o.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
