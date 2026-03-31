# Deck Chat UX Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the Chat panel with slash commands, input history, token usage display, and compaction visualization — aligning with the official Control UI's chat features.

**Architecture:** Four independent features integrated into existing Chat components. Two new API routes (`/api/chat/compact`, `/api/chat/sessions/patch`) proxy Gateway RPCs. Slash command system uses a registry pattern (mirroring official `slash-commands.ts`). Input history uses a sessionStorage-backed ring buffer. Token display leverages existing `RunMetadata.usage` and `SessionMeta.totalTokens`. Compaction detection hooks into existing `session-state` SSE events.

**Tech Stack:** React 19 + Next.js 15, Zustand stores, next-intl i18n, Tailwind CSS with shadcn design tokens

**Skill Dependencies:** frontend-design (design token compliance), validate (tsc + lint)

---

## File Structure

| File                                                             | Role                                               | Action |
| ---------------------------------------------------------------- | -------------------------------------------------- | ------ |
| `dashboard/src/app/api/chat/compact/route.ts`                    | API: sessions.compact proxy                        | CREATE |
| `dashboard/src/app/api/chat/sessions/patch/route.ts`             | API: sessions.patch proxy                          | CREATE |
| `dashboard/src/components/panels/chat/slash-commands.ts`         | Slash command registry + parser + filter           | CREATE |
| `dashboard/src/components/panels/chat/SlashCommandPalette.tsx`   | Popover UI for command selection                   | CREATE |
| `dashboard/src/components/panels/chat/slash-command-executor.ts` | Command execution (API calls + actions)            | CREATE |
| `dashboard/src/components/panels/chat/useInputHistory.ts`        | Input history hook (ring buffer + sessionStorage)  | CREATE |
| `dashboard/src/components/panels/chat/CompactionNotice.tsx`      | System notification card for compaction            | CREATE |
| `dashboard/src/components/panels/chat/export-session.ts`         | Session markdown export utility                    | CREATE |
| `dashboard/src/components/panels/chat/MessageInput.tsx`          | Integrate slash commands + input history           | MODIFY |
| `dashboard/src/components/panels/chat/MessageList.tsx`           | Integrate compaction notice                        | MODIFY |
| `dashboard/src/components/panels/chat/RunStatusBar.tsx`          | Add session-level token/cost display               | MODIFY |
| `dashboard/src/stores/chat-dispatchers.ts`                       | Add compaction event detection + session meta sync | MODIFY |
| `dashboard/src/i18n/zh.json`                                     | Add ~50 new i18n keys                              | MODIFY |
| `dashboard/src/i18n/en.json`                                     | Add ~50 new i18n keys                              | MODIFY |

---

### Task 1: API Routes [backend-proxy]

covers: chat-slash-commands/spec.md > ADDED > Slash commands execute corresponding actions > /stop aborts run
covers: chat-slash-commands/spec.md > ADDED > Slash commands execute corresponding actions > /model switches model

**Files:**

- Create: `dashboard/src/app/api/chat/compact/route.ts`
- Create: `dashboard/src/app/api/chat/sessions/patch/route.ts`

- [ ] **Step 1.1: Create compact API route**

```typescript
// dashboard/src/app/api/chat/compact/route.ts
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as { sessionKey?: string };
  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }
  return gatewayRequest("sessions.compact", { key: body.sessionKey });
});
```

- [ ] **Step 1.2: Create sessions patch API route**

```typescript
// dashboard/src/app/api/chat/sessions/patch/route.ts
import { NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    sessionKey?: string;
    model?: string;
    thinkingLevel?: string;
    fastMode?: boolean;
    verboseLevel?: string;
  };
  if (!body.sessionKey?.trim()) {
    return Response.json({ error: "sessionKey is required" }, { status: 400 });
  }
  const { sessionKey, ...params } = body;
  return gatewayRequest("sessions.patch", { key: sessionKey, ...params });
});
```

- [ ] **Step 1.3: Verify routes compile**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in new files

- [ ] **Step 1.4: Commit**

```bash
scripts/committer "[enhanced] feat(chat): add compact and sessions.patch API routes" \
  dashboard/src/app/api/chat/compact/route.ts \
  dashboard/src/app/api/chat/sessions/patch/route.ts
```

---

### Task 2: Slash Command Registry + Parser [frontend]

covers: chat-slash-commands/spec.md > ADDED > Slash command palette appears on / input > Trigger command palette
covers: chat-slash-commands/spec.md > ADDED > Slash command palette appears on / input > Filter commands by typing

**Files:**

- Create: `dashboard/src/components/panels/chat/slash-commands.ts`

- [ ] **Step 2.1: Create command registry**

Mirror the official `ui/src/ui/chat/slash-commands.ts` structure. Use `SlashCommandDef` type with name, description, icon (lucide name string), category, executeLocal flag. Register 15 commands across 4 categories (session/model/tools/agents).

