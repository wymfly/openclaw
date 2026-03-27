import { create } from "zustand";
import { detectConflicts, type ConflictPair } from "@/lib/detect-conflicts";
import type {
  DeckRoutingListResult,
  DeckRoutingValidateResult,
  DeckRoutingSimulateResult,
} from "@/types/gateway-protocol.generated";

// ---------------------------------------------------------------------------
// Types — derived from generated protocol types + local extensions
// ---------------------------------------------------------------------------

/** Binding match with UI-only guild/team aliases (not in gateway response). */
export type BindingMatch = DeckRoutingListResult["bindings"][number]["match"] & {
  /** Alias for guildId — used by some UI components. */
  guild?: string;
  /** Alias for teamId — used by some UI components. */
  team?: string;
};

/** Binding with UI-enriched fields (not in gateway response). */
export type Binding = Omit<DeckRoutingListResult["bindings"][number], "match"> & {
  match: BindingMatch;
  /** Resolved agent display name. */
  agentName?: string;
  /** Resolved agent emoji. */
  agentEmoji?: string;
};

export type ValidationResult = DeckRoutingValidateResult;
export type SimulationTier = DeckRoutingSimulateResult["tiers"][number];
export type SimulationResult = DeckRoutingSimulateResult;

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
  reorderBinding: (binding: Binding, newPosition: number, baseHash: string) => Promise<boolean>;
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

  reorderBinding: async (binding, newPosition, baseHash) => {
    try {
      // Step 1: remove the binding
      const removeRes = await fetch("/api/deck/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove", id: binding.id, baseHash }),
      });
      if (!removeRes.ok) {
        return false;
      }

      // Step 2: fetch updated configHash after removal
      await get().fetchBindings();
      const newHash = get().configHash;
      if (!newHash) {
        return false;
      }

      // Step 3: re-add at the new position using the fresh configHash
      const addRes = await fetch("/api/deck/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          match: binding.match,
          agentId: binding.agentId,
          baseHash: newHash,
          position: newPosition,
        }),
      });
      if (addRes.ok) {
        await get().fetchBindings();
        return true;
      }

      // Add failed — refetch to restore consistent state
      await get().fetchBindings();
      return false;
    } catch {
      await get().fetchBindings();
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
