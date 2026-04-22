"use client";

import { useState, useEffect } from "react";

/**
 * Reactive hook that tracks a CSS media query.
 * Uses window.matchMedia and listens for changes.
 * Returns false during SSR (no window).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

/** Convenience breakpoint constants */
export const BREAKPOINTS = {
  /** Tablet: 768–1023px */
  tablet: "(min-width: 768px) and (max-width: 1023px)",
  /** Mobile: <768px */
  mobile: "(max-width: 767px)",
  /** Desktop: ≥1024px */
  desktop: "(min-width: 1024px)",
} as const;
