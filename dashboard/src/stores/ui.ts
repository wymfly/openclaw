import { create } from "zustand";
import type { Locale } from "@/i18n/config";
import { locales, defaultLocale } from "@/i18n/config";
import { useConfigStore } from "@/stores/config";

/** Read locale from cookie, falling back to default. */
function readLocaleFromCookie(): Locale {
  if (typeof document === "undefined") {
    return defaultLocale;
  }
  const match = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]*)/);
  const value = match?.[1];
  return value && (locales as readonly string[]).includes(value)
    ? (value as Locale)
    : defaultLocale;
}

export type Panel =
  | "chat"
  | "agents"
  | "gateway"
  | "models"
  | "usage"
  | "sessions"
  | "memory"
  | "logs"
  | "activity"
  | "cron"
  | "webhooks"
  | "approvals"
  | "skills"
  | "budget"
  | "alerts"
  | "channels"
  | "config"
  | "docs"
  | "routing"
  | "subagents"
  | "identity"
  | "threads"
  | "settings";

export type Theme = "dark" | "light" | "system";

interface UIState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  activePanel: Panel;
  theme: Theme;
  locale: Locale;

  canvasVisible: boolean;
  canvasMode: "idle" | "active";

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setActivePanel: (panel: Panel) => void;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
  setCanvasVisible: (visible: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  mobileNavOpen: false,
  activePanel: "chat",
  theme: "system",
  locale: readLocaleFromCookie(),

  canvasVisible: false,
  canvasMode: "idle",

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setActivePanel: (activePanel) => {
    const state = useUIStore.getState();
    if (state.activePanel === "config" && activePanel !== "config") {
      const { isDirty } = useConfigStore.getState();
      if (isDirty && !window.confirm("You have unsaved changes. Discard?")) {
        return;
      }
    }
    set({ activePanel });
  },
  setTheme: (theme) => set({ theme }),
  setLocale: (locale) => {
    set({ locale });
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000`;
    window.location.reload();
  },
  setCanvasVisible: (visible) =>
    set({
      canvasVisible: visible,
      canvasMode: visible ? "active" : "idle",
    }),
}));

// Dev-only: expose store for browser-based functional testing
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__TEST_UI_STORE__ = useUIStore;
}
