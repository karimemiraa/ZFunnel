/**
 * Maps an incoming Host header to a workspace subdomain.
 * Returns null for the bare root domain, nested subdomains, or foreign hosts
 * (custom domains are resolved separately in Phase 1.5).
 */
export function subdomainFromHost(host: string | null | undefined, rootDomain: string): string | null {
  if (!host) return null;
  const h = host.toLowerCase().trim();
  const root = rootDomain.toLowerCase();
  if (!h.endsWith(`.${root}`)) return null;
  const label = h.slice(0, -(root.length + 1));
  if (!label || label.includes(".")) return null;
  return label;
}

/** The platform's own hostnames: the root domain, the dashboard and the CNAME target. */
export function isPlatformHost(host: string, rootDomain: string) {
  const root = rootDomain.toLowerCase().replace(/:\d+$/, "");
  return host === root || host === `app.${root}` || host === `sites.${root}`;
}
