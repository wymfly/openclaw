# Deck Slash Command Coherence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the end-to-end feedback loop for all 15 Deck slash commands — every command execution must produce immediate, perceivable UI feedback and the frontend state must stay in sync with the Gateway.

**Architecture:** Pure frontend fix across 4 layers: (1) extend `SessionMeta` type with config fields + wire SSE/list sync, (2) enhance executor to return `toastMessage`/`toastType`/`configUpdate`, (3) fix `MessageInput` action handler to consume toast + optimistic update + correct `/stop` behavior, (4) add persistent `SessionConfigBar` above the input box. Remove dead `/focus` command. No Gateway/API route changes.

**Tech Stack:** React 19 + Next.js 15, Zustand stores, next-intl i18n, Tailwind CSS with shadcn design tokens, lucide-react icons

---

## File Structure

| File                                                             | Responsibility                                                                    | Action |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------ |
| `dashboard/src/stores/chat-types.ts`                             | `SessionMeta` interface — add `thinkingLevel`, `fastMode`, `verboseLevel`         | MODIFY |
| `dashboard/src/stores/chat-dispatchers.ts`                       | SSE `sessions.changed` handler + `ChatStoreAPI.updateSessionMeta` signature       | MODIFY |
| `dashboard/src/stores/chat.ts`                                   | `updateSessionMeta` impl — widen patch type                                       | MODIFY |
| `dashboard/src/components/panels/chat/slash-command-executor.ts` | `SlashCommandResult` type + all executor functions                                | MODIFY |
| `dashboard/src/components/panels/chat/slash-commands.ts`         | Command registry — remove `/focus`                                                | MODIFY |
| `dashboard/src/components/panels/chat/MessageInput.tsx`          | Action handler — toast, optimistic update, `/stop` fix, render `SessionConfigBar` | MODIFY |
| `dashboard/src/components/panels/chat/SessionConfigBar.tsx`      | New component — persistent config status strip                                    | CREATE |
| `dashboard/src/i18n/zh.json`                                     | Chinese i18n keys                                                                 | MODIFY |
| `dashboard/src/i18n/en.json`                                     | English i18n keys                                                                 | MODIFY |

---

### Task 1: Extend SessionMeta + Store Sync [store-layer]

covers: session-config-bar/spec.md > ADDED > SessionMeta includes config fields > SessionMeta type completeness
covers: session-config-bar/spec.md > ADDED > SessionMeta includes config fields > sessions.list populates config fields
covers: session-config-bar/spec.md > ADDED > Session config bar displays current session settings > Real-time update via SSE

**Files:**

- Modify: `dashboard/src/stores/chat-types.ts:142-160`
- Modify: `dashboard/src/stores/chat-dispatchers.ts:120-126` (updateSessionMeta signature)
- Modify: `dashboard/src/stores/chat-dispatchers.ts:683-692` (sessions.changed meta sync)
- Modify: `dashboard/src/stores/chat.ts:600-608` (updateSessionMeta impl)

- [ ] **Step 1.1: Add config fields to SessionMeta**

In `dashboard/src/stores/chat-types.ts`, add three fields to the `SessionMeta` interface after the existing `model?: string` field:

```typescript
export interface SessionMeta {
  key: string;
  agentId: string;
  title?: string;
  updatedAt: number;
  lastMessagePreview?: string;
  // New fields from sessions.changed snapshots
  status?: string;
  model?: string;
  thinkingLevel?: string; // ← ADD
  fastMode?: boolean; // ← ADD
  verboseLevel?: string; // ← ADD
  totalTokens?: number;
  estimatedCostUsd?: number;
  parentSessionKey?: string;
  childSessions?: string[];
  contextTokens?: number;
  // Subagent fields (loaded via sessions.list, not events)
  subagentRole?: "orchestrator" | "leaf";
  subagentControlScope?: "children" | "none";
  spawnedWorkspaceDir?: string;
}
```

- [ ] **Step 1.2: Widen updateSessionMeta patch type**

