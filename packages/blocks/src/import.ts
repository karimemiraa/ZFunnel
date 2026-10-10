/**
 * Converts a published ClickFunnels (classic or 2.0) page, or plain HTML, into ZFunnel blocks.
 * Pure and synchronous: fetching and image re-hosting happen in the caller (apps/web/lib/importer.ts).
 * Server-only (it pulls in an HTML parser), so it is exported from `@zfunnel/blocks/import`.
 */
import type { ComponentData } from "@puckeditor/core";
import { type ChildNode, type Element, isTag, isText } from "domhandler";
import { getAttributeValue, getOuterHTML, textContent } from "domutils";
import { parseDocument } from "htmlparser2";
import sanitizeHtml from "sanitize-html";
import type { Components, PageData } from "./config";
import { block, columns, page, section } from "./starters";

type Node = ComponentData;
export type ImportedStepType = "optin" | "sales" | "checkout" | "thankyou" | "page";

export type ImportedPage = {
  title: string;
  page: PageData;
  stepType: ImportedStepType;
  /** Absolute URLs of every image the page uses, in order of appearance (for re-hosting). */
  images: string[];
  /** "classic", "cf2" or "generic". */
  source: "classic" | "cf2" | "generic";
  stats: { blocks: number; customHtml: number };
};

const DROP = new Set([
  "script",
  "noscript",
  "style",
  "link",
  "meta",
  "template",
  "head",
  "title",
  "svg",
  "canvas",
  "object",
  "embed",
  "base",
]);
const BLOCKISH = new Set([
  "div",
  "section",
  "article",
  "main",
  "header",
  "footer",
  "aside",
  "nav",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "img",
  "picture",
  "iframe",
  "video",
  "form",
  "table",
  "input",
  "select",
  "textarea",
  "button",
  "figure",
  "blockquote",
  "hr",
]);
const TRACKER_HOSTS =
  /(^|\.)(facebook\.com|facebook\.net|google-analytics\.com|googletagmanager\.com|doubleclick\.net|bing\.com|clarity\.ms|hotjar\.com|linkedin\.com|ads-twitter\.com|t\.co|tiktok\.com|pinterest\.com|snapchat\.com|quantserve\.com|scorecardresearch\.com)$/i;

// ---------- small DOM helpers ----------

const attr = (el: Element, name: string) => getAttributeValue(el, name) ?? "";
const classes = (el: Element) => attr(el, "class").split(/\s+/).filter(Boolean);
const hasClass = (el: Element, re: RegExp) => classes(el).some((c) => re.test(c));
const kids = (el: Element) => el.children.filter((c): c is Element => isTag(c));
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const textOf = (n: ChildNode | ChildNode[]) => clean(textContent(n));

function styleOf(el: Element): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of attr(el, "style").split(";")) {
    const i = decl.indexOf(":");
    if (i > 0) out[decl.slice(0, i).trim().toLowerCase()] = decl.slice(i + 1).trim();
  }
  return out;
}

function find(el: Element, pred: (e: Element) => boolean): Element | null {
  for (const c of kids(el)) {
    if (pred(c)) return c;
    const hit = find(c, pred);
    if (hit) return hit;
  }
  return null;
}
function findAll(el: Element, pred: (e: Element) => boolean, out: Element[] = []): Element[] {
  for (const c of kids(el)) {
    if (pred(c)) out.push(c);
    findAll(c, pred, out);
  }
  return out;
}

/** Element kind according to ClickFunnels markup (lower-case), e.g. "headline", "button", "sectioncontainer". */
function cfKind(el: Element): string {
  const de = attr(el, "data-de-type");
  if (de) return de.toLowerCase().replace(/[^a-z]/g, "");
  const pe = attr(el, "data-page-element");
  if (pe)
    return pe
      .split("/")[0]!
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  return "";
}

