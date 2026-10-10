import "server-only";

import { headers } from "next/headers";

/** First supported locale from Accept-Language, e.g. "de-DE"; defaults to en-US. */
export async function visitorLocale() {
  const header = (await headers()).get("accept-language") ?? "";
  for (const part of header.split(",").slice(0, 8)) {
    const tag = part.split(";")[0]!.trim();
    if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/i.test(tag)) continue;
    try {
      if (Intl.NumberFormat.supportedLocalesOf([tag]).length) return tag;
    } catch {
      // Invalid tag: try the next one.
    }
  }
  return "en-US";
}
