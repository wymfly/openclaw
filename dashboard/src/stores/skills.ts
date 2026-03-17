import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillStatus = "ready" | "needs-setup" | "disabled";

export interface SkillEntry {
  key: string;
  name: string;
  status: SkillStatus;
  source: "bundled" | "managed" | "plugin";
  enabled: boolean;
  missingRequirements?: string[];
  config?: Record<string, unknown>;
}

export type StatusFilter = SkillStatus | "all";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface SkillsState {
  skills: SkillEntry[];
  selectedSkillKey: string | null;
  statusFilter: StatusFilter;
  loading: boolean;
  error: string | null;

  fetchSkills: (agentId?: string) => Promise<void>;
  updateSkill: (
    skillKey: string,
    patch: { enabled?: boolean; apiKey?: string; env?: Record<string, string> },
  ) => Promise<boolean>;
  installSkill: (name: string) => Promise<boolean>;
  setStatusFilter: (filter: StatusFilter) => void;
  selectSkill: (key: string | null) => void;
}

export const useSkillsStore = create<SkillsState>((set) => ({
  skills: [],
  selectedSkillKey: null,
  statusFilter: "all",
  loading: false,
  error: null,

  selectSkill: (key) => set({ selectedSkillKey: key }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),

  fetchSkills: async (agentId) => {
    set({ loading: true, error: null });
    try {
      const url = agentId ? `/api/skills?agentId=${agentId}` : "/api/skills";
      const res = await fetch(url);
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        set({ error: body.error ?? "Failed to fetch skills", loading: false });
        return;
      }
      const data = (await res.json()) as { skills?: SkillEntry[] };
      set({ skills: data.skills ?? [], loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch skills", loading: false });
    }
  },

  updateSkill: async (skillKey, patch) => {
    try {
      const res = await fetch(`/api/skills/${encodeURIComponent(skillKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        return false;
      }
      const data = (await res.json()) as { ok?: boolean; config?: Record<string, unknown> };
      if (data.ok) {
        set((s) => ({
          skills: s.skills.map((sk) =>
            sk.key === skillKey
              ? {
                  ...sk,
                  enabled: patch.enabled ?? sk.enabled,
                  config: data.config ?? sk.config,
                  status:
                    patch.enabled === false ? "disabled" : patch.enabled ? "ready" : sk.status,
                }
              : sk,
          ),
        }));
      }
      return !!data.ok;
    } catch {
      return false;
    }
  },

  installSkill: async (name) => {
    try {
      const installId = crypto.randomUUID();
      const res = await fetch("/api/skills/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, installId }),
      });
      if (!res.ok) {
        return false;
      }
      const data = (await res.json()) as { ok?: boolean };
      return !!data.ok;
    } catch {
      return false;
    }
  },
}));
