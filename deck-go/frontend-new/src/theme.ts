import { useEffect, useState } from "react";

export type DeckGoThemeMode = "dark" | "light" | "system";
export type DeckGoResolvedTheme = "dark" | "light";

export const DECK_GO_THEME_TOGGLE_ORDER = ["dark", "light", "system"] as const;
const STORAGE_KEY = "deckGoThemeMode";
const LEGACY_STORAGE_KEY = "openclaw-deck-theme";
const THEME_QUERY = "(prefers-color-scheme: dark)";

function isThemeMode(value: string | null | undefined): value is DeckGoThemeMode {
  return value === "dark" || value === "light" || value === "system";
}

function resolveInitialTheme(): DeckGoThemeMode {
  if (typeof window === "undefined") {
    return "system";
  }
  const stored =
    window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (isThemeMode(stored)) {
    return stored;
  }
  return "system";
}

function resolveSystemTheme(): DeckGoResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia(THEME_QUERY).matches ? "dark" : "light";
}

function resolveTheme(themeMode: DeckGoThemeMode): DeckGoResolvedTheme {
  return themeMode === "system" ? resolveSystemTheme() : themeMode;
}

function applyTheme(themeMode: DeckGoThemeMode, resolvedTheme: DeckGoResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme;
  root.dataset.themeMode = themeMode;
  root.dataset.resolvedTheme = resolvedTheme;
  root.classList.toggle("dark", resolvedTheme === "dark");
  window.localStorage.setItem(STORAGE_KEY, themeMode);
  window.localStorage.setItem(LEGACY_STORAGE_KEY, themeMode);
}

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<DeckGoThemeMode>(resolveInitialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<DeckGoResolvedTheme>(() =>
    resolveTheme(resolveInitialTheme()),
  );

  useEffect(() => {
    const updateResolvedTheme = () => {
      const nextResolvedTheme = resolveTheme(themeMode);
      setResolvedTheme(nextResolvedTheme);
      applyTheme(themeMode, nextResolvedTheme);
    };

    updateResolvedTheme();

    if (themeMode !== "system" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const media = window.matchMedia(THEME_QUERY);
    media.addEventListener("change", updateResolvedTheme);
    return () => media.removeEventListener("change", updateResolvedTheme);
  }, [themeMode]);

  return {
    themeMode,
    resolvedTheme,
    setThemeMode,
    toggleTheme() {
      setThemeMode((current) =>
        current === "dark" ? "light" : current === "light" ? "system" : "dark",
      );
    },
  };
}
