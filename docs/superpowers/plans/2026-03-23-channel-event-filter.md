# Channel Event Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-agent eventStreams whitelist filtering to Gateway's `nodeSendToSession` so operators can control which agent event streams reach external channels (WeCom/Telegram), while Deck Dashboard always receives full events.

**Architecture:** Filter layer inserted inside `sendToSession` in `server-node-subscriptions.ts` — the shared exit for all node/channel delivery paths. Config adds `channels.eventStreams` to both `AgentDefaultsConfig` and `AgentConfig`. Dashboard UI adds toggle controls in Agent Overview Tab.

**Tech Stack:** TypeScript, Zod (config validation), TypeBox (protocol schema), Ajv (param validation), Zustand (dashboard store), Next.js API routes, next-intl i18n, shadcn/ui Switch component

**Skill 依赖：**

| 域         | Skills                                               | 加载方式         |
| ---------- | ---------------------------------------------------- | ---------------- |
| [backend]  | superpowers:test-driven-development                  | session 首次加载 |
| [frontend] | frontend-design, superpowers:test-driven-development | session 首次加载 |

**Design spec:** `docs/superpowers/specs/2026-03-23-channel-event-filter-design.md`

---

## File Structure

| Action | File                                                                        | Responsibility                                                   |
| ------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Modify | `src/config/types.agent-defaults.ts`                                        | Add `channels.eventStreams` to `AgentDefaultsConfig`             |
| Modify | `src/config/types.agents.ts`                                                | Add `channels` optional field to `AgentConfig`                   |
| Modify | `src/config/zod-schema.agent-defaults.ts`                                   | Zod schema for `channels.eventStreams` in defaults               |
| Modify | `src/config/zod-schema.agent-runtime.ts`                                    | Zod schema for `channels.eventStreams` in agent entry            |
| Modify | `src/agents/agent-scope.ts`                                                 | Add `channels` to `ResolvedAgentConfig` + `resolveAgentConfig()` |
| Modify | `src/gateway/server-node-subscriptions.ts`                                  | Insert filter logic in `sendToSession`                           |
| Create | `src/gateway/channel-event-filter.ts`                                       | `resolveChannelEventStreams()` + `DEFAULT_EVENT_STREAMS`         |
| Create | `src/gateway/channel-event-filter.test.ts`                                  | Unit tests for filter logic                                      |
| Modify | `src/gateway/protocol/schema/deck.ts`                                       | TypeBox schemas for eventStreams.get/set                         |
| Modify | `src/gateway/protocol/index.ts`                                             | Compile + export new validators                                  |
| Modify | `src/gateway/server-methods-list.ts`                                        | Register 2 new methods                                           |
| Modify | `src/gateway/method-scopes.ts`                                              | Add scope entries                                                |
| Modify | `src/gateway/server-methods/deck/agents.ts`                                 | Implement get/set handlers                                       |
| Modify | `dashboard/src/stores/deck-agents.ts`                                       | Add `fetchEventStreams` / `setEventStreams`                      |
| Modify | `dashboard/src/app/api/deck/agents/route.ts`                                | Add `eventStreams.get`/`eventStreams.set` actions                |
| Create | `dashboard/src/components/panels/agents/tabs/ChannelEventStreamSection.tsx` | UI toggle list + preview                                         |
| Modify | `dashboard/src/components/panels/agents/tabs/OverviewTab.tsx`               | Import and render `ChannelEventStreamSection`                    |
| Modify | `dashboard/src/i18n/zh.json`                                                | Add ~15 i18n keys                                                |
| Modify | `dashboard/src/i18n/en.json`                                                | Add ~15 i18n keys                                                |
| Modify | `dashboard/server/gateway-allowlist.ts`                                     | Add 2 methods                                                    |

---

### Task 1: Config Types + Zod Schemas [backend]

Add `channels.eventStreams` field to config type definitions and Zod validation schemas.

**Files:**

- Modify: `src/config/types.agent-defaults.ts`
- Modify: `src/config/types.agents.ts`
- Modify: `src/config/zod-schema.agent-defaults.ts`
- Modify: `src/config/zod-schema.agent-runtime.ts`
- Modify: `src/agents/agent-scope.ts`

- [ ] **Step 1: Add channels type to AgentDefaultsConfig**

In `src/config/types.agent-defaults.ts`, add to the `AgentDefaultsConfig` type (after `sandbox`):

