# Deck Routing / Session / Channel Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the Routing, Sessions, and Channels panels with condition editing, drag-to-reorder, conflict detection, DM scope visualization, context health monitoring, transcript search/export, enterprise channel wizards, and throughput monitoring.

**Architecture:** Primarily frontend enhancement with 4 minimal backend fixes (total ~25 lines). All features build on existing `deck.routing.*`, `sessions.*`, and `channels.*` RPC responses. New components integrate into existing panel structures (RoutingPanel tabs, SessionsPanel tabs, ChannelsPanel detail). Shared utilities (`detectConflicts`, `parseSessionKey`, `exportSession`) are extracted to `dashboard/src/lib/`.

**Tech Stack:** React 19, Zustand 5, Next.js 16, shadcn/ui, Tailwind v4, @dnd-kit/core + @dnd-kit/sortable (new dep), next-intl for i18n.

**Skill Dependencies:**

| Domain     | Skills                                                  | Loading       |
| ---------- | ------------------------------------------------------- | ------------- |
| [frontend] | frontend-design, ui-ux-pro-max, test-driven-development | session-level |

---

## File Structure

### New Files

| File                                                             | Responsibility                                    |
| ---------------------------------------------------------------- | ------------------------------------------------- |
| `dashboard/src/lib/detect-conflicts.ts`                          | O(n²) binding conflict detection utility          |
| `dashboard/src/lib/detect-conflicts.test.ts`                     | Unit tests for conflict detection                 |
| `dashboard/src/lib/session-key-parser.ts`                        | Parse `agent:{id}:{key}` into structured segments |
| `dashboard/src/lib/session-key-parser.test.ts`                   | Unit tests for session key parsing                |
| `dashboard/src/lib/session-export.ts`                            | JSON + Markdown session export                    |
| `dashboard/src/lib/session-export.test.ts`                       | Unit tests for session export                     |
| `dashboard/src/components/panels/routing/ConditionBuilder.tsx`   | Tag-based match condition editor                  |
| `dashboard/src/components/panels/routing/ConflictBadge.tsx`      | Warning badge for conflicting rules               |
| `dashboard/src/components/panels/routing/HitLog.tsx`             | Route hit log with polling                        |
| `dashboard/src/components/panels/sessions/ScopeStrategyCard.tsx` | DM scope mode card with diagram                   |
| `dashboard/src/components/panels/sessions/ScopeSelector.tsx`     | 4-card scope strategy picker                      |
| `dashboard/src/components/panels/sessions/ContextHealthBar.tsx`  | Token usage + compaction + message count          |
| `dashboard/src/components/panels/sessions/TranscriptSearch.tsx`  | Search input with match navigation                |
| `dashboard/src/components/panels/sessions/SessionExport.tsx`     | JSON/Markdown export dropdown                     |
| `dashboard/src/components/panels/channels/ConfigWizard.tsx`      | Reusable multi-step wizard shell                  |
| `dashboard/src/components/panels/channels/WeComWizard.tsx`       | WeCom 4-step wizard                               |
| `dashboard/src/components/panels/channels/FeishuWizard.tsx`      | Feishu 3-step wizard                              |
| `dashboard/src/components/panels/channels/ThroughputChart.tsx`   | Mini bar chart for message in/out                 |

### Modified Files

| File                                                         | Changes                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------ |
| `dashboard/package.json`                                     | Add `@dnd-kit/core`, `@dnd-kit/sortable`                           |
| `dashboard/src/stores/deck-routing.ts`                       | Add `conflictPairs`, `hitLog`, `hitLogPolling` state + actions     |
| `dashboard/src/stores/sessions.ts`                           | Add `dmScopeStrategy`, `updateDmScope` action                      |
| `dashboard/src/stores/channels.ts`                           | Add `throughput` state, `fetchThroughput` action                   |
| `dashboard/src/components/panels/routing/RoutingPanel.tsx`   | Convert to tabbed layout (Bindings / Simulator / Hit Log)          |
| `dashboard/src/components/panels/routing/BindingTable.tsx`   | Add @dnd-kit sortable, ConditionBuilder integration, ConflictBadge |
| `dashboard/src/components/panels/sessions/SessionsPanel.tsx` | Add Scope tab                                                      |
| `dashboard/src/components/panels/sessions/SessionDetail.tsx` | Add ContextHealthBar, TranscriptSearch, SessionExport              |
| `dashboard/src/components/panels/channels/ChannelsPanel.tsx` | No structural change (wizards launch from ChannelDetail)           |
| `dashboard/src/components/panels/channels/ChannelDetail.tsx` | Add wizard launch buttons, ThroughputChart                         |
| `dashboard/src/i18n/zh.json`                                 | Add routing/sessions/channels enhancement keys                     |
| `dashboard/src/i18n/en.json`                                 | Add routing/sessions/channels enhancement keys                     |

| `dashboard/src/components/shared/BindingDialog.tsx` | Replace inline form with ConditionBuilder |
| `src/gateway/server-methods/deck/routing.ts` | Add `position` param to `deck.routing.add` |
| `src/gateway/session-utils.ts` | Add `compactionCount` to sessions.list response |

---

## Task 0: Backend Prerequisites (4 minimal fixes)

**covers:** routing-condition-editor > Drag-to-reorder > "Drag rule up within same tier" (persistence); session-context-health > Context health > "View stressed session" (compaction count); channel-config-wizard > WeCom wizard > "Connection test" (probe); channel-config-wizard > Multi-account (account-scoped patch)

**Files:**