/** Normalises CSS colours (hex, rgb, rgba) to #rrggbb; transparent or unknown → "". */
export function toHex(value: string | undefined): string {
  if (!value) return "";
  const v = value.trim().toLowerCase();
  const hex = /#([0-9a-f]{3}|[0-9a-f]{6})\b/.exec(v);
  if (hex) {
    const h = hex[1]!;
    return `#${h.length === 3 ? [...h].map((c) => c + c).join("") : h}`;
  }
  const rgb = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)/.exec(v);
  if (rgb) {
    const alpha = rgb[4] ? parseFloat(rgb[4]) / (rgb[4].endsWith("%") ? 100 : 1) : 1;
    if (alpha < 0.5) return "";
    return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, "0")).join("")}`;
  }
  return "";
}

function alignOf(el: Element, fallback: "left" | "center" | "right"): "left" | "center" | "right" {
  for (let cur: Element | null = el; cur; cur = cur.parent && isTag(cur.parent) ? cur.parent : null) {
    const ta = styleOf(cur)["text-align"];
    if (ta === "center" || ta === "left" || ta === "right") return ta;
    if (ta === "start") return "left";
    if (ta === "end") return "right";
    const c = classes(cur).join(" ");
    if (/(elAlign_center|text-center|align-center|ta-center)/i.test(c)) return "center";
    if (/(elAlign_left|text-left|align-left)/i.test(c)) return "left";
    if (/(elAlign_right|text-right|align-right)/i.test(c)) return "right";
    if (cur.name === "body") break;
  }
  return fallback;
}

// ---------- URLs ----------

export function absUrl(raw: string, base: string): string {
  const v = raw.trim();
  if (!v || v.startsWith("data:") || /^javascript:/i.test(v)) return "";
  try {
    const u = new URL(v, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}

function isTrackerUrl(src: string) {
  try {
    const u = new URL(src);
    return TRACKER_HOSTS.test(u.hostname) || /\/(tr|pixel|track|collect)(\/|\?|$)/i.test(u.pathname);
  } catch {
    return true;
  }
}

function imageSrc(el: Element, base: string) {
  const candidates = [
    attr(el, "data-src"),
    attr(el, "data-lazy-src"),
    attr(el, "src"),
    attr(el, "srcset").split(",")[0]?.trim().split(/\s+/)[0] ?? "",
  ];
  for (const c of candidates) {
    const u = absUrl(c, base);
    if (u) return u;
  }
  return "";
}

function isPixel(el: Element) {
  const w = parseInt(attr(el, "width"), 10);
  const h = parseInt(attr(el, "height"), 10);
  const st = styleOf(el);
  return (w > 0 && w <= 2) || (h > 0 && h <= 2) || st.display === "none" || st.visibility === "hidden";
}

/** Recognises YouTube, Vimeo and Wistia embeds and returns a link the Video block understands. */
export function videoUrl(el: Element, base: string): string {
  const wistiaClass = classes(el).find((c) => /^wistia_async_\w+$/.test(c));
  if (wistiaClass) return `https://fast.wistia.net/embed/iframe/${wistiaClass.slice(13)}`;
  const candidates = [
    attr(el, "src"),
    attr(el, "data-src"),
    attr(el, "data-video-url"),
    attr(el, "data-video-id") ? `https://www.youtube.com/watch?v=${attr(el, "data-video-id")}` : "",
    attr(el, "data-youtube-id") ? `https://www.youtube.com/watch?v=${attr(el, "data-youtube-id")}` : "",
    attr(el, "data-vimeo-id") ? `https://vimeo.com/${attr(el, "data-vimeo-id")}` : "",
    attr(el, "data-wistia-id") ? `https://fast.wistia.net/embed/iframe/${attr(el, "data-wistia-id")}` : "",
  ];
  for (const raw of candidates) {
    const u = absUrl(raw, base);
    if (!u) continue;
    const yt = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/.exec(u);
    if (yt) return `https://www.youtube.com/watch?v=${yt[1]}`;
    const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u);
    if (vimeo) return `https://vimeo.com/${vimeo[1]}`;
    const wistia = /wistia\.(?:com|net)\/(?:medias|embed\/iframe|embed\/medias)\/(\w+)/.exec(u);
    if (wistia) return `https://fast.wistia.net/embed/iframe/${wistia[1]}`;
    if (/\.(mp4|webm|mov)(\?.*)?$/i.test(u)) return u;
  }
  return "";
}

