# Chat Whitebox Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Chat panel's tool-call / tool-result rendering from raw JSON dumps into structured, type-aware views with run-level metadata and subagent lifecycle cards.

**Architecture:** Lazy parsing inside ToolResultCard (D1 — no store pre-processing). Bash/diff/read detection via tool-name matching + content heuristic (D2). Lightweight self-built diff renderer using `diff` npm package (D3). Virtual scroll via `@tanstack/react-virtual` for long results (D4). Run metadata sourced from lifecycle SSE events (duration from start/end timestamps; model/usage gracefully degraded if not present in current SSE payloads, with extension point for future gateway enhancement) (D5). Subagent cards from agent event stream with extension point for dedicated subagent events (D6).

**Tech Stack:** React 18, Zustand, next-intl, `diff` (new), `@tanstack/react-virtual` (new), lucide-react, CSS variables (no hardcoded colors).

**Skill 依赖：**

| 域         | Skills                                               | 加载方式                      |
| ---------- | ---------------------------------------------------- | ----------------------------- |
| [frontend] | frontend-design, superpowers:test-driven-development | session 首次加载 / Skill 摘要 |

**Dashboard 开发规范提醒（来自 `dashboard/CLAUDE.md`）：**

- 所有用户可见文字用 `useTranslations()` — 零硬编码字符串
- 颜色用 CSS 变量 `var(--*)` — 零硬编码色值
- 禁止 `<button>` 嵌套交互元素
- `zh.json` + `en.json` 同步更新

**SSE 数据源现状（关键约束 — 已降级）：**

- `lifecycle` 事件仅含 `startedAt`/`endedAt`/`phase`，无 model/usage/duration
- `tool` 事件含 phase/name/toolCallId/args
- 完整 run metadata（model, usage, durationMs）仅在 `EmbeddedPiRunMeta` 中，不通过 SSE 广播
- `chat.history` RPC 也不返回 model/usage（仅 messages/thinkingLevel/verboseLevel）
- **降级决策**：RunStatusBar 只展示 `duration`（lifecycle start/end 计算）+ `model`（仅 fallback 事件时可见）。Token usage 显示 "—"。"Full metadata" spec 场景标记为 "partially covered — 待 gateway 增强后完整支持"
- **Subagent 降级决策**：deck-subagents store 无 parentRunId/parentMessageId，无法做 per-message 内联。改为 session 级展示：在消息流底部统一显示当前 session 的 subagent 状态

---

## File Structure

### New files

| File                                                                  | Responsibility                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `dashboard/src/components/panels/chat/blocks/ToolParamView.tsx`       | Structured key-value renderer for tool_use parameters                                            |
| `dashboard/src/components/panels/chat/blocks/BashResultView.tsx`      | Bash command split-view (command + stdout + stderr + exit code)                                  |
| `dashboard/src/components/panels/chat/blocks/DiffPreview.tsx`         | Lightweight unified diff renderer (line-level add/remove/context)                                |
| `dashboard/src/components/panels/chat/blocks/HighlightedCodeView.tsx` | Line-numbered code view for `read` results with file extension hint                              |
| `dashboard/src/components/panels/chat/blocks/VirtualScrollResult.tsx` | Virtual-scrolled container for long (>200 lines) text results                                    |
| `dashboard/src/components/panels/chat/blocks/ShowRawToggle.tsx`       | "Show Raw / Show Formatted" toggle button (shared by all enhanced result views)                  |
| `dashboard/src/components/panels/chat/RunStatusBar.tsx`               | Compact run metadata bar (model + tokens + duration)                                             |
| `dashboard/src/components/panels/chat/SubagentCard.tsx`               | Inline subagent lifecycle card (spawn → complete/fail)                                           |
| `dashboard/src/lib/tool-result-parser.ts`                             | Pure functions: bash detection, diff detection, file-extension extraction, content line counting |
| `dashboard/src/lib/tool-result-parser.test.ts`                        | Unit tests for all detection/parsing functions                                                   |
| `dashboard/src/lib/format-utils.ts`                                   | Pure functions: `formatTokenCount`, `formatDuration`, `formatParamSummary`                       |
| `dashboard/src/lib/format-utils.test.ts`                              | Unit tests for formatting functions                                                              |

### Modified files

| File                                                             | Changes                                                                                                                                   |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `dashboard/src/stores/chat-types.ts`                             | Add `RunMetadata`, `SubagentRun` types; extend `SessionState`                                                                             |
| `dashboard/src/stores/chat.ts`                                   | Add store actions: `setRunMetadata`, `updateSubagentRun`; extend `removeSession`                                                          |
| `dashboard/src/components/panels/chat/useChatSSE.ts`             | Extend `dispatchAgentEvent` to handle `lifecycle` stream; extract run duration                                                            |
| `dashboard/src/components/panels/chat/blocks/ToolUseCard.tsx`    | Full rewrite: structured params, collapse, copy JSON                                                                                      |
| `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx` | Add detection routing: bash → BashResultView, diff → DiffPreview, read → HighlightedCodeView, long → VirtualScrollResult, + ShowRawToggle |
| `dashboard/src/components/panels/chat/MessageList.tsx`           | Pass `streaming` prop to ToolUseCard; integrate RunStatusBar + SubagentCard into MessageBubble; pass `toolUseInput` to ToolResultCard     |
| `dashboard/src/i18n/zh.json`                                     | Add ~25 new chat namespace keys                                                                                                           |
| `dashboard/src/i18n/en.json`                                     | Add ~25 new chat namespace keys                                                                                                           |
| `dashboard/package.json`                                         | Add `diff` dependency                                                                                                                     |

---

### Task 1: Types, Store & Formatting Utilities

**covers:**

- `subagent-inline-cards/spec.md` > Subagent store tracking > "Store initialization on spawn"
- `subagent-inline-cards/spec.md` > Subagent store tracking > "Store update on completion"
- `subagent-inline-cards/spec.md` > Subagent store tracking > "Session cleanup"
- `run-status-indicator/spec.md` > Token usage formatting > all scenarios
- `run-status-indicator/spec.md` > Duration formatting > all scenarios

**Files:**

- Modify: `dashboard/src/stores/chat-types.ts`
- Modify: `dashboard/src/stores/chat.ts`
- Create: `dashboard/src/lib/format-utils.ts`
- Create: `dashboard/src/lib/format-utils.test.ts`

- [ ] **Step 1: Write format-utils tests**

Create `dashboard/src/lib/format-utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatTokenCount, formatDuration, formatParamSummary } from "./format-utils";

describe("formatTokenCount", () => {
  it("returns exact number for < 1000", () => {
    expect(formatTokenCount(847)).toBe("847");
  });
  it("returns k suffix for >= 1000", () => {
    expect(formatTokenCount(1200)).toBe("1.2k");
    expect(formatTokenCount(15000)).toBe("15.0k");
  });
  it("returns '0' for zero", () => {
    expect(formatTokenCount(0)).toBe("0");
  });
  it("returns '—' for undefined", () => {
    expect(formatTokenCount(undefined)).toBe("—");
  });
});

describe("formatDuration", () => {
  it("returns seconds with one decimal for < 60s", () => {
    expect(formatDuration(12300)).toBe("12.3s");
  });
  it("returns minutes + seconds for >= 60s", () => {
    expect(formatDuration(135000)).toBe("2m 15s");
  });
  it("returns '—' for undefined", () => {
    expect(formatDuration(undefined)).toBe("—");
  });
});

describe("formatParamSummary", () => {
  it("joins up to 3 key names", () => {
    expect(formatParamSummary({ a: 1, b: 2 })).toBe("a, b");
  });
  it("adds ... for > 3 keys", () => {
    expect(formatParamSummary({ a: 1, b: 2, c: 3, d: 4 })).toBe("a, b, c, ...");
  });
  it("returns empty string for empty input", () => {
    expect(formatParamSummary({})).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && pnpm test -- src/lib/format-utils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement format-utils**

Create `dashboard/src/lib/format-utils.ts`:

```typescript
/**
 * Format a token count for compact display.
 * <1000 → exact number. >=1000 → "N.Nk". undefined → "—".
 */
export function formatTokenCount(count: number | undefined): string {
  if (count === undefined) return "—";
  if (count === 0) return "0";
  if (count < 1000) return String(count);
  return `${(count / 1000).toFixed(1)}k`;
}

/**
 * Format a duration in milliseconds for compact display.
 * <60s → "N.Ns". >=60s → "Nm Ns". undefined → "—".
 */
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return "—";
  const totalSeconds = ms / 1000;
  if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

/**
 * Generate a collapsed parameter summary: up to 3 key names, "..." if more.
 */
