import "server-only";

import { headers } from "next/headers";
import { subdomainFromHost } from "./host";
import { resolveCustomDomain, resolveWorkspace } from "./resolve";

export const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "zfunnel.app";

export async function workspaceForHost(rawHost: string | null) {
  if (!rawHost) return null;
  const slug = subdomainFromHost(rawHost, ROOT_DOMAIN);
  if (slug) return resolveWorkspace(slug);
  const host = rawHost.toLowerCase().replace(/:\d+$/, "");
  return resolveCustomDomain(host);
}

/** Workspace for the current request's Host header: {slug}.ROOT_DOMAIN or a verified custom domain. */
export async function currentWorkspace() {
  return workspaceForHost((await headers()).get("host"));
}
