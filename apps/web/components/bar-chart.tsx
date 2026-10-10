"use client";

import { useIntlLocale, useT } from "@zfunnel/i18n/react";
import { useState } from "react";
import { useFmt } from "@/lib/use-fmt";

/** Single-series daily bar chart: one hue, rounded data-ends, hover tooltip, recessive axis. */
export function BarChart({
  data,
  unit,
  label,
}: {
  data: { day: string; value: number }[];
  unit: { currency: string } | { noun: "visitors" };
  label: string;
}) {
  const t = useT();
  const f = useFmt();
  const intl = useIntlLocale();
  const format = (v: number) =>
    "currency" in unit ? f.money(v, unit.currency) : t("analytics.visitorsCount", { count: v, n: f.number(v) });
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const W = 100 / data.length;
  const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(intl, { month: "short", day: "numeric" });
  const h = hover === null ? null : data[hover]!;
  return (
    <figure className="relative" aria-label={label} dir="ltr">
      <div className="relative h-44" onMouseLeave={() => setHover(null)}>
        <div className="absolute inset-x-0 bottom-0 border-t border-border" />
        {data.map((d, i) => (
          <div
            key={d.day}
            className="absolute inset-y-0 flex items-end"
            style={{ left: `${i * W}%`, width: `${W}%`, padding: "0 1px" }}
            onMouseEnter={() => setHover(i)}
          >
            <div
              className="w-full rounded-t-[4px] bg-primary transition-opacity"
              style={{
                height: `${d.value ? Math.max(2, (d.value / max) * 100) : 0}%`,
                opacity: hover === null || hover === i ? 1 : 0.45,
              }}
            />
          </div>
        ))}
        {h && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
            style={{ left: `${(hover! + 0.5) * W}%` }}
          >
            <div className="text-muted-foreground">{fmtDay(h.day)}</div>
            <div className="font-semibold tabular-nums">{format(h.value)}</div>
          </div>
        )}
      </div>
      <figcaption className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{fmtDay(data[0]!.day)}</span>
        <span>{fmtDay(data.at(-1)!.day)}</span>
      </figcaption>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
