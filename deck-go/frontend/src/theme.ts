import { useEffect, useState } from "react";

export type DeckGoThemeMode = "dark" | "light";

const STORAGE_KEY = "deckGoThemeMode";

function resolveInitialTheme(): DeckGoThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") {
    return stored;
  }
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<DeckGoThemeMode>(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem(STORAGE_KEY, themeMode);
  }, [themeMode]);

  return {
    themeMode,
    setThemeMode,
    toggleTheme() {
      setThemeMode((current) => (current === "dark" ? "light" : "dark"));
    },
  };
}
