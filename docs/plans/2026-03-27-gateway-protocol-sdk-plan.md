# Gateway Protocol-Driven SDK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all untyped `gatewayRequest()` calls in the Deck dashboard with a fully typed `gw.*` client generated from Gateway's TypeBox schema registry.

**Architecture:** A `MethodRegistry` aggregates handler metadata (params schema, result schema, scope) alongside existing handlers. A codegen script reads the registry and emits TypeScript types + a typed client factory. The Deck migrates from `gatewayRequest("method", params)` to `gw.method.name(params)` with full compile-time safety. A `gateway.describe` RPC exposes the registry at runtime for introspection.

**Tech Stack:** TypeBox (schemas), Bun (codegen script), Vitest (tests), TypeScript strict mode

**Design Spec:** `docs/plans/2026-03-27-gateway-protocol-sdk-design.md`

**Execution mode:** subagent-driven (serial dependency chain)

---

## File Structure

### New Files

| File                                                | Responsibility                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/gateway/method-registry.ts`                    | `MethodDefinition`, `MethodRegistry` interface, `buildMethodRegistry()` |
| `src/gateway/method-registry.test.ts`               | Unit tests for registry builder                                         |
| `src/gateway/server-methods/describe.ts`            | `gateway.describe` RPC handler                                          |
| `src/gateway/server-methods/describe.test.ts`       | Tests for introspection RPC                                             |
| `scripts/protocol-gen-ts.ts`                        | TypeScript codegen: reads registry → emits generated files              |
| `dashboard/src/types/gateway-protocol.generated.ts` | Generated: type defs, `GatewayMethodMap`, event payloads                |
| `dashboard/src/types/gateway-client.generated.ts`   | Generated: `createGatewayClient()`, `GENERATED_METHOD_ALLOWLIST`        |

### Modified Files (Gateway)

| File                                                  | Change                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/gateway/protocol/schema/deck.ts`                 | Add ~24 result schemas for all `deck.*` methods (including `deck.auth.*`) |
| `src/gateway/protocol/schema/sessions.ts`             | Add ~10 result schemas                                                    |
| `src/gateway/protocol/schema/agents-models-skills.ts` | Add result schemas for agents/models/skills methods used by Deck          |
| `src/gateway/protocol/schema/channels.ts`             | Add result schemas for channels.status                                    |
| `src/gateway/protocol/schema/config.ts`               | Add result schemas for config.get/apply/patch                             |
| `src/gateway/protocol/schema/cron.ts`                 | Add result schemas for cron methods                                       |
| `src/gateway/protocol/schema/logs-chat.ts`            | Add result schemas for chat methods                                       |
| `src/gateway/protocol/schema/exec-approvals.ts`       | Add result schemas for exec.approval methods                              |
| `src/gateway/protocol/schema/protocol-schemas.ts`     | Register all new schemas                                                  |
| `src/gateway/protocol/schema/frames.ts`               | Add optional `schemaVersion` to `HelloOk.features`                        |
| `src/gateway/server-methods.ts`                       | Import `buildMethodRegistry`, assemble, export `gatewayMethodRegistry`    |
| `src/gateway/server-methods-list.ts`                  | Add `"gateway.describe"`                                                  |
| `src/gateway/server-methods/deck/agents.ts`           | Add `deckAgentsMethodDefs` export                                         |
| `src/gateway/server-methods/deck/agents-preview.ts`   | Add `deckAgentsPreviewMethodDefs` export                                  |
| `src/gateway/server-methods/deck/routing.ts`          | Add `deckRoutingMethodDefs` export                                        |
| `src/gateway/server-methods/deck/subagents.ts`        | Add `deckSubagentsMethodDefs` export                                      |
| `src/gateway/server-methods/deck/subagents-steer.ts`  | Add `deckSubagentsSteerMethodDefs` export                                 |
| `src/gateway/server-methods/deck/identity.ts`         | Add `deckIdentityMethodDefs` export                                       |
| `src/gateway/server-methods/deck/threads.ts`          | Add `deckThreadsMethodDefs` export                                        |
| `src/gateway/server-methods/deck/index.ts`            | Re-export all `deckXxxMethodDefs` and merge                               |
| `src/gateway/server-methods/deck-auth.ts`             | Add `deckAuthMethodDefs` export (NOTE: not in `deck/` subdir)             |
| `src/gateway/method-scopes.ts`                        | Add `gateway.describe` to READ_SCOPE group                                |
| `src/gateway/server/ws-connection/message-handler.ts` | Inject `schemaVersion` into hello-ok `features`                           |
| `scripts/protocol-gen-ts.ts`                          | TypeScript codegen (side-effect-free registry import)                     |
| `package.json`                                        | Add `protocol:gen:ts` / `protocol:gen:check` scripts                      |

### Modified Files (Deck)

| File                                             | Change                                                                                     |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `dashboard/server/runtime.ts`                    | Initialize `gw = createGatewayClient(...)` on runtime                                      |
| `dashboard/server/gateway-adapter.ts`            | Adapt request signature; add schemaVersion warning                                         |
| `dashboard/server/gateway-allowlist.ts`          | Derive from `GENERATED_METHOD_ALLOWLIST`                                                   |
| `dashboard/src/lib/api-helpers.ts`               | Remove `gatewayRequest()` or make it delegate to typed client                              |
| `dashboard/src/stores/deck-agents.ts`            | Delete hand-written interfaces, import from generated                                      |
| `dashboard/src/stores/deck-routing.ts`           | Delete hand-written interfaces, import from generated                                      |
| `dashboard/src/stores/deck-subagents.ts`         | Delete hand-written interfaces, import from generated                                      |
| `dashboard/src/stores/channels.ts`               | **P1 only** — keep hand-written for now (depends on upstream result schemas)               |
| `dashboard/src/stores/models.ts`                 | **P1 only** — keep 11 hand-written interfaces for now (depends on upstream result schemas) |
| `dashboard/src/app/api/deck/**/*.ts` (~23 calls) | P0: Migrate `deck.*` routes to typed `gwRequest()`                                         |
| `dashboard/src/app/api/**/*.ts` (~57 calls)      | P1 follow-up: Migrate upstream routes after P1 result schemas                              |

---

### Task 1: MethodRegistry Core Types + Builder

**Files:**

- Create: `src/gateway/method-registry.ts`
- Create: `src/gateway/method-registry.test.ts`

- [ ] **Step 1: Write the test file with core behavior tests**

```typescript
// src/gateway/method-registry.test.ts
import { describe, expect, it } from "vitest";
import { Type } from "@sinclair/typebox";
import { buildMethodRegistry } from "./method-registry.js";
import type { GatewayRequestHandlers } from "./server-methods/types.js";

const TestParamsSchema = Type.Object({ id: Type.String() });
const TestResultSchema = Type.Object({ ok: Type.Boolean() });

const fakeHandlers: GatewayRequestHandlers = {
  "test.get": async ({ respond }) => respond(true, { ok: true }),
  "test.set": async ({ respond }) => respond(true, { ok: true }),
  "untyped.method": async ({ respond }) => respond(true, {}),
};

const testMethodDefs = {
  "test.get": {
    params: TestParamsSchema,
    result: TestResultSchema,
    scope: "operator.read" as const,
  },
  "test.set": {
    params: TestParamsSchema,
    result: TestResultSchema,
    scope: "operator.write" as const,
  },
};

describe("buildMethodRegistry", () => {
  it("registers typed methods from methodDefs", () => {
    const registry = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    expect(registry.getDefinition("test.get")).toBeDefined();
    expect(registry.getDefinition("test.get")?.params).toBe(TestParamsSchema);
    expect(registry.getDefinition("test.get")?.result).toBe(TestResultSchema);
    expect(registry.getDefinition("test.get")?.scope).toBe("operator.read");
  });

  it("registers untyped methods (handlers without methodDefs)", () => {
    const registry = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    expect(registry.getDefinition("untyped.method")).toBeDefined();
    expect(registry.getDefinition("untyped.method")?.params).toBeUndefined();
    expect(registry.getDefinition("untyped.method")?.result).toBeUndefined();
  });

  it("lists all methods", () => {
    const registry = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    const methods = registry.listMethods();
    expect(methods).toContain("test.get");
    expect(methods).toContain("test.set");
    expect(methods).toContain("untyped.method");
  });

  it("getScopeForMethod returns correct scope", () => {
    const registry = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    expect(registry.getScopeForMethod("test.get")).toBe("operator.read");
  });

  it("describe returns typed and untyped lists", () => {
    const registry = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    const desc = registry.describe({ filter: "all", includeSchemas: false });
    expect(desc.protocol).toBeGreaterThan(0);
    expect(desc.methods["test.get"]).toBeDefined();
    expect(desc.methods["test.get"].scope).toBe("operator.read");
    expect(desc.untyped).toContain("untyped.method");
  });

  it("describe with filter=typed excludes untyped", () => {
    const registry = buildMethodRegistry(fakeHandlers, [testMethodDefs]);
    const desc = registry.describe({ filter: "typed" });
    expect(desc.methods["test.get"]).toBeDefined();
    expect(desc.methods["untyped.method"]).toBeUndefined();
    expect(desc.untyped).toEqual([]);
  });

  it("throws if methodDef references nonexistent handler", () => {
    const badDefs = {
      "nonexistent.method": {
        params: TestParamsSchema,
        result: TestResultSchema,
        scope: "operator.read" as const,
      },
    };
    expect(() => buildMethodRegistry(fakeHandlers, [badDefs])).toThrow(/nonexistent\.method/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/gateway/method-registry.test.ts -t "registers typed methods" -v`
