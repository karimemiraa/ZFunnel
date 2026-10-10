import { ar } from "./messages/ar";
import { en } from "./messages/en";
import { createTranslator, type Locale, type Paths } from "./core";

export * from "./core";
export type Messages = typeof en;
export type MessageKey = Paths<Messages>;

export const MESSAGES = { en, ar } as const;
export const messagesFor = (l: Locale) => MESSAGES[l];
/** Typed translator for the whole app. */
export const getTranslator = (l: Locale) => createTranslator<Messages>(l, MESSAGES[l]);
export type T = ReturnType<typeof getTranslator>;