```typescript
/** Channel delivery controls (eventStreams whitelist for node/channel path). */
channels?: {
  /** Agent event streams allowed to reach external channels. Default: ["lifecycle","assistant"]. */
  eventStreams?: string[];
};
```

- [ ] **Step 2: Add channels type to AgentConfig**

In `src/config/types.agents.ts`, add to the `AgentConfig` type (after `tools`):

```typescript
/** Optional per-agent channel delivery overrides. */
channels?: {
  eventStreams?: string[];
};
```

- [ ] **Step 3: Add Zod schema for channels in AgentDefaultsSchema**

In `src/config/zod-schema.agent-defaults.ts`, add inside `AgentDefaultsSchema`'s `z.object({...})` (before the closing `}).strict().optional()`).

**IMPORTANT:** Both `AgentDefaultsSchema` and `AgentEntrySchema` use `.strict()` — any new field MUST be added inside the object literal, not after `.strict()`, otherwise Zod will reject configs containing `channels`.

```typescript
channels: z
  .object({
    eventStreams: z.array(z.string()).optional(),
  })
  .strict()
  .optional(),
```

- [ ] **Step 4: Add Zod schema for channels in AgentEntrySchema**

In `src/config/zod-schema.agent-runtime.ts`, add inside `AgentEntrySchema`'s `z.object({...})` (after `tools: AgentToolsSchema,`, before the closing `}).strict()`):

```typescript
channels: z
  .object({
    eventStreams: z.array(z.string()).optional(),
  })
  .strict()
  .optional(),
```

- [ ] **Step 5: Add channels to ResolvedAgentConfig and resolveAgentConfig()**

In `src/agents/agent-scope.ts`:

Add `channels` to `ResolvedAgentConfig` type (after `tools`, line ~40):

```typescript
channels?: AgentEntry["channels"];
```

Add `channels` to `resolveAgentConfig()` return object (after `tools: entry.tools,`, line ~142):

```typescript
channels: entry.channels,
```

**Why this is needed:** Task 4's RPC handler uses `resolveAgentConfig(cfg, agentId).channels?.eventStreams`. Without this change, TypeScript will reject the property access because `ResolvedAgentConfig` doesn't include `channels`.

- [ ] **Step 6: Verify types compile**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm tsgo`
Expected: PASS (zero type errors related to channels)

- [ ] **Step 7: Commit**

```bash
git add src/config/types.agent-defaults.ts src/config/types.agents.ts src/config/zod-schema.agent-defaults.ts src/config/zod-schema.agent-runtime.ts src/agents/agent-scope.ts
git commit -m "[enhanced] feat(config): add channels.eventStreams field for channel event filtering"
```

---

### Task 2: Gateway Filter Logic [backend]

Implement `resolveChannelEventStreams()` and insert the filter into `sendToSession`.

**Files:**

- Create: `src/gateway/channel-event-filter.ts`
- Create: `src/gateway/channel-event-filter.test.ts`
- Modify: `src/gateway/server-node-subscriptions.ts`

- [ ] **Step 1: Write failing tests for resolveChannelEventStreams**

**IMPORTANT — sessionKey → agentId resolution:** `loadSessionEntry()` returns `{ canonicalKey, ... }` but NOT `agentId` directly. However, it does full canonicalization (resolves aliases, legacy keys, custom `session.mainKey`). The correct approach is:

1. Call `loadSessionEntry(sessionKey)` to get `canonicalKey`
2. Call `parseAgentSessionKey(canonicalKey)` to extract `agentId` from the canonical key
3. Fall back to `resolveDefaultAgentId(cfg)` if parse fails

**Do NOT use `resolveAgentIdFromSessionKey()`** — it skips canonicalization and hardcodes fallback to `"main"`, which breaks when default agent is not `"main"` or when session aliases are configured.

Create `src/gateway/channel-event-filter.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import {
  resolveChannelEventStreams,
  DEFAULT_EVENT_STREAMS,
  shouldFilterChannelEvent,
} from "./channel-event-filter.js";

// Mock loadSessionEntry (returns canonicalKey for agentId extraction)
vi.mock("./session-utils.js", () => ({
  loadSessionEntry: vi.fn(),
}));
vi.mock("../config/config.js", () => ({
  loadConfig: vi.fn(),
}));

import { loadSessionEntry } from "./session-utils.js";
import { loadConfig } from "../config/config.js";

