import "server-only";

import { getTranslator, isLocale, negotiate, type Locale, type MessageKey, type T } from "@zfunnel/i18n";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { fmt } from "./format";

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

/** Dashboard formatters (dates, money, relative time) in the user's language. */
export async function getFmt() {
  return fmt(await getLocale());
}

/** Translates a message that may be an i18n key (e.g. from a shared zod schema); plain text passes through. */
export function localizeMessage(t: T, message: string | undefined) {
  if (!message) return message;
  return /^[a-z][a-zA-Z]*\.[a-zA-Z.]+$/.test(message) ? t(message as MessageKey) : message;
}
