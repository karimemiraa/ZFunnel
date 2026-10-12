import { cn } from "@zfunnel/ui/lib/utils";
import { ArrowLeftIcon, ListIcon, WorkflowIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddStepDialog } from "@/components/funnels/add-step-dialog";
import { FunnelLinks, FunnelStatsStrip } from "@/components/records/funnel-links";
import { FunnelActionsBar } from "@/components/funnels/funnel-actions-bar";
import { ShareFunnel } from "@/components/funnels/share-funnel";
import { FunnelMap } from "@/components/funnels/funnel-map";
import { StepList } from "@/components/funnels/step-list";
import { StepOffers } from "@/components/funnels/step-offers";
import { SplitTest } from "@/components/funnels/split-test";
import { StepPanel } from "@/components/funnels/step-panel";
import { getStepOfferList, listProducts } from "@/lib/commerce";
import { getFmt, getT } from "@/lib/i18n";
import { requireWorkspace } from "@/lib/context";
import { confidence, getSplitStats, getVariants } from "@/lib/split";
import { getFunnel, type StepSummary } from "@/lib/funnels";
import { siteOrigin, stepUrl } from "@/lib/urls";
import { canManage } from "@/lib/workspaces";

function status(s: StepSummary): "live" | "changed" | "draft" {
  if (!s.publishedAt) return "draft";
  return s.draftUpdatedAt.getTime() > s.publishedAt.getTime() + 1000 ? "changed" : "live";
}

export async function generateMetadata({ params }: { params: Promise<{ workspace: string; funnelId: string }> }) {
  const ctx = await requireWorkspace(params);
  const data = await getFunnel(ctx, (await params).funnelId);
  return { title: data?.funnel.name ?? (await getT())("funnels.funnel") };
}

export default async function FunnelPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; funnelId: string }>;
  searchParams: Promise<{ step?: string; view?: string }>;
}) {
  const ctx = await requireWorkspace(params);
  const t = await getT();
  const f = await getFmt();
  const { funnelId } = await params;
  const { step: stepParam, view } = await searchParams;
  const data = await getFunnel(ctx, funnelId);
  if (!data) notFound();
  const { funnel, steps } = data;
  const ws = ctx.workspace.slug;
  const base = `/${ws}/funnels/${funnel.id}`;
  const selected = steps.find((s) => s.id === stepParam) ?? steps[0];
  const isMap = view === "map";
  const sells = selected && ["checkout", "upsell", "downsell"].includes(selected.type);
  const [offers, productList] = sells
    ? await Promise.all([getStepOfferList(ctx, selected.id), listProducts(ctx)])
    : [[], []];
  const variants = selected ? await getVariants(ctx, selected.id) : [];
  const variant = variants[0];
  const splitRows = variant ? await getSplitStats(ctx, funnel.id, selected!.id, variant.createdAt) : [];
  const statFor = (key: string, label: string) => {
    const r = splitRows.find((x) => x.key === key);
    return { key, label, visitors: r?.visitors ?? 0, converted: r?.converted ?? 0, rate: r?.rate ?? 0 };
  };
  const splitTable = variant
    ? [
        statFor("a", t("funnels.split.originalRow")),
        statFor(variant.id, t("funnels.split.variantRow", { name: variant.name })),
      ]
    : [];
  const productOptions = productList.flatMap((p) => {
    const price = p.prices.at(-1);
    if (!price) return [];
    const suffix = price.type === "one_time" ? "" : `/${price.interval}`;
    return [{ priceId: price.id, label: `${p.name}: ${f.money(price.amount, price.currency)}${suffix}` }];
  });

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link
            href={`/${ws}/funnels`}
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5 rtl:-scale-x-100" /> {t("funnels.title")}
          </Link>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{funnel.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShareFunnel workspaceSlug={ws} funnelId={funnel.id} token={funnel.shareToken} />
          <FunnelActionsBar
            workspaceSlug={ws}
            funnel={{ id: funnel.id, name: funnel.name, slug: funnel.slug }}
            isHome={ctx.workspace.homeFunnelId === funnel.id}
            origin={siteOrigin(ws)}
            canDelete={canManage(ctx.membership.role)}
          />
        </div>
      </div>

      <FunnelStatsStrip ctx={ctx} funnelId={funnel.id} base={base} selectedId={isMap ? undefined : selected?.id} />

      <div className="mb-6 inline-flex rounded-lg bg-muted p-1 text-sm">
        {[
          { href: base, label: t("funnels.tabSteps"), icon: ListIcon, active: !isMap },
          { href: `${base}?view=map`, label: t("funnels.tabMap"), icon: WorkflowIcon, active: isMap },
        ].map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-all",
              tab.active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="size-4" /> {tab.label}
          </Link>
        ))}
      </div>

      {isMap ? (
        <>
          <FunnelMap
            workspaceSlug={ws}
            funnelId={funnel.id}
            base={base}
            steps={steps.map((s, index) => ({
              id: s.id,
              name: s.name,
              type: s.type,
              x: s.mapX,
              y: s.mapY,
              nextStepId: s.nextStepId,
              declineStepId: s.declineStepId,
              status: status(s),
              index,
            }))}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            {t("funnels.mapHelp1")} <span className="font-medium text-emerald-600">{t("funnels.mapGreen")}</span>{" "}
            {t("funnels.mapHelp2")} <span className="font-medium text-rose-600">{t("funnels.mapRed")}</span>{" "}
            {t("funnels.mapHelp3")}
          </p>
        </>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          <aside className="flex flex-col gap-3">
            <StepList
              workspaceSlug={ws}
              funnelId={funnel.id}
              base={base}
              selectedId={selected?.id ?? ""}
              steps={steps.map((s) => ({ id: s.id, name: s.name, type: s.type, status: status(s) }))}
            />
            <AddStepDialog workspaceSlug={ws} funnelId={funnel.id} />
          </aside>
          <section>
            {selected ? (
              <StepPanel
                key={selected.id}
                workspaceSlug={ws}
                base={base}
                liveUrl={stepUrl(ws, funnel.slug, selected.slug)}
                step={{ ...selected, status: status(selected) }}
                others={steps.filter((s) => s.id !== selected.id).map((s) => ({ id: s.id, name: s.name }))}
                splitSlot={
                  <SplitTest
                    workspaceSlug={ws}
                    stepId={selected.id}
                    published={!!selected.publishedAt}
                    variant={
                      variant
                        ? {
                            id: variant.id,
                            name: variant.name,
                            weight: variant.weight,
                            published: !!variant.publishedVersionId,
                            changed: !!variant.publishedAt && variant.draftUpdatedAt > variant.publishedAt,
                            startedAt: variant.createdAt.toISOString(),
                          }
                        : null
                    }
                    rows={splitTable}
                    confidence={confidence(splitTable[0], splitTable[1])}
                  />
                }
                offersSlot={
                  sells ? (
                    <StepOffers
                      workspaceSlug={ws}
                      stepId={selected.id}
                      stepType={selected.type}
                      offers={offers}
                      products={productOptions}
                    />
                  ) : null
                }
              />
            ) : (
              <p className="text-muted-foreground">{t("funnels.noSteps")}</p>
            )}
          </section>
        </div>
      )}
      <FunnelLinks ctx={ctx} funnelId={funnel.id} />
    </>
  );
}
