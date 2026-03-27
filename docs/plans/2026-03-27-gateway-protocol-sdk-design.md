# Gateway Protocol-Driven SDK Design

> Date: 2026-03-27
> Status: Approved
> Branch: enhanced

## Problem Statement

OpenClaw Gateway is a protocol-first WebSocket RPC server with ~147 methods, ~20 events, and a TypeBox-based schema system. It already has:

- `ProtocolSchemas` — a runtime-enumerable TypeBox schema registry (~100 schemas)
- `listGatewayMethods()` — method name catalog
- `GATEWAY_EVENTS` — event name catalog
- `scripts/protocol-gen-swift.ts` — Swift model codegen for iOS/macOS apps
- `scripts/protocol-gen.ts` — JSON Schema export to `dist/protocol.schema.json`

However, the Deck dashboard (our custom web UI) communicates with the Gateway through ~102 RPC methods with **zero compile-time type safety**:

1. **No method→schema mapping**: Schemas are keyed by schema name (`"SessionsCreateParams"`), not method name (`"sessions.create"`). The connection is implicit in handler code.
2. **No TypeScript codegen**: Only Swift codegen exists. The Deck manually mirrors ~15 response interfaces across 5 store files.
3. **No result schemas**: Gateway validates params with TypeBox/AJV but returns results as untyped `respond(true, {...})`.
4. **No runtime introspection**: No `gateway.describe` RPC. Clients cannot discover API surface at runtime.

This causes **contract drift** — when upstream renames a response field, the Deck silently receives `undefined` with no compile error. The allowlist (`gateway-allowlist.ts`, 102 entries) is manually maintained and frequently out of sync.

## Design Decisions

| Decision                 | Choice                                               | Rationale                                                                                                                                             |
| ------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Method registry approach | Full `defineMethod()` / router pattern               | Upstream `server-methods.ts` structure is stable (56 commits in 4 months are mostly handler spread appends); `deck/` handlers have 0 upstream changes |
| Client consumption       | Typed client wrapper (`gw.deck.agents.detail()`)     | Full params+result type safety without replacing connection layer                                                                                     |
| Migration strategy       | One-shot, no gradual transition                      | Eliminates risk of mixed calling patterns coexisting                                                                                                  |
| Result schemas           | Add TypeBox result schemas for all P0+P1 methods     | Enables full bidirectional type generation                                                                                                            |
| Runtime introspection    | `gateway.describe` RPC + `schemaVersion` in hello-ok | One registry serves both codegen and runtime discovery                                                                                                |

## Architecture Overview

```
ProtocolSchemas (TypeBox)  ←  Result Schemas (new)
         ↓
   MethodRegistry  ←  handler methodDefs + scope map
    ↓           ↓
codegen      gateway.describe RPC
    ↓
generated.ts  →  GatewayClient  →  Deck stores/routes
                                →  GENERATED_METHOD_ALLOWLIST → gateway-allowlist
```

## 1. Method Registry

### Core Types

New file: `src/gateway/method-registry.ts`

```typescript
import type { TSchema } from "@sinclair/typebox";
import type { GatewayRequestHandler } from "./server-methods/types.js";
import type { OperatorScope } from "./method-scopes.js";

export interface MethodDefinition {
  handler: GatewayRequestHandler;
  params?: TSchema;
  result?: TSchema;
  scope: OperatorScope | "node" | "public";
  since?: number;
  deprecated?: boolean;
}

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
      params?: Record<string, unknown>; // JSON Schema
      result?: Record<string, unknown>; // JSON Schema
      scope: string;
      since?: number;
    }
  >;
  events: Record<
    string,
    {
      payload?: Record<string, unknown>; // JSON Schema
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
```

### Handler Metadata Export Pattern

Each handler module adds a parallel `methodDefs` export alongside the existing `handlers` export:

```typescript
// src/gateway/server-methods/deck/agents.ts

// Existing (unchanged) — runtime dispatch
export const deckAgentsHandlers: GatewayRequestHandlers = {
  "deck.agents.detail": async ({ params, respond }) => { ... },
};

// New — metadata for registry
import { DeckAgentsDetailParamsSchema, DeckAgentsDetailResultSchema } from "../../protocol/schema/deck.js";

export const deckAgentsMethodDefs: Record<string, Omit<MethodDefinition, "handler">> = {
  "deck.agents.detail": {
    params: DeckAgentsDetailParamsSchema,
    result: DeckAgentsDetailResultSchema,
    scope: "operator.read",
  },
};
```

### Registry Assembly

`server-methods.ts` assembles the registry from handlers + metadata:

