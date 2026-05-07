import type { DeckGoSkillEntry } from "../../../api";

export type PanelState = "idle" | "loading" | "ready";
export type SkillStatus = "ready" | "needs-setup" | "disabled";
export type SkillStatusFilter = SkillStatus | "all";

export const VALID_SOURCES = new Set<DeckGoSkillEntry["source"]>([
  "bundled",
  "managed",
  "workspace",
  "extra",
  "personal",
  "project",
  "unknown",
]);

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

function normalizeMissingRequirements(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  }
  if (typeof value !== "object" || value === null) {
    return [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([group, entries]) => {
    if (!Array.isArray(entries)) {
      return [];
    }
    return entries
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      .map((entry) => `${group}: ${entry}`);
  });
}

export function normalizeSkill(raw: unknown): DeckGoSkillEntry {
  const record =
    typeof raw === "object" && raw !== null
      ? (raw as Partial<DeckGoSkillEntry> & Record<string, unknown>)
      : {};
  const skillKey =
    typeof record.skillKey === "string"
      ? record.skillKey
      : typeof record.key === "string"
        ? record.key
        : typeof record.name === "string"
          ? record.name
          : "";
  const disabled = record.disabled === true || record.enabled === false;
  const eligible = record.eligible !== false;
  const missingRequirements =
    Array.isArray(record.missingRequirements) && record.missingRequirements.length > 0
      ? record.missingRequirements
      : normalizeMissingRequirements(record.missing);
  const hasMissing = missingRequirements.length > 0;

  let status: SkillStatus = "ready";
  if (
    record.status === "disabled" ||
    record.status === "needs-setup" ||
    record.status === "ready"
  ) {
    status = record.status;
  } else {
    if (disabled) {
      status = "disabled";
    } else if (hasMissing || !eligible) {
      status = "needs-setup";
    }
  }

  const source = typeof record.source === "string" ? record.source : "unknown";
  const sourceRaw =
    typeof record.sourceRaw === "string"
      ? record.sourceRaw
      : typeof record.source === "string"
        ? record.source
        : "";
  const normalizedSource = VALID_SOURCES.has(source as DeckGoSkillEntry["source"])
    ? (source as DeckGoSkillEntry["source"])
    : "unknown";
  return {
    key: typeof record.key === "string" ? record.key : skillKey,
    name: typeof record.name === "string" ? record.name : skillKey,
    status,
    source: normalizedSource,
    sourceRaw,
    enabled: !disabled,
    apiKeyConfigured: record.apiKeyConfigured === true,
    agentUsage:
      typeof record.agentUsage === "object" && record.agentUsage !== null
        ? (record.agentUsage as DeckGoSkillEntry["agentUsage"])
        : { count: 0, agentIds: [] },
    availableActions: Array.isArray(record.availableActions)
      ? (record.availableActions as DeckGoSkillEntry["availableActions"])
      : undefined,
    unsupportedReasons:
      typeof record.unsupportedReasons === "object" && record.unsupportedReasons !== null
        ? (record.unsupportedReasons as DeckGoSkillEntry["unsupportedReasons"])
        : undefined,
    owningPlugin:
      typeof record.owningPlugin === "object" && record.owningPlugin !== null
        ? (record.owningPlugin as DeckGoSkillEntry["owningPlugin"])
        : null,
    missingRequirements: missingRequirements.length ? missingRequirements : undefined,
    config:
      typeof record.config === "object" && record.config !== null
        ? (record.config as Record<string, unknown>)
        : undefined,
    description: typeof record.description === "string" ? record.description : undefined,
    emoji: typeof record.emoji === "string" ? record.emoji : undefined,
    homepage: typeof record.homepage === "string" ? record.homepage : undefined,
    primaryEnv: typeof record.primaryEnv === "string" ? record.primaryEnv : undefined,
    installOptions: Array.isArray(record.installOptions)
      ? record.installOptions
      : Array.isArray(record.install)
        ? (record.install as DeckGoSkillEntry["installOptions"])
        : undefined,
  };
}

export function normalizeAgentSkillMode(mode?: string): "all" | "whitelist" {
  return mode === "whitelist" ? "whitelist" : "all";
}

export function sortSkillKeys(skills: string[]) {
  return skills.slice().sort((left, right) => left.localeCompare(right));
}
