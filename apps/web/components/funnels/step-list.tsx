"use client";

import { Button } from "@zfunnel/ui/button";
import { cn } from "@zfunnel/ui/lib/utils";
import { toast } from "@zfunnel/ui/toaster";
import { Tooltip } from "@zfunnel/ui/tooltip";
import { ArrowDownIcon, ArrowUpIcon, CircleDotIcon } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { reorderSteps } from "@/lib/funnel-actions";
import type { StepType } from "@/lib/funnels";
import { STEP_COLORS, STEP_LABELS } from "./step-type";

export type StepItem = { id: string; name: string; type: StepType; status: "live" | "changed" | "draft" };

const STATUS = {
  live: { label: "Live", className: "text-emerald-600 dark:text-emerald-400" },
  changed: { label: "Unpublished changes", className: "text-amber-600 dark:text-amber-400" },
  draft: { label: "Draft", className: "text-muted-foreground" },
};

export function StepList({
  steps,
  selectedId,
  base,
  workspaceSlug,
  funnelId,
}: {
  steps: StepItem[];
  selectedId: string;
  base: string;
  workspaceSlug: string;
  funnelId: string;
}) {
  const [optimistic, setOptimistic] = useOptimistic(steps);
  const [, start] = useTransition();

  function move(index: number, dir: -1 | 1) {
    const next = [...optimistic];
    const [item] = next.splice(index, 1);
    next.splice(index + dir, 0, item!);
    start(async () => {
      setOptimistic(next);
      const res = await reorderSteps(
        workspaceSlug,
        funnelId,
        next.map((s) => s.id),
      );
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {optimistic.map((s, i) => (
        <li key={s.id} className="group relative">
          <Link
            href={`${base}?step=${s.id}`}
            scroll={false}
            className={cn(
              "flex items-center gap-3 rounded-lg border bg-card p-3 pr-16 transition-all",
              s.id === selectedId ? "border-primary shadow-sm ring-4 ring-primary/15" : "hover:border-foreground/20",
            )}
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white"
              style={{ background: STEP_COLORS[s.type] }}
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{s.name}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {STEP_LABELS[s.type]}
                <span aria-hidden>·</span>
                <span className={cn("inline-flex items-center gap-1", STATUS[s.status].className)}>
                  <CircleDotIcon className="size-3" />
                  {STATUS[s.status].label}
                </span>
              </span>
            </span>
          </Link>
          <div className="absolute top-1/2 right-2 flex -translate-y-1/2 flex-col opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Tooltip label="Move up" side="left">
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                disabled={i === 0}
                onClick={() => move(i, -1)}
                aria-label={`Move ${s.name} up`}
              >
                <ArrowUpIcon className="size-3.5" />
              </Button>
            </Tooltip>
            <Tooltip label="Move down" side="left">
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                disabled={i === optimistic.length - 1}
                onClick={() => move(i, 1)}
                aria-label={`Move ${s.name} down`}
              >
                <ArrowDownIcon className="size-3.5" />
              </Button>
            </Tooltip>
          </div>
        </li>
      ))}
    </ol>
  );
}
