# Deck Agent Routing & Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Agent routing visualization, Subagent monitoring, and Skill assignment management to the openclaw-deck Web Dashboard via 17 new `deck.*` Gateway RPCs, 2 new panels (Routing, Subagents), and 4 enhanced panels (Agents, Sessions, Skills, Channels).

**Architecture:** Backend adds `src/gateway/server-methods/deck/` directory with isolated RPC handlers using `deck.*` namespace to avoid upstream conflicts. Frontend adds 3 Zustand stores, 6 shared components, and extends NavRail with 2 new panels. All write RPCs use baseHash optimistic locking. Bindings use content-hash synthetic IDs.

**Tech Stack:** TypeScript ESM, TypeBox + AJV validation, Zustand 5, React 19, Next.js 16, shadcn/ui, Tailwind CSS 4, next-intl

**OpenSpec:** `openspec/changes/deck-agent-routing-observability/`
**Design Spec:** `docs/superpowers/specs/2026-03-19-deck-agent-routing-observability-design.md`

---

## File Structure

### Backend (New Files)

```
src/gateway/server-methods/deck/
  ├── index.ts                    # Export all deck handlers + merge
  ├── routing.ts                  # deck.routing.* (5 handlers)
  ├── agents.ts                   # deck.agents.* (5 handlers)
  ├── subagents.ts                # deck.subagents.* (3 handlers)
  ├── identity.ts                 # deck.identity.* (3 handlers)
  ├── threads.ts                  # deck.threads.* (1 handler)
  └── utils.ts                    # Content-hash ID, baseHash validation
src/gateway/protocol/schema/
  └── deck.ts                     # TypeBox schemas for all deck.* params
```

### Backend (Modified Files)

```
src/gateway/server-methods-list.ts  # Add 17 deck.* method names to BASE_METHODS
src/gateway/method-scopes.ts        # Add deck.* scopes to METHOD_SCOPE_GROUPS
src/gateway/protocol/index.ts       # Export deck validators
src/gateway/server-methods.ts       # Import + spread deckHandlers
```

### Frontend (New Files)

```
dashboard/src/stores/
  ├── deck-routing.ts             # Bindings, simulation, configHash
  ├── deck-subagents.ts           # Active runs, history, lineage, polling
  └── deck-agents.ts              # Agent detail, skills, subagent config
dashboard/src/app/api/
  ├── deck/routing/route.ts       # Proxy deck.routing.*
  ├── deck/agents/route.ts        # Proxy deck.agents.*
  ├── deck/subagents/route.ts     # Proxy deck.subagents.*
  ├── deck/identity/route.ts      # Proxy deck.identity.*
  └── deck/threads/route.ts       # Proxy deck.threads.*
dashboard/src/components/shared/
  ├── AgentBadge.tsx
  ├── TierBadge.tsx
  ├── SessionKeyDisplay.tsx
  ├── BindingDialog.tsx
  ├── LineageTree.tsx
  └── SubagentRunCard.tsx
dashboard/src/components/panels/
  ├── routing/
  │   ├── RoutingPanel.tsx
  │   ├── BindingTable.tsx
  │   └── RouteSimulator.tsx
  └── subagents/
      ├── SubagentsPanel.tsx
      ├── ActiveRunsTab.tsx
      ├── HistoryTab.tsx
      └── ConfigTab.tsx
```

### Frontend (Modified Files)

```
dashboard/src/stores/ui.ts                          # Add "routing" | "subagents" to Panel type
dashboard/src/components/layout/NavRail.tsx          # Add Routing + Subagents to navGroups
dashboard/src/components/layout/Shell.tsx            # Add panel rendering cases
dashboard/src/components/panels/agents/AgentsPanel.tsx   # Rewrite to Master-Detail
dashboard/src/components/panels/sessions/SessionsPanel.tsx  # Add type column
dashboard/src/components/panels/skills/SkillsPanel.tsx      # Add matrix tab
dashboard/src/components/panels/channels/ChannelsPanel.tsx  # Add bindings tab
dashboard/src/messages/zh-CN.json                   # Add routing.*, subagents.* keys
dashboard/src/messages/en.json                      # Same
```

## File Cross Matrix (Parallel Conflict Analysis)

| File                      | Task 1 (Infra) | Task 2 (routing) | Task 3 (agents) | Task 4 (subagents) | Task 5 (aux) |
| ------------------------- | :------------: | :--------------: | :-------------: | :----------------: | :----------: |
| `server-methods-list.ts`  |      ALL       |        —         |        —        |         —          |      —       |
| `method-scopes.ts`        |      ALL       |        —         |        —        |         —          |      —       |
| `protocol/index.ts`       |       —        |        X         |        X        |         X          |      X       |
| `protocol/schema/deck.ts` |       —        |        X         |        X        |         X          |      X       |
| `server-methods.ts`       |      ALL       |        —         |        —        |         —          |      —       |
| `deck/routing.ts`         |       —        |        X         |        —        |         —          |      —       |
| `deck/agents.ts`          |       —        |        —         |        X        |         —          |      —       |
| `deck/subagents.ts`       |       —        |        —         |        —        |         X          |      —       |
| `deck/identity.ts`        |       —        |        —         |        —        |         —          |      X       |
| `deck/threads.ts`         |       —        |        —         |        —        |         —          |      X       |

**Conflict resolution:** Task 1 (infrastructure) is serial and handles all shared files (method list, scopes, server-methods.ts import). Tasks 2-5 each own their domain files exclusively. `protocol/schema/deck.ts` and `protocol/index.ts` are shared but each task appends to non-overlapping sections — Task 1 creates the file skeleton, tasks 2-5 each append their section.

---

## Phase 0: Backend Infrastructure (Serial — Task 0)

### Task 1: Gateway Infrastructure Setup

**Files:**

- Create: `src/gateway/server-methods/deck/utils.ts`
- Create: `src/gateway/server-methods/deck/index.ts`
- Create: `src/gateway/protocol/schema/deck.ts`
- Modify: `src/gateway/server-methods-list.ts`
- Modify: `src/gateway/method-scopes.ts`
- Modify: `src/gateway/protocol/index.ts`
- Modify: `src/gateway/server-methods.ts`
- Test: `src/gateway/server-methods/deck/utils.test.ts`

**covers:** `deck-routing-api > ADDED > deck.routing.list` (binding ID utility), `deck-routing-api > ADDED > deck.routing.add` (baseHash validation)

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Create content-hash binding ID utility**