- Modify: `src/gateway/server-methods/deck/routing.ts:224` (1 line)
- Modify: `src/gateway/session-utils.ts:832` (1 line)
- Modify: `dashboard/src/app/api/channels/route.ts` (~5 lines)
- Modify: `dashboard/src/app/api/channels/[channelId]/route.ts` (~10 lines)

- [ ] **Step 1: Add `position` parameter to `deck.routing.add`**

In `src/gateway/server-methods/deck/routing.ts`, change:

```typescript
// Before (line ~224):
bindings.push(newBinding);

// After:
const position =
  typeof params.position === "number"
    ? Math.max(0, Math.min(params.position, bindings.length))
    : bindings.length;
bindings.splice(position, 0, newBinding);
```

Also add `position` to the validation schema for `deck.routing.add` params.

- [ ] **Step 2: Add `compactionCount` to sessions.list response**

In `src/gateway/session-utils.ts`, in the `listSessionsFromStore` response mapping (~line 832), add:

```typescript
compactionCount: entry?.compactionCount ?? 0,
```

- [ ] **Step 3: Add probe support to channels API**

Modify `dashboard/src/app/api/channels/route.ts`:

```typescript
export const GET = withAuth(async (req) => {
  const probe = new URL(req.url).searchParams.get("probe") === "true";
  return gatewayRequest("channels.status", { probe });
});
```

- [ ] **Step 4: Add account-scoped config patch to channels API**

Modify `dashboard/src/app/api/channels/[channelId]/route.ts` POST handler:

- Accept optional `accountId` in request body
- When `accountId` is provided, construct config.patch path as `channels.{channelId}.accounts.{accountId}.{field}` instead of patching channel root

- [ ] **Step 5: Update Dashboard SessionEntry type**

In `dashboard/src/stores/sessions.ts`, add `compactionCount` to `SessionEntry`:

```typescript
export interface SessionEntry {
  key: string;
  kind: SessionKind;
  model: string;
  tokensIn: number;
  tokensOut: number;
  contextWindow: number;
  compactionCount: number; // ← NEW
  updatedAt: number;
}
```

Update `normalizeSession` mapper to include `compactionCount`.

- [ ] **Step 6: Run type-check + tests**

```bash
pnpm tsgo && pnpm test
```

- [ ] **Step 7: Commit**

```bash
git add src/gateway/server-methods/deck/routing.ts src/gateway/session-utils.ts dashboard/src/app/api/channels/ dashboard/src/stores/sessions.ts
git commit -m "[enhanced] [impl] fix(gateway+deck): add position param, compaction count, probe support, account-scoped patch"
```

---

## Task 1: Conflict Detection Utility

**covers:** routing-condition-editor > Visual condition builder > "Compose multi-dimension condition" (validates overlap)

**Files:**

- Create: `dashboard/src/lib/detect-conflicts.ts`
- Create: `dashboard/src/lib/detect-conflicts.test.ts`

- [ ] **Step 1: Write failing tests for detectConflicts**

```typescript
// dashboard/src/lib/detect-conflicts.test.ts
import { describe, it, expect } from "vitest";
import { detectConflicts, type ConflictPair } from "./detect-conflicts";

describe("detectConflicts", () => {
  it("returns empty array when no conflicts", () => {
    const bindings = [
      { id: "a", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
      { id: "b", match: { channel: "discord" }, tier: "channel", agentId: "bot2" },
    ];
    expect(detectConflicts(bindings)).toEqual([]);
  });

  it("detects overlapping channel+peer rules", () => {
    const bindings = [
      {
        id: "a",
        match: { channel: "telegram", peer: { kind: "user", id: "123" } },
        tier: "peer",
        agentId: "bot1",
      },
      {
        id: "b",
        match: { channel: "telegram", peer: { kind: "user", id: "123" } },
        tier: "peer",
        agentId: "bot2",
      },
    ];
    const result = detectConflicts(bindings);
    expect(result).toHaveLength(1);
    expect(result[0].bindingA).toBe("a");
    expect(result[0].bindingB).toBe("b");
  });

  it("does not flag same-agent overlap as conflict", () => {
    const bindings = [
      { id: "a", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
      { id: "b", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
    ];
    expect(detectConflicts(bindings)).toEqual([]);
  });

  it("detects subset overlap (specific is subset of broad)", () => {
    const bindings = [
      { id: "a", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
      {
        id: "b",
        match: { channel: "telegram", peer: { kind: "user", id: "123" } },
        tier: "peer",
        agentId: "bot2",
      },
    ];
    const result = detectConflicts(bindings);
    expect(result).toHaveLength(1);
  });

  it("handles empty bindings", () => {
    expect(detectConflicts([])).toEqual([]);
  });

  it("handles single binding", () => {
    expect(
      detectConflicts([
        { id: "a", match: { channel: "telegram" }, tier: "channel", agentId: "bot1" },
      ]),
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && pnpm vitest run src/lib/detect-conflicts.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement detectConflicts**

```typescript
// dashboard/src/lib/detect-conflicts.ts
import type { Binding, BindingMatch } from "@/stores/deck-routing";

export interface ConflictPair {
  bindingA: string;
  bindingB: string;
  overlapType: "exact" | "subset";
}

/** Check if match A overlaps with match B — could a message match BOTH rules? */
function matchesOverlap(a: BindingMatch, b: BindingMatch): boolean {
  // Channel: if both specified, must match
  if (a.channel && b.channel && a.channel !== b.channel) return false;

  // AccountId
  if (a.accountId && b.accountId && a.accountId !== b.accountId) return false;

  // TeamId
  if (a.teamId && b.teamId && a.teamId !== b.teamId) return false;

  // Peer
  if (a.peer && b.peer) {
    if (a.peer.kind !== b.peer.kind || a.peer.id !== b.peer.id) return false;
  }

  // GuildId
  if (a.guildId && b.guildId && a.guildId !== b.guildId) return false;

  // Roles — overlap if they share at least one role
  if (a.roles?.length && b.roles?.length) {
    const setA = new Set(a.roles);
    if (!b.roles.some((r) => setA.has(r))) return false;
  }

  return true;
}

