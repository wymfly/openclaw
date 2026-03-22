import { create } from "zustand";
import { detectConflicts, type ConflictPair } from "@/lib/detect-conflicts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BindingMatch {
  channel: string;
  accountId?: string;
  peer?: { kind: string; id: string };
  guildId?: string;
  roles?: string[];
  teamId?: string;
}

export interface Binding {
  id: string;
  tier: string;
  match: BindingMatch;
  agentId: string;
  comment?: string;
}

export interface ValidationResult {
  ok: boolean;
  tier?: string;
  conflicts?: Array<{ type: string; bindingId: string; agentId: string; detail: string }>;
}

export interface SimulationTier {
  tier: string;
  matched: boolean;
  checked: boolean;
}

export interface SimulationResult {
  agentId: string;
  matchedBy: string;
  sessionKey: string;
  tiers: SimulationTier[];
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface DeckRoutingState {
  bindings: Binding[];
  configHash: string | null;
  dmScope: string | null;
  loading: boolean;
  error: string | null;

  // Conflict detection
  conflictPairs: ConflictPair[];

  // Simulation state
  simulating: boolean;
  simulationResult: SimulationResult | null;

  // Validation state
  validating: boolean;
  validationResult: ValidationResult | null;

  fetchBindings: (agentId?: string) => Promise<void>;
  addBinding: (
    match: BindingMatch,
    agentId: string,
    baseHash: string,
    position?: number,
  ) => Promise<boolean>;
  removeBinding: (bindingId: string, baseHash: string) => Promise<boolean>;
  validateBinding: (match: BindingMatch, agentId?: string) => Promise<ValidationResult | null>;
  simulate: (params: Record<string, unknown>) => Promise<void>;
  clearSimulation: () => void;
}

export const useDeckRoutingStore = create<DeckRoutingState>((set, get) => ({
  bindings: [],
  configHash: null,
  dmScope: null,
  loading: false,
  error: null,

  conflictPairs: [],
  simulating: false,
  simulationResult: null,
  validating: false,
  validationResult: null,

  fetchBindings: async (agentId?: string) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (agentId) {
        params.set("agentId", agentId);
      }
      const res = await fetch(`/api/deck/routing?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to fetch bindings" }));
        set({ error: (data as { error?: string }).error ?? "Failed to fetch bindings" });
        return;
      }
      const data = await res.json();
      const bindingsArray = Array.isArray(data.bindings) ? data.bindings : [];
      set({
        bindings: bindingsArray,
        configHash: typeof data.configHash === "string" ? data.configHash : null,
        dmScope: typeof data.dmScope === "string" ? data.dmScope : null,
        conflictPairs: detectConflicts(bindingsArray),
      });
    } catch {
      set({ error: "Failed to fetch bindings" });
    } finally {
      set({ loading: false });
    }
  },

  addBinding: async (match, agentId, baseHash, position?) => {
    try {
      const body: Record<string, unknown> = { action: "add", match, agentId, baseHash };
      if (position !== undefined) {
        body.position = position;
      }
      const res = await fetch("/api/deck/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await get().fetchBindings();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  removeBinding: async (bindingId, baseHash) => {
    try {
      const res = await fetch("/api/deck/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", id: bindingId, baseHash }),
      });
      if (res.ok) {
        await get().fetchBindings();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  validateBinding: async (match, agentId) => {
    set({ validating: true, validationResult: null });
    try {
      const res = await fetch("/api/deck/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", match, agentId }),
      });
      if (!res.ok) {
        return null;
      }
      const result = (await res.json()) as ValidationResult;
      set({ validationResult: result });
      return result;
    } catch {
      return null;
    } finally {
      set({ validating: false });
    }
  },

  simulate: async (params) => {
    set({ simulating: true, simulationResult: null });
    try {
      const res = await fetch("/api/deck/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate", ...params }),
      });
      if (!res.ok) {
        return;
      }
      const result = (await res.json()) as SimulationResult;
      set({ simulationResult: result });
    } catch {
      // ignore
    } finally {
      set({ simulating: false });
    }
  },

  clearSimulation: () => set({ simulationResult: null }),
}));