```typescript
// src/gateway/server-methods/deck/utils.ts
import { createHash } from "node:crypto";

/** Normalize a binding match for deterministic hashing. */
export function normalizeBindingMatchForHash(
  match: Record<string, unknown>,
): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(match).sort()) {
    const val = match[key];
    if (val === undefined || val === null) continue;
    if (typeof val === "string") {
      sorted[key] = val.trim().toLowerCase();
    } else if (typeof val === "object" && !Array.isArray(val)) {
      sorted[key] = normalizeBindingMatchForHash(val as Record<string, unknown>);
    } else if (Array.isArray(val)) {
      sorted[key] = val.map((v) => (typeof v === "string" ? v.trim().toLowerCase() : v)).sort();
    } else {
      sorted[key] = val;
    }
  }
  return sorted;
}

/** Generate a deterministic content-hash ID for a binding match. */
export function computeBindingId(match: Record<string, unknown>): string {
  const normalized = normalizeBindingMatchForHash(match);
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 12);
}

/** Validate baseHash against current config hash. Returns error shape or null. */
export function validateBaseHash(
  baseHash: string | undefined,
  currentHash: string,
): { code: string; message: string } | null {
  if (!baseHash || typeof baseHash !== "string") {
    return { code: "INVALID_REQUEST", message: "baseHash is required for write operations" };
  }
  if (baseHash !== currentHash) {
    return { code: "CONFLICT", message: "config has changed since last read (baseHash mismatch)" };
  }
  return null;
}
```

- [ ] **Step 2: Write tests for utils**

```typescript
// src/gateway/server-methods/deck/utils.test.ts
import { describe, expect, it } from "vitest";
import { computeBindingId, normalizeBindingMatchForHash, validateBaseHash } from "./utils.js";

describe("computeBindingId", () => {
  it("produces deterministic ID for same match", () => {
    const match = { channel: "discord", peer: { kind: "channel", id: "dev" } };
    expect(computeBindingId(match)).toBe(computeBindingId(match));
    expect(computeBindingId(match)).toHaveLength(12);
  });

  it("produces same ID regardless of key order", () => {
    const a = { channel: "discord", accountId: "srv" };
    const b = { accountId: "srv", channel: "discord" };
    expect(computeBindingId(a)).toBe(computeBindingId(b));
  });

  it("normalizes case", () => {
    const a = { channel: "Discord" };
    const b = { channel: "discord" };
    expect(computeBindingId(a)).toBe(computeBindingId(b));
  });
});

describe("validateBaseHash", () => {
  it("returns null on match", () => {
    expect(validateBaseHash("abc", "abc")).toBeNull();
  });
  it("returns CONFLICT on mismatch", () => {
    const err = validateBaseHash("old", "new");
    expect(err?.code).toBe("CONFLICT");
  });
  it("returns INVALID_REQUEST when missing", () => {
    const err = validateBaseHash(undefined, "abc");
    expect(err?.code).toBe("INVALID_REQUEST");
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm test src/gateway/server-methods/deck/utils.test.ts`
Expected: PASS

- [ ] **Step 4: Create TypeBox schema skeleton for all deck.\* params**

```typescript
// src/gateway/protocol/schema/deck.ts
import { Type } from "@sinclair/typebox";

const NonEmptyString = Type.String({ minLength: 1 });
const ChatType = Type.Union([
  Type.Literal("direct"),
  Type.Literal("group"),
  Type.Literal("channel"),
]);
const PeerSchema = Type.Object(
  { kind: ChatType, id: NonEmptyString },
  { additionalProperties: false },
);

// === deck.routing.* ===
export const DeckRoutingListParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
    channel: Type.Optional(NonEmptyString),
    accountId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const DeckRoutingAddParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    match: Type.Object(
      {
        channel: NonEmptyString,
        accountId: Type.Optional(Type.String()),
        peer: Type.Optional(PeerSchema),
        guildId: Type.Optional(Type.String()),
        roles: Type.Optional(Type.Array(Type.String())),
        teamId: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
    comment: Type.Optional(Type.String()),
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckRoutingRemoveParamsSchema = Type.Object(
  {
    id: NonEmptyString,
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckRoutingValidateParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    match: Type.Object(
      {
        channel: NonEmptyString,
        accountId: Type.Optional(Type.String()),
        peer: Type.Optional(PeerSchema),
        guildId: Type.Optional(Type.String()),
        roles: Type.Optional(Type.Array(Type.String())),
        teamId: Type.Optional(Type.String()),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const DeckRoutingSimulateParamsSchema = Type.Object(
  {
    channel: NonEmptyString,
    accountId: Type.Optional(Type.String()),
    peer: Type.Optional(PeerSchema),
    guildId: Type.Optional(Type.String()),
    teamId: Type.Optional(Type.String()),
    memberRoleIds: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

// === deck.agents.* ===
export const DeckAgentsDetailParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckAgentsSkillsGetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckAgentsSkillsSetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    mode: Type.Union([Type.Literal("all"), Type.Literal("whitelist")]),
    skills: Type.Array(Type.String()),
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckAgentsSubagentsGetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckAgentsSubagentsSetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    allowAgents: Type.Array(Type.String()),
    model: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

// === deck.subagents.* ===
export const DeckSubagentsListParamsSchema = Type.Object(
  {
    status: Type.Optional(
      Type.Union([
        Type.Literal("active"),
        Type.Literal("completed"),
        Type.Literal("failed"),
        Type.Literal("all"),
      ]),
    ),
    agentId: Type.Optional(NonEmptyString),
    requesterAgentId: Type.Optional(NonEmptyString),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
    offset: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

export const DeckSubagentsKillParamsSchema = Type.Object(
  {
    runId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckSubagentsLineageParamsSchema = Type.Object(
  {
    runId: Type.Optional(NonEmptyString),
    sessionKey: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

// === deck.identity.* ===
export const DeckIdentityListParamsSchema = Type.Object({}, { additionalProperties: false });

export const DeckIdentityLinkParamsSchema = Type.Object(
  {
    canonical: NonEmptyString,
    channel: NonEmptyString,
    peerId: NonEmptyString,
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckIdentityUnlinkParamsSchema = Type.Object(
  {
    canonical: NonEmptyString,
    channel: NonEmptyString,
    peerId: NonEmptyString,
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);

// === deck.threads.* ===
export const DeckThreadsListParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
    channel: Type.Optional(NonEmptyString),
    status: Type.Optional(Type.Union([Type.Literal("active"), Type.Literal("all")])),
  },
  { additionalProperties: false },
);
```

- [ ] **Step 5: Compile AJV validators in protocol/index.ts**

Append to `src/gateway/protocol/index.ts`:

```typescript
import {
  DeckRoutingListParamsSchema,
  DeckRoutingAddParamsSchema,
  DeckRoutingRemoveParamsSchema,
  DeckRoutingValidateParamsSchema,
  DeckRoutingSimulateParamsSchema,
  DeckAgentsDetailParamsSchema,
  DeckAgentsSkillsGetParamsSchema,
  DeckAgentsSkillsSetParamsSchema,
  DeckAgentsSubagentsGetParamsSchema,
  DeckAgentsSubagentsSetParamsSchema,
  DeckSubagentsListParamsSchema,
  DeckSubagentsKillParamsSchema,
  DeckSubagentsLineageParamsSchema,
  DeckIdentityListParamsSchema,
  DeckIdentityLinkParamsSchema,
  DeckIdentityUnlinkParamsSchema,
  DeckThreadsListParamsSchema,
} from "./schema/deck.js";

// deck.routing.*
export const validateDeckRoutingListParams = ajv.compile(DeckRoutingListParamsSchema);
export const validateDeckRoutingAddParams = ajv.compile(DeckRoutingAddParamsSchema);
export const validateDeckRoutingRemoveParams = ajv.compile(DeckRoutingRemoveParamsSchema);
export const validateDeckRoutingValidateParams = ajv.compile(DeckRoutingValidateParamsSchema);
export const validateDeckRoutingSimulateParams = ajv.compile(DeckRoutingSimulateParamsSchema);
// deck.agents.*
export const validateDeckAgentsDetailParams = ajv.compile(DeckAgentsDetailParamsSchema);
export const validateDeckAgentsSkillsGetParams = ajv.compile(DeckAgentsSkillsGetParamsSchema);
export const validateDeckAgentsSkillsSetParams = ajv.compile(DeckAgentsSkillsSetParamsSchema);
export const validateDeckAgentsSubagentsGetParams = ajv.compile(DeckAgentsSubagentsGetParamsSchema);
export const validateDeckAgentsSubagentsSetParams = ajv.compile(DeckAgentsSubagentsSetParamsSchema);
// deck.subagents.*
export const validateDeckSubagentsListParams = ajv.compile(DeckSubagentsListParamsSchema);
export const validateDeckSubagentsKillParams = ajv.compile(DeckSubagentsKillParamsSchema);
export const validateDeckSubagentsLineageParams = ajv.compile(DeckSubagentsLineageParamsSchema);
// deck.identity.*
export const validateDeckIdentityListParams = ajv.compile(DeckIdentityListParamsSchema);
export const validateDeckIdentityLinkParams = ajv.compile(DeckIdentityLinkParamsSchema);
export const validateDeckIdentityUnlinkParams = ajv.compile(DeckIdentityUnlinkParamsSchema);
// deck.threads.*
export const validateDeckThreadsListParams = ajv.compile(DeckThreadsListParamsSchema);
```

- [ ] **Step 6: Register method names in server-methods-list.ts**

Append to `BASE_METHODS` array in `src/gateway/server-methods-list.ts`:

```typescript
// deck.routing
"deck.routing.list",
"deck.routing.add",
"deck.routing.remove",
"deck.routing.validate",
"deck.routing.simulate",
// deck.agents
"deck.agents.detail",
"deck.agents.skills.get",
"deck.agents.skills.set",
"deck.agents.subagents.get",
"deck.agents.subagents.set",
// deck.subagents
"deck.subagents.list",
"deck.subagents.kill",
"deck.subagents.lineage",
// deck.identity
"deck.identity.list",
"deck.identity.link",
"deck.identity.unlink",
// deck.threads
"deck.threads.list",
```

- [ ] **Step 7: Define scopes in method-scopes.ts**

Add to `METHOD_SCOPE_GROUPS` in `src/gateway/method-scopes.ts`:

```typescript
[READ_SCOPE]: [
  // ... existing entries ...
  "deck.routing.list",
  "deck.routing.validate",
  "deck.routing.simulate",
  "deck.agents.detail",
  "deck.agents.skills.get",
  "deck.agents.subagents.get",
  "deck.subagents.list",
  "deck.subagents.lineage",
  "deck.identity.list",
  "deck.threads.list",
],
[ADMIN_SCOPE]: [
  // ... existing entries ...
  "deck.routing.add",
  "deck.routing.remove",
  "deck.agents.skills.set",
  "deck.agents.subagents.set",
  "deck.subagents.kill",
  "deck.identity.link",
  "deck.identity.unlink",
],
```

- [ ] **Step 8: Create deck/index.ts and wire into server-methods.ts**

```typescript
// src/gateway/server-methods/deck/index.ts
import type { GatewayRequestHandlers } from "../types.js";
import { deckRoutingHandlers } from "./routing.js";
import { deckAgentsHandlers } from "./agents.js";
import { deckSubagentsHandlers } from "./subagents.js";
import { deckIdentityHandlers } from "./identity.js";
import { deckThreadsHandlers } from "./threads.js";

export const deckHandlers: GatewayRequestHandlers = {
  ...deckRoutingHandlers,
  ...deckAgentsHandlers,
  ...deckSubagentsHandlers,
  ...deckIdentityHandlers,
  ...deckThreadsHandlers,
};
```

Add to `src/gateway/server-methods.ts`:

```typescript
import { deckHandlers } from "./server-methods/deck/index.js";

export const coreGatewayHandlers: GatewayRequestHandlers = {
  // ... existing handlers ...
  ...deckHandlers,
};
```

- [ ] **Step 9: Create stub handler files so build passes**

Create empty handler stubs for each domain file (`routing.ts`, `agents.ts`, `subagents.ts`, `identity.ts`, `threads.ts`) exporting empty handler objects:

```typescript
// src/gateway/server-methods/deck/routing.ts (and others)
import type { GatewayRequestHandlers } from "../types.js";
export const deckRoutingHandlers: GatewayRequestHandlers = {};
```

- [ ] **Step 10: Verify build**

Run: `pnpm build`
Expected: PASS (no type errors, all stubs compile)

- [ ] **Step 11: Commit**

```bash
scripts/committer "[enhanced] [impl] feat(gateway): add deck.* RPC infrastructure — schemas, scopes, method list, handler stubs" \
  src/gateway/server-methods/deck/ \
  src/gateway/protocol/schema/deck.ts \
  src/gateway/protocol/index.ts \
  src/gateway/server-methods-list.ts \
  src/gateway/method-scopes.ts \
  src/gateway/server-methods.ts
```

---

## Phase 1: Backend RPC Implementations (Parallelizable by Domain)

### Task 2: deck.routing.\* Handlers

**Files:**

- Modify: `src/gateway/server-methods/deck/routing.ts`
- Test: `src/gateway/server-methods/deck/routing.test.ts`

**covers:**

