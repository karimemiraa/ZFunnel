import Link from "next/link";
import { getT } from "@/lib/i18n";

/** Previous/next links for a filtered list; keeps every other query parameter. */
export async function ListPager({
  base,
  params,
  page,
  pages,
}: {
  base: string;
  params: Record<string, string | undefined>;
  page: number;
  pages: number;
}) {
  if (pages <= 1) return null;
  const t = await getT();
  const href = (p: number) => {
    const q = new URLSearchParams(
      Object.entries({ ...params, page: p > 1 ? String(p) : undefined }).filter(([, v]) => v) as [string, string][],
    ).toString();
    return q ? `${base}?${q}` : base;
  };
  const link = "rounded-md border px-3 py-1.5 font-medium hover:bg-accent";
  const off = "rounded-md border px-3 py-1.5 text-muted-foreground opacity-50";
  return (
    <nav className="mt-4 flex items-center justify-between gap-4 text-sm" aria-label={t("records.pager.label")}>
      {page > 1 ? (
        <Link className={link} href={href(page - 1)} rel="prev">
          {t("records.pager.previous")}
        </Link>
      ) : (
        <span className={off}>{t("records.pager.previous")}</span>
      )}
      <span className="text-muted-foreground tabular-nums">{t("records.pager.page", { page, pages })}</span>
      {page < pages ? (
        <Link className={link} href={href(page + 1)} rel="next">
          {t("records.pager.next")}
        </Link>
      ) : (
        <span className={off}>{t("records.pager.next")}</span>
      )}
    </nav>
  );
}

export const PAGE_SIZE = 50;

/** 1-based page number from `?page=`, clamped. */
export function pageOf(raw: string | string[] | undefined) {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n > 1 && n < 100_000 ? n : 1;
}
