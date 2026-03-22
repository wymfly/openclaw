import { create } from "zustand";
import type { Locale } from "@/i18n/config";

export type Panel =
  | "chat"
  | "agents"
  | "routing"
  | "monitor"
  | "models"
  | "subagents"
  | "usage"
  | "sessions"
  | "memory"
  | "logs"
  | "scheduler"
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
  setActivePanel: (activePanel) => set({ activePanel }),
  setTheme: (theme) => set({ theme }),
  setLocale: (locale) => set({ locale }),
}));
