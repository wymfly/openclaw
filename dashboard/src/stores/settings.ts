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

export const useSettingsStore = create<SettingsState>((set, get) => ({
  gatewayUrl: "",
  gatewayToken: "",
  notificationPrefs: { approvals: true, budget: true, alerts: true },
  versionInfo: { deck: "", gateway: "", cli: "" },
  loading: false,
  error: null,

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) {
        set({ error: "Failed to fetch settings", loading: false });
        return;
      }
      const data = (await res.json()) as Record<string, unknown>;
      set({
        gatewayUrl: (data.gatewayUrl as string) ?? "",
        gatewayToken: data.gatewayToken ? "••••••" : "",
        notificationPrefs: (data.notificationPrefs as NotificationPrefs) ?? {
          approvals: true,
          budget: true,
          alerts: true,
        },
        loading: false,
      });
    } catch {
      set({ error: "Failed to fetch settings", loading: false });
    }
  },

  saveSettings: async () => {
    const { gatewayUrl, gatewayToken, notificationPrefs } = get();
    set({ error: null });
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gatewayUrl, gatewayToken, notificationPrefs }),
      });
      if (!res.ok) {
        set({ error: "Failed to save settings" });
        return;
      }
      // Re-fetch to confirm persisted state
      await get().fetchSettings();
    } catch {
      set({ error: "Failed to save settings" });
    }
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
    const { gatewayUrl, gatewayToken } = get();
    try {
      const res = await fetch("/api/settings/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: gatewayUrl, token: gatewayToken }),
      });
      const data = (await res.json()) as { ok: boolean };
      return data.ok;
    } catch {
      return false;
    }
  },

  fetchVersionInfo: async () => {
    try {
      const res = await fetch("/api/settings/version");
      if (!res.ok) {
        set({ versionInfo: { deck: "", gateway: "", cli: "" } });
        return;
      }
      const data = (await res.json()) as VersionInfo;
      set({ versionInfo: data });
    } catch {
      set({ versionInfo: { deck: "", gateway: "", cli: "" } });
    }
  },
}));