```typescript
// dashboard/src/components/panels/chat/slash-commands.ts
export type SlashCommandCategory = "session" | "model" | "tools" | "agents";

export interface SlashCommandDef {
  name: string;
  description: string; // i18n key under "chat.cmd_{name}"
  args?: string;
  icon: string; // lucide icon name
  category: SlashCommandCategory;
  executeLocal: boolean;
  argOptions?: string[];
}

export const SLASH_COMMANDS: SlashCommandDef[] = [
  // Session
  { name: "new", description: "cmd_new", icon: "plus", category: "session", executeLocal: true },
  {
    name: "reset",
    description: "cmd_reset",
    icon: "refresh-cw",
    category: "session",
    executeLocal: true,
  },
  {
    name: "compact",
    description: "cmd_compact",
    icon: "minimize-2",
    category: "session",
    executeLocal: true,
  },
  {
    name: "stop",
    description: "cmd_stop",
    icon: "square",
    category: "session",
    executeLocal: true,
  },
  {
    name: "clear",
    description: "cmd_clear",
    icon: "trash-2",
    category: "session",
    executeLocal: true,
  },
  { name: "focus", description: "cmd_focus", icon: "eye", category: "session", executeLocal: true },
  // Model
  {
    name: "model",
    description: "cmd_model",
    args: "<name>",
    icon: "cpu",
    category: "model",
    executeLocal: true,
  },
  {
    name: "think",
    description: "cmd_think",
    args: "<level>",
    icon: "brain",
    category: "model",
    executeLocal: true,
    argOptions: ["off", "low", "medium", "high"],
  },
  {
    name: "verbose",
    description: "cmd_verbose",
    args: "<on|off|full>",
    icon: "terminal",
    category: "model",
    executeLocal: true,
    argOptions: ["on", "off", "full"],
  },
  {
    name: "fast",
    description: "cmd_fast",
    args: "<status|on|off>",
    icon: "zap",
    category: "model",
    executeLocal: true,
    argOptions: ["status", "on", "off"],
  },
  // Tools
  {
    name: "help",
    description: "cmd_help",
    icon: "book-open",
    category: "tools",
    executeLocal: true,
  },
  {
    name: "export",
    description: "cmd_export",
    icon: "download",
    category: "tools",
    executeLocal: true,
  },
  {
    name: "usage",
    description: "cmd_usage",
    icon: "bar-chart-2",
    category: "tools",
    executeLocal: true,
  },
  // Agents
  {
    name: "agents",
    description: "cmd_agents",
    icon: "monitor",
    category: "agents",
    executeLocal: true,
  },
  {
    name: "kill",
    description: "cmd_kill",
    args: "<id|all>",
    icon: "x",
    category: "agents",
    executeLocal: true,
  },
];

const CATEGORY_ORDER: SlashCommandCategory[] = ["session", "model", "tools", "agents"];

export const CATEGORY_LABELS: Record<SlashCommandCategory, string> = {
  session: "cmdCatSession",
  model: "cmdCatModel",
  agents: "cmdCatAgents",
  tools: "cmdCatTools",
};

export function getSlashCommandCompletions(filter: string): SlashCommandDef[] {
  const lower = filter.toLowerCase();
  const commands = lower
    ? SLASH_COMMANDS.filter(
        (cmd) => cmd.name.startsWith(lower) || cmd.description.toLowerCase().includes(lower),
      )
    : SLASH_COMMANDS;
  return commands.toSorted((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    if (ai !== bi) return ai - bi;
    if (lower) {
      const aExact = a.name.startsWith(lower) ? 0 : 1;
      const bExact = b.name.startsWith(lower) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
    }
    return 0;
  });
}

export interface ParsedSlashCommand {
  command: SlashCommandDef;
  args: string;
}

export function parseSlashCommand(text: string): ParsedSlashCommand | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const body = trimmed.slice(1);
  const firstSep = body.search(/[\s:]/u);
  const name = firstSep === -1 ? body : body.slice(0, firstSep);
  let remainder = firstSep === -1 ? "" : body.slice(firstSep).trimStart();
  if (remainder.startsWith(":")) remainder = remainder.slice(1).trimStart();
  if (!name) return null;
  const command = SLASH_COMMANDS.find((cmd) => cmd.name === name.toLowerCase());
  if (!command) return null;
  return { command, args: remainder.trim() };
}
```

