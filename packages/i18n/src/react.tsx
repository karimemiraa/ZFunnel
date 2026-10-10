"use client";

import { createContext, useContext, useMemo } from "react";
import { getTranslator, intlLocale, type Locale, type T } from "./index";

const Ctx = createContext<{ locale: Locale; t: T }>({ locale: "en", t: getTranslator("en") });

/** Messages are bundled per locale, so only the locale crosses the server/client boundary. */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: getTranslator(locale) }), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx).t;
export const useLocale = () => useContext(Ctx).locale;
export const useIntlLocale = () => intlLocale(useContext(Ctx).locale);
