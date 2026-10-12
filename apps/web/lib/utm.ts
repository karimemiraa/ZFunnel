/** UTM link builder (8.5e). Pure, shared by the dialog and its tests. */
export const UTM_KEYS = ["source", "medium", "campaign", "term", "content"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type UtmParams = Partial<Record<UtmKey, string>>;

/** Common sources and mediums, offered as suggestions. */
export const UTM_SUGGESTIONS = {
  source: ["facebook", "instagram", "google", "tiktok", "youtube", "newsletter", "whatsapp", "snapchat", "x"],
  medium: ["cpc", "social", "email", "paid_social", "organic", "referral", "qr", "sms"],
} as const;

/** Lower-case, trimmed, spaces → underscores: the convention that keeps analytics reports tidy. */
export function normalizeUtmValue(v: string) {
  return v.trim().replace(/\s+/g, "_").toLowerCase();
}

/**
 * Adds utm_* parameters to a URL. Empty values are left out; existing utm_* parameters are replaced,
 * everything else (other query parameters, the hash) is kept. Returns null for a URL that isn't http(s).
 */
export function buildUtmUrl(base: string, params: UtmParams): string | null {
  let url: URL;
  try {
    url = new URL(base.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  for (const k of UTM_KEYS) {
    const v = normalizeUtmValue(params[k] ?? "");
    if (v) url.searchParams.set(`utm_${k}`, v);
    else url.searchParams.delete(`utm_${k}`);
  }
  return url.toString();
}

/** A safe file name for the QR download, e.g. "qr-sales-page-facebook.png". */
export function qrFileName(stepSlug: string, params: UtmParams, ext: "png" | "svg") {
  const parts = ["qr", stepSlug, params.source, params.campaign]
    .map((p) => normalizeUtmValue(p ?? "").replace(/[^a-z0-9_-]+/g, ""))
    .filter(Boolean);
  return `${parts.join("-").slice(0, 80)}.${ext}`;
}
