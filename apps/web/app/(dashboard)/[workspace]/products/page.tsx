import { formatMoney } from "@zfunnel/payments";
import { Badge } from "@zfunnel/ui/badge";
import { Button } from "@zfunnel/ui/button";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { PackageIcon, PencilIcon, PlusIcon } from "lucide-react";
import { ProductActions } from "@/components/commerce/product-actions";
import { ProductDialog } from "@/components/commerce/product-dialog";
import { PageHeader } from "@/components/page-header";
import { listProducts } from "@/lib/commerce";
import { requireWorkspace } from "@/lib/context";

export const metadata = { title: "Products" };

function priceText(p: {
  type: string;
  amount: number;
  currency: string;
  interval: string | null;
  trialDays: number | null;
  installments: number | null;
}) {
  const m = formatMoney(p.amount, p.currency);
  if (p.type === "one_time") return m;
  if (p.type === "payment_plan") return `${p.installments} × ${m}/${p.interval}`;
  return `${m}/${p.interval}${p.trialDays ? ` · ${p.trialDays}-day trial` : ""}`;
}

export default async function ProductsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const ws = ctx.workspace.slug;
  const list = await listProducts(ctx);
  const newButton = (
    <Button>
      <PlusIcon /> New product
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you sell: one-time offers, subscriptions and payment plans."
        actions={<ProductDialog workspaceSlug={ws} trigger={newButton} />}
      />
      {list.length === 0 ? (
        <EmptyState
          icon={<PackageIcon />}
          title="Add your first product"
          description="Create a product, then attach it to a checkout, order bump or upsell step in any funnel."
          action={<ProductDialog workspaceSlug={ws} trigger={newButton} />}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 max-sm:hidden">Price</th>
                <th className="px-4 py-3 text-end max-md:hidden">Sales</th>
                <th className="px-4 py-3 text-end max-md:hidden">Revenue</th>
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
                          <div className="truncate font-medium">{p.name}</div>
                          <div className="truncate text-xs text-muted-foreground sm:hidden">
                            {price ? priceText(price) : "No price"}
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
                          <span className="font-medium">{priceText(price)}</span>
                          <Badge variant="secondary">
                            {price.type === "one_time"
                              ? "One-time"
                              : price.type === "recurring"
                                ? "Subscription"
                                : "Payment plan"}
                          </Badge>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums max-md:hidden">{p.sales.count}</td>
                    <td className="px-4 py-3 text-end font-medium tabular-nums max-md:hidden">
                      {formatMoney(p.sales.revenue, price?.currency ?? "usd")}
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
                            <Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`}>
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