- [ ] **Step 2.2: Verify type correctness**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | grep "slash-commands" | head -5`
Expected: No errors

---

### Task 3: Slash Command Executor [frontend]

covers: chat-slash-commands/spec.md > ADDED > Slash commands execute corresponding actions > /new creates session
covers: chat-slash-commands/spec.md > ADDED > Slash commands execute corresponding actions > /stop aborts run
covers: chat-slash-commands/spec.md > ADDED > Slash commands execute corresponding actions > /model switches model
covers: chat-slash-commands/spec.md > ADDED > Slash commands execute corresponding actions > /export exports session

**Files:**

- Create: `dashboard/src/components/panels/chat/slash-command-executor.ts`

- [ ] **Step 3.1: Create executor with action type**

```typescript
// dashboard/src/components/panels/chat/slash-command-executor.ts
import { formatTokenCount } from "@/lib/format-utils";
import type { SlashCommandDef } from "./slash-commands";
import { SLASH_COMMANDS } from "./slash-commands";

export type SlashCommandAction =
  | "new-session"
  | "reset"
  | "stop"
  | "clear"
  | "toggle-focus"
  | "export"
  | "refresh";

export interface SlashCommandResult {
  content: string;
  action?: SlashCommandAction;
}

export async function executeSlashCommand(
  sessionKey: string,
  commandName: string,
  args: string,
): Promise<SlashCommandResult> {
  switch (commandName) {
    case "help":
      return executeHelp();
    case "new":
      return { content: "", action: "new-session" };
    case "reset":
      return { content: "", action: "reset" };
    case "stop":
      return { content: "", action: "stop" };
    case "clear":
      return { content: "", action: "clear" };
    case "focus":
      return { content: "", action: "toggle-focus" };
    case "export":
      return { content: "", action: "export" };
    case "compact":
      return executeCompact(sessionKey);
    case "model":
      return executeModel(sessionKey, args);
    case "think":
      return executeThink(sessionKey, args);
    case "fast":
      return executeFast(sessionKey, args);
    case "verbose":
      return executeVerbose(sessionKey, args);
    case "usage":
      return executeUsage(sessionKey);
    case "agents":
      return executeAgents();
    case "kill":
      return executeKill(sessionKey, args);
    default:
      return { content: `Unknown command: /${commandName}` };
  }
}

function executeHelp(): SlashCommandResult {
  const lines = SLASH_COMMANDS.map((cmd) => `/${cmd.name}${cmd.args ? ` ${cmd.args}` : ""}`);
  return { content: lines.join("\n") };
}

async function executeCompact(sessionKey: string): Promise<SlashCommandResult> {
  try {
    const res = await fetch("/api/chat/compact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { content: (d as { error?: string }).error ?? "Compaction failed" };
    }
    return { content: "", action: "refresh" };
  } catch {
    return { content: "Compaction failed" };
  }
}

async function executeModel(sessionKey: string, args: string): Promise<SlashCommandResult> {
  if (!args) {
    // Fetch current model + available models list (mirrors official executor)
    try {
      const [sessRes, modelsRes] = await Promise.all([
        fetch("/api/sessions"),
        fetch("/api/models"),
      ]);
      const sessData = (await sessRes.json()) as {
        sessions?: Array<{ key?: string; model?: string }>;
      };
      const modelsData = (await modelsRes.json()) as { models?: Array<{ id: string }> };
      const session = (sessData.sessions ?? []).find((s) => s.key === sessionKey);
      const model = session?.model ?? "default";
      const available = (modelsData.models ?? []).map((m) => m.id);
      const lines = [`Current model: ${model}`];
      if (available.length > 0) {
        lines.push(
          `Available: ${available.slice(0, 10).join(", ")}${available.length > 10 ? ` +${available.length - 10} more` : ""}`,
        );
      }
      return { content: lines.join("\n") };
    } catch {
      return { content: "Failed to get model info" };
    }
  }
  try {
    const res = await fetch("/api/chat/sessions/patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey, model: args.trim() }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { content: (d as { error?: string }).error ?? "Failed to set model" };
    }
    return { content: "", action: "refresh" };
  } catch {
    return { content: "Failed to set model" };
  }
}

async function executeThink(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const level = args.trim().toLowerCase();
  if (!level) return { content: "Usage: /think <off|low|medium|high>" };
  if (!["off", "low", "medium", "high"].includes(level)) {
    return { content: `Invalid thinking level "${args.trim()}". Valid: off, low, medium, high` };
  }
  try {
    const res = await fetch("/api/chat/sessions/patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey, thinkingLevel: level }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { content: (d as { error?: string }).error ?? "Failed to set thinking level" };
    }
    return { content: "", action: "refresh" };
  } catch {
    return { content: "Failed to set thinking level" };
  }
}

async function executeFast(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const mode = args.trim().toLowerCase();
  if (!mode || mode === "status") return { content: "", action: "refresh" };
  if (mode !== "on" && mode !== "off") {
    return { content: `Invalid fast mode "${args.trim()}". Valid: status, on, off` };
  }
  try {
    const res = await fetch("/api/chat/sessions/patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey, fastMode: mode === "on" }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { content: (d as { error?: string }).error ?? "Failed to set fast mode" };
    }
    return { content: "", action: "refresh" };
  } catch {
    return { content: "Failed to set fast mode" };
  }
}

