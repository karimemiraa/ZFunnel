import { Badge } from "@zfunnel/ui/badge";
import { cn } from "@zfunnel/ui/lib/utils";
import { ClipboardListIcon, PackageIcon, WorkflowIcon } from "lucide-react";
import Link from "next/link";
import { funnelAnalytics } from "@/lib/analytics";
import { getFmt, getT } from "@/lib/i18n";
import { getFunnelLinks } from "@/lib/records";
import type { WorkspaceContext } from "@/lib/workspaces";

/** Per-step stats for the last 30 days: visits, opt-ins, sales and conversion (8.2). */
export async function FunnelStatsStrip({
  ctx,
  funnelId,
  base,
  selectedId,
}: {
  ctx: WorkspaceContext;
  funnelId: string;
  base: string;
  selectedId?: string;
}) {
  const [data, t, f] = await Promise.all([funnelAnalytics(ctx, funnelId, 30), getT(), getFmt()]);
  if (!data.steps.length) return null;
  return (
    <section className="mb-6" aria-label={t("records.funnel.statsTitle")}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("records.funnel.statsTitle")}</h2>
        <Link
          href={`/${ctx.workspace.slug}/analytics?funnel=${funnelId}`}
          className="text-xs text-primary hover:underline"
        >
          {t("records.funnel.fullAnalytics")}
        </Link>
      </div>
      <ol className="flex gap-2 overflow-x-auto pb-1" data-testid="funnel-stats">
        {data.steps.map((s) => (
          <li key={s.id} className="min-w-40 flex-1">
            <Link
              href={`${base}?step=${s.id}`}
              className={cn(
                "block rounded-xl border bg-card p-3 transition-colors hover:border-brand-orange/50",
                selectedId === s.id && "border-brand-orange",
              )}
            >
              <p className="truncate text-xs font-medium">{s.name}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                <dt className="text-muted-foreground">{t("records.funnel.visits")}</dt>
                <dd className="text-end font-semibold tabular-nums">{f.number(s.visitors)}</dd>
                <dt className="text-muted-foreground">{t("records.funnel.optins")}</dt>
                <dd className="text-end font-semibold tabular-nums">{f.number(s.optins)}</dd>
                <dt className="text-muted-foreground">{t("records.funnel.sales")}</dt>
                <dd className="text-end font-semibold tabular-nums">{f.number(s.purchases + s.accepts)}</dd>
                <dt className="text-muted-foreground">{t("records.funnel.conversion")}</dt>
                <dd className="text-end font-semibold text-brand-orange-text tabular-nums">
                  {s.tracked ? f.percent(s.rate) : "—"}
                </dd>
              </dl>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** What the funnel uses: products sold on its steps, forms collected, automations it triggers. */
export async function FunnelLinks({ ctx, funnelId }: { ctx: WorkspaceContext; funnelId: string }) {
  const [links, t] = await Promise.all([getFunnelLinks(ctx, funnelId), getT()]);
  if (!links) return null;
  const ws = ctx.workspace.slug;
  const box = "rounded-xl border bg-card p-4";
  const empty = <p className="text-xs text-muted-foreground">{t("records.funnel.none")}</p>;
  return (
    <section className="mt-8 grid gap-4 md:grid-cols-3" data-testid="funnel-links">
      <div className={box}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <PackageIcon className="size-4" /> {t("records.funnel.products")}
        </h2>
        {links.products.length ? (
          <ul className="space-y-1.5 text-sm">
            {links.offers.map((o) => (
              <li key={`${o.id}-${o.stepId}-${o.role}`} className="flex items-center gap-2">
                <Link href={`/${ws}/products/${o.id}`} className="min-w-0 flex-1 truncate hover:underline">
                  {o.name}
                </Link>
                <Badge variant="secondary">{t(`records.roles.${o.role}`)}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          empty
        )}
      </div>
      <div className={box}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <ClipboardListIcon className="size-4" /> {t("records.funnel.forms")}
        </h2>
        {links.forms.length ? (
          <ul className="space-y-1.5 text-sm">
            {links.forms.map((fm) => (
              <li key={`${fm.stepId}-${fm.blockId}`} className="flex items-center gap-2">
                <Link
                  href={`/${ws}/forms/${fm.stepId}/${encodeURIComponent(fm.blockId)}`}
                  className="min-w-0 flex-1 truncate hover:underline"
                >
                  {fm.formName}
                </Link>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t("records.funnel.responses", { count: fm.responses })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          empty
        )}
      </div>
      <div className={box}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <WorkflowIcon className="size-4" /> {t("records.funnel.automations")}
        </h2>
        {links.automations.length ? (
          <ul className="space-y-1.5 text-sm">
            {links.automations.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <Link href={`/automation/${ws}/${a.id}`} className="min-w-0 flex-1 truncate hover:underline">
                  {a.name}
                </Link>
                <Badge variant={a.status === "active" ? "success" : "secondary"}>
                  {t(`automations.status.${a.status}`)}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          empty
        )}
      </div>
    </section>
  );
}
