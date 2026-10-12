"use client";

import { useT } from "@zfunnel/i18n/react";
import { Button } from "@zfunnel/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@zfunnel/ui/dialog";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { cn } from "@zfunnel/ui/lib/utils";
import { toast } from "@zfunnel/ui/toaster";
import { BookmarkIcon, BookmarkPlusIcon, Loader2Icon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  activeFilterCount,
  CONTACT_STATUSES,
  filtersToQuery,
  hasFilters,
  ORDER_STATUSES,
  sameFilters,
  type ListFilters,
  type ListResource,
} from "@/lib/list-filters";
import { deleteView, saveView } from "@/lib/records-actions";

type View = { id: string; name: string; filters: ListFilters };

const field =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Filter bar for the contacts and orders lists (Phase 8.5d): tags, date range, source funnel,
 * status and amount, plus named views saved for the whole workspace. Filters live in the URL.
 */
export function FilterBar({
  workspaceSlug,
  resource,
  filters,
  tags,
  funnels,
  views,
  currency,
  keep = {},
}: {
  workspaceSlug: string;
  resource: ListResource;
  filters: ListFilters;
  tags: string[];
  funnels: { id: string; name: string }[];
  views: View[];
  currency: string;
  /** Extra params to keep when filters change (e.g. a saved segment). */
  keep?: Record<string, string | undefined>;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ListFilters>(filters);
  const statuses: readonly string[] = resource === "contacts" ? CONTACT_STATUSES : ORDER_STATUSES;
  const n = activeFilterCount(filters);

  const go = (f: ListFilters) => {
    const extra = Object.entries(keep).filter(([, v]) => v) as [string, string][];
    const qs = [filtersToQuery(f), new URLSearchParams(extra).toString()].filter(Boolean).join("&");
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const apply = () => {
    go({ ...draft, q: filters.q });
    setOpen(false);
  };
  const remove = (patch: Partial<ListFilters>) => go({ ...filters, ...patch });
  const toggleTag = (tag: string) =>
    setDraft((d) => {
      const has = d.tags?.includes(tag);
      const next = has ? d.tags!.filter((x) => x !== tag) : [...(d.tags ?? []), tag];
      return { ...d, tags: next.length ? next : undefined };
    });
  const funnelName = (id?: string) => funnels.find((f) => f.id === id)?.name ?? t("records.filters.unknownFunnel");
  const statusLabel = (s: string) => t(`records.filters.statuses.${s}` as "records.filters.statuses.paid");

  const chip = "inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs font-medium";
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href={pathname}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors",
            !hasFilters(filters) && !Object.values(keep).some(Boolean)
              ? "border-foreground bg-foreground text-background"
              : "hover:border-foreground/30",
          )}
        >
          {t(resource === "contacts" ? "records.views.allContacts" : "records.views.allOrders")}
        </Link>
        {views.map((v) => {
          const active = sameFilters(v.filters, filters);
          return (
            <span
              key={v.id}
              className={cn(
                "group inline-flex items-center rounded-full border text-xs font-medium",
                active ? "border-brand-orange bg-brand-orange/10 text-brand-orange-text" : "hover:border-foreground/30",
              )}
            >
              <Link
                href={`${pathname}?${filtersToQuery(v.filters)}`}
                className="inline-flex items-center gap-1 py-1 ps-3 pe-1"
              >
                <BookmarkIcon className="size-3" /> {v.name}
              </Link>
              <DeleteViewButton workspaceSlug={workspaceSlug} view={v} />
            </span>
          );
        })}
        <div className="ms-auto flex items-center gap-2">
          {hasFilters(filters) && (
            <SaveViewDialog workspaceSlug={workspaceSlug} resource={resource} filters={filters} />
          )}
          <Button
            variant={open || n ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setDraft(filters);
              setOpen((o) => !o);
            }}
            aria-expanded={open}
            data-testid="filters-toggle"
          >
            <SlidersHorizontalIcon /> {t("records.filters.button")}
            {n > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground tabular-nums">
                {n}
              </span>
            )}
          </Button>
        </div>
      </div>

      {n > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="active-filters">
          {filters.tags?.map((tag) => (
            <span key={tag} className={chip}>
              {t("records.filters.chipTag", { tag })}
              <ChipX
                label={t("records.filters.remove")}
                onClick={() => remove({ tags: filters.tags!.filter((x) => x !== tag) })}
              />
            </span>
          ))}
          {(filters.from || filters.to) && (
            <span className={chip}>
              <span dir="ltr">
                {filters.from ?? "…"} → {filters.to ?? "…"}
              </span>
              <ChipX label={t("records.filters.remove")} onClick={() => remove({ from: undefined, to: undefined })} />
            </span>
          )}
          {filters.funnel && (
            <span className={chip}>
              {t("records.filters.chipFunnel", { name: funnelName(filters.funnel) })}
              <ChipX label={t("records.filters.remove")} onClick={() => remove({ funnel: undefined })} />
            </span>
          )}
          {filters.status && (
            <span className={chip}>
              {statusLabel(filters.status)}
              <ChipX label={t("records.filters.remove")} onClick={() => remove({ status: undefined })} />
            </span>
          )}
          {(filters.min !== undefined || filters.max !== undefined) && (
            <span className={chip}>
              {t("records.filters.chipAmount", {
                min: filters.min ?? "0",
                max: filters.max ?? "∞",
                currency: currency.toUpperCase(),
              })}
              <ChipX label={t("records.filters.remove")} onClick={() => remove({ min: undefined, max: undefined })} />
            </span>
          )}
          <button
            type="button"
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => go({ q: filters.q })}
          >
            {t("records.filters.clearAll")}
          </button>
        </div>
      )}

      {open && (
        <form
          className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
            <Label>{t("records.filters.tags")}</Label>
            {tags.length ? (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const on = draft.tags?.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      aria-pressed={on}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        on ? "border-primary bg-primary text-primary-foreground" : "hover:border-foreground/30",
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("records.filters.noTags")}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-from">{t("records.filters.from")}</Label>
            <input
              id="f-from"
              type="date"
              className={field}
              value={draft.from ?? ""}
              onChange={(e) => setDraft({ ...draft, from: e.target.value || undefined })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-to">{t("records.filters.to")}</Label>
            <input
              id="f-to"
              type="date"
              className={field}
              value={draft.to ?? ""}
              onChange={(e) => setDraft({ ...draft, to: e.target.value || undefined })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-funnel">
              {t(resource === "contacts" ? "records.filters.sourceFunnel" : "records.filters.funnel")}
            </Label>
            <select
              id="f-funnel"
              className={field}
              value={draft.funnel ?? ""}
              onChange={(e) => setDraft({ ...draft, funnel: e.target.value || undefined })}
            >
              <option value="">{t("records.filters.any")}</option>
              {funnels.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-status">{t("records.filters.status")}</Label>
            <select
              id="f-status"
              className={field}
              value={draft.status ?? ""}
              onChange={(e) => setDraft({ ...draft, status: e.target.value || undefined })}
            >
              <option value="">{t("records.filters.any")}</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-min">
              {t(resource === "contacts" ? "records.filters.minSpent" : "records.filters.minTotal", {
                currency: currency.toUpperCase(),
              })}
            </Label>
            <Input
              id="f-min"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              dir="ltr"
              value={draft.min ?? ""}
              onChange={(e) => setDraft({ ...draft, min: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-max">
              {t(resource === "contacts" ? "records.filters.maxSpent" : "records.filters.maxTotal", {
                currency: currency.toUpperCase(),
              })}
            </Label>
            <Input
              id="f-max"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              dir="ltr"
              value={draft.max ?? ""}
              onChange={(e) => setDraft({ ...draft, max: e.target.value === "" ? undefined : Number(e.target.value) })}
            />
          </div>
          <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-2">
            <Button type="button" variant="ghost" onClick={() => setDraft({ q: filters.q })}>
              {t("records.filters.reset")}
            </Button>
            <Button type="submit" data-testid="filters-apply">
              {t("records.filters.apply")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function ChipX({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="rounded-full p-0.5 hover:bg-muted">
      <XIcon className="size-3" />
    </button>
  );
}

function DeleteViewButton({ workspaceSlug, view }: { workspaceSlug: string; view: View }) {
  const t = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={t("records.views.deleteAria", { name: view.name })}
      className="me-1 rounded-full p-0.5 opacity-60 hover:bg-muted hover:opacity-100"
      onClick={() =>
        confirm(t("records.views.deleteConfirm", { name: view.name })) &&
        start(async () => {
          const r = await deleteView(workspaceSlug, view.id);
          if (r.ok) toast.success(r.message ?? "");
          router.refresh();
        })
      }
    >
      <XIcon className="size-3" />
    </button>
  );
}

function SaveViewDialog({
  workspaceSlug,
  resource,
  filters,
}: {
  workspaceSlug: string;
  resource: ListResource;
  filters: ListFilters;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookmarkPlusIcon /> {t("records.views.save")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("records.views.saveTitle")}</DialogTitle>
          <DialogDescription>{t("records.views.saveDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveView(workspaceSlug, resource, name, filters);
              if (r.ok) {
                toast.success(r.message ?? "");
                setOpen(false);
                setName("");
                router.refresh();
              } else toast.error(r.error);
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="view-name">{t("records.views.name")}</Label>
            <Input
              id="view-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("records.views.namePlaceholder")}
              maxLength={60}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy && <Loader2Icon className="animate-spin" />}
              {t("records.views.saveButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