async function executeVerbose(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const level = args.trim().toLowerCase();
  if (!level) return { content: "Usage: /verbose <on|off|full>" };
  if (!["on", "off", "full"].includes(level)) {
    return { content: `Invalid verbose level "${args.trim()}". Valid: on, off, full` };
  }
  try {
    const res = await fetch("/api/chat/sessions/patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey, verboseLevel: level }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { content: (d as { error?: string }).error ?? "Failed to set verbose level" };
    }
    return { content: "", action: "refresh" };
  } catch {
    return { content: "Failed to set verbose level" };
  }
}

async function executeUsage(sessionKey: string): Promise<SlashCommandResult> {
  try {
    const res = await fetch("/api/sessions");
    if (!res.ok) return { content: "Failed to get usage" };
    const data = (await res.json()) as {
      sessions?: Array<{
        key?: string;
        totalTokens?: number;
        inputTokens?: number;
        outputTokens?: number;
        contextTokens?: number;
        model?: string;
        estimatedCostUsd?: number;
      }>;
    };
    const sessions = data.sessions ?? (Array.isArray(data) ? data : []);
    const session = (sessions as Array<{ key?: string }>).find((s) => s.key === sessionKey) as
      | (typeof sessions)[number]
      | undefined;
    if (!session) return { content: "No active session." };

    const input = session.inputTokens ?? 0;
    const output = session.outputTokens ?? 0;
    const total = session.totalTokens ?? input + output;
    const lines = [
      `Input: ${formatTokenCount(input)} tokens`,
      `Output: ${formatTokenCount(output)} tokens`,
      `Total: ${formatTokenCount(total)} tokens`,
    ];
    if (session.model) lines.push(`Model: ${session.model}`);
    if (session.estimatedCostUsd != null)
      lines.push(`Cost: $${session.estimatedCostUsd.toFixed(4)}`);
    return { content: lines.join("\n") };
  } catch {
    return { content: "Failed to get usage" };
  }
}

async function executeAgents(): Promise<SlashCommandResult> {
  try {
    // Use agents.list via the generic gateway proxy (not deck.agents action route)
    const res = await fetch("/api/gateway", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "agents.list", params: {} }),
    });
    if (!res.ok) return { content: "Failed to list agents" };
    const data = (await res.json()) as {
      agents?: Array<{ id: string; name?: string; identity?: { name?: string } }>;
      defaultId?: string;
    };
    const agents = data.agents ?? [];
    if (agents.length === 0) return { content: "No agents configured." };
    const lines = agents.map((a) => {
      const isDefault = a.id === data.defaultId;
      const name = a.identity?.name ?? a.name ?? a.id;
      return `${name}${isDefault ? " (default)" : ""}`;
    });
    return { content: lines.join("\n") };
  } catch {
    return { content: "Failed to list agents" };
  }
}

async function executeKill(sessionKey: string, args: string): Promise<SlashCommandResult> {
  const target = args.trim();
  if (!target) return { content: "Usage: /kill <id|all>" };
  // Abort the target session(s) via the existing abort endpoint
  try {
    const res = await fetch("/api/chat/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey: target === "all" ? sessionKey : target }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return { content: (d as { error?: string }).error ?? "Failed to abort" };
    }
    return { content: "" };
  } catch {
    return { content: "Failed to abort" };
  }
}
```

- [ ] **Step 3.2: Verify type correctness**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | grep "slash-command-executor" | head -5`
Expected: No errors

---

### Task 4: SlashCommandPalette Component [frontend]

covers: chat-slash-commands/spec.md > ADDED > Slash command palette appears on / input > Trigger command palette
covers: chat-slash-commands/spec.md > ADDED > Slash command palette appears on / input > Filter commands by typing
covers: chat-slash-commands/spec.md > ADDED > Slash command palette appears on / input > Select command with keyboard
covers: chat-slash-commands/spec.md > ADDED > Slash command palette appears on / input > Dismiss palette

**Files:**

- Create: `dashboard/src/components/panels/chat/SlashCommandPalette.tsx`

- [ ] **Step 4.1: Create palette component**

Popover-style dropdown above input. Features:

- Filtered command list with category grouping
- Keyboard navigation (ArrowUp/Down to select, Enter to execute, Escape to close)
- Each command shows lucide icon + name + description
- Highlight matching text in command name
- Position anchored above the input area

