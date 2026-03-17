import { create } from "zustand";
import type { Locale } from "@/i18n/config";

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
  activePanel: Panel;
  theme: Theme;
  locale: Locale;

  toggleSidebar: () => void;
  setActivePanel: (panel: Panel) => void;
  setTheme: (theme: Theme) => void;
  setLocale: (locale: Locale) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  activePanel: "chat",
  theme: "system",
  locale: "zh",

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setActivePanel: (activePanel) => set({ activePanel }),
  setTheme: (theme) => set({ theme }),
  setLocale: (locale) => set({ locale }),
}));
