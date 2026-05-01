import type { Locale } from "./config";
import enMessages from "./en.json";
import zhMessages from "./zh.json";

export type DeckMessageTree = Record<string, unknown>;

export const localeMessages = {
  en: enMessages,
  zh: zhMessages,
} as const satisfies Record<Locale, DeckMessageTree>;

export function getLocaleMessages(locale: Locale): DeckMessageTree {
  return localeMessages[locale];
}