```typescript
// dashboard/src/components/panels/chat/SlashCommandPalette.tsx
"use client";

import * as icons from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { getSlashCommandCompletions, CATEGORY_LABELS } from "./slash-commands";
import type { SlashCommandDef, SlashCommandCategory } from "./slash-commands";

interface SlashCommandPaletteProps {
  filter: string;
  onSelect: (command: SlashCommandDef) => void;
  onDismiss: () => void;
  /** Called from parent's handleKeyDown — palette handles ArrowUp/Down/Enter/Escape.
   *  Returns true if the event was consumed (parent should not process further). */
  onKeyDown?: (e: React.KeyboardEvent) => boolean;
}

function CommandIcon({ name, size = 14 }: { name: string; size?: number }) {
  // Map kebab-case icon name to PascalCase lucide component
  const pascal = name
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const Icon = (icons as Record<string, React.ComponentType<{ size?: number }>>)[pascal];
  if (!Icon) return null;
  return <Icon size={size} />;
}

export function SlashCommandPalette({ filter, onSelect, onDismiss }: SlashCommandPaletteProps) {
  const t = useTranslations("chat");
  const commands = getSlashCommandCompletions(filter);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Expose keyboard handler via ref callback — called by parent MessageInput
  // instead of using global window listener (avoids event priority conflicts)
  // Parent calls: if (paletteRef.current?.handleKeyDown(e)) return;
  useImperativeHandle — OR simpler: expose via onKeyDown prop callback registered on mount.

  // Alternative: Parent's handleKeyDown checks showPalette and delegates:
  // if (showPalette) { handlePaletteKey(e); return; }
  // This avoids the global listener entirely.

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (commands.length === 0) return null;

  // Group by category
  let currentCategory: SlashCommandCategory | null = null;
  let globalIndex = -1;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-lg z-50"
    >
      {commands.map((cmd) => {
        globalIndex++;
        const idx = globalIndex;
        const showCategory = cmd.category !== currentCategory;
        if (showCategory) currentCategory = cmd.category;

        return (
          <div key={cmd.name}>
            {showCategory && (
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {t(CATEGORY_LABELS[cmd.category])}
              </div>
            )}
            <div
              data-index={idx}
              role="option"
              aria-selected={idx === selectedIndex}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors",
                idx === selectedIndex
                  ? "bg-[var(--accent)] text-[var(--foreground)]"
                  : "text-[var(--foreground)] hover:bg-[var(--accent)]",
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(cmd);
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <span className="text-[var(--muted-foreground)] shrink-0">
                <CommandIcon name={cmd.icon} />
              </span>
              <span className="font-mono text-[var(--primary)]">/{cmd.name}</span>
              {cmd.args && (
                <span className="text-[var(--muted-foreground)]">{cmd.args}</span>
              )}
              <span className="ml-auto text-[10px] text-[var(--muted-foreground)] truncate max-w-[200px]">
                {t(cmd.description)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4.2: Verify type correctness**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | grep "SlashCommandPalette" | head -5`
Expected: No errors

---

### Task 5: Input History Hook [frontend]

covers: chat-input-history/spec.md > ADDED > Input history supports ArrowUp/Down navigation > Navigate to previous input
covers: chat-input-history/spec.md > ADDED > Input history supports ArrowUp/Down navigation > Navigate back to current input
covers: chat-input-history/spec.md > ADDED > Input history supports ArrowUp/Down navigation > Send message adds to history
covers: chat-input-history/spec.md > ADDED > Input history persists across page refresh > Refresh preserves history
covers: chat-input-history/spec.md > ADDED > Input history persists across page refresh > Tab close clears history
covers: chat-input-history/spec.md > ADDED > Input history has 50 item limit > History overflow

**Files:**

- Create: `dashboard/src/components/panels/chat/useInputHistory.ts`

- [ ] **Step 5.1: Create input history hook**

Mirror official `InputHistory` class logic, adapted as a React hook with sessionStorage persistence.

```typescript
// dashboard/src/components/panels/chat/useInputHistory.ts
import { useCallback, useRef } from "react";

const MAX_HISTORY = 50;
const STORAGE_KEY = "deck-chat-input-history";

function loadFromStorage(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: string[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // sessionStorage quota exceeded — silently ignore
  }
}

export function useInputHistory() {
  const itemsRef = useRef<string[]>(loadFromStorage());
  const cursorRef = useRef(-1);
  // Store the in-progress text when user starts navigating
  const draftRef = useRef<string>("");

  const push = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const items = itemsRef.current;
    // Dedup: skip if identical to last entry
    if (items[items.length - 1] === trimmed) {
      cursorRef.current = -1;
      return;
    }
    items.push(trimmed);
    if (items.length > MAX_HISTORY) items.shift();
    cursorRef.current = -1;
    saveToStorage(items);
  }, []);

  const up = useCallback((currentText: string): string | null => {
    const items = itemsRef.current;
    if (items.length === 0) return null;
    if (cursorRef.current < 0) {
      // First up press — save current draft
      draftRef.current = currentText;
      cursorRef.current = items.length - 1;
    } else if (cursorRef.current > 0) {
      cursorRef.current--;
    }
    return items[cursorRef.current] ?? null;
  }, []);

  const down = useCallback((): string | null => {
    if (cursorRef.current < 0) return null;
    cursorRef.current++;
    const items = itemsRef.current;
    if (cursorRef.current >= items.length) {
      cursorRef.current = -1;
      return draftRef.current; // Restore draft
    }
    return items[cursorRef.current] ?? null;
  }, []);

  const reset = useCallback(() => {
    cursorRef.current = -1;
  }, []);

  return { push, up, down, reset };
}
```