In `dashboard/src/stores/chat-dispatchers.ts`, change the `updateSessionMeta` signature in the `ChatStoreAPI` interface to accept the new fields:

```typescript
/** Update session metadata from SSE events or optimistic updates. */
updateSessionMeta: (
  sessionKey: string,
  patch: {
    totalTokens?: number;
    estimatedCostUsd?: number;
    thinkingLevel?: string;
    fastMode?: boolean;
    verboseLevel?: string;
    model?: string;
  },
) => void;
```

- [ ] **Step 1.3: Sync config fields from sessions.changed SSE events**

In `dashboard/src/stores/chat-dispatchers.ts`, in the `handleSessionsChanged` function, extend the existing meta sync block (around line 683-692) to also extract config fields:

```typescript
// ── Session meta sync (totalTokens, estimatedCostUsd, config fields) ──
const totalTokens = typeof payload.totalTokens === "number" ? payload.totalTokens : undefined;
const estimatedCostUsd =
  typeof payload.estimatedCostUsd === "number" ? payload.estimatedCostUsd : undefined;
const thinkingLevel = typeof payload.thinkingLevel === "string" ? payload.thinkingLevel : undefined;
const fastMode = typeof payload.fastMode === "boolean" ? payload.fastMode : undefined;
const verboseLevel = typeof payload.verboseLevel === "string" ? payload.verboseLevel : undefined;
const model = typeof payload.model === "string" ? payload.model : undefined;

const metaPatch: Record<string, unknown> = {};
if (totalTokens !== undefined) metaPatch.totalTokens = totalTokens;
if (estimatedCostUsd !== undefined) metaPatch.estimatedCostUsd = estimatedCostUsd;
if (thinkingLevel !== undefined) metaPatch.thinkingLevel = thinkingLevel;
if (fastMode !== undefined) metaPatch.fastMode = fastMode;
if (verboseLevel !== undefined) metaPatch.verboseLevel = verboseLevel;
if (model !== undefined) metaPatch.model = model;

if (Object.keys(metaPatch).length > 0) {
  api.updateSessionMeta(sessionKey, metaPatch as Parameters<typeof api.updateSessionMeta>[1]);
}
```

This replaces the existing `if (totalTokens !== undefined || estimatedCostUsd !== undefined)` block.

- [ ] **Step 1.4: Run type check**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Zero errors (the `updateSessionMeta` impl in `chat.ts` line 600-608 uses spread `{ ...metas[idx], ...patch }` so it already handles any extra fields).

- [ ] **Step 1.5: Commit**

```bash
scripts/committer "[enhanced] fix(store): extend SessionMeta with thinkingLevel/fastMode/verboseLevel + SSE sync" \
  dashboard/src/stores/chat-types.ts \
  dashboard/src/stores/chat-dispatchers.ts
```

---

### Task 2: Remove /focus Command [cleanup]

covers: chat-slash-commands/spec.md > MODIFIED > Slash commands execute corresponding actions > /focus removed from registry
covers: chat-slash-commands/spec.md > REMOVED > /focus toggles focus mode

**Files:**

- Modify: `dashboard/src/components/panels/chat/slash-commands.ts:29`
- Modify: `dashboard/src/components/panels/chat/slash-command-executor.ts:9-16,41-42`
- Modify: `dashboard/src/components/panels/chat/MessageInput.tsx:234`
- Modify: `dashboard/src/i18n/zh.json` (remove `cmd_focus`)
- Modify: `dashboard/src/i18n/en.json` (remove `cmd_focus`)

- [ ] **Step 2.1: Remove focus from SLASH_COMMANDS array**

In `dashboard/src/components/panels/chat/slash-commands.ts`, delete the line:

```typescript
  { name: "focus", descriptionKey: "cmd_focus", icon: "eye", category: "session" },
```

- [ ] **Step 2.2: Remove focus from executor switch + SlashCommandAction**

In `dashboard/src/components/panels/chat/slash-command-executor.ts`:

