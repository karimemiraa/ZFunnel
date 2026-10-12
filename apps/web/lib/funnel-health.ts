/**
 * Funnel health check (8.5b). Pure: the page loads the data, these functions find issues, score them
 * and compute safe fixes. No database or Next.js imports, so everything here is unit tested.
 */

export type Severity = "critical" | "warning" | "info";

export type HealthRule =
  | "nextMissing"
  | "nextBroken"
  | "declineMissing"
  | "buttonUrlEmpty"
  | "internalLinkBroken"
  | "anchorBroken"
  | "seoTitle"
  | "seoDescription"
  | "ogImage"
  | "imageOversized"
  | "imageNoAlt"
  | "checkoutNoProduct"
  | "upsellNoOffer"
  | "unpublished"
  | "unpublishedChanges"
  | "noFavicon"
  | "noDomain"
  | "formNoAutomation"
  | "mobileFixedWidth"
  | "emptyPage";

/** One-click fixes the dashboard can apply safely (they only fill blanks or link steps). */
export type HealthFix = "seoFromContent" | "linkNext" | "publish";

export type HealthIssue = {
  rule: HealthRule;
  severity: Severity;
  stepId?: string;
  stepName?: string;
  /** Values for the message, e.g. a button label or a size. */
  params?: Record<string, string | number>;
  fix?: HealthFix;
  /** Where to go to fix it by hand, when there's no one-click fix. */
  href?: "editor" | "branding" | "domains" | "automations" | "step";
};

type Node = { type: string; props?: Record<string, unknown> };
export type PageLike = { root?: { props?: Record<string, unknown> }; content?: Node[] };

export type HealthStep = {
  id: string;
  name: string;
  slug: string;
  type: string;
  nextStepId: string | null;
  declineStepId: string | null;
  published: boolean;
  /** The draft changed after the last publish. */
  changed: boolean;
  /** The draft: what the owner is editing and what the next publish ships. */
  page: PageLike;
  /** Offers attached to the step, by role. */
  offers: { main: number; upsell: number };
};

export type HealthInput = {
  funnelSlug: string;
  steps: HealthStep[];
  /** The workspace has a logo, used as the published site's favicon. */
  hasFavicon: boolean;
  /** The workspace has an active custom domain. */
  hasDomain: boolean;
  /** An active automation starts on opt-in or form submission for this funnel (or any funnel). */
  hasFormAutomation: boolean;
  /** Known sizes in bytes of uploaded images, by media id (/api/media/{id}). */
  imageBytes?: Record<string, number>;
};

export const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 20, warning: 6, info: 2 };
/** Images bigger than this slow pages down on mobile data. */
export const MAX_IMAGE_BYTES = 400 * 1024;
/** A fixed width beyond this overflows a phone screen. */
export const MAX_FIXED_WIDTH = 480;

