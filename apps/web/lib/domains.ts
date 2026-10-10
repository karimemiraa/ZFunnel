import "server-only";

import { Resolver } from "node:dns/promises";

/** Where customers point their domains (shown in the DNS instructions). */
export const SITES_CNAME_TARGET =
  process.env.SITES_CNAME_TARGET ?? `sites.${(process.env.ROOT_DOMAIN ?? "zfunnel.app").replace(/:\d+$/, "")}`;
/** For apex domains (acme.com), which can't use CNAME: an A record to the server. */
export const SITES_IPV4 = process.env.SITES_IPV4 ?? "";

export type DnsCheck = { ownership: boolean; routing: boolean; problems: string[] };

type Lookup = Pick<Resolver, "resolveTxt" | "resolveCname" | "resolve4">;

const swallow = async <T>(p: Promise<T>, fallback: T) => {
  try {
    return await p;
  } catch {
    return fallback;
  }
};

/** Checks the TXT ownership record and that the domain actually points at us. */
export async function checkDomainDns(
  hostname: string,
  token: string,
  resolver: Lookup = defaultResolver(),
): Promise<DnsCheck> {
  const problems: string[] = [];
  const txt = (await swallow(resolver.resolveTxt(`_zfunnel.${hostname}`), [] as string[][])).map((r) => r.join(""));
  const ownership = txt.includes(token);
  if (!ownership) problems.push(`TXT record _zfunnel.${hostname} with value ${token} not found yet.`);

  const cnames = (await swallow(resolver.resolveCname(hostname), [] as string[])).map((c) =>
    c.replace(/\.$/, "").toLowerCase(),
  );
  let routing = cnames.includes(SITES_CNAME_TARGET);
  if (!routing && SITES_IPV4) {
    const ips = await swallow(resolver.resolve4(hostname), [] as string[]);
    routing = ips.includes(SITES_IPV4);
  }
  if (!routing)
    problems.push(
      SITES_IPV4
        ? `Point ${hostname} to ${SITES_CNAME_TARGET} (CNAME) or ${SITES_IPV4} (A record).`
        : `Point ${hostname} to ${SITES_CNAME_TARGET} with a CNAME record.`,
    );
  return { ownership, routing, problems };
}

function defaultResolver() {
  const r = new Resolver({ timeout: 4000, tries: 2 });
  // Public resolvers see changes faster than some local caches.
  r.setServers(["1.1.1.1", "8.8.8.8"]);
  return r;
}
