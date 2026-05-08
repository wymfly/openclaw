import { DEFAULT_RUNTIME_ID } from "../../lib/runtime-id";

export type DeckQueryScope = {
  agentId?: string | null;
  runtimeId?: string | null;
};

export type SerializableQueryValue =
  | null
  | string
  | number
  | boolean
  | readonly SerializableQueryValue[]
  | { readonly [key: string]: SerializableQueryValue };

function normalizeScope(scope?: DeckQueryScope) {
  return {
    runtimeId: scope?.runtimeId?.trim() || DEFAULT_RUNTIME_ID,
    ...(scope?.agentId ? { agentId: scope.agentId } : {}),
  };
}

function stableValue(value: unknown): SerializableQueryValue {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stableValue(item));
  }
  if (typeof value === "object") {
    const output: Record<string, SerializableQueryValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>).toSorted()) {
      const next = (value as Record<string, unknown>)[key];
      if (next !== undefined) {
        output[key] = stableValue(next);
      }
    }
    return output;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "symbol") {
    return value.description ?? "";
  }
  if (typeof value === "function") {
    return value.name || "function";
  }
  return "";
}

function scopedRuntimeKey(scope?: DeckQueryScope) {
  return ["deck-go", "runtime", normalizeScope(scope).runtimeId] as const;
}

export const deckKeys = {
  all: () => ["deck-go"] as const,
  runtime: {
    all: (scope?: DeckQueryScope) => scopedRuntimeKey(scope),
    bootstrap: (scope?: DeckQueryScope) => [...scopedRuntimeKey(scope), "bootstrap"] as const,
    gateway: (scope?: DeckQueryScope) => [...scopedRuntimeKey(scope), "gateway"] as const,
    summary: (scope?: DeckQueryScope) => [...scopedRuntimeKey(scope), "summary"] as const,
  },
  agents: {
    all: (scope?: DeckQueryScope) => [...scopedRuntimeKey(scope), "agents"] as const,
    list: (filters?: unknown, scope?: DeckQueryScope) =>
      [...scopedRuntimeKey(scope), "agents", "list", stableValue(filters)] as const,
    detail: (agentId: string, scope?: DeckQueryScope) =>
      [...scopedRuntimeKey({ ...scope, agentId }), "agents", "detail", agentId] as const,
  },
  skills: {
    all: (scope?: DeckQueryScope) => [...scopedRuntimeKey(scope), "skills"] as const,
    list: (filters?: unknown, scope?: DeckQueryScope) =>
      [...scopedRuntimeKey(scope), "skills", "list", stableValue(filters)] as const,
    detail: (skillId: string, scope?: DeckQueryScope) =>
      [...scopedRuntimeKey(scope), "skills", "detail", skillId] as const,
  },
  sessions: {
    all: (scope?: DeckQueryScope) => [...scopedRuntimeKey(scope), "sessions"] as const,
    list: (filters?: unknown, scope?: DeckQueryScope) =>
      [...scopedRuntimeKey(scope), "sessions", "list", stableValue(filters)] as const,
    detail: (sessionKey: string, scope?: DeckQueryScope) =>
      [...scopedRuntimeKey(scope), "sessions", "detail", sessionKey] as const,
  },
  usage: {
    all: (scope?: DeckQueryScope) => [...scopedRuntimeKey(scope), "usage"] as const,
    sessions: (filters?: unknown, scope?: DeckQueryScope) =>
      [...scopedRuntimeKey(scope), "usage", "sessions", stableValue(filters)] as const,
  },
  module: {
    all: (module: string, scope?: DeckQueryScope) => [...scopedRuntimeKey(scope), module] as const,
    list: (module: string, filters?: unknown, scope?: DeckQueryScope) =>
      [...scopedRuntimeKey(scope), module, "list", stableValue(filters)] as const,
    detail: (module: string, id: string, scope?: DeckQueryScope) =>
      [...scopedRuntimeKey(scope), module, "detail", id] as const,
    item: (module: string, segments: readonly unknown[], scope?: DeckQueryScope) =>
      [
        ...scopedRuntimeKey(scope),
        module,
        ...segments.map((segment) => stableValue(segment)),
      ] as const,
  },
};
