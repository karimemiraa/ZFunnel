import { Badge } from "@zfunnel/ui/badge";
import { Button } from "@zfunnel/ui/button";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { PackageIcon, PencilIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { ProductActions } from "@/components/commerce/product-actions";
import { ProductDialog } from "@/components/commerce/product-dialog";
import { PageHeader } from "@/components/page-header";
import { listProducts } from "@/lib/commerce";
import { requireWorkspace } from "@/lib/context";
import { getFmt, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await getT())("products.title") };
}

type T = Awaited<ReturnType<typeof getT>>;
type F = Awaited<ReturnType<typeof getFmt>>;

function priceText(
  t: T,
  f: F,
  p: {
    type: string;
    amount: number;
    currency: string;
    interval: string | null;
    trialDays: number | null;
    installments: number | null;
  },
) {
  const amount = f.money(p.amount, p.currency);
  if (p.type === "one_time") return amount;
  const interval = p.interval === "year" ? t("products.intervals.year") : t("products.intervals.month");
  if (p.type === "payment_plan") return t("products.planPrice", { count: p.installments ?? 0, amount, interval });
  const base = t("products.pricePerInterval", { amount, interval });
  return `${base}${p.trialDays ? ` · ${t("products.trial", { count: p.trialDays })}` : ""}`;
}

export default async function ProductsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const ws = ctx.workspace.slug;
  const list = await listProducts(ctx);
  const t = await getT();
  const f = await getFmt();
  const newButton = (
    <Button>
      <PlusIcon /> {t("products.newProduct")}
    </Button>
  );

  return (
    <>
      <PageHeader
        title={t("products.title")}
        description={t("products.description")}
        actions={<ProductDialog workspaceSlug={ws} trigger={newButton} />}
      />
      {list.length === 0 ? (
        <EmptyState
          icon={<PackageIcon />}
          title={t("products.emptyTitle")}
          description={t("products.emptyDescription")}
          action={<ProductDialog workspaceSlug={ws} trigger={newButton} />}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">{t("products.colProduct")}</th>
                <th className="px-4 py-3 max-sm:hidden">{t("products.colPrice")}</th>
                <th className="px-4 py-3 text-end max-md:hidden">{t("products.colSales")}</th>
                <th className="px-4 py-3 text-end max-md:hidden">{t("products.colRevenue")}</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((p) => {
                const price = p.prices.at(-1);
                return (
                  <tr key={p.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- user-provided URL
                          <img src={p.imageUrl} alt="" className="size-10 rounded-lg object-cover" />
                        ) : (
                          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <PackageIcon className="size-5" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <Link href={`/${ws}/products/${p.id}`} className="block truncate font-medium hover:underline">
                            {p.name}
                          </Link>
                          <div className="truncate text-xs text-muted-foreground sm:hidden">
                            {price ? priceText(t, f, price) : t("products.noPrice")}
                          </div>
                          {p.description && (
                            <div className="truncate text-xs text-muted-foreground max-sm:hidden">{p.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-sm:hidden">
                      {price ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="font-medium">{priceText(t, f, price)}</span>
                          <Badge variant="secondary">{t(`products.types.${price.type}`)}</Badge>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums max-md:hidden">{f.number(p.sales.count)}</td>
                    <td className="px-4 py-3 text-end font-medium tabular-nums max-md:hidden">
                      {f.money(p.sales.revenue, price?.currency ?? "usd")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
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
                            <Button variant="ghost" size="icon" aria-label={t("products.editAria", { name: p.name })}>
                              <PencilIcon />
                            </Button>
                          }
                        />
                        <ProductActions workspaceSlug={ws} productId={p.id} name={p.name} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
