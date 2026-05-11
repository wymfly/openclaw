import type { MethodMetadata } from "../../method-registry.js";
import {
  ErrorCodes,
  errorShape,
  validateDeckAgentsModelPolicyGetParams,
  validateDeckAgentsModelPolicySetParams,
} from "../../protocol/index.js";
import {
  DeckAgentsModelPolicyGetParamsSchema,
  DeckAgentsModelPolicyGetResultSchema,
  DeckAgentsModelPolicySetParamsSchema,
  DeckAgentsModelPolicySetResultSchema,
} from "../../protocol/schema/deck.js";
import { agentsService } from "../../services/agents.service.js";
import { configService, type OpenClawConfig } from "../../services/config.service.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";
import { validateBaseHash } from "./utils.js";

type PolicyKind = "global-default" | "agent-model" | "agent-subagents";
type PolicyShape = "agentModelConfig" | "string";
type PolicySource = "agent" | "default" | "missing";
type PolicyOwner = "agents" | "models" | "other";

type Selection = {
  primary?: string;
  fallbacks?: string[];
};

type PolicyTarget = {
  kind: PolicyKind;
  key: string;
  label: string;
  configPath: string;
  shape: PolicyShape;
};

type PolicyEntry = {
  kind: PolicyKind;
  key: string;
  label: string;
  configPath: string;
  source: PolicySource;
  supportedShape: PolicyShape;
  selection?: Selection;
  effective?: Selection;
  unavailableRefs: string[];
  editable: boolean;
  owner: PolicyOwner;
};

type ModelChoice = {
  ref: string;
  provider: string;
  model: string;
  name: string;
  contextWindow?: number;
  reasoning?: boolean;
  input?: string[];
};

type UnsupportedPolicy = {
  key: string;
  configPath: string;
  reason: string;
};

type ConfigRecord = Record<string, unknown>;

const { buildConfiguredModelCatalog } = agentsService;
const { readConfigFileSnapshotForWrite, resolveConfigSnapshotHash, writeConfigFile } =
  configService;

const GLOBAL_TARGETS: readonly PolicyTarget[] = [
  {
    kind: "global-default",
    key: "text",
    label: "Text default",
    configPath: "agents.defaults.model",
    shape: "agentModelConfig",
  },
  {
    kind: "global-default",
    key: "image",
    label: "Image input default",
    configPath: "agents.defaults.imageModel",
    shape: "agentModelConfig",
  },
  {
    kind: "global-default",
    key: "imageGeneration",
    label: "Image generation default",
    configPath: "agents.defaults.imageGenerationModel",
    shape: "agentModelConfig",
  },
  {
    kind: "global-default",
    key: "videoGeneration",
    label: "Video generation default",
    configPath: "agents.defaults.videoGenerationModel",
    shape: "agentModelConfig",
  },
  {
    kind: "global-default",
    key: "musicGeneration",
    label: "Music generation default",
    configPath: "agents.defaults.musicGenerationModel",
    shape: "agentModelConfig",
  },
  {
    kind: "global-default",
    key: "pdf",
    label: "PDF default",
    configPath: "agents.defaults.pdfModel",
    shape: "agentModelConfig",
  },
  {
    kind: "global-default",
    key: "compaction",
    label: "Compaction default",
    configPath: "agents.defaults.compaction.model",
    shape: "string",
  },
  {
    kind: "global-default",
    key: "memorySearch",
    label: "Memory search default",
    configPath: "agents.defaults.memorySearch.model",
    shape: "string",
  },
  {
    kind: "global-default",
    key: "subagents",
    label: "Subagent default",
    configPath: "agents.defaults.subagents.model",
    shape: "agentModelConfig",
  },
];

const AGENT_MODEL_TARGET: PolicyTarget = {
  kind: "agent-model",
  key: "agent",
  label: "Agent runtime model",
  configPath: "agents.list[].model",
  shape: "agentModelConfig",
};

const AGENT_SUBAGENT_TARGET: PolicyTarget = {
  kind: "agent-subagents",
  key: "agentSubagents",
  label: "Agent subagent model",
  configPath: "agents.list[].subagents.model",
  shape: "agentModelConfig",
};

function isRecord(value: unknown): value is ConfigRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function pathSegments(configPath: string): string[] {
  return configPath.split(".");
}