const mockLoadSessionEntry = vi.mocked(loadSessionEntry);
const mockLoadConfig = vi.mocked(loadConfig);

describe("resolveChannelEventStreams", () => {
  it("returns agent-level eventStreams when configured", () => {
    mockLoadSessionEntry.mockReturnValue({
      canonicalKey: "agent:coder:main",
      cfg: {},
      storePath: null,
      store: {},
      entry: null,
      legacyKey: undefined,
    } as unknown as ReturnType<typeof loadSessionEntry>);
    mockLoadConfig.mockReturnValue({
      agents: {
        list: [{ id: "coder", channels: { eventStreams: ["lifecycle", "tool"] } }],
      },
    } as ReturnType<typeof loadConfig>);

    expect(resolveChannelEventStreams("agent:coder:main")).toEqual(["lifecycle", "tool"]);
  });

  it("falls back to agents.defaults.channels.eventStreams", () => {
    mockLoadSessionEntry.mockReturnValue({
      canonicalKey: "agent:main:main",
      cfg: {},
      storePath: null,
      store: {},
      entry: null,
      legacyKey: undefined,
    } as unknown as ReturnType<typeof loadSessionEntry>);
    mockLoadConfig.mockReturnValue({
      agents: {
        defaults: { channels: { eventStreams: ["lifecycle"] } },
        list: [{ id: "main" }],
      },
    } as ReturnType<typeof loadConfig>);

    expect(resolveChannelEventStreams("agent:main:main")).toEqual(["lifecycle"]);
  });

  it("falls back to DEFAULT_EVENT_STREAMS when nothing configured", () => {
    mockLoadSessionEntry.mockReturnValue({
      canonicalKey: "agent:main:main",
      cfg: {},
      storePath: null,
      store: {},
      entry: null,
      legacyKey: undefined,
    } as unknown as ReturnType<typeof loadSessionEntry>);
    mockLoadConfig.mockReturnValue({
      agents: { list: [{ id: "main" }] },
    } as ReturnType<typeof loadConfig>);

    expect(resolveChannelEventStreams("agent:main:main")).toEqual(DEFAULT_EVENT_STREAMS);
  });
});

