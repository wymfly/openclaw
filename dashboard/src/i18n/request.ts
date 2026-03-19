import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, type Locale, locales } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const cookieLocale = (await cookies()).get("NEXT_LOCALE")?.value;

  const candidate = requested ?? cookieLocale;
  const locale: Locale =
    candidate && locales.includes(candidate as Locale) ? (candidate as Locale) : defaultLocale;

  const messages = (await import(`./${locale}.json`)).default as Record<string, unknown>;

  return { locale, messages };
});
