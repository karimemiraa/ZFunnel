/**
 * Finds the human-written copy in a Puck page so AI can rewrite it, then writes it back.
 * Pure functions (no server deps) so they are unit-tested.
 */
export type CopySlot = { id: string; text: string; html: boolean };

const TEXT_KEYS = new Set([
  "text",
  "label",
  "title",
  "description",
  "headline",
  "subheadline",
  "question",
  "answer",
  "quote",
  "author",
  "role",
  "buttonLabel",
  "successMessage",
  "privacyNote",
  "highlight",
  "expiredText",
]);
const SKIP_TYPES = new Set(["CustomHtml", "Image", "Video", "Spacer", "Divider", "OrderForm", "UpsellOffer"]);
const MAX_SLOTS = 120;

type Node = { type?: string; props?: Record<string, unknown> };

function walk(value: unknown, path: string, out: CopySlot[], inBlock: boolean) {
  if (out.length >= MAX_SLOTS || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => walk(v, `${path}.${i}`, out, inBlock));
    return;
  }
  if (typeof value !== "object") return;
  const node = value as Node;
  if (typeof node.type === "string" && node.props) {
    if (SKIP_TYPES.has(node.type)) return;
    for (const [k, v] of Object.entries(node.props)) {
      if (k === "id") continue;
      const p = `${path}.props.${k}`;
      if (typeof v === "string" && TEXT_KEYS.has(k) && v.trim() && v.length <= 2000)
        out.push({ id: p, text: v, html: /<[a-z][\s\S]*>/i.test(v) });
      else if (typeof v === "object") walk(v, p, out, true);
    }
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const p = path ? `${path}.${k}` : k;
    if (inBlock && typeof v === "string" && TEXT_KEYS.has(k) && v.trim() && v.length <= 2000)
      out.push({ id: p, text: v, html: /<[a-z][\s\S]*>/i.test(v) });
    else if (typeof v === "object") walk(v, p, out, inBlock);
  }
}

export function collectCopy(page: { content?: unknown }): CopySlot[] {
  const out: CopySlot[] = [];
  walk(page.content ?? [], "content", out, false);
  return out;
}

/** Writes replacements back by path; unknown paths and non-string targets are ignored. */
export function applyCopy<T>(page: T, replacements: { id: string; text: string }[]): T {
  const copy = structuredClone(page) as Record<string, unknown>;
  for (const r of replacements) {
    const parts = r.id.split(".");
    let cur: unknown = copy;
    for (const p of parts.slice(0, -1)) {
      if (cur === null || typeof cur !== "object") {
        cur = null;
        break;
      }
      cur = (cur as Record<string, unknown>)[p];
    }
    const last = parts.at(-1)!;
    if (cur && typeof cur === "object" && typeof (cur as Record<string, unknown>)[last] === "string")
      (cur as Record<string, unknown>)[last] = r.text;
  }
  return copy as T;
}
