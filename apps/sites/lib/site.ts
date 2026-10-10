import "server-only";

import { headers } from "next/headers";
import { subdomainFromHost } from "./host";
import { resolveWorkspace } from "./resolve";

export const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "zfunnel.app";

/** Workspace for the current request's Host header (subdomains now; custom domains in Phase 1.5). */
export async function currentWorkspace() {
  const host = (await headers()).get("host");
  const slug = subdomainFromHost(host, ROOT_DOMAIN);
  return slug ? resolveWorkspace(slug) : null;
}