function getNested(record: ConfigRecord | undefined, configPath: string): unknown {
  let current: unknown = record;
  for (const segment of pathSegments(configPath)) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function ensureNested(record: ConfigRecord, segments: readonly string[]): ConfigRecord {
  let current = record;
  for (const segment of segments) {
    const existing = current[segment];
    if (!isRecord(existing)) {
      const next: ConfigRecord = {};
      current[segment] = next;
      current = next;
      continue;
    }
    current = existing;
  }
  return current;
}

function setNested(record: ConfigRecord, configPath: string, value: unknown) {
  const segments = pathSegments(configPath);
  const leaf = segments.at(-1);
  if (!leaf) {
    return;
  }
  const parent = ensureNested(record, segments.slice(0, -1));
  parent[leaf] = value;
}

function deleteNested(record: ConfigRecord, configPath: string) {
  const segments = pathSegments(configPath);
  const leaf = segments.at(-1);
  if (!leaf) {
    return;
  }
  let parent: unknown = record;
  for (const segment of segments.slice(0, -1)) {
    if (!isRecord(parent)) {
      return;
    }
    parent = parent[segment];
  }
  if (isRecord(parent)) {
    delete parent[leaf];
  }
}

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function uniqueStrings(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = normalizeString(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function normalizeSelection(value: unknown, shape: PolicyShape): Selection | undefined {
  const stringValue = normalizeString(value);
  if (stringValue) {
    return { primary: stringValue };
  }
  if (shape === "string" || !isRecord(value)) {
    return undefined;
  }
  const primary = normalizeString(value.primary);
  const fallbacks = Array.isArray(value.fallbacks) ? uniqueStrings(value.fallbacks) : [];
  if (!primary && fallbacks.length === 0) {
    return undefined;
  }
  return {
    ...(primary ? { primary } : {}),
    ...(fallbacks.length > 0 ? { fallbacks } : {}),
  };
}

function selectionRefs(selection: Selection | undefined): string[] {
  return uniqueStrings([selection?.primary, ...(selection?.fallbacks ?? [])]);
}

function hasSelectionValue(selection: Selection | undefined): boolean {
  return selectionRefs(selection).length > 0;
}

function unavailableRefs(
  selection: Selection | undefined,
  configuredRefs: ReadonlySet<string>,
): string[] {
  return selectionRefs(selection).filter((ref) => !configuredRefs.has(ref));
}

function mergeUnavailableRefs(
  configuredRefs: ReadonlySet<string>,
  ...selections: Array<Selection | undefined>
): string[] {
  return uniqueStrings(
    selections.flatMap((selection) => unavailableRefs(selection, configuredRefs)),
  );
}

function toConfigValue(selection: Selection, shape: PolicyShape): unknown {
  const primary = normalizeString(selection.primary);
  const fallbacks = uniqueStrings(selection.fallbacks ?? []);
  if (!primary) {
    return undefined;
  }
  if (shape === "string" || fallbacks.length === 0) {
    return primary;
  }
  return { primary, fallbacks };
}

function configuredChoices(cfg: OpenClawConfig): ModelChoice[] {
  return buildConfiguredModelCatalog({ cfg }).map((entry) => ({
    ref: `${entry.provider}/${entry.id}`,
    provider: entry.provider,
    model: entry.id,
    name: entry.name,
    ...(typeof entry.contextWindow === "number" ? { contextWindow: entry.contextWindow } : {}),
    ...(typeof entry.reasoning === "boolean" ? { reasoning: entry.reasoning } : {}),
    ...(Array.isArray(entry.input) ? { input: entry.input } : {}),
  }));
}

function configuredRefSet(choices: readonly ModelChoice[]): Set<string> {
  return new Set(choices.map((choice) => choice.ref));
}

function globalPolicyEntry(
  cfg: OpenClawConfig,
  target: PolicyTarget,
  refs: ReadonlySet<string>,
): PolicyEntry {
  const selection = normalizeSelection(
    getNested(cfg as unknown as ConfigRecord, target.configPath),
    target.shape,
  );
  return {
    kind: target.kind,
    key: target.key,
    label: target.label,
    configPath: target.configPath,
    source: selection ? "default" : "missing",
    supportedShape: target.shape,
    ...(selection ? { selection, effective: selection } : {}),
    unavailableRefs: unavailableRefs(selection, refs),
    editable: true,
    owner: "agents",
  };
}

function listAgents(cfg: OpenClawConfig): ConfigRecord[] {
  const agents = isRecord(cfg.agents) ? cfg.agents : undefined;
  const list = agents?.list;
  return Array.isArray(list) ? list.filter(isRecord) : [];
}

function findAgentEntry(cfg: OpenClawConfig, agentId: string): ConfigRecord | undefined {
  return listAgents(cfg).find((entry) => normalizeString(entry.id) === agentId);
}

function agentPolicyEntry(
  cfg: OpenClawConfig,
  agentId: string,
  target: PolicyTarget,
  refs: ReadonlySet<string>,
): PolicyEntry | undefined {
  const entry = findAgentEntry(cfg, agentId);
  if (!entry) {
    return undefined;
  }
  const defaultTarget =
    target.kind === "agent-subagents"
      ? GLOBAL_TARGETS.find((candidate) => candidate.key === "subagents")
      : GLOBAL_TARGETS.find((candidate) => candidate.key === "text");
  const defaultSelection = defaultTarget
    ? normalizeSelection(
        getNested(cfg as unknown as ConfigRecord, defaultTarget.configPath),
        defaultTarget.shape,
      )
    : undefined;
  const raw =
    target.kind === "agent-subagents"
      ? isRecord(entry.subagents)
        ? entry.subagents.model
        : undefined
      : entry.model;
  const selection = normalizeSelection(raw, target.shape);
  const effective = selection ?? defaultSelection;
  return {
    kind: target.kind,
    key: target.key,
    label: target.label,
    configPath: target.configPath.replace("[]", `[${agentId}]`),
    source: selection ? "agent" : defaultSelection ? "default" : "missing",
    supportedShape: target.shape,
    ...(selection ? { selection } : {}),
    ...(effective ? { effective } : {}),
    unavailableRefs: mergeUnavailableRefs(refs, selection, effective),
    editable: true,
    owner: "agents",
  };
}

function unsupportedPolicies(cfg: OpenClawConfig): UnsupportedPolicy[] {
  const out: UnsupportedPolicy[] = [];
  const defaults = isRecord(cfg.agents?.defaults) ? cfg.agents.defaults : undefined;
  if (defaults && Object.hasOwn(defaults, "summaryModel")) {
    out.push({
      key: "summary",
      configPath: "agents.defaults.summaryModel",
      reason: "Current OpenClaw schema truth does not define agents.defaults.summaryModel.",
    });
  }
  return out;
}

function resolveGlobalTarget(key: string): PolicyTarget | undefined {
  return GLOBAL_TARGETS.find((target) => target.key === key);
}

function buildPolicyResponse(params: {
  cfg: OpenClawConfig;
  configHash: string;
  agentId?: string;
}) {
  const choices = configuredChoices(params.cfg);
  const refs = configuredRefSet(choices);
  const policies = GLOBAL_TARGETS.map((target) => globalPolicyEntry(params.cfg, target, refs));
  if (params.agentId) {
    const agentModel = agentPolicyEntry(params.cfg, params.agentId, AGENT_MODEL_TARGET, refs);
    const agentSubagents = agentPolicyEntry(
      params.cfg,
      params.agentId,
      AGENT_SUBAGENT_TARGET,
      refs,
    );
    if (agentModel) {
      policies.push(agentModel);
    }
    if (agentSubagents) {
      policies.push(agentSubagents);
    }
  }
  return {
    ...(params.agentId ? { agentId: params.agentId } : {}),
    policies,
    configuredModels: choices,
    configHash: params.configHash,
    unsupported: unsupportedPolicies(params.cfg),
  };
}

function applyGlobalTarget(
  cfg: OpenClawConfig,
  key: string,
  selection: Selection | null | undefined,
) {
  const target = resolveGlobalTarget(key);
  if (!target) {
    throw new Error(`Unsupported model policy target "${key}"`);
  }
  const record = cfg as unknown as ConfigRecord;
  if (selection === null || selection === undefined) {
    deleteNested(record, target.configPath);
    return undefined;
  }
  const value = toConfigValue(selection, target.shape);
  if (value === undefined) {
    throw new Error("primary is required for model policy writes");
  }
  if (target.shape === "string" && (selection.fallbacks?.length ?? 0) > 0) {
    throw new Error(`Fallbacks are not supported for ${target.configPath}`);
  }
  setNested(record, target.configPath, value);
  return normalizeSelection(value, target.shape);
}

function applyAgentTarget(params: {
  cfg: OpenClawConfig;
  agentId: string | undefined;
  kind: PolicyKind;
  selection: Selection | null | undefined;
}) {
  if (!params.agentId) {
    throw new Error("agentId is required for per-agent model policy writes");
  }
  const entry = findAgentEntry(params.cfg, params.agentId);
  if (!entry) {
    throw new Error(`Agent "${params.agentId}" not found`);
  }
  const target = params.kind === "agent-subagents" ? AGENT_SUBAGENT_TARGET : AGENT_MODEL_TARGET;
  if (params.selection === null || params.selection === undefined) {
    if (params.kind === "agent-subagents") {
      if (isRecord(entry.subagents)) {
        delete entry.subagents.model;
      }
    } else {
      delete entry.model;
    }
    return undefined;
  }
  const value = toConfigValue(params.selection, target.shape);
  if (value === undefined) {
    throw new Error("primary is required for model policy writes");
  }
  if (params.kind === "agent-subagents") {
    const subagents = isRecord(entry.subagents) ? entry.subagents : {};
    subagents.model = value;
    entry.subagents = subagents;
  } else {
    entry.model = value;
  }
  return normalizeSelection(value, target.shape);
}

export const deckAgentsModelPolicyHandlers: GatewayRequestHandlers = {
  "deck.agents.modelPolicy.get": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckAgentsModelPolicyGetParams,
        "deck.agents.modelPolicy.get",
        respond,
      )
    ) {
      return;
    }
    const { snapshot } = await readConfigFileSnapshotForWrite();
    const cfg = snapshot.config;
    const configHash = resolveConfigSnapshotHash(snapshot) ?? "";
    const agentId = normalizeString((params as { agentId?: unknown }).agentId);
    if (agentId && !findAgentEntry(cfg, agentId)) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }
    respond(true, buildPolicyResponse({ cfg, configHash, agentId }), undefined);
  },

  "deck.agents.modelPolicy.set": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckAgentsModelPolicySetParams,
        "deck.agents.modelPolicy.set",
        respond,
      )
    ) {
      return;
    }
    const parsed = params as {
      target: { kind: PolicyKind; key: string; agentId?: string };
      selection?: Selection;
      clear?: boolean;
      baseHash: string;
    };
    if (parsed.clear && hasSelectionValue(parsed.selection)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "clear and selection are mutually exclusive"),
      );
      return;
    }
    if (!parsed.clear && !hasSelectionValue(parsed.selection)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "selection is required unless clear is true"),
      );
      return;
    }
    const { snapshot, writeOptions } = await readConfigFileSnapshotForWrite();
    const currentHash = resolveConfigSnapshotHash(snapshot) ?? "";
    const hashError = validateBaseHash(parsed.baseHash, currentHash);
    if (hashError) {
      respond(
        false,
        undefined,
        errorShape(
          hashError.code,
          hashError.message,
          hashError.details ? { details: hashError.details } : undefined,
        ),
      );
      return;
    }

    const cfg = structuredClone(snapshot.config);
    try {
      const requestedSelection = parsed.clear ? undefined : parsed.selection;
      const selection =
        parsed.target.kind === "global-default"
          ? applyGlobalTarget(cfg, parsed.target.key, requestedSelection)
          : applyAgentTarget({
              cfg,
              agentId: parsed.target.agentId,
              kind: parsed.target.kind,
              selection: requestedSelection,
            });
      await writeConfigFile(cfg, writeOptions);
      const { snapshot: nextSnapshot } = await readConfigFileSnapshotForWrite();
      const configHash = resolveConfigSnapshotHash(nextSnapshot) ?? "";
      respond(
        true,
        {
          ok: true,
          target: parsed.target,
          ...(selection ? { selection } : {}),
          ...(parsed.clear ? { cleared: true } : {}),
          configHash,
        },
        undefined,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = /not found/i.test(message) ? ErrorCodes.NOT_FOUND : ErrorCodes.INVALID_REQUEST;
      respond(false, undefined, errorShape(code, message));
    }
  },
};

export const deckAgentsModelPolicyMethodDefs: Record<string, MethodMetadata> = {
  "deck.agents.modelPolicy.get": {
    params: DeckAgentsModelPolicyGetParamsSchema,
    result: DeckAgentsModelPolicyGetResultSchema,
    scope: "operator.read",
    forkClass: "C1",
    bffEligible: false,
  },
  "deck.agents.modelPolicy.set": {
    params: DeckAgentsModelPolicySetParamsSchema,
    result: DeckAgentsModelPolicySetResultSchema,
    scope: "operator.admin",
    controlPlaneWrite: true,
    forkClass: "C2",
    bffEligible: false,
  },
};