```typescript
import { buildMethodRegistry } from "./method-registry.js";

// Existing handler map (unchanged)
export const coreGatewayHandlers: GatewayRequestHandlers = {
  ...connectHandlers,
  ...chatHandlers,
  ...deckHandlers /* ... */,
};

// New: assembled registry
export const gatewayMethodRegistry = buildMethodRegistry(coreGatewayHandlers, [
  deckAgentsMethodDefs,
  deckRoutingMethodDefs,
  sessionsMethodDefs /* ... */,
]);
```

### Design Constraints

- **Zero runtime behavior change**: `handleGatewayRequest()` continues to use `coreGatewayHandlers` for dispatch. The registry is a parallel metadata layer.
- **Build-time validation**: `buildMethodRegistry()` asserts that every key in `methodDefs` exists in `handlers`. Missing handlers are a build error.
- **Gradual coverage**: Methods without `methodDefs` are registered as `untyped` — they work at runtime but are skipped by codegen.
- **Scope deduplication**: `method-scopes.ts` remains the **input source** for scope data. During `buildMethodRegistry()`, scope info is read from the existing `METHOD_SCOPE_GROUPS` and merged into each `MethodDefinition`. Handler `methodDefs` can optionally override scope (for deck-only methods that don't exist in upstream scope groups). After migration, `method-scopes.ts` query functions (`isReadMethod`, `isAdminOnlyMethod`, etc.) are refactored to delegate to the registry, making the registry the single runtime authority while `METHOD_SCOPE_GROUPS` remains the declaration source for upstream methods.

## 2. Result Schema Strategy

### Priority Tiers

| Tier | Scope                                                                                                                                     | Count | Action                                 |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------- |
| P0   | `deck.*` (all)                                                                                                                            | ~20   | Must add result schema                 |
| P1   | Upstream methods used by Deck (`chat.*`, `sessions.*`, `agents.*`, `config.*`, `models.*`, `channels.*`, `cron.*`, `skills.*`, `usage.*`) | ~40   | Must add result schema                 |
| P2   | Upstream methods not used by Deck (`tts.*`, `node.*`, `wizard.*`, `device.*`, `push.*`, etc.)                                             | ~80   | Skip — `result: undefined` in registry |

Estimated: **~60 result schemas** to write.

### File Organization

Result schemas colocate with their corresponding params schemas:

```
src/gateway/protocol/schema/
├── deck.ts              # Existing params + new results for deck.*
├── sessions.ts          # Existing params + new results for sessions.*
├── agents-models-skills.ts
├── channels.ts
├── config.ts
├── cron.ts
└── ...
```

### Naming Convention

```typescript
// Params (existing convention)
export const DeckAgentsDetailParamsSchema = Type.Object({ ... });

// Result (new convention, parallel naming)
export const DeckAgentsDetailResultSchema = Type.Object({ ... });
```

### Derivation Method

Result schemas are derived from handler `respond(true, {...})` call sites, cross-validated against existing Deck hand-written interfaces. This ensures the generated types cover all fields the Deck actually consumes.

### Validation Policy

Result schemas are used for **codegen and introspection only**, not for runtime response validation. This avoids performance overhead and false-positive risk from schema strictness.

All new result schemas are registered in `ProtocolSchemas`, so `protocol-gen-swift.ts` and `protocol-gen.ts` automatically benefit.

## 3. Codegen Pipeline

### Script

New file: `scripts/protocol-gen-ts.ts`

Input: `gatewayMethodRegistry` (imported from `src/gateway/server-methods.ts`)

Output (two files):

| File                                                | Content                                                                                                                                       |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard/src/types/gateway-protocol.generated.ts` | Pure type definitions: shared types, per-method params/result interfaces, event payload types, `GatewayMethodMap`, `GatewayMethodName`        |
| `dashboard/src/types/gateway-client.generated.ts`   | `GatewayRequestFn` type, `GatewayClient` interface, `createGatewayClient()` factory, `GENERATED_METHOD_ALLOWLIST`, `GENERATED_SCHEMA_VERSION` |

### Generated Type Structure

```typescript
// gateway-protocol.generated.ts

export const GENERATED_SCHEMA_VERSION = "3.a1b2c3";

// Shared types
export interface SkillEntry {
  id: string;
  name: string; /* ... */
}

// Per-method params & results
export interface DeckAgentsDetailParams {
  agentId: string;
}
export interface DeckAgentsDetailResult {
  id: string;
  name: string;
  model?: string;
  isDefault: boolean; /* ... */
}

// Method signature map
export interface GatewayMethodMap {
  "deck.agents.detail": { params: DeckAgentsDetailParams; result: DeckAgentsDetailResult };
  "sessions.create": { params: SessionsCreateParams; result: SessionsCreateResult };
  // ...
}

// Event payloads
export interface SessionsChangedEvent {
  /* ... */
}
export interface ChatEvent {
  state: string;
  stream?: string; /* ... */
}
```

### Generated Client Structure

```typescript
// gateway-client.generated.ts

export type GatewayRequestFn = <M extends keyof GatewayMethodMap>(
  method: M,
  params: GatewayMethodMap[M]["params"],
) => Promise<GatewayMethodMap[M]["result"]>;

export function createGatewayClient(request: GatewayRequestFn): GatewayClient { ... }

export const GENERATED_METHOD_ALLOWLIST: ReadonlySet<string> = new Set([...]);
```

The client factory builds a nested object tree by splitting method names on `.` (e.g., `"deck.agents.detail"` → `{ deck: { agents: { detail } } }`), with each leaf calling `request(methodName, params)`.

### NPM Scripts

```json
{
  "protocol:gen:ts": "bun scripts/protocol-gen-ts.ts",
  "protocol:gen:check": "bun scripts/protocol-gen-ts.ts --check"
}
```

- `protocol:gen:ts` — regenerate files
- `protocol:gen:check` — verify generated files are up-to-date (CI gate)

## 4. `gateway.describe` Introspection RPC

### Definition

- **Method**: `gateway.describe`
- **Scope**: `operator.read`
- **Params**: `{ filter?: "all" | "typed" | "untyped", includeSchemas?: boolean }`
- **Result**:

```typescript
{
  protocol: number,
  schemaVersion: string,
  methods: Record<string, {
    params?: JsonSchema,
    result?: JsonSchema,
    scope: string,
    since?: number,
  }>,
  events: Record<string, {
    payload?: JsonSchema,
  }>,
  untyped: string[],
}
```

### Implementation

New file: `src/gateway/server-methods/describe.ts` (~40 lines). Delegates to `gatewayMethodRegistry.describe()`. Result is cached after first call (registry is immutable post-startup).

### hello-ok Extension

`HelloOk.features` gains a new optional field:

```typescript
features: {
  methods: string[],        // existing
  events: string[],         // existing
  schemaVersion?: string,   // new — protocol version + registry content hash
}
```

### Client Schema Version Check

The Deck adapter logs a warning on schema version mismatch at connect time. This is non-blocking — it does not prevent the connection, but surfaces drift immediately during development.

### Event Schema Coverage

P0 events (6 events the Deck subscribes to) get payload schemas:

- `sessions.changed`, `session.message`, `session.tool`, `chat`, `agent`, `exec.approval.requested`, `exec.approval.resolved`

Remaining events are listed in `gateway.describe` response with `payload: undefined`.

## 5. Deck Migration

### One-Shot Migration Scope

**Server layer** (`dashboard/server/`):

| File                   | Change                                                                             |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `runtime.ts`           | Initialize `gw = createGatewayClient(adapter.request)`                             |
| `gateway-allowlist.ts` | Derive from `GENERATED_METHOD_ALLOWLIST` + `EXTRA_METHODS` set for untyped methods |
| `gateway-adapter.ts`   | Adapt `request()` signature to `GatewayRequestFn`; add `schemaVersion` warning     |

**API route layer** (`dashboard/src/app/api/**/*.ts`, ~30 files):

All `gatewayRequest("method", params)` calls migrate to `gw.method.name(params)`.

**Store layer** (`dashboard/src/stores/`):

| File                | Change                                                                        |
| ------------------- | ----------------------------------------------------------------------------- |
| `deck-agents.ts`    | Delete hand-written `AgentDetail`, `AgentSkills`, etc.; import from generated |
| `deck-routing.ts`   | Delete `Binding`, `BindingMatch`, `SimulationResult`; import generated        |
| `deck-subagents.ts` | Delete hand-written types; import generated                                   |
| `channels.ts`       | Delete `ChannelInfo`, `ChannelAccount`; import generated                      |
| `models.ts`         | Delete hand-written types; import generated                                   |

**Deleted code**:

- ~15 hand-written interfaces across stores
- 102-entry hand-written allowlist constant
- `gatewayRequest()` helper in `api-helpers.ts`

### Verification Criteria

1. `pnpm tsc --noEmit` (dashboard) — zero type errors
2. `pnpm protocol:gen:check` — generated files match registry
3. `grep -r "gatewayRequest(" dashboard/src/` — zero remaining raw calls
4. `grep -r "as AgentDetail\|as Binding\|as ChannelInfo" dashboard/src/` — zero hand-written type casts
5. Manual verification of core Deck panels: Agents, Chat, Routing, Sessions, Models, Channels

## 6. Upstream Sync Protocol

### Post-Rebase Workflow

```bash
# 1. Rebase
git fetch upstream main
git checkout enhanced
git rebase upstream/main

# 2. Resolve conflicts (focus areas)
#    - server-methods.ts: handler spread appends (usually auto-merge)
#    - server-methods-list.ts: method name appends (usually auto-merge)
#    - protocol/schema/*.ts: schema additions (may conflict)

# 3. Sync method registry
#    Detect upstream changes:
git diff upstream/main~1..upstream/main -- src/gateway/server-methods-list.ts
git diff upstream/main~1..upstream/main -- src/gateway/protocol/schema/

#    For new methods:
#    a) If Deck needs it: add result schema + methodDefs metadata
#    b) If Deck doesn't need it: register as untyped (result: undefined)

# 4. Regenerate typed client
pnpm protocol:gen:ts

# 5. Fix Deck consumers if types changed
pnpm tsc --noEmit

# 6. Full validation
pnpm install && pnpm check && pnpm test
```

### CI Guards

```yaml
- name: Protocol codegen drift check
  run: pnpm protocol:gen:check

- name: No raw gatewayRequest remaining
  run: |
    if grep -r "gatewayRequest(" dashboard/src/ --include="*.ts" --include="*.tsx"; then
      echo "ERROR: Use typed gw.* client instead of raw gatewayRequest()."
      exit 1
    fi
```

## File Inventory

### New Files

| File                                                | Purpose                            |
| --------------------------------------------------- | ---------------------------------- |
| `src/gateway/method-registry.ts`                    | MethodRegistry core                |
| `src/gateway/server-methods/describe.ts`            | `gateway.describe` RPC handler     |
| `src/gateway/server-methods/describe.test.ts`       | Introspection tests                |
| `scripts/protocol-gen-ts.ts`                        | TypeScript codegen script          |
| `dashboard/src/types/gateway-protocol.generated.ts` | Generated type definitions         |
| `dashboard/src/types/gateway-client.generated.ts`   | Generated typed client + allowlist |

### Modified Files (Gateway)

| File                                                  | Change                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/gateway/protocol/schema/deck.ts`                 | Add ~20 result schemas                                                                               |
| `src/gateway/protocol/schema/sessions.ts`             | Add ~10 result schemas                                                                               |
| `src/gateway/protocol/schema/agents-models-skills.ts` | Add result schemas                                                                                   |
| `src/gateway/protocol/schema/channels.ts`             | Add result schemas                                                                                   |
| `src/gateway/protocol/schema/config.ts`               | Add result schemas                                                                                   |
| `src/gateway/protocol/schema/cron.ts`                 | Add result schemas                                                                                   |
| `src/gateway/protocol/schema/protocol-schemas.ts`     | Register new schemas in `ProtocolSchemas`                                                            |
| `src/gateway/protocol/schema/frames.ts`               | Add `schemaVersion` to `HelloOk`                                                                     |
| `src/gateway/server-methods.ts`                       | Import `buildMethodRegistry`, assemble and export `gatewayMethodRegistry`; add `...describeHandlers` |
| `src/gateway/server-methods-list.ts`                  | Add `"gateway.describe"`                                                                             |
| `src/gateway/method-scopes.ts`                        | Keep `METHOD_SCOPE_GROUPS` as declaration source; refactor query functions to delegate to registry   |
| `src/gateway/server-methods/deck/*.ts`                | Add `methodDefs` exports                                                                             |
| `src/gateway/server-methods/sessions.ts`              | Add `methodDefs`                                                                                     |
| `src/gateway/server-methods/agents.ts`                | Add `methodDefs`                                                                                     |
| Other P1 handler files                                | Add `methodDefs`                                                                                     |
| `package.json`                                        | Add `protocol:gen:ts` / `protocol:gen:check` scripts                                                 |

### Modified Files (Deck)

| File                                        | Change                                           |
| ------------------------------------------- | ------------------------------------------------ |
| `dashboard/server/runtime.ts`               | Initialize typed client                          |
| `dashboard/server/gateway-adapter.ts`       | Adapt request signature; add schemaVersion check |
| `dashboard/server/gateway-allowlist.ts`     | Derive from generated allowlist                  |
| `dashboard/src/app/api/**/*.ts` (~30 files) | Migrate to `gw.*()` calls                        |
| `dashboard/src/stores/deck-agents.ts`       | Delete hand-written interfaces, import generated |
| `dashboard/src/stores/deck-routing.ts`      | Same                                             |
| `dashboard/src/stores/deck-subagents.ts`    | Same                                             |
| `dashboard/src/stores/channels.ts`          | Same                                             |
| `dashboard/src/stores/models.ts`            | Same                                             |
| `dashboard/src/lib/api-helpers.ts`          | Remove or deprecate `gatewayRequest()`           |

### Unchanged

- Connection layer: `OpenClawGatewayAdapter`, `NodeConnection`, `EventBus`, SSE stream
- Authentication: Device identity, challenge/response, role/scope
- Upstream handler logic: Only metadata exports added, no handler behavior changes
- Swift codegen: `protocol-gen-swift.ts` automatically benefits from new result schemas
