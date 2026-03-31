import { create } from "zustand";
import type { UiHintsMap } from "@/lib/ui-hints";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ConfigState {
  schema: Record<string, unknown> | null;
  uiHints: UiHintsMap | null;
  rawConfig: string;
  baseHash: string | null;
  editedConfig: string;
  isDirty: boolean;
  saving: boolean;
  conflict: boolean;
  loading: boolean;
  error: string | null;
  activeSection: string | null;
  schemaCache: Map<string, unknown>;
  lookupFallbackMode: boolean;
  /** Remote config snapshot captured when a conflict is detected */
  remoteConfig: string | null;

  fetchSchema: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  setEditedConfig: (raw: string) => void;
  setActiveSection: (section: string | null) => void;
  saveConfig: () => Promise<boolean>;
  reloadConfig: () => Promise<void>;
  lookupSchema: (path: string) => Promise<unknown>;
  /** Resolve conflict by saving a merged config with the latest baseHash */
  resolveConflict: (mergedConfig: Record<string, unknown>) => Promise<boolean>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  schema: null,
  uiHints: null,
  rawConfig: "",
  baseHash: null,
  editedConfig: "",
  isDirty: false,
  saving: false,
  conflict: false,
  loading: false,
  error: null,
  activeSection: null,
  schemaCache: new Map(),
  lookupFallbackMode: false,
  remoteConfig: null,

  fetchSchema: async () => {
    try {
      const res = await fetch("/api/config/schema");
      if (!res.ok) {
        return;
      }
      const data = (await res.json()) as Record<string, unknown>;
      // config.schema returns `{ schema, uiHints, version }` — unwrap.
      set({
        schema: (data.schema as Record<string, unknown>) ?? data,
        uiHints: (data.uiHints as UiHintsMap) ?? null,
      });
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
      const baseHash =
        typeof data.baseHash === "string"
          ? data.baseHash
          : typeof data.hash === "string"
            ? data.hash
            : null;

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
        const isConflict =
          (data.code === "INVALID_REQUEST" &&
            (msg.includes("config changed") || msg.includes("base hash"))) ||
          msg.includes("config changed") ||
          msg.includes("base hash");

        if (isConflict) {
          // Fetch latest remote config for field-level diff in ConflictDialog
          try {
            const remoteRes = await fetch("/api/config");
            if (remoteRes.ok) {
              const remoteData = await remoteRes.json();
              const remoteRaw =
                typeof remoteData.config === "string"
                  ? remoteData.config
                  : JSON.stringify(remoteData.config ?? {}, null, 2);
              const remoteHash =
                typeof remoteData.baseHash === "string"
                  ? remoteData.baseHash
                  : typeof remoteData.hash === "string"
                    ? remoteData.hash
                    : null;
              set({ conflict: true, remoteConfig: remoteRaw, baseHash: remoteHash });
            } else {
              console.error(
                "[config] Remote config fetch failed during conflict:",
                remoteRes.status,
              );
              set({ conflict: true, remoteConfig: null });
            }
          } catch (fetchErr) {
            console.error("[config] Failed to fetch remote config for conflict diff:", fetchErr);
            set({ conflict: true, remoteConfig: null });
          }
          return false;
        }
        set({ error: errorMsg });
        return false;
      }

      // Try to extract new baseHash from save response to avoid race with
      // concurrent config mutations (heartbeat, cron). If the response body
      // includes a baseHash we use it immediately; otherwise fall back to a
      // full reload which has a small window for TOCTOU conflict.
      try {
        const saveData = (await res.json()) as { baseHash?: string };
        if (typeof saveData.baseHash === "string") {
          set({
            rawConfig: editedConfig,
            baseHash: saveData.baseHash,
            isDirty: false,
            conflict: false,
          });
          return true;
        }
      } catch {
        // Response may not be JSON — fall through to reload
      }

      // Fallback: reload full config to get fresh baseHash
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
    set({ conflict: false, remoteConfig: null });
    await get().fetchConfig();
  },

  resolveConflict: async (mergedConfig) => {
    const { baseHash } = get();
    const raw = JSON.stringify(mergedConfig, null, 2);
    set({ saving: true, error: null });
    try {
      const res = await fetch("/api/config/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw, baseHash }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({ error: "Save failed" }))) as {
          error?: string;
          message?: string;
          code?: string;
        };
        const errorMsg = data.error ?? data.message ?? "Merge save failed";
        const msg = errorMsg.toLowerCase();

        // Handle re-conflict: refresh remote config + baseHash so user can retry
        if (msg.includes("config changed") || msg.includes("base hash")) {
          try {
            const remoteRes = await fetch("/api/config");
            if (remoteRes.ok) {
              const remoteData = await remoteRes.json();
              const remoteRaw =
                typeof remoteData.config === "string"
                  ? remoteData.config
                  : JSON.stringify(remoteData.config ?? {}, null, 2);
              const remoteHash =
                typeof remoteData.baseHash === "string"
                  ? remoteData.baseHash
                  : typeof remoteData.hash === "string"
                    ? remoteData.hash
                    : null;
              set({ remoteConfig: remoteRaw, baseHash: remoteHash, error: errorMsg });
            } else {
              console.error(
                "[config] Remote config re-fetch failed during merge conflict:",
                remoteRes.status,
              );
              set({ error: errorMsg });
            }
          } catch (fetchErr) {
            console.error("[config] Failed to refresh remote config during re-conflict:", fetchErr);
            set({ error: errorMsg });
          }
          return false;
        }

        set({ error: errorMsg });
        return false;
      }

      try {
        const saveData = (await res.json()) as { baseHash?: string };
        if (typeof saveData.baseHash === "string") {
          set({
            rawConfig: raw,
            editedConfig: raw,
            baseHash: saveData.baseHash,
            isDirty: false,
            conflict: false,
            remoteConfig: null,
          });
          return true;
        }
      } catch {
        // Fall through to reload
      }

      await get().fetchConfig();
      set({ conflict: false, remoteConfig: null });
      return true;
    } catch {
      set({ error: "Merge save failed" });
      return false;
    } finally {
      set({ saving: false });
    }
  },

  lookupSchema: async (path: string) => {
    if (get().lookupFallbackMode) {
      return null;
    }
    const cached = get().schemaCache.get(path);
    if (cached) {
      return cached;
    }

    try {
      const res = await fetch("/api/config/schema-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (!res.ok) {
        throw new Error("lookup failed");
      }
      const data = await res.json();
      set((state) => {
        const cache = new Map(state.schemaCache);
        cache.set(path, data);
        return { schemaCache: cache };
      });
      return data;
    } catch {
      // Single failed lookup triggers fallback mode for the session
      set({ lookupFallbackMode: true });
      return null;
    }
  },
}));