1. Remove `"toggle-focus"` from the `SlashCommandAction` union type:

```typescript
export type SlashCommandAction = "new-session" | "reset" | "stop" | "clear" | "export" | "refresh";
```

2. Remove the `case "focus":` line from the switch:

```typescript
// DELETE: case "focus":
//   return { content: "", action: "toggle-focus" };
```

- [ ] **Step 2.3: Remove toggle-focus comment from MessageInput**

In `dashboard/src/components/panels/chat/MessageInput.tsx`, delete the comment line:

```typescript
// "toggle-focus": no-op until UI store has focusMode
```

- [ ] **Step 2.4: Remove i18n keys**

In `dashboard/src/i18n/zh.json`, delete: `"cmd_focus": "切换专注模式",`
In `dashboard/src/i18n/en.json`, delete the corresponding `"cmd_focus"` key.

- [ ] **Step 2.5: Run type check**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Zero errors

- [ ] **Step 2.6: Commit**

```bash
scripts/committer "[enhanced] fix(chat): remove unimplemented /focus command" \
  dashboard/src/components/panels/chat/slash-commands.ts \
  dashboard/src/components/panels/chat/slash-command-executor.ts \
  dashboard/src/components/panels/chat/MessageInput.tsx \
  dashboard/src/i18n/zh.json \
  dashboard/src/i18n/en.json
```

---

### Task 3: Enhance Executor with Toast + ConfigUpdate [executor-layer]

covers: command-feedback/spec.md > ADDED > Configuration commands show success toast > /fast on success toast
covers: command-feedback/spec.md > ADDED > Configuration commands show success toast > /model switch success toast
covers: command-feedback/spec.md > ADDED > Configuration commands show success toast > /think level success toast
covers: command-feedback/spec.md > ADDED > Configuration commands show success toast > /compact success toast
covers: command-feedback/spec.md > ADDED > Failed commands show error toast > API returns non-200
covers: command-feedback/spec.md > ADDED > Failed commands show error toast > Network error
covers: chat-slash-commands/spec.md > MODIFIED > Slash commands execute corresponding actions > patchSession optimistic store update
covers: chat-slash-commands/spec.md > MODIFIED > Slash commands execute corresponding actions > /fast status shows current value

**Files:**

- Modify: `dashboard/src/components/panels/chat/slash-command-executor.ts`

- [ ] **Step 3.1: Extend SlashCommandResult type**

Add `toastMessage`, `toastType`, and `configUpdate` to the result interface:

```typescript
export type SlashCommandAction = "new-session" | "reset" | "stop" | "clear" | "export" | "refresh";

export interface SlashCommandResult {
  /** Text content to display as system message (empty string = no display). */
  content: string;
  /** Side-effect action the caller should perform after displaying the result. */
  action?: SlashCommandAction;
  /** Toast notification message (shown via addToast). */
  toastMessage?: string;
  /** Toast type. Defaults to "info" if toastMessage is set but toastType is not. */
  toastType?: "success" | "info" | "error";
  /** Optimistic config update to apply to SessionMeta immediately. */
  configUpdate?: Record<string, unknown>;
}
```

- [ ] **Step 3.2: Rewrite patchSession to return toast + configUpdate**

Replace the existing `patchSession` function:

```typescript
async function patchSession(
  sessionKey: string,
  params: Record<string, unknown>,
  successMsg: string,
  errorMsg: string,
): Promise<SlashCommandResult> {
  try {
    const res = await fetch("/api/chat/sessions/patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey, ...params }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return {
        content: "",
        toastMessage: (d as { error?: string }).error ?? errorMsg,
        toastType: "error",
      };
    }
    return {
      content: "",
      action: "refresh",
      toastMessage: successMsg,
      toastType: "success",
      configUpdate: params,
    };
  } catch {
    return { content: "", toastMessage: errorMsg, toastType: "error" };
  }
}
```

Note: the signature now takes `successMsg` as 3rd arg and `errorMsg` as 4th.

