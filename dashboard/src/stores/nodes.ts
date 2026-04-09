import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types — from gateway-protocol.generated.ts node.* result shapes
// ---------------------------------------------------------------------------

export interface NodeSummary {
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  uiVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  remoteIp?: string;
  caps: string[];
  commands: string[];
  pathEnv?: string;
  permissions?: Record<string, boolean>;
  connectedAtMs?: number;
  paired: boolean;
  connected: boolean;
}

export interface PairingRequest {
  requestId: string;
  nodeId: string;
  displayName?: string;
  platform?: string;
  silent?: boolean;
  isRepair?: boolean;
  ts: number;
}

interface NodesState {
  nodes: NodeSummary[];
  pairingRequests: PairingRequest[];
  selectedNodeId: string | null;
  loading: boolean;
  error: string | null;
}

interface NodesActions {
  fetchNodes: () => Promise<void>;
  fetchPairing: () => Promise<void>;
  selectNode: (id: string | null) => void;
  describeNode: (nodeId: string) => Promise<NodeSummary | null>;
  renameNode: (nodeId: string, displayName: string) => Promise<boolean>;
  approvePairing: (requestId: string) => Promise<boolean>;
  rejectPairing: (requestId: string) => Promise<boolean>;
}

export const useNodesStore = create<NodesState & NodesActions>((set, get) => ({
  nodes: [],
  pairingRequests: [],
  selectedNodeId: null,
  loading: false,
  error: null,

  fetchNodes: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/nodes");
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Request failed" }));
        set({ loading: false, error: (body as { error?: string }).error ?? "Request failed" });
        return;
      }
      const data = (await res.json()) as { nodes?: NodeSummary[] };
      set({ nodes: data.nodes ?? [], loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Unknown error" });
    }
  },

  fetchPairing: async () => {
    try {
      const res = await fetch("/api/nodes/pair");
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as { pending?: PairingRequest[] };
      set({ pairingRequests: data.pending ?? [] });
    } catch {
      // Non-critical — silently ignore
    }
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  describeNode: async (nodeId) => {
    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "describe", nodeId }),
      });
      if (!res.ok) {
        return null;
      }
      return (await res.json()) as NodeSummary;
    } catch {
      return null;
    }
  },

  renameNode: async (nodeId, displayName) => {
    try {
      const res = await fetch("/api/nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", nodeId, displayName }),
      });
      if (res.ok) {
        await get().fetchNodes();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  approvePairing: async (requestId) => {
    try {
      const res = await fetch("/api/nodes/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", requestId }),
      });
      if (res.ok) {
        await Promise.all([get().fetchNodes(), get().fetchPairing()]);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  rejectPairing: async (requestId) => {
    try {
      const res = await fetch("/api/nodes/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", requestId }),
      });
      if (res.ok) {
        await get().fetchPairing();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));
