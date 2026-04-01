"use client";

import { useEffect, useLayoutEffect } from "react";
import { useUIStore } from "@/stores/ui";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Syncs the Zustand theme state to the document class and localStorage.
 * Uses useLayoutEffect to apply the dark class before the browser paints,
 * replacing the previous blocking <script> anti-FOUC approach.
 */
export function ThemeSync() {
  const theme = useUIStore((s) => s.theme);

  // Restore persisted theme on first mount (before paint)
  useIsomorphicLayoutEffect(() => {
    const stored = localStorage.getItem("openclaw-deck-theme");
    if (stored && stored !== theme) {
      useUIStore.setState({ theme: stored as typeof theme });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply resolved theme to DOM
  useIsomorphicLayoutEffect(() => {
    const resolved =
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;

    document.documentElement.classList.toggle("dark", resolved === "dark");
    localStorage.setItem("openclaw-deck-theme", theme);
  }, [theme]);

  // Listen for system theme changes when theme === "system"
  useEffect(() => {
    if (theme !== "system") {
      return;
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return null;
}
