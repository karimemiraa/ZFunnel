import "server-only";

import { headers } from "next/headers";
import { subdomainFromHost } from "./host";
import { resolveCustomDomain, resolveWorkspace } from "./resolve";

export const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "zfunnel.app";

/** Workspace behind a host, including one whose organization is suspended. */
async function lookupHost(rawHost: string | null) {
  if (!rawHost) return null;
  const slug = subdomainFromHost(rawHost, ROOT_DOMAIN);
  if (slug) return resolveWorkspace(slug);
  const host = rawHost.toLowerCase().replace(/:\d+$/, "");
  return resolveCustomDomain(host);
}

/**
 * Workspace for a host: {slug}.ROOT_DOMAIN or a verified custom domain. A suspended
 * organization resolves to nothing, so every page, form and checkout API treats it as unknown.
 */
export async function workspaceForHost(rawHost: string | null) {
  const ws = await lookupHost(rawHost);
  return ws && !ws.suspended ? ws : null;
}

/** Workspace for the current request's Host header. */
export async function currentWorkspace() {
  return workspaceForHost((await headers()).get("host"));
}

/** True when the current host belongs to a suspended organization (shows the neutral "unavailable" page). */
export async function currentHostSuspended() {
  return (await lookupHost((await headers()).get("host")))?.suspended === true;
}