- [ ] **Step 3.3: Update all patchSession callers**

Update each caller to pass both success and error messages:

```typescript
// executeModel — set mode
return patchSession(
  sessionKey,
  { model: args.trim() },
  `Model: ${args.trim()}`,
  "Failed to set model",
);

// executeThink
return patchSession(
  sessionKey,
  { thinkingLevel: level },
  `Thinking: ${level}`,
  "Failed to set thinking level",
);

// executeFast — set mode
return patchSession(
  sessionKey,
  { fastMode: mode === "on" },
  `Fast mode: ${mode}`,
  "Failed to set fast mode",
);

// executeVerbose
return patchSession(
  sessionKey,
  { verboseLevel: level },
  `Verbose: ${level}`,
  "Failed to set verbose level",
);
```

- [ ] **Step 3.4: Fix executeFast status query**

Replace the current `executeFast` to fetch current value when no args / `status`:

```typescript
async function executeFast(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const mode = args.trim().toLowerCase();
  if (!mode || mode === "status") {
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) return { content: "Failed to get fast mode status" };
      const data = (await res.json()) as {
        sessions?: Array<{ key?: string; fastMode?: boolean }>;
      };
      const session = (data.sessions ?? []).find((s) => s.key === sessionKey);
      const current = session?.fastMode ? "on" : "off";
      return { content: `Fast mode: ${current}` };
    } catch {
      return { content: "Failed to get fast mode status" };
    }
  }
  if (mode !== "on" && mode !== "off") {
    return { content: `Invalid fast mode "${args.trim()}". Valid: status, on, off` };
  }
  return patchSession(
    sessionKey,
    { fastMode: mode === "on" },
    `Fast mode: ${mode}`,
    "Failed to set fast mode",
  );
}
```

- [ ] **Step 3.5: Add toast to executeCompact**

```typescript
async function executeCompact(sessionKey: string): Promise<SlashCommandResult> {
  try {
    const res = await fetch("/api/chat/compact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return {
        content: "",
        toastMessage: (d as { error?: string }).error ?? "Compaction failed",
        toastType: "error",
      };
    }
    return {
      content: "",
      action: "refresh",
      toastMessage: "Session compacted",
      toastType: "success",
    };
  } catch {
    return { content: "", toastMessage: "Compaction failed", toastType: "error" };
  }
}
```

- [ ] **Step 3.6: Add toast to executeKill**

```typescript
async function executeKill(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const target = args.trim();
  if (!target) return { content: "Usage: /kill <id|all>" };
  try {
    const res = await fetch("/api/chat/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey: target === "all" ? sessionKey : target }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return {
        content: "",
        toastMessage: (d as { error?: string }).error ?? "Failed to abort",
        toastType: "error",
      };
    }
    return { content: "", toastMessage: `Aborted: ${target}`, toastType: "success" };
  } catch {
    return { content: "", toastMessage: "Failed to abort", toastType: "error" };
  }
}
```

- [ ] **Step 3.7: Run type check**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Zero errors

- [ ] **Step 3.8: Commit**

```bash
scripts/committer "[enhanced] feat(chat): enhance slash command executor with toast feedback + configUpdate" \
  dashboard/src/components/panels/chat/slash-command-executor.ts
```

---

### Task 4: Fix MessageInput Action Handler [ui-wiring]

covers: command-feedback/spec.md > ADDED > Action commands show confirmation feedback > /new session created
covers: command-feedback/spec.md > ADDED > Action commands show confirmation feedback > /clear messages cleared
covers: command-feedback/spec.md > ADDED > Action commands show confirmation feedback > /stop abort failed
covers: command-feedback/spec.md > ADDED > Action commands show confirmation feedback > /export success
covers: chat-slash-commands/spec.md > MODIFIED > Slash commands execute corresponding actions > /stop respects abort result
covers: chat-slash-commands/spec.md > MODIFIED > Slash commands execute corresponding actions > /stop abort succeeds
covers: session-config-bar/spec.md > ADDED > Session config bar displays current session settings > Real-time update after slash command