- `deck-routing-api > ADDED > deck.routing.list returns all bindings with computed tiers > "List all bindings"`
- `deck-routing-api > ADDED > deck.routing.list returns all bindings with computed tiers > "Filter by agentId"`
- `deck-routing-api > ADDED > deck.routing.add creates a binding with conflict detection > "Add binding successfully"`
- `deck-routing-api > ADDED > deck.routing.add creates a binding with conflict detection > "Add binding with stale baseHash"`
- `deck-routing-api > ADDED > deck.routing.remove deletes a binding by content-hash ID > "Remove existing binding"`
- `deck-routing-api > ADDED > deck.routing.remove deletes a binding by content-hash ID > "Remove non-existent binding"`
- `deck-routing-api > ADDED > deck.routing.validate checks for conflicts without writing > "Validate clean binding"`
- `deck-routing-api > ADDED > deck.routing.validate checks for conflicts without writing > "Validate duplicate binding"`
- `deck-routing-api > ADDED > deck.routing.simulate resolves routing for given parameters > "Simulate with peer match"`
- `deck-routing-api > ADDED > deck.routing.simulate resolves routing for given parameters > "Simulate with no binding match"`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Write tests for deck.routing.list**

Test: fetch bindings, filter by agentId, verify tier computation, verify content-hash IDs are deterministic.

Run: `pnpm test src/gateway/server-methods/deck/routing.test.ts`

- [ ] **Step 2: Implement deck.routing.list handler**

Read `loadConfig().bindings`, for each binding compute tier using binding match analysis (peer → peer.parent → guild+roles → guild → team → account → channel), assign content-hash ID via `computeBindingId()`, return sorted list + `defaultAgentId` + `dmScope` + `configHash`.

Key imports: `loadConfig` from `../../config/config.js`, `resolveDefaultAgentId` from `../../agents/agent-scope.js`, `computeBindingId` from `./utils.js`.

- [ ] **Step 3: Write tests for deck.routing.add and deck.routing.remove**

Test: add binding with valid baseHash → config updated; add with stale baseHash → CONFLICT; remove by ID → binding removed; remove non-existent → NOT_FOUND.

- [ ] **Step 4: Implement deck.routing.add and deck.routing.remove**

Read config → validate baseHash → mutate bindings array → write config via `writeConfigFile()` → return new configHash. For add: also call conflict detection. For remove: find binding by content-hash ID match.

- [ ] **Step 5: Write tests for deck.routing.validate**

Test: validate clean match → ok; validate duplicate → conflict type "duplicate"; validate overlap → conflict type "overlap".

- [ ] **Step 6: Implement deck.routing.validate**

Call existing `matchesBindingScope()` from `src/routing/resolve-route.ts` against all existing bindings. Return predicted tier and conflicts list.

- [ ] **Step 7: Write tests for deck.routing.simulate**

Test: simulate with peer match → correct agentId + matchedBy + 8-tier array; simulate no match → default agent + all tiers unchecked.

- [ ] **Step 8: Implement deck.routing.simulate**

Call `resolveAgentRoute()` from `src/routing/resolve-route.ts` with provided params. Wrap result with tier-by-tier check details (8 entries). Return agentId, matchedBy, sessionKey, matchedBinding, tiers array.

- [ ] **Step 9: Run all routing tests**

Run: `pnpm test src/gateway/server-methods/deck/routing.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
scripts/committer "[enhanced] [impl] feat(gateway): implement deck.routing.* — list, add, remove, validate, simulate" \
  src/gateway/server-methods/deck/routing.ts \
  src/gateway/server-methods/deck/routing.test.ts
```

### Task 3: deck.agents.\* Handlers

**Files:**

- Modify: `src/gateway/server-methods/deck/agents.ts`
- Test: `src/gateway/server-methods/deck/agents.test.ts`

**covers:**

- `deck-agents-api > ADDED > deck.agents.detail returns aggregated agent information > "Get detail for agent with whitelist skills"`
- `deck-agents-api > ADDED > deck.agents.detail returns aggregated agent information > "Get detail for agent with no skill restriction"`
- `deck-agents-api > ADDED > deck.agents.skills.get returns per-agent skill assignment > "Get skills for whitelist agent"`
- `deck-agents-api > ADDED > deck.agents.skills.set updates per-agent skill assignment > "Switch agent to whitelist mode"`
- `deck-agents-api > ADDED > deck.agents.skills.set updates per-agent skill assignment > "Switch agent to all-skills mode"`
- `deck-agents-api > ADDED > deck.agents.subagents.get returns subagent permissions > "Get subagent config"`
- `deck-agents-api > ADDED > deck.agents.subagents.set updates subagent permissions > "Set allowed agents"`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Write tests for deck.agents.detail**

Test: agent with skills whitelist → skillMode "whitelist", effectiveSkills matches; agent without skills field → skillMode "all"; verify binding count, session count, subagent effective values.

- [ ] **Step 2: Implement deck.agents.detail**

Aggregate: `resolveAgentConfig()` for base fields, count bindings from `config.bindings` where agentId matches, count sessions from session store, count active subagent runs, resolve skill mode from `agent.skills`, compute effective depth/children from `agents.defaults.subagents`.

- [ ] **Step 3: Write tests + implement deck.agents.skills.get and deck.agents.skills.set**

skills.get: read `agent.skills`, build available list from `buildWorkspaceSkillStatus()`, mark assigned + eligible.
skills.set: validate baseHash → write `agent.skills` (or remove field if mode="all") → writeConfigFile → return configHash.

- [ ] **Step 4: Write tests + implement deck.agents.subagents.get and deck.agents.subagents.set**

subagents.get: read `agent.subagents`, resolve effective values from global defaults, build agent lists.
subagents.set: validate baseHash → write only `allowAgents` + `model` → writeConfigFile → return configHash.

- [ ] **Step 5: Run all agent tests**

Run: `pnpm test src/gateway/server-methods/deck/agents.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] [impl] feat(gateway): implement deck.agents.* — detail, skills.get/set, subagents.get/set" \
  src/gateway/server-methods/deck/agents.ts \
  src/gateway/server-methods/deck/agents.test.ts
```

### Task 4: deck.subagents.\* Handlers

**Files:**

- Modify: `src/gateway/server-methods/deck/subagents.ts`
- Test: `src/gateway/server-methods/deck/subagents.test.ts`

**covers:**

- `deck-subagents-api > ADDED > deck.subagents.list returns subagent runs from in-memory store > "List active runs"`
- `deck-subagents-api > ADDED > deck.subagents.list returns subagent runs from in-memory store > "List all runs with pagination"`
- `deck-subagents-api > ADDED > deck.subagents.list returns subagent runs from in-memory store > "No runs in memory after sweep"`
- `deck-subagents-api > ADDED > deck.subagents.kill terminates an active subagent run > "Kill active run"`
- `deck-subagents-api > ADDED > deck.subagents.kill terminates an active subagent run > "Kill non-existent run"`
- `deck-subagents-api > ADDED > deck.subagents.lineage returns the full call tree > "Lineage for a depth-1 run"`
- `deck-subagents-api > ADDED > deck.subagents.lineage returns the full call tree > "Lineage for a nested tree"`
- `deck-subagents-api > ADDED > deck.subagents.lineage returns the full call tree > "Lineage for non-subagent session"`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Write tests for deck.subagents.list**