Expected: FAIL — module `./method-registry.js` not found

- [ ] **Step 3: Implement method-registry.ts**

```typescript
// src/gateway/method-registry.ts
import type { TSchema } from "@sinclair/typebox";
import type { OperatorScope } from "./method-scopes.js";
import { PROTOCOL_VERSION } from "./protocol/schema/protocol-schemas.js";
import type { GatewayRequestHandler, GatewayRequestHandlers } from "./server-methods/types.js";

export interface MethodDefinition {
  handler: GatewayRequestHandler;
  params?: TSchema;
  result?: TSchema;
  scope: OperatorScope | "node" | "public";
  since?: number;
  deprecated?: boolean;
}

export type MethodMetadata = Omit<MethodDefinition, "handler">;

export interface EventDefinition {
  payload?: TSchema;
  since?: number;
}

export interface GatewayDescribePayload {
  protocol: number;
  schemaVersion: string;
  methods: Record<
    string,
    {
      params?: Record<string, unknown>;
      result?: Record<string, unknown>;
      scope: string;
      since?: number;
    }
  >;
  events: Record<
    string,
    {
      payload?: Record<string, unknown>;
    }
  >;
  untyped: string[];
}

export interface MethodRegistry {
  methods: ReadonlyMap<string, MethodDefinition>;
  events: ReadonlyMap<string, EventDefinition>;
  listMethods(): string[];
  listEvents(): string[];
  getDefinition(method: string): MethodDefinition | undefined;
  getEventDefinition(event: string): EventDefinition | undefined;
  getScopeForMethod(method: string): OperatorScope | "node" | "public" | undefined;
  describe(opts?: {
    filter?: "all" | "typed" | "untyped";
    includeSchemas?: boolean;
  }): GatewayDescribePayload;
}

function computeSchemaVersion(methods: ReadonlyMap<string, MethodDefinition>): string {
  // Deterministic version: protocol version + sorted method names hash
  const sorted = [...methods.keys()].sort().join(",");
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    hash = ((hash << 5) - hash + sorted.charCodeAt(i)) | 0;
  }
  return `${PROTOCOL_VERSION}.${(hash >>> 0).toString(36)}`;
}

export function buildMethodRegistry(
  handlers: GatewayRequestHandlers,
  metadataSets: Array<Record<string, MethodMetadata>>,
  eventDefs?: Record<string, EventDefinition>,
): MethodRegistry {
  const methods = new Map<string, MethodDefinition>();
  const events = new Map<string, EventDefinition>(Object.entries(eventDefs ?? {}));

  // Merge all metadata, validate handler existence
  const mergedMeta = new Map<string, MethodMetadata>();
  for (const defs of metadataSets) {
    for (const [method, meta] of Object.entries(defs)) {
      if (!handlers[method]) {
        throw new Error(
          `methodDefs references "${method}" but no handler exists. ` +
            `Check that the handler is registered in coreGatewayHandlers.`,
        );
      }
      mergedMeta.set(method, meta);
    }
  }

  // Register all handlers
  for (const [method, handler] of Object.entries(handlers)) {
    const meta = mergedMeta.get(method);
    methods.set(method, {
      handler,
      params: meta?.params,
      result: meta?.result,
      scope: meta?.scope ?? "public",
      since: meta?.since,
      deprecated: meta?.deprecated,
    });
  }

  const schemaVersion = computeSchemaVersion(methods);

  function isTyped(def: MethodDefinition): boolean {
    return def.params !== undefined || def.result !== undefined;
  }

  const registry: MethodRegistry = {
    methods,
    events,

    listMethods() {
      return [...methods.keys()];
    },

    listEvents() {
      return [...events.keys()];
    },

    getDefinition(method: string) {
      return methods.get(method);
    },

    getEventDefinition(event: string) {
      return events.get(event);
    },

    getScopeForMethod(method: string) {
      return methods.get(method)?.scope;
    },

    describe(opts) {
      const filter = opts?.filter ?? "all";
      const includeSchemas = opts?.includeSchemas ?? false;

      const result: GatewayDescribePayload = {
        protocol: PROTOCOL_VERSION,
        schemaVersion,
        methods: {},
        events: {},
        untyped: [],
      };

      for (const [name, def] of methods) {
        const typed = isTyped(def);
        if (filter === "typed" && !typed) {
          if (filter === "typed") result.untyped = []; // don't list untyped in typed filter
          continue;
        }
        if (filter === "untyped" && typed) {
          continue;
        }

        if (!typed) {
          result.untyped.push(name);
          continue;
        }

        const entry: {
          params?: Record<string, unknown>;
          result?: Record<string, unknown>;
          scope: string;
          since?: number;
        } = {
          scope: def.scope,
        };
        if (def.since !== undefined) entry.since = def.since;
        if (includeSchemas) {
          // TypeBox TSchema objects ARE JSON Schema — serialize directly
          if (def.params) entry.params = def.params as unknown as Record<string, unknown>;
          if (def.result) entry.result = def.result as unknown as Record<string, unknown>;
        }
        result.methods[name] = entry;
      }

      for (const [name, eventDef] of events) {
        const entry: { payload?: Record<string, unknown> } = {};
        if (includeSchemas && eventDef.payload) {
          entry.payload = eventDef.payload as unknown as Record<string, unknown>;
        }
        result.events[name] = entry;
      }

      return result;
    },
  };

  return registry;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/gateway/method-registry.test.ts -v`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(gateway): add MethodRegistry core types and builder" src/gateway/method-registry.ts src/gateway/method-registry.test.ts
```

---

### Task 2: P0 Result Schemas for `deck.*` Methods

**Files:**

- Modify: `src/gateway/protocol/schema/deck.ts`
- Modify: `src/gateway/protocol/schema/protocol-schemas.ts`

All result schemas are derived from the `respond(true, {...})` calls in each handler. Each schema uses the same naming convention: `DeckXxxResultSchema` parallel to existing `DeckXxxParamsSchema`.

- [ ] **Step 1: Add all deck result schemas to `deck.ts`**

Add the following result schemas to the end of `src/gateway/protocol/schema/deck.ts`. Each is derived from the corresponding handler's `respond(true, {...})` call.

```typescript
// === deck.routing.* results ===

const EnrichedBindingSchema = Type.Object({
  id: Type.String(),
  agentId: Type.String(),
  tier: Type.String(),
  match: Type.Object({
    channel: Type.String(),
    accountId: Type.Optional(Type.String()),
    peer: Type.Optional(Type.Object({ kind: Type.String(), id: Type.String() })),
    guildId: Type.Optional(Type.String()),
    roles: Type.Optional(Type.Array(Type.String())),
    teamId: Type.Optional(Type.String()),
  }),
  comment: Type.Optional(Type.String()),
});

const ConflictEntrySchema = Type.Object({
  type: Type.String(),
  bindingId: Type.String(),
  agentId: Type.String(),
  detail: Type.String(),
});

export const DeckRoutingListResultSchema = Type.Object({
  bindings: Type.Array(EnrichedBindingSchema),
  defaultAgentId: Type.String(),
  dmScope: Type.String(),
  configHash: Type.String(),
});

export const DeckRoutingAddResultSchema = Type.Object({
  ok: Type.Boolean(),
  binding: EnrichedBindingSchema,
  configHash: Type.String(),
  warnings: Type.Array(ConflictEntrySchema),
});

export const DeckRoutingRemoveResultSchema = Type.Object({
  ok: Type.Boolean(),
  removed: EnrichedBindingSchema,
  configHash: Type.String(),
  impact: Type.String(),
});

export const DeckRoutingValidateResultSchema = Type.Object({
  ok: Type.Boolean(),
  tier: Type.String(),
  conflicts: Type.Array(ConflictEntrySchema),
});

const SimulationTierSchema = Type.Object({
  tier: Type.String(),
  matched: Type.Boolean(),
  checked: Type.Boolean(),
});

export const DeckRoutingSimulateResultSchema = Type.Object({
  agentId: Type.String(),
  matchedBy: Type.String(),
  sessionKey: Type.String(),
  tiers: Type.Array(SimulationTierSchema),
});

// === deck.agents.* results ===

