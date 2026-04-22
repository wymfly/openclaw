import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { mergePluginLocales, getPluginLocaleInventory } from "@/lib/plugin-locales";
import { defaultLocale, type Locale, locales } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;

  const locale: Locale =
    (requested && locales.includes(requested as Locale) ? (requested as Locale) : null) ??
    (cookieLocale && locales.includes(cookieLocale as Locale) ? (cookieLocale as Locale) : null) ??
    defaultLocale;

  const baseMessages = (await import(`./${locale}.json`)).default as Record<string, unknown>;
  const plugins = await getPluginLocaleInventory();
  const messages = mergePluginLocales(baseMessages, plugins, locale);

  return { locale, messages };
});