export function formatParamSummary(input: Record<string, unknown>): string {
  const keys = Object.keys(input);
  if (keys.length === 0) return "";
  if (keys.length <= 3) return keys.join(", ");
  return `${keys.slice(0, 3).join(", ")}, ...`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && pnpm test -- src/lib/format-utils.test.ts`
Expected: PASS — all 8 tests

- [ ] **Step 5: Add RunMetadata and SubagentRun types to chat-types.ts**

Add before `SessionState` in `dashboard/src/stores/chat-types.ts`:

```typescript
// ---------------------------------------------------------------------------
// Run-level metadata (model + usage + duration for one assistant turn)
// ---------------------------------------------------------------------------

export interface RunMetadata {
  /** Run ID — matches the streamingRunId / message.id */
  runId: string;
  model?: string;
  usage?: {
    input?: number;
    output?: number;
    cache?: number;
  };
  /** Duration in milliseconds */
  durationMs?: number;
  /** Lifecycle start timestamp (ms) */
  startedAt?: number;
  /** Whether the run is still in progress */
  streaming?: boolean;
}

// ---------------------------------------------------------------------------
// Subagent run tracking
// ---------------------------------------------------------------------------

export interface SubagentRun {
  id: string;
  taskDescription?: string;
  status: "running" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  /** Duration in milliseconds */
  duration?: number;
  /** Links this subagent to the parent run's message */
  parentRunId: string;
  result?: string;
  error?: string;
}
```

Extend `SessionState` — add two new fields after `activeApproval`:

```typescript
export interface SessionState {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingRunId: string | null;
  error: string | null;
  toolProgress: Record<string, ToolProgress>;
  activeApproval: ApprovalRequest | null;
  /** Run-level metadata keyed by run ID (message ID) */
  runMetadata: Record<string, RunMetadata>;
  /** Subagent runs keyed by subagent ID */
  subagentRuns: Record<string, SubagentRun>;
  a2uiState: A2UIState | null;
  status: "active" | "idle";
  lastAccessedAt: number;
}
```

Update `createEmptySessionState()` to include the new fields:

```typescript
export function createEmptySessionState(): SessionState {
  return {
    messages: [],
    isStreaming: false,
    streamingRunId: null,
    error: null,
    toolProgress: {},
    activeApproval: null,
    runMetadata: {},
    subagentRuns: {},
    a2uiState: null,
    status: "idle",
    lastAccessedAt: Date.now(),
  };
}
```

- [ ] **Step 6: Add store actions in chat.ts**

Add to the `ChatStore` interface (after `updateToolProgress`):

```typescript
  setRunMetadata: (sessionKey: string, runId: string, meta: Partial<RunMetadata>) => void;
  updateSubagentRun: (sessionKey: string, subagentId: string, update: Partial<SubagentRun>) => void;
```

Add re-exports:

```typescript
export { type RunMetadata, type SubagentRun } from "./chat-types";
```

Implement in the store body:

```typescript
  setRunMetadata(sessionKey: string, runId: string, meta: Partial<RunMetadata>) {
    const { sessions } = get();
    set({
      sessions: updateSession(sessions, sessionKey, (s) => ({
        ...s,
        runMetadata: {
          ...s.runMetadata,
          [runId]: { ...s.runMetadata[runId], runId, ...meta },
        },
      })),
    });
  },

  updateSubagentRun(sessionKey: string, subagentId: string, update: Partial<SubagentRun>) {
    const { sessions } = get();
    set({
      sessions: updateSession(sessions, sessionKey, (s) => ({
        ...s,
        subagentRuns: {
          ...s.subagentRuns,
          [subagentId]: { ...s.subagentRuns[subagentId], ...update } as SubagentRun,
        },
      })),
    });
  },
```

Update `removeSession` to also clear runMetadata and subagentRuns (this happens automatically since the whole session state is removed — verify it's a `Map.delete(key)` call, which it is).

- [ ] **Step 7: Run type check**

Run: `pnpm tsgo` (from repo root)
Expected: 0 new errors (pre-existing errors in AgentDetail.tsx/panel-navigation.ts are acceptable)

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/stores/chat-types.ts dashboard/src/stores/chat.ts \
       dashboard/src/lib/format-utils.ts dashboard/src/lib/format-utils.test.ts
git commit -m "[enhanced] [impl] feat(deck): add RunMetadata/SubagentRun types, store actions, format utilities"
```

---

### Task 2: SSE Event Enhancement

**covers:**

- `run-status-indicator/spec.md` > Run metadata bar > "Streaming run (in progress)" (startedAt tracking)
- `run-status-indicator/spec.md` > Run metadata bar > "Complete run with full metadata" (duration computation)

**Files:**

- Modify: `dashboard/src/components/panels/chat/useChatSSE.ts`

- [ ] **Step 1: Extend AgentEventPayload type**

In `dashboard/src/components/panels/chat/useChatSSE.ts`, add `runId` to the existing type without breaking the existing `data` field:

```typescript
export type AgentEventPayload = {
  sessionKey: string;
  /** Run ID — present on all agent events from Gateway */
  runId?: string;
  stream?: string;
  data?: {
    phase?: string;
    name?: string;
    toolCallId?: string;
    args?: Record<string, unknown>;
    // Lifecycle-specific fields (accessed via type assertion)
    [key: string]: unknown;
  };
};
```

This preserves type safety for `data.name`, `data.toolCallId`, `data.args` while allowing lifecycle-specific fields.

- [ ] **Step 2: Extend dispatchAgentEvent to handle lifecycle stream**

Add lifecycle handling BEFORE the existing `stream !== "tool"` early return. Use `payload.runId` (not `sess.streamingRunId`) to associate metadata:

```typescript
export function dispatchAgentEvent(payload: AgentEventPayload): void {
  const sessionKey = payload.sessionKey;
  if (!sessionKey) return;

  try {
    const stream = payload.stream;
    const data = payload.data;

    // Handle lifecycle events (run start/end/fallback)
    if (stream === "lifecycle" && data) {
      const runId = payload.runId;
      if (!runId) return;

      const phase = data.phase;
      useChatStore.getState().ensureSession(sessionKey);

      if (phase === "start") {
        const startedAt = (data.startedAt as number | undefined) ?? Date.now();
        useChatStore.getState().setRunMetadata(sessionKey, runId, {
          startedAt,
          streaming: true,
        });
      } else if (phase === "end") {
        const endedAt = (data.endedAt as number | undefined) ?? Date.now();
        const existing = useChatStore.getState().sessions.get(sessionKey)?.runMetadata[runId];
        const durationMs = existing?.startedAt ? endedAt - existing.startedAt : undefined;
        useChatStore.getState().setRunMetadata(sessionKey, runId, {
          durationMs,
          streaming: false,
        });
      } else if (phase === "error") {
        // Error run — compute duration and clear streaming flag
        const endedAt = (data.endedAt as number | undefined) ?? Date.now();
        const existing = useChatStore.getState().sessions.get(sessionKey)?.runMetadata[runId];
        const durationMs = existing?.startedAt ? endedAt - existing.startedAt : undefined;
        useChatStore.getState().setRunMetadata(sessionKey, runId, {
          durationMs,
          streaming: false,
        });
      } else if (phase === "fallback") {
        const activeModel = data.activeModel as string | undefined;
        if (activeModel) {
          useChatStore.getState().setRunMetadata(sessionKey, runId, { model: activeModel });
        }
      }
      return;
    }

    // Existing tool stream handling (unchanged from current code)
    if (stream !== "tool" || !data) return;
    // ... rest unchanged ...
```

- [ ] **Step 3: Run type check**

Run: `pnpm tsgo` (from repo root)
Expected: 0 new errors

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/panels/chat/useChatSSE.ts
git commit -m "[enhanced] [impl] feat(deck): extend SSE dispatcher with lifecycle events and payload runId"
```

---

> **Task 2.5 已移除**：R2 Codex 审查确认 `chat.history` RPC 不返回 model/usage/durationMs（仅 messages/thinkingLevel/verboseLevel），Task 2.5 的 history 提取方案不可行。RunStatusBar 降级为 duration-only + fallback model。"Complete run with full metadata" spec 场景标记 partially covered，待 gateway lifecycle 事件增强后完整支持。

---

### Task 3: ToolUseCard Enhancement

**covers:**

- `tool-param-formatter/spec.md` > Structured parameter display > "Simple key-value parameters"
- `tool-param-formatter/spec.md` > Structured parameter display > "Nested object parameter"
- `tool-param-formatter/spec.md` > Structured parameter display > "Large string parameter"
- `tool-param-formatter/spec.md` > Structured parameter display > "Empty input"
- `tool-param-formatter/spec.md` > Collapsible tool use sections > "Default collapsed state"
- `tool-param-formatter/spec.md` > Collapsible tool use sections > "Streaming message tool use"
- `tool-param-formatter/spec.md` > Collapsible tool use sections > "Parameter summary generation"
- `tool-param-formatter/spec.md` > Copy raw JSON action > "Copy action"

**Files:**

- Rewrite: `dashboard/src/components/panels/chat/blocks/ToolUseCard.tsx`
- Create: `dashboard/src/components/panels/chat/blocks/ToolParamView.tsx`
- Modify: `dashboard/src/components/panels/chat/MessageList.tsx` (pass `streaming` prop)
- Modify: `dashboard/src/i18n/zh.json`, `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add i18n keys for ToolUseCard**

Add to the `"chat"` namespace in both `zh.json` and `en.json`:

zh.json:

```json
"paramNoParams": "（无参数）",
"paramShowFull": "展开全文",
"paramShowLess": "收起",
"paramKeys": "{count} 个字段",
"copyJson": "复制 JSON",
"copied": "已复制"
```

en.json:

```json
"paramNoParams": "(no parameters)",
"paramShowFull": "Show full",
"paramShowLess": "Show less",
"paramKeys": "{count} keys",
"copyJson": "Copy JSON",
"copied": "Copied"
```

- [ ] **Step 2: Create ToolParamView component**

Create `dashboard/src/components/panels/chat/blocks/ToolParamView.tsx`:

```tsx
"use client";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

const MAX_STRING_LENGTH = 500;

interface ToolParamViewProps {
  input: Record<string, unknown>;
}

export function ToolParamView({ input }: ToolParamViewProps) {
  const t = useTranslations("chat");
  const keys = Object.keys(input);

  if (keys.length === 0) {
    return <span className="text-[var(--text-tertiary)] italic">{t("paramNoParams")}</span>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {keys.map((key) => (
        <ParamRow key={key} label={key} value={input[key]} />
      ))}
    </div>
  );
}

function ParamRow({ label, value }: { label: string; value: unknown }) {
  const t = useTranslations("chat");

  if (typeof value === "object" && value !== null) {
    return <CollapsibleParam label={label} value={value} />;
  }

  const strValue = String(value);
  const isTruncated = typeof value === "string" && strValue.length > MAX_STRING_LENGTH;

  return (
    <div className="flex gap-2 py-0.5 items-start">
      <span className="shrink-0 font-medium text-[var(--text-secondary)]">{label}</span>
      <span className="text-[var(--accent)] opacity-50">→</span>
      <TruncatableValue value={strValue} truncated={isTruncated} />
    </div>
  );
}

function TruncatableValue({ value, truncated }: { value: string; truncated: boolean }) {
  const t = useTranslations("chat");
  const [expanded, setExpanded] = useState(false);

  if (!truncated) {
    return <code className="font-mono text-[var(--text-primary)] break-all">{value}</code>;
  }

  return (
    <span>
      <code className="font-mono text-[var(--text-primary)] break-all">
        {expanded ? value : `${value.slice(0, MAX_STRING_LENGTH)}…`}
      </code>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="ml-1 text-[var(--accent)] hover:underline"
      >
        {expanded ? t("paramShowLess") : t("paramShowFull")}
      </button>
    </span>
  );
}

function CollapsibleParam({ label, value }: { label: string; value: unknown }) {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(false);
  const keyCount = typeof value === "object" && value !== null ? Object.keys(value).length : 0;

  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ChevronRight
          size={12}
          className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="font-medium">{label}</span>
        {!open && (
          <span className="text-[var(--text-tertiary)]">{t("paramKeys", { count: keyCount })}</span>
        )}
      </button>
      {open && (
        <pre className="ml-4 mt-1 p-2 rounded-lg text-xs overflow-auto bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite ToolUseCard**

Rewrite `dashboard/src/components/panels/chat/blocks/ToolUseCard.tsx`:

```tsx
"use client";
import { Copy, Check, Wrench } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { formatParamSummary } from "@/lib/format-utils";
import { ToolParamView } from "./ToolParamView";

interface ToolUseCardProps {
  name: string;
  input: Record<string, unknown>;
  /** When true, card is expanded by default (streaming message). */
  defaultOpen?: boolean;
}

export function ToolUseCard({ name, input, defaultOpen = false }: ToolUseCardProps) {
  const t = useTranslations("chat");
  const [copied, setCopied] = useState(false);
  const summary = formatParamSummary(input);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(JSON.stringify(input, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [input]);

  return (
    <details
      className="my-1.5 text-xs rounded-lg border border-[var(--border-subtle)] overflow-hidden"
      open={defaultOpen}
    >
      <summary className="flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer select-none text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
        <Wrench size={12} className="shrink-0" />
        <span className="font-medium">{t("toolCall")}:</span>
        <code className="font-mono text-[var(--accent)]">{name}</code>
        {summary && <span className="text-[var(--text-tertiary)] truncate ml-1">— {summary}</span>}
      </summary>
      <div className="px-2.5 pb-2.5 border-t border-[var(--border-subtle)]">
        <div className="flex justify-end mt-1.5 mb-1">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            <span>{copied ? t("copied") : t("copyJson")}</span>
          </button>
        </div>
        <ToolParamView input={input} />
      </div>
    </details>
  );
}
```

- [ ] **Step 4: Pass streaming prop from MessageBubble to ToolUseCard**

In `dashboard/src/components/panels/chat/MessageList.tsx`, update the ToolUseCard rendering (around line 155):

```tsx
{
  toolUseBlocks.map((b, i) => (
    <ToolUseCard key={`tool-${i}`} name={b.name} input={b.input} defaultOpen={message.streaming} />
  ));
}
```

- [ ] **Step 5: Run type check**

Run: `pnpm tsgo` (from repo root)
Expected: 0 new errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/panels/chat/blocks/ToolUseCard.tsx \
       dashboard/src/components/panels/chat/blocks/ToolParamView.tsx \
       dashboard/src/components/panels/chat/MessageList.tsx \
       dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] [impl] feat(deck): structured ToolUseCard with key-value params, collapse, copy JSON"
```

---

### Task 4: Tool Result Parser & Bash Split View

**covers:**

- `tool-result-views/spec.md` > Bash result split view > "Successful bash command"
- `tool-result-views/spec.md` > Bash result split view > "Failed bash command with stderr"
- `tool-result-views/spec.md` > Bash result split view > "Unrecognizable bash output"

**Files:**

- Create: `dashboard/src/lib/tool-result-parser.ts`
- Create: `dashboard/src/lib/tool-result-parser.test.ts`
- Create: `dashboard/src/components/panels/chat/blocks/BashResultView.tsx`
- Modify: `dashboard/src/i18n/zh.json`, `dashboard/src/i18n/en.json`

- [ ] **Step 1: Write tool-result-parser tests**

Create `dashboard/src/lib/tool-result-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  isBashTool,
  isFileOpTool,
  parseBashResult,
  getFileExtension,
  countLines,
} from "./tool-result-parser";

describe("isBashTool", () => {
  it("matches known bash tool names", () => {
    expect(isBashTool("bash")).toBe(true);
    expect(isBashTool("execute")).toBe(true);
    expect(isBashTool("terminal")).toBe(true);
    expect(isBashTool("Bash")).toBe(true);
  });
  it("rejects non-bash tools", () => {
    expect(isBashTool("write")).toBe(false);
    expect(isBashTool("read")).toBe(false);
    expect(isBashTool(undefined)).toBe(false);
  });
});

describe("isFileOpTool", () => {
  it("detects write/edit/read tools", () => {
    expect(isFileOpTool("write")).toBe("write");
    expect(isFileOpTool("edit")).toBe("edit");
    expect(isFileOpTool("read")).toBe("read");
    expect(isFileOpTool("Write")).toBe("write");
  });
  it("returns null for non-file-op tools", () => {
    expect(isFileOpTool("bash")).toBeNull();
    expect(isFileOpTool(undefined)).toBeNull();
  });
});

describe("parseBashResult", () => {
  it("extracts command, stdout, and exit code 0", () => {
    const content = "$ ls -la\nfile1.txt\nfile2.txt\n\nexit code: 0";
    const result = parseBashResult(content);
    expect(result).not.toBeNull();
    expect(result!.command).toBe("ls -la");
    expect(result!.stdout).toContain("file1.txt");
    expect(result!.exitCode).toBe(0);
    expect(result!.stderr).toBe("");
  });
  it("extracts stderr and non-zero exit code", () => {
    const content =
      "$ cat missing.txt\ncat: missing.txt: No such file or directory\n\nstderr:\ncat: missing.txt: No such file or directory\n\nexit code: 1";
    const result = parseBashResult(content);
    expect(result).not.toBeNull();
    expect(result!.exitCode).toBe(1);
    expect(result!.stderr).toContain("No such file or directory");
  });
  it("returns null for unrecognizable content", () => {
    const content = "some random text without any structure";
    expect(parseBashResult(content)).toBeNull();
  });
});

describe("getFileExtension", () => {
  it("extracts extension from file path", () => {
    expect(getFileExtension("/src/main.ts")).toBe("ts");
    expect(getFileExtension("file.py")).toBe("py");
  });
  it("returns empty for no extension", () => {
    expect(getFileExtension("Makefile")).toBe("");
    expect(getFileExtension(undefined)).toBe("");
  });
});

describe("countLines", () => {
  it("counts newlines correctly", () => {
    expect(countLines("a\nb\nc")).toBe(3);
    expect(countLines("single")).toBe(1);
    expect(countLines("")).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && pnpm test -- src/lib/tool-result-parser.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement tool-result-parser**

Create `dashboard/src/lib/tool-result-parser.ts`:

```typescript
/**
 * Pure detection and parsing functions for tool result views.
 * No React — pure logic only.
 */

const BASH_TOOL_NAMES = new Set(["bash", "execute", "terminal"]);
const FILE_OP_MAP: Record<string, "write" | "edit" | "read"> = {
  write: "write",
  edit: "edit",
  read: "read",
  write_file: "write",
  read_file: "read",
};

export function isBashTool(toolName: string | undefined): boolean {
  if (!toolName) return false;
  return BASH_TOOL_NAMES.has(toolName.toLowerCase());
}

export function isFileOpTool(toolName: string | undefined): "write" | "edit" | "read" | null {
  if (!toolName) return null;
  return FILE_OP_MAP[toolName.toLowerCase()] ?? null;
}

export interface BashParsedResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Parse bash/terminal output into structured sections.
 *
 * Expected patterns:
 *   - `$ <command>` at start
 *   - `exit code: N` or trailing `$?=N` at end
 *   - Optional `stderr:` section
 *
 * Returns null if the content doesn't match recognizable bash patterns.
 */
export function parseBashResult(content: string): BashParsedResult | null {
  // Try to find exit code
  const exitCodeMatch =
    content.match(/exit code:\s*(\d+)\s*$/m) ?? content.match(/\$\?=(\d+)\s*$/m);
  if (!exitCodeMatch) return null;

  const exitCode = parseInt(exitCodeMatch[1], 10);

  // Try to find command (line starting with $ )
  const commandMatch = content.match(/^\$\s+(.+)$/m);
  const command = commandMatch ? commandMatch[1].trim() : "";

  // Split stderr if present
  const stderrIdx = content.indexOf("\nstderr:");
  let stdout: string;
  let stderr: string;

  if (stderrIdx !== -1) {
    stdout = content
      .slice(commandMatch ? commandMatch.index! + commandMatch[0].length + 1 : 0, stderrIdx)
      .trim();
    const exitIdx = content.lastIndexOf(exitCodeMatch[0]);
    stderr = content.slice(stderrIdx + "\nstderr:".length, exitIdx).trim();
  } else {
    const start = commandMatch ? commandMatch.index! + commandMatch[0].length + 1 : 0;
    const exitIdx = content.lastIndexOf(exitCodeMatch[0]);
    stdout = content.slice(start, exitIdx).trim();
    stderr = "";
  }

  return { command, stdout, stderr, exitCode };
}

/**
 * Extract file extension from a path.
 */
export function getFileExtension(filePath: string | undefined): string {
  if (!filePath) return "";
  const lastDot = filePath.lastIndexOf(".");
  const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  if (lastDot <= lastSlash) return "";
  return filePath.slice(lastDot + 1);
}

/**
 * Count lines in text content.
 */
export function countLines(content: string): number {
  if (!content) return 0;
  return content.split("\n").length;
}

/**
 * Check if content is likely binary (contains null bytes).
 */
export function isBinaryContent(content: string): boolean {
  return content.includes("\0");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && pnpm test -- src/lib/tool-result-parser.test.ts`
Expected: PASS — all tests

- [ ] **Step 5: Add i18n keys for bash result view**

Add to `"chat"` namespace in both locale files:

zh.json:

```json
"bashCommand": "命令",
"bashStdout": "标准输出",
"bashStderr": "标准错误",
"bashExitCode": "退出码",
"showRaw": "查看原始数据",
"showFormatted": "查看格式化",
"binaryFile": "[二进制文件 — 无法显示差异]"
```

en.json:

```json
"bashCommand": "Command",
"bashStdout": "stdout",
"bashStderr": "stderr",
"bashExitCode": "Exit code",
"showRaw": "Show Raw",
"showFormatted": "Show Formatted",
"binaryFile": "[Binary file — diff not available]"
```

- [ ] **Step 6: Create BashResultView component**

Create `dashboard/src/components/panels/chat/blocks/BashResultView.tsx`:

```tsx
"use client";
import { Terminal } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BashParsedResult } from "@/lib/tool-result-parser";

interface BashResultViewProps {
  result: BashParsedResult;
}

export function BashResultView({ result }: BashResultViewProps) {
  const t = useTranslations("chat");
  const isSuccess = result.exitCode === 0;

  return (
    <div className="flex flex-col gap-1.5">
      {/* Command header */}
      {result.command && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
          <Terminal size={12} className="shrink-0" />
          <code className="font-mono text-xs text-[var(--text-primary)]">$ {result.command}</code>
        </div>
      )}

      {/* stdout */}
      {result.stdout && (
        <pre className="px-2.5 py-2 text-xs whitespace-pre-wrap overflow-auto bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-lg max-h-[400px]">
          {result.stdout}
        </pre>
      )}

      {/* stderr */}
      {result.stderr && (
        <div>
          <span className="text-[10px] font-medium text-[var(--danger)] px-1">
            {t("bashStderr")}
          </span>
          <pre className="px-2.5 py-2 text-xs whitespace-pre-wrap overflow-auto rounded-lg max-h-[200px] bg-[var(--danger-muted)] text-[var(--danger-muted-text)]">
            {result.stderr}
          </pre>
        </div>
      )}

      {/* Exit code badge */}
      <div className="flex justify-end">
        <span
          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
            isSuccess
              ? "bg-[var(--success-muted)] text-[var(--success)]"
              : "bg-[var(--danger-muted)] text-[var(--danger)]"
          }`}
        >
          {t("bashExitCode")}: {result.exitCode}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run type check**

Run: `pnpm tsgo` (from repo root)
Expected: 0 new errors

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/lib/tool-result-parser.ts dashboard/src/lib/tool-result-parser.test.ts \
       dashboard/src/components/panels/chat/blocks/BashResultView.tsx \
       dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] [impl] feat(deck): add bash result parser and BashResultView split-view component"
```

---

### Task 5: Diff Preview & Highlighted Code View

**covers:**

- `tool-result-views/spec.md` > File operation diff preview > "Write tool with diff content"
- `tool-result-views/spec.md` > File operation diff preview > "Read tool result"
- `tool-result-views/spec.md` > File operation diff preview > "Diff for unsupported file type"

**Files:**

- Create: `dashboard/src/components/panels/chat/blocks/DiffPreview.tsx`
- Create: `dashboard/src/components/panels/chat/blocks/HighlightedCodeView.tsx`
- Modify: `dashboard/package.json` (add `diff` dependency)

- [ ] **Step 1: Install diff package**

Run: `cd dashboard && pnpm add diff`

- [ ] **Step 2: Create DiffPreview component**

Create `dashboard/src/components/panels/chat/blocks/DiffPreview.tsx`:

```tsx
"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { diffLines } from "diff";
import { isBinaryContent } from "@/lib/tool-result-parser";

interface DiffPreviewProps {
  content: string;
}

/**
 * Lightweight unified diff view.
 *
 * If the content already contains unified diff markers (---/+++ or @@),
 * render it directly as pre-parsed diff. Otherwise, if it looks like it
 * has before/after sections, compute the diff ourselves.
 *
 * Falls back to raw rendering if no diff structure is detected.
 */
export function DiffPreview({ content }: DiffPreviewProps) {
  const t = useTranslations("chat");

  if (isBinaryContent(content)) {
    return (
      <div className="px-2.5 py-4 text-xs text-center text-[var(--text-tertiary)] italic">
        {t("binaryFile")}
      </div>
    );
  }

  const lines = useMemo(() => parseDiffContent(content), [content]);

  return (
    <div className="text-xs font-mono overflow-auto max-h-[400px] rounded-lg border border-[var(--border-subtle)]">
      {lines.map((line, i) => (
        <div
          key={i}
          className={`flex px-2 py-px ${
            line.type === "add"
              ? "bg-[var(--success-muted)] text-[var(--success)]"
              : line.type === "remove"
                ? "bg-[var(--danger-muted)] text-[var(--danger)]"
                : "text-[var(--text-secondary)]"
          }`}
        >
          <span className="shrink-0 w-8 text-right pr-2 select-none text-[var(--text-tertiary)]">
            {line.lineNumber ?? ""}
          </span>
          <span className="shrink-0 w-4 select-none">
            {line.type === "add" ? "+" : line.type === "remove" ? "−" : " "}
          </span>
          <span className="whitespace-pre-wrap break-all">{line.text}</span>
        </div>
      ))}
    </div>
  );
}

interface DiffLine {
  type: "add" | "remove" | "context";
  text: string;
  lineNumber?: number;
}

function parseDiffContent(content: string): DiffLine[] {
  // If content has unified diff markers, parse directly
  if (content.includes("@@") && (content.includes("---") || content.includes("+++"))) {
    return parseUnifiedDiff(content);
  }

  // If there's no diff structure, treat the whole content as an "added" block
  // (e.g., write result showing the written content)
  const lines = content.split("\n");
  let lineNum = 1;
  return lines.map((text) => ({
    type: "add" as const,
    text,
    lineNumber: lineNum++,
  }));
}

/**
 * Compute a diff between old and new content using the `diff` package.
 * Used when explicit before/after blocks are available (future enhancement).
 */
export function computeDiff(oldContent: string, newContent: string): DiffLine[] {
  const changes = diffLines(oldContent, newContent);
  const result: DiffLine[] = [];
  let lineNum = 1;

  for (const change of changes) {
    const lines = change.value.replace(/\n$/, "").split("\n");
    for (const line of lines) {
      if (change.added) {
        result.push({ type: "add", text: line, lineNumber: lineNum++ });
      } else if (change.removed) {
        result.push({ type: "remove", text: line });
      } else {
        result.push({ type: "context", text: line, lineNumber: lineNum++ });
      }
    }
  }
  return result;
}

function parseUnifiedDiff(content: string): DiffLine[] {
  const lines = content.split("\n");
  const result: DiffLine[] = [];
  let lineNum = 1;

  for (const line of lines) {
    if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("@@")) {
      // Header lines — render as context
      result.push({ type: "context", text: line });
      // Reset line number from @@ header if present
      const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)/);
      if (match) lineNum = parseInt(match[1], 10);
      continue;
    }
    if (line.startsWith("+")) {
      result.push({ type: "add", text: line.slice(1), lineNumber: lineNum++ });
    } else if (line.startsWith("-")) {
      result.push({ type: "remove", text: line.slice(1) });
    } else {
      result.push({
        type: "context",
        text: line.startsWith(" ") ? line.slice(1) : line,
        lineNumber: lineNum++,
      });
    }
  }

  return result;
}
```

- [ ] **Step 3: Create HighlightedCodeView component**

Create `dashboard/src/components/panels/chat/blocks/HighlightedCodeView.tsx`:

```tsx
"use client";
import { useMemo } from "react";

interface HighlightedCodeViewProps {
  content: string;
  /** File extension hint for future syntax highlighting (e.g., "ts", "py") */
  extension?: string;
}

/**
 * Simple line-numbered code view for `read` results.
 * Uses monospace rendering with line numbers. No syntax highlighting
 * in v1 — extension is stored for future enhancement.
 */
export function HighlightedCodeView({ content }: HighlightedCodeViewProps) {
  const lines = useMemo(() => content.split("\n"), [content]);

  return (
    <div className="text-xs font-mono overflow-auto max-h-[400px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]">
      {lines.map((line, i) => (
        <div key={i} className="flex px-2 py-px hover:bg-[var(--bg-tertiary)]">
          <span className="shrink-0 w-10 text-right pr-3 select-none text-[var(--text-tertiary)]">
            {i + 1}
          </span>
          <span className="whitespace-pre-wrap break-all text-[var(--text-primary)]">{line}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run type check**

Run: `pnpm tsgo` (from repo root)
Expected: 0 new errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/panels/chat/blocks/DiffPreview.tsx \
       dashboard/src/components/panels/chat/blocks/HighlightedCodeView.tsx \
       dashboard/package.json
git commit -m "[enhanced] [impl] feat(deck): add DiffPreview and HighlightedCodeView for file-op results"
```

---

### Task 6: Virtual Scroll & Show Raw Toggle

**covers:**

- `tool-result-views/spec.md` > Virtual scroll for long results > "Long stdout output"
- `tool-result-views/spec.md` > Virtual scroll for long results > "Short result"
- `tool-result-views/spec.md` > Virtual scroll for long results > "Expand virtual scroll container"
- `tool-result-views/spec.md` > Show Raw toggle > "Toggle to raw view"
- `tool-result-views/spec.md` > Show Raw toggle > "Toggle back to formatted view"
- `tool-result-views/spec.md` > Show Raw toggle > "Persistence within session"

**Files:**

- Create: `dashboard/src/components/panels/chat/blocks/VirtualScrollResult.tsx`
- Create: `dashboard/src/components/panels/chat/blocks/ShowRawToggle.tsx`
- Modify: `dashboard/src/i18n/zh.json`, `dashboard/src/i18n/en.json`

- [ ] **Step 1: Install @tanstack/react-virtual**

Run: `cd dashboard && pnpm add @tanstack/react-virtual`

- [ ] **Step 2: Add i18n keys**

Add to `"chat"` namespace:

zh.json:

```json
"virtualLines": "{start}-{end} / {total} 行",
"virtualExpand": "展开",
"virtualCollapse": "收起"
```

en.json:

```json
"virtualLines": "{start}-{end} of {total} lines",
"virtualExpand": "Expand",
"virtualCollapse": "Collapse"
```

- [ ] **Step 3: Create ShowRawToggle**

Create `dashboard/src/components/panels/chat/blocks/ShowRawToggle.tsx`:

```tsx
"use client";
import { Code, FileText } from "lucide-react";
import { useTranslations } from "next-intl";

interface ShowRawToggleProps {
  isRaw: boolean;
  onToggle: () => void;
}

export function ShowRawToggle({ isRaw, onToggle }: ShowRawToggleProps) {
  const t = useTranslations("chat");
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
    >
      {isRaw ? <FileText size={10} /> : <Code size={10} />}
      {isRaw ? t("showFormatted") : t("showRaw")}
    </button>
  );
}
```

- [ ] **Step 4: Create VirtualScrollResult**

Create `dashboard/src/components/panels/chat/blocks/VirtualScrollResult.tsx`:

```tsx
"use client";
import { Maximize2, Minimize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualScrollResultProps {
  content: string;
}

const DEFAULT_HEIGHT = 400;
const EXPANDED_HEIGHT_VH = 80;
const LINE_HEIGHT = 20;

export function VirtualScrollResult({ content }: VirtualScrollResultProps) {
  const t = useTranslations("chat");
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => content.split("\n"), [content]);
  const totalLines = lines.length;

  const containerHeight = expanded
    ? Math.min(
        totalLines * LINE_HEIGHT,
        (typeof window !== "undefined" ? window.innerHeight : 800) * (EXPANDED_HEIGHT_VH / 100),
      )
    : DEFAULT_HEIGHT;

  const virtualizer = useVirtualizer({
    count: totalLines,
    getScrollElement: () => containerRef.current,
    estimateSize: () => LINE_HEIGHT,
    overscan: 20,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const firstVisible = virtualItems.length > 0 ? virtualItems[0].index + 1 : 0;
  const lastVisible = virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].index + 1 : 0;

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-[var(--bg-tertiary)] text-[10px] text-[var(--text-tertiary)]">
        <span>
          {t("virtualLines", {
            start: firstVisible,
            end: lastVisible,
            total: totalLines,
          })}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 hover:text-[var(--text-secondary)] transition-colors"
        >
          {expanded ? <Minimize2 size={10} /> : <Maximize2 size={10} />}
          {expanded ? t("virtualCollapse") : t("virtualExpand")}
        </button>
      </div>

      {/* Virtual scroll container */}
      <div
        ref={containerRef}
        className="overflow-auto bg-[var(--bg-primary)]"
        style={{ height: containerHeight }}
      >
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualItems.map((virtualRow) => (
            <div
              key={virtualRow.key}
              className="absolute left-0 w-full flex px-2 text-xs font-mono hover:bg-[var(--bg-tertiary)]"
              style={{
                top: virtualRow.start,
                height: virtualRow.size,
              }}
            >
              <span className="shrink-0 w-10 text-right pr-3 select-none text-[var(--text-tertiary)]">
                {virtualRow.index + 1}
              </span>
              <span className="whitespace-pre text-[var(--text-primary)] overflow-hidden text-ellipsis">
                {lines[virtualRow.index]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run type check**

Run: `pnpm tsgo` (from repo root)
Expected: 0 new errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/panels/chat/blocks/VirtualScrollResult.tsx \
       dashboard/src/components/panels/chat/blocks/ShowRawToggle.tsx \
       dashboard/src/i18n/zh.json dashboard/src/i18n/en.json \
       dashboard/package.json
git commit -m "[enhanced] [impl] feat(deck): add VirtualScrollResult and ShowRawToggle components"
```

---

### Task 7: ToolResultCard Wiring

**covers:**

- `tool-result-views/spec.md` > Bash result split view > all scenarios (wiring)
- `tool-result-views/spec.md` > File operation diff preview > all scenarios (wiring)
- `tool-result-views/spec.md` > Virtual scroll for long results > all scenarios (wiring)
- `tool-result-views/spec.md` > Show Raw toggle > all scenarios (wiring)

**Files:**

- Rewrite: `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx`
- Modify: `dashboard/src/components/panels/chat/MessageList.tsx` (pass toolInput)

- [ ] **Step 1: Rewrite ToolResultCard with detection routing**

Rewrite `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx`:

```tsx
"use client";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  isBashTool,
  isFileOpTool,
  parseBashResult,
  getFileExtension,
  countLines,
  isBinaryContent,
} from "@/lib/tool-result-parser";
import { ArtifactCard } from "../artifacts/ArtifactCard";
import { detectArtifact, type ArtifactInfo } from "../artifacts/detectArtifact";
import { ArtifactContext } from "../ChatPanel";
import { BashResultView } from "./BashResultView";
import { DiffPreview } from "./DiffPreview";
import { HighlightedCodeView } from "./HighlightedCodeView";
import { ShowRawToggle } from "./ShowRawToggle";
import { VirtualScrollResult } from "./VirtualScrollResult";

const VIRTUAL_SCROLL_THRESHOLD = 200;

interface ToolResultCardProps {
  content: string;
  isError?: boolean;
  toolName?: string;
  /** Tool input params — used to extract file_path for syntax hints */
  toolInput?: Record<string, unknown>;
}

export function ToolResultCard({ content, isError, toolName, toolInput }: ToolResultCardProps) {
  const t = useTranslations("chat");
  const { onOpenArtifact } = useContext(ArtifactContext);
  const [showRaw, setShowRaw] = useState(false);

  const contentStr = typeof content === "string" ? content : JSON.stringify(content, null, 2);

  const artifact = !isError
    ? detectArtifact(contentStr, toolName ? { toolName } : undefined)
    : null;

  // Detect which view to render
  const viewType = useMemo(() => {
    if (isError) return "raw" as const;
    if (isBashTool(toolName)) return "bash" as const;
    const fileOp = isFileOpTool(toolName);
    if (fileOp === "read") return "read" as const;
    if (fileOp === "write" || fileOp === "edit") {
      // Only route to diff if content has diff markers or unified diff structure
      const hasDiffMarkers =
        contentStr.includes("@@") && (contentStr.includes("---") || contentStr.includes("+++"));
      return hasDiffMarkers ? ("diff" as const) : ("raw" as const);
    }
    return "raw" as const;
  }, [toolName, isError, contentStr]);

  const bashParsed = useMemo(
    () => (viewType === "bash" ? parseBashResult(contentStr) : null),
    [viewType, contentStr],
  );

  const lineCount = useMemo(() => countLines(contentStr), [contentStr]);
  const useVirtualScroll = lineCount > VIRTUAL_SCROLL_THRESHOLD;
  const hasEnhancedView = viewType !== "raw" || useVirtualScroll;

  const filePath = (toolInput?.file_path as string) ?? (toolInput?.path as string) ?? undefined;
  const fileExt = useMemo(() => getFileExtension(filePath), [filePath]);

  function renderContent() {
    if (showRaw) {
      // Show raw always renders as plain pre, with virtual scroll for long content
      return useVirtualScroll ? (
        <VirtualScrollResult content={contentStr} />
      ) : (
        <pre className="px-2.5 py-2 text-xs whitespace-pre-wrap overflow-auto bg-[var(--bg-primary)] text-[var(--text-primary)] max-h-[300px]">
          {contentStr}
        </pre>
      );
    }

    // Enhanced views — each applies virtual scroll internally for their content
    if (viewType === "bash" && bashParsed) {
      return <BashResultView result={bashParsed} />;
    }
    if (viewType === "bash" && !bashParsed) {
      // Fallback: unrecognizable bash output
      return useVirtualScroll ? (
        <VirtualScrollResult content={contentStr} />
      ) : (
        <pre className="px-2.5 py-2 text-xs whitespace-pre-wrap overflow-auto bg-[var(--bg-primary)] text-[var(--text-primary)] max-h-[300px]">
          {contentStr}
        </pre>
      );
    }
    if (viewType === "diff") {
      return <DiffPreview content={contentStr} />;
    }
    if (viewType === "read") {
      if (isBinaryContent(contentStr)) {
        return (
          <div className="px-2.5 py-4 text-xs text-center text-[var(--text-tertiary)] italic">
            {t("binaryFile")}
          </div>
        );
      }
      return <HighlightedCodeView content={contentStr} extension={fileExt} />;
    }

    // Default raw view
    return useVirtualScroll ? (
      <VirtualScrollResult content={contentStr} />
    ) : (
      <pre className="px-2.5 py-2 text-xs whitespace-pre-wrap overflow-auto bg-[var(--bg-primary)] text-[var(--text-primary)]">
        {contentStr}
      </pre>
    );
  }

  return (
    <>
      <details
        className={cn(
          "my-1.5 text-xs rounded-lg border overflow-hidden",
          isError ? "border-[var(--danger)]/30" : "border-[var(--border-subtle)]",
        )}
        open={isError}
      >
        <summary
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer select-none",
            isError
              ? "bg-[var(--danger-muted)] text-[var(--danger-muted-text)]"
              : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]",
          )}
        >
          {isError ? <X size={12} /> : <Check size={12} />}
          <span className="font-medium">{isError ? t("toolError") : t("toolResult")}</span>
          <span className="flex-1" />
          {hasEnhancedView && (
            <ShowRawToggle isRaw={showRaw} onToggle={() => setShowRaw(!showRaw)} />
          )}
        </summary>
        {renderContent()}
      </details>
      {artifact && <ArtifactCard artifact={artifact} onOpen={onOpenArtifact} />}
    </>
  );
}
```

- [ ] **Step 2: Pass toolInput from MessageBubble to ToolResultCard**

In `dashboard/src/components/panels/chat/MessageList.tsx`, update the ToolResultCard rendering.

First, build a `toolUseInputMap` alongside the existing `toolUseNameMap` (around line 77):

```tsx
// Build lookups from toolUseId -> tool name and toolUseId -> tool input
const toolUseNameMap = new Map(
  message.content
    .filter((b): b is ContentBlock & { type: "tool_use" } => b.type === "tool_use")
    .map((b) => [b.id, b.name]),
);
const toolUseInputMap = new Map(
  message.content
    .filter((b): b is ContentBlock & { type: "tool_use" } => b.type === "tool_use")
    .map((b) => [b.id, b.input]),
);
```

Then update the ToolResultCard rendering (around line 160):

```tsx
{
  toolResultBlocks.map((b, i) => (
    <ToolResultCard
      key={`result-${i}`}
      content={typeof b.content === "string" ? b.content : JSON.stringify(b.content)}
      isError={b.isError}
      toolName={toolUseNameMap.get(b.toolUseId)}
      toolInput={toolUseInputMap.get(b.toolUseId)}
    />
  ));
}
```

- [ ] **Step 3: Run type check**

Run: `pnpm tsgo` (from repo root)
Expected: 0 new errors

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx \
       dashboard/src/components/panels/chat/MessageList.tsx
git commit -m "[enhanced] [impl] feat(deck): wire ToolResultCard with bash/diff/read/virtual-scroll detection and ShowRaw toggle"
```

---

### Task 8: Run Status Bar

**covers:**

- `run-status-indicator/spec.md` > Run metadata bar per assistant message > "Complete run with full metadata"
- `run-status-indicator/spec.md` > Run metadata bar per assistant message > "Streaming run (in progress)"
- `run-status-indicator/spec.md` > Run metadata bar per assistant message > "Partial metadata available"
- `run-status-indicator/spec.md` > Run metadata bar per assistant message > "No metadata available"
- `run-status-indicator/spec.md` > Token usage formatting > all scenarios
- `run-status-indicator/spec.md` > Duration formatting > all scenarios

**Files:**

- Create: `dashboard/src/components/panels/chat/RunStatusBar.tsx`
- Modify: `dashboard/src/components/panels/chat/MessageList.tsx` (integrate into MessageBubble)
- Modify: `dashboard/src/i18n/zh.json`, `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add i18n keys**

Add to `"chat"` namespace:

zh.json:

```json
"runModel": "模型",
"runTokensIn": "输入",
"runTokensOut": "输出",
"runTokensCache": "缓存",
"runDuration": "耗时",
"runStreaming": "运行中..."
```

en.json:

```json
"runModel": "Model",
"runTokensIn": "in",
"runTokensOut": "out",
"runTokensCache": "cache",
"runDuration": "Duration",
"runStreaming": "Running..."
```

- [ ] **Step 2: Create RunStatusBar component**

Create `dashboard/src/components/panels/chat/RunStatusBar.tsx`:

```tsx
"use client";
import { Cpu, Clock, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { formatTokenCount, formatDuration } from "@/lib/format-utils";
import type { RunMetadata } from "@/stores/chat-types";

interface RunStatusBarProps {
  metadata: RunMetadata;
}

export function RunStatusBar({ metadata }: RunStatusBarProps) {
  const t = useTranslations("chat");

  // Live elapsed timer for streaming runs
  const [elapsed, setElapsed] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!metadata.streaming || !metadata.startedAt) return;

    const updateElapsed = () => setElapsed(Date.now() - metadata.startedAt!);
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [metadata.streaming, metadata.startedAt]);

  const displayDuration = metadata.streaming ? elapsed : metadata.durationMs;

  return (
    <div className="flex items-center gap-3 mt-1 px-1 text-[10px] text-[var(--text-tertiary)] font-mono">
      {/* Model badge */}
      {metadata.model && (
        <span className="flex items-center gap-1">
          <Cpu size={10} />
          <span className="text-[var(--text-secondary)]">{metadata.model}</span>
        </span>
      )}

      {/* Token summary */}
      {metadata.usage && (
        <span className="flex items-center gap-1">
          <Zap size={10} />
          <span>
            {formatTokenCount(metadata.usage.input)} {t("runTokensIn")}
            {" / "}
            {formatTokenCount(metadata.usage.output)} {t("runTokensOut")}
            {metadata.usage.cache !== undefined && metadata.usage.cache > 0 && (
              <>
                {" "}
                / {formatTokenCount(metadata.usage.cache)} {t("runTokensCache")}
              </>
            )}
          </span>
        </span>
      )}

      {/* Duration */}
      <span className="flex items-center gap-1">
        <Clock size={10} />
        {metadata.streaming ? (
          <span className="animate-pulse">{formatDuration(displayDuration)}</span>
        ) : (
          <span>{formatDuration(displayDuration)}</span>
        )}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Integrate RunStatusBar into MessageBubble**

In `dashboard/src/components/panels/chat/MessageList.tsx`:

Import the new component and store hook:

```tsx
import { RunStatusBar } from "./RunStatusBar";
import { useChatStore } from "@/stores/chat";
```

Inside `MessageBubble`, add a reactive selector for run metadata (must be reactive so the bar appears when lifecycle events set metadata during streaming):

```tsx
// Reactive: subscribe to run metadata changes so RunStatusBar appears during streaming
const runMetadata = useChatStore((state) => {
  if (isUser) return undefined;
  const activeKey = state.activeSessionKey;
  if (!activeKey) return undefined;
  return state.sessions.get(activeKey)?.runMetadata[message.id];
});
```

Then render RunStatusBar just before the timestamp (around line 176):

```tsx
        {/* Run status bar (assistant messages only) */}
        {runMetadata && <RunStatusBar metadata={runMetadata} />}

        {/* Timestamp */}
        <span className="text-[10px] mt-1 px-1 text-[var(--text-secondary)] font-mono">
```

- [ ] **Step 4: Run type check**

Run: `pnpm tsgo` (from repo root)
Expected: 0 new errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/panels/chat/RunStatusBar.tsx \
       dashboard/src/components/panels/chat/MessageList.tsx \
       dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] [impl] feat(deck): add RunStatusBar with model/tokens/duration per assistant message"
```

---

### Task 9: Subagent Inline Cards

**covers:**

- `subagent-inline-cards/spec.md` > Subagent spawn inline card > "Subagent spawn event received"
- `subagent-inline-cards/spec.md` > Subagent spawn inline card > "Multiple subagents in one message"
- `subagent-inline-cards/spec.md` > Subagent completion status > "Subagent completes successfully"
- `subagent-inline-cards/spec.md` > Subagent completion status > "Subagent fails"
- `subagent-inline-cards/spec.md` > Subagent completion status > "Subagent still running after parent completes"
- `subagent-inline-cards/spec.md` > Subagent card collapsibility > "Default state for running subagent"
- `subagent-inline-cards/spec.md` > Subagent card collapsibility > "Default state for completed subagent"
- `subagent-inline-cards/spec.md` > Subagent card collapsibility > "User toggles collapse"

**Files:**

- Create: `dashboard/src/components/panels/chat/SubagentCard.tsx`
- Modify: `dashboard/src/components/panels/chat/MessageList.tsx` (session-level subagent section)
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx` (polling lifecycle)
- Modify: `dashboard/src/i18n/zh.json`, `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add i18n keys**

Add to `"chat"` namespace:

zh.json:

```json
"subagentRunning": "运行中",
"subagentCompleted": "已完成",
"subagentFailed": "失败",
"subagentTask": "任务",
"subagentResult": "结果",
"subagentError": "错误"
```

en.json:

```json
"subagentRunning": "Running",
"subagentCompleted": "Completed",
"subagentFailed": "Failed",
"subagentTask": "Task",
"subagentResult": "Result",
"subagentError": "Error"
```

- [ ] **Step 2: Create SubagentCard component (using deck-subagents store types)**

Create `dashboard/src/components/panels/chat/SubagentCard.tsx`.

**Important**: Uses `SubagentRun` from `@/stores/deck-subagents` (NOT from `chat-types.ts`). Field mapping:

- `run.runId` (not `run.id`)
- `run.status === "active"` means running (not `"running"`)
- `run.task` (not `run.taskDescription`)
- `run.durationMs` (not `run.duration`)
- `run.outcome?.error` (not `run.error`)
- `run.childAgentName` for display name
- `run.createdAt` for elapsed timer (not `run.startedAt`)

```tsx
"use client";
import { Bot, ChevronRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format-utils";
import type { SubagentRun } from "@/stores/deck-subagents";

interface SubagentCardProps {
  run: SubagentRun;
}

export function SubagentCard({ run }: SubagentCardProps) {
  const t = useTranslations("chat");
  const isRunning = run.status === "active";
  const isFailed = run.status === "failed" || run.status === "timeout";

  // Default expanded for running, collapsed for completed
  const [open, setOpen] = useState(isRunning);

  // Live elapsed timer for running subagents
  const [elapsed, setElapsed] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!isRunning) return;
    const updateElapsed = () => setElapsed(Date.now() - run.createdAt);
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [isRunning, run.createdAt]);

  const displayDuration = isRunning ? elapsed : run.durationMs;
  const displayName = run.childAgentName ?? run.childAgentId;
  const errorMsg = run.outcome?.error;

  const statusBadge = isRunning ? (
    <span className="flex items-center gap-1 text-[var(--accent)]">
      <Loader2 size={10} className="animate-spin" />
      {t("subagentRunning")}
    </span>
  ) : isFailed ? (
    <span className="text-[var(--danger)]">{t("subagentFailed")}</span>
  ) : (
    <span className="text-[var(--success)]">{t("subagentCompleted")}</span>
  );

  return (
    <div
      className={cn(
        "my-1.5 text-xs rounded-lg border overflow-hidden",
        isFailed ? "border-[var(--danger)]/30" : "border-[var(--border-subtle)]",
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-left bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
      >
        <ChevronRight
          size={12}
          className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <Bot size={12} className="shrink-0" />
        <span className="font-medium truncate">{displayName}</span>
        <span className="flex-1" />
        {statusBadge}
        <span className="font-mono text-[var(--text-tertiary)] ml-2">
          {formatDuration(displayDuration)}
        </span>
      </button>

      {open && (
        <div className="px-2.5 py-2 border-t border-[var(--border-subtle)] space-y-1.5">
          {run.task && (
            <div>
              <span className="font-medium text-[var(--text-tertiary)]">{t("subagentTask")}: </span>
              <span className="text-[var(--text-primary)]">{run.task}</span>
            </div>
          )}
          {errorMsg && (
            <div>
              <span className="font-medium text-[var(--danger)]">{t("subagentError")}: </span>
              <pre className="mt-0.5 p-2 rounded-lg bg-[var(--danger-muted)] text-[var(--danger-muted-text)] whitespace-pre-wrap overflow-auto max-h-[200px]">
                {errorMsg}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Integrate SubagentCard as session-level display in MessageList**

**Design decision (R2 降级)**: deck-subagents store 没有 parentRunId/parentMessageId，无法做 per-message 内联。改为 session 级展示：在消息流底部（最后一条消息之后）统一显示当前 session 的 subagent 状态。

In `dashboard/src/components/panels/chat/MessageList.tsx`:

Import:

```tsx
import { SubagentCard } from "./SubagentCard";
import { useDeckSubagentsStore } from "@/stores/deck-subagents";
```

Inside the `MessageList` component (NOT MessageBubble), add a session-level subagent section after the messages loop and streaming indicator:

```tsx
// Session-level subagent runs (deck-subagents polling store)
const activeSessionKey = useChatStore((s) => s.activeSessionKey);
const subagentRuns = useDeckSubagentsStore((state) => {
  if (!activeSessionKey) return [];
  return [...state.activeRuns, ...state.historyRuns]
    .filter((r) => r.requesterSessionKey === activeSessionKey)
    .sort((a, b) => a.createdAt - b.createdAt);
});
```

Render after the streaming indicator, before the closing `</div>`:

```tsx
{
  /* Session-level subagent cards */
}
{
  subagentRuns.length > 0 && (
    <div className="px-2 mb-4">
      {subagentRuns.map((run) => (
        <SubagentCard key={run.runId} run={run} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3.5: Start deck-subagents polling in ChatPanel**

In `dashboard/src/components/panels/chat/ChatPanel.tsx`, add polling lifecycle:

```tsx
import { useDeckSubagentsStore } from "@/stores/deck-subagents";

// Inside ChatPanel component, add:
useEffect(() => {
  useDeckSubagentsStore.getState().startPolling();
  return () => useDeckSubagentsStore.getState().stopPolling();
}, []);
```

Update the Files section of this task to include `ChatPanel.tsx`.

- [ ] **Step 4: Run type check**

Run: `pnpm tsgo` (from repo root)
Expected: 0 new errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/panels/chat/SubagentCard.tsx \
       dashboard/src/components/panels/chat/MessageList.tsx \
       dashboard/src/components/panels/chat/ChatPanel.tsx \
       dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] [impl] feat(deck): add SubagentCard with session-level display from deck-subagents store"
```

---

### Task 10: Integration, Tests & Verification

**covers:**

- All spec scenarios — backward compatibility verification
- `tool-result-views/spec.md` > Bash result split view > "Unrecognizable bash output" (integration test)
- `tool-result-views/spec.md` > Virtual scroll > "Short result" (no virtual scroll)
- `run-status-indicator/spec.md` > Run metadata bar > "No metadata available" (no bar rendered)

**Files:**

- Modify: `dashboard/src/lib/tool-result-parser.test.ts` (add integration-level tests)
- Modify: `dashboard/src/lib/format-utils.test.ts` (verify edge cases)

- [ ] **Step 1: Add integration-level parser tests**

Add to `dashboard/src/lib/tool-result-parser.test.ts`:

```typescript
describe("integration: backward compatibility", () => {
  it("returns raw view type for unknown tool names", () => {
    expect(isBashTool("unknown_tool")).toBe(false);
    expect(isFileOpTool("unknown_tool")).toBeNull();
  });

  it("handles empty content gracefully", () => {
    expect(parseBashResult("")).toBeNull();
    expect(countLines("")).toBe(0);
    expect(isBinaryContent("")).toBe(false);
  });

  it("detects binary content", () => {
    expect(isBinaryContent("hello\0world")).toBe(true);
    expect(isBinaryContent("normal text")).toBe(false);
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `cd dashboard && pnpm test -- src/lib/`
Expected: All tests pass

- [ ] **Step 3: Run full type check**

Run: `pnpm tsgo` (from repo root)
Expected: 0 new errors (only pre-existing ones)

- [ ] **Step 4: Run lint/format**

Run: `pnpm check` (from repo root)
Expected: Pass (fix any lint issues before continuing)

- [ ] **Step 5: Commit final test additions**

```bash
git add dashboard/src/lib/tool-result-parser.test.ts
git commit -m "[enhanced] [impl] test(deck): add integration tests for tool result parser backward compatibility"
```

---

## Requirement Coverage Matrix

| Spec                  | Requirement                   | Scenario                      | Covered By                                                                                                        |
| --------------------- | ----------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| tool-param-formatter  | Structured parameter display  | Simple key-value              | Task 3                                                                                                            |
| tool-param-formatter  | Structured parameter display  | Nested object                 | Task 3                                                                                                            |
| tool-param-formatter  | Structured parameter display  | Large string                  | Task 3                                                                                                            |
| tool-param-formatter  | Structured parameter display  | Empty input                   | Task 3                                                                                                            |
| tool-param-formatter  | Collapsible tool use sections | Default collapsed             | Task 3                                                                                                            |
| tool-param-formatter  | Collapsible tool use sections | Streaming expanded            | Task 3                                                                                                            |
| tool-param-formatter  | Collapsible tool use sections | Parameter summary             | Task 3                                                                                                            |
| tool-param-formatter  | Copy raw JSON action          | Copy action                   | Task 3                                                                                                            |
| tool-result-views     | Bash result split view        | Successful command            | Task 4 + Task 7                                                                                                   |
| tool-result-views     | Bash result split view        | Failed with stderr            | Task 4 + Task 7                                                                                                   |
| tool-result-views     | Bash result split view        | Unrecognizable output         | Task 7 + Task 10                                                                                                  |
| tool-result-views     | File operation diff preview   | Write/edit with diff          | Task 5 + Task 7                                                                                                   |
| tool-result-views     | File operation diff preview   | Read with highlighting        | Task 5 + Task 7                                                                                                   |
| tool-result-views     | File operation diff preview   | Binary file                   | Task 5 + Task 7                                                                                                   |
| tool-result-views     | Virtual scroll                | Long output (>200 lines)      | Task 6 + Task 7                                                                                                   |
| tool-result-views     | Virtual scroll                | Short result (<= 200 lines)   | Task 7 + Task 10                                                                                                  |
| tool-result-views     | Virtual scroll                | Expand container              | Task 6                                                                                                            |
| tool-result-views     | Show Raw toggle               | Toggle to raw                 | Task 6 + Task 7                                                                                                   |
| tool-result-views     | Show Raw toggle               | Toggle to formatted           | Task 6 + Task 7                                                                                                   |
| tool-result-views     | Show Raw toggle               | Per-card persistence          | Task 6                                                                                                            |
| run-status-indicator  | Run metadata bar              | Complete with full metadata   | **DEGRADED** — duration only (lifecycle start/end), model only on fallback, tokens "—". 待 gateway lifecycle 增强 |
| run-status-indicator  | Run metadata bar              | Streaming (in progress)       | Task 2 + Task 8 (elapsed timer from lifecycle start)                                                              |
| run-status-indicator  | Run metadata bar              | Partial metadata              | Task 8 (graceful "—" for missing fields)                                                                          |
| run-status-indicator  | Run metadata bar              | No metadata                   | Task 8 + Task 10                                                                                                  |
| run-status-indicator  | Token usage formatting        | Under 1000                    | Task 1                                                                                                            |
| run-status-indicator  | Token usage formatting        | 1000 or above                 | Task 1                                                                                                            |
| run-status-indicator  | Token usage formatting        | Zero tokens                   | Task 1                                                                                                            |
| run-status-indicator  | Duration formatting           | Under 60s                     | Task 1                                                                                                            |
| run-status-indicator  | Duration formatting           | 60s or above                  | Task 1                                                                                                            |
| run-status-indicator  | Duration formatting           | Live counter                  | Task 8                                                                                                            |
| subagent-inline-cards | Subagent spawn card           | Spawn event received          | Task 9 — **DEGRADED to session-level** (deck-subagents polling, not per-message inline; 无 parentRunId 关联)      |
| subagent-inline-cards | Subagent spawn card           | Multiple subagents            | Task 9 (session-level, sorted by createdAt)                                                                       |
| subagent-inline-cards | Completion status             | Completes successfully        | Task 9                                                                                                            |
| subagent-inline-cards | Completion status             | Fails                         | Task 9                                                                                                            |
| subagent-inline-cards | Completion status             | Still running after parent    | Task 9 (polling continues independently)                                                                          |
| subagent-inline-cards | Card collapsibility           | Default running (expanded)    | Task 9                                                                                                            |
| subagent-inline-cards | Card collapsibility           | Default completed (collapsed) | Task 9                                                                                                            |
| subagent-inline-cards | Card collapsibility           | User toggles                  | Task 9                                                                                                            |
| subagent-inline-cards | Store tracking                | Init on spawn                 | Task 9 (deck-subagents polling store, not chat store)                                                             |
| subagent-inline-cards | Store tracking                | Update on completion          | Task 9 (deck-subagents polling store)                                                                             |
| subagent-inline-cards | Store tracking                | Session cleanup               | Task 9 (polling stop on unmount)                                                                                  |
