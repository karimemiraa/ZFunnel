"use client";

import { useT } from "@zfunnel/i18n/react";
import { cn } from "@zfunnel/ui/lib/utils";
import Link from "next/link";
import { useMemo } from "react";
import { OrderStatus } from "@/components/commerce/order-status";
import { BulkBar, RowCheck, useSelection } from "@/components/records/bulk-bar";
import type { ListFilters } from "@/lib/list-filters";

type Row = {
  id: string;
  number: number;
  when: string;
  name: string | null;
  email: string | null;
  shipping: { full: string; short: string } | null;
  items: { id: string; role: string; name: string; failed: boolean }[];
  status: "paid" | "pending" | "failed" | "refunded" | "partially_refunded";
  test: boolean;
  total: string;
};

/** Orders list with row selection and bulk actions on the buyers (8.5c). Rows open the order. */
export function OrdersTable({
  workspaceSlug,
  rows,
  total,
  filters,
  workflows,
}: {
  workspaceSlug: string;
  rows: Row[];
  total: number;
  filters: ListFilters;
  workflows: { id: string; name: string }[];
}) {
  const t = useT();
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const sel = useSelection(pageIds);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <BulkBar
        workspaceSlug={workspaceSlug}
        resource="orders"
        selection={sel}
        pageIds={pageIds}
        total={total}
        filters={filters}
        workflows={workflows}
        exportPath={`/${workspaceSlug}/orders/export`}
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
            <th className="px-2 py-3 text-start">{t("orders.colOrder")}</th>
            <th className="px-4 py-3 text-start">{t("orders.colCustomer")}</th>
            <th className="px-4 py-3 text-start max-lg:hidden">{t("orders.colItems")}</th>
            <th className="px-4 py-3 text-start max-sm:hidden">{t("orders.colStatus")}</th>
            <th className="px-4 py-3 text-end">{t("orders.colTotal")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((o) => (
            <tr key={o.id} className="group align-top hover:bg-muted/30">
              <td className="px-4 py-3">
                <RowCheck
                  checked={sel.allMatching || sel.picked.has(o.id)}
                  onChange={() => sel.toggle(o.id)}
                  label={t("records.bulk.selectOrder", { number: o.number })}
                />
              </td>
              <td className="px-2 py-3">
                <Link href={`/${workspaceSlug}/orders/${o.id}`} className="font-medium hover:underline">
                  #{o.number}
                </Link>
                <div className="text-xs text-muted-foreground">{o.when}</div>
              </td>
              <td className="px-4 py-3">
                <div className="max-w-[16rem] truncate font-medium">{o.name ?? "—"}</div>
                <div className="max-w-[16rem] truncate text-xs text-muted-foreground" dir="ltr">
                  {o.email}
                </div>
                {o.shipping && (
                  <div className="mt-1 max-w-[16rem] truncate text-xs text-muted-foreground" title={o.shipping.full}>
                    {o.shipping.short}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 max-lg:hidden">
                <ul className="space-y-0.5">
                  {o.items.map((i) => (
                    <li
                      key={i.id}
                      className={cn(
                        "flex items-center gap-1.5 text-xs",
                        i.failed && "text-muted-foreground line-through",
                      )}
                    >
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase">
                        {t(`orders.roles.${i.role}` as "orders.roles.main")}
                      </span>
                      {i.name}
                    </li>
                  ))}
                </ul>
              </td>
              <td className="px-4 py-3 max-sm:hidden">
                <OrderStatus status={o.status} test={o.test} />
              </td>
              <td className="px-4 py-3 text-end font-semibold tabular-nums">{o.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