**Files:**

- Modify: `dashboard/src/components/panels/chat/MessageInput.tsx:169-246`

- [ ] **Step 4.1: Import addToast**

Add at top of `MessageInput.tsx`:

```typescript
import { useNotificationsStore } from "@/stores/notifications";
```

- [ ] **Step 4.2: Rewrite handleAbort to return success/failure**

Replace `handleAbort` (lines 169-183) to return a boolean indicating success:

```typescript
const handleAbort = useCallback(async (): Promise<boolean> => {
  try {
    const res = await fetch("/api/chat/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey: activeSessionKey ?? undefined }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      useNotificationsStore
        .getState()
        .addToast("error", (d as { error?: string }).error ?? "Failed to stop", 3000);
      return false;
    }
    if (activeSessionKey) {
      useChatStore.getState().setSessionStreaming(activeSessionKey, false);
    }
    useNotificationsStore.getState().addToast("success", "Stopped", 3000);
    return true;
  } catch (err) {
    console.error("[abort] network error:", err);
    useNotificationsStore.getState().addToast("error", "Failed to stop", 3000);
    return false;
  }
}, [activeSessionKey]);
```

Key fix: `setSessionStreaming(false)` only runs on success.

- [ ] **Step 4.3: Rewrite handleSlashCommand with toast + optimistic update**

Replace the `handleSlashCommand` callback (lines 186-247):

```typescript
const handleSlashCommand = useCallback(
  async (cmd: SlashCommandDef, cmdArgs = "") => {
    setShowPalette(false);
    setInput("");

    const addSystemMsg = (text: string) => {
      if (activeSessionKey) {
        useChatStore.getState().addMessage(activeSessionKey, {
          id: `system-cmd-${Date.now()}`,
          role: "system",
          content: [{ type: "text" as const, text }],
          timestamp: Date.now(),
        });
      }
    };

    const toast = useNotificationsStore.getState().addToast;

    try {
      const result = await executeSlashCommand(activeSessionKey ?? "", cmd.name, cmdArgs);

      // ── Toast feedback (D4: executor returns toast, caller dispatches) ──
      if (result.toastMessage) {
        toast(result.toastType ?? "info", result.toastMessage, 3000);
      }

      // ── Optimistic config update (D1: write store immediately) ──
      if (result.configUpdate && activeSessionKey) {
        const { updateSessionMeta } = useChatStore.getState();
        // updateSessionMeta is in the chatStoreAPI bridge — direct call on store
        useChatStore.setState((s) => {
          const idx = s.sessionMetas.findIndex((m) => m.key === activeSessionKey);
          if (idx < 0) return {};
          const metas = [...s.sessionMetas];
          metas[idx] = { ...metas[idx], ...result.configUpdate };
          return { sessionMetas: metas, sessionMeta: metas };
        });
      }

      // ── Handle side-effect actions ──
      const action = result.action;
      if (action === "new-session" || action === "reset") {
        const agentId = activeAgentId || "main";
        const res = await fetch("/api/chat/sessions/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          toast("error", (d as { error?: string }).error ?? `/${cmd.name} failed`, 3000);
          return;
        }
        const data = (await res.json()) as { key?: string };
        if (data.key) {
          useChatStore.getState().setActiveSession(data.key);
        }
        toast("success", "New session created", 3000);
      } else if (action === "stop") {
        void handleAbort();
      } else if (action === "clear") {
        if (activeSessionKey) {
          useChatStore.getState().setMessages(activeSessionKey, []);
        }
        toast("info", "Messages cleared", 3000);
      } else if (action === "export") {
        if (activeSessionKey) {
          try {
            exportSessionAsMarkdown(activeSessionKey);
            toast("success", "Session exported", 3000);
          } catch {
            toast("error", "Export failed", 3000);
          }
        }
      }
      // "refresh": no-op — SSE events will push updated state (D1 optimistic update above handles immediate feedback)

      // Display command output as system message (query commands: /help, /usage, /agents, /model no-args)
      if (result.content) {
        addSystemMsg(result.content);
      }
    } catch (err) {
      console.error(`[/${cmd.name}]`, err);
      useNotificationsStore
        .getState()
        .addToast(
          "error",
          `/${cmd.name}: ${err instanceof Error ? err.message : "Command failed"}`,
          3000,
        );
    }
  },
  [activeSessionKey, activeAgentId, handleAbort],
);
```

