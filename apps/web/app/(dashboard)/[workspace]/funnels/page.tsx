import { Badge } from "@zfunnel/ui/badge";
import { Button } from "@zfunnel/ui/button";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { FilterIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { NewFunnelDialog } from "@/components/funnels/new-funnel-dialog";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/context";
import { listFunnels } from "@/lib/funnels";
import { presetList } from "@/lib/presets";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Funnels" };

export default async function FunnelsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const funnels = await listFunnels(ctx);
  const presets = presetList();
  const ws = ctx.workspace.slug;

  return (
    <>
      <PageHeader
        title="Funnels"
        description="Build, publish and optimize your sales funnels."
        actions={<NewFunnelDialog workspaceSlug={ws} presets={presets} />}
      />
      {funnels.length === 0 ? (
        <EmptyState
          icon={<FilterIcon />}
          title="Create your first funnel"
          description="Start from a proven structure: lead magnet, sales funnel or tripwire. Every page comes pre-designed."
          action={
            <NewFunnelDialog
              workspaceSlug={ws}
              presets={presets}
              trigger={
                <Button size="lg">
                  <PlusIcon /> Create funnel
                </Button>
              }
            />
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {funnels.map((f) => {
            const live = f.publishedCount > 0;
            return (
              <Link
                key={f.id}
                href={`/${ws}/funnels/${f.id}`}
                className="group overflow-hidden rounded-xl border bg-card transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-black/5"
              >
                <div className="relative h-40 overflow-hidden border-b bg-muted/60">
                  {f.firstStepId ? (
                    <iframe
                      src={`/preview/${ws}/${f.firstStepId}?thumb=1`}
                      title={`${f.name} preview`}
                      loading="lazy"
                      tabIndex={-1}
                      className="pointer-events-none absolute top-0 left-0 h-[640px] w-[1280px] origin-top-left scale-[0.3] border-0 transition-transform duration-500 group-hover:scale-[0.31]"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-b from-background/0 to-background/10" />
                </div>
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{f.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {f.stepCount} {f.stepCount === 1 ? "step" : "steps"} · updated {timeAgo(f.updatedAt)}
                    </p>
                  </div>
                  <Badge variant={live ? "success" : "secondary"}>{live ? "Live" : "Draft"}</Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
