import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { HistoryIcon } from "lucide-react";
import { requireWorkspace } from "@/lib/context";
import { listAuditLogs } from "@/lib/workspaces";

export const metadata = { title: "Activity" };

const LABELS: Record<string, string> = {
  "workspace.created": "created the workspace",
  "workspace.renamed": "renamed the workspace",
};

export default async function ActivityPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const logs = await listAuditLogs(ctx);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        <CardDescription>A record of changes made in this workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <EmptyState icon={<HistoryIcon />} title="No activity yet" />
        ) : (
          <ul className="divide-y">
            {logs.map((log) => (
              <li key={log.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm">
                  <span className="font-medium">{log.actorName ?? "Someone"}</span> {LABELS[log.action] ?? log.action}
                  {log.action === "workspace.renamed" && log.data ? ` to “${String(log.data.to)}”` : ""}
                </span>
                <time className="text-xs text-muted-foreground" dateTime={log.createdAt.toISOString()}>
                  {log.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
