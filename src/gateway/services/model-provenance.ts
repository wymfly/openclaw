import * as fs from "node:fs";
import * as path from "node:path";
import { resolveDefaultAgentId } from "../../agents/agent-scope.js";
import { ensureAuthProfileStore } from "../../agents/auth-profiles.js";
import { resolveEnvApiKey } from "../../agents/model-auth.js";
import type { ModelCatalogEntry, ModelInputType } from "../../agents/model-catalog.js";
import { parseModelRef } from "../../agents/model-selection.js";
import { normalizeProviderId } from "../../agents/provider-id.js";
import type { OpenClawConfig } from "../../config/config.js";

const DEFAULT_PROVIDER = "anthropic";

export const MODEL_ENV_PROBE_PROVIDERS = [
  "anthropic",
  "github-copilot",
  "google-vertex",
  "openai",
  "google",
  "groq",
  "cerebras",
  "xai",
  "openrouter",
  "zai",
  "mistral",
  "synthetic",
] as const;

export type ConfiguredModelSource = "config" | "agent-models" | "mixed" | "runtime";
export type AuthOverviewSource = "config" | "auth-profile" | "agent-models" | "env" | "mixed";
export type ProviderScope = "global" | `agent:${string}`;

export interface ProviderPresenceSnapshot {
  provider: string;
  source: ConfiguredModelSource;
  authSource: AuthOverviewSource;
  scope: ProviderScope;
  editable: boolean;
  configPresent: boolean;
  authPresent: boolean;
  configAuthPresent: boolean;
  authProfilePresent: boolean;
  envPresent: boolean;
  agentModelsPresent: boolean;
}

interface ProviderSourceSets {
  agentId: string;
  configProviders: Set<string>;
  configAuthProviders: Set<string>;
  authProfileProviders: Set<string>;
  envProviders: Set<string>;
  agentModelsProviders: Set<string>;
  defaultModelProviders: Set<string>;
}

interface ProviderPresenceBase {
  provider: string;
  configPresent: boolean;
  configAuthPresent: boolean;
  authProfilePresent: boolean;
  envPresent: boolean;
  agentModelsPresent: boolean;
}

function normalizeProvider(provider: string): string {
  return normalizeProviderId(provider) ?? provider.trim();
}

