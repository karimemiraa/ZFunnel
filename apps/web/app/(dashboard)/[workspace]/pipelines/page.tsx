import { EmptyState } from "@zfunnel/ui/empty-state";
import { cn } from "@zfunnel/ui/lib/utils";
import { KanbanIcon } from "lucide-react";
import Link from "next/link";
import { Kanban } from "@/components/crm/kanban";
import { NewPipelineButton } from "@/components/crm/new-pipeline";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/context";
import { getPipelineBoard } from "@/lib/crm";
import { getFmt, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await getT())("pipelines.pageTitle") };
}

export default async function PipelinesPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const ctx = await requireWorkspace(params);
  const { p } = await searchParams;
  const board = await getPipelineBoard(ctx, p);
  const ws = ctx.workspace.slug;
  const [t, f] = await Promise.all([getT(), getFmt()]);
  if (!board.current)
    return (
      <>
        <PageHeader title={t("pipelines.pageTitle")} description={t("pipelines.pageDescription")} />
        <EmptyState
          icon={<KanbanIcon />}
          title={t("pipelines.emptyTitle")}
          description={t("pipelines.emptyDescription")}
          action={<NewPipelineButton workspaceSlug={ws} size="lg" />}
        />
      </>
    );
  const stageKind = new Map(board.stages.map((s) => [s.id, s.kind]));
  const open = board.deals
    .filter((d) => stageKind.get(d.deal.stageId) === "open")
    .reduce((s, d) => s + d.deal.value, 0);
  const won = board.deals.filter((d) => stageKind.get(d.deal.stageId) === "won").reduce((s, d) => s + d.deal.value, 0);

  return (
    <>
      <PageHeader
        title={t("pipelines.pageTitle")}
        description={t("pipelines.summary", { open: f.money(open, "usd"), won: f.money(won, "usd") })}
        actions={
          <div className="flex items-center gap-2">
            {board.pipelines.length > 1 && (
              <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
                {board.pipelines.map((pl) => (
                  <Link
                    key={pl.id}
                    href={`/${ws}/pipelines?p=${pl.id}`}
                    className={cn(
                      "rounded-md px-3 py-1.5 font-medium",
                      pl.id === board.current!.id ? "bg-background shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    {pl.name}
                  </Link>
                ))}
              </div>
            )}
            <NewPipelineButton workspaceSlug={ws} />
          </div>
        }
      />
      <Kanban
        workspaceSlug={ws}
        pipelineId={board.current.id}
        stages={board.stages.map((s) => ({ id: s.id, name: s.name, color: s.color, kind: s.kind }))}
        deals={board.deals.map(({ deal, contactName, contactEmail }) => ({
          id: deal.id,
          stageId: deal.stageId,
          title: deal.title,
          value: deal.value,
          currency: deal.currency,
          contactId: deal.contactId,
          contactLabel: contactName ?? contactEmail,
        }))}
      />
    </>
  );
}
