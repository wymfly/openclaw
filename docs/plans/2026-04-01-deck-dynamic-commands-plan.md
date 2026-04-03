# Deck Dynamic Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Deck's slash command system from 14 hardcoded commands to a dynamic registry that discovers and executes built-in, skill, and plugin commands from the Gateway.

**Architecture:** A `CommandRegistry` (Map-based) replaces the static array. A new `deck.commands.discover` Gateway RPC returns available commands. Local commands execute directly; remote commands delegate to `chat.send`. The palette UI shows mixed-source groups with ghost hints and visibility filtering.

**Tech Stack:** TypeScript, Next.js (app router), Zustand, next-intl, TypeBox (Gateway schemas), Protocol SDK codegen

**OpenSpec:** `openspec/changes/deck-dynamic-commands/` — 4 specs, 17 requirements, 45 scenarios

**Skill dependencies:**

- Dashboard CLAUDE.md: zero-hardcode i18n, shadcn theme tokens, Gateway allowlist sync
- Gateway CLAUDE.md: methodDefs pattern, TypeBox schema in `protocol/schema/deck.ts`

---

## File Structure

### New Files

| File                                           | Responsibility                                                                                                    |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `dashboard/src/lib/command-types.ts`           | All command type definitions: `CommandSource`, `CommandExecMode`, `RegisteredCommand`, `CommandVisibilityContext` |
| `dashboard/src/lib/command-registry.ts`        | `CommandRegistry` class: Map-based register/unregister/get/filter with priority conflict resolution               |
| `dashboard/src/lib/command-registry.test.ts`   | Unit tests for CommandRegistry                                                                                    |
| `dashboard/src/hooks/use-command-discovery.ts` | React hook: discover RPC call, SSE listener, registry sync                                                        |
| `src/gateway/server-methods/deck/commands.ts`  | Gateway handler: `deck.commands.discover` aggregating built-in + skill + plugin commands                          |

### Modified Files

| File                                                             | Change                                                                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/gateway/protocol/schema/deck.ts`                            | Add `DeckCommandsDiscoverParams/ResultSchema` TypeBox schemas                                  |
| `src/gateway/server-methods/deck/index.ts`                       | Import and spread `deckCommandsHandlers` + `deckCommandsMethodDefs`                            |
| `src/gateway/server-methods-list.ts`                             | Register `deck.commands.discover` in the base method list                                      |
| `dashboard/server/gateway-allowlist.ts`                          | Add to EXTRA_METHODS (until protocol:gen picks it up)                                          |
| `dashboard/src/components/panels/chat/slash-commands.ts`         | Rename export to `LOCAL_COMMAND_DEFS`, keep `parseSlashCommand` and backward-compat re-exports |
| `dashboard/src/components/panels/chat/slash-command-executor.ts` | Replace switch-case with registry dispatch + add `executeRemoteCommand()`                      |
| `dashboard/src/components/panels/chat/SlashCommandPalette.tsx`   | Read from registry, add Skills/More groups, ghost hints, visibility filtering, dynamic icons   |
| `dashboard/src/components/panels/chat/MessageInput.tsx`          | Use registry for command lookup, integrate ghost hint state                                    |
| `dashboard/src/components/panels/chat/ChatPanel.tsx`             | Mount `useCommandDiscovery()` hook                                                             |
| `dashboard/src/i18n/en.json`                                     | Add ~10 new chat namespace keys                                                                |
| `dashboard/src/i18n/zh.json`                                     | Add ~10 new chat namespace keys                                                                |

---

### Task 1: Command Types

**Files:**

- Create: `dashboard/src/lib/command-types.ts`

**covers:** command-registry > Source-tagged command metadata, command-registry > Priority-based conflict resolution (types only)

- [ ] **Step 1: Create command-types.ts with all type definitions**

```typescript
// dashboard/src/lib/command-types.ts
import type { SlashCommandResult } from "@/components/panels/chat/slash-command-executor";

export type CommandSource = "local" | "builtin" | "skill" | "plugin";

export type CommandExecMode = "local" | "remote";

/** Priority values — lower number = higher priority. Matches official: plugin > local > builtin > skill. */
export const SOURCE_PRIORITY: Record<CommandSource, number> = {
  plugin: 0,
  local: 10,
  builtin: 20,
  skill: 30,
};

export interface CommandVisibilityContext {
  isStreaming: boolean;
  hasMessages: boolean;
  sessionStatus: string;
}

