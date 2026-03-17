import { create } from "zustand";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ConfigState {
  schema: Record<string, unknown> | null;
  rawConfig: string;
  baseHash: string | null;
  editedConfig: string;
  isDirty: boolean;
  saving: boolean;
  conflict: boolean;
  loading: boolean;
  error: string | null;
  activeSection: string | null;

  fetchSchema: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  setEditedConfig: (raw: string) => void;
  setActiveSection: (section: string | null) => void;
  saveConfig: () => Promise<boolean>;
  reloadConfig: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  schema: null,
  rawConfig: "",
  baseHash: null,
  editedConfig: "",
  isDirty: false,
  saving: false,
  conflict: false,
  loading: false,
  error: null,
  activeSection: null,

  fetchSchema: async () => {
    try {
      const res = await fetch("/api/config/schema");
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as Record<string, unknown>;
      // config.schema returns `{ schema, uiHints, version }` — unwrap.
      set({ schema: (data.schema as Record<string, unknown>) ?? data });
    } catch {
      // Schema fetch is best-effort
    }
  },

  fetchConfig: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch("/api/config");
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to fetch config" }));
        set({ error: (data as { error?: string }).error ?? "Failed to fetch config" });
        return;
      }
      const data = await res.json();
      const raw =
        typeof data.config === "string" ? data.config : JSON.stringify(data.config ?? {}, null, 2);
      const baseHash = typeof data.baseHash === "string" ? data.baseHash : null;

      set({
        rawConfig: raw,
        editedConfig: raw,
        baseHash,
        isDirty: false,
        conflict: false,
      });
    } catch {
      set({ error: "Failed to fetch config" });
    } finally {
      set({ loading: false });
    }
  },

  setEditedConfig: (raw) => {
    const { rawConfig } = get();
    set({
      editedConfig: raw,
      isDirty: raw !== rawConfig,
    });
  },

  setActiveSection: (activeSection) => set({ activeSection }),

  saveConfig: async () => {
    const { editedConfig, baseHash } = get();
    set({ saving: true, error: null, conflict: false });
    try {
      const res = await fetch("/api/config/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: editedConfig, baseHash }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({ error: "Save failed" }))) as {
          error?: string;
          message?: string;
          code?: string;
        };
        const errorMsg = data.error ?? data.message ?? "Save failed";

        // Conflict detection: INVALID_REQUEST with config-change-related messages
        const msg = errorMsg.toLowerCase();
        if (
          data.code === "INVALID_REQUEST" &&
          (msg.includes("config changed") || msg.includes("base hash"))
        ) {
          set({ conflict: true });
          return false;
        }
        // Also catch conflict without explicit code, if message matches
        if (msg.includes("config changed") || msg.includes("base hash")) {
          set({ conflict: true });
          return false;
        }
        set({ error: errorMsg });
        return false;
      }

      // After successful save, reload to get fresh baseHash
      await get().fetchConfig();
      return true;
    } catch {
      set({ error: "Save failed" });
      return false;
    } finally {
      set({ saving: false });
    }
  },

  reloadConfig: async () => {
    set({ conflict: false });
    await get().fetchConfig();
  },
}));
