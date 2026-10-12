import { Button } from "@zfunnel/ui/button";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { DownloadIcon, FilterIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { FunnelGrid } from "@/components/funnels/funnel-grid";
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
        <FunnelGrid
          workspaceSlug={ws}
          funnels={funnels.map((fn) => ({
            id: fn.id,
            name: fn.name,
            meta: t("funnels.cardMeta", { count: fn.stepCount, ago: f.timeAgo(fn.updatedAt) }),
            live: fn.publishedCount > 0,
            firstStepId: fn.firstStepId,
          }))}
        />
      )}
    </>
  );
}