export const DeckAgentsDetailResultSchema = Type.Object({
  id: Type.String(),
  name: Type.Optional(Type.String()),
  workspace: Type.String(),
  model: Type.Optional(Type.String()),
  isDefault: Type.Boolean(),
  bindingCount: Type.Integer(),
  sessionCount: Type.Integer(),
  activeSubagentCount: Type.Integer(),
  skillMode: Type.String(),
  effectiveSkills: Type.Array(Type.String()),
  totalAvailableSkills: Type.Integer(),
  subagents: Type.Object({
    allowAgents: Type.Array(Type.String()),
    model: Type.Optional(Type.String()),
    effectiveMaxSpawnDepth: Type.Integer(),
    effectiveMaxChildrenPerAgent: Type.Integer(),
  }),
  sandbox: Type.Optional(Type.Unknown()),
  identityExists: Type.Boolean(),
  fallbackModels: Type.Optional(Type.Array(Type.String())),
});

const AvailableSkillSchema = Type.Object({
  key: Type.String(),
  name: Type.String(),
  eligible: Type.Boolean(),
  assigned: Type.Boolean(),
});

export const DeckAgentsSkillsGetResultSchema = Type.Object({
  agentId: Type.String(),
  mode: Type.String(),
  skills: Type.Array(Type.String()),
  available: Type.Array(AvailableSkillSchema),
  configHash: Type.String(),
});

export const DeckAgentsSkillsSetResultSchema = Type.Object({
  ok: Type.Boolean(),
  agentId: Type.String(),
  mode: Type.String(),
  skills: Type.Array(Type.String()),
  configHash: Type.String(),
});

const AgentEntrySchema = Type.Object({
  id: Type.String(),
  name: Type.Optional(Type.String()),
});

export const DeckAgentsSubagentsGetResultSchema = Type.Object({
  agentId: Type.String(),
  allowAgents: Type.Array(Type.String()),
  allowAny: Type.Boolean(),
  model: Type.Optional(Type.String()),
  effectiveMaxSpawnDepth: Type.Integer(),
  effectiveMaxChildrenPerAgent: Type.Integer(),
  effectiveThinking: Type.Optional(Type.Unknown()),
  allowedAgents: Type.Array(AgentEntrySchema),
  allAgents: Type.Array(AgentEntrySchema),
  configHash: Type.String(),
});

export const DeckAgentsSubagentsSetResultSchema = Type.Object({
  ok: Type.Boolean(),
  agentId: Type.String(),
  allowAgents: Type.Array(Type.String()),
  model: Type.Optional(Type.String()),
  configHash: Type.String(),
});

export const DeckAgentsEventStreamsGetResultSchema = Type.Object({
  agentId: Type.String(),
  eventStreams: Type.Array(Type.String()),
  isDefault: Type.Boolean(),
  configHash: Type.String(),
});

export const DeckAgentsEventStreamsSetResultSchema = Type.Object({
  ok: Type.Boolean(),
  agentId: Type.String(),
  eventStreams: Type.Array(Type.String()),
  configHash: Type.String(),
});

// === deck.agents preview results ===

const ToolPolicyLayerSchema = Type.Object({
  label: Type.String(),
  ruleCount: Type.Integer(),
  effect: Type.String(),
});

const ToolPolicyToolSchema = Type.Object({
  name: Type.String(),
  allowed: Type.Boolean(),
  decisiveLayer: Type.String(),
  trace: Type.Array(
    Type.Object({
      layer: Type.String(),
      decision: Type.String(),
    }),
  ),
});

export const DeckAgentsToolPolicyPreviewResultSchema = Type.Object({
  layers: Type.Array(ToolPolicyLayerSchema),
  tools: Type.Array(ToolPolicyToolSchema),
  configHash: Type.String(),
});

const PromptLayerSchema = Type.Object({
  label: Type.String(),
  source: Type.String(),
  charCount: Type.Integer(),
  fileCount: Type.Integer(),
});

const BootstrapFileStatSchema = Type.Object({
  name: Type.String(),
  exists: Type.Boolean(),
  charCount: Type.Integer(),
});

export const DeckAgentsSystemPromptPreviewResultSchema = Type.Object({
  layers: Type.Array(PromptLayerSchema),
  bootstrapFiles: Type.Array(BootstrapFileStatSchema),
  totalChars: Type.Integer(),
  configHash: Type.String(),
});

// === deck.subagents.* results ===

const SubagentRunSchema = Type.Object({
  runId: Type.String(),
  childSessionKey: Type.String(),
  childAgentId: Type.String(),
  childAgentName: Type.Optional(Type.String()),
  requesterSessionKey: Type.String(),
  requesterAgentId: Type.String(),
  requesterAgentName: Type.Optional(Type.String()),
  task: Type.Optional(Type.String()),
  label: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  spawnMode: Type.String(),
  depth: Type.Integer(),
  createdAt: Type.Number(),
  startedAt: Type.Optional(Type.Number()),
  endedAt: Type.Optional(Type.Number()),
  durationMs: Type.Optional(Type.Number()),
  status: Type.String(),
  outcome: Type.Optional(Type.Unknown()),
});

export const DeckSubagentsListResultSchema = Type.Object({
  runs: Type.Array(SubagentRunSchema),
  total: Type.Integer(),
});

export const DeckSubagentsKillResultSchema = Type.Object({
  ok: Type.Boolean(),
  runId: Type.String(),
  childSessionKey: Type.String(),
});

const LineageNodeSchema = Type.Object({
  runId: Type.String(),
  sessionKey: Type.String(),
  agentId: Type.String(),
  agentName: Type.Optional(Type.String()),
  task: Type.Optional(Type.String()),
  depth: Type.Integer(),
  parentRunId: Type.Union([Type.String(), Type.Null()]),
  status: Type.String(),
  durationMs: Type.Optional(Type.Number()),
});

export const DeckSubagentsLineageResultSchema = Type.Object({
  root: Type.Object({
    sessionKey: Type.String(),
    agentId: Type.String(),
    agentName: Type.Optional(Type.String()),
  }),
  nodes: Type.Array(LineageNodeSchema),
});

export const DeckSubagentsSteerResultSchema = Type.Object({
  success: Type.Boolean(),
  dedupKey: Type.Optional(Type.String()),
  deduped: Type.Optional(Type.Boolean()),
  newRunId: Type.Optional(Type.String()),
});

// === deck.identity.* results ===

const IdentityLinkSchema = Type.Object({
  canonical: Type.String(),
  peers: Type.Array(
    Type.Object({
      channel: Type.String(),
      peerId: Type.String(),
    }),
  ),
});

export const DeckIdentityListResultSchema = Type.Object({
  links: Type.Array(IdentityLinkSchema),
  configHash: Type.String(),
});

export const DeckIdentityLinkResultSchema = Type.Object({
  ok: Type.Boolean(),
  configHash: Type.String(),
});

export const DeckIdentityUnlinkResultSchema = Type.Object({
  ok: Type.Boolean(),
  configHash: Type.String(),
});

// === deck.threads.* results ===

const ThreadBindingSchema = Type.Object({
  threadId: Type.String(),
  channelId: Type.String(),
  agentId: Type.String(),
  targetSessionKey: Type.String(),
  targetKind: Type.String(),
  boundAt: Type.Number(),
  lastActivityAt: Type.Number(),
  accountId: Type.String(),
  boundBy: Type.String(),
  label: Type.Optional(Type.String()),
});

export const DeckThreadsListResultSchema = Type.Object({
  threads: Type.Array(ThreadBindingSchema),
});

// === deck.auth.* results ===
// NOTE: handlers are in src/gateway/server-methods/deck-auth.ts (NOT in deck/ subdir)

const AuthOverviewProviderSchema = Type.Object({
  provider: Type.String(),
  hasApiKey: Type.Boolean(),
  hasProfile: Type.Boolean(),
  envVar: Type.Optional(Type.String()),
  models: Type.Optional(Type.Array(Type.String())),
});

export const DeckAuthOverviewResultSchema = Type.Object({
  providers: Type.Array(AuthOverviewProviderSchema),
});

export const DeckAuthProbeResultSchema = Type.Object({
  provider: Type.String(),
  ok: Type.Boolean(),
  model: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
  latencyMs: Type.Optional(Type.Number()),
});
```

> **Note:** The `DeckAuthOverviewResultSchema` and `DeckAuthProbeResultSchema` must be derived from the actual `respond(true, {...})` calls in `src/gateway/server-methods/deck-auth.ts`. The schemas above are approximations — the implementer MUST read the handler code and verify every field.

- [ ] **Step 2: Register all new deck result schemas in `protocol-schemas.ts`**

Add all new result schemas to the `ProtocolSchemas` object in `src/gateway/protocol/schema/protocol-schemas.ts`. Add the import block and entries:

```typescript
// Add to imports from "./deck.js":
import {
  // ... existing params imports ...
  DeckRoutingListResultSchema,
  DeckRoutingAddResultSchema,
  DeckRoutingRemoveResultSchema,
  DeckRoutingValidateResultSchema,
  DeckRoutingSimulateResultSchema,
  DeckAgentsDetailResultSchema,
  DeckAgentsSkillsGetResultSchema,
  DeckAgentsSkillsSetResultSchema,
  DeckAgentsSubagentsGetResultSchema,
  DeckAgentsSubagentsSetResultSchema,
  DeckAgentsEventStreamsGetResultSchema,
  DeckAgentsEventStreamsSetResultSchema,
  DeckAgentsToolPolicyPreviewResultSchema,
  DeckAgentsSystemPromptPreviewResultSchema,
  DeckSubagentsListResultSchema,
  DeckSubagentsKillResultSchema,
  DeckSubagentsLineageResultSchema,
  DeckSubagentsSteerResultSchema,
  DeckIdentityListResultSchema,
  DeckIdentityLinkResultSchema,
  DeckIdentityUnlinkResultSchema,
  DeckThreadsListResultSchema,
} from "./deck.js";

