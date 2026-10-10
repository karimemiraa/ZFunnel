import { Badge } from "@zfunnel/ui/badge";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { ActivityIcon } from "lucide-react";
import Link from "next/link";
import type { listRuns } from "@/lib/automations";
import { NODE_META } from "./meta";

const STATUS = {
  active: { label: "Running", variant: "default" },
  waiting: { label: "Waiting", variant: "outline" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "warning" },
  cancelled: { label: "Stopped", variant: "secondary" },
} as const;

const fmt = (d: Date) =>
  d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function RunList({
  runs,
  workspaceSlug,
}: {
  runs: Awaited<ReturnType<typeof listRuns>>;
  workspaceSlug: string;
}) {
  if (!runs.length)
    return (
      <EmptyState
        icon={<ActivityIcon />}
        title="No contacts yet"
        description="When this automation is live, every contact who triggers it shows up here with each step it ran."
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
                  Started {fmt(r.startedAt)}
                  {r.status === "waiting" && r.resumeAt && ` · resumes ${fmt(r.resumeAt)}`}
                  {r.error && ` · ${r.error}`}
                </p>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">{logs.length} steps</span>
              <Badge variant={s.variant}>{s.label}</Badge>
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
                    <span className="font-medium">{m?.label ?? l.nodeType}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{l.message}</span>
                    {l.status !== "ok" && (
                      <Badge variant={l.status === "error" ? "warning" : "secondary"}>{l.status}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground tabular-nums">{fmt(l.createdAt)}</span>
                  </li>
                );
              })}
              {!logs.length && <li className="text-sm text-muted-foreground">No steps run yet.</li>}
            </ol>
          </details>
        );
      })}
    </div>
  );
}
