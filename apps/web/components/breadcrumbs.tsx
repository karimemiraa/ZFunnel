"use client";

import { useT } from "@zfunnel/i18n/react";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { findModule, navText } from "@/lib/nav";

export type Crumb = { label: string; href?: string };

/** Reusable breadcrumb trail. The last crumb is the current page. Chevrons flip in RTL. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = useT();
  if (items.length < 2) return null;
  return (
    <nav aria-label={t("topbar.breadcrumbs")} className="mb-2" data-breadcrumbs>
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${i}-${c.label}`} className="flex min-w-0 items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="truncate transition-colors hover:text-foreground">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="max-w-[40ch] truncate text-foreground/80">
                  {c.label}
                </span>
              )}
              {!last && <ChevronRightIcon className="size-3 shrink-0 opacity-60 rtl:-scale-x-100" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Breadcrumbs derived from the URL for deep pages (/[workspace]/<module>/<…>): Overview › Module › title.
 * Top-level module pages and Settings (which has its own tabs) show none.
 */
export function AutoBreadcrumbs({ title }: { title: string }) {
  const t = useT();
  const pathname = usePathname();
  const { workspace } = useParams<{ workspace?: string }>();
  if (!workspace) return null;
  const [, , section, ...rest] = pathname.split("/");
  if (!section || rest.length === 0 || section === "settings") return null;
  const mod = findModule(section);
  if (!mod) return null;
  return (
    <Breadcrumbs
      items={[
        { label: navText(t, "", "label"), href: `/${workspace}` },
        { label: navText(t, section, "label"), href: `/${workspace}/${section}` },
        { label: title },
      ]}
    />
  );
}