// Add to ProtocolSchemas object (at end, before `} satisfies`):
  DeckRoutingListResult: DeckRoutingListResultSchema,
  DeckRoutingAddResult: DeckRoutingAddResultSchema,
  DeckRoutingRemoveResult: DeckRoutingRemoveResultSchema,
  DeckRoutingValidateResult: DeckRoutingValidateResultSchema,
  DeckRoutingSimulateResult: DeckRoutingSimulateResultSchema,
  DeckAgentsDetailResult: DeckAgentsDetailResultSchema,
  DeckAgentsSkillsGetResult: DeckAgentsSkillsGetResultSchema,
  DeckAgentsSkillsSetResult: DeckAgentsSkillsSetResultSchema,
  DeckAgentsSubagentsGetResult: DeckAgentsSubagentsGetResultSchema,
  DeckAgentsSubagentsSetResult: DeckAgentsSubagentsSetResultSchema,
  DeckAgentsEventStreamsGetResult: DeckAgentsEventStreamsGetResultSchema,
  DeckAgentsEventStreamsSetResult: DeckAgentsEventStreamsSetResultSchema,
  DeckAgentsToolPolicyPreviewResult: DeckAgentsToolPolicyPreviewResultSchema,
  DeckAgentsSystemPromptPreviewResult: DeckAgentsSystemPromptPreviewResultSchema,
  DeckSubagentsListResult: DeckSubagentsListResultSchema,
  DeckSubagentsKillResult: DeckSubagentsKillResultSchema,
  DeckSubagentsLineageResult: DeckSubagentsLineageResultSchema,
  DeckSubagentsSteerResult: DeckSubagentsSteerResultSchema,
  DeckIdentityListResult: DeckIdentityListResultSchema,
  DeckIdentityLinkResult: DeckIdentityLinkResultSchema,
  DeckIdentityUnlinkResult: DeckIdentityUnlinkResultSchema,
  DeckThreadsListResult: DeckThreadsListResultSchema,
  DeckAuthOverviewResult: DeckAuthOverviewResultSchema,
  DeckAuthProbeResult: DeckAuthProbeResultSchema,
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm tsgo`
Expected: Zero errors

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(gateway): add P0 result schemas for all deck.* methods" src/gateway/protocol/schema/deck.ts src/gateway/protocol/schema/protocol-schemas.ts
```

---

### Task 3: Deck Handler `methodDefs` Exports

**Files:**

- Modify: `src/gateway/server-methods/deck/agents.ts`
- Modify: `src/gateway/server-methods/deck/agents-preview.ts`
- Modify: `src/gateway/server-methods/deck/routing.ts`
- Modify: `src/gateway/server-methods/deck/subagents.ts`
- Modify: `src/gateway/server-methods/deck/subagents-steer.ts`
- Modify: `src/gateway/server-methods/deck/identity.ts`
- Modify: `src/gateway/server-methods/deck/threads.ts`
- Modify: `src/gateway/server-methods/deck/index.ts`

Each handler file gets a parallel `methodDefs` export that maps method name → `{ params, result, scope }`.

- [ ] **Step 1: Add `deckAgentsMethodDefs` to `deck/agents.ts`**

Add at the end of the file (after the existing `deckAgentsHandlers` export):

```typescript
import type { MethodMetadata } from "../../method-registry.js";
import {
  DeckAgentsDetailResultSchema,
  DeckAgentsSkillsGetResultSchema,
  DeckAgentsSkillsSetResultSchema,
  DeckAgentsSubagentsGetResultSchema,
  DeckAgentsSubagentsSetResultSchema,
  DeckAgentsEventStreamsGetResultSchema,
  DeckAgentsEventStreamsSetResultSchema,
} from "../../protocol/schema/deck.js";

export const deckAgentsMethodDefs: Record<string, MethodMetadata> = {
  "deck.agents.detail": {
    params: validateDeckAgentsDetailParams.schema,
    result: DeckAgentsDetailResultSchema,
    scope: "operator.read",
  },
  "deck.agents.skills.get": {
    params: validateDeckAgentsSkillsGetParams.schema,
    result: DeckAgentsSkillsGetResultSchema,
    scope: "operator.read",
  },
  "deck.agents.skills.set": {
    params: validateDeckAgentsSkillsSetParams.schema,
    result: DeckAgentsSkillsSetResultSchema,
    scope: "operator.write",
  },
  "deck.agents.subagents.get": {
    params: validateDeckAgentsSubagentsGetParams.schema,
    result: DeckAgentsSubagentsGetResultSchema,
    scope: "operator.read",
  },
  "deck.agents.subagents.set": {
    params: validateDeckAgentsSubagentsSetParams.schema,
    result: DeckAgentsSubagentsSetResultSchema,
    scope: "operator.write",
  },
  "deck.agents.eventStreams.get": {
    params: validateDeckAgentsEventStreamsGetParams.schema,
    result: DeckAgentsEventStreamsGetResultSchema,
    scope: "operator.read",
  },
  "deck.agents.eventStreams.set": {
    params: validateDeckAgentsEventStreamsSetParams.schema,
    result: DeckAgentsEventStreamsSetResultSchema,
    scope: "operator.write",
  },
};
```

Note: The `validateDeckAgentsDetailParams.schema` is the TypeBox `TSchema` on the compiled AJV validator. If validators don't expose `.schema`, import the schema directly from `../../protocol/schema/deck.js` instead (e.g. `DeckAgentsDetailParamsSchema`). The implementer must check which pattern works in this codebase. Importing the `*ParamsSchema` directly from `deck.ts` is the safer path.

- [ ] **Step 2: Add methodDefs to remaining deck handler files**

Apply the same pattern to each file. Each `methodDefs` export maps method names to `{ params: XxxParamsSchema, result: XxxResultSchema, scope }`.

**`deck/agents-preview.ts`** — add `deckAgentsPreviewMethodDefs`:

- `deck.agents.toolPolicy.preview` → scope `"operator.read"`
- `deck.agents.systemPrompt.preview` → scope `"operator.read"`

**`deck/routing.ts`** — add `deckRoutingMethodDefs`:

- `deck.routing.list` → scope `"operator.read"`
- `deck.routing.add` → scope `"operator.write"`
- `deck.routing.remove` → scope `"operator.write"`
- `deck.routing.validate` → scope `"operator.read"`
- `deck.routing.simulate` → scope `"operator.read"`

**`deck/subagents.ts`** — add `deckSubagentsMethodDefs`:

- `deck.subagents.list` → scope `"operator.read"`
- `deck.subagents.kill` → scope `"operator.write"`
- `deck.subagents.lineage` → scope `"operator.read"`

**`deck/subagents-steer.ts`** — add `deckSubagentsSteerMethodDefs`:

- `deck.subagents.steer` → scope `"operator.write"`

**`deck/identity.ts`** — add `deckIdentityMethodDefs`:

- `deck.identity.list` → scope `"operator.read"`
- `deck.identity.link` → scope `"operator.write"`
- `deck.identity.unlink` → scope `"operator.write"`

**`deck/threads.ts`** — add `deckThreadsMethodDefs`:

- `deck.threads.list` → scope `"operator.read"`

- [ ] **Step 2b: Add `deckAuthMethodDefs` to `src/gateway/server-methods/deck-auth.ts`**

**IMPORTANT:** `deck-auth.ts` is NOT in the `deck/` subdirectory — it lives at `src/gateway/server-methods/deck-auth.ts` directly. Add a parallel methodDefs export:

- `deck.auth.overview` → scope `"operator.read"`
- `deck.auth.probe` → scope `"operator.read"`

The implementer must read the handler at `deck-auth.ts:88` and `deck-auth.ts` (probe handler) to derive the correct params schema references.

- [ ] **Step 3: Update `deck/index.ts` to re-export and merge all methodDefs**

