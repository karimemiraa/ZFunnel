import { ROOT_DOMAIN } from "./env";

/** Public URL of a workspace's free subdomain. */
export function siteOrigin(workspaceSlug: string) {
  const proto = ROOT_DOMAIN.startsWith("localhost") ? "http" : "https";
  return `${proto}://${workspaceSlug}.${ROOT_DOMAIN}`;
}

export function stepUrl(workspaceSlug: string, funnelSlug: string, stepSlug: string) {
  return `${siteOrigin(workspaceSlug)}/${funnelSlug}/${stepSlug}`;
}