---

### Task 6: Integrate Slash Commands + Input History into MessageInput [frontend]

covers: chat-slash-commands/spec.md > ADDED > Slash command palette appears on / input > Trigger command palette
covers: chat-slash-commands/spec.md > ADDED > Slash command palette appears on / input > Dismiss palette

**Files:**

- Modify: `dashboard/src/components/panels/chat/MessageInput.tsx`

- [ ] **Step 6.1: Add slash command state and palette rendering**

In MessageInput, add:

- `showPalette` state (boolean) + `slashFilter` state (string)
- When input starts with `/`, extract filter text and show palette
- On command select: execute via `executeSlashCommand()`, handle action result
- Import SlashCommandPalette, useInputHistory, executeSlashCommand, parseSlashCommand

Key integration points in the existing MessageInput:

1. After `const [input, setInput] = useState("")` — add palette state + history hook
2. In `handleKeyDown` — add ArrowUp/Down for history, detect `/` for palette
3. In `sendMessage` — add `history.push(text)` before clearing input
4. In the JSX render — add `<SlashCommandPalette>` above the textarea (inside relative container)
5. In `setInput` change handler — check if starts with `/` to show palette

- [ ] **Step 6.2: Implement the slash command action handler**

After `executeSlashCommand` returns a result:

- `"new-session"` → create new session via `/api/chat/sessions/create`, then `useChatStore.getState().setActiveSession(newKey)`
- `"reset"` → create new session (same as /new — fresh start for current agent)
- `"stop"` → call existing `handleAbort()`
- `"clear"` → clear messages from chat store for current session key
- `"export"` → call `exportSessionAsMarkdown()` from new `export-session.ts` utility (reads messages from chat store, formats as markdown, triggers blob download)
- `"toggle-focus"` → toggle focus mode UI state
- `"refresh"` → no-op (SSE will update)
- If `result.content` is non-empty → insert as system message in chat

**New file needed: `export-session.ts`** — reads messages from the chat store for the given sessionKey, formats each message as markdown (user/assistant/system roles), and triggers a file download via blob URL.

- [ ] **Step 6.3: Implement input history keyboard integration with event priority**

In `handleKeyDown`, use strict priority chain:

1. **If slash palette is open** → ArrowUp/Down/Enter/Escape handled by palette (return early, do NOT propagate to history or textarea)
2. **If palette is closed** → ArrowUp when input is empty or cursor at first line → `history.up(input)` → set input; ArrowDown → `history.down()` → set input (or restore draft)
3. **Enter (no shift)** → send message (existing behavior)
4. After sending message → `history.push(text)` + `history.reset()`

**Critical**: Remove the global `window.addEventListener("keydown")` from SlashCommandPalette. Instead, pipe keyboard events from MessageInput's `handleKeyDown` into the palette via callback props (`onKeyDown`). This avoids event ordering conflicts between global and element-level listeners.

- [ ] **Step 6.4: Verify palette shows/hides correctly**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Zero errors

- [ ] **Step 6.5: Commit slash commands + input history**

```bash
scripts/committer "[enhanced] feat(chat): add slash commands, input history, and command palette" \
  dashboard/src/components/panels/chat/slash-commands.ts \
  dashboard/src/components/panels/chat/slash-command-executor.ts \
  dashboard/src/components/panels/chat/SlashCommandPalette.tsx \
  dashboard/src/components/panels/chat/useInputHistory.ts \
  dashboard/src/components/panels/chat/MessageInput.tsx
```

---

### Task 7: Compaction Notice Component [frontend]

covers: chat-compaction-viz/spec.md > ADDED > Compaction event renders as system notification card > Display compaction notification
covers: chat-compaction-viz/spec.md > ADDED > Compaction event renders as system notification card > Show token reduction

**Files:**

- Create: `dashboard/src/components/panels/chat/CompactionNotice.tsx`

- [ ] **Step 7.1: Create compaction notice card**

