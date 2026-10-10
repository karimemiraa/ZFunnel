import { Badge } from "@zfunnel/ui/badge";
import { Button } from "@zfunnel/ui/button";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { DownloadIcon, FilterIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { NewFunnelDialog } from "@/components/funnels/new-funnel-dialog";
import { aiConfigured } from "@/lib/ai";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/context";
import { listFunnels } from "@/lib/funnels";
import { getFmt, getT } from "@/lib/i18n";
import { presetList, templateList } from "@/lib/presets";

export async function generateMetadata() {
  return { title: (await getT())("funnels.title") };
}

export default async function FunnelsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const t = await getT();
  const f = await getFmt();
  const funnels = await listFunnels(ctx);
  const presets = presetList(t);
  const templates = templateList(t);
  const ws = ctx.workspace.slug;

  return (
    <>
      <PageHeader
        title={t("funnels.title")}
        description={t("funnels.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/${ws}/funnels/import`}>
                <DownloadIcon /> {t("importer.button")}
              </Link>
            </Button>
            <NewFunnelDialog workspaceSlug={ws} presets={presets} templates={templates} aiEnabled={aiConfigured()} />
          </div>
        }
      />
      {funnels.length === 0 ? (
        <EmptyState
          icon={<FilterIcon />}
          title={t("funnels.emptyTitle")}
          description={t("funnels.emptyDescription")}
          action={
            <NewFunnelDialog
              workspaceSlug={ws}
              presets={presets}
              templates={templates}
              aiEnabled={aiConfigured()}
              trigger={
                <Button size="lg">
                  <PlusIcon /> {t("funnels.createFunnel")}
                </Button>
              }
            />
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {funnels.map((fn) => {
            const live = fn.publishedCount > 0;
            return (
              <Link
                key={fn.id}
                href={`/${ws}/funnels/${fn.id}`}
                className="group overflow-hidden rounded-xl border bg-card transition-all hover:border-brand-orange/50 hover:shadow-lg hover:shadow-brand-navy/5"
              >
                <div className="relative h-40 overflow-hidden border-b bg-muted/60">
                  {fn.firstStepId ? (
                    <iframe
                      src={`/preview/${ws}/${fn.firstStepId}?thumb=1`}
                      title={t("funnels.previewOf", { name: fn.name })}
                      loading="lazy"
                      tabIndex={-1}
                      className="pointer-events-none absolute top-0 left-0 h-[640px] w-[1280px] origin-top-left scale-[0.3] border-0 transition-transform duration-500 group-hover:scale-[0.31]"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-b from-background/0 to-background/10" />
                </div>
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{fn.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("funnels.cardMeta", { count: fn.stepCount, ago: f.timeAgo(fn.updatedAt) })}
                    </p>
                  </div>
                  <Badge variant={live ? "success" : "secondary"}>
                    {live ? t("funnels.status.live") : t("funnels.status.draft")}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
