import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationPrefs {
  approvals: boolean;
  budget: boolean;
  alerts: boolean;
}

export interface VersionInfo {
  deck: string;
  gateway: string;
  cli: string;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface SettingsState {
  gatewayUrl: string;
  gatewayToken: string;
  notificationPrefs: NotificationPrefs;
  versionInfo: VersionInfo;
  loading: boolean;
  error: string | null;

  fetchSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  setGatewayUrl: (url: string) => void;
  setGatewayToken: (token: string) => void;
  setNotificationPrefs: (prefs: Partial<NotificationPrefs>) => void;
  testConnection: () => Promise<boolean>;
  fetchVersionInfo: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  gatewayUrl: "",
  gatewayToken: "",
  notificationPrefs: { approvals: true, budget: true, alerts: true },
  versionInfo: { deck: "", gateway: "", cli: "" },
  loading: false,
  error: null,

  fetchSettings: async () => {
    /* T4 */
  },

  saveSettings: async () => {
    /* T4 */
  },

  setGatewayUrl: (url) => {
    set({ gatewayUrl: url });
  },

  setGatewayToken: (token) => {
    set({ gatewayToken: token });
  },

  setNotificationPrefs: (prefs) => {
    set((state) => ({
      notificationPrefs: { ...state.notificationPrefs, ...prefs },
    }));
  },

  testConnection: async () => {
    /* T4 */
    return false;
  },

  fetchVersionInfo: async () => {
    /* T4 */
  },
}));