describe("shouldFilterChannelEvent", () => {
  it("allows chat events (never filtered)", () => {
    expect(shouldFilterChannelEvent("chat", undefined, ["lifecycle"])).toBe(false);
  });

  it("allows error stream (always pass through)", () => {
    expect(shouldFilterChannelEvent("agent", "error", ["lifecycle"])).toBe(false);
  });

  it("allows stream in whitelist", () => {
    expect(shouldFilterChannelEvent("agent", "lifecycle", ["lifecycle", "assistant"])).toBe(false);
  });

  it("filters stream NOT in whitelist", () => {
    expect(shouldFilterChannelEvent("agent", "tool", ["lifecycle", "assistant"])).toBe(true);
  });

  it("filters thinking when not in whitelist", () => {
    expect(shouldFilterChannelEvent("agent", "thinking", ["lifecycle", "assistant"])).toBe(true);
  });

  it("allows thinking when in whitelist", () => {
    expect(shouldFilterChannelEvent("agent", "thinking", ["lifecycle", "thinking"])).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm vitest run src/gateway/channel-event-filter.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement channel-event-filter.ts**

Create `src/gateway/channel-event-filter.ts`:

```typescript
import { loadConfig } from "../config/config.js";
import { normalizeAgentId, parseAgentSessionKey } from "../routing/session-key.js";
import { loadSessionEntry } from "./session-utils.js";

/** Default event streams allowed to reach external channels. */
export const DEFAULT_EVENT_STREAMS: readonly string[] = ["lifecycle", "assistant"];

/**
 * Resolve the eventStreams whitelist for a given session key.
 *
 * Resolution order:
 * 1. agent.channels.eventStreams (per-agent config)
 * 2. agents.defaults.channels.eventStreams (global default)
 * 3. DEFAULT_EVENT_STREAMS hardcoded fallback
 *
 * Uses loadSessionEntry for full canonicalization (resolves aliases, legacy keys,
 * custom session.mainKey), then parseAgentSessionKey to extract agentId.
 *
 * Semantic: `eventStreams: []` means "filter all agent streams" (only chat passes).
 * This is intentional — an empty whitelist = no agent events reach channels.
 * To restore defaults, remove the channels.eventStreams field entirely.
 */
export function resolveChannelEventStreams(sessionKey: string): readonly string[] {
  // Step 1: Canonicalize sessionKey → extract agentId
  const { canonicalKey } = loadSessionEntry(sessionKey);
  const parsed = parseAgentSessionKey(canonicalKey);
  const agentId = normalizeAgentId(parsed?.agentId);

  // Step 2: Load config and resolve eventStreams
  const cfg = loadConfig();

  // Per-agent config (undefined = not set, [] = explicitly empty = filter all)
  const agentEntry = cfg.agents?.list?.find((a) => a.id === agentId);
  const agentStreams = agentEntry?.channels?.eventStreams;
  if (agentStreams !== undefined) {
    return agentStreams;
  }

  // Global defaults
  const defaultStreams = cfg.agents?.defaults?.channels?.eventStreams;
  if (defaultStreams !== undefined) {
    return defaultStreams;
  }

  return DEFAULT_EVENT_STREAMS;
}

/**
 * Determine whether a channel event should be filtered (dropped).
 *
 * Rules:
 * - "chat" SSE events always pass through (return false)
 * - "agent" SSE events with stream "error" always pass through
 * - Other "agent" streams are checked against the whitelist
 *
 * @returns true if the event should be DROPPED, false if it should pass through
 */
export function shouldFilterChannelEvent(
  eventType: string,
  stream: string | undefined,
  allowedStreams: readonly string[],
): boolean {
  // Chat events always pass through
  if (eventType !== "agent") {
    return false;
  }

  // No stream info or error stream — always pass
  if (!stream || stream === "error") {
    return false;
  }

  // Check whitelist
  return !allowedStreams.includes(stream);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm vitest run src/gateway/channel-event-filter.test.ts`
Expected: PASS (all 8 tests)

- [ ] **Step 5: Insert filter into sendToSession**

In `src/gateway/server-node-subscriptions.ts`, modify the `sendToSession` closure inside `createNodeSubscriptionManager()` (lines 100-119).

**Note:** `sendToSession` is a closure inside `createNodeSubscriptionManager()`, NOT a standalone export. The replacement code must stay inside the closure to access `sessionSubscribers` and `toPayloadJSON`.

Add import at top of the file:

```typescript
import { resolveChannelEventStreams, shouldFilterChannelEvent } from "./channel-event-filter.js";
```

Replace the existing `sendToSession` closure (lines 100-119) with:

```typescript
const sendToSession = (
  sessionKey: string,
  event: string,
  payload: unknown,
  sendEvent?: NodeSendEventFn | null,
) => {
  const normalizedSessionKey = sessionKey.trim();
  if (!normalizedSessionKey || !sendEvent) {
    return;
  }

  // [enhanced] Channel event filter — check agent's eventStreams whitelist
  if (event === "agent") {
    const stream = (payload as { stream?: string })?.stream;
    const allowedStreams = resolveChannelEventStreams(normalizedSessionKey);
    if (shouldFilterChannelEvent(event, stream, allowedStreams)) {
      return; // filtered out — stream not in agent's channel whitelist
    }
  }
  // "chat" and other SSE events always pass through — no filtering

  const subs = sessionSubscribers.get(normalizedSessionKey);
  if (!subs || subs.size === 0) {
    return;
  }

  const payloadJSON = toPayloadJSON(payload);
  for (const nodeId of subs) {
    sendEvent({ nodeId, event, payloadJSON });
  }
};
```

- [ ] **Step 6: Run full test suite to verify no regressions**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm vitest run src/gateway/channel-event-filter.test.ts src/gateway/server-node-events.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/gateway/channel-event-filter.ts src/gateway/channel-event-filter.test.ts src/gateway/server-node-subscriptions.ts
git commit -m "[enhanced] feat(gateway): add channel event filter in nodeSendToSession"
```

---

### Task 3: Protocol Schema + RPC Registration [backend]

Add TypeBox schemas for `deck.agents.eventStreams.get/set` and register them in the Gateway method system.

**Files:**

- Modify: `src/gateway/protocol/schema/deck.ts`
- Modify: `src/gateway/protocol/index.ts`
- Modify: `src/gateway/server-methods-list.ts`
- Modify: `src/gateway/method-scopes.ts`

- [ ] **Step 1: Add TypeBox schemas**

In `src/gateway/protocol/schema/deck.ts`, add after the `DeckAgentsSystemPromptPreviewParamsSchema` block:

```typescript
// === deck.agents.eventStreams.* ===
export const DeckAgentsEventStreamsGetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const DeckAgentsEventStreamsSetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    eventStreams: Type.Array(Type.String()),
    baseHash: NonEmptyString,
  },
  { additionalProperties: false },
);
```

- [ ] **Step 2: Compile validators in protocol/index.ts**

In `src/gateway/protocol/index.ts`, add imports alongside existing `DeckAgents*` imports:

```typescript
  DeckAgentsEventStreamsGetParamsSchema,
  DeckAgentsEventStreamsSetParamsSchema,
```

Add validation exports alongside existing `validateDeckAgents*`:

```typescript
// deck.agents.eventStreams.*
export const validateDeckAgentsEventStreamsGetParams = ajv.compile(
  DeckAgentsEventStreamsGetParamsSchema,
);
export const validateDeckAgentsEventStreamsSetParams = ajv.compile(
  DeckAgentsEventStreamsSetParamsSchema,
);
```

- [ ] **Step 3: Register methods in server-methods-list.ts**

In `src/gateway/server-methods-list.ts`, add after `"deck.agents.systemPrompt.preview"`:

```typescript
  "deck.agents.eventStreams.get",
  "deck.agents.eventStreams.set",
```

- [ ] **Step 4: Add scope entries in method-scopes.ts**

In `src/gateway/method-scopes.ts`:

- Add `"deck.agents.eventStreams.get"` to the read-only scope group (where `deck.agents.detail` etc. are)
- Add `"deck.agents.eventStreams.set"` to the write scope group (where `deck.agents.skills.set` etc. are)

- [ ] **Step 5: Verify types compile**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm tsgo`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/gateway/protocol/schema/deck.ts src/gateway/protocol/index.ts src/gateway/server-methods-list.ts src/gateway/method-scopes.ts
git commit -m "[enhanced] feat(gateway): add deck.agents.eventStreams.get/set protocol schema"
```

---

### Task 4: RPC Handler Implementation [backend]

Implement the `deck.agents.eventStreams.get` and `deck.agents.eventStreams.set` handlers.

**Files:**

- Modify: `src/gateway/server-methods/deck/agents.ts`

- [ ] **Step 1: Add imports**

In `src/gateway/server-methods/deck/agents.ts`, add to existing imports from `../../protocol/index.js`:

```typescript
  validateDeckAgentsEventStreamsGetParams,
  validateDeckAgentsEventStreamsSetParams,
```

Import the default constant:

```typescript
import { DEFAULT_EVENT_STREAMS } from "../../channel-event-filter.js";
```

- [ ] **Step 2: Implement eventStreams.get handler**

Add after the existing `deck.agents.subagents.set` handler (before the closing of the handlers object):

```typescript
  "deck.agents.eventStreams.get": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckAgentsEventStreamsGetParams,
        "deck.agents.eventStreams.get",
        respond,
      )
    ) {
      return;
    }
    const cfg = loadConfig();
    const agentId = (params as { agentId: string }).agentId;
    const agentConfig = resolveAgentConfig(cfg, agentId);
    if (!agentConfig) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    // Resolve effective eventStreams with fallback chain
    // Semantic: undefined = not set (use fallback), [] = explicitly empty (filter all agent streams)
    const agentStreams = agentConfig.channels?.eventStreams;
    const defaultStreams = cfg.agents?.defaults?.channels?.eventStreams;
    const effectiveStreams = agentStreams !== undefined
      ? agentStreams
      : defaultStreams !== undefined
        ? defaultStreams
        : [...DEFAULT_EVENT_STREAMS];
    const isDefault = agentStreams === undefined;

    const { snapshot } = await readConfigFileSnapshotForWrite();
    const configHash = resolveConfigSnapshotHash(snapshot) ?? "";

    respond(true, {
      agentId,
      eventStreams: effectiveStreams,
      isDefault,
      configHash,
    });
  },
