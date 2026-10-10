import { EmptyState } from "@zfunnel/ui/empty-state";
import { cn } from "@zfunnel/ui/lib/utils";
import { UsersIcon } from "lucide-react";
import Link from "next/link";
import { AddContactDialog, ExportButton, FieldsDialog, ImportDialog } from "@/components/crm/contact-tools";
import { ContactsTable } from "@/components/crm/contacts-table";
import { SegmentBuilder } from "@/components/crm/segment-builder";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { requireWorkspace } from "@/lib/context";
import { allTags, listContactsFiltered, listFields, listSegments } from "@/lib/crm";
import { listFunnels } from "@/lib/funnels";
import { getFmt, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await getT())("contacts.pageTitle") };
}

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ q?: string; tag?: string; segment?: string }>;
}) {
  const ctx = await requireWorkspace(params);
  const sp = await searchParams;
  const ws = ctx.workspace.slug;
  const [t, f] = await Promise.all([getT(), getFmt()]);
  const [{ rows, total }, tags, segs, fields, funnels] = await Promise.all([
    listContactsFiltered(ctx, { q: sp.q, tag: sp.tag, segmentId: sp.segment }),
    allTags(ctx),
    listSegments(ctx),
    listFields(ctx),
    listFunnels(ctx),
  ]);
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const pill = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
      active ? "border-foreground bg-foreground text-background" : "hover:border-foreground/30",
    );

  return (
    <>
      <PageHeader
        title={t("contacts.pageTitle")}
        description={t("contacts.inView", { count: total })}
        actions={
          <div className="flex flex-wrap gap-2">
            <FieldsDialog
              workspaceSlug={ws}
              fields={fields.map((f) => ({ id: f.id, label: f.label, key: f.key, type: f.type }))}
            />
            <ImportDialog workspaceSlug={ws} />
            <ExportButton href={`/${ws}/contacts/export${qs ? `?${qs}` : ""}`} />
            <AddContactDialog workspaceSlug={ws} />
          </div>
        }
      />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={`/${ws}/contacts`} className={pill(!sp.segment && !sp.tag)}>
            {t("contacts.allContacts")}
          </Link>
          {segs.map((s) => (
            <Link key={s.id} href={`/${ws}/contacts?segment=${s.id}`} className={pill(sp.segment === s.id)}>
              {s.name}
            </Link>
          ))}
          <SegmentBuilder
            workspaceSlug={ws}
            funnels={funnels.map((f) => ({ id: f.id, name: f.name }))}
            fields={fields.map((f) => ({ key: f.key, label: f.label }))}
            tags={tags.map((t) => t.tag)}
          />
        </div>
        <SearchInput placeholder={t("contacts.searchPlaceholder")} />
      </div>
      {tags.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          <span className="me-1 text-xs text-muted-foreground">{t("contacts.tagsLabel")}</span>
          {tags.slice(0, 20).map((t) => (
            <Link
              key={t.tag}
              href={`/${ws}/contacts?${new URLSearchParams({ ...(sp.segment ? { segment: sp.segment } : {}), ...(sp.tag === t.tag ? {} : { tag: t.tag }) })}`}
              className={pill(sp.tag === t.tag)}
            >
              {t.tag} <span className="opacity-60">{t.n}</span>
            </Link>
          ))}
        </div>
      )}
      {rows.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title={sp.q || sp.tag || sp.segment ? t("contacts.noMatching") : t("contacts.emptyTitle")}
          description={t("contacts.emptyDescription")}
        />
      ) : (
        <ContactsTable
          workspaceSlug={ws}
          rows={rows.map(({ contact: c, orderCount, spent, funnelName }) => ({
            id: c.id,
            email: c.email,
            name: c.name,
            tags: c.tags,
            orderCount,
            spent,
            funnelName,
            utm: c.attribution?.utmSource
              ? `${c.attribution.utmSource}${c.attribution.utmCampaign ? ` · ${c.attribution.utmCampaign}` : ""}`
              : null,
            added: f.timeAgo(c.createdAt),
          }))}
        />
      )}
    </>
  );
}
