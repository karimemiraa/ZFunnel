import { formatMoney } from "@zfunnel/payments/money";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { cn } from "@zfunnel/ui/lib/utils";
import { CreditCardIcon, DollarSignIcon, ReceiptIcon, RepeatIcon, TrendingUpIcon } from "lucide-react";
import Link from "next/link";
import { OrderStatus } from "@/components/commerce/order-status";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { StatCard } from "@/components/stat-card";
import { listOrders, orderStats } from "@/lib/commerce";
import { requireWorkspace } from "@/lib/context";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Orders" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
  { key: "refunded", label: "Refunded" },
];

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

  return (
    <>
      <PageHeader title="Orders" description="Every purchase across your funnels, including one-click upsells." />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total revenue" value={formatMoney(stats.revenue, cur)} icon={DollarSignIcon} />
        <StatCard label="Last 30 days" value={formatMoney(stats.last30, cur)} icon={TrendingUpIcon} />
        <StatCard
          label="Paid orders"
          value={String(stats.paidCount)}
          hint={
            stats.paidCount
              ? `Avg. ${formatMoney(Math.round(stats.revenue / stats.paidCount), cur)} per order`
              : undefined
          }
          icon={ReceiptIcon}
        />
        <StatCard label="Active subscriptions" value={String(stats.activeSubscriptions)} icon={RepeatIcon} />
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/${ws}/orders?status=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium transition-all",
                status === f.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <SearchInput placeholder="Search name, email or #order" />
      </div>
      {orders.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon />}
          title={q || status !== "all" ? "No matching orders" : "No orders yet"}
          description="Orders appear here as soon as someone buys through one of your funnels."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 max-lg:hidden">Items</th>
                <th className="px-4 py-3 max-sm:hidden">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((o) => (
                <tr key={o.id} className="align-top hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">#{o.number}</div>
                    <div className="text-xs text-muted-foreground">{timeAgo(o.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[16rem] truncate font-medium">{o.name ?? "—"}</div>
                    <div className="max-w-[16rem] truncate text-xs text-muted-foreground">{o.email}</div>
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
                            {i.role}
                          </span>
                          {i.productName}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 max-sm:hidden">
                    <OrderStatus status={o.status} test={o.test} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {formatMoney(o.total, o.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
