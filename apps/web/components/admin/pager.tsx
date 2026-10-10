import Link from "next/link";
import { getT } from "@/lib/i18n";

/** Previous/next links that keep the search query. */
export async function Pager({ base, q, page, pages }: { base: string; q?: string; page: number; pages: number }) {
  if (pages <= 1) return null;
  const t = await getT();
  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `${base}?${s}` : base;
  };
  const link = "rounded-md border px-3 py-1.5 font-medium hover:bg-accent";
  const off = "rounded-md border px-3 py-1.5 text-muted-foreground opacity-50";
  return (
    <div className="mt-4 flex items-center justify-between gap-4 text-sm">
      {page > 1 ? (
        <Link className={link} href={href(page - 1)}>
          {t("admin.orgs.previous")}
        </Link>
      ) : (
        <span className={off}>{t("admin.orgs.previous")}</span>
      )}
      <span className="text-muted-foreground tabular-nums">{t("admin.orgs.page", { page, pages })}</span>
      {page < pages ? (
        <Link className={link} href={href(page + 1)}>
          {t("admin.orgs.next")}
        </Link>
      ) : (
        <span className={off}>{t("admin.orgs.next")}</span>
      )}
    </div>
  );
}
