/**
 * Normalizes user input like "https://Offer.Acme.com/path" to "offer.acme.com".
 * Returns null if it isn't a plausible public hostname.
 */
export function normalizeHostname(input: string): string | null {
  let h = input.trim().toLowerCase();
  h = h
    .replace(/^[a-z]+:\/\//, "")
    .split(/[/?#]/)[0]!
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  if (h.length > 253 || !h.includes(".")) return null;
  const labels = h.split(".");
  if (!labels.every((l) => /^(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(l))) return null;
  if (/^\d+$/.test(labels.at(-1)!)) return null; // IP addresses aren't domains
  return h;
}

/** True if `host` is `root` itself or one of its subdomains. */
export function isUnderDomain(host: string, root: string) {
  const r = root.toLowerCase().replace(/:\d+$/, "");
  return host === r || host.endsWith(`.${r}`);
}
