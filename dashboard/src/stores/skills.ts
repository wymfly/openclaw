import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillStatus = "ready" | "needs-setup" | "disabled";

export interface SkillInstallOption {
  id: string;
  kind: string;
  label: string;
  bins: string[];
}

export interface SkillEntry {
  key: string;
  name: string;
  description: string;
  emoji?: string;
  homepage?: string;
  primaryEnv?: string;
  status: SkillStatus;
  source: "bundled" | "managed" | "plugin";
  enabled: boolean;
  missingRequirements?: string[];
  installOptions?: SkillInstallOption[];
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
  searchQuery: string;
  loading: boolean;
  error: string | null;

  fetchSkills: (agentId?: string) => Promise<void>;
  updateSkill: (
    skillKey: string,
    patch: { enabled?: boolean; apiKey?: string; env?: Record<string, string> },
  ) => Promise<boolean>;
  installSkill: (name: string, installId: string) => Promise<boolean>;
  setStatusFilter: (filter: StatusFilter) => void;
  setSearchQuery: (query: string) => void;
  selectSkill: (key: string | null) => void;
}

// ---------------------------------------------------------------------------
// Normalization — Gateway `skills.status` returns a different shape than the
// frontend SkillEntry.  Map `{ skillKey, disabled, eligible, missing, ... }`
// to the canonical `{ key, name, status, source, enabled, ... }` shape.
// ---------------------------------------------------------------------------

const VALID_SOURCES = new Set<SkillEntry["source"]>(["bundled", "managed", "plugin"]);

function normalizeSkill(raw: Record<string, unknown>): SkillEntry {
  const skillKey =
    typeof raw.skillKey === "string" ? raw.skillKey : typeof raw.name === "string" ? raw.name : "";
  const disabled = raw.disabled === true;
  const eligible = raw.eligible !== false;
  const hasMissing = Array.isArray(raw.missing) && raw.missing.length > 0;

  let status: SkillStatus = "ready";
  if (disabled) {
    status = "disabled";
  } else if (hasMissing || !eligible) {
    status = "needs-setup";
  }

  const rawSource = typeof raw.source === "string" ? raw.source : "bundled";

  const description = typeof raw.description === "string" ? raw.description : "";
  const emoji = typeof raw.emoji === "string" ? raw.emoji : undefined;
  const homepage = typeof raw.homepage === "string" ? raw.homepage : undefined;
  const primaryEnv = typeof raw.primaryEnv === "string" ? raw.primaryEnv : undefined;

  let installOptions: SkillInstallOption[] | undefined;
  if (Array.isArray(raw.install) && raw.install.length > 0) {
    installOptions = (raw.install as Record<string, unknown>[])
      .filter((i) => typeof i.id === "string" && typeof i.label === "string")
      .map((i) => ({
        id: i.id as string,
        kind: typeof i.kind === "string" ? i.kind : "unknown",
        label: i.label as string,
        bins: Array.isArray(i.bins) ? (i.bins as string[]) : [],
      }));
    if (installOptions.length === 0) {
      installOptions = undefined;
    }
  }

  return {
    key: typeof raw.key === "string" ? raw.key : skillKey,
    name: typeof raw.name === "string" ? raw.name : skillKey,
    description,
    emoji,
    homepage,
    primaryEnv,
    status,
    source: VALID_SOURCES.has(rawSource as SkillEntry["source"])
      ? (rawSource as SkillEntry["source"])
      : "bundled",
    enabled: !disabled,
    missingRequirements: Array.isArray(raw.missing) ? (raw.missing as string[]) : undefined,
    installOptions,
    config:
      typeof raw.config === "object" && raw.config !== null
        ? (raw.config as Record<string, unknown>)
        : undefined,
  };
}

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  selectedSkillKey: null,
  statusFilter: "all",
  searchQuery: "",
  loading: false,
  error: null,

  selectSkill: (key) => set({ selectedSkillKey: key }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),

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
      const data = (await res.json()) as { skills?: Record<string, unknown>[] };
      const skills = (data.skills ?? []).map(normalizeSkill);
      set({ skills, loading: false });
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

  installSkill: async (name, installId) => {
    try {
      const res = await fetch("/api/skills/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, installId }),
      });
      if (!res.ok) {
        return false;
      }
      const data = (await res.json()) as { ok?: boolean };
      // Auto-refresh skills list to reflect install result
      await get().fetchSkills();
      return !!data.ok;
    } catch {
      return false;
    }
  },
}));
