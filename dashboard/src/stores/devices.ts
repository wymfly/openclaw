import { create } from "zustand";
import { fetchApi, DeckApiError } from "@/lib/errors";

export interface DeviceTokenSummary {
  role: string;
  scopes: string[];
  createdAtMs: number;
  rotatedAtMs?: number;
  revokedAtMs?: number;
  lastUsedAtMs?: number;
}

export interface PairedDevice {
  deviceId: string;
  displayName?: string;
  platform?: string;
  deviceFamily?: string;
  clientId?: string;
  clientMode?: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  remoteIp?: string;
  tokens?: DeviceTokenSummary[];
  createdAtMs?: number;
  approvedAtMs?: number;
}

export interface PendingRequest {
  requestId: string;
  deviceId: string;
  displayName?: string;
  platform?: string;
  deviceFamily?: string;
  role?: string;
  roles?: string[];
  scopes?: string[];
  remoteIp?: string;
  ts: number;
}

interface DevicesState {
  pending: PendingRequest[];
  paired: PairedDevice[];
  selfDeviceId: string | null;
  loading: boolean;
  error: string | null;

  fetchDevices: () => Promise<void>;
  fetchSelfDeviceId: () => Promise<void>;
  approveRequest: (requestId: string) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  removeDevice: (deviceId: string) => Promise<void>;
  rotateToken: (deviceId: string, role: string) => Promise<string>;
  revokeToken: (deviceId: string, role: string) => Promise<void>;
}

export const useDevicesStore = create<DevicesState>((set, get) => ({
  pending: [],
  paired: [],
  selfDeviceId: null,
  loading: false,
  error: null,

  fetchDevices: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchApi<{ pending: PendingRequest[]; paired: PairedDevice[] }>(
        "/api/devices",
      );
      set({ pending: data.pending ?? [], paired: data.paired ?? [], loading: false });
    } catch (err) {
      set({
        error: err instanceof DeckApiError ? err.body.error : "Failed to fetch devices",
        loading: false,
      });
    }
  },

  fetchSelfDeviceId: async () => {
    try {
      const data = await fetchApi<{ deviceId: string | null }>("/api/devices/self");
      set({ selfDeviceId: data.deviceId });
    } catch {
      // Non-critical — self-device badge just won't show
    }
  },

  approveRequest: async (requestId) => {
    await fetchApi("/api/devices/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    await get().fetchDevices();
  },

  rejectRequest: async (requestId) => {
    await fetchApi("/api/devices/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    await get().fetchDevices();
  },

  removeDevice: async (deviceId) => {
    await fetchApi("/api/devices/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });
    await get().fetchDevices();
  },

  rotateToken: async (deviceId, role) => {
    const data = await fetchApi<{ token: string }>("/api/devices/token/rotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, role }),
    });
    await get().fetchDevices();
    return data.token;
  },

  revokeToken: async (deviceId, role) => {
    await fetchApi("/api/devices/token/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, role }),
    });
    await get().fetchDevices();
  },
}));
