# Deck Agent Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Context tab to the Agents panel with system prompt composition viewer, bootstrap file editor, tool policy visualization, and enhance the Overview tab with model fallback chain, sandbox mode, and identity preview.

**Architecture:** Two new preview-only Gateway RPCs (`deck.agents.toolPolicy.preview`, `deck.agents.systemPrompt.preview`) call existing internal functions in dry-run mode. A new `ContextTab` component renders three collapsible sections (prompt layers, bootstrap file editor, tool policy). The Overview tab gains sandbox badge, identity preview, and model info. Existing REST routes (`/api/agents/[agentId]/files` and `/api/agents/[agentId]/files/[...path]`) are used for bootstrap file read/write. The `deck.agents.detail` handler is extended with `sandbox`, `identityExists`, and `fallbackModels` fields.

**Tech Stack:** TypeScript, Next.js 16+, React 19, Zustand 5, Tailwind v4 CSS variables, shadcn/ui, next-intl

**Skill dependencies:**

| Domain       | Skills                                                                    | Load method        |
| ------------ | ------------------------------------------------------------------------- | ------------------ |
| `[backend]`  | `superpowers:test-driven-development`                                     | session first load |
| `[frontend]` | `frontend-design`, `ui-ux-pro-max`, `superpowers:test-driven-development` | session first load |

**OpenSpec change:** `deck-agent-workspace`

---

## File Structure

### New Files

| File                                                                  | Responsibility                                                                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/gateway/server-methods/deck/agents-preview.ts`                   | `deck.agents.toolPolicy.preview` + `deck.agents.systemPrompt.preview` RPC handlers |
| `src/gateway/server-methods/deck/agents-preview.test.ts`              | Unit tests for both preview RPCs                                                   |
| `dashboard/src/components/panels/agents/tabs/ContextTab.tsx`          | Context tab — prompt layers + bootstrap editor + tool policy                       |
| `dashboard/src/components/panels/agents/tabs/ToolPolicyViz.tsx`       | Tool policy pipeline diagram + per-tool resolution                                 |
| `dashboard/src/components/panels/agents/tabs/BootstrapFileEditor.tsx` | Inline markdown editor for workspace files                                         |

### Modified Files

| File                                                          | Changes                                                                                   |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/gateway/protocol/schema/deck.ts`                         | Add schemas for both preview RPC params                                                   |
| `src/gateway/protocol/index.ts`                               | Export validators for new schemas                                                         |
| `src/gateway/server-methods-list.ts`                          | Register 2 new methods                                                                    |
| `src/gateway/method-scopes.ts`                                | Add both to READ scope                                                                    |
| `src/gateway/server-methods/deck/index.ts`                    | Import + spread preview handlers                                                          |
| `src/gateway/server-methods/deck/agents.ts`                   | Extend `deck.agents.detail` with sandbox, identityExists, fallbackModels                  |
| `dashboard/server/gateway-allowlist.ts`                       | Add all missing deck.\* methods + 2 new preview methods                                   |
| `dashboard/server/__tests__/gateway-adapter.test.ts`          | Update expected allowlist arrays and counts                                               |
| `dashboard/src/app/api/deck/agents/route.ts`                  | Add 2 new actions (toolPolicy.preview, systemPrompt.preview)                              |
| `dashboard/src/stores/deck-agents.ts`                         | Add preview state/actions + extend AgentDetail type with sandbox/identity/fallback fields |
| `dashboard/src/components/panels/agents/AgentDetail.tsx`      | Add "context" tab                                                                         |
| `dashboard/src/components/panels/agents/tabs/OverviewTab.tsx` | Add sandbox badge, identity preview, context stat card, model info                        |
| `dashboard/src/i18n/zh.json`                                  | Add ~40 i18n keys                                                                         |
| `dashboard/src/i18n/en.json`                                  | Add ~40 i18n keys                                                                         |

---

## Task Dependency Graph

```
T0 (Backend: Extend deck.agents.detail) ─┐
T1 (Backend: Tool Policy Preview) ────────┤
T2 (Backend: System Prompt Preview) ──────┤──→ T3 (Allowlist + API route + Store)
                                          │        ↓
                                          ├──→ T4 (ContextTab — Prompt Viewer)
                                          ├──→ T5 (ContextTab — Bootstrap Editor + Tool Policy Viz)
                                          └──→ T6 (Overview Enhancements)
                                                   ↓
                                               T7 (i18n + Integration)
```

T0, T1, and T2 are independent. T3 depends on T0+T1+T2. T4, T5, T6 depend on T3. T7 depends on all.

---

### Task 0: Backend — Extend `deck.agents.detail` with sandbox/identity/fallback `[backend]`

**covers:** agent-overview-enhancements > Sandbox mode display, Identity preview card, Model fallback chain

**Files:**

- Modify: `src/gateway/server-methods/deck/agents.ts`

**Context:**

`resolveAgentConfig` returns a `ResolvedAgentConfig` (defined in `src/agents/agent-scope.ts`) which already includes `sandbox`, `tools`, and `model` fields. The `model` field can be a string or `{ primary?, fallbacks? }` object. We add three fields to the response:

- `sandbox`: the agent's sandbox config (from `agentConfig.sandbox`), or undefined if not configured
- `identityExists`: boolean, whether IDENTITY.md exists in the workspace dir (fs.stat check)
- `fallbackModels`: string array extracted from model config when model is `{ primary, fallbacks }`

These are purely read-only extractions from existing config data.

- [ ] **Step 1: Add sandbox, identityExists, fallbackModels to response**

In `src/gateway/server-methods/deck/agents.ts`, modify the `deck.agents.detail` handler:

```typescript
import { stat } from "node:fs/promises";
import { join } from "node:path";

// Inside the handler, after resolving agentConfig:

// Sandbox config
const sandbox = agentConfig.sandbox;

// Identity existence check
let identityExists = false;
try {
  const identityPath = join(workspaceDir, "IDENTITY.md");
  await stat(identityPath);
  identityExists = true;
} catch {
  // File does not exist
}

// Fallback models
let fallbackModels: string[] | undefined;
if (
  agentConfig.model &&
  typeof agentConfig.model === "object" &&
  "fallbacks" in agentConfig.model
) {
  const fb = (agentConfig.model as { fallbacks?: string[] }).fallbacks;
  if (Array.isArray(fb)) {
    fallbackModels = fb;
  }
}

// Add to respond() payload:
respond(true, {
  // ... existing fields ...
  sandbox,
  identityExists,
  fallbackModels,
});
```

- [ ] **Step 2: Run existing agent tests**

Run: `pnpm vitest run src/gateway/server-methods/deck/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/gateway/server-methods/deck/agents.ts
git commit -m "[enhanced] [impl] feat(deck): extend deck.agents.detail with sandbox, identity, fallback data"
```

---

### Task 1: Backend — Tool Policy Preview RPC `[backend]`

**covers:** agent-workspace-rpc > Tool policy preview RPC > "Basic tool policy preview", "Context-sensitive tool policy preview", "Unknown agent ID"

**Files:**

- Create: `src/gateway/server-methods/deck/agents-preview.ts`
- Create: `src/gateway/server-methods/deck/agents-preview.test.ts`
- Modify: `src/gateway/protocol/schema/deck.ts`
- Modify: `src/gateway/protocol/index.ts`
- Modify: `src/gateway/server-methods-list.ts`
- Modify: `src/gateway/method-scopes.ts`
- Modify: `src/gateway/server-methods/deck/index.ts`

**Context:**

The existing tool policy pipeline works as follows:

1. `buildDefaultToolPolicyPipelineSteps(params)` in `src/agents/tool-policy-pipeline.ts` builds 7 `ToolPolicyPipelineStep[]` objects, each with `{ policy: ToolPolicyLike | undefined, label: string, stripPluginOnlyAllowlist?: boolean }`.
2. `applyToolPolicyPipeline()` runs tools through all steps sequentially: for each step, it calls `stripPluginOnlyAllowlist()` (if flagged), then `expandPolicyWithPluginGroups()`, then `filterToolsByPolicy(filtered, expanded)`.
3. `filterToolsByPolicy(tools, policy)` in `src/agents/pi-tools.policy.ts` creates a matcher via `makeToolPolicyMatcher(policy)` which uses `compileGlobPatterns` for glob expansion, handles the `apply_patch`/`exec` alias, and supports `group:*` expansion. The matcher checks deny first, then allow, with `allow: []` meaning "deny all not explicitly listed".
4. `pickSandboxToolPolicy(config)` in `src/agents/sandbox-tool-policy.ts` converts config-level `{ allow?, alsoAllow?, deny? }` into `SandboxToolPolicy { allow?, deny? }` (merging alsoAllow into allow).
5. `resolveEffectiveToolPolicy(params)` in `src/agents/pi-tools.policy.ts` resolves all 7 layers from config using `pickSandboxToolPolicy()`.

