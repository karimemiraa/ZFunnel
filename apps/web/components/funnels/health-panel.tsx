"use client";

import { useT } from "@zfunnel/i18n/react";
import { Button } from "@zfunnel/ui/button";
import { cn } from "@zfunnel/ui/lib/utils";
import { toast } from "@zfunnel/ui/toaster";
import {
  ArrowRightIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  TriangleAlertIcon,
  WandSparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { publishStep } from "@/lib/funnel-actions";
import { scoreBand, type HealthIssue, type Severity } from "@/lib/funnel-health";
import { fixStepSeo, linkStepToNext } from "@/lib/health-actions";

const SEVERITY: Record<Severity, { icon: typeof InfoIcon; cls: string }> = {
  critical: { icon: CircleAlertIcon, cls: "text-destructive bg-destructive/10" },
  warning: { icon: TriangleAlertIcon, cls: "text-amber-700 bg-amber-500/15 dark:text-amber-400" },
  info: { icon: InfoIcon, cls: "text-sky-700 bg-sky-500/10 dark:text-sky-400" },
};
const BAND = {
  good: "text-emerald-600 dark:text-emerald-400",
  fair: "text-amber-600 dark:text-amber-400",
  poor: "text-destructive",
} as const;

/** Funnel health check (8.5b): score, issues by severity, one-click fixes where safe. */
export function HealthPanel({
  workspaceSlug,
  base,
  issues,
  score,
  checkedSteps,
  checkedBlocks,
}: {
  workspaceSlug: string;
  base: string;
  issues: HealthIssue[];
  score: number;
  checkedSteps: number;
  checkedBlocks: number;
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busyKey, setBusyKey] = useState("");
  const band = scoreBand(score);
  const counts = { critical: 0, warning: 0, info: 0 };
  for (const i of issues) counts[i.severity]++;

  const fix = (issue: HealthIssue, key: string) => {
    if (!issue.fix || !issue.stepId) return;
    const stepId = issue.stepId;
    setBusyKey(key);
    start(async () => {
      const r =
        issue.fix === "seoFromContent"
          ? await fixStepSeo(workspaceSlug, stepId)
          : issue.fix === "linkNext"
            ? await linkStepToNext(workspaceSlug, stepId)
            : await publishStep(workspaceSlug, stepId);
      setBusyKey("");
      if (!r.ok) return void toast.error(r.error ?? t("common.somethingWrong"));
      toast.success(t("health.fixed"));
      router.refresh();
    });
  };

  const manualHref = (i: HealthIssue) => {
    switch (i.href) {
      case "editor":
        return i.stepId ? `/editor/${workspaceSlug}/${i.stepId}` : null;
      case "step":
        return i.stepId ? `${base}?step=${i.stepId}` : null;
      case "branding":
        return `/${workspaceSlug}/settings`;
      case "domains":
        return `/${workspaceSlug}/settings/domains`;
      case "automations":
        return `/${workspaceSlug}/automations`;
      default:
        return null;
    }
  };

  return (
    <div className="grid gap-6" data-testid="health-panel">
      <div className="flex flex-wrap items-center gap-6 rounded-xl border bg-card p-5">
        <div className="flex items-baseline gap-1">
          <span className={cn("text-5xl font-bold tabular-nums", BAND[band])} data-testid="health-score">
            {score}
          </span>
          <span className="text-muted-foreground">/100</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{t(`health.band.${band}`)}</p>
          <p className="text-sm text-muted-foreground">
            {t("health.checked", { steps: checkedSteps, count: checkedBlocks })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {(["critical", "warning", "info"] as const).map((s) => {
            const Icon = SEVERITY[s].icon;
            return (
              <span
                key={s}
                className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1", SEVERITY[s].cls)}
              >
                <Icon className="size-3.5" /> {t(`health.severity.${s}`, { count: counts[s] })}
              </span>
            );
          })}
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-5 text-sm">
          <CircleCheckIcon className="size-5 text-emerald-600" />
          {t("health.allGood")}
        </div>
      ) : (
        <ul className="grid gap-2">
          {issues.map((i, n) => {
            const key = `${i.rule}-${i.stepId ?? "site"}-${n}`;
            const Icon = SEVERITY[i.severity].icon;
            const href = manualHref(i);
            return (
              <li
                key={key}
                className="flex flex-wrap items-start gap-3 rounded-xl border bg-card p-4"
                data-rule={i.rule}
              >
                <span className={cn("mt-0.5 rounded-full p-1.5", SEVERITY[i.severity].cls)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {t(`health.rules.${i.rule}.title`, { ...i.params, count: Number(i.params?.count ?? 1) })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {i.stepName && <span className="font-medium text-foreground">{i.stepName} · </span>}
                    {t(`health.rules.${i.rule}.body`, { ...i.params, count: Number(i.params?.count ?? 1) })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {i.fix && (
                    <Button size="sm" disabled={pending} onClick={() => fix(i, key)}>
                      {pending && busyKey === key ? <Loader2Icon className="animate-spin" /> : <WandSparklesIcon />}
                      {t(`health.fix.${i.fix}`)}
                    </Button>
                  )}
                  {!i.fix && href && (
                    <Button size="sm" variant="outline" asChild>
                      <Link href={href}>
                        {t("health.open")} <ArrowRightIcon className="rtl:-scale-x-100" />
                      </Link>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
