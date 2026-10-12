import { EmptyState } from "@zfunnel/ui/empty-state";
import { cn } from "@zfunnel/ui/lib/utils";
import { UsersIcon } from "lucide-react";
import Link from "next/link";
import { AddContactDialog, ExportButton, FieldsDialog, ImportDialog } from "@/components/crm/contact-tools";
import { ContactsTable } from "@/components/crm/contacts-table";
import { SegmentBuilder } from "@/components/crm/segment-builder";
import { PageHeader } from "@/components/page-header";
import { FilterBar } from "@/components/records/filter-bar";
import { ListPager, PAGE_SIZE, pageOf } from "@/components/records/list-pager";
import { SearchInput } from "@/components/search-input";
import { listWorkflows } from "@/lib/automations";
import { requireWorkspace } from "@/lib/context";
import { allTags, listContactsFiltered, listFields, listSegments } from "@/lib/crm";
import { listFunnels } from "@/lib/funnels";
import { getFmt, getT } from "@/lib/i18n";
import { filtersFromParams, filtersToQuery, hasFilters } from "@/lib/list-filters";
import { listViews } from "@/lib/records";

export async function generateMetadata() {
  return { title: (await getT())("contacts.pageTitle") };
}

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireWorkspace(params);
  const sp = await searchParams;
  const filters = filtersFromParams("contacts", sp);
  const segment = typeof sp.segment === "string" && /^[0-9a-f-]{36}$/i.test(sp.segment) ? sp.segment : undefined;
  const page = pageOf(sp.page);
  const ws = ctx.workspace.slug;
  const [t, f] = await Promise.all([getT(), getFmt()]);
  const [{ rows, total }, tags, segs, fields, funnels, views, workflows] = await Promise.all([
    listContactsFiltered(ctx, { filters, segmentId: segment, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    allTags(ctx),
    listSegments(ctx),
    listFields(ctx),
    listFunnels(ctx),
    listViews(ctx, "contacts"),
    listWorkflows(ctx),
  ]);
  const query = filtersToQuery(filters);
  const qs = [query, segment ? `segment=${segment}` : ""].filter(Boolean).join("&");
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
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="me-1 text-xs text-muted-foreground">{t("records.views.segments")}</span>
          {segs.map((s) => (
            <Link
              key={s.id}
              href={
                segment === s.id
                  ? `/${ws}/contacts?${query}`
                  : `/${ws}/contacts?${[query, `segment=${s.id}`].filter(Boolean).join("&")}`
              }
              className={pill(segment === s.id)}
            >
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
      <FilterBar
        workspaceSlug={ws}
        resource="contacts"
        filters={filters}
        tags={tags.map((x) => x.tag)}
        funnels={funnels.map((x) => ({ id: x.id, name: x.name }))}
        views={views}
        currency="usd"
        keep={{ segment }}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title={hasFilters(filters) || segment ? t("contacts.noMatching") : t("contacts.emptyTitle")}
          description={t("contacts.emptyDescription")}
        />
      ) : (
        <>
          <ContactsTable
            workspaceSlug={ws}
            total={total}
            filters={filters}
            segmentId={segment ?? null}
            workflows={workflows.filter((w) => w.w.status === "active").map((w) => ({ id: w.w.id, name: w.w.name }))}
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
          <ListPager
            base={`/${ws}/contacts`}
            params={Object.fromEntries(new URLSearchParams(qs))}
            page={page}
            pages={Math.ceil(total / PAGE_SIZE)}
          />
        </>
      )}
    </>
  );
}
