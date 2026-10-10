/**
 * Money is stored as integers in the currency's minor unit, like Stripe:
 * cents for USD, yen for JPY (no decimals), fils for KWD (three decimals).
 */
export const CURRENCIES = [
  "usd",
  "eur",
  "gbp",
  "cad",
  "aud",
  "nzd",
  "chf",
  "sek",
  "nok",
  "dkk",
  "pln",
  "czk",
  "jpy",
  "krw",
  "inr",
  "sgd",
  "hkd",
  "mxn",
  "brl",
  "zar",
  "try",
  "egp",
  "mad",
  "sar",
  "aed",
  "qar",
  "kwd",
  "bhd",
  "omr",
  "jod",
] as const;
export type Currency = (typeof CURRENCIES)[number];

const ZERO_DECIMAL = new Set([
  "jpy",
  "krw",
  "bif",
  "clp",
  "djf",
  "gnf",
  "kmf",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);
const THREE_DECIMAL = new Set(["kwd", "bhd", "omr", "jod", "tnd"]);

/** Number of decimals in the currency's minor unit (0, 2 or 3). */
export function minorUnits(currency: string) {
  const c = currency.toLowerCase();
  return ZERO_DECIMAL.has(c) ? 0 : THREE_DECIMAL.has(c) ? 3 : 2;
}

/** Formats a minor-unit amount. Whole amounts drop the decimals ("$47", "€47.50", "¥4,700"). */
export function formatMoney(amount: number, currency: string, locale = "en-US") {
  const units = minorUnits(currency);
  const factor = 10 ** units;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: amount % factor === 0 ? 0 : units,
    maximumFractionDigits: units,
  }).format(amount / factor);
}

/**
 * "49", "49.5", "1,299.99" → minor units for the currency. Returns null for invalid input
 * (including more decimals than the currency has).
 */
export function parseMoney(input: string, currency = "usd"): number | null {
  const units = minorUnits(currency);
  const cleaned = input
    .replace(/[^\d.,]/g, "")
    .replace(/,(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const re = units === 0 ? /^\d+$/ : new RegExp(`^\\d+(\\.\\d{1,${units}})?$`);
  if (!re.test(cleaned)) return null;
  const value = Math.round(Number(cleaned) * 10 ** units);
  // Stripe requires three-decimal amounts to end in 0.
  return units === 3 ? Math.round(value / 10) * 10 : value;
}

/** Smallest price we accept: roughly 0.50 of the major unit (50 for zero-decimal currencies). */
export function minimumAmount(currency: string) {
  const units = minorUnits(currency);
  return units === 0 ? 50 : 10 ** units / 2;
}

/** Sum amounts per currency (never add different currencies together). */
export function sumByCurrency(rows: { amount: number; currency: string }[]) {
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.currency, (out.get(r.currency) ?? 0) + r.amount);
  return [...out.entries()].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => b.amount - a.amount);
}