function readModelsJsonSync(agentDir: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(path.join(agentDir, "models.json"), "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return (parsed?.providers as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

function readAgentModelsProviders(agentDir: string): Set<string> {
  return new Set(
    Object.keys(readModelsJsonSync(agentDir))
      .map((provider) => normalizeProvider(provider))
      .filter(Boolean),
  );
}

export function buildModelsJsonCatalog(agentDir: string): ModelCatalogEntry[] {
  const providers = readModelsJsonSync(agentDir);
  const catalog: ModelCatalogEntry[] = [];
  for (const [providerRaw, providerData] of Object.entries(providers)) {
    const providerId = normalizeProviderId(providerRaw);
    if (!providerId) {
      continue;
    }
    const p = providerData as Record<string, unknown> | undefined;
    if (!p || !Array.isArray(p.models)) {
      continue;
    }
    for (const model of p.models as Array<Record<string, unknown>>) {
      const id = typeof model?.id === "string" ? model.id.trim() : "";
      if (!id) {
        continue;
      }
      catalog.push({
        provider: providerId,
        id,
        name: typeof model?.name === "string" && model.name.trim() ? model.name.trim() : id,
        contextWindow:
          typeof model?.contextWindow === "number" && model.contextWindow > 0
            ? model.contextWindow
            : undefined,
        reasoning: typeof model?.reasoning === "boolean" ? model.reasoning : undefined,
        input: Array.isArray(model?.input)
          ? (model.input as unknown[]).filter(
              (i): i is ModelInputType => i === "text" || i === "image" || i === "document",
            )
          : undefined,
      });
    }
  }
  return catalog;
}

function hasConfigAuth(providerConfig: Record<string, unknown> | undefined): boolean {
  if (!providerConfig) {
    return false;
  }
  const apiKey = typeof providerConfig.apiKey === "string" ? providerConfig.apiKey.trim() : "";
  if (apiKey) {
    return true;
  }
  const authMode = typeof providerConfig.auth === "string" ? providerConfig.auth.trim() : "";
  return (
    authMode === "api-key" || authMode === "aws-sdk" || authMode === "oauth" || authMode === "token"
  );
}

function collectProviderSourceSets(cfg: OpenClawConfig, agentDir: string): ProviderSourceSets {
  const configProviders = new Set<string>();
  const configAuthProviders = new Set<string>();
  const providerConfigMap = (cfg.models?.providers ?? {}) as Record<string, unknown>;
  for (const [provider, value] of Object.entries(providerConfigMap)) {
    const providerId = normalizeProvider(provider);
    if (!providerId) {
      continue;
    }
    configProviders.add(providerId);
    if (hasConfigAuth(value as Record<string, unknown> | undefined)) {
      configAuthProviders.add(providerId);
    }
  }

  const defaultModelProviders = new Set<string>();
  const defaultModel = cfg.agents?.defaults?.model;
  const rawModel =
    typeof defaultModel === "string"
      ? defaultModel
      : typeof defaultModel === "object" && defaultModel !== null
        ? (((defaultModel as Record<string, unknown>).primary as string) ?? "")
        : "";
  if (rawModel) {
    const parsed = parseModelRef(rawModel, DEFAULT_PROVIDER);
    if (parsed?.provider) {
      defaultModelProviders.add(parsed.provider);
    }
  }

  const authProfileProviders = new Set<string>();
  const store = ensureAuthProfileStore(agentDir);
  for (const profile of Object.values(store.profiles)) {
    const provider =
      typeof profile.provider === "string" ? normalizeProvider(profile.provider) : "";
    if (provider) {
      authProfileProviders.add(provider);
    }
  }

  const envProviders = new Set<string>();
  for (const provider of MODEL_ENV_PROBE_PROVIDERS) {
    if (resolveEnvApiKey(provider)) {
      envProviders.add(provider);
    }
  }

  return {
    agentId: resolveDefaultAgentId(cfg),
    configProviders,
    configAuthProviders,
    authProfileProviders,
    envProviders,
    agentModelsProviders: readAgentModelsProviders(agentDir),
    defaultModelProviders,
  };
}

function resolveConfiguredModelSource(snapshot: ProviderPresenceBase): ConfiguredModelSource {
  if (snapshot.configPresent && snapshot.agentModelsPresent) {
    return "mixed";
  }
  if (snapshot.configPresent) {
    return "config";
  }
  if (snapshot.agentModelsPresent) {
    return "agent-models";
  }
  return "runtime";
}

function resolveAuthOverviewSource(snapshot: ProviderPresenceBase): AuthOverviewSource {
  const sources: AuthOverviewSource[] = [];
  if (snapshot.configPresent) {
    sources.push("config");
  }
  if (snapshot.authProfilePresent) {
    sources.push("auth-profile");
  }
  if (snapshot.agentModelsPresent) {
    sources.push("agent-models");
  }
  if (snapshot.envPresent) {
    sources.push("env");
  }
  if (sources.length === 0) {
    return "mixed";
  }
  return sources.length === 1 ? sources[0] : "mixed";
}

export function createProviderProvenance(cfg: OpenClawConfig, agentDir: string) {
  const sets = collectProviderSourceSets(cfg, agentDir);

  return {
    visibleProviders: Array.from(
      new Set([
        ...sets.configProviders,
        ...sets.authProfileProviders,
        ...sets.envProviders,
        ...sets.agentModelsProviders,
        ...sets.defaultModelProviders,
      ]),
    )
      .map((provider) => provider.trim())
      .filter(Boolean)
      .toSorted((a, b) => a.localeCompare(b)),
    inspect(provider: string): ProviderPresenceSnapshot {
      const providerId = normalizeProvider(provider);
      const base: ProviderPresenceBase = {
        provider: providerId,
        configPresent: sets.configProviders.has(providerId),
        configAuthPresent: sets.configAuthProviders.has(providerId),
        authProfilePresent: sets.authProfileProviders.has(providerId),
        envPresent: sets.envProviders.has(providerId),
        agentModelsPresent: sets.agentModelsProviders.has(providerId),
      };

      return {
        ...base,
        source: resolveConfiguredModelSource(base),
        authSource: resolveAuthOverviewSource(base),
        scope:
          base.agentModelsPresent || base.authProfilePresent
            ? (`agent:${sets.agentId}` as const)
            : "global",
        editable: base.configPresent,
        authPresent: base.configAuthPresent || base.authProfilePresent || base.envPresent,
      };
    },
  };
}
