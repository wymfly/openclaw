import type { DeckGoSkillEntry } from "../../../api";

export type PanelState = "idle" | "loading" | "ready";
export type SkillStatus = "ready" | "needs-setup" | "disabled";
export type SkillStatusFilter = SkillStatus | "all";

export const VALID_SOURCES = new Set<DeckGoSkillEntry["source"]>(["bundled", "managed", "plugin"]);

export const SKILL_STATUS_FILTERS: SkillStatusFilter[] = [
  "all",
  "ready",
  "needs-setup",
  "disabled",
];

export function formatHubDate(value?: number, fallback = "n/a") {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString();
}

export function normalizeSkill(raw: Record<string, unknown>): DeckGoSkillEntry {
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

  const source = typeof raw.source === "string" ? raw.source : "bundled";
  return {
    key: typeof raw.key === "string" ? raw.key : skillKey,
    name: typeof raw.name === "string" ? raw.name : skillKey,
    status,
    source: VALID_SOURCES.has(source as DeckGoSkillEntry["source"])
      ? (source as DeckGoSkillEntry["source"])
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
    installOptions: Array.isArray(raw.install)
      ? (raw.install as DeckGoSkillEntry["installOptions"])
      : undefined,
  };
}

export function normalizeAgentSkillMode(mode?: string): "all" | "whitelist" {
  return mode === "whitelist" ? "whitelist" : "all";
}

export function sortSkillKeys(skills: string[]) {
  return skills.slice().sort((left, right) => left.localeCompare(right));
}
