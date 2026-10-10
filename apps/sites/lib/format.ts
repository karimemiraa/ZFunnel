import { intlLocale, type Locale } from "@zfunnel/i18n";
import { formatMoney } from "@zfunnel/payments/money";

/** Date and money formatting in the site's language. */
export function siteFormat(locale: Locale) {
  const tag = intlLocale(locale);
  return {
    date: (d: Date) => d.toLocaleDateString(tag, { month: "short", day: "numeric", year: "numeric" }),
    longDate: (d: Date) => d.toLocaleDateString(tag, { month: "long", day: "numeric", year: "numeric" }),
    money: (amount: number, currency: string) => formatMoney(amount, currency, tag),
    dateTime: (d: Date) => d.toLocaleString(tag, { dateStyle: "medium", timeStyle: "short" }),
    /** "5 min. ago" / "قبل 5 د", then a short date after a day. */
    ago: (d: Date, now = Date.now()) => {
      const m = Math.round((now - d.getTime()) / 60_000);
      const rtf = new Intl.RelativeTimeFormat(tag, { style: "narrow", numeric: "auto" });
      if (m < 60) return rtf.format(-Math.max(1, m), "minute");
      if (m < 1440) return rtf.format(-Math.round(m / 60), "hour");
      return d.toLocaleDateString(tag, { month: "short", day: "numeric" });
    },
  };
}
