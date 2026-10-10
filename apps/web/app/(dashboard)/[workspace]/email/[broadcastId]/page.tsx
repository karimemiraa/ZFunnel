import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Composer } from "@/components/email/composer";
import { BroadcastStatusBadge } from "@/components/email/status-badge";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { aiConfigured } from "@/lib/ai";
import { requireWorkspace } from "@/lib/context";
import { allTags, listSegments } from "@/lib/crm";
import { audienceCount, getBroadcast } from "@/lib/email";
import { getFmt, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await getT())("email.broadcastTitle") };
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

export default async function BroadcastPage({
  params,
}: {
  params: Promise<{ workspace: string; broadcastId: string }>;
}) {
  const { broadcastId } = await params;
  const ctx = await requireWorkspace(params);
  const ws = ctx.workspace.slug;
  const row = await getBroadcast(ctx, broadcastId);
  if (!row) notFound();
  const { b, email, stats } = row;
  const [segs, tags, count, t, f] = await Promise.all([
    listSegments(ctx),
    allTags(ctx),
    audienceCount(ctx, { segmentId: b.segmentId, tag: b.tag }),
    getT(),
    getFmt(),
  ]);
  const audience = b.segmentId ? `segment:${b.segmentId}` : b.tag ? `tag:${b.tag}` : "all";

  return (
    <>
      <Link
        href={`/${ws}/email`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 rtl:-scale-x-100" /> {t("email.title")}
      </Link>
      <PageHeader
        title={email.name}
        description={email.subject || t("email.composeBroadcast")}
        actions={<BroadcastStatusBadge status={b.status} />}
      />
      {stats.total > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label={t("email.stats.delivered")} value={`${f.number(stats.sent)} / ${f.number(stats.total)}`} />
          <StatCard
            label={t("email.stats.opened")}
            value={pct(stats.opened, stats.sent)}
            hint={t("email.stats.contacts", { count: stats.opened })}
          />
          <StatCard
            label={t("email.stats.clicked")}
            value={pct(stats.clicked, stats.sent)}
            hint={t("email.stats.contacts", { count: stats.clicked })}
          />
          <StatCard label={t("email.stats.failed")} value={f.number(stats.failed)} />
        </div>
      )}
      <Composer
        workspaceSlug={ws}
        broadcastId={b.id}
        emailId={email.id}
        status={b.status}
        scheduledAt={b.scheduledAt?.toISOString() ?? null}
        initial={{ name: email.name, subject: email.subject, preheader: email.preheader, audience }}
        initialCount={count}
        segments={segs.map((s) => ({ id: s.id, name: s.name }))}
        tags={tags.map((x) => x.tag)}
        aiEnabled={aiConfigured()}
      />
    </>
  );
}
