"use server";

import { isLocale } from "@zfunnel/i18n";
import { cookies } from "next/headers";
import { LANG_COOKIE } from "./i18n";

export async function setLanguage(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LANG_COOKIE, locale, { path: "/", maxAge: 365 * 86_400, sameSite: "lax" });
}
