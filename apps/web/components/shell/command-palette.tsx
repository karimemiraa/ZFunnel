"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@zfunnel/ui/dialog";
import { useLocale, useT } from "@zfunnel/i18n/react";
import type { MessageKey } from "@zfunnel/i18n";
import { cn } from "@zfunnel/ui/lib/utils";
import {
  ArrowRightLeftIcon,
  BookOpenIcon,
  ClockIcon,
  ContactIcon,
  FileTextIcon,
  FilterIcon,
  LanguagesIcon,
  LoaderIcon,
  type LucideIcon,
  MoonIcon,
  PackageIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { setLanguage } from "@/lib/i18n-actions";
import { CREATE_ITEMS, createHref, NAV_MODULES, navText, SETTINGS_MODULE, SETTINGS_PAGES } from "@/lib/nav";
import { searchWorkspace, type SearchHit } from "@/lib/shell-actions";
import { useShell } from "./shell-provider";
import { readJson, storageKeys, writeJson } from "./storage";

type Section =
  | "recent"
  | "actions"
  | "goTo"
  | "funnels"
  | "pages"
  | "contacts"
  | "orders"
  | "products"
  | "courses"
  | "settings"
  | "workspaces";

type Item = {
  id: string;
  section: Section;
  label: string;
  subtitle?: string;
  icon: LucideIcon;
  href?: string;
  run?: () => void;
  /** Extra words that should match (e.g. the English module name). */
  keywords?: string;
};

type Recent = { id: string; label: string; subtitle?: string; href: string; kind: string };

const HIT_SECTION: Record<SearchHit["kind"], Section> = {
  funnel: "funnels",
  page: "pages",
  contact: "contacts",
  order: "orders",
  product: "products",
  course: "courses",
};
const HIT_ICON: Record<string, LucideIcon> = {
  funnel: FilterIcon,
  page: FileTextIcon,
  contact: ContactIcon,
  order: ReceiptIcon,
  product: PackageIcon,
  course: BookOpenIcon,
  goTo: ArrowRightLeftIcon,
  settings: SettingsIcon,
};
const SECTION_ORDER: Section[] = [
  "recent",
  "funnels",
  "pages",
  "contacts",
  "orders",
  "products",
  "courses",
  "actions",
  "goTo",
  "settings",
  "workspaces",
];
const MAX_RECENT = 6;
const NO_HITS: SearchHit[] = [];
const noSubscribe = () => () => {};
const DEBOUNCE_MS = 200;

/** Case- and diacritic-insensitive match (Arabic tashkeel, Latin accents). */
const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, "");

/**
 * ⌘K / Ctrl+K command palette (ROADMAP 8.3), built on the existing Radix dialog (no new dependency).
 * The input is an ARIA combobox driving a listbox; ↑/↓/Home/End move, Enter opens, Esc closes.
 */
export function CommandPalette() {
  const t = useT();
  const { paletteOpen, setPaletteOpen } = useShell();
  return (
    <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}>
      <DialogContent
        className="top-[12dvh] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 sm:top-[15dvh]"
        data-command-palette
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).querySelector("input")?.focus();
        }}
      >
        <DialogTitle className="sr-only">{t("palette.title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("palette.hint")}</DialogDescription>
        {/* Mounted only while open, so each opening starts fresh. */}
        {paletteOpen && <PaletteBody />}
      </DialogContent>
    </Dialog>
  );
}

function loadRecent(workspaceSlug: string): Recent[] {
  const r = readJson<unknown>(storageKeys.recent(workspaceSlug), []);
  if (!Array.isArray(r)) return [];
  return r
    .filter(
      (x): x is Recent =>
        !!x &&
        typeof x.id === "string" &&
        typeof x.href === "string" &&
        x.href.startsWith(`/${workspaceSlug}`) &&
        typeof x.label === "string",
    )
    .slice(0, MAX_RECENT);
}

