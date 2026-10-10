"use client";

import type { CoachSuggestion } from "@zfunnel/db";
import { Button } from "@zfunnel/ui/button";
import { cn } from "@zfunnel/ui/lib/utils";
import { toast } from "@zfunnel/ui/toaster";
import { Loader2Icon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { runCoach } from "@/lib/coach-actions";

const IMPACT: Record<CoachSuggestion["impact"], string> = {
  high: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "bg-muted text-muted-foreground",
};

export function CoachPanel({
  workspaceSlug,
  funnelId,
  range,
  aiReady,
  insight,
}: {
  workspaceSlug: string;
  funnelId: string;
  range: string;
  aiReady: boolean;
  insight: { summary: string; suggestions: CoachSuggestion[]; days: number; visitors: number; at: string } | null;
}) {
  const [busy, start] = useTransition();
  const router = useRouter();
  const run = () =>
    start(async () => {
      const r = await runCoach(workspaceSlug, funnelId, range);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Your coach reviewed this funnel");
      router.refresh();
    });
  return (
    <section className="mb-6 overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <SparklesIcon className="size-4 text-primary" /> Conversion coach
          </h2>
          <p className="text-sm text-muted-foreground">
            {insight
              ? `Based on ${insight.visitors.toLocaleString()} visitors over ${insight.days} days · ${new Date(insight.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
              : "AI reviews this funnel's numbers and copy and tells you what to fix first."}
          </p>
        </div>
        <Button onClick={run} disabled={busy || !aiReady} variant={insight ? "outline" : "default"}>
          {busy ? <Loader2Icon className="animate-spin" /> : insight ? <RefreshCwIcon /> : <SparklesIcon />}
          {busy ? "Analyzing…" : insight ? "Analyze again" : "Analyze my funnel"}
        </Button>
      </div>
      {!aiReady && <p className="px-5 py-4 text-sm text-muted-foreground">AI isn't set up on this server yet.</p>}
      {insight && (
        <div className="space-y-4 p-5">
          <p className="text-sm leading-relaxed">{insight.summary}</p>
          <ol className="grid gap-3 md:grid-cols-2">
            {insight.suggestions.map((s, i) => (
              <li key={i} className="rounded-lg border p-4">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="font-medium">{s.title}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", IMPACT[s.impact])}>
                    {s.impact} impact
                  </span>
                </div>
                {s.step && <p className="mb-1 text-xs font-medium text-muted-foreground">Step: {s.step}</p>}
                <p className="text-sm">{s.change}</p>
                {s.why && <p className="mt-1.5 text-xs text-muted-foreground">Why: {s.why}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
