import { BuildingIcon, DollarSignIcon, LayersIcon, ShoppingBagIcon, UserPlusIcon } from "lucide-react";
import { BarChart } from "@/components/bar-chart";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { requireAdmin } from "@/lib/admin";
import { getPlatformOverview } from "@/lib/admin-data";
import { getFmt, getT } from "@/lib/i18n";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const [o, t, f] = await Promise.all([getPlatformOverview(), getT(), getFmt()]);
  const [topGmv, ...otherGmv] = o.gmv;

  return (
    <>
      <PageHeader title={t("admin.overview.title")} description={t("admin.overview.description")} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("admin.overview.signups")}
          value={f.number(o.users)}
          hint={t("admin.overview.signupsHint", { count: o.users30 })}
          icon={UserPlusIcon}
        />
        <StatCard
          label={t("admin.overview.organizations")}
          value={f.number(o.orgs)}
          hint={t("admin.overview.activeOrganizations", { count: o.activeOrgs })}
          icon={BuildingIcon}
        />
        <StatCard label={t("admin.overview.workspaces")} value={f.number(o.workspaces)} icon={LayersIcon} />
        <StatCard
          label={t("admin.overview.mrr")}
          value={f.money(o.mrr, "USD")}
          hint={o.payingOrgs ? t("admin.overview.mrrHint", { count: o.payingOrgs }) : t("admin.overview.mrrNone")}
          icon={DollarSignIcon}
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <h2 className="mb-6 text-sm font-medium text-muted-foreground">{t("admin.overview.trend")}</h2>
          <BarChart label={t("admin.overview.trend")} data={o.signups} unit={{ noun: "signups" }} />
        </div>
        <StatCard
          label={t("admin.overview.gmv")}
          value={topGmv ? f.money(topGmv.amount, topGmv.currency) : f.money(0, "USD")}
          hint={
            otherGmv.length
              ? `${t("admin.overview.gmvHint")} · ${t("admin.overview.gmvOther", {
                  amounts: otherGmv.map((g) => f.money(g.amount, g.currency)).join(", "),
                })}`
              : t("admin.overview.gmvHint")
          }
          icon={ShoppingBagIcon}
        />
      </div>
    </>
  );
}