// ---------- sanitizing ----------

const INLINE_TAGS = ["b", "strong", "i", "em", "u", "s", "a", "br", "span", "mark", "small", "sup", "sub"];

function safeHref(href: string, base: string) {
  if (/^mailto:|^tel:/i.test(href.trim())) return href.trim();
  if (href.trim().startsWith("#")) return href.trim();
  return absUrl(href, base);
}

/** Inline rich text for Text blocks: formatting and links only. */
export function sanitizeInline(html: string, base: string): string {
  return sanitizeHtml(html, {
    allowedTags: [...INLINE_TAGS, "p"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          href: safeHref(attribs.href ?? "", base),
          ...(attribs.target === "_blank" ? { target: "_blank", rel: "noopener noreferrer" } : {}),
        },
      }),
      div: "p",
    },
  }).trim();
}

/**
 * Sanitizer for the custom-HTML fallback block: no scripts, event handlers, forms, styles that
 * load resources, or tracking pixels. Iframes are kept only for video hosts. Image sources are
 * made absolute and reported through `onImage` so they can be re-hosted.
 */
export function sanitizeFragment(html: string, base: string, onImage: (src: string) => void = () => {}): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...INLINE_TAGS,
      "p",
      "div",
      "section",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "blockquote",
      "figure",
      "figcaption",
      "hr",
      "img",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "caption",
      "iframe",
      "dl",
      "dt",
      "dd",
      "pre",
      "code",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "frameborder", "title"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
      "*": ["style"],
    },
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i],
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i],
        "text-align": [/^(left|right|center|justify|start|end)$/],
        "font-weight": [/^(bold|normal|[1-9]00)$/],
        "font-style": [/^(italic|normal)$/],
        "text-decoration": [/^(underline|line-through|none)$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowedIframeHostnames: [
      "www.youtube.com",
      "www.youtube-nocookie.com",
      "youtube.com",
      "player.vimeo.com",
      "fast.wistia.net",
      "fast.wistia.com",
    ],
    allowIframeRelativeUrls: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { href: safeHref(attribs.href ?? "", base), target: "_blank", rel: "noopener noreferrer nofollow" },
      }),
      img: (tagName, attribs) => {
        const src = absUrl(attribs["data-src"] || attribs.src || "", base);
        if (src && !isTrackerUrl(src)) onImage(src);
        return { tagName, attribs: { ...attribs, src } };
      },
    },
    exclusiveFilter: (frame) =>
      frame.tag === "img" &&
      (!frame.attribs.src ||
        isTrackerUrl(frame.attribs.src) ||
        Number(frame.attribs.width) <= 2 ||
        Number(frame.attribs.height) <= 2),
  }).trim();
}

// ---------- conversion ----------

type Ctx = {
  base: string;
  source: ImportedPage["source"];
  images: string[];
  customHtml: number;
  hasOptIn: boolean;
  hasOrder: boolean;
  /** Opt-in form currently being assembled from loose ClickFunnels inputs (classic pages have no <form>). */
  form: { node: Node; props: Components["OptInForm"] } | null;
};

const addImage = (ctx: Ctx, src: string) => {
  if (src && !ctx.images.includes(src)) ctx.images.push(src);
};

function isSection(el: Element, ctx: Ctx) {
  const k = cfKind(el);
  if (k === "sectioncontainer" || k === "section") return true;
  if (ctx.source === "classic")
    return hasClass(el, /^container$/) && (attr(el, "id").startsWith("section") || hasClass(el, /Container$/));
  return el.name === "section";
}

