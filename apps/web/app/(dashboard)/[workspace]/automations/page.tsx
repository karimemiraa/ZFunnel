import { Button } from "@zfunnel/ui/button";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { cn } from "@zfunnel/ui/lib/utils";
import { PlusIcon, WorkflowIcon } from "lucide-react";
import Link from "next/link";
import { AutomationMenu } from "@/components/automations/automation-menu";
import { NODE_META, TRIGGER_META } from "@/components/automations/meta";
import { NewAutomation } from "@/components/automations/new-automation";
import { PageHeader } from "@/components/page-header";
import { listWorkflows } from "@/lib/automations";
import { requireWorkspace } from "@/lib/context";
import { getFmt, getT } from "@/lib/i18n";
import { flowOrder } from "@/lib/workflow-graph";

export async function generateMetadata() {
  return { title: (await getT())("automations.title") };
}

export default async function AutomationsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const ws = ctx.workspace.slug;
  const [list, t, f] = await Promise.all([listWorkflows(ctx), getT(), getFmt()]);
  const newButton = (
    <Button>
      <PlusIcon /> {t("automations.newAutomation")}
    </Button>
  );
  return (
    <>
      <PageHeader
        title={t("automations.title")}
        description={t("automations.description")}
        actions={<NewAutomation workspaceSlug={ws} trigger={newButton} />}
      />
      {list.length === 0 ? (
        <EmptyState
          icon={<WorkflowIcon />}
          title={t("automations.emptyTitle")}
          description={t("automations.emptyBody")}
          action={<NewAutomation workspaceSlug={ws} trigger={newButton} />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map(({ w, inProgress, completed, total }) => {
            const T = TRIGGER_META[w.trigger.type];
            const steps = flowOrder(w.graph);
            return (
              <div key={w.id} className="relative">
                <div className="absolute end-2 bottom-2 z-10">
                  <AutomationMenu workspaceSlug={ws} id={w.id} name={w.name} />
                </div>
                <Link
                  href={`/automation/${ws}/${w.id}`}
                  className="group flex h-full flex-col gap-4 rounded-xl border bg-card p-5 pb-12 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
                      <T.icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold group-hover:underline">{w.name}</h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {t("automations.whenContact", { trigger: t(T.label).toLowerCase() })}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        w.status === "active"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : w.status === "paused"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {w.status === "active"
                        ? t("automations.status.active")
                        : w.status === "paused"
                          ? t("automations.status.paused")
                          : t("automations.status.draft")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {steps.slice(0, 8).map((n) => {
                      const m = NODE_META[n.type];
                      return (
                        <span
                          key={n.id}
                          title={t(m.label)}
                          className="flex size-6 items-center justify-center rounded-md text-white"
                          style={{ background: m.color }}
                        >
                          <m.icon className="size-3.5" />
                        </span>
                      );
                    })}
                    {steps.length > 8 && <span className="text-xs text-muted-foreground">+{steps.length - 8}</span>}
                    {!steps.length && <span className="text-xs text-muted-foreground">{t("automations.noSteps")}</span>}
                  </div>
                  <dl className="mt-auto grid grid-cols-3 gap-2 border-t pt-3 text-center">
                    {[
                      [t("automations.stats.entered"), total],
                      [t("automations.stats.inProgress"), inProgress],
                      [t("automations.stats.completed"), completed],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-[11px] text-muted-foreground">{k}</dt>
                        <dd className="font-semibold tabular-nums">{f.number(Number(v))}</dd>
                      </div>
                    ))}
                  </dl>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
