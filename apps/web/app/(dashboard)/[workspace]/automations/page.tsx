import { Button } from "@zfunnel/ui/button";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { cn } from "@zfunnel/ui/lib/utils";
import { PlusIcon, WorkflowIcon } from "lucide-react";
import Link from "next/link";
import { NODE_META, TRIGGER_META } from "@/components/automations/meta";
import { NewAutomation } from "@/components/automations/new-automation";
import { PageHeader } from "@/components/page-header";
import { listWorkflows } from "@/lib/automations";
import { requireWorkspace } from "@/lib/context";
import { flowOrder } from "@/lib/workflow-graph";

export const metadata = { title: "Automations" };

export default async function AutomationsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const ws = ctx.workspace.slug;
  const list = await listWorkflows(ctx);
  const newButton = (
    <Button>
      <PlusIcon /> New automation
    </Button>
  );
  return (
    <>
      <PageHeader
        title="Automations"
        description="Follow up automatically: emails, waits, tags and branches that run on their own."
        actions={<NewAutomation workspaceSlug={ws} trigger={newButton} />}
      />
      {list.length === 0 ? (
        <EmptyState
          icon={<WorkflowIcon />}
          title="Put your follow-up on autopilot"
          description="Send a welcome series to new leads, onboard customers after a purchase, or tag and branch contacts by what they do."
          action={<NewAutomation workspaceSlug={ws} trigger={newButton} />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map(({ w, inProgress, completed, total }) => {
            const T = TRIGGER_META[w.trigger.type];
            const steps = flowOrder(w.graph);
            return (
              <Link
                key={w.id}
                href={`/automation/${ws}/${w.id}`}
                className="group flex flex-col gap-4 rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
                    <T.icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold group-hover:underline">{w.name}</h3>
                    <p className="truncate text-xs text-muted-foreground">When a contact {T.label.toLowerCase()}</p>
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
                    {w.status === "active" ? "Live" : w.status === "paused" ? "Paused" : "Draft"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {steps.slice(0, 8).map((n) => {
                    const m = NODE_META[n.type];
                    return (
                      <span
                        key={n.id}
                        title={m.label}
                        className="flex size-6 items-center justify-center rounded-md text-white"
                        style={{ background: m.color }}
                      >
                        <m.icon className="size-3.5" />
                      </span>
                    );
                  })}
                  {steps.length > 8 && <span className="text-xs text-muted-foreground">+{steps.length - 8}</span>}
                  {!steps.length && <span className="text-xs text-muted-foreground">No steps yet</span>}
                </div>
                <dl className="mt-auto grid grid-cols-3 gap-2 border-t pt-3 text-center">
                  {[
                    ["Entered", total],
                    ["In progress", inProgress],
                    ["Completed", completed],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-[11px] text-muted-foreground">{k}</dt>
                      <dd className="font-semibold tabular-nums">{Number(v).toLocaleString()}</dd>
                    </div>
                  ))}
                </dl>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
