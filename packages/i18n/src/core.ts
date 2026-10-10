export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const isLocale = (v: unknown): v is Locale =>
  typeof v === "string" && (LOCALES as readonly string[]).includes(v);
export const dir = (l: Locale) => (l === "ar" ? "rtl" : "ltr");
/** BCP-47 tag for Intl. Arabic uses Western digits (ADR-023). */
export const intlLocale = (l: Locale) => (l === "ar" ? "ar-u-nu-latn" : "en-US");
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية" };

/** A count-dependent message. Arabic uses zero/one/two/few/many/other. */
export type Plural = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>;

/** Same keys as `T`, with every plural leaf allowed any plural forms (Arabic needs more). */
export type Shape<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends { other: string } ? Plural : Shape<T[K]>;
};

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Prev = [never, 0, 1, 2, 3, 4, 5];
/** Dotted keys of all leaves (strings and plurals), up to 6 levels deep. */
export type Paths<T, D extends number = 6> = [D] extends [never]
  ? never
  : {
      [K in keyof T & string]: T[K] extends string | { other: string } ? K : Join<K, Paths<T[K], Prev[D]>>;
    }[keyof T & string];

export type Vars = Record<string, string | number>;

const isPlural = (v: unknown): v is Plural => typeof v === "object" && v !== null && "other" in v;

/** Builds a translator. `{name}` placeholders; `count` picks the plural form. Missing keys show the key. */
export function createTranslator<M extends object>(locale: Locale, messages: object) {
  const rules = new Intl.PluralRules(intlLocale(locale));
  const cache = new Map<string, unknown>();
  const lookup = (key: string): unknown => {
    if (cache.has(key)) return cache.get(key);
    let node: unknown = messages;
    for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
    cache.set(key, node);
    return node;
  };
  const nf = new Intl.NumberFormat(intlLocale(locale));
  return function t(key: Paths<M> & string, vars?: Vars): string {
    let node = lookup(key);
    if (isPlural(node)) {
      const n = Number(vars?.count ?? 0);
      // Exact 0/1/2 forms first when provided ("no items", "one item", "two items").
      const exact = n === 0 ? "zero" : n === 1 ? "one" : n === 2 ? "two" : null;
      node = (exact && node[exact as Intl.LDMLPluralRule]) || node[rules.select(n)] || node.other;
    }
    if (typeof node !== "string") return key;
    return vars
      ? node.replace(/\{(\w+)\}/g, (m, k: string) =>
          k in vars ? (typeof vars[k] === "number" ? nf.format(vars[k] as number) : String(vars[k])) : m,
        )
      : node;
  };
}

/** Picks the best supported locale from an Accept-Language header. */
export function negotiate(header: string | null | undefined): Locale {
  for (const part of (header ?? "").split(",")) {
    const tag = part.split(";")[0]!.trim().toLowerCase().slice(0, 2);
    if (isLocale(tag)) return tag;
  }
  return DEFAULT_LOCALE;
}