```

- [ ] **Step 3: Implement eventStreams.set handler**

Add after the `eventStreams.get` handler:

```typescript
  "deck.agents.eventStreams.set": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckAgentsEventStreamsSetParams,
        "deck.agents.eventStreams.set",
        respond,
      )
    ) {
      return;
    }
    const { agentId, eventStreams, baseHash } = params as {
      agentId: string;
      eventStreams: string[];
      baseHash: string;
    };

    const { snapshot, writeOptions } = await readConfigFileSnapshotForWrite();
    const currentHash = resolveConfigSnapshotHash(snapshot) ?? "";
    const hashError = validateBaseHash(baseHash, currentHash);
    if (hashError) {
      respond(false, undefined, errorShape(hashError.code, hashError.message));
      return;
    }

    const cfg = structuredClone(snapshot.config);
    const agentList = cfg.agents?.list;
    if (!Array.isArray(agentList)) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }
    const agentEntry = agentList.find((a) => a.id === agentId);
    if (!agentEntry) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    // Update channels.eventStreams
    if (!agentEntry.channels) {
      (agentEntry as Record<string, unknown>).channels = {};
    }
    (agentEntry.channels as Record<string, unknown>).eventStreams = eventStreams;

    await writeConfigFile(cfg, writeOptions);

    // Re-read hash after write
    const { snapshot: newSnapshot } = await readConfigFileSnapshotForWrite();
    const configHash = resolveConfigSnapshotHash(newSnapshot) ?? "";

    respond(true, {
      ok: true,
      agentId,
      eventStreams,
      configHash,
    });
  },