**The preview handler must use the REAL pipeline for accurate per-tool traces:**

1. Use `resolveEffectiveToolPolicy()` to resolve all policy layers from config for the given agentId
2. Build the 7-step pipeline via `buildDefaultToolPolicyPipelineSteps()`
3. For each tool name, create a minimal `AnyAgentTool`-like object (`{ name }`) and test it against each layer individually using `isToolAllowedByPolicyName(name, policy)` where `policy` is the `SandboxToolPolicy` from `pickSandboxToolPolicy()`
4. Build layer summaries and per-tool trace results from these real checks

This ensures glob expansion, `apply_patch`/`exec` aliasing, group expansion, and `stripPluginOnlyAllowlist` semantics are all correctly reflected.

- [ ] **Step 1: Add `NOT_FOUND` to ErrorCodes + param schema**

First, add `NOT_FOUND` to `src/gateway/protocol/schema/error-codes.ts` (it's missing but already used by existing `deck/agents.ts` handlers):

```typescript
export const ErrorCodes = {
  NOT_FOUND: "NOT_FOUND", // <-- add this line
  NOT_LINKED: "NOT_LINKED",
  // ... existing entries
} as const;
```

Then in `src/gateway/protocol/schema/deck.ts`, add:

```typescript
export const DeckAgentsToolPolicyPreviewParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    context: Type.Optional(
      Type.Object({
        channel: Type.Optional(Type.String()),
        chatType: Type.Optional(Type.String()),
      }),
    ),
  },
  { additionalProperties: false },
);
```

In `src/gateway/protocol/index.ts`, add the compiled validator export:

```typescript
export const validateDeckAgentsToolPolicyPreviewParams = compileValidator(
  DeckAgentsToolPolicyPreviewParamsSchema,
);
```

- [ ] **Step 2: Write the test file**

Create `src/gateway/server-methods/deck/agents-preview.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../config/config.js", () => ({
  loadConfig: vi.fn(() => ({
    agents: {
      list: [
        { id: "main", name: "Main Agent", workspace: "/tmp/main" },
        {
          id: "coder",
          name: "Coder",
          workspace: "/tmp/coder",
          tools: { allow: ["bash", "edit"], deny: ["web_search"] },
        },
      ],
    },
    tools: {
      profile: "coding",
      allow: ["bash", "edit", "web_search", "file_read"],
    },
  })),
  resolveConfigSnapshotHash: vi.fn(() => "hash-123"),
  readConfigFileSnapshotForWrite: vi.fn(async () => ({
    snapshot: { config: {} },
  })),
}));

vi.mock("../../../agents/agent-scope.js", () => ({
  resolveAgentConfig: vi.fn(
    (cfg: any, agentId: string) => cfg.agents?.list?.find((a: any) => a.id === agentId) ?? null,
  ),
}));

import { deckAgentsPreviewHandlers } from "./agents-preview.js";
import type { GatewayRequestHandlerOptions, RespondFn } from "../types.js";

function callHandler(
  method: string,
  params: Record<string, unknown>,
): Promise<{ ok: boolean; payload?: unknown; error?: unknown }> {
  return new Promise((resolve) => {
    const respond: RespondFn = (ok, payload, error) => resolve({ ok, payload, error });
    const handler = deckAgentsPreviewHandlers[method];
    if (!handler) throw new Error(`Handler "${method}" not found`);
    const result = handler({
      params,
      respond,
      req: { type: "req" as const, id: "test-1", method, params },
      client: null,
      isWebchatConnect: () => false,
      context: {} as GatewayRequestHandlerOptions["context"],
    });
    if (result && typeof result === "object" && "then" in result) {
      void (result as Promise<void>).catch(() => {});
    }
  });
}

describe("deck.agents.toolPolicy.preview", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns layers and tool list for valid agent", async () => {
    const result = await callHandler("deck.agents.toolPolicy.preview", {
      agentId: "main",
    });
    expect(result.ok).toBe(true);
    const p = result.payload as { layers: unknown[]; tools: unknown[]; configHash: string };
    expect(p.layers).toBeDefined();
    expect(Array.isArray(p.layers)).toBe(true);
    expect(p.layers.length).toBe(7);
    expect(p.configHash).toBe("hash-123");
  });

  it("returns NOT_FOUND for unknown agent", async () => {
    const result = await callHandler("deck.agents.toolPolicy.preview", {
      agentId: "nonexistent",
    });
    expect(result.ok).toBe(false);
    const err = result.error as { code: string };
    expect(err.code).toBe("NOT_FOUND");
  });

  it("rejects invalid params", async () => {
    const result = await callHandler("deck.agents.toolPolicy.preview", {});
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm vitest run src/gateway/server-methods/deck/agents-preview.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 4: Implement the handler**

Create `src/gateway/server-methods/deck/agents-preview.ts`:

```typescript
import { resolveAgentConfig } from "../../../agents/agent-scope.js";
import {
  isToolAllowedByPolicyName,
  resolveEffectiveToolPolicy,
} from "../../../agents/pi-tools.policy.js";
import { pickSandboxToolPolicy } from "../../../agents/sandbox-tool-policy.js";
import {
  buildDefaultToolPolicyPipelineSteps,
  type ToolPolicyPipelineStep,
} from "../../../agents/tool-policy-pipeline.js";
import {
  loadConfig,
  readConfigFileSnapshotForWrite,
  resolveConfigSnapshotHash,
} from "../../../config/config.js";
import {
  ErrorCodes,
  errorShape,
  validateDeckAgentsToolPolicyPreviewParams,
} from "../../protocol/index.js";
import type { GatewayRequestHandlers } from "../types.js";
import { assertValidParams } from "../validation.js";

type LayerDecision = "allow" | "deny" | "no-opinion";

// Test a tool name against a single pipeline step's SandboxToolPolicy.
// Uses the real isToolAllowedByPolicyName which handles glob expansion,
// apply_patch/exec alias, and group:* expansion.
function resolveLayerDecision(toolName: string, step: ToolPolicyPipelineStep): LayerDecision {
  const policy = step.policy;
  if (!policy) return "no-opinion";
  // Convert ToolPolicyLike to SandboxToolPolicy via pickSandboxToolPolicy
  const sandboxPolicy = pickSandboxToolPolicy(policy);
  if (!sandboxPolicy) return "no-opinion";
  const allowed = isToolAllowedByPolicyName(toolName, sandboxPolicy);
  // Determine if this layer actively made a decision or was passthrough
  const hasRules = (sandboxPolicy.allow?.length ?? 0) > 0 || (sandboxPolicy.deny?.length ?? 0) > 0;
  if (!hasRules) return "no-opinion";
  return allowed ? "allow" : "deny";
}

function countRules(step: ToolPolicyPipelineStep): number {
  const policy = step.policy;
  if (!policy) return 0;
  return (policy.allow?.length ?? 0) + (policy.deny?.length ?? 0);
}

function resolveLayerEffect(step: ToolPolicyPipelineStep): "allow" | "deny" | "passthrough" {
  const policy = step.policy;
  if (!policy) return "passthrough";
  const hasAllow = (policy.allow?.length ?? 0) > 0;
  const hasDeny = (policy.deny?.length ?? 0) > 0;
  if (hasAllow && hasDeny) return "deny"; // mixed = restrictive
  if (hasAllow) return "allow";
  if (hasDeny) return "deny";
  return "passthrough";
}

// Default preview tool names when no config-level list is available.
// These cover the core built-in tools that most agents have access to.
const DEFAULT_PREVIEW_TOOLS = [
  "bash",
  "edit",
  "read",
  "write",
  "glob",
  "grep",
  "web_search",
  "web_fetch",
  "message_send",
  "approval",
  "subagent",
];

export const deckAgentsPreviewHandlers: GatewayRequestHandlers = {
  "deck.agents.toolPolicy.preview": async ({ params, respond }) => {
    if (
      !assertValidParams(
        params,
        validateDeckAgentsToolPolicyPreviewParams,
        "deck.agents.toolPolicy.preview",
        respond,
      )
    ) {
      return;
    }

    const agentId = (params as { agentId: string }).agentId;
    const cfg = loadConfig();
    const agentConfig = resolveAgentConfig(cfg, agentId);
    if (!agentConfig) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    // Use the real resolveEffectiveToolPolicy to get all 7 policy layers
    const effective = resolveEffectiveToolPolicy({
      config: cfg,
      agentId,
    });

    // Build the 7-step pipeline using the resolved policies
    const steps = buildDefaultToolPolicyPipelineSteps({
      profilePolicy: effective.globalPolicy, // profile-resolved policy
      profile: effective.profile,
      providerProfilePolicy: effective.globalProviderPolicy,
      providerProfile: effective.providerProfile,
      globalPolicy: effective.globalPolicy,
      globalProviderPolicy: effective.globalProviderPolicy,
      agentPolicy: effective.agentPolicy,
      agentProviderPolicy: effective.agentProviderPolicy,
      agentId,
    });

    // Build layers summary
    const layers = steps.map((step) => ({
      label: step.label,
      ruleCount: countRules(step),
      effect: resolveLayerEffect(step),
    }));

    // Resolve tool names: collect from all allow lists, then merge with defaults
    const allConfiguredTools = new Set<string>(DEFAULT_PREVIEW_TOOLS);
    for (const step of steps) {
      if (step.policy?.allow) {
        for (const t of step.policy.allow) {
          allConfiguredTools.add(t);
        }
      }
    }
    const toolNames = [...allConfiguredTools];

    // Build per-tool traces using the REAL policy pipeline.
    // For each tool, run it through each layer individually using
    // isToolAllowedByPolicyName (which handles glob, apply_patch alias, groups).
    const tools = toolNames.map((toolName) => {
      const trace = steps.map((step) => ({
        layer: step.label,
        decision: resolveLayerDecision(toolName, step),
      }));

      // Final resolution: last non-no-opinion decision wins
      let finalDecision: "allow" | "deny" = "allow"; // default: allowed
      let decisiveLayer = "default";
      for (const t of trace) {
        if (t.decision !== "no-opinion") {
          finalDecision = t.decision === "deny" ? "deny" : "allow";
          decisiveLayer = t.layer;
        }
      }

      return {
        name: toolName,
        allowed: finalDecision === "allow",
        decisiveLayer,
        trace,
      };
    });

    const { snapshot } = await readConfigFileSnapshotForWrite();
    const configHash = resolveConfigSnapshotHash(snapshot) ?? "";

    respond(true, { layers, tools, configHash });
  },
};
```

- [ ] **Step 5: Register in method-scopes, server-methods-list, deck/index**

In `src/gateway/server-methods-list.ts`, add `"deck.agents.toolPolicy.preview"` to `BASE_METHODS` (in the `// deck.agents` section).

In `src/gateway/method-scopes.ts`, add `"deck.agents.toolPolicy.preview"` to the `READ_SCOPE` array (alongside `deck.agents.detail`).

In `src/gateway/server-methods/deck/index.ts`, import and spread `deckAgentsPreviewHandlers`.

- [ ] **Step 6: Run tests**

Run: `pnpm vitest run src/gateway/server-methods/deck/agents-preview.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/gateway/server-methods/deck/agents-preview.ts \
  src/gateway/server-methods/deck/agents-preview.test.ts \
  src/gateway/protocol/schema/deck.ts \
  src/gateway/protocol/index.ts \
  src/gateway/server-methods-list.ts \
  src/gateway/method-scopes.ts \
  src/gateway/server-methods/deck/index.ts
git commit -m "[enhanced] [impl] feat(deck): add deck.agents.toolPolicy.preview RPC"
```

---

### Task 2: Backend — System Prompt Preview RPC `[backend]`

**covers:** agent-workspace-rpc > System prompt preview RPC > "Basic system prompt preview", "Unknown agent ID"; agent-workspace-rpc > Both preview RPCs are read-only > "No side effects from preview"; agent-workspace-rpc > Preview RPCs registered > "Dashboard can call preview RPCs"

**Files:**

- Modify: `src/gateway/server-methods/deck/agents-preview.ts`
- Modify: `src/gateway/server-methods/deck/agents-preview.test.ts`
- Modify: `src/gateway/protocol/schema/deck.ts`
- Modify: `src/gateway/protocol/index.ts`
- Modify: `src/gateway/server-methods-list.ts`
- Modify: `src/gateway/method-scopes.ts`

**Context:**

`buildEmbeddedSystemPrompt` in `src/agents/pi-embedded-runner/system-prompt.ts` requires 20+ params. For preview, we cannot create a real agent session. Instead, the preview RPC:

1. Loads config for the agent
2. Loads workspace bootstrap files via `loadWorkspaceBootstrapFiles(workspaceDir)`
3. Returns layer summaries (bootstrap files list with sizes, skills prompt stats, etc.)

The full assembled prompt text is intentionally **not** returned (it would require a live session with tools + model selection). The `assembledPrompt` field is omitted. The spec marks it as optional/best-effort (see F1 fix). Instead, we return the layer breakdown that shows what _would_ compose the prompt.

- [ ] **Step 1: Add param schema**

In `src/gateway/protocol/schema/deck.ts`, add:

```typescript
export const DeckAgentsSystemPromptPreviewParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    context: Type.Optional(
      Type.Object({
        channel: Type.Optional(Type.String()),
        chatType: Type.Optional(Type.String()),
      }),
    ),
  },
  { additionalProperties: false },
);
```

In `src/gateway/protocol/index.ts`, add the compiled validator export.

- [ ] **Step 2: Add tests for system prompt preview**

Add to `agents-preview.test.ts`:

```typescript
vi.mock("../../../agents/workspace.js", () => ({
  loadWorkspaceBootstrapFiles: vi.fn(async () => [
    {
      name: "AGENTS.md",
      path: "/tmp/main/AGENTS.md",
      content: "# Agent instructions",
      missing: false,
    },
    { name: "SOUL.md", path: "/tmp/main/SOUL.md", content: undefined, missing: true },
  ]),
  DEFAULT_SOUL_FILENAME: "SOUL.md",
  DEFAULT_TOOLS_FILENAME: "TOOLS.md",
  DEFAULT_IDENTITY_FILENAME: "IDENTITY.md",
  DEFAULT_USER_FILENAME: "USER.md",
  DEFAULT_HEARTBEAT_FILENAME: "HEARTBEAT.md",
  DEFAULT_BOOTSTRAP_FILENAME: "BOOTSTRAP.md",
  DEFAULT_AGENTS_FILENAME: "AGENTS.md",
}));

describe("deck.agents.systemPrompt.preview", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns bootstrap files and prompt stats for valid agent", async () => {
    const result = await callHandler("deck.agents.systemPrompt.preview", {
      agentId: "main",
    });
    expect(result.ok).toBe(true);
    const p = result.payload as {
      bootstrapFiles: Array<{ name: string; exists: boolean; charCount: number }>;
      configHash: string;
    };
    expect(p.bootstrapFiles).toBeDefined();
    expect(Array.isArray(p.bootstrapFiles)).toBe(true);
    expect(p.configHash).toBe("hash-123");
  });

  it("returns NOT_FOUND for unknown agent", async () => {
    const result = await callHandler("deck.agents.systemPrompt.preview", {
      agentId: "nonexistent",
    });
    expect(result.ok).toBe(false);
    const err = result.error as { code: string };
    expect(err.code).toBe("NOT_FOUND");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/gateway/server-methods/deck/agents-preview.test.ts`
Expected: FAIL -- handler not found for `deck.agents.systemPrompt.preview`

- [ ] **Step 4: Implement the handler**

Add to `agents-preview.ts`:

```typescript
import {
  loadWorkspaceBootstrapFiles,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_USER_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
  DEFAULT_AGENTS_FILENAME,
} from "../../../agents/workspace.js";
// Add validateDeckAgentsSystemPromptPreviewParams import

const WELL_KNOWN_FILES = [
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_USER_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
];

// Add to deckAgentsPreviewHandlers:
"deck.agents.systemPrompt.preview": async ({ params, respond }) => {
    if (!assertValidParams(params, validateDeckAgentsSystemPromptPreviewParams,
      "deck.agents.systemPrompt.preview", respond)) {
      return;
    }

    const agentId = (params as { agentId: string }).agentId;
    const cfg = loadConfig();
    const agentConfig = resolveAgentConfig(cfg, agentId);
    if (!agentConfig) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, `Agent "${agentId}" not found`));
      return;
    }

    const workspaceDir = agentConfig.workspace ?? "/tmp";

    // Load bootstrap files
    let bootstrapFiles: Array<{ name: string; path: string; content?: string; missing?: boolean }> = [];
    try {
      bootstrapFiles = await loadWorkspaceBootstrapFiles(workspaceDir);
    } catch {
      // Workspace may not exist yet -- return empty list
    }

    // Map to response format
    const bootstrapFilesResult = WELL_KNOWN_FILES.map((name) => {
      const found = bootstrapFiles.find((f) => f.name === name);
      return {
        name,
        exists: found ? !found.missing : false,
        charCount: found?.content?.length ?? 0,
      };
    });

    // Build prompt layer summaries from available config
    const extraSystemPrompt = typeof (agentConfig as Record<string, unknown>).systemPrompt === "string"
      ? (agentConfig as Record<string, unknown>).systemPrompt as string
      : undefined;

    const layers = [
      {
        label: "Bootstrap Files",
        source: workspaceDir,
        charCount: bootstrapFiles.reduce((sum, f) => sum + (f.content?.length ?? 0), 0),
        fileCount: bootstrapFiles.filter((f) => !f.missing && f.content).length,
      },
      {
        label: "Identity",
        source: `${workspaceDir}/IDENTITY.md`,
        charCount: bootstrapFiles.find((f) => f.name === DEFAULT_IDENTITY_FILENAME)?.content?.length ?? 0,
      },
      {
        label: "Skills Prompt",
        source: "skills injection",
        charCount: 0, // Cannot estimate without live session
      },
      {
        label: "Extra Instructions",
        source: "agents.<id>.systemPrompt",
        charCount: extraSystemPrompt?.length ?? 0,
        content: extraSystemPrompt ?? "",
      },
    ];

    const totalChars = layers.reduce((sum, l) => sum + l.charCount, 0);

    const { snapshot } = await readConfigFileSnapshotForWrite();
    const configHash = resolveConfigSnapshotHash(snapshot) ?? "";

    respond(true, {
      layers,
      bootstrapFiles: bootstrapFilesResult,
      totalChars,
      configHash,
    });
  },
```

- [ ] **Step 5: Register in method-scopes, server-methods-list**

Add `"deck.agents.systemPrompt.preview"` to READ scope and `BASE_METHODS`.

- [ ] **Step 6: Run tests**

Run: `pnpm vitest run src/gateway/server-methods/deck/agents-preview.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/gateway/server-methods/deck/agents-preview.ts \
  src/gateway/server-methods/deck/agents-preview.test.ts \
  src/gateway/protocol/schema/deck.ts \
  src/gateway/protocol/index.ts \
  src/gateway/server-methods-list.ts \
  src/gateway/method-scopes.ts
git commit -m "[enhanced] [impl] feat(deck): add deck.agents.systemPrompt.preview RPC"
```

---

### Task 3: Dashboard Allowlist + API Route + Store Extensions `[frontend]`

**covers:** agent-workspace-rpc > Preview RPCs registered > "Dashboard can call preview RPCs"

**Files:**

- Modify: `dashboard/server/gateway-allowlist.ts`
- Modify: `dashboard/server/__tests__/gateway-adapter.test.ts`
- Modify: `dashboard/src/app/api/deck/agents/route.ts`
- Modify: `dashboard/src/stores/deck-agents.ts`

**Context:**

The store follows a pattern: POST with `{ action, ...params }` to `/api/deck/agents`. The API route dispatches by `action` to the corresponding gateway RPC. For bootstrap file editing, the store uses the existing REST routes directly:

- `GET /api/agents/${agentId}/files` -- list files (calls `agents.files.list`)
- `GET /api/agents/${agentId}/files/${name}` -- get file content (calls `agents.files.get`)
- `POST /api/agents/${agentId}/files` -- set file content, body: `{ name, content }` (calls `agents.files.set`)

These routes already exist at `dashboard/src/app/api/agents/[agentId]/files/route.ts` and `dashboard/src/app/api/agents/[agentId]/files/[...path]/route.ts`, and the underlying RPCs (`agents.files.get/set/list`) are already in the allowlist.

- [ ] **Step 1: Add all missing methods to allowlist**

In `dashboard/server/gateway-allowlist.ts`, add ALL missing `deck.*` methods to the set. Cross-reference with `src/gateway/server-methods-list.ts` to find every `deck.*` method:

```typescript
  // deck.agents (existing -- all were missing from allowlist)
  "deck.agents.detail",
  "deck.agents.skills.get",
  "deck.agents.skills.set",
  "deck.agents.subagents.get",
  "deck.agents.subagents.set",
  // deck.agents preview (new)
  "deck.agents.toolPolicy.preview",
  "deck.agents.systemPrompt.preview",
  // deck.routing (existing -- missing from allowlist)
  "deck.routing.list",
  "deck.routing.add",
  "deck.routing.remove",
  "deck.routing.validate",
  "deck.routing.simulate",
  // deck.auth (existing -- missing from allowlist)
  "deck.auth.overview",
  "deck.auth.probe",
  // deck.identity (existing -- missing from allowlist)
  "deck.identity.list",
  "deck.identity.link",
  "deck.identity.unlink",
  // deck.threads (existing -- missing from allowlist)
  "deck.threads.list",
```

Note: `deck.subagents.*` methods are already in the allowlist.

- [ ] **Step 2: Update allowlist test**

In `dashboard/server/__tests__/gateway-adapter.test.ts`, add the new methods to the `deckAdditions` array:

```typescript
const deckAdditions = [
  // ... existing entries ...
  // deck.agents
  "deck.agents.detail",
  "deck.agents.skills.get",
  "deck.agents.skills.set",
  "deck.agents.subagents.get",
  "deck.agents.subagents.set",
  "deck.agents.toolPolicy.preview",
  "deck.agents.systemPrompt.preview",
  // deck.routing
  "deck.routing.list",
  "deck.routing.add",
  "deck.routing.remove",
  "deck.routing.validate",
  "deck.routing.simulate",
  // deck.auth
  "deck.auth.overview",
  "deck.auth.probe",
  // deck.identity
  "deck.identity.list",
  "deck.identity.link",
  "deck.identity.unlink",
  // deck.threads
  "deck.threads.list",
];
```

The `expectedTotal` in the "has exactly the expected number of methods" test will be automatically correct since it sums `originalStudioMethods.length + deckAdditions.length`.

- [ ] **Step 3: Extend API route with preview actions only**

In `dashboard/src/app/api/deck/agents/route.ts`, extend `AgentAction` type and add switch cases for the two NEW preview actions only. Do NOT add `files.list/get/set` -- those use the existing REST routes at `/api/agents/[agentId]/files`:

```typescript
type AgentAction =
  | "skills.get"
  | "skills.set"
  | "subagents.get"
  | "subagents.set"
  | "toolPolicy.preview"
  | "systemPrompt.preview";
```

Add cases to the switch:

```typescript
    case "toolPolicy.preview":
      return gatewayRequest("deck.agents.toolPolicy.preview", params);
    case "systemPrompt.preview":
      return gatewayRequest("deck.agents.systemPrompt.preview", params);
```

- [ ] **Step 4: Extend store types and AgentDetail**

In `dashboard/src/stores/deck-agents.ts`, add types and extend `AgentDetail`:

```typescript
export interface AgentDetail {
  // ... existing fields ...
  sandbox?: unknown; // Agent sandbox config from agentConfig.sandbox
  identityExists?: boolean; // Whether IDENTITY.md exists in workspace
  fallbackModels?: string[]; // Model fallback chain (from model.fallbacks)
}

export interface ToolPolicyLayer {
  label: string;
  ruleCount: number;
  effect: "allow" | "deny" | "passthrough";
}

export interface ToolPolicyTool {
  name: string;
  allowed: boolean;
  decisiveLayer: string;
  trace: Array<{ layer: string; decision: "allow" | "deny" | "no-opinion" }>;
}

export interface ToolPolicyPreview {
  layers: ToolPolicyLayer[];
  tools: ToolPolicyTool[];
  configHash: string;
}

export interface PromptLayer {
  label: string;
  source: string;
  charCount: number;
  fileCount?: number;
  content?: string;
}

export interface BootstrapFileEntry {
  name: string;
  exists: boolean;
  charCount: number;
}

export interface SystemPromptPreview {
  layers: PromptLayer[];
  bootstrapFiles: BootstrapFileEntry[];
  totalChars: number;
  configHash: string;
}

export interface BootstrapFileDetail {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
}
```

- [ ] **Step 5: Add store actions**

Add to `DeckAgentsState` interface and implementation:

```typescript
// State
toolPolicyPreview: ToolPolicyPreview | null;
systemPromptPreview: SystemPromptPreview | null;
bootstrapFileDetail: BootstrapFileDetail | null;

// Actions
fetchToolPolicyPreview: (agentId: string) => Promise<void>;
fetchSystemPromptPreview: (agentId: string) => Promise<void>;
fetchBootstrapFile: (agentId: string, name: string) => Promise<void>;
saveBootstrapFile: (agentId: string, name: string, content: string) => Promise<boolean>;
```

Implementation -- preview actions use POST to `/api/deck/agents`, file actions use the existing REST routes:

```typescript
  toolPolicyPreview: null,
  systemPromptPreview: null,
  bootstrapFileDetail: null,

  fetchToolPolicyPreview: async (agentId) => {
    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toolPolicy.preview", agentId }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as ToolPolicyPreview;
      set({ toolPolicyPreview: data });
    } catch { /* ignore */ }
  },

  fetchSystemPromptPreview: async (agentId) => {
    try {
      const res = await fetch("/api/deck/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "systemPrompt.preview", agentId }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as SystemPromptPreview;
      set({ systemPromptPreview: data });
    } catch { /* ignore */ }
  },

  fetchBootstrapFile: async (agentId, name) => {
    try {
      // Use existing REST route: GET /api/agents/[agentId]/files/[name]
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/files/${encodeURIComponent(name)}`);
      if (!res.ok) return;
      const data = (await res.json()) as BootstrapFileDetail;
      set({ bootstrapFileDetail: data });
    } catch { /* ignore */ }
  },

  saveBootstrapFile: async (agentId, name, content) => {
    try {
      // Use existing REST route: POST /api/agents/[agentId]/files
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },
```

- [ ] **Step 6: Verify types compile**

Run: `cd dashboard && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Run allowlist tests**

Run: `pnpm vitest run dashboard/server/__tests__/gateway-adapter.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add dashboard/server/gateway-allowlist.ts \
  dashboard/server/__tests__/gateway-adapter.test.ts \
  dashboard/src/app/api/deck/agents/route.ts \
  dashboard/src/stores/deck-agents.ts
git commit -m "[enhanced] [impl] feat(deck): extend allowlist, API route, and store for agent workspace"
```

---

### Task 4: Context Tab — Prompt Composition Viewer `[frontend]`

**covers:** agent-context-tab > Context tab displays system prompt composition layers > "Agent with all prompt layers populated", "Agent with minimal configuration"; agent-context-tab > Context tab uses collapsible sections > "Default collapsed state", "Expand a section"

**Files:**

- Create: `dashboard/src/components/panels/agents/tabs/ContextTab.tsx`
- Modify: `dashboard/src/components/panels/agents/AgentDetail.tsx`

**Context:**

The Context tab is a top-level component that wraps three collapsible sections:

1. **Prompt Layers** -- fetches `systemPromptPreview` on mount, renders each layer as a collapsible card
2. **Bootstrap Files** -- file list (from the preview data) with click-to-edit (delegated to BootstrapFileEditor, Task 5)
3. **Tool Policy** -- delegated to ToolPolicyViz (Task 5)

This task focuses on the prompt composition viewer only. The bootstrap editor and tool policy viz are separate sub-components wired in Task 5.

`AgentDetail.tsx` must add "context" to the `TabValue` union and render the `ContextTab` between Skills and Subagent tabs.

- [ ] **Step 1: Create ContextTab component**

Create `dashboard/src/components/panels/agents/tabs/ContextTab.tsx`:

```tsx
"use client";

import { ChevronDown, ChevronRight, FileText, Layers, RefreshCw, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useDeckAgentsStore } from "@/stores/deck-agents";

interface ContextTabProps {
  agentId: string;
}

export function ContextTab({ agentId }: ContextTabProps) {
  const t = useTranslations("context");
  const {
    systemPromptPreview,
    fetchSystemPromptPreview,
    toolPolicyPreview,
    fetchToolPolicyPreview,
  } = useDeckAgentsStore();

  const [promptOpen, setPromptOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(true);
  const [policyOpen, setPolicyOpen] = useState(false);

  useEffect(() => {
    void fetchSystemPromptPreview(agentId);
    void fetchToolPolicyPreview(agentId);
  }, [agentId, fetchSystemPromptPreview, fetchToolPolicyPreview]);

  const handleRefresh = useCallback(() => {
    void fetchSystemPromptPreview(agentId);
    void fetchToolPolicyPreview(agentId);
  }, [agentId, fetchSystemPromptPreview, fetchToolPolicyPreview]);

  return (
    <div className="space-y-4">
      {/* Refresh button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">{t("title")}</h3>
        <Button variant="ghost" size="sm" onClick={handleRefresh} className="h-7 px-2">
          <RefreshCw size={12} className="mr-1" />
          <span className="text-xs">{t("refresh")}</span>
        </Button>
      </div>

      {/* Prompt Layers Section */}
      <Collapsible open={promptOpen} onOpenChange={setPromptOpen}>
        <Card className="bg-[var(--bg-primary)] border-[var(--border)]">
          <CollapsibleTrigger render={<button className="w-full cursor-pointer" />}>
            <CardHeader className="pb-2 flex flex-row items-center gap-2">
              {promptOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Layers size={14} className="text-[var(--accent)]" />
              <CardTitle className="text-xs flex-1">{t("promptLayers")}</CardTitle>
              {systemPromptPreview && (
                <Badge variant="secondary" className="text-[10px]">
                  {systemPromptPreview.totalChars.toLocaleString()} chars
                </Badge>
              )}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-2">
              {systemPromptPreview?.layers.map((layer) => (
                <div
                  key={layer.label}
                  className="flex items-center justify-between px-3 py-2 rounded-md bg-[var(--bg-secondary)] text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-primary)] font-medium">{layer.label}</span>
                    <span className="text-[var(--text-secondary)]">{layer.source}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {layer.charCount.toLocaleString()}
                  </Badge>
                </div>
              )) ?? <p className="text-xs text-[var(--text-secondary)]">{t("loading")}</p>}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Bootstrap Files Section */}
      <Collapsible open={filesOpen} onOpenChange={setFilesOpen}>
        <Card className="bg-[var(--bg-primary)] border-[var(--border)]">
          <CollapsibleTrigger render={<button className="w-full cursor-pointer" />}>
            <CardHeader className="pb-2 flex flex-row items-center gap-2">
              {filesOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <FileText size={14} className="text-[var(--accent)]" />
              <CardTitle className="text-xs flex-1">{t("bootstrapFiles")}</CardTitle>
              {systemPromptPreview && (
                <Badge variant="secondary" className="text-[10px]">
                  {systemPromptPreview.bootstrapFiles.filter((f) => f.exists).length}/
                  {systemPromptPreview.bootstrapFiles.length}
                </Badge>
              )}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {/* BootstrapFileEditor will be added in Task 5 */}
              <div className="space-y-1">
                {systemPromptPreview?.bootstrapFiles.map((file) => (
                  <div
                    key={file.name}
                    className="flex items-center justify-between px-3 py-2 rounded-md bg-[var(--bg-secondary)] text-xs"
                  >
                    <span
                      className={`font-mono ${file.exists ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
                    >
                      {file.name}
                    </span>
                    {file.exists ? (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {file.charCount.toLocaleString()}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {t("notCreated")}
                      </span>
                    )}
                  </div>
                )) ?? <p className="text-xs text-[var(--text-secondary)]">{t("loading")}</p>}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Tool Policy Section */}
      <Collapsible open={policyOpen} onOpenChange={setPolicyOpen}>
        <Card className="bg-[var(--bg-primary)] border-[var(--border)]">
          <CollapsibleTrigger render={<button className="w-full cursor-pointer" />}>
            <CardHeader className="pb-2 flex flex-row items-center gap-2">
              {policyOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Shield size={14} className="text-[var(--accent)]" />
              <CardTitle className="text-xs flex-1">{t("toolPolicy")}</CardTitle>
              {toolPolicyPreview && (
                <Badge variant="secondary" className="text-[10px]">
                  {toolPolicyPreview.tools.filter((t) => t.allowed).length}/
                  {toolPolicyPreview.tools.length} {t("allowed")}
                </Badge>
              )}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {/* ToolPolicyViz will be added in Task 5 */}
              <p className="text-xs text-[var(--text-secondary)]">{t("loading")}</p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
```

- [ ] **Step 2: Register Context tab in AgentDetail**

In `dashboard/src/components/panels/agents/AgentDetail.tsx`:

1. Add import: `import { ContextTab } from "./tabs/ContextTab";`
2. Extend `TabValue`: `type TabValue = "overview" | "routing" | "skills" | "context" | "subagent" | "sessions";`
3. Add `TabsTrigger` between skills and subagent: `<TabsTrigger value="context">{t("context")}</TabsTrigger>`
4. Add `TabsContent` between skills and subagent:

```tsx
<TabsContent value="context" className="p-4">
  <ContextTab agentId={agentId} />
</TabsContent>
```

- [ ] **Step 3: Verify types compile**

Run: `cd dashboard && npx tsc --noEmit`
Expected: 0 errors (may need i18n keys -- add placeholder keys if needed)

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/panels/agents/tabs/ContextTab.tsx \
  dashboard/src/components/panels/agents/AgentDetail.tsx
git commit -m "[enhanced] [impl] feat(deck): add Context tab with prompt composition viewer"
```

---

### Task 5: Context Tab — Bootstrap File Editor + Tool Policy Viz `[frontend]`

**covers:** agent-context-tab > Bootstrap file inline editor > "User opens a bootstrap file for editing", "User saves an edited bootstrap file", "File does not exist yet"; agent-tool-policy-viz > Tool policy pipeline layer visualization > "Agent with multiple active policy layers", "Agent with only default policy", "Empty layer display"; agent-tool-policy-viz > Per-tool resolution detail view > "User expands a specific tool's resolution", "Tool denied by a specific layer"; agent-tool-policy-viz > Tool list with allow/deny summary > "Full tool list rendering", "Tool list filtering"; agent-tool-policy-viz > Tool policy data sourced from gateway RPC > "RPC returns tool policy data"

**Files:**

- Create: `dashboard/src/components/panels/agents/tabs/BootstrapFileEditor.tsx`
- Create: `dashboard/src/components/panels/agents/tabs/ToolPolicyViz.tsx`
- Modify: `dashboard/src/components/panels/agents/tabs/ContextTab.tsx`

**Context:**

Two sub-components are integrated into the ContextTab:

1. **BootstrapFileEditor** -- Replaces the placeholder file list. Click a file -> load via `fetchBootstrapFile` -> show textarea -> save via `saveBootstrapFile`. Files that don't exist show "Create" button.

2. **ToolPolicyViz** -- Replaces the placeholder in the policy section. Shows 7 pipeline layers as vertical steps with rule count and effect. Below, a filterable tool list with expandable per-tool traces.

- [ ] **Step 1: Create BootstrapFileEditor**

Create `dashboard/src/components/panels/agents/tabs/BootstrapFileEditor.tsx`:

```tsx
"use client";

import { Check, Loader2, Plus, Save, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// No shadcn Textarea component -- use native <textarea> with Tailwind styling
import type { BootstrapFileEntry } from "@/stores/deck-agents";
import { useDeckAgentsStore } from "@/stores/deck-agents";

interface Props {
  agentId: string;
  files: BootstrapFileEntry[];
}

export function BootstrapFileEditor({ agentId, files }: Props) {
  const t = useTranslations("context");
  const { bootstrapFileDetail, fetchBootstrapFile, saveBootstrapFile, fetchSystemPromptPreview } =
    useDeckAgentsStore();
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"idle" | "success" | "error">("idle");

  useEffect(() => {
    if (editingFile) {
      void fetchBootstrapFile(agentId, editingFile);
    }
  }, [agentId, editingFile, fetchBootstrapFile]);

  useEffect(() => {
    if (bootstrapFileDetail && bootstrapFileDetail.name === editingFile) {
      setContent(bootstrapFileDetail.content ?? "");
    }
  }, [bootstrapFileDetail, editingFile]);

  const handleSave = useCallback(async () => {
    if (!editingFile) return;
    setSaving(true);
    setSaveResult("idle");
    const ok = await saveBootstrapFile(agentId, editingFile, content);
    setSaving(false);
    setSaveResult(ok ? "success" : "error");
    if (ok) {
      void fetchSystemPromptPreview(agentId);
      setTimeout(() => setSaveResult("idle"), 2000);
    }
  }, [agentId, editingFile, content, saveBootstrapFile, fetchSystemPromptPreview]);

  const handleCreate = useCallback(
    async (name: string) => {
      setSaving(true);
      const ok = await saveBootstrapFile(agentId, name, "");
      setSaving(false);
      if (ok) {
        setEditingFile(name);
        setContent("");
        void fetchSystemPromptPreview(agentId);
      }
    },
    [agentId, saveBootstrapFile, fetchSystemPromptPreview],
  );

  return (
    <div className="space-y-1">
      {files.map((file) => (
        <div key={file.name}>
          <button
            onClick={() => {
              setEditingFile(editingFile === file.name ? null : file.name);
              setSaveResult("idle");
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-[var(--bg-secondary)] text-xs hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
          >
            <span
              className={`font-mono ${file.exists ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}
            >
              {file.name}
            </span>
            {file.exists ? (
              <Badge variant="outline" className="text-[10px] font-mono">
                {file.charCount.toLocaleString()}
              </Badge>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleCreate(file.name);
                }}
              >
                <Plus size={10} className="mr-0.5" />
                {t("create")}
              </Button>
            )}
          </button>

          {editingFile === file.name && file.exists && (
            <div className="mt-1 mx-1 space-y-2">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full font-mono text-xs min-h-[120px] p-2 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] resize-y focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                placeholder={t("editorPlaceholder")}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving} className="h-7">
                  {saving ? (
                    <Loader2 size={12} className="animate-spin mr-1" />
                  ) : (
                    <Save size={12} className="mr-1" />
                  )}
                  {t("save")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingFile(null)}
                  className="h-7"
                >
                  <X size={12} className="mr-1" />
                  {t("cancel")}
                </Button>
                {saveResult === "success" && (
                  <span className="text-[10px] text-[var(--success)] flex items-center gap-1">
                    <Check size={10} /> {t("saved")}
                  </span>
                )}
                {saveResult === "error" && (
                  <span className="text-[10px] text-[var(--danger)]">{t("saveFailed")}</span>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create ToolPolicyViz**

Create `dashboard/src/components/panels/agents/tabs/ToolPolicyViz.tsx`:

```tsx
"use client";

import { ChevronDown, ChevronRight, Search, ShieldCheck, ShieldX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { ToolPolicyPreview } from "@/stores/deck-agents";

interface Props {
  preview: ToolPolicyPreview;
}

const EFFECT_STYLES: Record<string, string> = {
  allow: "bg-[var(--success-muted)] text-[var(--success)]",
  deny: "bg-[var(--danger-muted)] text-[var(--danger)]",
  passthrough: "bg-[var(--neutral-muted)] text-[var(--neutral-muted-text)]",
};

const DECISION_ICON: Record<string, string> = {
  allow: "text-[var(--success)]",
  deny: "text-[var(--danger)]",
  "no-opinion": "text-[var(--text-secondary)]",
};

export function ToolPolicyViz({ preview }: Props) {
  const t = useTranslations("context");
  const [search, setSearch] = useState("");
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const filteredTools = useMemo(() => {
    if (!search.trim()) return preview.tools;
    const q = search.toLowerCase();
    return preview.tools.filter((tool) => tool.name.toLowerCase().includes(q));
  }, [preview.tools, search]);

  return (
    <div className="space-y-3">
      {/* Pipeline Layers */}
      <div className="space-y-1">
        <h4 className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1">
          {t("policyLayers")}
        </h4>
        {preview.layers.map((layer, idx) => (
          <div
            key={layer.label}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-secondary)] text-xs"
          >
            <span className="text-[var(--text-secondary)] w-4 text-right font-mono">{idx + 1}</span>
            <span className="flex-1 text-[var(--text-primary)] font-mono text-[11px]">
              {layer.label}
            </span>
            <Badge className={`text-[10px] border-0 ${EFFECT_STYLES[layer.effect]}`}>
              {layer.effect}
            </Badge>
            <span className="text-[10px] text-[var(--text-secondary)] tabular-nums w-8 text-right">
              {layer.ruleCount}
            </span>
          </div>
        ))}
      </div>

      {/* Tool List */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] flex-1">
            {t("toolList")}
          </h4>
          <div className="relative w-40">
            <Search
              size={12}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchTools")}
              className="h-6 pl-6 text-xs bg-[var(--bg-secondary)] border-[var(--border)]"
            />
          </div>
        </div>

        {filteredTools.map((tool) => (
          <div key={tool.name}>
            <button
              onClick={() => setExpandedTool(expandedTool === tool.name ? null : tool.name)}
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md bg-[var(--bg-secondary)] text-xs hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer"
            >
              {expandedTool === tool.name ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {tool.allowed ? (
                <ShieldCheck size={12} className="text-[var(--success)]" />
              ) : (
                <ShieldX size={12} className="text-[var(--danger)]" />
              )}
              <span className="font-mono text-[11px] flex-1 text-left text-[var(--text-primary)]">
                {tool.name}
              </span>
              <span className="text-[10px] text-[var(--text-secondary)]">{tool.decisiveLayer}</span>
            </button>

            {expandedTool === tool.name && (
              <div className="ml-8 mt-1 space-y-0.5 mb-2">
                {tool.trace.map((step) => (
                  <div
                    key={step.layer}
                    className="flex items-center gap-2 px-2 py-1 rounded text-[10px]"
                  >
                    <span className="font-mono text-[var(--text-secondary)] flex-1">
                      {step.layer}
                    </span>
                    <span className={`font-medium ${DECISION_ICON[step.decision]}`}>
                      {step.decision}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into ContextTab**

Update `ContextTab.tsx`:

1. Import `BootstrapFileEditor` and `ToolPolicyViz`
2. Replace the placeholder file list in the bootstrap section with `<BootstrapFileEditor agentId={agentId} files={systemPromptPreview.bootstrapFiles} />`
3. Replace the placeholder in the policy section with `{toolPolicyPreview ? <ToolPolicyViz preview={toolPolicyPreview} /> : <p>...</p>}`

- [ ] **Step 4: Verify types compile**

Run: `cd dashboard && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/panels/agents/tabs/BootstrapFileEditor.tsx \
  dashboard/src/components/panels/agents/tabs/ToolPolicyViz.tsx \
  dashboard/src/components/panels/agents/tabs/ContextTab.tsx
git commit -m "[enhanced] [impl] feat(deck): add bootstrap file editor + tool policy visualization"
```

---

### Task 6: Overview Tab Enhancements `[frontend]`

**covers:** agent-overview-enhancements > Model fallback chain in Overview tab > "Agent with no model configured (uses default)"; agent-overview-enhancements > Sandbox mode display > "Agent in sandbox mode", "Agent not sandboxed"; agent-overview-enhancements > Identity preview card > "Agent with default identity"; agent-overview-enhancements > Overview stat cards link to Context tab > "User clicks Context stat card"

**Files:**

- Modify: `dashboard/src/components/panels/agents/tabs/OverviewTab.tsx`

**Context:**

The `AgentDetail` type (in `deck-agents.ts`) now includes `sandbox`, `identityExists`, and `fallbackModels` fields (added in T0/T3). The Overview tab uses these to display:

- Sandbox mode badge: shows sandbox config or "using default settings"
- Model info with fallback chain: shows primary model + fallback list if available
- Identity preview card: shows agent name initial with "Configure identity" link to Context tab
- Context stat card: navigates to Context tab on click

- [ ] **Step 1: Add Context stat card**

Add a Context stat card to the `statCards` array:

```typescript
{
  label: t("statContext"),
  value: 0, // Will be populated when systemPromptPreview is available
  icon: <Layers size={14} />,
  tab: "context" as TabValue,
  color: "text-indigo-400",
},
```

Add `Layers` to the lucide-react import.

- [ ] **Step 2: Add sandbox mode badge**

Add a "Sandbox" section to the Overview tab between the info card and stat cards:

```tsx
{
  /* Sandbox & Model section */
}
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
  {/* Sandbox badge */}
  <Card className="bg-[var(--bg-primary)] border-[var(--border)]">
    <CardContent className="p-3">
      <div className="flex items-center gap-2 text-xs">
        <Shield size={14} className="text-[var(--accent)]" />
        <span className="text-[var(--text-secondary)]">{t("sandboxMode")}</span>
      </div>
      <p className="text-xs text-[var(--text-primary)] mt-1">
        {detail.sandbox ? t("sandboxEnabled") : t("sandboxDefault")}
      </p>
    </CardContent>
  </Card>

  {/* Model info */}
  <Card className="bg-[var(--bg-primary)] border-[var(--border)]">
    <CardContent className="p-3">
      <div className="flex items-center gap-2 text-xs">
        <Cpu size={14} className="text-[var(--accent)]" />
        <span className="text-[var(--text-secondary)]">{t("modelConfig")}</span>
      </div>
      <p className="font-mono text-xs text-[var(--text-primary)] mt-1">
        {detail.model || t("usingDefault")}
      </p>
      {detail.fallbackModels && detail.fallbackModels.length > 0 && (
        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
          {t("fallbacks")}: {detail.fallbackModels.join(", ")}
        </p>
      )}
    </CardContent>
  </Card>
</div>;
```

Add `Shield, Cpu` to lucide-react imports.

- [ ] **Step 3: Add identity preview card**

Add an identity preview card below sandbox/model:

```tsx
{
  /* Identity preview */
}
<Card className="bg-[var(--bg-primary)] border-[var(--border)]">
  <CardContent className="p-3">
    <div className="flex items-center gap-2 text-xs mb-2">
      <User size={14} className="text-[var(--accent)]" />
      <span className="text-[var(--text-secondary)]">{t("identity")}</span>
      {detail.identityExists && (
        <Badge variant="secondary" className="text-[10px]">
          IDENTITY.md
        </Badge>
      )}
    </div>
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-[var(--accent-muted)] flex items-center justify-center text-lg ring-1 ring-[var(--accent)]/20">
        {detail.name?.charAt(0)?.toUpperCase() ?? "?"}
      </div>
      <div className="text-xs">
        <p className="text-[var(--text-primary)] font-medium">{detail.name}</p>
        <button
          onClick={() => onNavigateTab("context")}
          className="text-[var(--accent)] hover:underline cursor-pointer"
        >
          {t("configureIdentity")}
        </button>
      </div>
    </div>
  </CardContent>
</Card>;
```

Add `User` to lucide-react imports.

- [ ] **Step 4: Verify types compile**

Run: `cd dashboard && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/panels/agents/tabs/OverviewTab.tsx
git commit -m "[enhanced] [impl] feat(deck): enhance Overview tab -- sandbox badge, identity preview, context stat"
```

---

### Task 7: i18n Keys + Integration `[frontend]`

**Files:**

- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

**Context:**

All new UI strings need i18n keys in both `zh.json` and `en.json`. This task consolidates all i18n additions from Tasks 4-6.

- [ ] **Step 1: Add i18n keys**

Add the `context` namespace and extend `agentDetail` in both `zh.json` and `en.json`:

**zh.json additions:**

```json
{
  "context": {
    "title": "上下文",
    "refresh": "刷新",
    "promptLayers": "Prompt 组成层",
    "bootstrapFiles": "工作区文件",
    "toolPolicy": "工具策略",
    "loading": "加载中...",
    "notCreated": "未创建",
    "allowed": "已允许",
    "policyLayers": "策略管道",
    "toolList": "工具列表",
    "searchTools": "搜索工具...",
    "create": "创建",
    "save": "保存",
    "cancel": "取消",
    "saved": "已保存",
    "saveFailed": "保存失败",
    "editorPlaceholder": "输入 Markdown 内容..."
  },
  "agentDetail": {
    "context": "上下文",
    "statContext": "上下文",
    "sandboxMode": "沙箱模式",
    "sandboxEnabled": "已启用沙箱",
    "sandboxDefault": "使用默认设置",
    "modelConfig": "模型配置",
    "usingDefault": "使用默认模型",
    "fallbacks": "备选",
    "identity": "身份",
    "configureIdentity": "配置身份 →"
  }
}
```

**en.json additions:**

```json
{
  "context": {
    "title": "Context",
    "refresh": "Refresh",
    "promptLayers": "Prompt Composition Layers",
    "bootstrapFiles": "Workspace Files",
    "toolPolicy": "Tool Policy",
    "loading": "Loading...",
    "notCreated": "Not created",
    "allowed": "allowed",
    "policyLayers": "Policy Pipeline",
    "toolList": "Tool List",
    "searchTools": "Search tools...",
    "create": "Create",
    "save": "Save",
    "cancel": "Cancel",
    "saved": "Saved",
    "saveFailed": "Save failed",
    "editorPlaceholder": "Enter Markdown content..."
  },
  "agentDetail": {
    "context": "Context",
    "statContext": "Context",
    "sandboxMode": "Sandbox Mode",
    "sandboxEnabled": "Sandbox enabled",
    "sandboxDefault": "Using default settings",
    "modelConfig": "Model Config",
    "usingDefault": "Using default model",
    "fallbacks": "Fallbacks",
    "identity": "Identity",
    "configureIdentity": "Configure identity"
  }
}
```

- [ ] **Step 2: Run tsc --noEmit**

Run: `cd /Users/wangym/workspace/agents/openclaw && cd dashboard && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Run lint/format**

Run: `cd /Users/wangym/workspace/agents/openclaw && pnpm check`
Expected: Clean

- [ ] **Step 4: Fix any lint issues**

If lint reports issues, fix them. Common: unused imports, formatting differences.

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: All tests pass including new `agents-preview.test.ts` and updated `gateway-adapter.test.ts`

- [ ] **Step 6: Verify allowlist completeness**

Check `dashboard/server/gateway-allowlist.ts` contains ALL `deck.*` methods from `src/gateway/server-methods-list.ts`:

- `deck.agents.toolPolicy.preview`
- `deck.agents.systemPrompt.preview`
- `deck.agents.detail`
- `deck.agents.skills.get` / `deck.agents.skills.set`
- `deck.agents.subagents.get` / `deck.agents.subagents.set`
- `deck.routing.list` / `deck.routing.add` / `deck.routing.remove` / `deck.routing.validate` / `deck.routing.simulate`
- `deck.auth.overview` / `deck.auth.probe`
- `deck.identity.list` / `deck.identity.link` / `deck.identity.unlink`
- `deck.threads.list`
- `deck.subagents.list` / `deck.subagents.kill` / `deck.subagents.lineage` / `deck.subagents.steer` (already present)

- [ ] **Step 7: Verify method registrations**

Check `src/gateway/server-methods-list.ts` contains both new methods.
Check `src/gateway/method-scopes.ts` has both in READ_SCOPE.

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] [impl] feat(deck): add i18n keys for context tab and overview enhancements"
```

If integration fixes were needed:

```bash
git add -A
git commit -m "[enhanced] [impl] fix(deck): integration fixes for agent workspace"
```

---

## Scope Reductions

| Spec Scenario                                   | Status                   | Reason                                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full prompt preview -- `assembledPrompt` field  | **Optional/best-effort** | `buildEmbeddedSystemPrompt` requires 20+ params including live tools, session context, model selection. Preview without a real session cannot produce the accurate assembled prompt. The RPC returns layer summaries instead. Spec updated to mark `assembledPrompt` as optional. |
| Full prompt preview -- channel context selector | **Schema-ready**         | Backend schema accepts `context.channel`, but no frontend selector built. Data flows correctly if selector is added later.                                                                                                                                                        |
| Overview -- fallback chain with drag-reorder    | **Read-only display**    | `FallbackChain` component requires `Model[]` + `AuthOverviewEntry[]` from models store. Overview shows model name + fallback list as text. Full chain visualization deferred.                                                                                                     |
| Tool policy -- RPC error state with retry       | **Basic only**           | Loading state shown; explicit retry button not added (Refresh button at top serves this purpose).                                                                                                                                                                                 |

## OpenSpec Requirement Coverage Matrix

| Spec                        | Requirement               | Scenario                    | Covered By                                      |
| --------------------------- | ------------------------- | --------------------------- | ----------------------------------------------- |
| agent-workspace-rpc         | Tool policy preview RPC   | Basic tool policy preview   | T1                                              |
| agent-workspace-rpc         | Tool policy preview RPC   | Context-sensitive preview   | T1 (schema)                                     |
| agent-workspace-rpc         | Tool policy preview RPC   | Unknown agent ID            | T1                                              |
| agent-workspace-rpc         | System prompt preview RPC | Basic system prompt preview | T2                                              |
| agent-workspace-rpc         | System prompt preview RPC | Context-sensitive preview   | T2 (schema)                                     |
| agent-workspace-rpc         | System prompt preview RPC | Unknown agent ID            | T2                                              |
| agent-workspace-rpc         | Both read-only            | No side effects             | T1, T2                                          |
| agent-workspace-rpc         | Registered in scopes      | Dashboard can call          | T1, T2, T3                                      |
| agent-context-tab           | Prompt composition layers | All layers populated        | T4                                              |
| agent-context-tab           | Prompt composition layers | Minimal configuration       | T4                                              |
| agent-context-tab           | Full prompt preview       | Toggle preview              | **Deferred** (see scope reductions)             |
| agent-context-tab           | Full prompt preview       | Channel context             | **Deferred** (see scope reductions)             |
| agent-context-tab           | Bootstrap editor          | Open for editing            | T5                                              |
| agent-context-tab           | Bootstrap editor          | Save edited file            | T5                                              |
| agent-context-tab           | Bootstrap editor          | File does not exist         | T5                                              |
| agent-context-tab           | Collapsible sections      | Default collapsed           | T4                                              |
| agent-context-tab           | Collapsible sections      | Expand a section            | T4                                              |
| agent-tool-policy-viz       | Pipeline layers           | Multiple active layers      | T5                                              |
| agent-tool-policy-viz       | Pipeline layers           | Default policy only         | T5                                              |
| agent-tool-policy-viz       | Pipeline layers           | Empty layer display         | T5                                              |
| agent-tool-policy-viz       | Per-tool detail           | Expand resolution           | T5                                              |
| agent-tool-policy-viz       | Per-tool detail           | Tool denied by layer        | T5                                              |
| agent-tool-policy-viz       | Tool list summary         | Full list rendering         | T5                                              |
| agent-tool-policy-viz       | Tool list summary         | Filtering                   | T5                                              |
| agent-tool-policy-viz       | Data sourced from RPC     | RPC returns data            | T5                                              |
| agent-tool-policy-viz       | Data sourced from RPC     | RPC error handling          | T5 (basic)                                      |
| agent-overview-enhancements | Model fallback chain      | No model (default)          | T6                                              |
| agent-overview-enhancements | Model fallback chain      | With fallback chain         | T6 (read-only text)                             |
| agent-overview-enhancements | Sandbox mode              | Sandboxed / Not sandboxed   | T0, T6                                          |
| agent-overview-enhancements | Identity preview          | Default identity            | T0, T6                                          |
| agent-overview-enhancements | Identity preview          | Custom identity             | T0, T6 (shows name initial + IDENTITY.md badge) |
| agent-overview-enhancements | Context stat card         | Click navigates             | T6                                              |