- [ ] **Step 4.4: Run type check**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Zero errors

- [ ] **Step 4.5: Commit**

```bash
scripts/committer "[enhanced] fix(chat): add toast feedback + optimistic update + fix /stop abort handling" \
  dashboard/src/components/panels/chat/MessageInput.tsx
```

---

### Task 5: Create SessionConfigBar Component [ui-component]

covers: session-config-bar/spec.md > ADDED > Session config bar displays current session settings > Display all config fields
covers: session-config-bar/spec.md > ADDED > Session config bar displays current session settings > Fields with default/unset values
covers: session-config-bar/spec.md > ADDED > Config bar respects theme and i18n > Dark mode rendering
covers: session-config-bar/spec.md > ADDED > Config bar respects theme and i18n > i18n labels

**Files:**

- Create: `dashboard/src/components/panels/chat/SessionConfigBar.tsx`

- [ ] **Step 5.1: Create SessionConfigBar component**

```typescript
"use client";

import { Brain, Cpu, Terminal, Zap } from "lucide-react";
import { useTranslations } from "next-intl";
import { useChatStore } from "@/stores/chat";
import { useActiveSessionKey } from "@/stores/chat-hooks";

export function SessionConfigBar() {
  const t = useTranslations("chat");
  const activeSessionKey = useActiveSessionKey();
  const sessionMetas = useChatStore((s) => s.sessionMetas);
  const meta = sessionMetas.find((m) => m.key === activeSessionKey);

  if (!activeSessionKey || !meta) return null;

  const model = meta.model ?? "default";
  const items: Array<{ icon: React.ReactNode; label: string; value: string }> = [];

  items.push({
    icon: <Cpu size={10} className="text-[var(--muted-foreground)]" />,
    label: t("configModel"),
    value: model,
  });

  if (meta.thinkingLevel) {
    items.push({
      icon: <Brain size={10} className="text-[var(--muted-foreground)]" />,
      label: t("configThinking"),
      value: meta.thinkingLevel,
    });
  }

  if (meta.fastMode !== undefined) {
    items.push({
      icon: <Zap size={10} className="text-[var(--muted-foreground)]" />,
      label: t("configFast"),
      value: meta.fastMode ? "on" : "off",
    });
  }

  if (meta.verboseLevel) {
    items.push({
      icon: <Terminal size={10} className="text-[var(--muted-foreground)]" />,
      label: t("configVerbose"),
      value: meta.verboseLevel,
    });
  }

  return (
    <div className="flex items-center gap-3 px-3 py-1 text-[10px] font-mono text-[var(--muted-foreground)] border-t border-[var(--border-subtle)]">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {item.icon}
          <span>{item.label}</span>
          <span className="text-[var(--primary)]">{item.value}</span>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 5.2: Mount SessionConfigBar in ChatPanel**

In `dashboard/src/components/panels/chat/ChatPanel.tsx`, add the import and render it between `ToolProgressBar` and `MessageInput`:

Add import:

```typescript
import { SessionConfigBar } from "./SessionConfigBar";
```

In the JSX, between `<ToolProgressBar />` and `<MessageInput />`:

```tsx
          <ToolProgressBar />
          <SessionConfigBar />
          <MessageInput />
```

- [ ] **Step 5.3: Run type check**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Zero errors

- [ ] **Step 5.4: Commit**

```bash
scripts/committer "[enhanced] feat(chat): add SessionConfigBar showing model/thinking/fast/verbose" \
  dashboard/src/components/panels/chat/SessionConfigBar.tsx \
  dashboard/src/components/panels/chat/ChatPanel.tsx
