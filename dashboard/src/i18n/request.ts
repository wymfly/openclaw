import { getRequestConfig } from "next-intl/server";
import { defaultLocale, type Locale, locales } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale =
    requested && locales.includes(requested as Locale) ? (requested as Locale) : defaultLocale;

  const messages = (await import(`./${locale}.json`)).default as Record<string, unknown>;

  return { locale, messages };
});
