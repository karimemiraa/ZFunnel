import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { HistoryIcon } from "lucide-react";
import { requireWorkspace } from "@/lib/context";
import { getFmt, getT } from "@/lib/i18n";
import { listAuditLogs } from "@/lib/workspaces";

export async function generateMetadata() {
  return { title: (await getT())("settings.tabs.activity") };
}

const LABELS = {
  "workspace.created": "activity.actions.created",
  "workspace.renamed": "activity.actions.renamed",
} as const;

export default async function ActivityPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const logs = await listAuditLogs(ctx);
  const [t, f] = await Promise.all([getT(), getFmt()]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.tabs.activity")}</CardTitle>
        <CardDescription>{t("activity.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <EmptyState icon={<HistoryIcon />} title={t("activity.empty")} />
        ) : (
          <ul className="divide-y">
            {logs.map((log) => (
              <li key={log.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm">
                  <span className="font-medium">{log.actorName ?? t("activity.someone")}</span>{" "}
                  {log.action in LABELS ? t(LABELS[log.action as keyof typeof LABELS]) : log.action}
                  {log.action === "workspace.renamed" && log.data
                    ? t("activity.renamedTo", { name: String(log.data.to) })
                    : ""}
                </span>
                <time className="text-xs text-muted-foreground" dateTime={log.createdAt.toISOString()}>
                  {f.dateTime(log.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