```

---

### Task 6: Add i18n Keys [i18n]

covers: session-config-bar/spec.md > ADDED > Config bar respects theme and i18n > i18n labels

**Files:**

- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 6.1: Add Chinese i18n keys**

In `dashboard/src/i18n/zh.json`, within the `chat` namespace, add these keys (after the existing `cmd_kill` line, before the next section):

```json
    "configModel": "模型",
    "configThinking": "思考",
    "configFast": "快速",
    "configVerbose": "详细",
```

- [ ] **Step 6.2: Add English i18n keys**

In `dashboard/src/i18n/en.json`, within the `chat` namespace, add corresponding keys:

```json
    "configModel": "Model",
    "configThinking": "Thinking",
    "configFast": "Fast",
    "configVerbose": "Verbose",
```

- [ ] **Step 6.3: Run type check**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Zero errors

- [ ] **Step 6.4: Commit**

```bash
scripts/committer "[enhanced] feat(chat): add i18n keys for SessionConfigBar" \
  dashboard/src/i18n/zh.json \
  dashboard/src/i18n/en.json
```

---

### Task 7: Final Verification [verification]

**Files:** (none — verification only)

- [ ] **Step 7.1: Type check**

Run: `cd dashboard && npx tsc --noEmit --pretty`
Expected: Zero errors

- [ ] **Step 7.2: Lint check**

Run: `cd dashboard && npx oxlint . 2>&1 | tail -5`
Expected: No new errors

- [ ] **Step 7.3: Verify /focus removed**

Run: `grep -r "focus" dashboard/src/components/panels/chat/slash-commands.ts`
Expected: No output (focus entry fully removed)

- [ ] **Step 7.4: Verify toast wiring**

Run: `grep -c "toastMessage" dashboard/src/components/panels/chat/slash-command-executor.ts`
Expected: At least 8 occurrences (success + error paths across functions)

- [ ] **Step 7.5: Verify SessionConfigBar import**

Run: `grep "SessionConfigBar" dashboard/src/components/panels/chat/ChatPanel.tsx`
Expected: Import line and JSX usage both present

---

## Requirement Coverage Matrix

| Spec Requirement                                           | Task                       |
| ---------------------------------------------------------- | -------------------------- |
| session-config-bar > Display all config fields             | Task 5                     |
| session-config-bar > Fields with default/unset values      | Task 5                     |
| session-config-bar > Real-time update after slash command  | Task 4 (optimistic update) |
| session-config-bar > Real-time update via SSE              | Task 1 (SSE sync)          |
| session-config-bar > SessionMeta type completeness         | Task 1                     |
| session-config-bar > sessions.list populates config fields | Task 1                     |
| session-config-bar > Dark mode rendering                   | Task 5                     |
| session-config-bar > i18n labels                           | Task 6                     |
| command-feedback > /fast on success toast                  | Task 3                     |
| command-feedback > /model switch success toast             | Task 3                     |
| command-feedback > /think level success toast              | Task 3                     |
| command-feedback > /compact success toast                  | Task 3                     |
| command-feedback > API returns non-200                     | Task 3                     |
| command-feedback > Network error                           | Task 3                     |
| command-feedback > /new session created                    | Task 4                     |
| command-feedback > /clear messages cleared                 | Task 4                     |
| command-feedback > /stop abort failed                      | Task 4                     |
| command-feedback > /export success                         | Task 4                     |
| chat-slash-commands > /focus removed from registry         | Task 2                     |
| chat-slash-commands > /stop respects abort result          | Task 4                     |
| chat-slash-commands > /stop abort succeeds                 | Task 4                     |
| chat-slash-commands > patchSession optimistic store update | Task 3 + Task 4            |
| chat-slash-commands > /fast status shows current value     | Task 3                     |
| chat-slash-commands > REMOVED /focus toggles focus mode    | Task 2                     |
