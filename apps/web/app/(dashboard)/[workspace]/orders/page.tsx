import { EmptyState } from "@zfunnel/ui/empty-state";
import { cn } from "@zfunnel/ui/lib/utils";
import { CreditCardIcon, DollarSignIcon, ReceiptIcon, RepeatIcon, TrendingUpIcon } from "lucide-react";
import Link from "next/link";
import { OrdersTable } from "@/components/commerce/orders-table";
import { FilterBar } from "@/components/records/filter-bar";
import { ListPager, PAGE_SIZE, pageOf } from "@/components/records/list-pager";
import { listWorkflows } from "@/lib/automations";
import { allTags } from "@/lib/crm";
import { listFunnels } from "@/lib/funnels";
import { filtersFromParams, filtersToQuery, hasFilters } from "@/lib/list-filters";
import { listViews } from "@/lib/records";
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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireWorkspace(params);
  const sp = await searchParams;
  const filters = filtersFromParams("orders", sp);
  const status = filters.status ?? "all";
  const page = pageOf(sp.page);
  const [orders, stats, tags, funnels, views, workflows] = await Promise.all([
    listOrders(ctx, { filters, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    orderStats(ctx),
    allTags(ctx),
    listFunnels(ctx),
    listViews(ctx, "orders"),
    listWorkflows(ctx),
  ]);
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
              href={`/${ws}/orders?${filtersToQuery({ ...filters, status: key === "all" ? undefined : key })}`}
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
      <FilterBar
        workspaceSlug={ws}
        resource="orders"
        filters={filters}
        tags={tags.map((x) => x.tag)}
        funnels={funnels.map((x) => ({ id: x.id, name: x.name }))}
        views={views}
        currency={cur}
      />
      {orders.length === 0 ? (
        <EmptyState
          icon={<CreditCardIcon />}
          title={hasFilters(filters) ? t("orders.noMatching") : t("orders.noOrders")}
          description={t("orders.emptyDescription")}
        />
      ) : (
        <>
          <OrdersTable
            workspaceSlug={ws}
            total={orders.total}
            filters={filters}
            workflows={workflows.filter((w) => w.w.status === "active").map((w) => ({ id: w.w.id, name: w.w.name }))}
            rows={orders.map((o) => ({
              id: o.id,
              number: o.number,
              when: f.timeAgo(o.createdAt),
              name: o.name,
              email: o.email,
              shipping: o.shipping
                ? {
                    full: [
                      o.shipping.name,
                      o.shipping.line1,
                      o.shipping.line2,
                      `${o.shipping.postalCode} ${o.shipping.city}`,
                      o.shipping.region,
                      o.shipping.country,
                    ]
                      .filter(Boolean)
                      .join(", "),
                    short: t("orders.shipTo", { city: o.shipping.city, country: o.shipping.country }),
                  }
                : null,
              items: o.items.map((i) => ({
                id: i.id,
                role: i.role,
                name: i.productName,
                failed: i.status === "failed",
              })),
              status: o.status,
              test: o.test,
              total: formatMoney(o.total, o.currency),
            }))}
          />
          <ListPager
            base={`/${ws}/orders`}
            params={Object.fromEntries(new URLSearchParams(filtersToQuery(filters)))}
            page={page}
            pages={Math.ceil(orders.total / PAGE_SIZE)}
          />
        </>
      )}
    </>
  );
}