Test: list active → only runs without endedAt; list all with pagination → correct limit/offset/total; empty after sweep → runs=[], total=0.

- [ ] **Step 2: Implement deck.subagents.list**

Read from `getSubagentRunsSnapshotForRead()` in `src/agents/subagent-registry.ts`. Filter by status, agentId, requesterAgentId. Extract agentId from session keys. Paginate. Compute durationMs from createdAt/endedAt.

- [ ] **Step 3: Write tests for deck.subagents.kill**

Test: kill active run → ok; kill non-existent → NOT_FOUND.

- [ ] **Step 4: Implement deck.subagents.kill**

Call existing `killSubagentRun()` or equivalent from `src/agents/subagent-registry.ts`.

- [ ] **Step 5: Write tests for deck.subagents.lineage**

Test: depth-1 run → root + 1 node; nested tree → root + N nodes with correct parentRunId; non-subagent session → root + empty nodes; enforce maxNodes=50.

- [ ] **Step 6: Implement deck.subagents.lineage**

Walk upward via `requesterSessionKey` to find root. Then scan all runs to collect descendants. Reconstruct parentRunId by reverse-lookup. Enforce maxNodes=50 limit.

- [ ] **Step 7: Run all subagent tests**

Run: `pnpm test src/gateway/server-methods/deck/subagents.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
scripts/committer "[enhanced] [impl] feat(gateway): implement deck.subagents.* — list, kill, lineage" \
  src/gateway/server-methods/deck/subagents.ts \
  src/gateway/server-methods/deck/subagents.test.ts
```

### Task 5: deck.identity._ + deck.threads._ Handlers

**Files:**

- Modify: `src/gateway/server-methods/deck/identity.ts`
- Modify: `src/gateway/server-methods/deck/threads.ts`
- Test: `src/gateway/server-methods/deck/identity.test.ts`

**covers:**

- `deck-auxiliary-api > ADDED > deck.identity.list returns structured identity links > "List identity links"`
- `deck-auxiliary-api > ADDED > deck.identity.list returns structured identity links > "No identity links configured"`
- `deck-auxiliary-api > ADDED > deck.identity.link adds a peer to a canonical identity > "Link new peer"`
- `deck-auxiliary-api > ADDED > deck.identity.link adds a peer to a canonical identity > "Link duplicate peer"`
- `deck-auxiliary-api > ADDED > deck.identity.unlink removes a peer from a canonical identity > "Unlink existing peer"`
- `deck-auxiliary-api > ADDED > deck.threads.list returns active thread bindings > "List active Discord thread bindings"`
- `deck-auxiliary-api > ADDED > deck.threads.list returns active thread bindings > "List threads for unsupported channel"`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Write tests + implement deck.identity.list/link/unlink**

identity.list: read `config.session.identityLinks`, split each `"channel:peerId"` into structured `{ channel, peerId }`.
identity.link: append `"channel:peerId"` to array (deduplicate).
identity.unlink: remove matching entry.
All write ops: validate baseHash, return configHash.

- [ ] **Step 2: Write tests + implement deck.threads.list**

Read Discord thread binding files from `~/.openclaw/agents/<agentId>/sessions/thread-bindings-<accountId>.json`. Return empty array for non-Discord channels.

- [ ] **Step 3: Run tests**

Run: `pnpm test src/gateway/server-methods/deck/identity.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] [impl] feat(gateway): implement deck.identity.* + deck.threads.* — identity links, thread bindings" \
  src/gateway/server-methods/deck/identity.ts \
  src/gateway/server-methods/deck/threads.ts \
  src/gateway/server-methods/deck/identity.test.ts
```

---

## Phase 2: Frontend Foundations (Serial)

### Task 6: API Routes + Zustand Stores

**Files:**

- Create: `dashboard/src/app/api/deck/routing/route.ts`
- Create: `dashboard/src/app/api/deck/agents/route.ts`
- Create: `dashboard/src/app/api/deck/subagents/route.ts`
- Create: `dashboard/src/app/api/deck/identity/route.ts`
- Create: `dashboard/src/app/api/deck/threads/route.ts`
- Create: `dashboard/src/stores/deck-routing.ts`
- Create: `dashboard/src/stores/deck-subagents.ts`
- Create: `dashboard/src/stores/deck-agents.ts`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Create API route for deck.routing.\***

```typescript
// dashboard/src/app/api/deck/routing/route.ts
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = request.nextUrl;
  const params: Record<string, string> = {};
  for (const key of ["agentId", "channel", "accountId"]) {
    const val = searchParams.get(key);
    if (val) params[key] = val;
  }
  return gatewayRequest("deck.routing.list", params);
});

export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json();
  const action = body?.action;
  if (action === "add") return gatewayRequest("deck.routing.add", body);
  if (action === "remove") return gatewayRequest("deck.routing.remove", body);
  if (action === "validate") return gatewayRequest("deck.routing.validate", body);
  if (action === "simulate") return gatewayRequest("deck.routing.simulate", body);
  return Response.json({ error: "unknown action" }, { status: 400 });
});
```

- [ ] **Step 2: Create API routes for remaining deck.\* domains**

Follow same pattern for agents, subagents, identity, threads.

- [ ] **Step 3: Create deck-routing store**

