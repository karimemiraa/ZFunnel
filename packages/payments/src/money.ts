export const CURRENCIES = ["usd", "eur", "gbp", "cad", "aud", "chf", "sar", "aed"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function formatMoney(amount: number, currency: string, locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}

/** "49", "49.5", "1,299.99" → cents. Returns null for invalid input. */
export function parseMoney(input: string): number | null {
  const cleaned = input
    .replace(/[^\d.,]/g, "")
    .replace(/,(?=\d{3}\b)/g, "")
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