```typescript
import type { GatewayRequestHandlers } from "../types.js";
import type { MethodMetadata } from "../../method-registry.js";
import { deckAgentsPreviewHandlers, deckAgentsPreviewMethodDefs } from "./agents-preview.js";
import { deckAgentsHandlers, deckAgentsMethodDefs } from "./agents.js";
import { deckIdentityHandlers, deckIdentityMethodDefs } from "./identity.js";
import { deckRoutingHandlers, deckRoutingMethodDefs } from "./routing.js";
import { deckSubagentsSteerHandlers, deckSubagentsSteerMethodDefs } from "./subagents-steer.js";
import { deckSubagentsHandlers, deckSubagentsMethodDefs } from "./subagents.js";
import { deckThreadsHandlers, deckThreadsMethodDefs } from "./threads.js";

export const deckHandlers: GatewayRequestHandlers = {
  ...deckRoutingHandlers,
  ...deckAgentsHandlers,
  ...deckAgentsPreviewHandlers,
  ...deckSubagentsHandlers,
  ...deckSubagentsSteerHandlers,
  ...deckIdentityHandlers,
  ...deckThreadsHandlers,
};

export const deckMethodDefs: Record<string, MethodMetadata> = {
  ...deckRoutingMethodDefs,
  ...deckAgentsMethodDefs,
  ...deckAgentsPreviewMethodDefs,
  ...deckSubagentsMethodDefs,
  ...deckSubagentsSteerMethodDefs,
  ...deckIdentityMethodDefs,
  ...deckThreadsMethodDefs,
};
```

- [ ] **Step 4: Verify TypeScript compiles and existing tests pass**

Run: `pnpm tsgo && pnpm test -- src/gateway/server-methods/deck/ -v`
Expected: Zero type errors, all existing deck handler tests pass

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(gateway): add methodDefs exports to all deck handler files" src/gateway/server-methods/deck/
```

---

### Task 4: Registry Assembly + `gateway.describe` RPC

**Files:**

- Modify: `src/gateway/server-methods.ts`
- Modify: `src/gateway/server-methods-list.ts`
- Create: `src/gateway/server-methods/describe.ts`
- Create: `src/gateway/server-methods/describe.test.ts`
- Modify: `src/gateway/protocol/schema/frames.ts` (schemaVersion in HelloOk)

- [ ] **Step 1: Write describe handler test**

```typescript
// src/gateway/server-methods/describe.test.ts
import { describe, expect, it, vi } from "vitest";

