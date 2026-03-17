"use client";

import { useEffect } from "react";
import { useUIStore } from "@/stores/ui";

/**
 * Syncs the Zustand theme state to the document class and localStorage.
 * Render this component once in the layout tree.
 */
export function ThemeSync() {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
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