```typescript
// dashboard/src/components/panels/chat/CompactionNotice.tsx
"use client";

import { Minimize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatTokenCount } from "@/lib/format-utils";

interface CompactionNoticeProps {
  tokensBefore?: number;
  tokensAfter?: number;
  timestamp: number;
}

export function CompactionNotice({ tokensBefore, tokensAfter, timestamp }: CompactionNoticeProps) {
  const t = useTranslations("chat");

  return (
    <div className="flex items-center gap-2 mx-auto my-2 px-3 py-1.5 rounded-full text-[11px] bg-[var(--warning-muted)] text-[var(--warning-muted-text)] max-w-fit">
      <Minimize2 size={12} className="shrink-0" />
      <span>{t("compacted")}</span>
      {tokensBefore != null && tokensAfter != null && (
        <span className="text-[var(--muted-foreground)]">
          {formatTokenCount(tokensBefore)} → {formatTokenCount(tokensAfter)}
        </span>
      )}
      <span className="text-[var(--text-tertiary)]">
        {new Date(timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}
```

---

### Task 8: Compaction Detection + MessageList Integration [frontend]

covers: chat-compaction-viz/spec.md > ADDED > Compaction event renders as system notification card > Display compaction notification
covers: chat-compaction-viz/spec.md > ADDED > Compaction event renders as system notification card > Compaction during disconnect

**Files:**

- Modify: `dashboard/src/stores/chat-dispatchers.ts`
- Modify: `dashboard/src/components/panels/chat/MessageList.tsx`

- [ ] **Step 8.1: Detect compaction in session-state events**

In `dispatchSessionStateEvent()` in chat-dispatchers.ts, add compaction detection:

- Check `payload.compacted === true` (confirmed: top-level field in sessions.changed payload, see `src/gateway/server-methods/sessions.ts:127`)
- When detected, insert a system message with id `compaction-{timestamp}` into the session's message list
- System message: `role: "system"`, content: `[{ type: "text", text: "compacted" }]`
- **Note**: The payload does NOT contain tokensBefore/tokensAfter — these are unavailable from the Gateway event. CompactionNotice should handle `tokensBefore/After` as optional and only show the reduction line when both are present.
- **Dedup strategy**: Before inserting, check if the last system message in the session is already a compaction notice within the last 5 seconds — skip if so (handles duplicate events).

- [ ] **Step 8.2: Also sync session meta fields from sessions.changed**

In `dispatchSessionStateEvent()`, additionally sync `totalTokens` and `estimatedCostUsd` from the payload into the chat store's sessionMetas (via `useChatStore.getState().updateSessionMeta(sessionKey, { totalTokens, estimatedCostUsd })`). This bridges the data gap for Task 9's session-level token display.

Add `updateSessionMeta` method to chat store if it doesn't exist: merges partial SessionMeta into the existing sessionMetas array entry.

- [ ] **Step 8.3: Render CompactionNotice in MessageList**

In MessageList's message rendering loop, check for system messages with compaction markers (id starts with `compaction-`) and render `<CompactionNotice>` instead of the normal message bubble.

- [ ] **Step 8.4: Verify compaction rendering**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Zero errors

- [ ] **Step 8.5: Commit compaction feature + session meta sync**

```bash
scripts/committer "[enhanced] feat(chat): add compaction notice, session meta sync from SSE events" \
  dashboard/src/components/panels/chat/CompactionNotice.tsx \
  dashboard/src/stores/chat-dispatchers.ts \
  dashboard/src/stores/chat.ts \
  dashboard/src/components/panels/chat/MessageList.tsx
```

---

### Task 9: Session-Level Token Display in RunStatusBar [frontend]

covers: chat-token-display/spec.md > ADDED > Session-level cumulative token display > Display session totals
covers: chat-token-display/spec.md > ADDED > Session-level cumulative token display > Update during streaming

**Files:**

- Modify: `dashboard/src/components/panels/chat/RunStatusBar.tsx`

- [ ] **Step 9.1: Add session-level cumulative display**

RunStatusBar already shows per-run token usage. Add session-level totals from chat store's sessionMetas (now populated by Task 8.2's SSE sync).

Read `totalTokens` and `estimatedCostUsd` from `useChatStore((s) => s.sessionMetas)` for the active session key. Render as a separate section:

- Session total tokens (formatted with `formatTokenCount`)
- Estimated cost (formatted as `$0.0000`)
- Only render when data is available (>0)
- Updates in real-time since SSE events continuously sync these fields

- [ ] **Step 9.2: Verify display**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Zero errors

- [ ] **Step 9.3: Commit token display enhancement**

```bash
scripts/committer "[enhanced] feat(chat): add session-level token and cost display" \
  dashboard/src/components/panels/chat/RunStatusBar.tsx
```

---

### Task 10: i18n Keys [frontend]

covers: All specs — i18n for all new UI strings

**Files:**

- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 10.1: Add all new i18n keys**

In the `chat` namespace, add:

