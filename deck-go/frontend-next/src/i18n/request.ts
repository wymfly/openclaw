import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, type Locale, locales } from "./config";
import enMessages from "./en.json";
import zhMessages from "./zh.json";

const localeMessages = {
  en: enMessages,
  zh: zhMessages,
} as const satisfies Record<Locale, Record<string, unknown>>;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;

  const locale: Locale =
    (requested && locales.includes(requested as Locale) ? (requested as Locale) : null) ??
    (cookieLocale && locales.includes(cookieLocale as Locale) ? (cookieLocale as Locale) : null) ??
    defaultLocale;

  const baseMessages = localeMessages[locale];
  return { locale, messages: baseMessages };
});
