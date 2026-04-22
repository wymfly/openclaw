import { create } from "zustand";
import { DeckApiError, fetchApi } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SkillStatus = "ready" | "needs-setup" | "disabled";

export interface SkillInstallOption {
  id: string;
  label: string;
  bins: string[];
}

export interface SkillEntry {
  key: string;
  name: string;
  status: SkillStatus;
  source: "bundled" | "managed" | "plugin";
  enabled: boolean;
  missingRequirements?: string[];
  config?: Record<string, unknown>;
  /** Skill description text. */
  description?: string;
  /** Emoji icon for the skill. */
  emoji?: string;
  /** Homepage / docs URL. */
  homepage?: string;
  /** Available install options (binaries/packages). */
  installOptions?: SkillInstallOption[];
  /** Primary environment variable name required by the skill. */
  primaryEnv?: string;
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

  return {
    key: typeof raw.key === "string" ? raw.key : skillKey,
    name: typeof raw.name === "string" ? raw.name : skillKey,
    status,
    source: VALID_SOURCES.has(rawSource as SkillEntry["source"])
      ? (rawSource as SkillEntry["source"])
      : "bundled",
    enabled: !disabled,
    missingRequirements: Array.isArray(raw.missing) ? (raw.missing as string[]) : undefined,
    config:
      typeof raw.config === "object" && raw.config !== null
        ? (raw.config as Record<string, unknown>)
        : undefined,
    description: typeof raw.description === "string" ? raw.description : undefined,
    emoji: typeof raw.emoji === "string" ? raw.emoji : undefined,
    homepage: typeof raw.homepage === "string" ? raw.homepage : undefined,
    primaryEnv: typeof raw.primaryEnv === "string" ? raw.primaryEnv : undefined,
    installOptions: Array.isArray(raw.install) ? (raw.install as SkillInstallOption[]) : undefined,
  };
}

export const useSkillsStore = create<SkillsState>((set) => ({
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
      const data = await fetchApi<{ skills?: Record<string, unknown>[] }>(url);
      const skills = (data.skills ?? []).map(normalizeSkill);
      set({ skills, loading: false });
    } catch (err) {
      set({
        error: err instanceof DeckApiError ? err.body.error : "Failed to fetch skills",
        loading: false,
      });
    }
  },

  updateSkill: async (skillKey, patch) => {
    try {
      const data = await fetchApi<{ ok?: boolean; config?: Record<string, unknown> }>(
        `/api/skills/${encodeURIComponent(skillKey)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
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
      const data = await fetchApi<{ ok?: boolean }>("/api/skills/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, installId }),
      });
      return !!data.ok;
    } catch {
      return false;
    }
  },
}));
