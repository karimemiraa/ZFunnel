import { Badge } from "@zfunnel/ui/badge";
import { Button } from "@zfunnel/ui/button";
import { ArrowLeftIcon, GraduationCapIcon, PackageIcon, PencilIcon, ReceiptIcon, ShoppingCartIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatus } from "@/components/commerce/order-status";
import { ProductActions } from "@/components/commerce/product-actions";
import { ProductDialog } from "@/components/commerce/product-dialog";
import { Section } from "@/components/records/section";
import { StatCard } from "@/components/stat-card";
import { requireWorkspace } from "@/lib/context";
import { getFmt, getT } from "@/lib/i18n";
import { getProductDetail } from "@/lib/records";

type Params = { params: Promise<{ workspace: string; productId: string }> };

export async function generateMetadata({ params }: Params) {
  const ctx = await requireWorkspace(params);
  const d = await getProductDetail(ctx, (await params).productId);
  return { title: d?.product.name ?? (await getT())("products.title") };
}

export default async function ProductPage({ params }: Params) {
  const ctx = await requireWorkspace(params);
  const d = await getProductDetail(ctx, (await params).productId);
  if (!d) notFound();
  const [t, f] = await Promise.all([getT(), getFmt()]);
  const ws = ctx.workspace.slug;
  const { product: p } = d;
  const live = d.prices.filter((x) => !x.archivedAt);
  const price = live.at(-1);
  const totals = d.revenue.reduce(
    (a, r) =>
      r.currency === (price?.currency ?? r.currency) ? { revenue: a.revenue + r.revenue, sales: a.sales + r.sales } : a,
    { revenue: 0, sales: 0 },
  );
  const cur = price?.currency ?? d.revenue[0]?.currency ?? "usd";

  return (
    <>
      <Link
        href={`/${ws}/products`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5 rtl:-scale-x-100" /> {t("products.title")}
      </Link>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        {p.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user-provided URL
          <img src={p.imageUrl} alt="" className="size-14 rounded-xl object-cover" />
        ) : (
          <span className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PackageIcon className="size-6" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{p.name}</h1>
          {p.description && <p className="truncate text-sm text-muted-foreground">{p.description}</p>}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {p.inStore && <Badge variant="secondary">{t("records.product.inStore")}</Badge>}
            {p.stock !== null && <Badge variant="outline">{t("records.product.stock", { count: p.stock })}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProductDialog
            workspaceSlug={ws}
            initial={{
              id: p.id,
              name: p.name,
              description: p.description,
              imageUrl: p.imageUrl,
              inStore: p.inStore,
              stock: p.stock,
              requiresShipping: p.requiresShipping,
              price: price as never,
            }}
            trigger={
              <Button variant="outline">
                <PencilIcon /> {t("common.edit")}
              </Button>
            }
          />
          <ProductActions workspaceSlug={ws} productId={p.id} name={p.name} after="list" showOpen={false} />
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("records.product.price")}
          value={price ? f.money(price.amount, price.currency) : t("products.noPrice")}
          hint={price ? t(`products.types.${price.type}`) : undefined}
          icon={ReceiptIcon}
        />
        <StatCard label={t("records.product.sales")} value={f.number(totals.sales)} icon={ShoppingCartIcon} />
        <StatCard label={t("records.product.revenue")} value={f.money(totals.revenue, cur)} icon={ReceiptIcon} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t("records.product.soldIn")} empty={t("records.product.soldInEmpty")} testId="sold-in">
          {d.soldIn.map((o) => (
            <li key={o.offerId} className="flex items-center gap-3 px-5 py-3 text-sm">
              <Link
                href={`/${ws}/funnels/${o.funnelId}?step=${o.stepId}`}
                className="min-w-0 flex-1 truncate hover:underline"
              >
                <span className="font-medium">{o.funnelName}</span>
                <span className="text-muted-foreground"> › {o.stepName}</span>
              </Link>
              <Badge variant="secondary">{t(`records.roles.${o.role}`)}</Badge>
            </li>
          ))}
        </Section>

        <Section
          title={t("records.product.revenueByFunnel")}
          empty={t("records.product.noSales")}
          testId="revenue-by-funnel"
        >
          {d.revenue.map((r) => (
            <li key={`${r.funnelId}-${r.currency}`} className="flex items-center gap-3 px-5 py-3 text-sm">
              {r.funnelId ? (
                <Link
                  href={`/${ws}/funnels/${r.funnelId}`}
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {r.funnelName ?? t("records.deletedFunnel")}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{t("records.product.direct")}</span>
              )}
              <span className="text-muted-foreground tabular-nums">
                {t("records.product.salesCount", { count: r.sales })}
              </span>
              <span className="w-24 text-end font-medium tabular-nums">{f.money(r.revenue, r.currency)}</span>
            </li>
          ))}
        </Section>

        <Section title={t("records.product.grants")} empty={t("records.product.grantsEmpty")}>
          {d.grants.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <GraduationCapIcon className="size-4 text-muted-foreground" />
              <Link href={`/${ws}/courses/${c.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {c.title}
              </Link>
            </li>
          ))}
        </Section>

        <Section title={t("records.product.recentOrders")} empty={t("records.product.noSales")}>
          {d.recent.map((o) => (
            <li key={`${o.id}-${o.amount}`} className="flex items-center gap-3 px-5 py-3 text-sm">
              <Link href={`/${ws}/orders/${o.id}`} className="font-medium hover:underline">
                #{o.number}
              </Link>
              <span className="min-w-0 flex-1 truncate text-muted-foreground" dir="ltr">
                {o.email ?? "—"}
              </span>
              <OrderStatus status={o.status} test={o.test} />
              <span className="w-20 text-end tabular-nums">{f.money(o.amount, o.currency)}</span>
            </li>
          ))}
        </Section>

        <Section title={t("records.product.priceHistory")} empty={t("products.noPrice")} className="lg:col-span-2">
          {d.prices
            .slice()
            .reverse()
            .map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="font-medium tabular-nums">{f.money(x.amount, x.currency)}</span>
                <Badge variant="secondary">{t(`products.types.${x.type}`)}</Badge>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{x.label}</span>
                <span className="text-xs text-muted-foreground">
                  {x.archivedAt
                    ? t("records.product.replaced", { when: f.timeAgo(x.archivedAt) })
                    : t("records.product.current")}
                </span>
              </li>
            ))}
        </Section>
      </div>
    </>
  );
}