```

- [ ] **Step 4: Add handler tests**

In `src/gateway/server-methods/deck/agents.test.ts`, add test cases for the new handlers (follow the existing `deck.agents.skills.get/set` test pattern):

```typescript
describe("deck.agents.eventStreams.get", () => {
  it("returns agent-level eventStreams when configured", async () => {
    const result = await callHandler("deck.agents.eventStreams.get", { agentId: "coder" });
    expect(result.eventStreams).toEqual(["lifecycle", "tool"]);
    expect(result.isDefault).toBe(false);
  });

  it("returns defaults when not configured", async () => {
    const result = await callHandler("deck.agents.eventStreams.get", { agentId: "main" });
    expect(result.isDefault).toBe(true);
  });

  it("returns NOT_FOUND for unknown agent", async () => {
    const result = await callHandler("deck.agents.eventStreams.get", { agentId: "nonexistent" });
    // Expect error response
  });
});

describe("deck.agents.eventStreams.set", () => {
  it("writes eventStreams to agent config", async () => {
    // Follow existing skills.set test pattern: read hash → set → verify
  });

  it("rejects on baseHash mismatch", async () => {
    // Follow existing skills.set hash-mismatch test pattern
  });

  it("returns NOT_FOUND for unknown agent", async () => {
    // Expect error response
  });
});
```

Adapt the test setup from the existing `callHandler` helper in the test file. The tests need mock config with agents that have/don't have `channels.eventStreams`.

- [ ] **Step 5: Verify types compile**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm tsgo`
Expected: PASS

- [ ] **Step 6: Run handler tests**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm vitest run src/gateway/server-methods/deck/agents.test.ts`
Expected: PASS

- [ ] **Step 7: Add allowlist entries**

In `dashboard/server/gateway-allowlist.ts`, add after `"deck.agents.systemPrompt.preview"`:

```typescript
  "deck.agents.eventStreams.get",
  "deck.agents.eventStreams.set",