function PaletteBody() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { workspaceSlug, workspaceGroups, setPaletteOpen } = useShell();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ q: string; hits: SearchHit[] }>({ q: "", hits: [] });
  const [active, setActive] = useState(0);
  const [recent] = useState(() => loadRecent(workspaceSlug));
  const [, startTransition] = useTransition();
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const base = `/${workspaceSlug}`;
  const q = query.trim();
  const searchable = q.length >= 2;
  const hits = searchable && results.q === q ? results.hits : NO_HITS;
  const loading = searchable && results.q !== q;

  // Debounced, workspace-scoped server search. Stale responses are dropped.
  useEffect(() => {
    if (!searchable) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      let res: SearchHit[] = [];
      try {
        res = await searchWorkspace(workspaceSlug, q);
      } catch {
        // Show "no results" rather than a stuck spinner.
      }
      if (!cancelled) setResults({ q, hits: res });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, searchable, workspaceSlug]);

  const staticItems = useMemo<Item[]>(() => {
    const items: Item[] = [];
    for (const c of CREATE_ITEMS) {
      const what = t(`topbar.createItems.${c.id}` as MessageKey);
      items.push({
        id: `new-${c.id}`,
        section: "actions",
        label: t("palette.newItem", { item: what }),
        icon: PlusIcon,
        href: createHref(workspaceSlug, c),
        keywords: `new create ${c.id}`,
      });
    }
    const dark = resolvedTheme === "dark";
    items.push({
      id: "theme",
      section: "actions",
      label: t("palette.toggleTheme", { theme: t(dark ? "palette.themeLight" : "palette.themeDark") }),
      icon: dark ? SunIcon : MoonIcon,
      run: () => setTheme(dark ? "light" : "dark"),
      keywords: "theme dark light mode",
    });
    items.push({
      id: "language",
      section: "actions",
      label: t("palette.switchLanguage"),
      icon: LanguagesIcon,
      run: () =>
        startTransition(async () => {
          await setLanguage(locale === "ar" ? "en" : "ar");
          router.refresh();
        }),
      keywords: "language arabic english عربي إنجليزي لغة",
    });
    for (const m of [...NAV_MODULES, SETTINGS_MODULE]) {
      const page = navText(t, m.segment, "label");
      items.push({
        id: `go-${m.segment || "overview"}`,
        section: "goTo",
        label: t("palette.goTo", { page }),
        icon: m.icon,
        href: m.segment ? `${base}/${m.segment}` : base,
        keywords: `${page} ${m.segment || "overview home"}`,
      });
    }
    for (const s of SETTINGS_PAGES) {
      items.push({
        id: `settings-${s.key}`,
        section: "settings",
        label: t(`settings.tabs.${s.key}` as MessageKey),
        subtitle: navText(t, "settings", "label"),
        icon: SettingsIcon,
        href: s.path ? `${base}/settings/${s.path}` : `${base}/settings`,
        keywords: `settings ${s.key}`,
      });
    }
    for (const g of workspaceGroups)
      for (const w of g.workspaces)
        if (w.slug !== workspaceSlug)
          items.push({
            id: `ws-${w.slug}`,
            section: "workspaces",
            label: t("palette.switchTo", { name: w.name }),
            subtitle: g.organizationName,
            icon: ArrowRightLeftIcon,
            href: `/${w.slug}`,
            keywords: `workspace switch ${w.name}`,
          });
    return items;
  }, [t, workspaceSlug, workspaceGroups, base, resolvedTheme, setTheme, locale, router]);

  const items = useMemo<Item[]>(() => {
    const q = fold(query.trim());
    if (!q) {
      const recents: Item[] = recent.map((r) => ({
        id: `recent-${r.id}`,
        section: "recent",
        label: r.label,
        subtitle: r.subtitle,
        icon: ClockIcon,
        href: r.href,
      }));
      // Without a query: recents, then create actions, theme/language, and the module jump list.
      const all = [...recents, ...staticItems.filter((i) => i.section !== "settings")];
      return SECTION_ORDER.flatMap((s) => all.filter((i) => i.section === s));
    }
    const terms = q.split(/\s+/);
    const matches = (i: Item) => {
      const hay = fold(`${i.label} ${i.subtitle ?? ""} ${i.keywords ?? ""}`);
      return terms.every((term) => hay.includes(term));
    };
    const found: Item[] = hits.map((h) => ({
      id: `${h.kind}-${h.id}`,
      section: HIT_SECTION[h.kind],
      label: h.kind === "order" ? t("palette.order", { number: h.title }) : h.title,
      subtitle: h.kind === "page" && h.subtitle ? t("palette.inFunnel", { funnel: h.subtitle }) : h.subtitle,
      icon: HIT_ICON[h.kind] ?? SearchIcon,
      href: h.href,
    }));
    const all = [...found, ...staticItems.filter(matches)];
    return SECTION_ORDER.flatMap((s) => all.filter((i) => i.section === s));
  }, [query, recent, staticItems, hits, t]);

  const current = Math.min(active, Math.max(items.length - 1, 0));
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const choose = (item: Item | undefined) => {
    if (!item) return;
    setPaletteOpen(false);
    if (item.href) {
      if (item.section !== "actions" && item.section !== "workspaces") {
        const kind = item.section === "recent" ? "recent" : item.section;
        const entry: Recent = {
          id: item.id.replace(/^recent-/, ""),
          label: item.label,
          subtitle: item.subtitle,
          href: item.href,
          kind,
        };
        const prev = readJson<Recent[]>(storageKeys.recent(workspaceSlug), []);
        writeJson(
          storageKeys.recent(workspaceSlug),
          [entry, ...(Array.isArray(prev) ? prev.filter((r) => r?.id !== entry.id) : [])].slice(0, MAX_RECENT),
        );
      }
      router.push(item.href);
    } else item.run?.();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    const last = items.length - 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(current >= last ? 0 : current + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(current <= 0 ? last : current - 1);
    } else if (e.key === "Home" && e.ctrlKey) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && e.ctrlKey) {
      e.preventDefault();
      setActive(last);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(items[current]);
    }
  };

  const optionId = (i: number) => `${listId}-opt-${i}`;
  const indexOf = new Map(items.map((item, i) => [item.id, i]));
  const sections = SECTION_ORDER.filter((s) => items.some((i) => i.section === s));

  return (
    <>
      <div className="flex items-center gap-2 border-b px-4 pe-12">
        {loading ? (
          <LoaderIcon className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <SearchIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <input
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={items.length ? optionId(current) : undefined}
          aria-label={t("palette.placeholder")}
          placeholder={t("palette.placeholder")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
          spellCheck={false}
          maxLength={100}
          className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={t("palette.results")}
        className="max-h-[min(26rem,60dvh)] overflow-y-auto p-2"
      >
        {items.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground" role="status">
            {loading ? t("palette.searching") : t("palette.noResults", { query: query.trim() })}
          </p>
        )}
        {sections.map((s) => (
          <div key={s} role="group" aria-labelledby={`${listId}-${s}`} className="mb-1">
            <div
              id={`${listId}-${s}`}
              className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
            >
              {t(`palette.sections.${s}` as MessageKey)}
            </div>
            {items
              .filter((i) => i.section === s)
              .map((item) => {
                const i = indexOf.get(item.id) ?? 0;
                const Icon = item.icon;
                const selected = i === current;
                return (
                  <div
                    key={item.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={selected}
                    data-index={i}
                    data-palette-item={item.id}
                    onMouseMove={() => !selected && setActive(i)}
                    onClick={() => choose(item)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm",
                      selected ? "bg-brand-navy/[0.06] text-foreground dark:bg-white/[0.08]" : "text-foreground/90",
                    )}
                  >
                    <Icon
                      className={cn("size-4 shrink-0", selected ? "text-brand-orange-text" : "text-muted-foreground")}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.subtitle && (
                      <span className="max-w-[45%] truncate text-xs text-muted-foreground">{item.subtitle}</span>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
      <div className="hidden border-t px-4 py-2 text-xs text-muted-foreground sm:block">{t("palette.hint")}</div>
    </>
  );
}

/** Top-bar button that opens the palette and shows its shortcut. */
export function PaletteButton() {
  const t = useT();
  const { setPaletteOpen } = useShell();
  const mac = useSyncExternalStore(
    noSubscribe,
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
  return (
    <button
      type="button"
      onClick={() => setPaletteOpen(true)}
      data-palette-button
      aria-keyshortcuts="Meta+K Control+K"
      className="flex h-9 w-full max-w-sm items-center gap-2 rounded-md border bg-background/60 px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:border-brand-orange/50 hover:text-foreground"
    >
      <SearchIcon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate text-start">{t("palette.open")}</span>
      <kbd className="hidden rounded border bg-muted px-1.5 font-sans text-[11px] sm:inline" dir="ltr">
        {mac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  );
}