/** O(n²) pairwise conflict detection. Returns pairs of bindings that overlap AND target different agents. */
export function detectConflicts(
  bindings: Array<Pick<Binding, "id" | "match" | "tier" | "agentId">>,
): ConflictPair[] {
  const pairs: ConflictPair[] = [];
  for (let i = 0; i < bindings.length; i++) {
    for (let j = i + 1; j < bindings.length; j++) {
      const a = bindings[i];
      const b = bindings[j];
      // Same agent = not a conflict
      if (a.agentId === b.agentId) continue;
      // Default tier never conflicts with anything
      if (a.tier === "default" || b.tier === "default") continue;

      if (matchesOverlap(a.match, b.match)) {
        const isExact = JSON.stringify(a.match) === JSON.stringify(b.match);
        pairs.push({
          bindingA: a.id,
          bindingB: b.id,
          overlapType: isExact ? "exact" : "subset",
        });
      }
    }
  }
  return pairs;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && pnpm vitest run src/lib/detect-conflicts.test.ts`
Expected: PASS (6/6)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/detect-conflicts.ts dashboard/src/lib/detect-conflicts.test.ts
git commit -m "[enhanced] [impl] feat(deck): add routing conflict detection utility"
```

---

## Task 2: Session Key Parser Utility

**covers:** session-scope-visualizer > Session key parser > "Parse a DM session key"

**Files:**

- Create: `dashboard/src/lib/session-key-parser.ts`
- Create: `dashboard/src/lib/session-key-parser.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// dashboard/src/lib/session-key-parser.test.ts
import { describe, it, expect } from "vitest";
import { parseSessionKey, type SessionKeySegment } from "./session-key-parser";

describe("parseSessionKey", () => {
  it("parses main scope key", () => {
    const result = parseSessionKey("agent:bot-1:main");
    expect(result).toEqual([
      { label: "Agent", value: "bot-1" },
      { label: "Scope", value: "main" },
    ]);
  });

  it("parses per-peer DM key", () => {
    const result = parseSessionKey("agent:bot-1:direct:user123");
    expect(result).toEqual([
      { label: "Agent", value: "bot-1" },
      { label: "Type", value: "direct" },
      { label: "Peer", value: "user123" },
    ]);
  });

  it("parses per-channel-peer key", () => {
    const result = parseSessionKey("agent:bot-1:telegram:direct:user123");
    expect(result).toEqual([
      { label: "Agent", value: "bot-1" },
      { label: "Channel", value: "telegram" },
      { label: "Type", value: "direct" },
      { label: "Peer", value: "user123" },
    ]);
  });

  it("parses per-account-channel-peer key", () => {
    const result = parseSessionKey("agent:bot-1:wecom:acct1:direct:user123");
    expect(result).toEqual([
      { label: "Agent", value: "bot-1" },
      { label: "Channel", value: "wecom" },
      { label: "Account", value: "acct1" },
      { label: "Type", value: "direct" },
      { label: "Peer", value: "user123" },
    ]);
  });

  it("parses channel:peer key (no type segment)", () => {
    const result = parseSessionKey("agent:bot-1:telegram:user123");
    expect(result).toEqual([
      { label: "Agent", value: "bot-1" },
      { label: "Channel", value: "telegram" },
      { label: "Peer", value: "user123" },
    ]);
  });

  it("handles unknown format gracefully", () => {
    const result = parseSessionKey("something:unexpected");
    expect(result).toEqual([{ label: "Key", value: "something:unexpected" }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && pnpm vitest run src/lib/session-key-parser.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement parseSessionKey**

```typescript
// dashboard/src/lib/session-key-parser.ts
export interface SessionKeySegment {
  label: string;
  value: string;
}

const KNOWN_CHANNELS = new Set([
  "telegram",
  "discord",
  "slack",
  "signal",
  "imessage",
  "web",
  "whatsapp",
  "wecom",
  "feishu",
  "msteams",
  "matrix",
  "line",
  "zalo",
]);

const KNOWN_TYPES = new Set(["direct", "group", "main"]);

/**
 * Parse a session key like `agent:{agentId}:{scopeParts...}` into labeled segments.
 * Handles: main, per-peer (direct:X), per-channel-peer (ch:direct:X),
 * per-account-channel-peer (ch:acct:direct:X).
 */
export function parseSessionKey(key: string): SessionKeySegment[] {
  if (!key.startsWith("agent:")) {
    return [{ label: "Key", value: key }];
  }

  const parts = key.split(":");
  if (parts.length < 3) {
    return [{ label: "Key", value: key }];
  }

  const segments: SessionKeySegment[] = [{ label: "Agent", value: parts[1] }];
  const rest = parts.slice(2);

  if (rest.length === 1) {
    // agent:bot:main
    segments.push({ label: "Scope", value: rest[0] });
  } else if (rest.length === 2 && KNOWN_TYPES.has(rest[0])) {
    // agent:bot:direct:user123
    segments.push({ label: "Type", value: rest[0] });
    segments.push({ label: "Peer", value: rest[1] });
  } else if (rest.length >= 2 && KNOWN_CHANNELS.has(rest[0])) {
    segments.push({ label: "Channel", value: rest[0] });
    const afterChannel = rest.slice(1);
    if (afterChannel.length === 1) {
      // agent:bot:telegram:user123 (channel + peer, no type)
      segments.push({ label: "Peer", value: afterChannel[0] });
    } else if (afterChannel.length >= 2 && KNOWN_TYPES.has(afterChannel[0])) {
      // agent:bot:telegram:direct:user123
      segments.push({ label: "Type", value: afterChannel[0] });
      segments.push({ label: "Peer", value: afterChannel.slice(1).join(":") });
    } else if (afterChannel.length >= 3 && KNOWN_TYPES.has(afterChannel[1])) {
      // agent:bot:wecom:acct1:direct:user123
      segments.push({ label: "Account", value: afterChannel[0] });
      segments.push({ label: "Type", value: afterChannel[1] });
      segments.push({ label: "Peer", value: afterChannel.slice(2).join(":") });
    } else {
      segments.push({ label: "Scope", value: afterChannel.join(":") });
    }
  } else {
    segments.push({ label: "Scope", value: rest.join(":") });
  }

  return segments;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && pnpm vitest run src/lib/session-key-parser.test.ts`
Expected: PASS (5/5)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/session-key-parser.ts dashboard/src/lib/session-key-parser.test.ts
git commit -m "[enhanced] [impl] feat(deck): add session key parser utility"
```

---

## Task 3: Session Export Utility

**covers:** session-context-health > Transcript search > (export support); session-context-health > Session export

**Files:**

- Create: `dashboard/src/lib/session-export.ts`
- Create: `dashboard/src/lib/session-export.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// dashboard/src/lib/session-export.test.ts
import { describe, it, expect } from "vitest";
import { exportAsJson, exportAsMarkdown } from "./session-export";

const mockSession = {
  key: "agent:bot-1:direct:user123",
  kind: "direct" as const,
  model: "claude-sonnet-4-20250514",
  tokensIn: 1500,
  tokensOut: 800,
  contextWindow: 8000,
  updatedAt: 1711100000000,
};

const mockMessages = [
  { role: "user" as const, content: "Hello", timestamp: 1711100000000 },
  { role: "assistant" as const, content: "Hi there!", timestamp: 1711100001000 },
];

describe("exportAsJson", () => {
  it("includes session metadata and messages", () => {
    const json = exportAsJson(mockSession, mockMessages);
    const parsed = JSON.parse(json);
    expect(parsed.session.key).toBe("agent:bot-1:direct:user123");
    expect(parsed.messages).toHaveLength(2);
    expect(parsed.exportedAt).toBeDefined();
  });
});

describe("exportAsMarkdown", () => {
  it("formats messages with role headers", () => {
    const md = exportAsMarkdown(mockSession, mockMessages);
    expect(md).toContain("# Session: agent:bot-1:direct:user123");
    expect(md).toContain("**User:**");
    expect(md).toContain("Hello");
    expect(md).toContain("**Assistant:**");
    expect(md).toContain("Hi there!");
  });

  it("includes metadata section", () => {
    const md = exportAsMarkdown(mockSession, mockMessages);
    expect(md).toContain("Model: claude-sonnet-4-20250514");
    expect(md).toContain("Tokens: 1500 in / 800 out");
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement session-export**

```typescript
// dashboard/src/lib/session-export.ts
import type { SessionEntry, HistoryMessage } from "@/stores/sessions";

export function exportAsJson(session: SessionEntry, messages: HistoryMessage[]): string {
  return JSON.stringify(
    {
      session: {
        key: session.key,
        kind: session.kind,
        model: session.model,
        tokensIn: session.tokensIn,
        tokensOut: session.tokensOut,
        contextWindow: session.contextWindow,
        updatedAt: session.updatedAt,
      },
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      })),
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

export function exportAsMarkdown(session: SessionEntry, messages: HistoryMessage[]): string {
  const lines: string[] = [];
  lines.push(`# Session: ${session.key}\n`);
  lines.push(`- Model: ${session.model}`);
  lines.push(`- Tokens: ${session.tokensIn} in / ${session.tokensOut} out`);
  lines.push(`- Context Window: ${session.contextWindow}`);
  lines.push(`- Last Updated: ${new Date(session.updatedAt).toISOString()}`);
  lines.push("");
  lines.push("---\n");

  for (const msg of messages) {
    const label = msg.role === "user" ? "User" : msg.role === "assistant" ? "Assistant" : "System";
    const ts = msg.timestamp ? ` _(${new Date(msg.timestamp).toLocaleString()})_` : "";
    lines.push(`**${label}:**${ts}\n`);
    lines.push(msg.content);
    lines.push("");
  }

  return lines.join("\n");
}

/** Trigger browser download of text content. */
export function downloadBlob(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/session-export.ts dashboard/src/lib/session-export.test.ts
git commit -m "[enhanced] [impl] feat(deck): add session export utility (JSON + Markdown)"
```

---

## Task 4: Install @dnd-kit + ConditionBuilder + Drag-to-Reorder

**covers:** routing-condition-editor > Visual condition builder > all scenarios; routing-condition-editor > Drag-to-reorder > all scenarios

**Files:**

- Modify: `dashboard/package.json` (add @dnd-kit deps)
- Create: `dashboard/src/components/panels/routing/ConditionBuilder.tsx`
- Modify: `dashboard/src/components/panels/routing/BindingTable.tsx`
- Modify: `dashboard/src/i18n/zh.json`, `dashboard/src/i18n/en.json`

- [ ] **Step 1: Install @dnd-kit**

```bash
cd dashboard && pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 1.5: Fix existing i18n violations in BindingTable**

BindingTable.tsx has hardcoded English strings that violate `dashboard/CLAUDE.md` rules. Before adding new features, fix these:

- "Binding Rules" → `t("bindings")`
- "Add Rule" → `t("addBinding")`
- "All Channels" / "All Agents" → `tc("allChannels")` / `tc("allAgents")`
- "Loading..." → `tc("loading")`
- "No binding rules found" → `t("noBindings")`
- "Delete binding" → `t("deleteBinding")`

Also fix `ChannelsPanel.tsx` line 39: "Agent Bindings" → `t("agentBindings")`.

Add the `useTranslations("routing")` import if not already present.

- [ ] **Step 2: Create ConditionBuilder component**

Create `dashboard/src/components/panels/routing/ConditionBuilder.tsx`:

- Tag-based pill UI for each match dimension (channel, accountId, peer, guildId, roles)
- "+" button opens a dimension selector dropdown (only show dimensions not yet added)
- Each dimension renders as a colored pill with "×" remove button
- Channel dimension uses a Select dropdown populated from `useChannelsStore().channelOrder`
- Peer dimension uses a text input for kind:id
- Roles dimension allows comma-separated input
- `onChange(match: BindingMatch)` callback fires on every add/remove

Key implementation notes:

- Use `useTranslations("routing")` for all labels
- Use CSS variables for colors (no hardcoded values)
- Pill styling: `bg-[var(--accent-muted)] text-[var(--accent)]` with `hover:bg-[var(--danger-muted)]` on the × button

- [ ] **Step 3: Integrate ConditionBuilder into BindingDialog**

Modify `dashboard/src/components/shared/BindingDialog.tsx`:

- Replace inline match form fields with `<ConditionBuilder match={match} onChange={setMatch} />`
- Keep the agentId selector as-is

- [ ] **Step 4: Add @dnd-kit sortable to BindingTable**

Modify `dashboard/src/components/panels/routing/BindingTable.tsx`:

- Wrap `<tbody>` with `<DndContext>` + `<SortableContext>` (from @dnd-kit)
- Each `<tr>` becomes a `SortableBindingRow` using `useSortable()`
- Add a drag handle (GripVertical icon) as first cell
- `onDragEnd`: if source and target are same tier, persist via `removeBinding(old) + addBinding(new position)`
- Cross-tier drag blocked: in `onDragEnd`, check `active.data.current.tier === over.data.current.tier`
- Keyboard accessibility: Space to grab, Arrow to move, Escape to cancel (built-in @dnd-kit behavior)

- [ ] **Step 5: Add ConflictBadge integration**

Create `dashboard/src/components/panels/routing/ConflictBadge.tsx`:

- Small warning triangle icon with amber color
- Tooltip shows conflicting rule details (agent name, overlap type)
- Props: `bindingId: string, conflicts: ConflictPair[]`

Modify `dashboard/src/stores/deck-routing.ts`:

- Add `conflictPairs: ConflictPair[]` to state
- After `fetchBindings` succeeds, call `detectConflicts(bindings)` and store result
- Import from `@/lib/detect-conflicts`

Modify `BindingTable.tsx`: render `<ConflictBadge>` in each row when that binding appears in `conflictPairs`

- [ ] **Step 6: Add i18n keys for routing enhancements**

Add to `zh.json` under `routing`:

```json
"conditionBuilder": { "addDimension": "添加条件", "channel": "渠道", "accountId": "账户", "peer": "会话方", "guildId": "群组", "roles": "角色", "removeDimension": "移除" },
"conflict": { "detected": "冲突检测", "overlap": "与规则 {id} 存在匹配重叠", "exactMatch": "完全相同的匹配条件" },
"dragReorder": { "dragHandle": "拖拽排序", "crossTierBlocked": "不能跨层级拖拽" }
```

Add matching keys to `en.json`.

- [ ] **Step 7: Run type-check and lint**

```bash
pnpm tsgo && pnpm check
```

- [ ] **Step 8: Commit**

```bash
git add dashboard/
git commit -m "[enhanced] [impl] feat(deck): add ConditionBuilder + drag-to-reorder + conflict detection for routing"
```

---

## Task 5: Routing Activity Feed (degraded from Hit Log)

**covers:** routing-hit-log > Route hit log display > "View recent routing decisions" (degraded); routing-hit-log > Hit log filtering > all scenarios

**Degradation note:** True routing hit log requires Gateway-side event emission (modifying upstream `src/routing/` code, high rebase risk). Degraded to activity event list view — shows agent activity events (agentId + description + timestamp) filtered to routing-relevant types. Missing fields: tier, sessionKey, peer. These can be added when Gateway routing telemetry is implemented as a separate proposal.

**Files:**

- Create: `dashboard/src/components/panels/routing/ActivityFeed.tsx`
- Modify: `dashboard/src/components/panels/routing/RoutingPanel.tsx`

- [ ] **Step 1: Create ActivityFeed component**

Create `dashboard/src/components/panels/routing/ActivityFeed.tsx`:

- Read from `useActivityStore()` — filter events by `type === "agent"` or `type === "chat"`
- Reverse-chronological list using `<ScrollArea>`, last 20 entries
- Each entry: timestamp (relative), `<AgentBadge agentId={event.agentId} />`, event description
- Agent filter dropdown at top (filter by agentId)
- Empty state: illustration + "No recent agent activity" message
- Auto-refresh: re-read activity store every 10s via `setInterval`
- **Note:** This is NOT a true routing hit log — it shows agent activity, not per-message routing decisions. A banner at top says "Showing agent activity. Full routing hit log requires gateway telemetry (planned)."

- [ ] **Step 2: Add ActivityFeed to RoutingPanel**

Modify `dashboard/src/components/panels/routing/RoutingPanel.tsx`:

- Keep existing side-by-side layout on wide screens (≥1280px): BindingTable left, RouteSimulator right
- Add a "Activity" toggle button in the BindingTable header area that slides in ActivityFeed (replacing the simulator temporarily)
- On mobile (<1280px): use tabbed layout with 3 tabs: "Bindings", "Simulator", "Activity"
- This preserves the UX of seeing rules + simulator simultaneously on desktop

- [ ] **Step 4: Add i18n keys**

Add to `zh.json` routing namespace: `hitLog`, `noActivity`, `lastN`, `refreshing`.
Add matching `en.json` keys.

- [ ] **Step 5: Run type-check + lint**

```bash
pnpm tsgo && pnpm check
```

- [ ] **Step 6: Commit**

```bash
git add dashboard/
git commit -m "[enhanced] [impl] feat(deck): add routing hit log with 10s polling"
```

---

## Task 6: DM Scope Visualizer

**covers:** session-scope-visualizer > DM scope strategy selector > all scenarios; session-scope-visualizer > Session key parser > "Parse a DM session key"

**Files:**

- Create: `dashboard/src/components/panels/sessions/ScopeStrategyCard.tsx`
- Create: `dashboard/src/components/panels/sessions/ScopeSelector.tsx`
- Modify: `dashboard/src/components/panels/sessions/SessionsPanel.tsx`
- Modify: `dashboard/src/components/panels/sessions/SessionDetail.tsx`
- Modify: `dashboard/src/stores/sessions.ts`

- [ ] **Step 1: Create ScopeStrategyCard component**

`ScopeStrategyCard.tsx`:

- Props: `mode: string, title: string, description: string, selected: boolean, onClick: () => void`
- Card layout: title, 2-line description, CSS mini-diagram (boxes representing session isolation)
- Selected state: `ring-2 ring-[var(--accent)]` border
- Use CSS boxes/flexbox for diagrams (no SVG needed):
  - `main`: single box
  - `per-peer`: 3 boxes in a row
  - `per-channel-peer`: 2×3 grid
  - `per-account-channel-peer`: 3×3 grid with account labels

- [ ] **Step 2: Create ScopeSelector panel**

`ScopeSelector.tsx`:

- Renders 4 `ScopeStrategyCard` in a 2×2 grid (responsive: 1-column on mobile)
- Reads current `dmScope` from `useDeckRoutingStore()`
- On card click: show confirmation dialog ("Change DM scope to {mode}?")
- On confirm: call `config.patch` via API to update `session.dmScope`
- After successful update: refresh bindings store

- [ ] **Step 3: Add Scope tab to SessionsPanel**

Modify `SessionsPanel.tsx`:

- Add shadcn/ui `<Tabs>` wrapper with 2 tabs: "Sessions" (existing content) and "Scope"
- "Scope" tab renders `<ScopeSelector />`

- [ ] **Step 4: Integrate SessionKeyParser into SessionDetail**

Modify `SessionDetail.tsx`:

- Import `parseSessionKey` from `@/lib/session-key-parser`
- Below the session key display, render parsed segments as inline badges
- Each segment: `<span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-tertiary)]">Label: value</span>`

- [ ] **Step 5: Add i18n keys**

Add scope-related keys to `zh.json` / `en.json` under `sessions` namespace.

- [ ] **Step 6: Run type-check + lint + test**

```bash
pnpm tsgo && pnpm check && pnpm test
```

- [ ] **Step 7: Commit**

```bash
git add dashboard/
git commit -m "[enhanced] [impl] feat(deck): add DM scope visualizer + session key parser"
```

---

## Task 7: Context Health Bar + Transcript Search + Session Export

**covers:** session-context-health > Context health indicator > all scenarios; session-context-health > Transcript search > all scenarios; session-context-health > Session export > all scenarios

**Files:**

- Create: `dashboard/src/components/panels/sessions/ContextHealthBar.tsx`
- Create: `dashboard/src/components/panels/sessions/TranscriptSearch.tsx`
- Create: `dashboard/src/components/panels/sessions/SessionExport.tsx`
- Modify: `dashboard/src/components/panels/sessions/SessionDetail.tsx`

- [ ] **Step 1: Create ContextHealthBar**

`ContextHealthBar.tsx`:

- Props: `session: SessionEntry`
- Renders: token usage bar (colored green/yellow/red), compaction count badge, message count
- Reuses existing `pressureBarClass` / `contextPct` helpers from SessionDetail (extract to shared)
- When `contextWindow === 0`: show absolute tokens without bar
- Tooltip on high usage: "Context is near capacity; compaction may lose earlier messages"
- **Compaction count:** Task 0 adds `compactionCount` to `SessionEntry` (1-line backend fix). Display as badge with checkmark (0) or warning icon (≥1). Tooltip on high count: "Context is near capacity; compaction may lose earlier messages"
- **Message count:** derive from `history.length` when session is selected (available via `fetchHistory`)

- [ ] **Step 2: Create TranscriptSearch**

`TranscriptSearch.tsx`:

- Props: `messages: HistoryMessage[], onHighlight: (indices: number[]) => void, onNavigate: (index: number) => void`
- Search input with debounced filtering (300ms)
- Match count badge: "N matches"
- Prev/Next buttons to navigate between matches
- Calls `onHighlight` with matching message indices
- Calls `onNavigate` with current focused match index

- [ ] **Step 3: Create SessionExport**

`SessionExport.tsx`:

- Props: `session: SessionEntry, messages: HistoryMessage[]`
- Dropdown button with "Export JSON" and "Export Markdown" options
- Calls `downloadBlob` from `@/lib/session-export`
- **Disabled state:** when `messages.length === 0`, button is disabled with tooltip "No messages to export"

- [ ] **Step 4: Integrate into SessionDetail**

Modify `SessionDetail.tsx`:

- Add `<ContextHealthBar>` in the header area (below existing token stats)
- Add `<TranscriptSearch>` above the message history
- Add `<SessionExport>` button in the header area (next to delete button)
- Wire search highlighting: track `highlightedIndices` state, pass to `HistoryBubble` for styling

- [ ] **Step 5: Add i18n keys**

Add keys for health bar, search, export under `sessions` namespace.

- [ ] **Step 6: Run type-check + lint**

```bash
pnpm tsgo && pnpm check
```

- [ ] **Step 7: Commit**

```bash
git add dashboard/
git commit -m "[enhanced] [impl] feat(deck): add context health bar + transcript search + session export"
```

---

## Task 8: Channel Configuration Wizards

**covers:** channel-config-wizard > WeCom configuration wizard > all scenarios; channel-config-wizard > Feishu configuration wizard > all scenarios

**Files:**

- Create: `dashboard/src/components/panels/channels/ConfigWizard.tsx`
- Create: `dashboard/src/components/panels/channels/WeComWizard.tsx`
- Create: `dashboard/src/components/panels/channels/FeishuWizard.tsx`
- Modify: `dashboard/src/components/panels/channels/ChannelDetail.tsx`

- [ ] **Step 1: Create reusable ConfigWizard shell**

`ConfigWizard.tsx`:

- Props: `steps: WizardStep[], onComplete: () => void, onCancel: () => void`
- `WizardStep = { title: string, content: ReactNode, validate?: () => boolean | Promise<boolean> }`
- Progress bar at top showing step N of M
- Back/Next/Finish buttons with per-step validation
- Cancel button with confirmation
- Uses shadcn/ui Dialog as container

- [ ] **Step 2: Create WeComWizard**

`WeComWizard.tsx` — 4 steps:

1. Transport mode selection: 4 cards (webhook, websocket, customer-service, custom-app)
2. Enterprise info form: corpId, agentId, secret, token, encodingAESKey fields with help text
3. Callback URL display: generated URL + copy button
4. Connection test: test button + result display (success/error)

Read WeCom extension config structure from `extensions/wecom/` for field names.
Plugin check at step 1: verify wecom channel exists in `useChannelsStore().channelOrder`.

- [ ] **Step 3: Create FeishuWizard**

`FeishuWizard.tsx` — 3 steps:

1. Transport mode: WebSocket (recommended) vs Webhook cards
2. App credentials: appId, appSecret fields
3. Connection test

Plugin check at step 1: verify feishu in channel order.

- [ ] **Step 4: Add wizard launch buttons to ChannelDetail**

Modify `ChannelDetail.tsx`:

- For WeCom channels: add "Setup Wizard" button that opens `<WeComWizard />`
- For Feishu channels: add "Setup Wizard" button that opens `<FeishuWizard />`
- Detect channel type from `channelId` (starts with "wecom" or "feishu")

- [ ] **Step 5: Add i18n keys**

Add `wizard` namespace keys in `zh.json` / `en.json`.

- [ ] **Step 6: Run type-check + lint**

```bash
pnpm tsgo && pnpm check
```

- [ ] **Step 7: Commit**

```bash
git add dashboard/
git commit -m "[enhanced] [impl] feat(deck): add WeCom + Feishu configuration wizards"
```

---

## Task 9: Channel Multi-Account Management + Throughput Monitor

**covers:** channel-throughput-monitor > Message throughput display > all scenarios; channel-throughput-monitor > Throughput auto-refresh > all scenarios

**Files:**

- Create: `dashboard/src/components/panels/channels/ThroughputChart.tsx`
- Modify: `dashboard/src/components/panels/channels/ChannelDetail.tsx`
- Modify: `dashboard/src/stores/channels.ts`

- [ ] **Step 1: Enhance ChannelDetail account management**

Modify `ChannelDetail.tsx`:

- Add enable/disable toggle per account (already partially exists with `handleToggleEnabled`)
- Add "Add Account" button that launches the appropriate wizard
- Add "Remove Account" with confirmation dialog
- Add status badges: enabled/disabled + connected/disconnected (partially exists as `AccountStatusBadge`)

- [ ] **Step 2: Extend channels store with throughput**

Add to `channels.ts`:

```typescript
throughput: Map<string, ThroughputData>;
throughputWindow: "1h" | "6h" | "24h";
fetchThroughput: (channelId: string) => Promise<void>;
setThroughputWindow: (window: "1h" | "6h" | "24h") => void;
```

`ThroughputData = { messagesIn: number; messagesOut: number; buckets: Array<{ time: number; in: number; out: number }> }`.

Note: throughput data may need to be computed from activity events or a new lightweight API. If `channels.status` doesn't include throughput, use activity store events as source.

- [ ] **Step 3: Create ThroughputChart**

`ThroughputChart.tsx`:

- Mini bar chart using CSS (no chart library) — bars for messages in (accent) and out (secondary)
- Time window selector: 1h / 6h / 24h buttons
- Auto-refresh every 30s with `setInterval`
- Pause auto-refresh on hover (`onMouseEnter` / `onMouseLeave`)
- "Last updated: Xs ago" label
- Empty state: flat zero bars + "No messages in the last {window}"

- [ ] **Step 4: Integrate ThroughputChart into ChannelDetail**

Add `<ThroughputChart channelId={channelId} />` section below the account list.

- [ ] **Step 4.5: Add aggregate throughput to Channels panel header**

Modify `ChannelsPanel.tsx` header area:

- Show total messages in/out across all channels for the last 1h
- Read from `useChannelsStore().throughput` (aggregate across all channel entries)
- Format: "↓ {in} / ↑ {out} last 1h" with small text

- [ ] **Step 5: Add i18n keys**

Add throughput and account management keys to `zh.json` / `en.json`.

- [ ] **Step 6: Run type-check + lint**

```bash
pnpm tsgo && pnpm check
```

- [ ] **Step 7: Commit**

```bash
git add dashboard/
git commit -m "[enhanced] [impl] feat(deck): add multi-account management + throughput monitor for channels"
```

---

## Task 10: Verification & Final Validation

**covers:** all specs — final integration verification

**Files:**

- All files from Tasks 1-9

- [ ] **Step 1: Run full type-check**

```bash
pnpm tsgo
```

Expected: zero errors

- [ ] **Step 2: Run lint/format**

```bash
pnpm check
```

Expected: pass

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass (including new tests from Tasks 1-3)

- [ ] **Step 4: Verify i18n completeness**

Check that every `t()` call in new components has corresponding keys in both `zh.json` and `en.json`.

- [ ] **Step 5: Verify dark mode**

Confirm all new components use CSS variables (no hardcoded colors).

- [ ] **Step 6: Commit any final fixes**

```bash
git add dashboard/
git commit -m "[enhanced] [impl] fix(deck): final verification fixes for routing/session/channel enhancements"
```

---

## Requirements Coverage Matrix

| Spec                       | Requirement              | Scenario                     | Covered by Task                    |
| -------------------------- | ------------------------ | ---------------------------- | ---------------------------------- |
| routing-condition-editor   | Visual condition builder | Add channel condition        | Task 4                             |
| routing-condition-editor   | Visual condition builder | Add peer condition           | Task 4                             |
| routing-condition-editor   | Visual condition builder | Remove dimension             | Task 4                             |
| routing-condition-editor   | Visual condition builder | Multi-dimension              | Task 4                             |
| routing-condition-editor   | Drag-to-reorder          | Drag within tier             | Task 4                             |
| routing-condition-editor   | Drag-to-reorder          | Keyboard reorder             | Task 4                             |
| routing-condition-editor   | Drag-to-reorder          | Block cross-tier             | Task 4                             |
| routing-condition-editor   | Conflict detection       | Detect overlap               | Task 1, 4                          |
| routing-condition-editor   | Conflict detection       | Badge display                | Task 4                             |
| routing-hit-log            | Hit log display          | View recent                  | Task 5 (degraded to activity feed) |
| routing-hit-log            | Hit log display          | Empty state                  | Task 5                             |
| routing-hit-log            | Hit log display          | Auto-refresh                 | Task 5                             |
| routing-hit-log            | Hit log filtering        | Filter by agent              | Task 5                             |
| routing-hit-log            | Hit log filtering        | Combined filter              | Task 5 (channel filter deferred)   |
| session-scope-visualizer   | DM scope selector        | View strategies              | Task 6                             |
| session-scope-visualizer   | DM scope selector        | Understand diagram           | Task 6                             |
| session-scope-visualizer   | DM scope selector        | Select strategy              | Task 6                             |
| session-scope-visualizer   | Session key parser       | Parse DM key                 | Task 2, 6                          |
| session-scope-visualizer   | Session key parser       | Parse channel-peer key       | Task 2                             |
| session-scope-visualizer   | Session key parser       | Parse channel:peer (no type) | Task 2                             |
| session-context-health     | Context health           | Healthy session              | Task 7                             |
| session-context-health     | Context health           | Stressed session             | Task 7                             |
| session-context-health     | Context health           | No context window            | Task 7                             |
| session-context-health     | Transcript search        | Search keyword               | Task 7                             |
| session-context-health     | Transcript search        | No results                   | Task 7                             |
| session-context-health     | Session export           | JSON export                  | Task 3, 7                          |
| session-context-health     | Session export           | Markdown export              | Task 3, 7                          |
| session-context-health     | Session export           | Empty session disabled       | Task 7                             |
| session-context-health     | Transcript search        | Clear search                 | Task 7                             |
| channel-config-wizard      | WeCom wizard             | Transport mode               | Task 8                             |
| channel-config-wizard      | WeCom wizard             | Enterprise info              | Task 8                             |
| channel-config-wizard      | WeCom wizard             | Callback URL                 | Task 8                             |
| channel-config-wizard      | WeCom wizard             | Test success                 | Task 8                             |
| channel-config-wizard      | WeCom wizard             | Test failure                 | Task 8                             |
| channel-config-wizard      | Feishu wizard            | Transport mode               | Task 8                             |
| channel-config-wizard      | Feishu wizard            | Credentials                  | Task 8                             |
| channel-config-wizard      | Feishu wizard            | Test                         | Task 8                             |
| channel-throughput-monitor | Throughput display       | View channel                 | Task 9                             |
| channel-throughput-monitor | Throughput display       | Switch window                | Task 9                             |
| channel-throughput-monitor | Throughput display       | No traffic                   | Task 9                             |
| channel-throughput-monitor | Auto-refresh             | 30s refresh                  | Task 9                             |
| channel-throughput-monitor | Auto-refresh             | Pause on hover               | Task 9                             |
| channel-throughput-monitor | Aggregate overview       | View aggregate stats         | Task 9                             |