```

- [ ] **Step 8: Commit**

```bash
git add src/gateway/server-methods/deck/agents.ts src/gateway/server-methods/deck/agents.test.ts dashboard/server/gateway-allowlist.ts
git commit -m "[enhanced] feat(gateway): implement deck.agents.eventStreams.get/set handlers"
```

---

### Task 5: Dashboard Store + API Route [frontend]

Extend the deck-agents store with `fetchEventStreams` and `setEventStreams` actions, and add API route dispatch.

> **Note:** The design spec says to create a new `dashboard/src/app/api/deck/agents/eventStreams/route.ts`. The plan intentionally adds to the existing `route.ts` instead, following the established pattern where ALL agent actions dispatch through a single route with an `action` field. This is simpler and consistent with skills/subagents/toolPolicy/systemPrompt routes.

**Files:**

- Modify: `dashboard/src/stores/deck-agents.ts`
- Modify: `dashboard/src/app/api/deck/agents/route.ts`

- [ ] **Step 1: Add state type, state, and actions to deck-agents store**

Follow existing `currentSkills` / `currentSubagentConfig` object pattern — do NOT use flat fields.

Add type (alongside existing `AgentSkills` / `AgentSubagentConfig`):

```typescript
export interface AgentEventStreamsConfig {
  eventStreams: string[];
  isDefault: boolean;
  configHash: string;
}
```

Add to store state interface:

```typescript
currentEventStreams: AgentEventStreamsConfig | null;
```

Add to actions interface:

```typescript
fetchEventStreams: (agentId: string) => Promise<void>;
setEventStreams: (agentId: string, eventStreams: string[], baseHash: string) => Promise<boolean>;
```

Add initial state value:

```typescript
currentEventStreams: null,
```

- [ ] **Step 2: Implement fetchEventStreams action**

Follow existing `fetchSkills` pattern:

```typescript
fetchEventStreams: async (agentId: string) => {
  try {
    const res = await fetch("/api/deck/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "eventStreams.get", agentId }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as AgentEventStreamsConfig;
    set({ currentEventStreams: data });
  } catch (err) {
    set({ error: String(err) });
  }
},
```

- [ ] **Step 3: Implement setEventStreams action**

Follow existing `updateSkills` pattern:

```typescript
setEventStreams: async (agentId: string, eventStreams: string[], baseHash: string) => {
  try {
    const res = await fetch("/api/deck/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "eventStreams.set", agentId, eventStreams, baseHash }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { ok: boolean; configHash: string };
    set({
      currentEventStreams: {
        eventStreams,
        isDefault: false,
        configHash: data.configHash,
      },
    });
    return true;
  } catch (err) {
    set({ error: String(err) });
    return false;
  }
},
```

- [ ] **Step 4: Add API route actions**

In `dashboard/src/app/api/deck/agents/route.ts`:

Add `"eventStreams.get"` and `"eventStreams.set"` to the `AgentAction` union type:

```typescript
type AgentAction =
  | "skills.get"
  | "skills.set"
  | "subagents.get"
  | "subagents.set"
  | "toolPolicy.preview"
  | "systemPrompt.preview"
  | "eventStreams.get"
  | "eventStreams.set";
```

Add cases to the switch statement:

```typescript
    case "eventStreams.get":
      return gatewayRequest("deck.agents.eventStreams.get", params);
    case "eventStreams.set":
      return gatewayRequest("deck.agents.eventStreams.set", params);
```

- [ ] **Step 5: Verify types compile**

Run: `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/stores/deck-agents.ts dashboard/src/app/api/deck/agents/route.ts
git commit -m "[enhanced] feat(deck): add eventStreams store actions and API route"
```

---

### Task 6: Dashboard UI — ChannelEventStreamSection [frontend]

Create the toggle-based UI component for configuring eventStreams per agent, and integrate it into OverviewTab.

> **Scope note:** The design spec describes a `ChannelPreviewPanel` with Deck vs channel side-by-side preview. This is deferred to a follow-up — the toggle list alone provides the core configuration capability. Preview requires mock event rendering which adds significant complexity with low initial value (YAGNI).

**Files:**

- Create: `dashboard/src/components/panels/agents/tabs/ChannelEventStreamSection.tsx`
- Modify: `dashboard/src/components/panels/agents/tabs/OverviewTab.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add i18n keys**

In `dashboard/src/i18n/zh.json`, add under `"agentDetail"`:

```json
"eventStreams": {
  "title": "渠道事件分发",
  "description": "Deck Dashboard 始终接收全量事件。此配置仅影响外部消息渠道（WeCom / Telegram 等）。",
  "chat": "最终回复",
  "chatHint": "始终开启",
  "lifecycle": "运行状态",
  "lifecycleHint": "开始/结束/错误",
  "assistant": "文本输出",
  "assistantHint": "LLM 文本流",
  "tool": "工具调用",
  "toolHint": "工具名称和结果",
  "thinking": "推理过程",
  "thinkingHint": "模型思考内容",
  "locked": "始终开启",
  "usingDefault": "使用全局默认",
  "saveError": "保存失败"
}
```

In `dashboard/src/i18n/en.json`, add matching keys:

```json
"eventStreams": {
  "title": "Channel Event Streams",
  "description": "Deck Dashboard always receives all events. This config only affects external channels (WeCom / Telegram etc.).",
  "chat": "Final Reply",
  "chatHint": "Always on",
  "lifecycle": "Run Status",
  "lifecycleHint": "Start/End/Error",
  "assistant": "Text Output",
  "assistantHint": "LLM text stream",
  "tool": "Tool Calls",
  "toolHint": "Tool name and results",
  "thinking": "Reasoning",
  "thinkingHint": "Model thinking content",
  "locked": "Always on",
  "usingDefault": "Using global default",
  "saveError": "Save failed"
}
```

- [ ] **Step 2: Create ChannelEventStreamSection component**

Create `dashboard/src/components/panels/agents/tabs/ChannelEventStreamSection.tsx`:

```tsx
"use client";

import { Lock, Radio } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useDeckAgentsStore } from "@/stores/deck-agents";

interface Props {
  agentId: string;
}

/** Configurable stream definitions (chat is always on, error always passes). */
const STREAMS = ["lifecycle", "assistant", "tool", "thinking"] as const;

export function ChannelEventStreamSection({ agentId }: Props) {
  const t = useTranslations("agentDetail.eventStreams");
  const { currentEventStreams, fetchEventStreams, setEventStreams } = useDeckAgentsStore();

  useEffect(() => {
    void fetchEventStreams(agentId);
  }, [agentId, fetchEventStreams]);

  const handleToggle = useCallback(
    (stream: string, checked: boolean) => {
      if (!currentEventStreams) return;
      const updated = checked
        ? [...currentEventStreams.eventStreams, stream]
        : currentEventStreams.eventStreams.filter((s) => s !== stream);
      void setEventStreams(agentId, updated, currentEventStreams.configHash);
    },
    [agentId, currentEventStreams, setEventStreams],
  );

  if (!currentEventStreams) return null;

  const enabledSet = new Set(currentEventStreams.eventStreams);

  return (
    <Card className="border-[var(--border)]">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Radio size={16} className="text-[var(--accent)]" />
          <CardTitle className="text-sm font-medium">{t("title")}</CardTitle>
          {currentEventStreams.isDefault && (
            <Badge variant="outline" className="text-[10px] font-normal">
              {t("usingDefault")}
            </Badge>
          )}
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-1">{t("description")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Chat — always on, locked */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock size={12} className="text-[var(--text-secondary)]" />
            <div>
              <span className="text-sm">{t("chat")}</span>
              <span className="text-xs text-[var(--text-secondary)] ml-2">{t("chatHint")}</span>
            </div>
          </div>
          <Switch checked disabled aria-label={t("chat")} />
        </div>

        {/* Configurable streams */}
        {STREAMS.map((stream) => (
          <div key={stream} className="flex items-center justify-between">
            <div>
              <span className="text-sm">{t(stream)}</span>
              <span className="text-xs text-[var(--text-secondary)] ml-2">
                {t(`${stream}Hint`)}
              </span>
            </div>
            <Switch
              checked={enabledSet.has(stream)}
              onCheckedChange={(checked) => handleToggle(stream, checked)}
              aria-label={t(stream)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Integrate into OverviewTab**

In `dashboard/src/components/panels/agents/tabs/OverviewTab.tsx`:

Add import:

```typescript
import { ChannelEventStreamSection } from "./ChannelEventStreamSection";
```

Add the section at the bottom of the OverviewTab component's JSX (before the closing `</div>` of the main container), after the existing content:

```tsx
{
  /* Channel Event Streams */
}
<ChannelEventStreamSection agentId={detail.id} />;
```

- [ ] **Step 4: Verify types compile**

Run: `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Verify lint passes**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm check`
Expected: PASS (or only pre-existing issues)

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/panels/agents/tabs/ChannelEventStreamSection.tsx dashboard/src/components/panels/agents/tabs/OverviewTab.tsx dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): add Channel Event Stream config UI in Agent Overview"
```

---

### Task 7: Integration Verification [test]

Run full type checking, lint, and verify the end-to-end flow works.

**Files:** None (verification only)

- [ ] **Step 1: Type check backend**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm tsgo`
Expected: PASS

- [ ] **Step 2: Type check dashboard**

Run: `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Lint check**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm check`
Expected: PASS

- [ ] **Step 4: Run all related tests**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm vitest run src/gateway/channel-event-filter.test.ts src/gateway/server-methods/deck/agents.test.ts src/gateway/gateway-misc.test.ts`
Expected: PASS (filter tests + handler tests + node subscription tests)

- [ ] **Step 5: Verify i18n keys are symmetric**

Check that `zh.json` and `en.json` both have the same `agentDetail.eventStreams.*` keys. Read both files and compare the key paths under `agentDetail.eventStreams`.

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "[enhanced] fix: integration fixes for channel event filter"
```
