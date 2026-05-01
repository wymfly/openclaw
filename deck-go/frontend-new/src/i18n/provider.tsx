import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { defaultLocale, locales, type Locale } from "./config";
import { getLocaleMessages, type DeckMessageTree } from "./messages";

const LOCALE_COOKIE = "NEXT_LOCALE";
const LOCALE_STORAGE_KEY = "deckGoLocale";

type TranslationValues = Record<string, string | number | boolean | null | undefined>;

type TranslationFn = ((key: string, values?: TranslationValues) => string) & {
  has: (key: string) => boolean;
};

type IntlContextValue = {
  locale: Locale;
  messages: DeckMessageTree;
  setLocale: (locale: Locale) => void;
};

const IntlContext = createContext<IntlContextValue>({
  locale: defaultLocale,
  messages: getLocaleMessages(defaultLocale),
  setLocale: () => {},
});

function isLocale(value: string | null | undefined): value is Locale {
  return value != null && (locales as readonly string[]).includes(value);
}

function readLocaleCookie(): Locale | null {
  if (typeof document === "undefined") {
    return null;
  }
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]*)/);
  return isLocale(match?.[1]) ? match[1] : null;
}

function readLocaleStorage(): Locale | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return isLocale(value) ? value : null;
}

export function readPersistedLocale(): Locale {
  return readLocaleCookie() ?? readLocaleStorage() ?? defaultLocale;
}

export function persistLocale(locale: Locale) {
  if (typeof document !== "undefined") {
    document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=31536000`;
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}

export function setDeckLocale(locale: Locale) {
  persistLocale(locale);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<Locale>("deckgo-locale-change", { detail: locale }));
  }
}

function readPathValue(messages: DeckMessageTree, path: string): unknown {
  if (!path) {
    return messages;
  }

  const segments = path.split(".");
  let current: unknown = messages;
  for (const segment of segments) {
    if (current == null || typeof current !== "object" || !(segment in current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function interpolateMessage(template: string, values?: TranslationValues): string {
  if (!values) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    return value == null ? `{${key}}` : String(value);
  });
}

function createTranslator(messages: DeckMessageTree, namespace?: string): TranslationFn {
  const resolvePath = (key: string) => (namespace ? `${namespace}.${key}` : key);

  const translator = ((key: string, values?: TranslationValues) => {
    const resolved = readPathValue(messages, resolvePath(key));
    if (typeof resolved === "string") {
      return interpolateMessage(resolved, values);
    }
    if (typeof resolved === "number" || typeof resolved === "boolean") {
      return String(resolved);
    }
    return resolvePath(key);
  }) as TranslationFn;

  translator.has = (key: string) => readPathValue(messages, resolvePath(key)) != null;
  return translator;
}

export type NextIntlClientProviderProps = PropsWithChildren<{
  locale?: Locale;
  messages?: DeckMessageTree;
}>;

export function DeckIntlProvider({ children, locale, messages }: NextIntlClientProviderProps) {
  const [stateLocale, setStateLocale] = useState<Locale>(() => locale ?? readPersistedLocale());
  const resolvedLocale = locale ?? stateLocale;
  const resolvedMessages = messages ?? getLocaleMessages(resolvedLocale);

  useEffect(() => {
    persistLocale(resolvedLocale);
    document.documentElement.lang = resolvedLocale;
  }, [resolvedLocale]);

  useEffect(() => {
    if (locale || typeof window === "undefined") {
      return undefined;
    }
    const handleLocaleChange = (event: Event) => {
      const nextLocale = (event as CustomEvent<Locale>).detail;
      if (isLocale(nextLocale)) {
        setStateLocale(nextLocale);
      }
    };
    window.addEventListener("deckgo-locale-change", handleLocaleChange);
    return () => window.removeEventListener("deckgo-locale-change", handleLocaleChange);
  }, [locale]);

  const value = useMemo<IntlContextValue>(
    () => ({
      locale: resolvedLocale,
      messages: resolvedMessages,
      setLocale: setDeckLocale,
    }),
    [resolvedLocale, resolvedMessages],
  );

  return <IntlContext.Provider value={value}>{children}</IntlContext.Provider>;
}

export function NextIntlClientProvider(props: NextIntlClientProviderProps) {
  return <DeckIntlProvider {...props} />;
}

export function useLocale(): Locale {
  return useContext(IntlContext).locale;
}

export function useSetLocale(): (locale: Locale) => void {
  return useContext(IntlContext).setLocale;
}

export function useTranslations(namespace?: string): TranslationFn {
  const { messages } = useContext(IntlContext);
  return useMemo(() => createTranslator(messages, namespace), [messages, namespace]);
}

export function DeckRoot({ children }: { children: ReactNode }) {
  return <DeckIntlProvider>{children}</DeckIntlProvider>;
}
