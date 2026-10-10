import "server-only";

import { getTranslator, isLocale, negotiate, type Locale } from "@zfunnel/i18n";
import { cookies, headers } from "next/headers";
import { cache } from "react";

export const LANG_COOKIE = "zf_lang";

/** Dashboard language: the user's choice (cookie), else the browser's preference. */
export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLocale(c)) return c;
  return negotiate((await headers()).get("accept-language"));
});

export async function getT() {
  return getTranslator(await getLocale());
}
