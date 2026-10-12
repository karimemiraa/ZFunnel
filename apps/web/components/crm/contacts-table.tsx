"use client";

import { Badge } from "@zfunnel/ui/badge";
import { useT } from "@zfunnel/i18n/react";
import Link from "next/link";
import { useMemo } from "react";
import { BulkBar, RowCheck, useSelection } from "@/components/records/bulk-bar";
import type { ListFilters } from "@/lib/list-filters";
import { useFmt } from "@/lib/use-fmt";

type Row = {
  id: string;
  email: string;
  name: string | null;
  tags: string[];
  orderCount: number;
  spent: number;
  funnelName: string | null;
  utm: string | null;
  added: string;
};

export function ContactsTable({
  workspaceSlug,
  rows,
  total,
  filters,
  segmentId,
  workflows,
}: {
  workspaceSlug: string;
  rows: Row[];
  total: number;
  filters: ListFilters;
  segmentId: string | null;
  workflows: { id: string; name: string }[];
}) {
  const t = useT();
  const f = useFmt();
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const sel = useSelection(pageIds);

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <BulkBar
        workspaceSlug={workspaceSlug}
        resource="contacts"
        selection={sel}
        pageIds={pageIds}
        total={total}
        filters={filters}
        segmentId={segmentId}
        workflows={workflows}
        exportPath={`/${workspaceSlug}/contacts/export`}
      />
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="w-10 px-4 py-3">
              <RowCheck
                checked={sel.pageSelected}
                indeterminate={sel.picked.size > 0}
                onChange={sel.togglePage}
                label={t("records.bulk.selectPage")}
              />
            </th>
            <th className="px-2 py-3">{t("contacts.colContact")}</th>
            <th className="px-4 py-3 max-lg:hidden">{t("contacts.tags")}</th>
            <th className="px-4 py-3 max-md:hidden">{t("contacts.colSource")}</th>
            <th className="px-4 py-3 max-sm:hidden">{t("contacts.colStatus")}</th>
            <th className="px-4 py-3 text-end">{t("contacts.colSpent")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((c) => (
            <tr key={c.id} className="group hover:bg-muted/30">
              <td className="px-4 py-3">
                <RowCheck
                  checked={sel.allMatching || sel.picked.has(c.id)}
                  onChange={() => sel.toggle(c.id)}
                  label={t("contacts.selectRow", { email: c.email })}
                />
              </td>
              <td className="px-2 py-3">
                <Link href={`/${workspaceSlug}/contacts/${c.id}`} className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {(c.name ?? c.email).slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium group-hover:underline">{c.name ?? "—"}</span>
                    <span className="block truncate text-xs text-muted-foreground" dir="ltr">
                      {c.email}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3 max-lg:hidden">
                <div className="flex flex-wrap gap-1">
                  {c.tags.slice(0, 4).map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                  {c.tags.length > 4 && <Badge variant="outline">+{c.tags.length - 4}</Badge>}
                </div>
              </td>
              <td className="px-4 py-3 max-md:hidden">
                <div className="max-w-[12rem] truncate">{c.funnelName ?? "—"}</div>
                {c.utm && <div className="text-xs text-muted-foreground">{t("contacts.via", { source: c.utm })}</div>}
              </td>
              <td className="px-4 py-3 max-sm:hidden">
                {c.orderCount > 0 ? (
                  <Badge variant="success">{t("contacts.customerCount", { count: c.orderCount })}</Badge>
                ) : (
                  <Badge variant="secondary">{t("contacts.lead")}</Badge>
                )}
              </td>
              <td className="px-4 py-3 text-end font-medium tabular-nums">{c.spent ? f.money(c.spent, "usd") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
