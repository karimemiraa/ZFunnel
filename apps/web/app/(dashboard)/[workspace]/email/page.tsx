import { Button } from "@zfunnel/ui/button";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { MailIcon, PlusIcon, SettingsIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { BroadcastMenu } from "@/components/email/broadcast-menu";
import { SenderSettings } from "@/components/email/sender-settings";
import { BroadcastStatusBadge } from "@/components/email/status-badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { requireWorkspace } from "@/lib/context";
import { getEmailSettings, listBroadcasts } from "@/lib/email";
import { createBroadcast } from "@/lib/email-actions";
import { getFmt, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await getT())("email.title") };
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

export default async function EmailPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const ws = ctx.workspace.slug;
  const [settings, list, t, f] = await Promise.all([getEmailSettings(ctx), listBroadcasts(ctx), getT(), getFmt()]);
  const totals = list.reduce(
    (a, r) => ({ sent: a.sent + r.sent, opened: a.opened + r.opened, clicked: a.clicked + r.clicked }),
    { sent: 0, opened: 0, clicked: 0 },
  );
  const create = createBroadcast.bind(null, ws);
  const newButton = (
    <form action={create}>
      <Button type="submit">
        <PlusIcon /> {t("email.newBroadcast")}
      </Button>
    </form>
  );

  return (
    <>
      <PageHeader
        title={t("email.title")}
        description={t("email.description")}
        actions={
          <div className="flex gap-2">
            <SenderSettings
              workspaceSlug={ws}
              settings={settings}
              trigger={
                <Button variant="outline">
                  <SettingsIcon /> {t("email.sender")}
                </Button>
              }
            />
            {newButton}
          </div>
        }
      />
      {!settings && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1">
            <p className="font-medium">{t("email.setupTitle")}</p>
            <p className="opacity-80">{t("email.setupBody")}</p>
          </div>
          <SenderSettings
            workspaceSlug={ws}
            settings={null}
            trigger={
              <Button size="sm" variant="outline">
                {t("email.setUp")}
              </Button>
            }
          />
        </div>
      )}
      {list.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label={t("email.stats.emailsSent")} value={f.number(totals.sent)} />
          <StatCard label={t("email.stats.openRate")} value={pct(totals.opened, totals.sent)} />
          <StatCard label={t("email.stats.clickRate")} value={pct(totals.clicked, totals.sent)} />
        </div>
      )}
      {list.length === 0 ? (
        <EmptyState
          icon={<MailIcon />}
          title={t("email.emptyTitle")}
          description={t("email.emptyBody")}
          action={newButton}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">{t("email.table.broadcast")}</th>
                <th className="px-4 py-3">{t("email.table.status")}</th>
                <th className="px-4 py-3 text-end max-md:hidden">{t("email.table.sent")}</th>
                <th className="px-4 py-3 text-end max-md:hidden">{t("email.table.opens")}</th>
                <th className="px-4 py-3 text-end max-md:hidden">{t("email.table.clicks")}</th>
                <th className="w-12 px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((r) => (
                <tr key={r.b.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/${ws}/email/${r.b.id}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    <p className="max-w-md truncate text-xs text-muted-foreground">
                      {r.subject || t("email.noSubjectYet")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <BroadcastStatusBadge status={r.b.status} />
                    {r.b.status === "scheduled" && r.b.scheduledAt && (
                      <p className="mt-1 text-xs text-muted-foreground">{f.dateTime(r.b.scheduledAt)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums max-md:hidden">{f.number(r.sent)}</td>
                  <td className="px-4 py-3 text-end tabular-nums max-md:hidden">{pct(r.opened, r.sent)}</td>
                  <td className="px-4 py-3 text-end tabular-nums max-md:hidden">{pct(r.clicked, r.sent)}</td>
                  <td className="px-2 py-3 text-end">
                    <BroadcastMenu
                      workspaceSlug={ws}
                      broadcastId={r.b.id}
                      emailId={r.b.emailId}
                      name={r.name}
                      canDelete={r.b.status !== "sending"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