// We test the describe handler via a mock registry to avoid importing the full server-methods assembly
describe("gateway.describe handler", () => {
  it("returns protocol version and method list", async () => {
    // This test validates the handler integration; full registry tests are in method-registry.test.ts
    // The handler delegates to registry.describe(), so we verify the wiring
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const desc = gatewayMethodRegistry.describe({ filter: "all" });
    expect(desc.protocol).toBe(3);
    expect(typeof desc.schemaVersion).toBe("string");
    expect(desc.methods).toBeDefined();
    // deck.agents.detail should be typed
    expect(desc.methods["deck.agents.detail"]).toBeDefined();
    expect(desc.methods["deck.agents.detail"].scope).toBe("operator.read");
  });

  it("lists untyped methods separately", async () => {
    const { gatewayMethodRegistry } = await import("../server-methods.js");
    const desc = gatewayMethodRegistry.describe({ filter: "all" });
    // P2 methods without result schemas show in untyped
    expect(desc.untyped.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Create `describe.ts` handler**

```typescript
// src/gateway/server-methods/describe.ts
import type { GatewayRequestHandlers } from "./types.js";

// Registry is injected at assembly time to avoid circular imports
let registryRef: {
  describe: (opts?: { filter?: "all" | "typed" | "untyped"; includeSchemas?: boolean }) => unknown;
} | null = null;

export function setDescribeRegistry(registry: typeof registryRef) {
  registryRef = registry;
}

export const describeHandlers: GatewayRequestHandlers = {
  "gateway.describe": ({ params, respond }) => {
    if (!registryRef) {
      respond(false, undefined, { code: "UNAVAILABLE", message: "registry not initialized" });
      return;
    }
    const filter = (params?.filter as "all" | "typed" | "untyped") ?? "all";
    const includeSchemas = (params?.includeSchemas as boolean) ?? false;
    const result = registryRef.describe({ filter, includeSchemas });
    respond(true, result);
  },
};
```

- [ ] **Step 3: Assemble registry in `server-methods.ts`**

Add the following at the end of the existing file (after `coreGatewayHandlers` and before `handleGatewayRequest`):

```typescript
import { buildMethodRegistry } from "./method-registry.js";
import { deckMethodDefs } from "./server-methods/deck/index.js";
import { deckAuthMethodDefs } from "./server-methods/deck-auth.js";
import { describeHandlers, setDescribeRegistry } from "./server-methods/describe.js";

// Add describeHandlers to coreGatewayHandlers spread:
// ...deckHandlers,
// ...describeHandlers,  ← add this line

// Assemble the method registry (metadata-only, no runtime behavior change)
export const gatewayMethodRegistry = buildMethodRegistry(
  coreGatewayHandlers,
  [deckMethodDefs, deckAuthMethodDefs],
  // P1 upstream methodDefs will be added in a follow-up task
);

// Wire describe handler to registry
setDescribeRegistry(gatewayMethodRegistry);
```

- [ ] **Step 4: Add `"gateway.describe"` to `server-methods-list.ts`**

Add `"gateway.describe"` to `BASE_METHODS` array (after `"deck.auth.probe"`):

```typescript
  // deck.auth
  "deck.auth.overview",
  "deck.auth.probe",
  // gateway introspection
  "gateway.describe",
```

- [ ] **Step 5: Add `gateway.describe` to method-scopes classification**

In `src/gateway/method-scopes.ts`, add `"gateway.describe"` to the `READ_SCOPE` group in `METHOD_SCOPE_GROUPS`. Without this, the existing test at `method-scopes.test.ts:74-86` ("all handlers and list methods are classified") will fail.

```typescript
  [READ_SCOPE]: [
    "health",
    "doctor.memory.status",
    // ... existing entries ...
    "gateway.describe",  // ← add this
  ],
```

- [ ] **Step 6: Add `schemaVersion` to HelloOk features schema + injection point**

**Schema** — In `src/gateway/protocol/schema/frames.ts`, add `schemaVersion` to the `features` object in `HelloOkSchema`:

```typescript
    features: Type.Object(
      {
        methods: Type.Array(NonEmptyString),
        events: Type.Array(NonEmptyString),
        schemaVersion: Type.Optional(NonEmptyString),  // ← add this
      },
      { additionalProperties: false },
    ),
```

**Injection** — In `src/gateway/server/ws-connection/message-handler.ts`, at the hello-ok emission point (~line 976), add `schemaVersion` to the features object:

```typescript
features: {
  methods: gatewayMethods,
  events,
  schemaVersion: gatewayMethodRegistry?.describe()?.schemaVersion,  // ← add this
},
```

The implementer must check the exact import path and whether `gatewayMethodRegistry` is accessible in this scope. If not, expose a `getSchemaVersion()` function from `server-methods.ts`.

- [ ] **Step 7: Run tests**

Run: `pnpm test -- src/gateway/method-registry.test.ts src/gateway/server-methods/describe.test.ts src/gateway/method-scopes.test.ts -v`
Expected: All tests pass (including method-scopes classification test)

- [ ] **Step 8: Commit**

```bash
scripts/committer "[enhanced] feat(gateway): assemble MethodRegistry and add gateway.describe RPC" src/gateway/server-methods.ts src/gateway/server-methods-list.ts src/gateway/server-methods/describe.ts src/gateway/server-methods/describe.test.ts src/gateway/protocol/schema/frames.ts src/gateway/method-registry.ts src/gateway/method-scopes.ts src/gateway/server/ws-connection/message-handler.ts
```

---

### Task 5: Codegen Script

**Files:**

- Create: `scripts/protocol-gen-ts.ts`
- Create: `src/gateway/method-registry-data.ts` (side-effect-free registry data export)
- Modify: `package.json` (add npm scripts)

The codegen script must NOT directly import `server-methods.ts` — that module tree triggers side-effects (`tmp-openclaw-dir.ts`, `logging.ts`) that fail outside a running Gateway process. Instead, a new side-effect-free module exports only the registry metadata.

**Critical codegen rules (from review):**

1. **Side-effect-free import**: Use a dedicated `method-registry-data.ts` that only exports methodDefs + handler keys, no handler implementations
2. **Illegal identifiers**: Methods like `last-heartbeat`, `set-heartbeats`, `system-presence`, `system-event` contain `-` or are bare words — use quoted property names `["last-heartbeat"]` in generated client
3. **Empty object schemas**: `Type.Object({})` (e.g. `DeckIdentityListParamsSchema`) must NOT generate `export interface X Record<string, unknown>` — use `export type X = Record<string, never>` or `export interface X {}`
4. **`mkdirSync`**: `dashboard/src/types/` does not exist yet — must create directory before writing
5. **`Type.Record(K, V)`**: Outputs `{ type: "object", patternProperties: {...} }` without `properties` — handle via patternProperties detection → `Record<K, V>`
6. **Method tree collisions**: `agent` (leaf) vs `agent.wait` (subtree) — detect and handle gracefully

- [ ] **Step 1a: Create side-effect-free registry data export**

Create `src/gateway/method-registry-data.ts` — a module that re-exports only the metadata (methodDefs, handler keys, event defs) without importing any handler implementations or their transitive side-effects.

```typescript
// src/gateway/method-registry-data.ts
// Side-effect-free export for codegen consumption.
// MUST NOT import handler implementations or modules with side-effects.
import type { MethodMetadata } from "./method-registry.js";
import { deckMethodDefs } from "./server-methods/deck/index.js";
import { deckAuthMethodDefs } from "./server-methods/deck-auth-defs.js"; // defs-only file
import { PROTOCOL_VERSION } from "./protocol/schema/protocol-schemas.js";
import { listGatewayMethods, GATEWAY_EVENTS } from "./server-methods-list.js";

// All P0 methodDefs (deck.* only for now)
export const allMethodDefs: Record<string, MethodMetadata> = {
  ...deckMethodDefs,
  ...deckAuthMethodDefs,
};

// All known method names (for allowlist generation)
export const allMethodNames = listGatewayMethods();

// All known event names
export const allEventNames = GATEWAY_EVENTS;

export { PROTOCOL_VERSION };
```

**Note:** If `deckAuthMethodDefs` is exported from `deck-auth.ts` (which imports handler deps with side-effects), extract the defs into a separate `deck-auth-defs.ts` file that only exports the metadata and schema imports. The implementer must verify the actual import tree is side-effect-free by running `bun -e 'import("./src/gateway/method-registry-data.js")'` — if it fails, trace and extract.

- [ ] **Step 1b: Write the codegen script**

```typescript
// scripts/protocol-gen-ts.ts
/**
 * TypeScript codegen for Gateway Protocol SDK.
 *
 * Reads registry metadata (side-effect-free) and emits:
 *   - dashboard/src/types/gateway-protocol.generated.ts (type definitions)
 *   - dashboard/src/types/gateway-client.generated.ts (typed client + allowlist)
 *
 * Usage:
 *   bun scripts/protocol-gen-ts.ts          # generate
 *   bun scripts/protocol-gen-ts.ts --check  # verify up-to-date
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import type { TSchema } from "@sinclair/typebox";
import {
  allMethodDefs,
  allMethodNames,
  allEventNames,
  PROTOCOL_VERSION,
} from "../src/gateway/method-registry-data.js";

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const PROTOCOL_OUT = resolve(ROOT, "dashboard/src/types/gateway-protocol.generated.ts");
const CLIENT_OUT = resolve(ROOT, "dashboard/src/types/gateway-client.generated.ts");
const CHECK_MODE = process.argv.includes("--check");

// --- Schema → TypeScript type string conversion ---

function schemaToTS(schema: TSchema, indent = 0): string {
  const pad = "  ".repeat(indent);
  const kind = (schema as { type?: string }).type;

  if ("const" in schema) {
    const val = (schema as { const: unknown }).const;
    return typeof val === "string" ? `"${val}"` : String(val);
  }

  if (kind === "string") return "string";
  if (kind === "number" || kind === "integer") return "number";
  if (kind === "boolean") return "boolean";
  if (kind === "null") return "null";

  if (kind === "array") {
    const items = (schema as { items?: TSchema }).items;
    if (!items) return "unknown[]";
    return `${schemaToTS(items, indent)}[]`;
  }

  if (kind === "object") {
    // Type.Record() → { patternProperties: { "^(.*)$": valueSchema } }
    const patternProps = (schema as { patternProperties?: Record<string, TSchema> })
      .patternProperties;
    if (patternProps) {
      const valueSchema = Object.values(patternProps)[0];
      return valueSchema
        ? `Record<string, ${schemaToTS(valueSchema, indent)}>`
        : "Record<string, unknown>";
    }

    const props = (schema as { properties?: Record<string, TSchema> }).properties;
    // Empty object schema → empty interface body
    if (!props || Object.keys(props).length === 0) return "{}";
    const required = new Set((schema as { required?: string[] }).required ?? []);
    const lines = Object.entries(props).map(([key, propSchema]) => {
      const opt = required.has(key) ? "" : "?";
      return `${pad}  ${key}${opt}: ${schemaToTS(propSchema, indent + 1)};`;
    });
    return `{\n${lines.join("\n")}\n${pad}}`;
  }

  // Union types
  if ("anyOf" in schema) {
    const variants = (schema as { anyOf: TSchema[] }).anyOf;
    return variants.map((v) => schemaToTS(v, indent)).join(" | ");
  }

  return "unknown";
}

/** Check if a string is a valid JS identifier (safe to use unquoted as object key). */
function isSafeIdentifier(s: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(s);
}

// --- Generate protocol types ---

function generateProtocolTypes(): string {
  const lines: string[] = ["// Auto-generated by scripts/protocol-gen-ts.ts — DO NOT EDIT", ""];

  lines.push(`export const GENERATED_SCHEMA_VERSION = "${PROTOCOL_VERSION}";`);
  lines.push("");

  // Per-method params + result interfaces (only typed methods)
  const methodEntries: string[] = [];

  for (const [method, def] of Object.entries(allMethodDefs)) {
    if (!def.params && !def.result) continue;

    const safeName = methodToInterfaceName(method);

    if (def.params) {
      const body = schemaToTS(def.params);
      // Empty body {} → use `type` alias, otherwise `interface`
      if (body === "{}") {
        lines.push(`export type ${safeName}Params = Record<string, never>;`);
      } else {
        lines.push(`export interface ${safeName}Params ${body}`);
      }
      lines.push("");
    }

    if (def.result) {
      const body = schemaToTS(def.result);
      if (body === "{}") {
        lines.push(`export type ${safeName}Result = Record<string, never>;`);
      } else {
        lines.push(`export interface ${safeName}Result ${body}`);
      }
      lines.push("");
    }

    const paramsType = def.params ? `${safeName}Params` : "Record<string, unknown>";
    const resultType = def.result ? `${safeName}Result` : "unknown";
    methodEntries.push(`  "${method}": { params: ${paramsType}; result: ${resultType} };`);
  }

  lines.push("export interface GatewayMethodMap {");
  lines.push(...methodEntries);
  lines.push("}");
  lines.push("");
  lines.push("export type GatewayMethodName = keyof GatewayMethodMap;");
  lines.push("");

  return lines.join("\n") + "\n";
}

// --- Generate client ---

function generateClient(): string {
  const lines: string[] = [
    "// Auto-generated by scripts/protocol-gen-ts.ts — DO NOT EDIT",
    "",
    'import type { GatewayMethodMap, GatewayMethodName } from "./gateway-protocol.generated";',
    "",
    "export type GatewayRequestFn = <M extends GatewayMethodName>(",
    "  method: M,",
    '  params: GatewayMethodMap[M]["params"],',
    "  options?: { timeoutMs?: number },",
    ') => Promise<GatewayMethodMap[M]["result"]>;',
    "",
  ];

  // Build method list for allowlist (ALL methods, not just typed)
  lines.push(`export const GENERATED_METHOD_ALLOWLIST: ReadonlySet<string> = new Set([`);
  for (const m of [...allMethodNames].sort()) {
    lines.push(`  "${m}",`);
  }
  lines.push("]);");
  lines.push("");

  // Build typed client interface + factory
  // Only typed methods get a nested client interface; untyped go in allowlist only
  const typedMethods = Object.keys(allMethodDefs).filter(
    (m) => allMethodDefs[m].params || allMethodDefs[m].result,
  );
  const tree = buildMethodTree(typedMethods);
  lines.push("export interface GatewayClient {");
  renderClientInterface(tree, lines, 1);
  lines.push("}");
  lines.push("");

  lines.push("export function createGatewayClient(request: GatewayRequestFn): GatewayClient {");
  lines.push("  return {");
  renderClientFactory(tree, lines, 2, "request");
  lines.push("  };");
  lines.push("}");
  lines.push("");

  return lines.join("\n") + "\n";
}

type MethodTree = Map<string, MethodTree | string>; // leaf = full method name

function buildMethodTree(methods: string[]): MethodTree {
  const root: MethodTree = new Map();
  for (const method of methods) {
    const parts = method.split(".");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.has(parts[i])) node.set(parts[i], new Map());
      const next = node.get(parts[i]);
      if (typeof next === "string") break; // collision, skip
      node = next as MethodTree;
    }
    node.set(parts[parts.length - 1], method);
  }
  return root;
}

function quoteKey(key: string): string {
  return isSafeIdentifier(key) ? key : `"${key}"`;
}

function renderClientInterface(tree: MethodTree, lines: string[], depth: number) {
  const pad = "  ".repeat(depth);
  for (const [key, value] of tree) {
    const qk = quoteKey(key);
    if (typeof value === "string") {
      const method = value;
      const def = allMethodDefs[method];
      if (def?.params && def?.result) {
        const name = methodToInterfaceName(method);
        lines.push(
          `${pad}${qk}(params: import("./gateway-protocol.generated").${name}Params, options?: { timeoutMs?: number }): Promise<import("./gateway-protocol.generated").${name}Result>;`,
        );
      } else {
        lines.push(
          `${pad}${qk}(params: Record<string, unknown>, options?: { timeoutMs?: number }): Promise<unknown>;`,
        );
      }
    } else {
      lines.push(`${pad}${qk}: {`);
      renderClientInterface(value, lines, depth + 1);
      lines.push(`${pad}};`);
    }
  }
}

function renderClientFactory(tree: MethodTree, lines: string[], depth: number, reqVar: string) {
  const pad = "  ".repeat(depth);
  for (const [key, value] of tree) {
    const qk = quoteKey(key);
    if (typeof value === "string") {
      lines.push(
        `${pad}${qk}: (params: any, options?: any) => ${reqVar}("${value}" as any, params, options),`,
      );
    } else {
      lines.push(`${pad}${qk}: {`);
      renderClientFactory(value, lines, depth + 1, reqVar);
      lines.push(`${pad}},`);
    }
  }
}

function methodToInterfaceName(method: string): string {
  return method
    .split(".")
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join("");
}

// --- Main ---

const protocolContent = generateProtocolTypes();
const clientContent = generateClient();

if (CHECK_MODE) {
  let exitCode = 0;
  for (const [path, expected] of [
    [PROTOCOL_OUT, protocolContent],
    [CLIENT_OUT, clientContent],
  ] as const) {
    if (!existsSync(path)) {
      console.error(`MISSING: ${path}`);
      exitCode = 1;
      continue;
    }
    const actual = readFileSync(path, "utf-8");
    if (actual !== expected) {
      console.error(`DRIFT: ${path} — run 'pnpm protocol:gen:ts' to regenerate`);
      exitCode = 1;
    }
  }
  if (exitCode === 0) {
    console.log("protocol:gen:check — all files up to date");
  }
  process.exit(exitCode);
} else {
  // Ensure output directories exist
  mkdirSync(dirname(PROTOCOL_OUT), { recursive: true });
  mkdirSync(dirname(CLIENT_OUT), { recursive: true });
  writeFileSync(PROTOCOL_OUT, protocolContent);
  writeFileSync(CLIENT_OUT, clientContent);
  console.log(`wrote ${PROTOCOL_OUT}`);
  console.log(`wrote ${CLIENT_OUT}`);
}
```

**Important:** The `schemaToTS` function handles the core TypeBox types used in deck schemas (`Type.Object`, `Type.Array`, `Type.String`, `Type.Integer`, `Type.Boolean`, `Type.Optional`, `Type.Union`, `Type.Literal`, `Type.Record`, `Type.Unknown`). If P1 upstream schemas introduce additional TypeBox constructs (e.g. `Type.Intersect`), extend the function at that time.

- [ ] **Step 2: Add npm scripts to `package.json`**

Add to the `"scripts"` section:

```json
"protocol:gen:ts": "bun scripts/protocol-gen-ts.ts",
"protocol:gen:check": "bun scripts/protocol-gen-ts.ts --check"
```

- [ ] **Step 3: Run codegen and verify output**

Run: `pnpm protocol:gen:ts`
Expected: Two files written to `dashboard/src/types/`

- [ ] **Step 4: Verify TypeScript compiles with generated files**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero errors (generated types are syntactically valid)

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(gateway): add TypeScript protocol codegen script" scripts/protocol-gen-ts.ts package.json dashboard/src/types/gateway-protocol.generated.ts dashboard/src/types/gateway-client.generated.ts
```

---

### Task 6: Deck Migration — Typed Client Setup

**Files:**

- Modify: `dashboard/server/runtime.ts`
- Modify: `dashboard/server/gateway-adapter.ts`
- Modify: `dashboard/server/gateway-allowlist.ts`
- Modify: `dashboard/src/lib/api-helpers.ts`

This task wires up the typed client infrastructure. The next task migrates individual route files.

- [ ] **Step 1: Add typed client to runtime**

In `dashboard/server/runtime.ts`, add the typed client to `DeckRuntime`:

```typescript
import { createGatewayClient, type GatewayClient } from "../src/types/gateway-client.generated";

export type DeckRuntime = {
  adapter: OpenClawGatewayAdapter;
  gw: GatewayClient; // ← add this
  eventBus: EventBus;
  db: Database;
  store: ProjectionStore;
  rateLimiter: ReturnType<typeof createRateLimiter>;
};
```

In the runtime initialization function, after `adapter` is created:

```typescript
const gw = createGatewayClient((method, params, options) =>
  adapter.request(method, params, options),
);
```

Add `gw` to the returned runtime object.

- [ ] **Step 2: Update gateway-allowlist.ts to derive from generated allowlist**

Replace the content of `dashboard/server/gateway-allowlist.ts`:

```typescript
/**
 * Gateway method allowlist — derived from generated protocol registry.
 *
 * GENERATED_METHOD_ALLOWLIST covers all methods the registry knows about.
 * EXTRA_METHODS covers untyped methods the Deck still calls that don't have
 * methodDefs yet (e.g. upstream P2 methods).
 */
import { GENERATED_METHOD_ALLOWLIST } from "../src/types/gateway-client.generated";

const EXTRA_METHODS = new Set<string>([
  // Add any untyped methods the Deck needs here (should shrink to zero over time)
  "sessions.usage",
  "sessions.resolve",
  "sessions.subscribe",
  "sessions.unsubscribe",
  "sessions.messages.subscribe",
  "sessions.messages.unsubscribe",
  "sessions.compact",
  "chat.inject",
]);

export const DEFAULT_METHOD_ALLOWLIST = new Set<string>([
  ...GENERATED_METHOD_ALLOWLIST,
  ...EXTRA_METHODS,
]);
```

The implementer must verify the complete list of methods in the current `DEFAULT_METHOD_ALLOWLIST` that aren't in `GENERATED_METHOD_ALLOWLIST` and add them to `EXTRA_METHODS`.

- [ ] **Step 3: Add typed `gatewayRequest` that uses `gw`**

Update `dashboard/src/lib/api-helpers.ts` to provide a typed version:

```typescript
import type { GatewayMethodMap, GatewayMethodName } from "@/types/gateway-protocol.generated";
import { getRuntime } from "@server/runtime";
import { NextResponse } from "next/server";

type ErrorBody = { error: string; code?: string };
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** Typed gateway request — calls gw.* under the hood. */
export async function gwRequest<M extends GatewayMethodName>(
  method: M,
  params: GatewayMethodMap[M]["params"],
  options?: { timeoutMs?: number },
): Promise<NextResponse> {
  const runtime = getRuntime();
  if (!runtime) {
    return NextResponse.json({ error: "Gateway not configured" } satisfies ErrorBody, {
      status: 503,
    });
  }

  try {
    const data = await runtime.adapter.request(method, params, options);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof (await import("@server/gateway-adapter")).ControlPlaneGatewayError) {
      return NextResponse.json({ error: err.message, code: err.code } satisfies ErrorBody, {
        status: 502,
      });
    }
    const message = IS_PRODUCTION
      ? "Internal server error"
      : err instanceof Error
        ? err.message
        : "Unknown error";
    return NextResponse.json({ error: message } satisfies ErrorBody, { status: 500 });
  }
}

/**
 * @deprecated Use `gwRequest()` instead for type-safe gateway calls.
 */
export async function gatewayRequest(
  method: string,
  params: unknown,
  options?: { timeoutMs?: number },
): Promise<NextResponse> {
  return gwRequest(method as GatewayMethodName, params as any, options);
}
```

- [ ] **Step 4: Verify setup compiles**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero errors

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(deck): wire typed gateway client to runtime" dashboard/server/runtime.ts dashboard/server/gateway-adapter.ts dashboard/server/gateway-allowlist.ts dashboard/src/lib/api-helpers.ts
```

---

### Task 7: Deck Migration — API Route Files (P0: `deck.*` routes only)

**Files:**

- Modify: `dashboard/src/app/api/deck/**/*.ts` (~6 route files, 23 call sites)
- Modify: `dashboard/src/app/api/models/auth/route.ts` (1 call: `deck.auth.overview`)
- Modify: `dashboard/src/app/api/models/probe/route.ts` (1 call: `deck.auth.probe`)

P0 scope: Only migrate `deck.*` method calls (which have typed result schemas). Upstream method calls (`sessions.*`, `config.*`, `channels.*`, etc.) remain as untyped `gatewayRequest()` until P1 result schemas are added.

- [ ] **Step 1: Migrate `deck.*` route files**

For each route file that calls `deck.*` methods, replace `gatewayRequest` with `gwRequest`:

```typescript
// Before:
return gatewayRequest("deck.agents.detail", { agentId });

// After:
return gwRequest("deck.agents.detail", { agentId });
```

Specific files to migrate:

1. `dashboard/src/app/api/deck/agents/route.ts` — 11 calls (all `deck.agents.*`)
2. `dashboard/src/app/api/deck/routing/route.ts` — 5 calls (all `deck.routing.*`)
3. `dashboard/src/app/api/deck/subagents/route.ts` — 4 calls (all `deck.subagents.*`)
4. `dashboard/src/app/api/deck/identity/route.ts` — 3 calls (all `deck.identity.*`)
5. `dashboard/src/app/api/deck/threads/route.ts` — 1 call (`deck.threads.list`)
6. `dashboard/src/app/api/models/auth/route.ts` — 1 call (`deck.auth.overview`)
7. `dashboard/src/app/api/models/probe/route.ts` — 1 call (`deck.auth.probe`)

Files that use ONLY untyped methods should NOT be changed in this task:

- `dashboard/src/app/api/deck/tools-effective/route.ts` — calls `tools.effective` (not a `deck.*` method, no result schema)
- `dashboard/src/app/api/deck/canvas/route.ts` — uses `getNodeConnection()` directly, not `gatewayRequest`

- [ ] **Step 2: Verify deck.\* migration is complete**

Run: `grep -rn "gatewayRequest.*deck\\." dashboard/src/app/api/ --include="*.ts"`
Expected: Zero results (all `deck.*` calls migrated)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero errors

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] refactor(deck): migrate API routes to typed gwRequest()" dashboard/src/app/api/
```

---

### Task 8: Deck Migration — Replace Hand-Written Interfaces (P0 deck-only stores)

**Files:**

- Modify: `dashboard/src/stores/deck-agents.ts` (15 interfaces → generated)
- Modify: `dashboard/src/stores/deck-routing.ts` (5 interfaces → generated)
- Modify: `dashboard/src/stores/deck-subagents.ts` (2 interfaces → generated)

**NOT in P0 scope** (depend on P1 upstream result schemas):

- `dashboard/src/stores/channels.ts` — 5 interfaces (`ChannelInfo`, `ChannelAccount`, etc.) depend on `channels.status` result schema (P1)
- `dashboard/src/stores/models.ts` — 11 interfaces (`Model`, `ProviderConfig`, `AuthOverviewEntry`, etc.) depend on `models.list`, `usage.cost` etc. result schemas (P1)

Replace hand-written interfaces with imports from generated types.

- [ ] **Step 1: Migrate `deck-agents.ts` interfaces**

Replace hand-written interfaces (`AgentDetail`, `ToolPolicyLayer`, `ToolPolicyTool`, `PromptLayer`, `BootstrapFileEntry`, `SystemPromptPreview`, `BootstrapFileDetail`, `SkillEntry`, `AgentSkills`, `AgentSubagentConfig`, `AgentEventStreamsConfig`, `EffectiveToolEntry`, `EffectiveToolGroup`, `AgentRawConfig`) with imports from generated types.

```typescript
import type {
  DeckAgentsDetailResult as AgentDetail,
  DeckAgentsSkillsGetResult as AgentSkills,
  DeckAgentsSubagentsGetResult as AgentSubagentConfig,
  DeckAgentsEventStreamsGetResult as AgentEventStreamsConfig,
  DeckAgentsToolPolicyPreviewResult as ToolPolicyPreview,
  DeckAgentsSystemPromptPreviewResult as SystemPromptPreview,
} from "@/types/gateway-protocol.generated";
```

Delete the hand-written `export interface` declarations. Any properties that the store adds locally (not from the gateway response) should remain as extensions:

```typescript
// If the store adds local-only fields, extend:
export type AgentDetailWithLocal = AgentDetail & { localField?: string };
```

The implementer must compare every field in the hand-written interface against the generated type and handle any mismatches (e.g. the hand-written `AgentDetail` has an `emoji?` field at `deck-agents.ts:10` that the gateway handler does NOT return — this is a local-only field that must be kept as an extension).

- [ ] **Step 2: Migrate `deck-routing.ts` interfaces**

Replace `Binding`, `BindingMatch`, `ValidationResult`, `SimulationTier`, `SimulationResult` with imports from generated types.

**Watch out:** `deck-routing.ts:16-18` has `guild?` and `team?` aliases in `BindingMatch` that are NOT in the gateway response — these are UI-only aliases and must be kept as extensions.

- [ ] **Step 3: Migrate `deck-subagents.ts` interfaces**

Replace `SubagentRun`, `LineageNode` with imports from generated types.

- [ ] **Step 4: Fix all downstream import consumers**

After deleting store interfaces, any component that imports from these stores will have broken imports. Fix them to import from the generated types file or from the re-exports in stores.

Run: `cd dashboard && pnpm tsc --noEmit`
Fix all errors iteratively.

- [ ] **Step 5: Verify zero hand-written type casts remain for migrated types**

Run: `grep -rn "as AgentDetail\|as Binding\|as SubagentRun" dashboard/src/ --include="*.ts" --include="*.tsx"`
Expected: Zero results (note: `as ChannelInfo` and `as Model` are OK — they're P1 scope)

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] refactor(deck): replace hand-written interfaces with generated types" dashboard/src/stores/ dashboard/src/components/
```

---

### Task 9: Verification + CI Guards

**Files:**

- Modify: `package.json` (if needed)

- [ ] **Step 1: Run full type check**

Run: `pnpm tsgo`
Expected: Zero errors

- [ ] **Step 2: Run protocol codegen drift check**

Run: `pnpm protocol:gen:check`
Expected: "all files up to date"

- [ ] **Step 3: Verify `deck.*` gatewayRequest calls are all migrated**

Run: `grep -rn 'gatewayRequest.*"deck\.' dashboard/src/app/api/ --include="*.ts"`
Expected: Zero results (all `deck.*` calls should use `gwRequest`)

Upstream calls (`sessions.*`, `config.*`, etc.) are expected to remain as `gatewayRequest()` until P1.

- [ ] **Step 4: Run gateway test suite**

Run: `pnpm test -- src/gateway/ -v`
Expected: All tests pass (including new method-registry, describe, and method-scopes tests)

- [ ] **Step 5: Run dashboard type check**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: Zero errors

- [ ] **Step 6: Run lint + format (CLAUDE.md landing bar)**

Run: `pnpm check`
Expected: Green

- [ ] **Step 7: Run build (CLAUDE.md hard gate — this change touches server-methods.ts and package.json)**

Run: `pnpm build`
Expected: Green, no `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings

- [ ] **Step 8: Run full test suite**

Run: `pnpm test`
Expected: Green (no regressions)

- [ ] **Step 9: Commit CI guard comments**

If any `package.json` scripts were adjusted, commit. Otherwise this step is verification-only.

```bash
# Only if changes were needed:
scripts/committer "[enhanced] chore: add protocol codegen CI guards" package.json
```

---

## Post-Plan Notes

### P1 Upstream Result Schemas (Follow-Up)

Task 2 covers P0 (deck._) result schemas only. P1 upstream result schemas (~40 methods: sessions._, chat._, agents._, config._, models._, channels._, cron._, skills._, usage._, exec.approval.\*) are a follow-up effort. The typed client and codegen infrastructure are fully functional without them — those methods just remain untyped in the `GatewayMethodMap`.

The P1 follow-up includes:

1. Read each upstream handler's `respond(true, {...})` call → write result TypeBox schema
2. Add `methodDefs` to the handler file
3. Re-run `pnpm protocol:gen:ts`
4. Migrate remaining ~57 upstream `gatewayRequest()` calls in `dashboard/src/app/api/` to `gwRequest()`
5. Replace hand-written interfaces in `channels.ts` (5 interfaces) and `models.ts` (11 interfaces)

### What This Plan Does NOT Include

- Runtime response validation (design explicitly excludes this)
- Event payload schemas (P0 events are a separate follow-up)
- Swift codegen updates (automatically benefit from new schemas)
- Scope refactoring in `method-scopes.ts` (the design mentions eventual delegation to registry; deferred)

### Review Findings Applied

This plan was reviewed by Codex (GPT, score 4/10) and Claude sub-agent (score 7/10). All P1 findings were addressed:

| Finding                                                            | Fix                                                                        |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `deck.auth.*` methods omitted                                      | Added to Task 2 (schemas), Task 3 (methodDefs), Task 4 (registry assembly) |
| Codegen imports `server-methods.ts` with side-effects              | Added `method-registry-data.ts` side-effect-free export                    |
| Illegal TS identifiers (`last-heartbeat` etc.)                     | Added `isSafeIdentifier()` + `quoteKey()` in codegen                       |
| Empty object → `export interface X Record<...>` syntax error       | Changed to `type X = Record<string, never>`                                |
| `gateway.describe` not in method-scopes classification             | Added to Task 4 Step 5                                                     |
| Task 8 scope exceeds P0 dependency chain                           | Scoped down to deck-only stores; channels.ts/models.ts deferred to P1      |
| `Value.Clean(schema, schema)` is a no-op                           | Replaced with direct schema assignment                                     |
| `dashboard/src/types/` directory doesn't exist                     | Added `mkdirSync` in codegen                                               |
| Missing `pnpm check` + `pnpm build` in verification                | Added to Task 9 Steps 6-7                                                  |
| `schemaVersion` only in HelloOk schema, not injected at send point | Added injection task in Task 4 Step 6                                      |
| `Type.Record()` (patternProperties) not handled                    | Added patternProperties detection in `schemaToTS`                          |
