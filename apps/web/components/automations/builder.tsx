"use client";

import type { WorkflowGraph, WorkflowNode, WorkflowStatus, WorkflowTrigger } from "@zfunnel/db/schema";
import { useT } from "@zfunnel/i18n/react";
import { Button } from "@zfunnel/ui/button";
import { cn } from "@zfunnel/ui/lib/utils";
import { toast, Toaster } from "@zfunnel/ui/toaster";
import { ArrowLeftIcon, CheckIcon, CloudIcon, Loader2Icon, PauseIcon, PlayIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { saveWorkflow, setWorkflowStatus } from "@/lib/automation-actions";
import { blankNode, insertNode, removeNode, updateNode, type NodeType, type Slot } from "@/lib/workflow-graph";
import { WorkflowCanvas } from "./canvas";
import type { Lookups } from "./meta";
import { StepPanel, TriggerPanel } from "./step-panel";

type Props = {
  workspaceSlug: string;
  workflow: {
    id: string;
    name: string;
    status: WorkflowStatus;
    trigger: WorkflowTrigger;
    graph: WorkflowGraph;
    allowReentry: boolean;
  };
  lookups: Lookups;
  tab: "builder" | "activity";
  activity: React.ReactNode;
};

type SaveState = "saved" | "dirty" | "saving" | "error";

export function AutomationBuilder({ workspaceSlug, workflow, lookups: initialLookups, tab, activity }: Props) {
  const router = useRouter();
  const t = useT();
  const [name, setName] = useState(workflow.name);
  const [trigger, setTrigger] = useState(workflow.trigger);
  const [graph, setGraph] = useState(workflow.graph);
  const [reentry, setReentry] = useState(workflow.allowReentry);
  const [lookups, setLookups] = useState(initialLookups);
  const [selected, setSelected] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("saved");
  const [status, setStatus] = useState(workflow.status);
  const [pending, start] = useTransition();
  const pendingPatch = useRef<Parameters<typeof saveWorkflow>[2]>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pendingPatch.current;
    pendingPatch.current = {};
    if (!Object.keys(patch).length) return true;
    setSave("saving");
    const r = await saveWorkflow(workspaceSlug, workflow.id, patch);
    setSave(r.ok ? "saved" : "error");
    if (!r.ok) toast.error(r.error);
    return r.ok;
  }, [workspaceSlug, workflow.id]);

  const queue = (patch: Parameters<typeof saveWorkflow>[2]) => {
    pendingPatch.current = { ...pendingPatch.current, ...patch };
    setSave("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 700);
  };

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (timer.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  const changeGraph = (g: WorkflowGraph) => {
    setGraph(g);
    queue({ graph: g });
  };
  const onAdd = (slot: Slot, type: NodeType) => {
    const node = blankNode(type);
    changeGraph(insertNode(graph, slot, node));
    setSelected(node.id);
  };
  const readOnly = status === "active";
  const node = selected && selected !== "trigger" ? graph.nodes[selected] : undefined;

  const toggle = () =>
    start(async () => {
      if (!(await flush())) return;
      const next = status === "active" ? "paused" : "active";
      const r = await setWorkflowStatus(workspaceSlug, workflow.id, next);
      if (!r.ok) return void toast.error(r.error);
      setStatus(next);
      toast.success(r.message ?? t("automations.builder.saved"));
      router.refresh();
    });

  const indicator = {
    saved: [<CheckIcon key="i" className="size-3.5" />, t("automations.builder.saved")],
    dirty: [<CloudIcon key="i" className="size-3.5" />, t("automations.builder.unsaved")],
    saving: [<Loader2Icon key="i" className="size-3.5 animate-spin" />, t("automations.builder.saving")],
    error: [<TriangleAlertIcon key="i" className="size-3.5 text-destructive" />, t("automations.builder.notSaved")],
  }[save];

  const base = `/automation/${workspaceSlug}/${workflow.id}`;
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${workspaceSlug}/automations`} aria-label={t("automations.builder.back")}>
            <ArrowLeftIcon className="rtl:-scale-x-100" />
          </Link>
        </Button>
        <input
          aria-label={t("automations.builder.nameLabel")}
          value={name}
          maxLength={80}
          onChange={(e) => {
            setName(e.target.value);
            if (e.target.value.trim()) queue({ name: e.target.value });
          }}
          className="h-9 max-w-[40vw] min-w-0 rounded-md bg-transparent px-2 text-sm font-semibold outline-none hover:bg-accent focus:bg-accent"
        />
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            status === "active"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : status === "paused"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                : "bg-muted text-muted-foreground",
          )}
        >
          {status === "active"
            ? t("automations.status.activeDot")
            : status === "paused"
              ? t("automations.status.paused")
              : t("automations.status.draft")}
        </span>
        <nav className="mx-auto hidden rounded-lg bg-muted p-0.5 sm:flex" aria-label={t("automations.builder.view")}>
          {(["builder", "activity"] as const).map((v) => (
            <Link
              key={v}
              href={v === "builder" ? base : `${base}?tab=activity`}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors",
                tab === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "builder" ? t("automations.builder.workflow") : t("automations.builder.activity")}
            </Link>
          ))}
        </nav>
        <span
          className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground md:inline-flex"
          role="status"
          aria-live="polite"
        >
          {indicator}
        </span>
        <Button onClick={toggle} disabled={pending} variant={status === "active" ? "outline" : "default"}>
          {pending ? <Loader2Icon className="animate-spin" /> : status === "active" ? <PauseIcon /> : <PlayIcon />}
          {status === "active" ? t("automations.builder.pause") : t("automations.builder.activate")}
        </Button>
      </header>

      {tab === "activity" ? (
        <div className="flex-1 overflow-auto p-6">{activity}</div>
      ) : (
        <div className="relative flex min-h-0 flex-1">
          {readOnly && (
            <div className="absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-background/95 px-4 py-1.5 text-xs shadow-sm backdrop-blur">
              {t("automations.builder.liveNotice")
                .split(/<b>(.*?)<\/b>/)
                .map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <WorkflowCanvas
              graph={graph}
              trigger={trigger}
              lookups={lookups}
              selected={selected}
              onSelect={setSelected}
              onAdd={onAdd}
              readOnly={readOnly}
            />
          </div>
          {selected && (
            <aside className="absolute inset-y-0 end-0 z-10 w-full max-w-sm overflow-y-auto border-s bg-background p-5 shadow-xl sm:static sm:shadow-none">
              {selected === "trigger" ? (
                <div className="grid gap-5">
                  <div>
                    <h2 className="text-sm font-semibold">{t("automations.builder.trigger")}</h2>
                    <p className="text-xs text-muted-foreground">{t("automations.builder.triggerHint")}</p>
                  </div>
                  <TriggerPanel
                    trigger={trigger}
                    allowReentry={reentry}
                    lookups={lookups}
                    readOnly={readOnly}
                    onChange={(next) => {
                      setTrigger(next);
                      if (next.type !== "tag_added" || next.tag.trim()) queue({ trigger: next });
                    }}
                    onReentry={(v) => {
                      setReentry(v);
                      queue({ allowReentry: v });
                    }}
                  />
                  <Button variant="outline" onClick={() => setSelected(null)}>
                    {t("automations.builder.done")}
                  </Button>
                </div>
              ) : node ? (
                <StepPanel
                  key={node.id}
                  node={node}
                  lookups={lookups}
                  workspaceSlug={workspaceSlug}
                  workflowId={workflow.id}
                  readOnly={readOnly}
                  onChange={(n: WorkflowNode) => changeGraph(updateNode(graph, n))}
                  onEmailsChange={(emails) => setLookups((l) => ({ ...l, emails }))}
                  onDelete={() => {
                    changeGraph(removeNode(graph, node.id));
                    setSelected(null);
                  }}
                  onClose={() => setSelected(null)}
                />
              ) : null}
            </aside>
          )}
        </div>
      )}
      <Toaster />
    </div>
  );
}
