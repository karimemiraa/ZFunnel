import { Badge } from "@zfunnel/ui/badge";
import { ExternalLinkIcon, FilterIcon, HandshakeIcon, PackageIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { navText } from "@/lib/nav";
import { notFound } from "next/navigation";
import { OrderStatus } from "@/components/commerce/order-status";
import { Section } from "@/components/records/section";
import { requireWorkspace } from "@/lib/context";
import { getFmt, getT } from "@/lib/i18n";
import { getOrderDetail } from "@/lib/records";

type Params = { params: Promise<{ workspace: string; orderId: string }> };

export async function generateMetadata({ params }: Params) {
  const ctx = await requireWorkspace(params);
  const d = await getOrderDetail(ctx, (await params).orderId);
  const t = await getT();
  return { title: d ? t("records.order.title", { number: String(d.order.number) }) : t("orders.title") };
}

/** Stripe dashboard link for a payment (test or live). */
function stripeHref(externalId: string | null, test: boolean) {
  if (!externalId || !/^(pi|in|ch)_/.test(externalId)) return null;
  return `https://dashboard.stripe.com/${test ? "test/" : ""}payments/${externalId}`;
}

export default async function OrderPage({ params }: Params) {
  const ctx = await requireWorkspace(params);
  const d = await getOrderDetail(ctx, (await params).orderId);
  if (!d) notFound();
  const [t, f] = await Promise.all([getT(), getFmt()]);
  const ws = ctx.workspace.slug;
  const o = d.order;
  const link = "font-medium hover:underline";

  return (
    <>
      <Breadcrumbs
        items={[
          { label: navText(t, "", "label"), href: `/${ws}` },
          { label: navText(t, "orders", "label"), href: `/${ws}/orders` },
          { label: t("records.order.title", { number: String(o.number) }) },
        ]}
      />
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("records.order.title", { number: String(o.number) })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("records.order.placed", { when: f.dateTime(o.createdAt) })}
            {o.paidAt ? ` · ${t("records.order.paid", { when: f.dateTime(o.paidAt) })}` : ""}
          </p>
        </div>
        <OrderStatus status={o.status} test={o.test} />
        <div className="text-end">
          <div className="text-xs text-muted-foreground">{t("orders.colTotal")}</div>
          <div className="text-2xl font-semibold tabular-nums">{f.money(o.total, o.currency)}</div>
          {o.refundedAmount > 0 && (
            <div className="text-xs text-muted-foreground">
              {t("records.order.refunded", { amount: f.money(o.refundedAmount, o.currency) })}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Section title={t("orders.colItems")} empty="—" testId="order-items">
            {d.items.map(({ item: i, productId, productLive }) => (
              <li key={i.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <PackageIcon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">
                  {productId && productLive ? (
                    <Link href={`/${ws}/products/${productId}`} className={link}>
                      {i.productName}
                    </Link>
                  ) : (
                    <span className="font-medium">{i.productName}</span>
                  )}
                  {i.priceLabel && <span className="text-muted-foreground"> · {i.priceLabel}</span>}
                </span>
                <Badge variant="secondary">{t(`records.roles.${i.role}`)}</Badge>
                {i.status !== "paid" && <Badge variant="outline">{t(`records.order.itemStatus.${i.status}`)}</Badge>}
                <span className="w-20 text-end tabular-nums">{f.money(i.amount, o.currency)}</span>
              </li>
            ))}
          </Section>

          <Section title={t("records.order.payments")} empty={t("records.order.noPayments")} testId="order-payments">
            {d.payments.map((p) => {
              const href = stripeHref(p.externalId, o.test);
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className="font-medium">{t(`records.order.paymentKind.${p.kind}`)}</span>
                  <span className="text-muted-foreground">{f.dateTime(p.createdAt)}</span>
                  <Badge variant={p.status === "succeeded" ? "success" : "secondary"}>
                    {t(`records.order.paymentStatus.${p.status}`)}
                  </Badge>
                  {p.refundedAmount > 0 && (
                    <Badge variant="warning">
                      {t("records.order.refunded", { amount: f.money(p.refundedAmount, p.currency) })}
                    </Badge>
                  )}
                  <span className="ms-auto tabular-nums">{f.money(p.amount, p.currency)}</span>
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      {t("records.order.inStripe")} <ExternalLinkIcon className="size-3" />
                    </a>
                  )}
                  {p.failureMessage && <p className="w-full text-xs text-destructive">{p.failureMessage}</p>}
                </li>
              );
            })}
          </Section>
          {o.refundedAmount > 0 && <p className="text-sm text-muted-foreground">{t("records.order.refundHelp")}</p>}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5 text-sm">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <UserIcon className="size-4" /> {t("orders.colCustomer")}
            </h2>
            {d.contact?.live ? (
              <Link href={`/${ws}/contacts/${d.contact.id}`} className={link} data-testid="order-contact">
                {d.contact.name ?? d.contact.email}
              </Link>
            ) : (
              <span className="text-muted-foreground">{t("records.order.noContact")}</span>
            )}
            {d.contact && (
              <p className="truncate text-xs text-muted-foreground" dir="ltr">
                {d.contact.email}
              </p>
            )}
            {o.shipping && (
              <p className="mt-3 text-xs whitespace-pre-line text-muted-foreground">
                {[
                  o.shipping.name,
                  o.shipping.line1,
                  o.shipping.line2,
                  `${o.shipping.postalCode} ${o.shipping.city}`,
                  o.shipping.region,
                  o.shipping.country,
                ]
                  .filter(Boolean)
                  .join("\n")}
              </p>
            )}
          </div>
          <div className="rounded-xl border bg-card p-5 text-sm">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <FilterIcon className="size-4" /> {t("records.order.source")}
            </h2>
            {d.funnel ? (
              d.funnel.live ? (
                <Link href={`/${ws}/funnels/${d.funnel.id}`} className={link} data-testid="order-funnel">
                  {d.funnel.name}
                </Link>
              ) : (
                <span>{t("records.deletedFunnel")}</span>
              )
            ) : (
              <span className="text-muted-foreground">{t("records.order.store")}</span>
            )}
            {d.step &&
              (d.step.live && d.funnel ? (
                <p>
                  <Link
                    href={`/${ws}/funnels/${d.funnel.id}?step=${d.step.id}`}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    {t("records.order.step", { name: d.step.name })}
                  </Link>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("records.order.step", { name: d.step.name })}</p>
              ))}
          </div>
          {d.affiliate && (
            <div className="rounded-xl border bg-card p-5 text-sm">
              <h2 className="mb-3 flex items-center gap-2 font-semibold">
                <HandshakeIcon className="size-4" /> {t("records.order.affiliate")}
              </h2>
              <Link href={`/${ws}/affiliates`} className={link}>
                {d.affiliate.name ?? d.affiliate.email}
              </Link>
              <p className="text-xs text-muted-foreground" dir="ltr">
                ?aff={d.affiliate.code}
              </p>
              {d.affiliate.commission !== null && (
                <p className="mt-2 text-xs">
                  {t("records.order.commission", {
                    amount: f.money(d.affiliate.commission, o.currency),
                    status: t(`records.order.commissionStatus.${d.affiliate.commissionStatus ?? "pending"}`),
                  })}
                </p>
              )}
            </div>
          )}
          {d.subscriptions.length > 0 && (
            <div className="rounded-xl border bg-card p-5 text-sm">
              <h2 className="mb-3 font-semibold">{t("records.order.subscriptions")}</h2>
              <ul className="space-y-1">
                {d.subscriptions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <Badge variant="secondary">{s.status}</Badge>
                    {s.currentPeriodEnd && (
                      <span className="text-xs text-muted-foreground">
                        {t("records.order.renews", { when: f.date(s.currentPeriodEnd) })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
