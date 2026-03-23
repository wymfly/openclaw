import { create } from "zustand";
import type { Locale } from "@/i18n/config";
import { useConfigStore } from "@/stores/config";

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
  | "settings";

export type Theme = "dark" | "light" | "system";

interface UIState {
  sidebarCollapsed: boolean;
  mobileNavOpen: boolean;
  activePanel: Panel;
  theme: Theme;
  locale: Locale;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
  setActivePanel: (panel: Panel) => void;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  mobileNavOpen: false,
  activePanel: "chat",
  theme: "system",
  locale: "zh",

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
}));