function columnKids(el: Element, ctx: Ctx): Element[] | null {
  const k = cfKind(el);
  const children = kids(el);
  let cols: Element[] = [];
  if (k === "rowcontainer" || k === "row") cols = children.filter((c) => /^colcontainer|^col/.test(cfKind(c)));
  else if (hasClass(el, /^row$/) || hasClass(el, /^(columns|grid-row|flex-row)$/))
    cols = children.filter((c) => hasClass(c, /^col(-|$)|^column/) || hasClass(c, /^innerContent$/));
  else if (ctx.source === "generic") {
    const st = styleOf(el);
    if (st.display === "flex" || st.display === "grid") cols = children;
  }
  const meaningful = cols.filter((c) => textOf(c) || find(c, (x) => x.name === "img" || x.name === "iframe"));
  return meaningful.length >= 2 && meaningful.length <= 4 && meaningful.length === cols.length ? cols : null;
}

function headingLevel(tag: string): Components["Heading"]["level"] {
  if (tag === "h1") return "h1";
  if (tag === "h3") return "h3";
  if (/^h[4-6]$/.test(tag)) return "h4";
  return "h2";
}
const SIZE_BY_LEVEL = { h1: "xl", h2: "lg", h3: "md", h4: "sm" } as const;

function heading(el: Element, ctx: Ctx, levelHint?: string): Node | null {
  const inner = find(el, (e) => /^h[1-6]$/.test(e.name)) ?? el;
  const text = textOf(inner);
  if (!text) return null;
  const level = headingLevel(levelHint ?? inner.name);
  return block("Heading", {
    text: text.slice(0, 300),
    level,
    size: SIZE_BY_LEVEL[level],
    align: alignOf(inner, ctx.source === "generic" ? "left" : "center"),
  });
}

function text(el: Element, ctx: Ctx): Node | null {
  if (!textOf(el)) return null;
  const html = sanitizeInline(getOuterHTML(el.children), ctx.base);
  if (!html) return null;
  return block("Text", {
    text: html.startsWith("<p>") ? html : `<p>${html}</p>`,
    align: alignOf(el, ctx.source === "generic" ? "left" : "center"),
  });
}

