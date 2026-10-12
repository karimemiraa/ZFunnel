"use client";

import { useT } from "@zfunnel/i18n/react";
import { Badge } from "@zfunnel/ui/badge";
import { cn } from "@zfunnel/ui/lib/utils";
import Link from "next/link";
import { useMemo } from "react";
import { BulkBar, RowCheck, useSelection } from "@/components/records/bulk-bar";

type Card = { id: string; name: string; meta: string; live: boolean; firstStepId: string | null };

/** Funnel cards with selection for bulk export and delete (8.5c). */
export function FunnelGrid({ workspaceSlug, funnels }: { workspaceSlug: string; funnels: Card[] }) {
  const t = useT();
  const ids = useMemo(() => funnels.map((f) => f.id), [funnels]);
  const sel = useSelection(ids);
  const ws = workspaceSlug;
  return (
    <>
      <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
        <RowCheck
          checked={sel.pageSelected}
          indeterminate={sel.picked.size > 0}
          onChange={sel.togglePage}
          label={t("records.bulk.selectAllFunnels")}
        />
        <span>{t("records.bulk.selectAllFunnels")}</span>
      </div>
      {sel.picked.size > 0 && (
        <div className="mb-4 overflow-hidden rounded-xl border bg-card">
          <BulkBar
            workspaceSlug={ws}
            resource="funnels"
            selection={sel}
            pageIds={ids}
            total={ids.length}
            exportPath={`/${ws}/funnels/export`}
          />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {funnels.map((fn) => (
          <div key={fn.id} className="relative">
            <span className="absolute start-3 top-3 z-10 rounded-md bg-background/90 p-1.5 shadow-sm">
              <RowCheck
                checked={sel.picked.has(fn.id)}
                onChange={() => sel.toggle(fn.id)}
                label={t("records.bulk.selectFunnel", { name: fn.name })}
              />
            </span>
            <Link
              href={`/${ws}/funnels/${fn.id}`}
              className={cn(
                "group block overflow-hidden rounded-xl border bg-card transition-all hover:border-brand-orange/50 hover:shadow-lg hover:shadow-brand-navy/5",
                sel.picked.has(fn.id) && "border-brand-orange ring-2 ring-brand-orange/30",
              )}
            >
              <div className="relative h-40 overflow-hidden border-b bg-muted/60">
                {fn.firstStepId ? (
                  <iframe
                    src={`/preview/${ws}/${fn.firstStepId}?thumb=1`}
                    title={t("funnels.previewOf", { name: fn.name })}
                    loading="lazy"
                    tabIndex={-1}
                    className="pointer-events-none absolute top-0 left-0 h-[640px] w-[1280px] origin-top-left scale-[0.3] border-0 transition-transform duration-500 group-hover:scale-[0.31]"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-b from-background/0 to-background/10" />
              </div>
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{fn.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{fn.meta}</p>
                </div>
                <Badge variant={fn.live ? "success" : "secondary"}>
                  {fn.live ? t("funnels.status.live") : t("funnels.status.draft")}
                </Badge>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
