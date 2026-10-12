/**
 * Filters for the contacts and orders lists (Phase 8.5d). They live in the URL so a filtered
 * list can be bookmarked, shared and exported, and a saved view is just a stored copy of them.
 * Pure: shared by the pages, the CSV export routes, bulk actions and tests.
 */

export type ListResource = "contacts" | "orders";

export type ListFilters = {
  q?: string;
  /** Contacts that have ALL of these tags (for orders: the buyer's tags). */
  tags?: string[];
  /** Inclusive dates, YYYY-MM-DD, in UTC. */
  from?: string;
  to?: string;
  /** Source funnel (contacts) or the funnel the order was placed in (orders). */
  funnel?: string;
  status?: string;
  /** Major currency units (e.g. dollars): lifetime spend for contacts, order total for orders. */
  min?: number;
  max?: number;
};

export const CONTACT_STATUSES = ["lead", "customer", "unsubscribed"] as const;
export const ORDER_STATUSES = ["paid", "pending", "failed", "refunded", "partially_refunded"] as const;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const TAG = /^[\p{L}\p{N} _-]{1,40}$/u;

function amount(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? Math.round(n * 100) / 100 : undefined;
}

function validDate(v: unknown): string | undefined {
  if (typeof v !== "string" || !DATE.test(v)) return undefined;
  return Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? undefined : v;
}

/** Normalizes untrusted input (URL params or a stored view): drops anything invalid. */
export function cleanFilters(resource: ListResource, raw: Record<string, unknown>): ListFilters {
  const out: ListFilters = {};
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 100) : "";
  if (q) out.q = q;
  const tagList = Array.isArray(raw.tags)
    ? raw.tags
    : typeof raw.tags === "string"
      ? raw.tags.split(",")
      : typeof raw.tag === "string"
        ? [raw.tag]
        : [];
  const tags = [
    ...new Set(
      tagList
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim().toLowerCase())
        .filter((x) => TAG.test(x)),
    ),
  ].slice(0, 10);
  if (tags.length) out.tags = tags;
  const from = validDate(raw.from);
  const to = validDate(raw.to);
  if (from) out.from = from;
  if (to) out.to = to;
  if (typeof raw.funnel === "string" && UUID.test(raw.funnel)) out.funnel = raw.funnel;
  const statuses: readonly string[] = resource === "contacts" ? CONTACT_STATUSES : ORDER_STATUSES;
  if (typeof raw.status === "string" && statuses.includes(raw.status)) out.status = raw.status;
  const min = amount(raw.min);
  const max = amount(raw.max);
  if (min !== undefined) out.min = min;
  if (max !== undefined) out.max = max;
  return out;
}

/** Reads filters from Next's searchParams. */
export function filtersFromParams(
  resource: ListResource,
  sp: Record<string, string | string[] | undefined>,
): ListFilters {
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  return cleanFilters(resource, flat);
}

/** Query string for the filters (stable key order), without the leading "?". */
export function filtersToQuery(f: ListFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.tags?.length) p.set("tags", f.tags.join(","));
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.funnel) p.set("funnel", f.funnel);
  if (f.status) p.set("status", f.status);
  if (f.min !== undefined) p.set("min", String(f.min));
  if (f.max !== undefined) p.set("max", String(f.max));
  return p.toString();
}

export const hasFilters = (f: ListFilters) => filtersToQuery(f) !== "";

/** Number of active filter chips (search excluded). */
export const activeFilterCount = (f: ListFilters) =>
  (f.tags?.length ?? 0) +
  (f.from || f.to ? 1 : 0) +
  (f.funnel ? 1 : 0) +
  (f.status ? 1 : 0) +
  (f.min !== undefined || f.max !== undefined ? 1 : 0);

/** UTC range for the date filter: [from 00:00, the day after `to` 00:00). */
export function dateRange(f: ListFilters): { start?: Date; end?: Date } {
  const start = f.from ? new Date(`${f.from}T00:00:00Z`) : undefined;
  const end = f.to ? new Date(Date.parse(`${f.to}T00:00:00Z`) + 86_400_000) : undefined;
  return { start, end };
}

/** Major units → cents. */
export const toCents = (v: number | undefined) => (v === undefined ? undefined : Math.round(v * 100));

/** Do two filter sets select the same rows? Used to highlight the active saved view. */
export const sameFilters = (a: ListFilters, b: ListFilters) => filtersToQuery(a) === filtersToQuery(b);
