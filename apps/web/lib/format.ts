import { getTranslator, intlLocale, type Locale } from "@zfunnel/i18n";
import { formatMoney } from "@zfunnel/payments/money";

type D = Date | string | null | undefined;
const toDate = (d: Exclude<D, null | undefined>) => (typeof d === "string" ? new Date(d) : d);

/** Locale-aware formatters for the dashboard. Arabic uses Western digits (ADR-023). */
export function fmt(locale: Locale = "en") {
  const tag = intlLocale(locale);
  const t = getTranslator(locale);
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
  return {
    /** "3 minutes ago", "yesterday", then a short date. */
    timeAgo(date: D): string {
      if (!date) return t("common.never");
      const d = toDate(date);
      const s = Math.round((d.getTime() - Date.now()) / 1000);
      const abs = Math.abs(s);
      if (abs < 45) return t("common.justNow");
      if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
      if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
      if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), "day");
      return d.toLocaleDateString(tag, { month: "short", day: "numeric", year: "numeric" });
    },
    date: (d: Exclude<D, null | undefined>) =>
      toDate(d).toLocaleDateString(tag, { month: "short", day: "numeric", year: "numeric" }),
    dateTime: (d: Exclude<D, null | undefined>) =>
      toDate(d).toLocaleString(tag, { dateStyle: "medium", timeStyle: "short" }),
    number: (n: number) => n.toLocaleString(tag),
    percent: (ratio: number, digits = 1) =>
      new Intl.NumberFormat(tag, { style: "percent", maximumFractionDigits: digits }).format(ratio),
    money: (amount: number, currency: string) => formatMoney(amount, currency, tag),
  };
}

/** English relative time; prefer `fmt(locale).timeAgo` (or `useFmt()`) in localized screens. */
export const timeAgo = (date: D) => fmt("en").timeAgo(date);