```typescript
// dashboard/src/stores/deck-routing.ts
import { create } from "zustand";

export interface DeckBinding {
  id: string;
  agentId: string;
  agentName?: string;
  match: {
    channel: string;
    accountId?: string;
    peer?: { kind: string; id: string };
    guildId?: string;
    roles?: string[];
    teamId?: string;
  };
  tier: string;
  comment?: string;
}

export interface SimulateResult {
  agentId: string;
  agentName?: string;
  matchedBy: string;
  matchedBinding?: DeckBinding;
  sessionKey: string;
  tiers: Array<{ name: string; checked: boolean; matched: boolean; candidateCount: number }>;
}

interface DeckRoutingState {
  bindings: DeckBinding[];
  defaultAgentId: string;
  dmScope: string;
  configHash: string;
  loading: boolean;
  error: string | null;
  simulateResult: SimulateResult | null;
  simulating: boolean;

  fetchBindings: (filter?: { agentId?: string; channel?: string }) => Promise<void>;
  addBinding: (params: {
    agentId: string;
    match: Record<string, unknown>;
    comment?: string;
  }) => Promise<{ ok: boolean; warnings?: unknown[] }>;
  removeBinding: (id: string) => Promise<boolean>;
  validateBinding: (params: {
    agentId: string;
    match: Record<string, unknown>;
  }) => Promise<{ ok: boolean; tier?: string; conflicts?: unknown[] }>;
  simulate: (params: Record<string, unknown>) => Promise<void>;
}

export const useDeckRoutingStore = create<DeckRoutingState>((set, get) => ({
  bindings: [],
  defaultAgentId: "",
  dmScope: "main",
  configHash: "",
  loading: false,
  error: null,
  simulateResult: null,
  simulating: false,

  fetchBindings: async (filter) => {
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (filter?.agentId) params.set("agentId", filter.agentId);
      if (filter?.channel) params.set("channel", filter.channel);
      const res = await fetch(`/api/deck/routing?${params}`);
      if (!res.ok) {
        set({ error: "Failed to fetch bindings" });
        return;
      }
      const data = await res.json();
      set({
        bindings: data.bindings ?? [],
        defaultAgentId: data.defaultAgentId ?? "",
        dmScope: data.dmScope ?? "main",
        configHash: data.configHash ?? "",
      });
    } finally {
      set({ loading: false });
    }
  },

  addBinding: async (params) => {
    const { configHash } = get();
    const res = await fetch("/api/deck/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", ...params, baseHash: configHash }),
    });
    const data = await res.json();
    if (data.configHash) set({ configHash: data.configHash });
    if (res.ok) await get().fetchBindings();
    return { ok: res.ok, warnings: data.warnings };
  },

  removeBinding: async (id) => {
    const { configHash } = get();
    const res = await fetch("/api/deck/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", id, baseHash: configHash }),
    });
    const data = await res.json();
    if (data.configHash) set({ configHash: data.configHash });
    if (res.ok) await get().fetchBindings();
    return res.ok;
  },

  validateBinding: async (params) => {
    const res = await fetch("/api/deck/routing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "validate", ...params }),
    });
    return res.json();
  },

  simulate: async (params) => {
    set({ simulating: true });
    try {
      const res = await fetch("/api/deck/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate", ...params }),
      });
      if (res.ok) {
        const data = await res.json();
        set({ simulateResult: data });
      }
    } finally {
      set({ simulating: false });
    }
  },
}));
```

- [ ] **Step 4: Create deck-subagents store with visibility-gated polling**

Key feature: `startPolling()` / `stopPolling()` using `setInterval` + `document.visibilitychange` event to pause when tab is hidden.

- [ ] **Step 5: Create deck-agents store**

Key feature: detail cache with 60s TTL via `Map<string, { data: AgentDetail; fetchedAt: number }>`.

- [ ] **Step 6: Verify TypeScript compilation**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] [impl] feat(deck): add API routes + Zustand stores for deck.routing/agents/subagents" \
  dashboard/src/app/api/deck/ \
  dashboard/src/stores/deck-routing.ts \
  dashboard/src/stores/deck-subagents.ts \
  dashboard/src/stores/deck-agents.ts
```

### Task 7: Shared Components + NavRail Registration

**Files:**

- Create: `dashboard/src/components/shared/AgentBadge.tsx`
- Create: `dashboard/src/components/shared/TierBadge.tsx`
- Create: `dashboard/src/components/shared/SessionKeyDisplay.tsx`
- Create: `dashboard/src/components/shared/BindingDialog.tsx`
- Create: `dashboard/src/components/shared/LineageTree.tsx`
- Create: `dashboard/src/components/shared/SubagentRunCard.tsx`
- Modify: `dashboard/src/stores/ui.ts` — add `"routing" | "subagents"` to Panel type
- Modify: `dashboard/src/components/layout/NavRail.tsx` — add items to navGroups
- Modify: `dashboard/src/messages/zh-CN.json` — add i18n keys
- Modify: `dashboard/src/messages/en.json` — add i18n keys

**covers:**

- `routing-panel > ADDED > Routing panel displays all bindings sorted by priority > "Display bindings table"` (TierBadge)
- `subagents-panel > ADDED > Active Runs tab shows lineage tree > "Display lineage tree"` (LineageTree)
- `agents-panel-enhancement > ADDED > Overview tab shows agent summary with stat cards > "Display overview"` (AgentBadge)

**Skills:** `frontend-design`, `ui-ux-pro-max`

- [ ] **Step 1: Create AgentBadge — agent emoji + name + link**

Small presentational component. Props: `agentId`, `agentName?`, `agentEmoji?`, `onClick?`.

- [ ] **Step 2: Create TierBadge — priority tier label with color**

Badge component. Props: `tier: string`. Maps tier to color: peer=blue, guild+roles=purple, guild=indigo, team=teal, account=amber, channel=gray.

- [ ] **Step 3: Create SessionKeyDisplay — parse + highlight segments**

Parses `agent:coder:discord:channel:dev-help` into colored segments.

- [ ] **Step 4: Create BindingDialog — add/edit with dynamic fields + validation**

Dialog using shadcn/ui Dialog + Select + Input. Props: `prefill?: { agentId?, channel?, accountId? }`, `onSave`, `onCancel`. Dynamic fields based on channel selection. Real-time validation via `useDeckRoutingStore().validateBinding()`.

- [ ] **Step 5: Create LineageTree — pure CSS flexbox tree**

Props: `nodes: LineageNode[]`, `rootSessionKey: string`. Renders tree with CSS `::before`/`::after` connectors. Status icons: 🔄/✅/❌/⏱️.

- [ ] **Step 6: Create SubagentRunCard — run info with actions**

Props: `run: SubagentRun`, `onKill?`, `onViewSession?`. Shows agent badge, task, depth, model, elapsed time (live updating via `useEffect` interval), actions.

- [ ] **Step 7: Register panels in UI store + NavRail**

Add `"routing" | "subagents"` to Panel type union. Add to `navGroups`:

- CORE group: `{ panel: "routing", labelKey: "routing", icon: GitBranch }` (after "agents")
- OBSERVE group: `{ panel: "subagents", labelKey: "subagents", icon: Network }` (first in group)

- [ ] **Step 8: Add i18n keys**

Add to both `zh-CN.json` and `en.json`:

```json
"nav": {
  "routing": "消息路由" / "Routing",
  "subagents": "子智能体" / "Subagents"
},
"routing": { "title": "...", "bindings": "...", "simulator": "...", ... },
"subagents": { "title": "...", "activeRuns": "...", "history": "...", ... },
"agentDetail": { "overview": "...", "routing": "...", "skills": "...", "subagent": "...", "sessions": "..." }
```

- [ ] **Step 9: Verify build**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
scripts/committer "[enhanced] [impl] feat(deck): add shared components + NavRail registration for Routing and Subagents" \
  dashboard/src/components/shared/ \
  dashboard/src/stores/ui.ts \
  dashboard/src/components/layout/NavRail.tsx \
  dashboard/src/messages/
```