function buttonFrom(el: Element, ctx: Ctx): Node | null {
  const link =
    el.name === "a" || el.name === "button" ? el : (find(el, (e) => e.name === "a" || e.name === "button") ?? el);
  const mainEl = find(link, (e) => hasClass(e, /^elButtonMain(Text)?$|^elButtonMain/));
  const subEl = find(link, (e) => hasClass(e, /^elButtonSub/));
  const label = clean(mainEl ? textOf(mainEl) : textOf(link).replace(subEl ? textOf(subEl) : "", "")) || "Continue";
  const href = attr(link, "href").trim();
  const props: Partial<Components["Button"]> = {
    label: label.slice(0, 120),
    sublabel: subEl ? textOf(subEl).slice(0, 160) : "",
    align: alignOf(link, ctx.source === "generic" ? "left" : "center"),
  };
  if (/^#(submit|open-popup|cf-|$)/i.test(href) || !href || /^javascript:/i.test(href)) props.action = "next";
  else if (href.startsWith("#")) Object.assign(props, { action: "anchor", anchor: href.slice(1) });
  else {
    const url = absUrl(href, ctx.base);
    Object.assign(props, url ? { action: "url", url, newTab: attr(link, "target") === "_blank" } : { action: "next" });
  }
  return block("Button", props);
}

function image(el: Element, ctx: Ctx): Node | null {
  const img = el.name === "img" ? el : find(el, (e) => e.name === "img");
  if (!img || isPixel(img)) return null;
  const src = imageSrc(img, ctx.base);
  if (!src || isTrackerUrl(src)) return null;
  addImage(ctx, src);
  const w = parseInt(attr(img, "width"), 10);
  return block("Image", {
    src,
    alt: attr(img, "alt").slice(0, 200),
    align: alignOf(img, "center"),
    ...(w > 0 ? { maxWidth: Math.min(1200, w) } : {}),
  });
}

function list(el: Element): Node | null {
  const ul = el.name === "ul" || el.name === "ol" ? el : find(el, (e) => e.name === "ul" || e.name === "ol");
  const items = (ul ? kids(ul).filter((li) => li.name === "li") : [])
    .map((li) => ({ text: textOf(li).slice(0, 300) }))
    .filter((i) => i.text);
  if (!items.length) return null;
  return block("Checklist", { items });
}

function countdown(el: Element): Node {
  const raw =
    attr(el, "data-date") ||
    attr(el, "data-end-date") ||
    attr(el, "data-countdown-date") ||
    attr(el, "data-end") ||
    attr(find(el, (e) => !!attr(e, "data-date")) ?? el, "data-date");
  const time = attr(el, "data-time");
  const d = raw ? new Date(time && !raw.includes("T") ? `${raw} ${time}` : raw) : null;
  const minutes =
    parseInt(attr(el, "data-minutes"), 10) ||
    parseInt(attr(el, "data-evergreen-minutes"), 10) ||
    (parseInt(attr(el, "data-hours"), 10) || 0) * 60 + (parseInt(attr(el, "data-mins"), 10) || 0);
  if (d && !Number.isNaN(d.getTime())) return block("Countdown", { mode: "date", date: d.toISOString().slice(0, 16) });
  return block("Countdown", { mode: "evergreen", minutes: minutes > 0 ? minutes : 15 });
}

function isOrderForm(el: Element) {
  const k = cfKind(el);
  if (/orderform|checkout|creditcard|paymentform|ordersummary|twostep/.test(k)) return true;
  if (hasClass(el, /^el(OrderForm|CreditCard|Checkout|Payment)/i)) return true;
  return !!find(
    el,
    (e) =>
      /^(cc|card|credit|card_number|cc_number|cardnumber|purchase\[)/i.test(attr(e, "name")) ||
      hasClass(e, /^(elCreditCard|StripeElement|elOrderProduct)/),
  );
}

function inputKind(el: Element): "email" | "name" | "phone" | "other" | null {
  if (el.name !== "input" && el.name !== "select" && el.name !== "textarea") return null;
  const type = attr(el, "type").toLowerCase();
  if (["hidden", "submit", "button", "checkbox", "radio"].includes(type)) return null;
  const key = `${attr(el, "name")} ${attr(el, "data-custom-type")} ${attr(el, "placeholder")} ${type}`.toLowerCase();
  if (/e-?mail/.test(key)) return "email";
  if (/phone|tel|mobile/.test(key)) return "phone";
  if (/name/.test(key)) return "name";
  return "other";
}

function submitLabel(el: Element): string {
  const btn = find(
    el,
    (e) =>
      (e.name === "button" && attr(e, "type") !== "button") ||
      (e.name === "input" && attr(e, "type") === "submit") ||
      /^#submit/i.test(attr(e, "href")) ||
      attr(e, "data-on-submit-go-to") !== "" ||
      /submit/i.test(attr(e, "data-action") || ""),
  );
  if (!btn) return "";
  const main = find(btn, (e) => hasClass(e, /^elButtonMain/));
  return clean(main ? textOf(main) : textOf(btn) || attr(btn, "value")).slice(0, 80);
}

function optInFrom(el: Element, ctx: Ctx): Node {
  const fields = findAll(el, (e) => inputKind(e) !== null).map(inputKind);
  const label = submitLabel(el);
  ctx.hasOptIn = true;
  return block("OptInForm", {
    askName: fields.includes("name"),
    askPhone: fields.includes("phone"),
    ...(label ? { buttonLabel: label } : {}),
  });
}

/** Absorbs a loose ClickFunnels input (classic pages) into the opt-in form being assembled. */
function looseInput(el: Element, ctx: Ctx): Node[] {
  const input = el.name === "input" ? el : find(el, (e) => inputKind(e) !== null);
  const kind = input ? inputKind(input) : null;
  if (!kind) return [];
  if (!ctx.form) {
    const node = block("OptInForm", { askName: false, askPhone: false });
    ctx.form = { node, props: node.props as unknown as Components["OptInForm"] };
    ctx.hasOptIn = true;
    if (kind === "name") ctx.form.props.askName = true;
    if (kind === "phone") ctx.form.props.askPhone = true;
    return [node];
  }
  if (kind === "name") ctx.form.props.askName = true;
  if (kind === "phone") ctx.form.props.askPhone = true;
  return [];
}

function custom(el: Element, ctx: Ctx): Node[] {
  const html = sanitizeFragment(getOuterHTML(el), ctx.base, (src) => addImage(ctx, src));
  if (!textContent(parseDocument(html)).trim() && !/<(img|iframe)\s[^>]*src=/.test(html)) return [];
  ctx.customHtml++;
  return [block("CustomHtml", { html: html.slice(0, 50_000) })];
}

function hasBlockChildren(el: Element): boolean {
  return el.children.some((c) => isTag(c) && (BLOCKISH.has(c.name) || hasBlockChildren(c)));
}

/** Converts one element into zero or more blocks (sections are handled by the caller). */
function convert(el: Element, ctx: Ctx): Node[] {
  if (DROP.has(el.name)) return [];
  if (attr(el, "type") === "hidden" || styleOf(el).display === "none") return [];
  if (hasClass(el, /^(elPopup|modal|containerModal|elPageProgress)/) && ctx.source !== "generic") return [];
  const k = cfKind(el);

  // ClickFunnels element types first.
  if (k) {
    if (/^(headline|subheadline)$/.test(k)) {
      const h = heading(el, ctx, k === "subheadline" ? "h3" : undefined);
      return h ? [h] : [];
    }
    if (/^(paragraph|text)$/.test(k)) {
      const t = text(find(el, (e) => hasClass(e, /^elHeadline$|^elText$|^elParagraph/)) ?? el, ctx);
      return t ? [t] : [];
    }
    if (k === "button") {
      if (ctx.form && /^#submit/i.test(attr(find(el, (e) => e.name === "a") ?? el, "href"))) {
        const label = submitLabel(el) || textOf(find(el, (e) => hasClass(e, /^elButtonMain/)) ?? el);
        if (label) ctx.form.props.buttonLabel = label.slice(0, 80);
        return [];
      }
      const b = buttonFrom(el, ctx);
      return b ? [b] : [];
    }
    if (/^(image|imagev?\d*)$/.test(k)) {
      const i = image(el, ctx);
      return i ? [i] : [];
    }
    if (/video/.test(k)) {
      const target = find(el, (e) => !!videoUrl(e, ctx.base));
      const url = videoUrl(el, ctx.base) || (target ? videoUrl(target, ctx.base) : "");
      return url ? [block("Video", { url })] : custom(el, ctx);
    }
    if (/bullet|list/.test(k)) {
      const l = list(el);
      return l ? [l] : [];
    }
    if (/countdown|timer/.test(k)) return [countdown(el)];
    if (/^(input|selectbox|select|textarea|phoneinput|emailinput)$/.test(k)) return looseInput(el, ctx);
    if (/^(divider|spacer)$/.test(k)) return [block(k === "divider" ? "Divider" : "Spacer", {})];
  }

  if (isOrderForm(el) && (el.name === "form" || k)) {
    ctx.hasOrder = true;
    return [block("OrderForm", {})];
  }
  if (el.name === "form") {
    if (isOrderForm(el)) {
      ctx.hasOrder = true;
      return [block("OrderForm", {})];
    }
    if (find(el, (e) => /^h[1-6]$/.test(e.name) || e.name === "img" || e.name === "section")) {
      return convertChildren(el, ctx);
    }
    if (findAll(el, (e) => inputKind(e) === "email").length) {
      if (ctx.form) return [];
      const node = optInFrom(el, ctx);
      return [node];
    }
    return [];
  }

  const cols = columnKids(el, ctx);
  if (cols) {
    const converted = cols.map((c) => convertChildren(c, ctx));
    if (converted.filter((c) => c.length).length >= 2)
      return [
        columns(
          { count: String(Math.min(4, converted.length)) as "2" | "3" | "4", valign: "center" },
          converted.slice(0, 4),
        ),
      ];
    return converted.flat();
  }

  switch (el.name) {
    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const h = heading(el, ctx);
      return h ? [h] : [];
    }
    case "p":
    case "blockquote": {
      if (find(el, (e) => e.name === "img")) return convertChildren(el, ctx);
      const t = text(el, ctx);
      return t ? [t] : [];
    }
    case "img":
    case "picture": {
      const i = image(el, ctx);
      return i ? [i] : [];
    }
    case "ul":
    case "ol": {
      const l = list(el);
      return l ? [l] : [];
    }
    case "iframe":
    case "video": {
      const url = videoUrl(el, ctx.base) || videoUrl(find(el, (e) => e.name === "source") ?? el, ctx.base);
      return url ? [block("Video", { url })] : custom(el, ctx);
    }
    case "hr":
      return [block("Divider", {})];
    case "table":
      return custom(el, ctx);
    case "input":
    case "select":
    case "textarea":
      return looseInput(el, ctx);
    case "a":
    case "button":
      if (hasClass(el, /btn|button|elButton|cta/i) || el.name === "button") {
        if (ctx.form && (el.name === "button" || /^#submit/i.test(attr(el, "href")))) {
          const label = textOf(el);
          if (label) ctx.form.props.buttonLabel = label.slice(0, 80);
          return [];
        }
        const b = buttonFrom(el, ctx);
        return b ? [b] : [];
      }
      break;
  }

  if (videoUrl(el, ctx.base) && hasClass(el, /^wistia_/)) return [block("Video", { url: videoUrl(el, ctx.base) })];

  // Leaf containers with only inline content become text.
  if (!hasBlockChildren(el)) {
    if (["span", "a", "b", "strong", "em", "i", "u", "label", "small", "font"].includes(el.name) && !textOf(el))
      return [];
    if (!textOf(el)) return [];
    const t = text(el, ctx);
    return t ? [t] : [];
  }
  return convertChildren(el, ctx);
}

function convertChildren(el: Element, ctx: Ctx): Node[] {
  const out: Node[] = [];
  let inline: ChildNode[] = [];
  const flushInline = () => {
    const txt = textOf(inline);
    if (txt) {
      const html = sanitizeInline(getOuterHTML(inline), ctx.base);
      if (html) out.push(block("Text", { text: html.startsWith("<p>") ? html : `<p>${html}</p>` }));
    }
    inline = [];
  };
  for (const c of el.children) {
    if (isText(c) || (isTag(c) && !BLOCKISH.has(c.name) && !hasBlockChildren(c) && !cfKind(c) && !isButtonLike(c))) {
      inline.push(c);
      continue;
    }
    flushInline();
    if (isTag(c)) out.push(...convert(c, ctx));
  }
  flushInline();
  return out;
}

const isButtonLike = (el: Element) =>
  (el.name === "a" && hasClass(el, /btn|button|elButton|cta/i)) ||
  el.name === "input" ||
  el.name === "select" ||
  el.name === "textarea";

function sectionProps(el: Element, ctx: Ctx): Partial<Components["Section"]> {
  const candidates = [el, ...kids(el).slice(0, 1), ...kids(kids(el)[0] ?? el).slice(0, 1)];
  for (const c of candidates) {
    const st = styleOf(c);
    const bgImage = /url\((['"]?)([^'")]+)\1\)/.exec(st["background-image"] ?? st.background ?? "");
    if (bgImage) {
      const src = absUrl(bgImage[2]!, ctx.base);
      if (src) {
        addImage(ctx, src);
        return { background: "image", imageUrl: src, overlay: 30 };
      }
    }
    const color = toHex(st["background-color"] ?? st.background);
    if (color) return { background: "custom", customColor: color };
  }
  return {};
}

function detectSource(root: Element): ImportedPage["source"] {
  if (find(root, (e) => !!attr(e, "data-page-element"))) return "cf2";
  if (find(root, (e) => !!attr(e, "data-de-type") || hasClass(e, /^elHeadline$|^elButton$/))) return "classic";
  return "generic";
}

function wrap(nodes: Node[], props: Partial<Components["Section"]> = {}): Node[] {
  return nodes.length ? [section({ padding: "md", ...props }, nodes)] : [];
}

function walkSections(el: Element, ctx: Ctx, out: Node[]) {
  let loose: Node[] = [];
  const flush = () => {
    out.push(...wrap(loose));
    loose = [];
  };
  for (const c of kids(el)) {
    if (DROP.has(c.name)) continue;
    if (isSection(c, ctx)) {
      flush();
      ctx.form = null;
      out.push(...wrap(convertChildren(c, ctx), sectionProps(c, ctx)));
      ctx.form = null;
    } else if (find(c, (e) => isSection(e, ctx))) {
      flush();
      walkSections(c, ctx, out);
    } else loose.push(...convert(c, ctx));
  }
  flush();
}

function countBlocks(nodes: Node[]): number {
  let n = 0;
  for (const node of nodes) {
    n++;
    for (const v of Object.values(node.props ?? {})) if (Array.isArray(v) && v[0]?.type) n += countBlocks(v as Node[]);
  }
  return n;
}

/** Converts a page's HTML into blocks. `pageUrl` resolves relative links and images. */
export function convertHtml(html: string, pageUrl: string): ImportedPage {
  const doc = parseDocument(html, { decodeEntities: true });
  const htmlEl = doc.children.find((c): c is Element => isTag(c) && c.name === "html");
  const body =
    (htmlEl ? kids(htmlEl).find((c) => c.name === "body") : undefined) ??
    ({ type: "tag", name: "body", attribs: {}, children: doc.children, parent: null } as unknown as Element);
  const titleEl = find(doc as unknown as Element, (e) => e.name === "title");
  const ogTitle = find(doc as unknown as Element, (e) => e.name === "meta" && attr(e, "property") === "og:title");
  const title = clean(titleEl ? textOf(titleEl) : attr(ogTitle ?? body, "content")).slice(0, 120);

  const ctx: Ctx = {
    base: pageUrl,
    source: detectSource(body),
    images: [],
    customHtml: 0,
    hasOptIn: false,
    hasOrder: false,
    form: null,
  };
  const content: Node[] = [];
  walkSections(body, ctx, content);

  const lower = `${pageUrl} ${title}`.toLowerCase();
  const stepType: ImportedStepType = ctx.hasOrder
    ? "checkout"
    : ctx.hasOptIn
      ? "optin"
      : /thank|confirm|welcome|شكر/.test(lower)
        ? "thankyou"
        : "sales";
  const pageTitle = title || "Imported page";
  return {
    title: pageTitle,
    page: page(pageTitle, content),
    stepType,
    images: ctx.images,
    source: ctx.source,
    stats: { blocks: countBlocks(content), customHtml: ctx.customHtml },
  };
}

/** Replaces image URLs throughout a page (block props and custom HTML) with their re-hosted copies. */
export function rewriteImages(data: PageData, map: Map<string, string>): PageData {
  if (!map.size) return data;
  let json = JSON.stringify(data);
  for (const [from, to] of map) {
    for (const variant of new Set([from, from.replace(/&/g, "&amp;")])) {
      const needle = JSON.stringify(variant).slice(1, -1);
      json = json.split(needle).join(JSON.stringify(to).slice(1, -1));
    }
  }
  return JSON.parse(json) as PageData;
}