export interface RegisteredCommand {
  name: string;
  source: CommandSource;
  execMode: CommandExecMode;
  /** i18n key under "chat" namespace (local commands). */
  descriptionKey?: string;
  /** Raw description text (remote commands from discover). */
  description?: string;
  args?: string;
  argOptions?: string[];
  icon?: string;
  category: string;
  priority: number;
  /** Local-only: handler function. */
  execute?: (sessionKey: string, args: string) => Promise<SlashCommandResult>;
  /** Visibility predicate — controls palette visibility, not execution. */
  visibleIf?: (ctx: CommandVisibilityContext) => boolean;
  /** Skill-specific: original skill name. */
  skillName?: string;
  /** Plugin-specific: plugin id. */
  pluginId?: string;
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm tsc --noEmit --project dashboard/tsconfig.json 2>&1 | head -20`
Expected: No errors related to `command-types.ts`

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/command-types.ts
git commit -m "[enhanced] feat(deck): add command registry type definitions"
```

---

### Task 2: Command Registry

**Files:**

- Create: `dashboard/src/lib/command-registry.ts`
- Create: `dashboard/src/lib/command-registry.test.ts`

**covers:** command-registry > Dynamic command registration (all 4 scenarios), command-registry > Priority-based conflict resolution (all 2 scenarios), command-registry > Command filtering and search (all 2 scenarios), command-registry > Backward-compatible migration

- [ ] **Step 1: Write the failing tests**

```typescript
// dashboard/src/lib/command-registry.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { CommandRegistry } from "./command-registry";
import type { RegisteredCommand } from "./command-types";

function makeCmd(overrides: Partial<RegisteredCommand> & { name: string }): RegisteredCommand {
  return {
    source: "local",
    execMode: "local",
    category: "session",
    priority: 10,
    ...overrides,
  };
}

describe("CommandRegistry", () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe("register / get / unregister", () => {
    it("registers and retrieves a command by name", () => {
      const cmd = makeCmd({ name: "help" });
      registry.register(cmd);
      expect(registry.get("help")).toBe(cmd);
    });

    it("returns undefined for unknown command", () => {
      expect(registry.get("nope")).toBeUndefined();
    });

    it("unregisters a command", () => {
      registry.register(makeCmd({ name: "help" }));
      registry.unregister("help");
      expect(registry.get("help")).toBeUndefined();
    });

    it("getAll returns all registered commands", () => {
      registry.register(makeCmd({ name: "a" }));
      registry.register(makeCmd({ name: "b" }));
      expect(registry.getAll()).toHaveLength(2);
    });
  });

  describe("priority-based conflict resolution", () => {
    it("higher priority (lower number) wins on name conflict", () => {
      const local = makeCmd({ name: "model", source: "local", priority: 10 });
      const builtin = makeCmd({ name: "model", source: "builtin", priority: 20 });
      registry.register(builtin);
      registry.register(local);
      expect(registry.get("model")?.source).toBe("local");
    });

    it("displaced command accessible via qualified name", () => {
      const local = makeCmd({ name: "model", source: "local", priority: 10 });
      const builtin = makeCmd({ name: "model", source: "builtin", priority: 20 });
      registry.register(local);
      registry.register(builtin);
      expect(registry.get("model")?.source).toBe("local");
      expect(registry.get("builtin:model")?.source).toBe("builtin");
    });

    it("lower priority does not override existing higher priority", () => {
      const local = makeCmd({ name: "help", source: "local", priority: 10 });
      const skill = makeCmd({ name: "help", source: "skill", priority: 30 });
      registry.register(local);
      registry.register(skill);
      expect(registry.get("help")?.source).toBe("local");
    });

    it("promotes displaced command after unregister", () => {
      const local = makeCmd({ name: "model", source: "local", priority: 10 });
      const builtin = makeCmd({ name: "model", source: "builtin", priority: 20 });
      registry.register(local);
      registry.register(builtin);
      expect(registry.get("model")?.source).toBe("local");
      registry.unregister("model");
      expect(registry.get("model")?.source).toBe("builtin");
    });

    it("promotes displaced command after unregisterBySource", () => {
      const local = makeCmd({ name: "model", source: "local", priority: 10 });
      const builtin = makeCmd({ name: "model", source: "builtin", priority: 20 });
      registry.register(local);
      registry.register(builtin);
      registry.unregisterBySource("local");
      expect(registry.get("model")?.source).toBe("builtin");
    });
  });

  describe("filter", () => {
    it("empty query returns all commands", () => {
      registry.register(makeCmd({ name: "new", category: "session" }));
      registry.register(makeCmd({ name: "model", category: "model" }));
      const results = registry.filter("");
      expect(results).toHaveLength(2);
    });

    it("prefix search matches across sources", () => {
      registry.register(makeCmd({ name: "model", source: "local" }));
      registry.register(makeCmd({ name: "monitor", source: "builtin", priority: 20 }));
      const results = registry.filter("mo");
      expect(results).toHaveLength(2);
      expect(results.map((c) => c.name)).toContain("model");
      expect(results.map((c) => c.name)).toContain("monitor");
    });

    it("no match returns empty array", () => {
      registry.register(makeCmd({ name: "help" }));
      expect(registry.filter("xyz")).toHaveLength(0);
    });
  });

  describe("registerLocalCommands", () => {
    it("converts SlashCommandDef array to registered commands", () => {
      const defs = [
        { name: "new", descriptionKey: "cmd_new", icon: "plus", category: "session" as const },
        {
          name: "model",
          descriptionKey: "cmd_model",
          args: "<name>",
          icon: "cpu",
          category: "model" as const,
          argOptions: ["gpt-4"],
        },
      ];
      registry.registerLocalCommands(defs);
      expect(registry.getAll()).toHaveLength(2);
      const newCmd = registry.get("new");
      expect(newCmd?.source).toBe("local");
      expect(newCmd?.execMode).toBe("local");
      expect(newCmd?.descriptionKey).toBe("cmd_new");
      expect(newCmd?.icon).toBe("plus");
      const modelCmd = registry.get("model");
      expect(modelCmd?.argOptions).toEqual(["gpt-4"]);
    });
  });

  describe("unregisterBySource", () => {
    it("removes all commands from a specific source", () => {
      registry.register(makeCmd({ name: "local1", source: "local" }));
      registry.register(makeCmd({ name: "remote1", source: "builtin", priority: 20 }));
      registry.register(makeCmd({ name: "remote2", source: "skill", priority: 30 }));
      registry.unregisterBySource("builtin");
      expect(registry.get("remote1")).toBeUndefined();
      expect(registry.get("local1")).toBeDefined();
      expect(registry.get("remote2")).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm test -- dashboard/src/lib/command-registry.test.ts 2>&1 | tail -20`
Expected: FAIL — `command-registry` module not found

- [ ] **Step 3: Implement CommandRegistry**

```typescript
// dashboard/src/lib/command-registry.ts
import type { RegisteredCommand, CommandSource } from "./command-types";
import { SOURCE_PRIORITY } from "./command-types";
import type { SlashCommandDef } from "@/components/panels/chat/slash-commands";

const CATEGORY_ORDER = ["session", "model", "tools", "agents", "skills", "plugins", "more"];

export class CommandRegistry {
  private commands = new Map<string, RegisteredCommand>();
  /** Displaced commands stored under "source:name" qualified keys. */
  private qualified = new Map<string, RegisteredCommand>();
  private version = 0;

  register(cmd: RegisteredCommand): void {
    const existing = this.commands.get(cmd.name);
    if (existing) {
      if (cmd.priority < existing.priority) {
        // New command wins — displace existing to qualified
        this.qualified.set(`${existing.source}:${existing.name}`, existing);
        this.commands.set(cmd.name, cmd);
      } else {
        // Existing wins — store new as qualified
        this.qualified.set(`${cmd.source}:${cmd.name}`, cmd);
      }
    } else {
      this.commands.set(cmd.name, cmd);
    }
    this.version++;
  }

  unregister(name: string): void {
    this.commands.delete(name);
    // Promote: find highest-priority displaced command with the same name
    let best: { key: string; cmd: RegisteredCommand } | null = null;
    for (const [key, cmd] of this.qualified) {
      if (key.endsWith(`:${name}`)) {
        if (!best || cmd.priority < best.cmd.priority) {
          best = { key, cmd };
        }
      }
    }
    if (best) {
      this.qualified.delete(best.key);
      this.commands.set(name, best.cmd);
    }
    this.version++;
  }

  unregisterBySource(source: CommandSource): void {
    const removedNames: string[] = [];
    for (const [name, cmd] of this.commands) {
      if (cmd.source === source) {
        this.commands.delete(name);
        removedNames.push(name);
      }
    }
    for (const key of this.qualified.keys()) {
      if (key.startsWith(`${source}:`)) {
        this.qualified.delete(key);
      }
    }
    // Promote displaced commands for each removed name
    for (const name of removedNames) {
      let best: { key: string; cmd: RegisteredCommand } | null = null;
      for (const [key, cmd] of this.qualified) {
        if (key.endsWith(`:${name}`)) {
          if (!best || cmd.priority < best.cmd.priority) {
            best = { key, cmd };
          }
        }
      }
      if (best) {
        this.qualified.delete(best.key);
        this.commands.set(name, best.cmd);
      }
    }
    this.version++;
  }

  get(name: string): RegisteredCommand | undefined {
    return this.commands.get(name) ?? this.qualified.get(name);
  }

  getAll(): RegisteredCommand[] {
    return [...this.commands.values()];
  }

  filter(query: string): RegisteredCommand[] {
    const lower = query.toLowerCase();
    const commands = lower
      ? this.getAll().filter((cmd) => cmd.name.startsWith(lower))
      : this.getAll();

    return commands.toSorted((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.category);
      const bi = CATEGORY_ORDER.indexOf(b.category);
      const aCat = ai === -1 ? 999 : ai;
      const bCat = bi === -1 ? 999 : bi;
      if (aCat !== bCat) return aCat - bCat;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.name.localeCompare(b.name);
    });
  }

  registerLocalCommands(defs: SlashCommandDef[]): void {
    for (const def of defs) {
      this.register({
        name: def.name,
        source: "local",
        execMode: "local",
        descriptionKey: def.descriptionKey,
        args: def.args,
        argOptions: def.argOptions,
        icon: def.icon,
        category: def.category,
        priority: SOURCE_PRIORITY.local,
      });
    }
  }

  getVersion(): number {
    return this.version;
  }
}

/** Module-level singleton. */
export const commandRegistry = new CommandRegistry();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm test -- dashboard/src/lib/command-registry.test.ts 2>&1 | tail -20`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/command-types.ts dashboard/src/lib/command-registry.ts dashboard/src/lib/command-registry.test.ts
git commit -m "[enhanced] feat(deck): implement CommandRegistry with priority conflict resolution"
```

---

### Task 3: Executor Refactor + Palette Migration (Phase 1)

**Files:**

- Modify: `dashboard/src/components/panels/chat/slash-commands.ts`
- Modify: `dashboard/src/components/panels/chat/slash-command-executor.ts`
- Modify: `dashboard/src/components/panels/chat/SlashCommandPalette.tsx`
- Modify: `dashboard/src/components/panels/chat/MessageInput.tsx`
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx`

**covers:** command-registry > Backward-compatible migration > Migrate existing commands, command-execution > Local command execution (all 3 scenarios), command-execution > Unified executor dispatch > Registered command dispatches correctly, command-execution > Unified executor dispatch > Unknown command fallback

- [ ] **Step 1: Update slash-commands.ts — rename export, keep backward compat**

In `dashboard/src/components/panels/chat/slash-commands.ts`:

- Rename `SLASH_COMMANDS` to `LOCAL_COMMAND_DEFS`
- Add backward-compat re-export: `export const SLASH_COMMANDS = LOCAL_COMMAND_DEFS;`
- Keep `getSlashCommandCompletions` and `parseSlashCommand` unchanged (they still work for local commands during migration)

```typescript
// At the top of the file, change:
export const SLASH_COMMANDS: SlashCommandDef[] = [
// to:
export const LOCAL_COMMAND_DEFS: SlashCommandDef[] = [

// After the array, add backward-compat alias:
/** @deprecated Use LOCAL_COMMAND_DEFS or commandRegistry. */
export const SLASH_COMMANDS = LOCAL_COMMAND_DEFS;
```

- [ ] **Step 2: Register local commands + wire executor handlers into registry**

In `dashboard/src/components/panels/chat/slash-command-executor.ts`:

- Import `commandRegistry` and `LOCAL_COMMAND_DEFS`
- Add `initializeLocalCommands()` function that registers all 14 commands with their `execute` handlers
- Replace the `switch` statement in `executeSlashCommand` with registry lookup

```typescript
// At top of slash-command-executor.ts, add:
import { commandRegistry } from "@/lib/command-registry";
import { LOCAL_COMMAND_DEFS } from "./slash-commands";

// Add initialization function (called once from ChatPanel):
let initialized = false;

export function initializeLocalCommands(): void {
  if (initialized) return;
  initialized = true;

  // Register all local defs into registry
  commandRegistry.registerLocalCommands(LOCAL_COMMAND_DEFS);

  // Attach execute handlers to each registered local command
  const handlers: Record<string, (sk: string, args: string) => Promise<SlashCommandResult>> = {
    help: (_sk) => Promise.resolve(executeHelp()),
    new: () => Promise.resolve({ content: "", action: "new-session" as const }),
    reset: () => Promise.resolve({ content: "", action: "reset" as const }),
    stop: () => Promise.resolve({ content: "", action: "stop" as const }),
    clear: () => Promise.resolve({ content: "", action: "clear" as const }),
    export: () => Promise.resolve({ content: "", action: "export" as const }),
    compact: (sk) => executeCompact(sk),
    model: (sk, a) => executeModel(sk, a),
    think: (sk, a) => executeThink(sk, a),
    fast: (sk, a) => executeFast(sk, a),
    verbose: (sk, a) => executeVerbose(sk, a),
    usage: (sk) => executeUsage(sk),
    agents: () => executeAgents(),
    kill: (sk, a) => executeKill(sk, a),
  };

  for (const [name, handler] of Object.entries(handlers)) {
    const cmd = commandRegistry.get(name);
    if (cmd) {
      cmd.execute = handler;
    }
  }
}

// Replace the switch-case executeSlashCommand with:
export async function executeSlashCommand(
  sessionKey: string,
  commandName: string,
  args: string,
): Promise<SlashCommandResult> {
  const cmd = commandRegistry.get(commandName);
  if (!cmd) {
    return {
      content: "",
      toastKey: "toastUnknownCommand",
      toastValue: commandName,
      toastType: "error",
    };
  }
  if (cmd.execMode === "local" && cmd.execute) {
    return cmd.execute(sessionKey, args);
  }
  if (cmd.execMode === "remote") {
    return executeRemoteCommand(sessionKey, commandName, args);
  }
  return { content: `Unknown command: /${commandName}` };
}

// Add remote execution stub (will be fully wired in Task 6):
async function executeRemoteCommand(
  sessionKey: string,
  commandName: string,
  args: string,
): Promise<SlashCommandResult> {
  try {
    const message = args ? `/${commandName} ${args}` : `/${commandName}`;
    const res = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionKey }),
    });
    if (!res.ok) {
      return { content: "", toastKey: "toastCommandSentFailed", toastType: "error" };
    }
    return {
      content: "",
      toastKey: "toastCommandSent",
      toastValue: commandName,
      toastType: "success",
    };
  } catch {
    return { content: "", toastKey: "toastCommandSentFailed", toastType: "error" };
  }
}
```

- [ ] **Step 3: Update SlashCommandPalette to read from registry**

In `dashboard/src/components/panels/chat/SlashCommandPalette.tsx`:

- Replace `getSlashCommandCompletions(filter)` with `commandRegistry.filter(filter)`
- Import `commandRegistry` from `@/lib/command-registry`
- Keep existing category grouping, keyboard navigation, and icon rendering unchanged

```typescript
// Replace import:
// OLD: import { getSlashCommandCompletions, CATEGORY_LABEL_KEYS } from "./slash-commands";
// NEW:
import { CATEGORY_LABEL_KEYS } from "./slash-commands";
import type { SlashCommandCategory } from "./slash-commands";
import { commandRegistry } from "@/lib/command-registry";

// Replace in component body:
// OLD: const commands = getSlashCommandCompletions(filter);
// NEW:
const registryCommands = commandRegistry.filter(filter);
// Map to the shape the existing rendering expects:
const commands = registryCommands.map((cmd) => ({
  name: cmd.name,
  descriptionKey: cmd.descriptionKey ?? "",
  description: cmd.description,
  args: cmd.args,
  icon: cmd.icon ?? "terminal",
  category: cmd.category as SlashCommandCategory,
  argOptions: cmd.argOptions,
}));
```

- [ ] **Step 4: Initialize registry in ChatPanel**

In `dashboard/src/components/panels/chat/ChatPanel.tsx`:

- Import and call `initializeLocalCommands()` at module level (before component)

```typescript
// After existing imports, add:
import { initializeLocalCommands } from "./slash-command-executor";

// Before the ChatPanel component definition:
initializeLocalCommands();
```

- [ ] **Step 5: Add i18n keys for remote command toast**

In `dashboard/src/i18n/en.json` under `"chat"`:

```json
"toastCommandSent": "Command /{value} sent",
"toastCommandSentFailed": "Failed to send command"
```

In `dashboard/src/i18n/zh.json` under `"chat"`:

```json
"toastCommandSent": "命令 /{value} 已发送",
"toastCommandSentFailed": "命令发送失败"
```

- [ ] **Step 6: Verify Phase 1 — zero behavior change**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm tsc --noEmit --project dashboard/tsconfig.json 2>&1 | head -20`
Expected: No type errors

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm test -- dashboard/src/lib/command-registry.test.ts 2>&1 | tail -10`
Expected: All tests PASS

Manual check: Start Dashboard (`cd dashboard && pnpm dev`), type `/` in chat input — all 14 commands appear, execute `/fast on` — toast shows, SessionConfigBar updates.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/components/panels/chat/slash-commands.ts dashboard/src/components/panels/chat/slash-command-executor.ts dashboard/src/components/panels/chat/SlashCommandPalette.tsx dashboard/src/components/panels/chat/ChatPanel.tsx dashboard/src/i18n/en.json dashboard/src/i18n/zh.json
git commit -m "[enhanced] refactor(deck): migrate slash commands to dynamic CommandRegistry"
```

---

### Task 4: Gateway TypeBox Schema

**Files:**

- Modify: `src/gateway/protocol/schema/deck.ts`

**covers:** command-discovery > Protocol SDK integration > TypeBox schema defined

- [ ] **Step 1: Add DeckCommandsDiscover schemas to deck.ts**

Append to the end of `src/gateway/protocol/schema/deck.ts`:

```typescript
// === deck.commands.* ===

const DiscoverableCommandSchema = Type.Object({
  name: Type.String(),
  source: Type.Union([Type.Literal("builtin"), Type.Literal("skill"), Type.Literal("plugin")]),
  description: Type.String(),
  args: Type.Optional(Type.String()),
  argChoices: Type.Optional(Type.Array(Type.String())),
  category: Type.Optional(Type.String()),
  skillName: Type.Optional(Type.String()),
  pluginId: Type.Optional(Type.String()),
});

export const DeckCommandsDiscoverParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const DeckCommandsDiscoverResultSchema = Type.Object({
  commands: Type.Array(DiscoverableCommandSchema),
  version: Type.String(),
});
```

- [ ] **Step 2: Verify schema compiles**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm tsc --noEmit 2>&1 | grep -i "deck.ts" | head -5`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/gateway/protocol/schema/deck.ts
git commit -m "[enhanced] feat(gateway): add TypeBox schemas for deck.commands.discover"
```

---

### Task 5: Gateway RPC Handler

**Files:**

- Create: `src/gateway/server-methods/deck/commands.ts`
- Modify: `src/gateway/server-methods/deck/index.ts`
- Modify: `src/gateway/server-methods-list.ts`

**covers:** command-discovery > Gateway discover RPC (all 4 scenarios)

- [ ] **Step 1: Implement deck.commands.discover handler**

Create `src/gateway/server-methods/deck/commands.ts`:

```typescript
import { createHash } from "node:crypto";
import { resolveDefaultAgentId } from "../../../agents/agent-scope.js";
import { getChatCommands } from "../../../auto-reply/commands-registry.data.js";
import { listSkillCommandsForAgents } from "../../../auto-reply/skill-commands.js";
import { loadConfig } from "../../../config/config.js";
import type { MethodMetadata } from "../../method-registry.js";
import {
  ErrorCodes,
  errorShape,
  validateDeckCommandsDiscoverParams,
} from "../../protocol/index.js";
import {
  DeckCommandsDiscoverParamsSchema,
  DeckCommandsDiscoverResultSchema,
} from "../../protocol/schema/deck.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";

interface DiscoverableCommand {
  name: string;
  source: "builtin" | "skill" | "plugin";
  description: string;
  args?: string;
  argChoices?: string[];
  category?: string;
  skillName?: string;
  pluginId?: string;
}

export const deckCommandsHandlers: GatewayRequestHandlers = {
  "deck.commands.discover": async ({ params }) => {
    const p = assertValidParams(params, validateDeckCommandsDiscoverParams);
    try {
      const cfg = loadConfig();
      const agentId = p.agentId ?? resolveDefaultAgentId(cfg);
      const commands: DiscoverableCommand[] = [];

      // 1. Built-in commands (text-scope only)
      const builtins = getChatCommands();
      for (const cmd of builtins) {
        if (cmd.scope === "native") continue;
        const textAlias = cmd.textAliases?.[0];
        const name = textAlias ? textAlias.replace(/^\//, "") : cmd.key;

        const argChoices: string[] = [];
        if (cmd.args) {
          for (const arg of cmd.args) {
            if (Array.isArray(arg.choices)) {
              for (const c of arg.choices) {
                argChoices.push(typeof c === "string" ? c : c.value);
              }
            }
          }
        }

        commands.push({
          name,
          source: "builtin",
          description: cmd.description,
          args: cmd.acceptsArgs
            ? cmd.args?.map((a) => `<${a.name}>`).join(" ") || "<args>"
            : undefined,
          argChoices: argChoices.length > 0 ? argChoices : undefined,
          // Map auto-reply categories to palette-friendly groups
          category: "more",
        });
      }

      // 2. Skill commands — scoped to specific agent (uses built-in dedup)
      const skillCmds = listSkillCommandsForAgents({
        cfg,
        agentIds: [agentId],
      });
      for (const sc of skillCmds) {
        commands.push({
          name: sc.name,
          source: "skill",
          description: sc.description,
          category: "skills",
          skillName: sc.skillName,
        });
      }

      // 3. Plugin commands (placeholder — future extension point)

      // Version hash includes name + description + args for full change detection
      const hashInput = commands
        .map((c) => `${c.source}:${c.name}:${c.description}:${c.args ?? ""}`)
        .sort()
        .join(",");
      const version = createHash("md5").update(hashInput).digest("hex").slice(0, 12);

      return { commands, version };
    } catch (err) {
      return errorShape(ErrorCodes.INTERNAL, `Failed to discover commands: ${err}`);
    }
  },
};

export const deckCommandsMethodDefs: Record<string, MethodMetadata> = {
  "deck.commands.discover": {
    params: DeckCommandsDiscoverParamsSchema,
    result: DeckCommandsDiscoverResultSchema,
    scope: "operator.read",
  },
};
```

- [ ] **Step 2: Register in deck/index.ts**

In `src/gateway/server-methods/deck/index.ts`, add imports and spread:

```typescript
import { deckCommandsHandlers, deckCommandsMethodDefs } from "./commands.js";

// In deckHandlers, add:
...deckCommandsHandlers,

// In deckMethodDefs, add:
...deckCommandsMethodDefs,
```

- [ ] **Step 3: Register in server-methods-list.ts + method-registry-data.ts**

In `src/gateway/server-methods-list.ts`, find the existing `"deck.` entries and add:

```typescript
"deck.commands.discover",
```

In `src/gateway/method-registry-data.ts`, add `"deck.commands.discover"` to the `allMethodNames` array.

In `src/gateway/method-scopes.ts`, add scope for the new method (or verify it's covered by the `"deck.*": "operator.read"` pattern).

- [ ] **Step 4: Verify Gateway compiles**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/gateway/server-methods/deck/commands.ts src/gateway/server-methods/deck/index.ts src/gateway/server-methods-list.ts
git commit -m "[enhanced] feat(gateway): implement deck.commands.discover RPC handler"
```

---

### Task 6: Protocol SDK Codegen + Allowlist

**Files:**

- Modify: `dashboard/src/types/gateway-protocol.generated.ts` (auto-generated)
- Modify: `dashboard/src/types/gateway-client.generated.ts` (auto-generated)
- Modify: `dashboard/server/gateway-allowlist.ts`

**covers:** command-discovery > Protocol SDK integration > TypeBox schema defined, command-discovery > Protocol SDK integration > Gateway allowlist updated

- [ ] **Step 1: Run Protocol SDK codegen**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm protocol:gen:ts 2>&1 | tail -10`
Expected: Generated files updated with `DeckCommandsDiscoverParams` and `DeckCommandsDiscoverResult`

- [ ] **Step 2: Verify generated types include new method**

Run: `grep -n "deckCommandsDiscover\|deck.commands.discover" dashboard/src/types/gateway-client.generated.ts | head -5`
Expected: Lines showing the new method in the generated allowlist and typed client

- [ ] **Step 3: Update allowlist if needed**

If the generated client doesn't automatically include the method, add to `dashboard/server/gateway-allowlist.ts` in `EXTRA_METHODS`:

```typescript
"deck.commands.discover",
```

(This may not be needed if protocol:gen:ts picked it up — check the generated allowlist first.)

- [ ] **Step 4: Verify types compile**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm tsc --noEmit --project dashboard/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Verify codegen check passes**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm protocol:gen:check 2>&1 | tail -5`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/types/gateway-protocol.generated.ts dashboard/src/types/gateway-client.generated.ts dashboard/server/gateway-allowlist.ts
git commit -m "[enhanced] feat(deck): regenerate Protocol SDK with deck.commands.discover"
```

---

### Task 7: Discovery Hook + SSE

**Files:**

- Create: `dashboard/src/hooks/use-command-discovery.ts`
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx`
- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`

**covers:** command-discovery > Discovery hook for React components (all 3 scenarios), command-discovery > SSE command change notification > Client re-discovers on change, command-discovery > SSE command change notification > Same version suppresses re-discover

- [ ] **Step 1: Create useCommandDiscovery hook**

```typescript
// dashboard/src/hooks/use-command-discovery.ts
"use client";

import { useEffect, useRef } from "react";
import { commandRegistry } from "@/lib/command-registry";
import { SOURCE_PRIORITY } from "@/lib/command-types";
import type { RegisteredCommand } from "@/lib/command-types";

/**
 * Discovers available commands from Gateway via deck.commands.discover RPC.
 * Listens for SSE `commands.changed` events to refresh.
 */
export function useCommandDiscovery() {
  const versionRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function discover() {
      try {
        const res = await fetch("/api/deck/commands/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "deck.commands.discover" }),
        });
        if (!res.ok || !mountedRef.current) return;
        const data = (await res.json()) as {
          commands?: Array<{
            name: string;
            source: "builtin" | "skill" | "plugin";
            description: string;
            args?: string;
            argChoices?: string[];
            category?: string;
            skillName?: string;
            pluginId?: string;
          }>;
          version?: string;
        };

        if (!mountedRef.current) return;

        const newVersion = data.version ?? "";
        if (newVersion === versionRef.current) return;
        versionRef.current = newVersion;

        // Clear previous remote commands
        commandRegistry.unregisterBySource("builtin");
        commandRegistry.unregisterBySource("skill");
        commandRegistry.unregisterBySource("plugin");

        // Register discovered commands
        for (const cmd of data.commands ?? []) {
          const source = cmd.source;
          const registered: RegisteredCommand = {
            name: cmd.name,
            source,
            execMode: "remote",
            description: cmd.description,
            args: cmd.args,
            argOptions: cmd.argChoices,
            category: cmd.category ?? (source === "skill" ? "skills" : "more"),
            priority: SOURCE_PRIORITY[source],
            skillName: cmd.skillName,
            pluginId: cmd.pluginId,
          };
          commandRegistry.register(registered);
        }
      } catch {
        // Silently fail — local commands remain available
      }
    }

    discover();

    return () => {
      mountedRef.current = false;
      // Clean up remote commands
      commandRegistry.unregisterBySource("builtin");
      commandRegistry.unregisterBySource("skill");
      commandRegistry.unregisterBySource("plugin");
    };
  }, []);
}
```

- [ ] **Step 2: Create API route for discover RPC**

Create `dashboard/src/app/api/deck/commands/discover/route.ts`:

```typescript
import { gatewayRequest } from "../../../../../../server/gateway-adapter";

export async function POST(request: Request) {
  const body = await request.json();
  return gatewayRequest("deck.commands.discover", body);
}
```

Wait — check how existing deck API routes work first. Let me verify the pattern:

The API route should follow the existing pattern at `dashboard/src/app/api/deck/`. Look at an existing route (e.g., `dashboard/src/app/api/deck/agents/route.ts`) and mirror its structure. The route proxies to the Gateway via `gatewayRequest()`.

- [ ] **Step 3: Mount hook in ChatPanel**

In `dashboard/src/components/panels/chat/ChatPanel.tsx`, add:

```typescript
import { useCommandDiscovery } from "@/hooks/use-command-discovery";

// Inside the ChatPanel component body, after other hooks:
useCommandDiscovery();
```

- [ ] **Step 4: Add i18n keys for new categories**

In `dashboard/src/i18n/en.json` under `"chat"`:

```json
"cmdCatSkills": "Skills",
"cmdCatPlugins": "Plugins",
"cmdCatMore": "More commands",
"noMatchingCommands": "No matching commands"
```

In `dashboard/src/i18n/zh.json` under `"chat"`:

```json
"cmdCatSkills": "技能",
"cmdCatPlugins": "插件",
"cmdCatMore": "更多命令",
"noMatchingCommands": "没有匹配的命令"
```

Also update `CATEGORY_LABEL_KEYS` in `slash-commands.ts`:

```typescript
export const CATEGORY_LABEL_KEYS: Record<string, string> = {
  session: "cmdCatSession",
  model: "cmdCatModel",
  tools: "cmdCatTools",
  agents: "cmdCatAgents",
  skills: "cmdCatSkills",
  plugins: "cmdCatPlugins",
  more: "cmdCatMore",
};
```

- [ ] **Step 5: Verify**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm tsc --noEmit --project dashboard/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/hooks/use-command-discovery.ts dashboard/src/app/api/deck/commands/ dashboard/src/components/panels/chat/ChatPanel.tsx dashboard/src/components/panels/chat/slash-commands.ts dashboard/src/i18n/en.json dashboard/src/i18n/zh.json
git commit -m "[enhanced] feat(deck): add command discovery hook with SSE refresh"
```

---

### Task 8: Enhanced Palette — Mixed-Source Groups + Dynamic Icons

**Files:**

- Modify: `dashboard/src/components/panels/chat/SlashCommandPalette.tsx`

**covers:** command-palette-enhanced > Mixed-source category groups (all 4 scenarios), command-palette-enhanced > Cross-source prefix search (all 3 scenarios), command-palette-enhanced > Dynamic icon resolution (all 3 scenarios)

- [ ] **Step 1: Add new icons to ICON_MAP and source-default logic**

In `SlashCommandPalette.tsx`, add new lucide imports and extend the icon map:

```typescript
// Add to imports:
import { Sparkles, Plug2, TerminalSquare, ChevronRight } from "lucide-react";

// Extend ICON_MAP:
const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  // ... existing entries ...
  sparkles: Sparkles,
  plug: Plug2,
  "terminal-square": TerminalSquare,
};

/** Default icons per source when no specific icon is set. */
const SOURCE_DEFAULT_ICONS: Record<string, string> = {
  skill: "sparkles",
  plugin: "plug",
  builtin: "terminal-square",
};
```

Update `CommandIcon` to handle default icons based on source:

```typescript
function CommandIcon({ name, source, size = 14 }: { name?: string; source?: string; size?: number }) {
  const iconName = name || (source ? SOURCE_DEFAULT_ICONS[source] : undefined);
  if (!iconName) return null;
  const Icon = ICON_MAP[iconName];
  if (!Icon) return null;
  return <Icon size={size} />;
}
```

- [ ] **Step 2: Add "More" expand/collapse and "No matching commands" hint**

Replace the rendering logic to support:

1. Local commands grouped by their categories (session, model, tools, agents)
2. "Skills" group shown only when skill commands exist
3. "More commands..." collapsible entry for remote builtins
4. "No matching commands" when search has no results

```typescript
// Inside SlashCommandPalette component, after computing `commands`:
const [moreExpanded, setMoreExpanded] = useState(false);

// Split commands into display groups:
const localCategories = ["session", "model", "tools", "agents"];
const localCommands = commands.filter((c) => localCategories.includes(c.category));
const skillCommands = commands.filter((c) => c.category === "skills");
const moreCommands = commands.filter((c) => !localCategories.includes(c.category) && c.category !== "skills");
const hasFilter = filter.length > 0;

// When searching, show all results flat. When not searching, group by source.
if (commands.length === 0) {
  return (
    <div ref={containerRef} className="absolute bottom-full left-0 right-0 mb-1 z-50">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-lg px-3 py-2 text-xs text-[var(--muted-foreground)]">
        {t("noMatchingCommands")}
      </div>
    </div>
  );
}
```

The rest of the rendering follows the existing pattern — map over local commands with category headers, then skill commands under "Skills" header, then "More..." expandable section. Each command item keeps the existing `data-index`, `onMouseDown`, `onMouseEnter` handlers.

- [ ] **Step 3: Pass source to CommandIcon**

Update the command rendering to pass `source` from the registry command to `CommandIcon`:

```typescript
// In the command item render, update:
<CommandIcon name={cmd.icon} source={cmd.source} />
```

Note: The `commands` array from registry filter will need to carry the `source` field. Ensure the mapping in Step 3 of Task 3 preserves `source`:

```typescript
const commands = registryCommands.map((cmd) => ({
  name: cmd.name,
  descriptionKey: cmd.descriptionKey ?? "",
  description: cmd.description,
  args: cmd.args,
  icon: cmd.icon,
  category: cmd.category,
  argOptions: cmd.argOptions,
  source: cmd.source, // ADD THIS
}));
```

- [ ] **Step 4: Verify**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm tsc --noEmit --project dashboard/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/panels/chat/SlashCommandPalette.tsx
git commit -m "[enhanced] feat(deck): enhance palette with mixed-source groups + dynamic icons"
```

---

### Task 9: Ghost Hint + Visibility Filtering

**Files:**

- Modify: `dashboard/src/components/panels/chat/MessageInput.tsx`
- Modify: `dashboard/src/components/panels/chat/slash-command-executor.ts` (add visibleIf to local commands)
- Modify: `dashboard/src/components/panels/chat/SlashCommandPalette.tsx`

**covers:** command-palette-enhanced > Ghost hint parameter placeholder (all 3 scenarios), command-palette-enhanced > Context-aware visibility filtering (all 3 scenarios)

- [ ] **Step 1: Add visibleIf predicates to local commands**

In `slash-command-executor.ts`, inside `initializeLocalCommands()`, after attaching handlers, add visibility predicates:

```typescript
// After the handler attachment loop, add:
const stopCmd = commandRegistry.get("stop");
if (stopCmd) stopCmd.visibleIf = (ctx) => ctx.isStreaming;

const killCmd = commandRegistry.get("kill");
if (killCmd) killCmd.visibleIf = (ctx) => ctx.isStreaming;

const compactCmd = commandRegistry.get("compact");
if (compactCmd) compactCmd.visibleIf = (ctx) => ctx.hasMessages;
```

- [ ] **Step 2: Apply visibility filter in SlashCommandPalette**

In `SlashCommandPalette.tsx`, accept a `visibilityContext` prop and filter commands:

```typescript
interface SlashCommandPaletteProps {
  filter: string;
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onSelect: (command: SlashCommandDef) => void;
  onDismiss: () => void;
  visibilityContext?: CommandVisibilityContext;
}

// Inside component, after getting registryCommands:
const visibleCommands = visibilityContext
  ? registryCommands.filter((cmd) => !cmd.visibleIf || cmd.visibleIf(visibilityContext))
  : registryCommands;
```

Pass `visibilityContext` from `MessageInput.tsx`:

```typescript
// In MessageInput where SlashCommandPalette is rendered:
<SlashCommandPalette
  filter={slashFilter}
  selectedIndex={selectedIndex}
  onSelectedIndexChange={setSelectedIndex}
  onSelect={handleSlashSelect}
  onDismiss={handleSlashDismiss}
  visibilityContext={{
    isStreaming: !!isStreaming,
    hasMessages: messages.length > 0,
    sessionStatus: "idle",
  }}
/>
```

- [ ] **Step 3: Add ghost hint to MessageInput**

In `MessageInput.tsx`, add ghost hint rendering when user types a command name + space:

```typescript
// State for ghost hint:
const [ghostHint, setGhostHint] = useState<string | null>(null);

// In the input onChange handler, detect command + space:
const text = e.target.value;
const cmdMatch = text.match(/^\/([a-z]+)\s$/i);
if (cmdMatch) {
  const cmd = commandRegistry.get(cmdMatch[1].toLowerCase());
  if (cmd) {
    if (cmd.argOptions?.length) {
      setGhostHint(cmd.argOptions.join(" | "));
    } else if (cmd.args) {
      setGhostHint(cmd.args.replace(/[<>]/g, ""));
    } else {
      setGhostHint(null);
    }
  }
} else {
  setGhostHint(null);
}
```

Render the ghost hint as a positioned overlay inside the input container:

```typescript
{ghostHint && (
  <span
    className="absolute pointer-events-none text-[var(--muted-foreground)] opacity-40 font-mono"
    style={{ left: `${inputTextWidth}px` }} // requires measuring input text width
    aria-hidden
  >
    {ghostHint}
  </span>
)}
```

A simpler approach: use the input's `placeholder` attribute to show the hint, or use a `::after` pseudo-element. The simplest reliable approach is to render a dimmed `<span>` overlaid at the cursor position. Given complexity, a pragmatic approach is to show the ghost hint below the input or as part of the palette display for the selected command.

- [ ] **Step 4: Verify**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm tsc --noEmit --project dashboard/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/panels/chat/MessageInput.tsx dashboard/src/components/panels/chat/SlashCommandPalette.tsx dashboard/src/components/panels/chat/slash-command-executor.ts
git commit -m "[enhanced] feat(deck): add ghost hint parameter placeholder + visibility filtering"
```

---

### Task 10: SSE Full Pipeline — commands.changed Event

**Files:**

- Modify: `dashboard/server/event-bus.ts` (add DeckEventType)
- Modify: `dashboard/server/runtime.ts` (add to VALID_DECK_EVENTS)
- Modify: `src/gateway/server-methods/skills.ts` (emit via context.broadcast)
- Modify: `dashboard/src/hooks/use-command-discovery.ts` (add SSE listener)

**covers:** command-discovery > SSE command change notification (all 3 scenarios)

The SSE pipeline requires 4 touchpoints: Gateway broadcast → runtime validation → EventBus → client listener.

- [ ] **Step 1: Add event type to DeckEventType union**

In `dashboard/server/event-bus.ts`, add `"commands.changed"` to the `DeckEventType` union:

```typescript
export type DeckEventType =
  | "runtime.status"
  // ... existing types ...
  | "commands.changed"; // ADD
```

- [ ] **Step 2: Whitelist in runtime validation**

In `dashboard/server/runtime.ts`, add to `VALID_DECK_EVENTS` Set:

```typescript
const VALID_DECK_EVENTS = new Set<DeckEventType>([
  // ... existing types ...
  "commands.changed", // ADD
]);
```

- [ ] **Step 3: Emit from skills.install/update handler via context.broadcast**

In `src/gateway/server-methods/skills.ts`, after successful `skills.install` and `skills.update`, use the handler's `context.broadcast`:

```typescript
// After successful skill install/update, within the handler:
context.broadcast("commands.changed", { version: "refresh" }, { dropIfSlow: true });
```

Note: The `context` object is available in all Gateway handlers via the `({ params, respond, context })` destructuring. The "refresh" version signals clients to re-discover regardless.

- [ ] **Step 4: Add SSE listener in discovery hook**

In `dashboard/src/hooks/use-command-discovery.ts`, add an EventSource listener:

```typescript
// After the initial discover() call:
const es = new EventSource("/api/stream");
es.addEventListener("commands.changed", () => {
  // Always re-discover on commands.changed (server signals "refresh")
  discover();
});

return () => {
  mountedRef.current = false;
  es.close();
  commandRegistry.unregisterBySource("builtin");
  commandRegistry.unregisterBySource("skill");
  commandRegistry.unregisterBySource("plugin");
};
```

- [ ] **Step 5: Verify**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/server/event-bus.ts dashboard/server/runtime.ts src/gateway/server-methods/skills.ts dashboard/src/hooks/use-command-discovery.ts
git commit -m "[enhanced] feat(deck): wire commands.changed SSE full pipeline"
```

---

### Task 11: Integration Verification

**Files:** No new files — verification only

**covers:** All remaining scenarios that require end-to-end testing

- [ ] **Step 1: Run full type check**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 2: Run lint**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm check 2>&1 | tail -20`
Expected: No formatting/lint errors (fix any that appear)

- [ ] **Step 3: Run protocol check**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm protocol:gen:check 2>&1`
Expected: PASS

- [ ] **Step 4: Run unit tests**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm test -- dashboard/src/lib/command-registry.test.ts 2>&1`
Expected: All tests PASS

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "[enhanced] fix(deck): address lint/type issues from dynamic commands integration"
```

---

## Requirement Coverage Matrix

| Spec Requirement                                              | Scenario                                 | Task   |
| ------------------------------------------------------------- | ---------------------------------------- | ------ |
| command-registry > Dynamic command registration               | Register a local command                 | T2     |
| command-registry > Dynamic command registration               | Register a remote command from discovery | T7     |
| command-registry > Dynamic command registration               | Unregister a command                     | T2     |
| command-registry > Dynamic command registration               | Duplicate name registration              | T2     |
| command-registry > Source-tagged command metadata             | Local command metadata                   | T1, T3 |
| command-registry > Source-tagged command metadata             | Discovered command metadata              | T7     |
| command-registry > Priority-based conflict resolution         | Local overrides builtin                  | T2     |
| command-registry > Priority-based conflict resolution         | Skill does not override local            | T2     |
| command-registry > Command filtering and search               | Prefix search across sources             | T2     |
| command-registry > Command filtering and search               | Empty filter returns all                 | T2     |
| command-registry > Backward-compatible migration              | Migrate existing commands                | T3     |
| command-discovery > Gateway discover RPC                      | Discover returns built-in commands       | T5     |
| command-discovery > Gateway discover RPC                      | Discover returns skill commands          | T5     |
| command-discovery > Gateway discover RPC                      | Discover returns version hash            | T5     |
| command-discovery > Gateway discover RPC                      | Discover with no skills or plugins       | T5     |
| command-discovery > SSE command change notification           | Skill loaded triggers notification       | T10    |
| command-discovery > SSE command change notification           | Client re-discovers on change            | T7     |
| command-discovery > SSE command change notification           | Same version suppresses re-discover      | T7     |
| command-discovery > Discovery hook for React components       | Initial discovery on mount               | T7     |
| command-discovery > Discovery hook for React components       | SSE-driven refresh                       | T7     |
| command-discovery > Discovery hook for React components       | Cleanup on unmount                       | T7     |
| command-discovery > Protocol SDK integration                  | TypeBox schema defined                   | T4, T6 |
| command-discovery > Protocol SDK integration                  | Gateway allowlist updated                | T6     |
| command-execution > Local command execution                   | Execute local config command             | T3     |
| command-execution > Local command execution                   | Execute local UI action                  | T3     |
| command-execution > Local command execution                   | Local command toast feedback             | T3     |
| command-execution > Remote command execution                  | Execute remote builtin command           | T3     |
| command-execution > Remote command execution                  | Execute remote skill command             | T3     |
| command-execution > Remote command execution                  | Remote command result via SSE            | T3     |
| command-execution > Remote command execution                  | Remote command error handling            | T3     |
| command-execution > Unified executor dispatch                 | Registered command dispatches correctly  | T3     |
| command-execution > Unified executor dispatch                 | Unknown command fallback                 | T3     |
| command-execution > Unified executor dispatch                 | Remote command dispatches to chat.send   | T3     |
| command-palette-enhanced > Mixed-source category groups       | Default view shows local + skills        | T8     |
| command-palette-enhanced > Mixed-source category groups       | Skills group displays discovered skills  | T8     |
| command-palette-enhanced > Mixed-source category groups       | More section collapsed by default        | T8     |
| command-palette-enhanced > Mixed-source category groups       | Empty skills group hidden                | T8     |
| command-palette-enhanced > Cross-source prefix search         | Search matches across sources            | T8     |
| command-palette-enhanced > Cross-source prefix search         | Search with no matches                   | T8     |
| command-palette-enhanced > Cross-source prefix search         | Search clears on backspace               | T8     |
| command-palette-enhanced > Ghost hint parameter placeholder   | Static args ghost hint                   | T9     |
| command-palette-enhanced > Ghost hint parameter placeholder   | Enum args ghost hint                     | T9     |
| command-palette-enhanced > Ghost hint parameter placeholder   | No ghost hint for argless commands       | T9     |
| command-palette-enhanced > Context-aware visibility filtering | Stop only visible when streaming         | T9     |
| command-palette-enhanced > Context-aware visibility filtering | Stop visible during streaming            | T9     |
| command-palette-enhanced > Context-aware visibility filtering | Manual input bypasses visibility         | T9     |
| command-palette-enhanced > Dynamic icon resolution            | Local command icon                       | T8     |
| command-palette-enhanced > Dynamic icon resolution            | Skill command default icon               | T8     |
| command-palette-enhanced > Dynamic icon resolution            | Remote builtin default icon              | T8     |
