"use client";

import { useT } from "@zfunnel/i18n/react";
import { Button } from "@zfunnel/ui/button";
import { cn } from "@zfunnel/ui/lib/utils";
import { toast } from "@zfunnel/ui/toaster";
import { EyeIcon, FlaskConicalIcon, Loader2Icon, PencilIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createVariant, endSplitTest, setVariantWeight } from "@/lib/funnel-actions";
import { useFmt } from "@/lib/use-fmt";

type Row = { key: string; label: string; visitors: number; converted: number; rate: number };
type Props = {
  workspaceSlug: string;
  stepId: string;
  published: boolean;
  variant: { id: string; name: string; weight: number; published: boolean; changed: boolean; startedAt: string } | null;
  rows: Row[];
  confidence: number | null;
};

export function SplitTest(p: Props) {
  const t = useT();
  const f = useFmt();
  const pct = (n: number) => f.percent(n, 1);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [weight, setWeight] = useState(p.variant?.weight ?? 50);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; message?: string; id?: string }>,
    after?: (r: { id?: string }) => void,
  ) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? t("common.somethingWrong"));
      if (r.message) toast.success(r.message);
      after?.(r);
      router.refresh();
    });

  if (!p.variant)
    return (
      <section className="rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
            <FlaskConicalIcon className="size-[18px]" />
          </span>
          <div className="flex-1">
            <h3 className="font-semibold">{t("funnels.split.title")}</h3>
            <p className="text-sm text-muted-foreground">{t("funnels.split.intro")}</p>
          </div>
          <Button
            variant="outline"
            disabled={pending || !p.published}
            title={p.published ? undefined : t("funnels.split.publishFirst")}
            onClick={() =>
              run(
                () => createVariant(p.workspaceSlug, p.stepId),
                (r) => r.id && router.push(`/editor/${p.workspaceSlug}/${p.stepId}?variant=${r.id}`),
              )
            }
          >
            {pending && <Loader2Icon className="animate-spin" />} {t("funnels.split.createVariant")}
          </Button>
        </div>
      </section>
    );

  const v = p.variant;
  const best = p.rows.reduce<Row | null>((b, r) => (r.visitors >= 20 && (!b || r.rate > b.rate) ? r : b), null);
  const conf = p.confidence;
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b px-5 py-3">
        <FlaskConicalIcon className="size-4 text-sky-600" />
        <h3 className="flex-1 font-semibold">{t("funnels.split.running")}</h3>
        <span className="text-xs text-muted-foreground">{t("funnels.split.since", { date: f.date(v.startedAt) })}</span>
      </div>
      {!v.published && (
        <p className="border-b bg-amber-500/10 px-5 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          {t("funnels.split.unpublished", { name: v.name })}
        </p>
      )}
      <table className="w-full text-sm">
        <thead className="text-start text-xs text-muted-foreground">
          <tr>
            <th className="px-5 py-2 font-medium">{t("funnels.split.version")}</th>
            <th className="px-3 py-2 text-end font-medium">{t("funnels.split.visitors")}</th>
            <th className="px-3 py-2 text-end font-medium">{t("funnels.split.converted")}</th>
            <th className="px-5 py-2 text-end font-medium">{t("funnels.split.rate")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {p.rows.map((r) => (
            <tr key={r.key} className={cn(best?.key === r.key && conf !== null && conf >= 0.95 && "bg-emerald-500/5")}>
              <td className="px-5 py-3">
                <div className="flex items-center gap-2 font-medium">
                  {r.label}
                  {best?.key === r.key && conf !== null && conf >= 0.95 && (
                    <TrophyIcon className="size-4 text-emerald-600" />
                  )}
                </div>
                <div className="mt-1 flex gap-2">
                  <Link
                    href={
                      r.key === "a"
                        ? `/editor/${p.workspaceSlug}/${p.stepId}`
                        : `/editor/${p.workspaceSlug}/${p.stepId}?variant=${v.id}`
                    }
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                  >
                    <PencilIcon className="size-3" /> {t("common.edit")}
                  </Link>
                  <a
                    href={
                      r.key === "a"
                        ? `/preview/${p.workspaceSlug}/${p.stepId}`
                        : `/preview/${p.workspaceSlug}/${p.stepId}?variant=${v.id}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                  >
                    <EyeIcon className="size-3" /> {t("funnels.preview")}
                  </a>
                </div>
              </td>
              <td className="px-3 py-3 text-end tabular-nums">{f.number(r.visitors)}</td>
              <td className="px-3 py-3 text-end tabular-nums">{f.number(r.converted)}</td>
              <td className="px-5 py-3 text-end font-semibold tabular-nums">{r.visitors ? pct(r.rate) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid gap-4 border-t px-5 py-4">
        <p className="text-sm text-muted-foreground">
          {conf === null
            ? t("funnels.split.collecting")
            : conf >= 0.95
              ? t("funnels.split.winning", { name: best?.label ?? "", percent: Math.round(conf * 100) })
              : t("funnels.split.noWinner", { percent: Math.round(conf * 100) })}
        </p>
        <div className="grid gap-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span>{t("funnels.split.originalWeight", { percent: 100 - weight })}</span>
            <span>{t("funnels.split.variantWeight", { name: v.name, percent: weight })}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={weight}
            aria-label={t("funnels.split.trafficLabel", { name: v.name })}
            className="w-full accent-[var(--primary)]"
            onChange={(e) => {
              const w = Number(e.target.value);
              setWeight(w);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(
                () => void setVariantWeight(p.workspaceSlug, v.id, w).then((r) => !r.ok && toast.error(r.error)),
                400,
              );
            }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              confirm(t("funnels.split.confirmKeep")) && run(() => endSplitTest(p.workspaceSlug, p.stepId, "a"))
            }
          >
            {t("funnels.split.keepOriginal")}
          </Button>
          <Button
            disabled={pending || !v.published}
            onClick={() =>
              confirm(t("funnels.split.confirmWinner", { name: v.name })) &&
              run(() => endSplitTest(p.workspaceSlug, p.stepId, v.id))
            }
          >
            <TrophyIcon /> {t("funnels.split.variantWins", { name: v.name })}
          </Button>
        </div>
      </div>
    </section>
  );
}
