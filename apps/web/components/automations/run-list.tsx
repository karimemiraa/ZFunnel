"use client";

import { useIntlLocale, useT } from "@zfunnel/i18n/react";
import { Badge } from "@zfunnel/ui/badge";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { ActivityIcon } from "lucide-react";
import Link from "next/link";
import type { listRuns } from "@/lib/automations";
import { NODE_META } from "./meta";

const STATUS = {
  active: { label: "automations.runs.status.active", variant: "default" },
  waiting: { label: "automations.runs.status.waiting", variant: "outline" },
  completed: { label: "automations.runs.status.completed", variant: "success" },
  failed: { label: "automations.runs.status.failed", variant: "warning" },
  cancelled: { label: "automations.runs.status.cancelled", variant: "secondary" },
} as const;

export function RunList({
  runs,
  workspaceSlug,
}: {
  runs: Awaited<ReturnType<typeof listRuns>>;
  workspaceSlug: string;
}) {
  const t = useT();
  const tag = useIntlLocale();
  const dateTime = (d: Date) =>
    new Date(d).toLocaleString(tag, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (!runs.length)
    return (
      <EmptyState
        icon={<ActivityIcon />}
        title={t("automations.runs.emptyTitle")}
        description={t("automations.runs.emptyBody")}
      />
    );
  return (
    <div className="mx-auto grid max-w-4xl gap-3">
      {runs.map(({ r, email, name, logs }) => {
        const s = STATUS[r.status];
        return (
          <details key={r.id} className="group rounded-xl border bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/${workspaceSlug}/contacts/${r.contactId}`} className="font-medium hover:underline">
                  {name || email}
                </Link>
                {name && <span className="ms-2 text-xs text-muted-foreground">{email}</span>}
                <p className="text-xs text-muted-foreground">
                  {t("automations.runs.started", { when: dateTime(r.startedAt) })}
                  {r.status === "waiting" &&
                    r.resumeAt &&
                    t("automations.runs.resumes", { when: dateTime(r.resumeAt) })}
                  {r.error && ` · ${r.error}`}
                </p>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {t("automations.runs.steps", { count: logs.length })}
              </span>
              <Badge variant={s.variant}>{t(s.label)}</Badge>
            </summary>
            <ol className="grid gap-2 border-t px-4 py-3">
              {logs.map((l) => {
                const m = NODE_META[l.nodeType as keyof typeof NODE_META];
                return (
                  <li key={l.id} className="flex items-center gap-3 text-sm">
                    <span
                      className="flex size-6 items-center justify-center rounded-md text-white"
                      style={{ background: m?.color ?? "#64748b" }}
                    >
                      {m && <m.icon className="size-3.5" />}
                    </span>
                    <span className="font-medium">{m ? t(m.label) : l.nodeType}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{l.message}</span>
                    {l.status !== "ok" && (
                      <Badge variant={l.status === "error" ? "warning" : "secondary"}>
                        {t(`automations.runs.logStatus.${l.status}`)}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums">{dateTime(l.createdAt)}</span>
                  </li>
                );
              })}
              {!logs.length && <li className="text-sm text-muted-foreground">{t("automations.runs.noSteps")}</li>}
            </ol>
          </details>
        );
      })}
    </div>
  );
}