/** Every block in a page, depth first, including blocks inside sections and columns (slots). */
export function blocksOf(page: PageLike): Node[] {
  const out: Node[] = [];
  const visit = (nodes: unknown) => {
    if (!Array.isArray(nodes)) return;
    for (const n of nodes as Node[]) {
      if (!n || typeof n !== "object" || typeof n.type !== "string") continue;
      out.push(n);
      for (const v of Object.values(n.props ?? {}))
        if (Array.isArray(v) && v.some((x) => x && typeof x === "object" && "type" in x && "props" in x)) visit(v);
    }
  };
  visit(page.content);
  return out;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
export const plainText = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** Blocks that send the visitor to the step's "next" path when used. */
const GOES_NEXT = new Set(["OptInForm", "Survey", "OrderForm", "UpsellOffer"]);
const FORMS = new Set(["OptInForm", "Survey"]);
const LANDING = new Set(["optin", "sales", "page"]);
const SELLS_MAIN = new Set(["checkout"]);
const SELLS_UPSELL = new Set(["upsell", "downsell"]);
const MEDIA = /\/api\/media\/([0-9a-f-]{36})/i;

function fixedWidths(html: string): number[] {
  const out: number[] = [];
  for (const m of html.matchAll(/(?:^|[\s;"'{])(?:min-)?width\s*:\s*(\d{3,5})px/gi)) out.push(Number(m[1]));
  for (const m of html.matchAll(/\swidth\s*=\s*["']?(\d{3,5})(?!\d|%)/gi)) out.push(Number(m[1]));
  return out;
}

export function checkFunnel(input: HealthInput): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const ids = new Set(input.steps.map((s) => s.id));
  const paths = new Set(input.steps.map((s) => `/${input.funnelSlug}/${s.slug}`));
  let hasForm = false;

  input.steps.forEach((s, i) => {
    const at = { stepId: s.id, stepName: s.name };
    const blocks = blocksOf(s.page);
    const root = s.page.root?.props ?? {};
    const anchors = new Set(blocks.filter((b) => b.type === "Section").map((b) => str(b.props?.anchor).trim()));
    const following = input.steps[i + 1];

    if (!blocks.length) issues.push({ rule: "emptyPage", severity: "warning", ...at, href: "editor" });

    // Flow: anything that goes "next" needs a next step that exists.
    const nextButtons = blocks.filter(
      (b) => (b.type === "Button" && b.props?.action === "next") || GOES_NEXT.has(b.type),
    );
    if (s.nextStepId && !ids.has(s.nextStepId))
      issues.push({ rule: "nextBroken", severity: "critical", ...at, fix: following ? "linkNext" : undefined });
    else if (!s.nextStepId && nextButtons.length && s.type !== "thankyou")
      issues.push({
        rule: "nextMissing",
        severity: following ? "critical" : "warning",
        ...at,
        params: { count: nextButtons.length },
        fix: following ? "linkNext" : undefined,
        href: following ? undefined : "step",
      });
    if (SELLS_UPSELL.has(s.type) && (!s.declineStepId || !ids.has(s.declineStepId)))
      issues.push({ rule: "declineMissing", severity: "warning", ...at, href: "step" });

    for (const b of blocks) {
      const p = b.props ?? {};
      if (b.type === "Button" && p.action === "url") {
        const url = str(p.url).trim();
        const label = plainText(str(p.label)).slice(0, 40);
        if (!url || url === "#")
          issues.push({ rule: "buttonUrlEmpty", severity: "critical", ...at, params: { label } });
        else if (url.startsWith(`/${input.funnelSlug}/`) && !paths.has(url.split(/[?#]/)[0]!.replace(/\/$/, "")))
          issues.push({ rule: "internalLinkBroken", severity: "critical", ...at, params: { label, url } });
      }
      if (b.type === "Button" && p.action === "anchor") {
        const anchor = str(p.anchor).replace(/^#/, "").trim();
        if (!anchor || !anchors.has(anchor))
          issues.push({
            rule: "anchorBroken",
            severity: "warning",
            ...at,
            params: { label: plainText(str(p.label)).slice(0, 40), anchor },
            href: "editor",
          });
      }
      if (b.type === "Image" && str(p.src)) {
        const id = MEDIA.exec(str(p.src))?.[1];
        const bytes = id ? input.imageBytes?.[id] : undefined;
        if (bytes && bytes > MAX_IMAGE_BYTES)
          issues.push({
            rule: "imageOversized",
            severity: "warning",
            ...at,
            params: { kb: Math.round(bytes / 1024) },
            href: "editor",
          });
        if (!str(p.alt).trim()) issues.push({ rule: "imageNoAlt", severity: "info", ...at, href: "editor" });
      }
      if (b.type === "Section" && p.background === "image") {
        const id = MEDIA.exec(str(p.imageUrl))?.[1];
        const bytes = id ? input.imageBytes?.[id] : undefined;
        if (bytes && bytes > MAX_IMAGE_BYTES)
          issues.push({
            rule: "imageOversized",
            severity: "warning",
            ...at,
            params: { kb: Math.round(bytes / 1024) },
            href: "editor",
          });
      }
      if (b.type === "CustomHtml") {
        const widest = Math.max(0, ...fixedWidths(str(p.html)));
        if (widest > MAX_FIXED_WIDTH)
          issues.push({ rule: "mobileFixedWidth", severity: "warning", ...at, params: { px: widest }, href: "editor" });
      }
      if (FORMS.has(b.type)) hasForm = true;
    }

    // SEO only for pages visitors land on (the first step, opt-in, sales and plain pages); checkout,
    // upsell and thank-you steps are reached through the funnel, not from search or shared links.
    if (i === 0 || LANDING.has(s.type)) {
      const seoFix = seoSuggestion(s.page);
      const fix = (has: unknown) => (has ? ("seoFromContent" as const) : undefined);
      if (!str(root.title).trim())
        issues.push({ rule: "seoTitle", severity: "warning", ...at, fix: fix(seoFix.title) });
      if (!str(root.seoDescription).trim())
        issues.push({ rule: "seoDescription", severity: "warning", ...at, fix: fix(seoFix.seoDescription) });
      if (!str(root.ogImage).trim())
        issues.push({ rule: "ogImage", severity: "info", ...at, fix: fix(seoFix.ogImage) });
    }

    if (SELLS_MAIN.has(s.type) && s.offers.main === 0)
      issues.push({ rule: "checkoutNoProduct", severity: "critical", ...at, href: "step" });
    if (SELLS_UPSELL.has(s.type) && s.offers.upsell === 0)
      issues.push({ rule: "upsellNoOffer", severity: "critical", ...at, href: "step" });

    if (!s.published) issues.push({ rule: "unpublished", severity: "warning", ...at, fix: "publish" });
    else if (s.changed) issues.push({ rule: "unpublishedChanges", severity: "info", ...at, fix: "publish" });
  });

  if (input.steps.length) {
    if (!input.hasFavicon) issues.push({ rule: "noFavicon", severity: "info", href: "branding" });
    if (!input.hasDomain) issues.push({ rule: "noDomain", severity: "info", href: "domains" });
    if (hasForm && !input.hasFormAutomation)
      issues.push({ rule: "formNoAutomation", severity: "info", href: "automations" });
  }

  const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** 0–100: 100 minus weighted issues. Each rule counts at most three times, so one repeated issue can't zero it. */
export function healthScore(issues: HealthIssue[]): number {
  const perRule = new Map<string, number>();
  let penalty = 0;
  for (const i of issues) {
    const n = (perRule.get(i.rule) ?? 0) + 1;
    perRule.set(i.rule, n);
    if (n <= 3) penalty += SEVERITY_WEIGHT[i.severity];
  }
  return Math.max(0, 100 - penalty);
}

export function scoreBand(score: number): "good" | "fair" | "poor" {
  return score >= 85 ? "good" : score >= 60 ? "fair" : "poor";
}

/** SEO values taken from the page itself: the first heading, the first paragraph and the first image. */
export function seoSuggestion(page: PageLike): { title?: string; seoDescription?: string; ogImage?: string } {
  const blocks = blocksOf(page);
  const heading = blocks.find((b) => b.type === "Heading" && plainText(str(b.props?.text)));
  const text = blocks.find((b) => b.type === "Text" && plainText(str(b.props?.text)).length >= 20);
  const image = blocks.find((b) => b.type === "Image" && /^(https?:\/\/|\/)/.test(str(b.props?.src)));
  const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);
  return {
    title: heading ? clip(plainText(str(heading.props!.text)), 60) : undefined,
    seoDescription: text ? clip(plainText(str(text.props!.text)), 155) : undefined,
    ogImage: image ? str(image.props!.src) : undefined,
  };
}

/** Fills only the empty SEO fields of a page from its content. Returns null when nothing changes. */
export function applySeoFix<P extends PageLike>(page: P): P | null {
  const root = { ...(page.root?.props ?? {}) };
  const s = seoSuggestion(page);
  let changed = false;
  for (const k of ["title", "seoDescription", "ogImage"] as const) {
    if (!str(root[k]).trim() && s[k]) {
      root[k] = s[k];
      changed = true;
    }
  }
  return changed ? { ...page, root: { ...page.root, props: root } } : null;
}

/** The step a "link to next" fix points at: the one right after it in the funnel order. */
export function nextStepFor(steps: { id: string }[], stepId: string): string | null {
  const i = steps.findIndex((s) => s.id === stepId);
  return i >= 0 ? (steps[i + 1]?.id ?? null) : null;
}
