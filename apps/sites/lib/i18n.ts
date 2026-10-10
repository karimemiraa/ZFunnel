import "server-only";

import { getTranslator, type Locale } from "@zfunnel/i18n";
import { currentWorkspace } from "./site";

/** Public pages speak the workspace's site language, not the visitor's. */
export async function siteLocale(): Promise<Locale> {
  return (await currentWorkspace())?.siteLocale ?? "en";
}

export async function getT() {
  return getTranslator(await siteLocale());
}
