"use client";

import { useLocale } from "@zfunnel/i18n/react";
import { useMemo } from "react";
import { fmt } from "./format";

/** Dashboard formatters in the user's language (client components). */
export function useFmt() {
  const locale = useLocale();
  return useMemo(() => fmt(locale), [locale]);
}
