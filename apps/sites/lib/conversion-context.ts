import "server-only";

import type { ConversionContext } from "@zfunnel/queue";
import { clientIp } from "./rate-limit";

const cookie = (header: string, name: string) => {
  const m = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]!).slice(0, 300) : undefined;
};

/** Visitor context for server-side ad conversions: IP, user agent, page and ad click ids. */
export function conversionContext(req: Request): ConversionContext {
  const h = req.headers;
  const c = h.get("cookie") ?? "";
  const ip = clientIp(h);
  // _ga looks like "GA1.1.123456789.1700000000"; the client id is the last two parts.
  const ga = cookie(c, "_ga")?.match(/^GA\d\.\d\.(\d+\.\d+)$/)?.[1];
  return {
    ip: ip === "unknown" ? undefined : ip,
    ua: h.get("user-agent")?.slice(0, 400) ?? undefined,
    url: h.get("referer")?.slice(0, 500) ?? undefined,
    fbp: cookie(c, "_fbp"),
    fbc: cookie(c, "_fbc"),
    ttp: cookie(c, "_ttp"),
    ttclid: cookie(c, "zf_ttclid"),
    gaClientId: ga,
  };
}