```json
{
  "chat": {
    "cmd_new": "新建会话",
    "cmd_reset": "重置会话",
    "cmd_compact": "压缩上下文",
    "cmd_stop": "停止运行",
    "cmd_clear": "清空消息",
    "cmd_focus": "切换专注模式",
    "cmd_model": "查看/设置模型",
    "cmd_think": "设置思考级别",
    "cmd_verbose": "切换详细模式",
    "cmd_fast": "切换快速模式",
    "cmd_help": "显示可用命令",
    "cmd_export": "导出会话",
    "cmd_usage": "查看 Token 用量",
    "cmd_agents": "列出 Agent",
    "cmd_kill": "中止子 Agent",
    "cmdCatSession": "会话",
    "cmdCatModel": "模型",
    "cmdCatTools": "工具",
    "cmdCatAgents": "Agent",
    "compacted": "上下文已压缩",
    "sessionTokens": "会话累计",
    "sessionCost": "预估费用"
  }
}
```

And corresponding English keys in `en.json`.

- [ ] **Step 10.2: Verify no missing keys**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Zero errors

- [ ] **Step 10.3: Commit i18n**

```bash
scripts/committer "[enhanced] feat(chat): add i18n keys for slash commands, compaction, token display" \
  dashboard/src/i18n/zh.json \
  dashboard/src/i18n/en.json
```

---

### Task 11: Final Verification [test]

- [ ] **Step 11.1: Full type check**

Run: `cd dashboard && npx tsc --noEmit --pretty`
Expected: Zero new errors

- [ ] **Step 11.2: Lint check**

Run: `cd dashboard && npx oxlint . 2>&1 | tail -5`
Expected: No new warnings in changed files

- [ ] **Step 11.3: Verify dark mode**

Manually check (or screenshot) that all new components render correctly in dark mode — slash command palette, compaction notice, token display.

---

## Requirement Coverage Matrix

| Spec Requirement                                   | Task                                       |
| -------------------------------------------------- | ------------------------------------------ |
| chat-slash-commands > palette trigger              | Task 4, 6                                  |
| chat-slash-commands > filter commands              | Task 2, 4                                  |
| chat-slash-commands > keyboard select              | Task 4                                     |
| chat-slash-commands > dismiss palette              | Task 4, 6                                  |
| chat-slash-commands > /new creates session         | Task 3, 6                                  |
| chat-slash-commands > /stop aborts run             | Task 3, 6                                  |
| chat-slash-commands > /model switches model        | Task 1, 3                                  |
| chat-slash-commands > /export exports session      | Task 3, 6                                  |
| chat-input-history > navigate previous             | Task 5, 6                                  |
| chat-input-history > navigate back to current      | Task 5, 6                                  |
| chat-input-history > send adds to history          | Task 5, 6                                  |
| chat-input-history > refresh preserves             | Task 5                                     |
| chat-input-history > tab close clears              | Task 5                                     |
| chat-input-history > 50 item limit                 | Task 5                                     |
| chat-token-display > message tokens                | (existing RunStatusBar — per-run)          |
| chat-token-display > no usage data                 | (existing RunStatusBar — em-dash fallback) |
| chat-token-display > session totals                | Task 9                                     |
| chat-token-display > update during streaming       | Task 9                                     |
| chat-compaction-viz > display notification         | Task 7, 8                                  |
| chat-compaction-viz > show token reduction         | Task 7                                     |
| chat-compaction-viz > compaction during disconnect | Task 8                                     |

---

## Review Fixes Applied (Codex + Gemini R1)

| #        | Finding                                      | Fix                                                                                                       |
| -------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| P1-1     | /model no-args returns empty                 | Fixed: executor now fetches models.list + sessions.list, returns model info                               |
| P1-2     | /export uses artifact download.ts            | Fixed: Task 6.2 now specifies new `export-session.ts` utility for markdown export                         |
| P1-3     | /agents calls wrong API path                 | Fixed: executor uses `/api/gateway` with `agents.list` method                                             |
| P1-4     | createSession() doesn't exist in store       | Fixed: Task 6.2 uses `/api/chat/sessions/create` + `setActiveSession()`                                   |
| P1-5     | Keyboard event conflict (palette vs history) | Fixed: Task 6.3 specifies priority chain, Task 4 removes global listener                                  |
| P1-6     | Session token data pipeline missing          | Fixed: Task 8.2 adds SSE → sessionMetas sync in chat-dispatchers.ts                                       |
| P2-1     | Outside-click dismiss missing                | To implement in SlashCommandPalette (click outside container → onDismiss)                                 |
| P2-2     | Compaction tokensBefore/After unavailable    | Noted in Task 8.1 — fields are optional in CompactionNotice                                               |
| P2-3     | Compaction dedup strategy                    | Added to Task 8.1 — 5-second window dedup                                                                 |
| Rejected | /reset needs API route                       | Rejected — /reset is client-side (create new session), matches official executor pattern                  |
| Rejected | Command set must be 10 (OpenSpec says 10)    | OpenSpec written before official UI audit; 15 commands is the correct alignment. OpenSpec needs updating. |
