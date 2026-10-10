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

export const metadata = { title: "Broadcast" };

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
  const [segs, tags, count] = await Promise.all([
    listSegments(ctx),
    allTags(ctx),
    audienceCount(ctx, { segmentId: b.segmentId, tag: b.tag }),
  ]);
  const audience = b.segmentId ? `segment:${b.segmentId}` : b.tag ? `tag:${b.tag}` : "all";

  return (
    <>
      <Link
        href={`/${ws}/email`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Email
      </Link>
      <PageHeader
        title={email.name}
        description={email.subject || "Compose your broadcast"}
        actions={<BroadcastStatusBadge status={b.status} />}
      />
      {stats.total > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Delivered" value={`${stats.sent.toLocaleString()} / ${stats.total.toLocaleString()}`} />
          <StatCard
            label="Opened"
            value={pct(stats.opened, stats.sent)}
            hint={`${stats.opened.toLocaleString()} contacts`}
          />
          <StatCard
            label="Clicked"
            value={pct(stats.clicked, stats.sent)}
            hint={`${stats.clicked.toLocaleString()} contacts`}
          />
          <StatCard label="Failed / bounced" value={stats.failed.toLocaleString()} />
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
        tags={tags.map((t) => t.tag)}
        aiEnabled={aiConfigured()}
      />
    </>
  );
}
