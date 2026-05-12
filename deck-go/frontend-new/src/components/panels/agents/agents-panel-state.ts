import type { DeckGoAgentCreateRequest, DeckGoAgentPatchRequest } from "@/api-types";
import type { Agent } from "@/stores/agents";

export type AgentsFilter = "all" | "busy" | "idle";
export type AgentsSort = "name" | "recent" | "sessions";
export type AgentSectionId =
  | "overview"
  | "model"
  | "workspace"
  | "skills"
  | "subagents"
  | "tools"
  | "conversation"
  | "delivery"
  | "files"
  | "routing"
  | "danger";

export interface AgentSectionDefinition {
  id: AgentSectionId;
  labelKey: string;
}

export interface OverviewDraft {
  name: string;
  model: string;
  workspace: string;
  emoji: string;
  avatar: string;
}

export interface CreateAgentDraft extends OverviewDraft {
  step: 0 | 1 | 2;
}

export const AGENT_SECTIONS: AgentSectionDefinition[] = [
  { id: "overview", labelKey: "sections.overview" },
  { id: "model", labelKey: "sections.model" },
  { id: "workspace", labelKey: "sections.workspace" },
  { id: "skills", labelKey: "sections.skills" },
  { id: "subagents", labelKey: "sections.subagents" },
  { id: "tools", labelKey: "sections.tools" },
  { id: "conversation", labelKey: "sections.conversation" },
  { id: "delivery", labelKey: "sections.delivery" },
  { id: "files", labelKey: "sections.files" },
  { id: "routing", labelKey: "sections.routing" },
  { id: "danger", labelKey: "sections.danger" },
];

const SECTION_IDS = new Set<AgentSectionId>(AGENT_SECTIONS.map((section) => section.id));
const LEGACY_SECTION_ALIASES: Partial<Record<string, AgentSectionId>> = {
  "event-streams": "delivery",
  runtime: "workspace",
  "system-prompt": "conversation",
  "tool-policy": "tools",
};

export function isAgentSectionId(value: string | null | undefined): value is AgentSectionId {
  return SECTION_IDS.has(value as AgentSectionId);
}

export function readSectionFromHash(hash: string): AgentSectionId {
  const value = hash.replace(/^#/, "");
  if (isAgentSectionId(value)) {
    return value;
  }
  const alias = LEGACY_SECTION_ALIASES[value];
  if (alias) {
    if (typeof window !== "undefined" && window.location.hash === `#${value}`) {
      const url = new URL(window.location.href);
      url.hash = alias;
      window.history.replaceState(window.history.state, "", url);
    }
    return alias;
  }
  return "overview";
}

export function nextSectionId(current: AgentSectionId, direction: 1 | -1): AgentSectionId {
  const index = AGENT_SECTIONS.findIndex((section) => section.id === current);
  const nextIndex = (index + direction + AGENT_SECTIONS.length) % AGENT_SECTIONS.length;
  return AGENT_SECTIONS[nextIndex]?.id ?? "overview";
}

export function overviewDraftFromAgent(agent: Agent): OverviewDraft {
  return {
    name: agent.name,
    model: agent.model ?? "",
    workspace: agent.workspace ?? "",
    emoji: agent.emoji ?? "",
    avatar: agent.avatar ?? "",
  };
}

export function hasOverviewChanges(agent: Agent, draft: OverviewDraft): boolean {
  return (
    draft.name.trim() !== agent.name ||
    draft.emoji.trim() !== (agent.emoji ?? "") ||
    draft.avatar.trim() !== (agent.avatar ?? "")
  );
}

export function hasRuntimeChanges(agent: Agent, draft: OverviewDraft): boolean {
  return draft.workspace.trim() !== (agent.workspace ?? "");
}

export function buildAgentIdentityPatch(
  agent: Agent,
  draft: OverviewDraft,
): DeckGoAgentPatchRequest {
  const patch: DeckGoAgentPatchRequest = {};
  const name = draft.name.trim();
  const emoji = draft.emoji.trim();
  const avatar = draft.avatar.trim();
  if (name && name !== agent.name) {
    patch.name = name;
  }
  if (emoji !== (agent.emoji ?? "")) {
    patch.emoji = emoji || undefined;
  }
  if (avatar !== (agent.avatar ?? "")) {
    patch.avatar = avatar || undefined;
  }
  return patch;
}

export function buildAgentRuntimePatch(
  agent: Agent,
  draft: OverviewDraft,
): DeckGoAgentPatchRequest {
  const patch: DeckGoAgentPatchRequest = {};
  const workspace = draft.workspace.trim();
  if (workspace !== (agent.workspace ?? "")) {
    patch.workspace = workspace || undefined;
  }
  return patch;
}

export function initialCreateDraft(): CreateAgentDraft {
  return {
    step: 0,
    name: "",
    workspace: "",
    model: "",
    emoji: "",
    avatar: "",
  };
}

export function validateCreateStep(draft: CreateAgentDraft): string | null {
  if (draft.step === 0 && !draft.name.trim()) {
    return "validation.nameRequired";
  }
  if (draft.step === 1 && draft.workspace.trim().startsWith("/relative")) {
    return "validation.workspaceAbsolute";
  }
  return null;
}

export function buildCreateAgentRequest(draft: CreateAgentDraft): DeckGoAgentCreateRequest {
  return {
    name: draft.name.trim(),
    ...(draft.workspace.trim() ? { workspace: draft.workspace.trim() } : {}),
    ...(draft.model.trim() ? { model: draft.model.trim() } : {}),
    ...(draft.emoji.trim() ? { emoji: draft.emoji.trim() } : {}),
    ...(draft.avatar.trim() ? { avatar: draft.avatar.trim() } : {}),
  };
}

export function isConflictError(error: unknown): boolean {
  const message = formatAgentError(error);
  return /409|conflict|hash|stale/i.test(message);
}

export function formatAgentError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error || "Request failed";
  }
  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") {
    return String(error);
  }
  return "Request failed";
}

export function formatMaybeCount(value: number | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "-";
}