---

## Phase 3: Frontend Panels (Parallelizable)

### Task 8: Routing Panel

**Files:**

- Create: `dashboard/src/components/panels/routing/RoutingPanel.tsx`
- Create: `dashboard/src/components/panels/routing/BindingTable.tsx`
- Create: `dashboard/src/components/panels/routing/RouteSimulator.tsx`
- Modify: `dashboard/src/components/layout/Shell.tsx` — add panel rendering case

**covers:**

- `routing-panel > ADDED > Routing panel displays all bindings sorted by priority > "Display bindings table"`
- `routing-panel > ADDED > Routing panel displays all bindings sorted by priority > "Filter by channel"`
- `routing-panel > ADDED > Routing panel provides route simulator > "Simulate route with peer match"`
- `routing-panel > ADDED > Routing panel provides route simulator > "Simulate route with default fallback"`
- `routing-panel > ADDED > Binding Dialog supports add/edit with real-time validation > "Add binding with validation"`
- `routing-panel > ADDED > Binding Dialog supports add/edit with real-time validation > "Channel-specific fields"`
- `routing-panel > ADDED > Routing panel shows DM scope configuration > "Display DM scope"`
- `routing-panel > ADDED > Routing panel is responsive > "Desktop layout"`
- `routing-panel > ADDED > Routing panel is responsive > "Narrow layout"`

**Skills:** `frontend-design`, `ui-ux-pro-max`

- [ ] **Step 1: Create RoutingPanel with responsive split layout**
- [ ] **Step 2: Implement BindingTable — sorted by tier, filters, Default row, DM scope**
- [ ] **Step 3: Implement RouteSimulator — dynamic form + 8-tier results**
- [ ] **Step 4: Wire add/edit/delete to BindingDialog + store**
- [ ] **Step 5: Add panel rendering case in Shell.tsx**
- [ ] **Step 6: Verify TypeScript + visual check**
- [ ] **Step 7: Commit**

### Task 9: Agents Panel Enhancement

**Files:**

- Modify: `dashboard/src/components/panels/agents/AgentsPanel.tsx` — rewrite to Master-Detail
- Create: `dashboard/src/components/panels/agents/AgentList.tsx`
- Create: `dashboard/src/components/panels/agents/AgentDetail.tsx`
- Create: `dashboard/src/components/panels/agents/tabs/OverviewTab.tsx`
- Create: `dashboard/src/components/panels/agents/tabs/RoutingTab.tsx`
- Create: `dashboard/src/components/panels/agents/tabs/SkillsTab.tsx`
- Create: `dashboard/src/components/panels/agents/tabs/SubagentTab.tsx`
- Create: `dashboard/src/components/panels/agents/tabs/SessionsTab.tsx`

**covers:**

- `agents-panel-enhancement > ADDED > Agents panel uses Master-Detail layout > "Select agent from list"`
- `agents-panel-enhancement > ADDED > Overview tab shows agent summary with stat cards > "Display overview"`
- `agents-panel-enhancement > ADDED > Routing tab shows agent-specific bindings > "View agent bindings"`
- `agents-panel-enhancement > ADDED > Routing tab shows agent-specific bindings > "Add binding from agent context"`
- `agents-panel-enhancement > ADDED > Skills tab manages per-agent skill assignment > "Switch to whitelist mode"`
- `agents-panel-enhancement > ADDED > Skills tab manages per-agent skill assignment > "Display runtime eligibility"`
- `agents-panel-enhancement > ADDED > Subagent tab manages agent spawn permissions > "Configure allowed agents"`
- `agents-panel-enhancement > ADDED > Subagent tab manages agent spawn permissions > "Display effective limits"`
- `agents-panel-enhancement > ADDED > Sessions tab shows agent-scoped sessions > "Filter subagent sessions"`

**Skills:** `frontend-design`, `ui-ux-pro-max`

- [ ] **Step 1: Refactor AgentsPanel to Master-Detail (left list 240px + right detail)**
- [ ] **Step 2: Implement AgentList + AgentDetail container with 5 tabs**
- [ ] **Step 3: Implement OverviewTab — basic info + 5 stat cards**
- [ ] **Step 4: Implement RoutingTab — agent-filtered binding table + BindingDialog**
- [ ] **Step 5: Implement SkillsTab — mode switcher + skill checklist**
- [ ] **Step 6: Implement SubagentTab — allowAgents + model + effective limits + active runs**
- [ ] **Step 7: Implement SessionsTab — agent-scoped session list with type filter**
- [ ] **Step 8: Verify TypeScript + visual check**
- [ ] **Step 9: Commit**

### Task 10: Subagents Panel

**Files:**

- Create: `dashboard/src/components/panels/subagents/SubagentsPanel.tsx`
- Create: `dashboard/src/components/panels/subagents/ActiveRunsTab.tsx`
- Create: `dashboard/src/components/panels/subagents/HistoryTab.tsx`
- Create: `dashboard/src/components/panels/subagents/ConfigTab.tsx`
- Modify: `dashboard/src/components/layout/Shell.tsx` — add panel rendering case

**covers:**

- `subagents-panel > ADDED > Active Runs tab shows real-time subagent status > "Display active runs"`
- `subagents-panel > ADDED > Active Runs tab shows real-time subagent status > "Polling pauses when tab is hidden"`
- `subagents-panel > ADDED > Active Runs tab shows real-time subagent status > "Kill subagent run"`
- `subagents-panel > ADDED > Active Runs tab shows lineage tree > "Display lineage tree"`
- `subagents-panel > ADDED > History tab shows recent completed runs > "Display history"`
- `subagents-panel > ADDED > History tab shows recent completed runs > "Empty history after sweep"`
- `subagents-panel > ADDED > History tab shows recent completed runs > "Filter by status"`
- `subagents-panel > ADDED > Config tab shows global subagent limits and per-agent permissions > "Edit global defaults"`
- `subagents-panel > ADDED > Config tab shows global subagent limits and per-agent permissions > "View per-agent permissions matrix"`

**Skills:** `frontend-design`, `ui-ux-pro-max`

- [ ] **Step 1: Create SubagentsPanel with 3-tab layout**
- [ ] **Step 2: Implement ActiveRunsTab — tree-nested run cards + visibility-gated polling**
- [ ] **Step 3: Implement HistoryTab — table + filters + ephemeral empty state**
- [ ] **Step 4: Implement ConfigTab — global defaults form + per-agent matrix**
- [ ] **Step 5: Add panel rendering case in Shell.tsx**
- [ ] **Step 6: Verify TypeScript + visual check**
- [ ] **Step 7: Commit**

### Task 11: Panel Enhancements (Sessions, Skills, Channels)

**Files:**

- Modify: `dashboard/src/components/panels/sessions/SessionsPanel.tsx`
- Modify: `dashboard/src/components/panels/sessions/SessionDetail.tsx` (or create)
- Modify: `dashboard/src/components/panels/skills/SkillsPanel.tsx`
- Create: `dashboard/src/components/panels/skills/SkillMatrixTab.tsx`
- Modify: `dashboard/src/components/panels/channels/ChannelsPanel.tsx`
- Create: `dashboard/src/components/panels/channels/BindingsTab.tsx`

**covers:**

- `panel-enhancements > ADDED > Sessions panel displays session type column > "Display subagent session type"`
- `panel-enhancements > ADDED > Sessions panel displays session type column > "Filter by session type"`
- `panel-enhancements > ADDED > Session detail shows lineage for subagent sessions > "Display lineage block"`
- `panel-enhancements > ADDED > Session detail shows lineage for subagent sessions > "Non-subagent session has no lineage"`
- `panel-enhancements > ADDED > Skills panel includes Agent assignment matrix tab > "Display matrix"`
- `panel-enhancements > ADDED > Skills panel includes Agent assignment matrix tab > "Toggle skill assignment"`
- `panel-enhancements > ADDED > Skills panel includes Agent assignment matrix tab > "All-mode agent cells are not clickable"`
- `panel-enhancements > ADDED > Channels panel includes Agent bindings tab > "View channel bindings"`
- `panel-enhancements > ADDED > Channels panel includes Agent bindings tab > "Unbind channel"`
- `panel-enhancements > ADDED > Channels panel includes Agent bindings tab > "Display DM policy summary"`

**Skills:** `frontend-design`, `ui-ux-pro-max`

- [ ] **Step 1: Sessions — add Type column + type filter + subagent depth/parent**
- [ ] **Step 2: Sessions — add lineage block in detail view for subagent sessions**
- [ ] **Step 3: Skills — add SkillMatrixTab with Agent × Skill cross-table**
- [ ] **Step 4: Channels — add BindingsTab with channel+account selector + binding table**
- [ ] **Step 5: Verify TypeScript**
- [ ] **Step 6: Commit**

---

## Phase 4: Integration (Serial — Task N)

### Task 12: Cross-Panel Navigation + Integration Testing

**Files:**

- Modify: Multiple panel components (add `onClick` navigation handlers)
- Test: E2E tests or manual verification

**covers:** All cross-panel navigation links defined in design spec

**Skills:** `superpowers:verification-before-completion`

- [ ] **Step 1: Wire cross-panel links**

Routing → click agentId → `setActivePanel("agents")` + select agent.
Agents → Routing tab "View all" → `setActivePanel("routing")` with filter.
Agents → Subagent tab "View all" → `setActivePanel("subagents")`.
Subagents → click session → `setActivePanel("sessions")`.
Sessions → subagent lineage link → `setActivePanel("subagents")`.
Skills matrix → click agent column → `setActivePanel("agents")`.
Channels → click agent → `setActivePanel("agents")`.

- [ ] **Step 2: Verify navigation with prefilled filters**

Test each link manually. Ensure filter pre-population works (e.g., Agents Routing tab → Routing panel with agentId filter).

- [ ] **Step 3: Test baseHash conflict recovery**

Open two browser tabs. Add binding in tab 1. Try adding in tab 2 with stale baseHash. Verify CONFLICT error + UI shows "reload" prompt.

- [ ] **Step 4: Test scope enforcement**

Verify read RPCs work with VIEWER scope. Verify write RPCs require ADMIN scope.

- [ ] **Step 5: Verify responsive layouts**

Check Routing panel at ≥1280px (side-by-side) and <1280px (stacked). Check Agents panel at desktop/tablet/mobile breakpoints.

- [ ] **Step 6: Run full test suite**

Run: `pnpm test`
Expected: PASS (no regressions)

- [ ] **Step 7: Run TypeScript check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Final commit**

```bash
scripts/committer "[enhanced] [impl] feat(deck): wire cross-panel navigation + integration verification" \
  dashboard/src/components/panels/
```

---

## Requirement Coverage Matrix

| Spec File                | Requirement               | Covered By Task |
| ------------------------ | ------------------------- | --------------- |
| deck-routing-api         | deck.routing.list         | Task 2          |
| deck-routing-api         | deck.routing.add          | Task 2          |
| deck-routing-api         | deck.routing.remove       | Task 2          |
| deck-routing-api         | deck.routing.validate     | Task 2          |
| deck-routing-api         | deck.routing.simulate     | Task 2          |
| deck-agents-api          | deck.agents.detail        | Task 3          |
| deck-agents-api          | deck.agents.skills.get    | Task 3          |
| deck-agents-api          | deck.agents.skills.set    | Task 3          |
| deck-agents-api          | deck.agents.subagents.get | Task 3          |
| deck-agents-api          | deck.agents.subagents.set | Task 3          |
| deck-subagents-api       | deck.subagents.list       | Task 4          |
| deck-subagents-api       | deck.subagents.kill       | Task 4          |
| deck-subagents-api       | deck.subagents.lineage    | Task 4          |
| deck-auxiliary-api       | deck.identity.list        | Task 5          |
| deck-auxiliary-api       | deck.identity.link        | Task 5          |
| deck-auxiliary-api       | deck.identity.unlink      | Task 5          |
| deck-auxiliary-api       | deck.threads.list         | Task 5          |
| routing-panel            | all requirements          | Task 8          |
| subagents-panel          | all requirements          | Task 10         |
| agents-panel-enhancement | all requirements          | Task 9          |
| panel-enhancements       | Sessions type column      | Task 11         |
| panel-enhancements       | Session detail lineage    | Task 11         |
| panel-enhancements       | Skills matrix             | Task 11         |
| panel-enhancements       | Channels bindings         | Task 11         |

**Coverage: 100% — all ADDED requirements in all 8 spec files are covered by at least one task.**

---

## Parallel Execution Summary

```
Phase 0 (Serial):  Task 1 — Infrastructure
Phase 1 (Parallel): Task 2 (routing) | Task 3 (agents) | Task 4 (subagents) | Task 5 (aux)
Phase 2 (Serial):  Task 6 (stores) → Task 7 (components + NavRail)
Phase 3 (Parallel): Task 8 (Routing panel) | Task 9 (Agents) | Task 10 (Subagents) | Task 11 (enhancements)
Phase 4 (Serial):  Task 12 — Integration + verification
```
