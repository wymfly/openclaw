# Deck Agent Config Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance Deck Agent panel with tools catalog browsing/override, skill install/config/update, files browser, identity display, and model fallback chain editing.

**Architecture:** Five independent features integrated into existing Agent tabs (Config, Skills, Context, Overview). Each feature calls Gateway APIs through Next.js API route proxies. Frontend types are manually defined since these APIs are not in the Protocol SDK codegen (only in allowlist). The existing `deck-agents` store is extended with new fetch methods and cache fields.

**Tech Stack:** Next.js 15, React 19, Zustand, next-intl, Lucide icons, shadcn/ui (Collapsible, Dialog, Badge, Button, Card, Switch, Input)

**Backend Type Correction:** `agent.identity.get` actually returns `{ agentId, name?, avatar?, emoji? }` — the proposal's `description` and `aliases` fields do not exist. Plan adapts to real schema. ClawHub slugs are single-segment (no `/`). `skills.install` local mode requires matching `name` + `installId` from `skills.status` install options, not arbitrary path + UUID.

**Existing API Routes:** `/api/skills/install` (POST), `/api/skills/[skillKey]` (PATCH for update), `/api/agents/[agentId]/files` (GET list, POST write) already exist. `/api/skills` (GET status) exists. New routes needed: tools catalog, agent identity, ClawHub skills update.

**Review Fixes Applied:** Codex R1 (5 P1 + 4 P2) + Gemini degraded (5 P1 + 8 P2). Fixed: `model.fallbackss` (plural), skill install protocol, identity spec alignment, BootstrapFileEditor integration, ClawHub slug format, skills.status as data source for updates, formatRelativeTime i18n, test commands.

---

## File Structure

**New files:**

- `dashboard/src/app/api/tools/catalog/route.ts` — Proxy `tools.catalog` RPC
- `dashboard/src/app/api/agents/[agentId]/identity/route.ts` — Proxy `agent.identity.get` RPC
- `dashboard/src/app/api/skills/update-clawhub/route.ts` — Proxy `skills.update` with `source: "clawhub"`
- `dashboard/src/components/panels/agents/tabs/ToolsCatalog.tsx` — Tools catalog collapsible panel
- `dashboard/src/components/panels/agents/tabs/FallbackChainEditor.tsx` — Model fallback ordered list
- `dashboard/src/components/panels/agents/tabs/FilesBrowser.tsx` — Files list with edit integration
- `dashboard/src/components/panels/agents/tabs/SkillInstallDialog.tsx` — Agent-level skill install dialog
- `dashboard/src/components/panels/agents/tabs/SkillConfigEditor.tsx` — Inline apiKey/env config editor

**Modified files:**

- `dashboard/src/stores/deck-agents.ts` — Add toolsCatalog, filesList, identity fetch methods + types
- `dashboard/src/components/panels/agents/tabs/AgentConfigTab.tsx` — Integrate ToolsCatalog + FallbackChainEditor
- `dashboard/src/components/panels/agents/tabs/SkillsTab.tsx` — Add install button, config/update UI
- `dashboard/src/components/panels/agents/tabs/ContextTab.tsx` — Replace bootstrap file buttons with FilesBrowser
- `dashboard/src/components/panels/agents/tabs/OverviewTab.tsx` — Add identity avatar/name from `agent.identity.get`
- `dashboard/src/i18n/zh.json` — New keys in agentDetail/context namespaces
- `dashboard/src/i18n/en.json` — Matching English keys

---

### Task 1: API Routes [frontend]

covers: agent-tools-catalog/spec.md > ADDED > Tools catalog displays grouped tool list > Expand tools catalog
covers: agent-identity-display/spec.md > ADDED > Overview tab displays full agent identity > Display identity with avatar
covers: agent-skills-management/spec.md > ADDED > Skill update functionality

**Files:**

- Create: `dashboard/src/app/api/tools/catalog/route.ts`
- Create: `dashboard/src/app/api/agents/[agentId]/identity/route.ts`
- Create: `dashboard/src/app/api/skills/update-clawhub/route.ts`

- [ ] **Step 1: Create tools catalog API route**

```typescript
// dashboard/src/app/api/tools/catalog/route.ts
/**
 * POST /api/tools/catalog — Get tools catalog for an agent.
 *
 * Gateway contract: tools.catalog { agentId?, includePlugins? }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    agentId?: string;
    includePlugins?: boolean;
  };
  return gatewayRequest("tools.catalog", {
    ...(body.agentId ? { agentId: body.agentId } : {}),
    ...(body.includePlugins !== undefined ? { includePlugins: body.includePlugins } : {}),
  });
});
```

- [ ] **Step 2: Create agent identity API route**

```typescript
// dashboard/src/app/api/agents/[agentId]/identity/route.ts
/**
 * GET /api/agents/[agentId]/identity — Get agent identity.
 *
 * Gateway contract: agent.identity.get { agentId }
 * Returns: { agentId, name?, avatar?, emoji? }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

type RouteContext = { params: Promise<{ agentId: string }> };

export const GET = withAuth(async (_request: NextRequest, ctx: unknown) => {
  const { agentId } = await (ctx as RouteContext).params;
  return gatewayRequest("agent.identity.get", { agentId });
});
```

- [ ] **Step 3: Create ClawHub skills update API route**

```typescript
// dashboard/src/app/api/skills/update-clawhub/route.ts
/**
 * POST /api/skills/update-clawhub — Update ClawHub skill(s).
 *
 * Gateway contract: skills.update { source: "clawhub", slug?, all? }
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const POST = withAuth(async (request: NextRequest) => {
  const body = (await request.json()) as {
    slug?: string;
    all?: boolean;
  };
  return gatewayRequest("skills.update", {
    source: "clawhub",
    ...(body.slug ? { slug: body.slug } : {}),
    ...(body.all ? { all: true } : {}),
  });
});
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | tail -5`
Expected: 0 errors (or only pre-existing errors)

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(agents): add API routes for tools catalog, identity, and ClawHub update" \
  dashboard/src/app/api/tools/catalog/route.ts \
  dashboard/src/app/api/agents/\[agentId\]/identity/route.ts \
  dashboard/src/app/api/skills/update-clawhub/route.ts
```

---

### Task 2: Store Extensions [frontend]

covers: agent-tools-catalog/spec.md > ADDED > Tools catalog displays grouped tool list > Expand tools catalog
covers: agent-files-browser/spec.md > ADDED > Files browser displays complete file list > Display file list
covers: agent-identity-display/spec.md > ADDED > Overview tab displays full agent identity > Display identity with avatar
covers: agent-identity-display/spec.md > ADDED > Overview tab displays full agent identity > Identity API unavailable

**Files:**

- Modify: `dashboard/src/stores/deck-agents.ts`

- [ ] **Step 1: Add types for tools catalog, identity, and files list**

Add after the existing `EffectiveToolGroup` interface (around line 73):

```typescript
// ---------------------------------------------------------------------------
// Tools Catalog types (from tools.catalog RPC)
// ---------------------------------------------------------------------------

export interface ToolCatalogEntry {
  id: string;
  label: string;
  description: string;
  source: "core" | "plugin";
  pluginId?: string;
  optional?: boolean;
  defaultProfiles: string[];
}

export interface ToolCatalogGroup {
  id: string;
  label: string;
  source: "core" | "plugin";
  pluginId?: string;
  tools: ToolCatalogEntry[];
}

export interface ToolCatalogProfile {
  id: string;
  label: string;
}

export interface ToolsCatalogResult {
  agentId: string;
  profiles: ToolCatalogProfile[];
  groups: ToolCatalogGroup[];
}

// ---------------------------------------------------------------------------
// Agent Identity types (from agent.identity.get RPC)
// ---------------------------------------------------------------------------

export interface AgentIdentityResult {
  agentId: string;
  name?: string;
  avatar?: string;
  emoji?: string;
}

// ---------------------------------------------------------------------------
// Agent Files types (from agents.files.list RPC)
// ---------------------------------------------------------------------------

export interface AgentFileEntry {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
}

export interface AgentFilesListResult {
  agentId: string;
  workspace: string;
  files: AgentFileEntry[];
}
```

- [ ] **Step 2: Add store state fields and fetch methods**

Add to `DeckAgentsState` interface (after `configSaveError`):

```typescript
  toolsCatalog: ToolsCatalogResult | null;
  toolsCatalogLoading: boolean;
  agentFilesList: AgentFileEntry[];
  filesListLoading: boolean;
  agentIdentity: AgentIdentityResult | null;

  fetchToolsCatalog: (agentId: string) => Promise<void>;
  fetchFilesList: (agentId: string) => Promise<void>;
  fetchIdentity: (agentId: string) => Promise<void>;
```

Add initial state values after `configSaveError: null,`:

```typescript
  toolsCatalog: null,
  toolsCatalogLoading: false,
  agentFilesList: [],
  filesListLoading: false,
  agentIdentity: null,
```

Add fetch implementations before `invalidateCache`:

```typescript
  fetchToolsCatalog: async (agentId: string) => {
    set({ toolsCatalogLoading: true });
    try {
      const res = await fetch("/api/tools/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      if (!res.ok) {
        set({ toolsCatalog: null, toolsCatalogLoading: false });
        return;
      }
      const data = (await res.json()) as ToolsCatalogResult;
      set({ toolsCatalog: data, toolsCatalogLoading: false });
    } catch {
      set({ toolsCatalog: null, toolsCatalogLoading: false });
    }
  },

  fetchFilesList: async (agentId: string) => {
    set({ filesListLoading: true });
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/files`);
      if (!res.ok) {
        set({ agentFilesList: [], filesListLoading: false });
        return;
      }
      const data = (await res.json()) as AgentFilesListResult;
      set({ agentFilesList: data.files, filesListLoading: false });
    } catch {
      set({ agentFilesList: [], filesListLoading: false });
    }
  },

  fetchIdentity: async (agentId: string) => {
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/identity`);
      if (!res.ok) {
        set({ agentIdentity: null });
        return;
      }
      const data = (await res.json()) as AgentIdentityResult;
      set({ agentIdentity: data });
    } catch {
      set({ agentIdentity: null });
    }
  },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(agents): extend store with tools catalog, files list, and identity" \
  dashboard/src/stores/deck-agents.ts
```

---

### Task 3: i18n Keys [frontend]

covers: (all specs — i18n is cross-cutting)

**Files:**

- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add Chinese i18n keys**

Add the following keys to the `agentDetail` namespace in `zh.json`. Place under the existing `agentDetail.config` sub-namespace and add new top-level `agentDetail` keys:

In `agentDetail.config` (existing object):

```json
"toolsCatalog": "工具目录",
"toolsCatalogDescription": "展开查看所有可用工具，可逐个覆盖 allow/deny",
"toolName": "工具名称",
"toolSource": "来源",
"toolProfiles": "默认 Profile",
"toolOverride": "覆盖",
"toolDefault": "默认",
"toolAllow": "允许",
"toolDeny": "拒绝",
"toolsCatalogLoading": "加载工具目录...",
"toolsCatalogEmpty": "无可用工具",
"toolsCatalogError": "工具目录不可用",
"fallbackModels": "Fallback 模型",
"fallbackDescription": "主模型不可用时按顺序尝试的备选模型",
"addFallback": "添加 Fallback",
"noFallback": "无 fallback 模型，主模型不可用时将报错",
"moveFallbackUp": "上移",
"moveFallbackDown": "下移",
"removeFallback": "移除"
```

In `agentDetail` top-level (existing object):

```json
"installSkill": "安装技能",
"installLocal": "本地路径",
"installClawHub": "ClawHub",
"skillPath": "技能路径",
"skillSlug": "技能 Slug",
"skillPathPlaceholder": "/path/to/skill",
"skillSlugPlaceholder": "web-search",
"installing": "安装中...",
"installSuccess": "安装成功",
"installFailed": "安装失败",
"configureSkill": "配置",
"skillApiKey": "API Key",
"skillApiKeyPlaceholder": "输入 API Key",
"skillEnvVars": "环境变量",
"skillEnvKey": "变量名",
"skillEnvValue": "变量值",
"addEnvVar": "添加变量",
"updateSkill": "更新",
"updateAll": "全部更新",
"updating": "更新中...",
"updateSuccess": "更新成功",
"avatarAlt": "Agent 头像",
"identityName": "名称",
"identityEmoji": "Emoji"
```

In `context` namespace (existing object):

```json
"filesBrowser": "文件列表",
"filesBrowserDescription": "Agent 的所有 bootstrap 文件",
"fileName": "文件名",
"fileSize": "大小",
"fileUpdated": "修改时间",
"fileMissing": "缺失",
"fileCreate": "创建",
"filesLoading": "加载文件列表...",
"filesEmpty": "无文件"
```

- [ ] **Step 2: Add English i18n keys**

Add matching keys to `en.json`:

In `agentDetail.config`:

```json
"toolsCatalog": "Tools Catalog",
"toolsCatalogDescription": "Expand to view all available tools with per-tool allow/deny overrides",
"toolName": "Tool Name",
"toolSource": "Source",
"toolProfiles": "Default Profiles",
"toolOverride": "Override",
"toolDefault": "Default",
"toolAllow": "Allow",
"toolDeny": "Deny",
"toolsCatalogLoading": "Loading tools catalog...",
"toolsCatalogEmpty": "No tools available",
"toolsCatalogError": "Tools catalog unavailable",
"fallbackModels": "Fallback Models",
"fallbackDescription": "Fallback models tried in order when primary model is unavailable",
"addFallback": "Add Fallback",
"noFallback": "No fallback models. Primary model failure will cause errors.",
"moveFallbackUp": "Move up",
"moveFallbackDown": "Move down",
"removeFallback": "Remove"
```

In `agentDetail` top-level:

```json
"installSkill": "Install Skill",
"installLocal": "Local Path",
"installClawHub": "ClawHub",
"skillPath": "Skill Path",
"skillSlug": "Skill Slug",
"skillPathPlaceholder": "/path/to/skill",
"skillSlugPlaceholder": "web-search",
"installing": "Installing...",
"installSuccess": "Install successful",
"installFailed": "Install failed",
"configureSkill": "Configure",
"skillApiKey": "API Key",
"skillApiKeyPlaceholder": "Enter API Key",
"skillEnvVars": "Environment Variables",
"skillEnvKey": "Variable Name",
"skillEnvValue": "Variable Value",
"addEnvVar": "Add Variable",
"updateSkill": "Update",
"updateAll": "Update All",
"updating": "Updating...",
"updateSuccess": "Update successful",
"avatarAlt": "Agent avatar",
"identityName": "Name",
"identityEmoji": "Emoji"
```

In `context`:

```json
"filesBrowser": "Files",
"filesBrowserDescription": "All bootstrap files for this agent",
"fileName": "File Name",
"fileSize": "Size",
"fileUpdated": "Last Modified",
"fileMissing": "Missing",
"fileCreate": "Create",
"filesLoading": "Loading files...",
"filesEmpty": "No files"
```

- [ ] **Step 3: Verify i18n files parse correctly**

Run: `node -e "JSON.parse(require('fs').readFileSync('dashboard/src/i18n/zh.json','utf8')); console.log('zh OK');" && node -e "JSON.parse(require('fs').readFileSync('dashboard/src/i18n/en.json','utf8')); console.log('en OK');"`
Expected: `zh OK` then `en OK`

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(agents): add i18n keys for agent config enhancement" \
  dashboard/src/i18n/zh.json \
  dashboard/src/i18n/en.json
```

---

### Task 4: Tools Catalog Component [frontend]

covers: agent-tools-catalog/spec.md > ADDED > Tools catalog displays grouped tool list > Expand tools catalog
covers: agent-tools-catalog/spec.md > ADDED > Tools catalog displays grouped tool list > Tool entry details
covers: agent-tools-catalog/spec.md > ADDED > Per-tool allow/deny override > Deny a tool
covers: agent-tools-catalog/spec.md > ADDED > Per-tool allow/deny override > Allow a denied tool
covers: agent-tools-catalog/spec.md > ADDED > Per-tool allow/deny override > Reset to profile default
covers: agent-tools-catalog/spec.md > ADDED > Tools catalog graceful degradation

**Files:**

- Create: `dashboard/src/components/panels/agents/tabs/ToolsCatalog.tsx`

- [ ] **Step 1: Implement ToolsCatalog component**

```tsx
// dashboard/src/components/panels/agents/tabs/ToolsCatalog.tsx
"use client";

import { ChevronRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  useDeckAgentsStore,
  type ToolCatalogEntry,
  type ToolCatalogGroup,
} from "@/stores/deck-agents";

type OverrideState = "default" | "allow" | "deny";

interface ToolsCatalogProps {
  agentId: string;
  /** Current tool allow list from agent config. */
  toolsAllow: string[];
  /** Current tool deny list from agent config. */
  toolsDeny: string[];
  /** Called when user changes a tool override. Passes full updated allow/deny lists. */
  onOverrideChange: (allow: string[], deny: string[]) => void;
}

function getOverrideState(toolId: string, allow: string[], deny: string[]): OverrideState {
  if (deny.includes(toolId)) return "deny";
  if (allow.includes(toolId)) return "allow";
  return "default";
}

export function ToolsCatalog({
  agentId,
  toolsAllow,
  toolsDeny,
  onOverrideChange,
}: ToolsCatalogProps) {
  const t = useTranslations("agentDetail.config");
  const { toolsCatalog, toolsCatalogLoading, fetchToolsCatalog } = useDeckAgentsStore();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Fetch on first expand
  useEffect(() => {
    if (open && !loaded) {
      void fetchToolsCatalog(agentId);
      setLoaded(true);
    }
  }, [open, loaded, agentId, fetchToolsCatalog]);

  const handleOverrideChange = useCallback(
    (toolId: string, newState: OverrideState) => {
      let nextAllow = toolsAllow.filter((id) => id !== toolId);
      let nextDeny = toolsDeny.filter((id) => id !== toolId);
      if (newState === "allow") nextAllow = [...nextAllow, toolId];
      if (newState === "deny") nextDeny = [...nextDeny, toolId];
      onOverrideChange(nextAllow, nextDeny);
    },
    [toolsAllow, toolsDeny, onOverrideChange],
  );

  // Graceful degradation: don't render if catalog failed to load after attempt
  if (loaded && !toolsCatalogLoading && !toolsCatalog) {
    return null;
  }

  return (
    <Card className="bg-[var(--background)] border-[var(--border)] overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger render={<button className="w-full cursor-pointer" />}>
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="text-xs font-medium text-[var(--foreground)] flex-1 text-left">
              {t("toolsCatalog")}
            </span>
            {toolsCatalog && (
              <Badge
                variant="outline"
                className="text-[10px] border-[var(--border)] text-[var(--muted-foreground)] mr-1"
              >
                {toolsCatalog.groups.reduce((sum, g) => sum + g.tools.length, 0)}
              </Badge>
            )}
            <ChevronRight
              size={14}
              className={cn(
                "text-[var(--muted-foreground)] transition-transform duration-150 shrink-0",
                open && "rotate-90",
              )}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-[var(--border-subtle)] px-4 py-3 space-y-3">
            <p className="text-[10px] text-[var(--muted-foreground)]">
              {t("toolsCatalogDescription")}
            </p>
            {toolsCatalogLoading ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
                <span className="text-xs text-[var(--muted-foreground)]">
                  {t("toolsCatalogLoading")}
                </span>
              </div>
            ) : toolsCatalog ? (
              toolsCatalog.groups.map((group) => (
                <ToolGroup
                  key={group.id}
                  group={group}
                  toolsAllow={toolsAllow}
                  toolsDeny={toolsDeny}
                  onOverrideChange={handleOverrideChange}
                />
              ))
            ) : (
              <p className="text-xs text-[var(--muted-foreground)]">{t("toolsCatalogEmpty")}</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ToolGroup — collapsible group of tools
// ---------------------------------------------------------------------------

function ToolGroup({
  group,
  toolsAllow,
  toolsDeny,
  onOverrideChange,
}: {
  group: ToolCatalogGroup;
  toolsAllow: string[];
  toolsDeny: string[];
  onOverrideChange: (toolId: string, state: OverrideState) => void;
}) {
  const [groupOpen, setGroupOpen] = useState(true);
  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)] cursor-pointer"
        onClick={() => setGroupOpen(!groupOpen)}
      >
        <ChevronRight
          size={12}
          className={cn(
            "text-[var(--muted-foreground)] transition-transform",
            groupOpen && "rotate-90",
          )}
        />
        {group.label}
        <Badge
          variant="outline"
          className="text-[9px] border-[var(--border)] text-[var(--muted-foreground)]"
        >
          {group.source}
        </Badge>
        <span className="text-[10px] text-[var(--muted-foreground)]">({group.tools.length})</span>
      </button>
      {groupOpen && (
        <div className="ml-4 mt-1 space-y-0.5">
          {group.tools.map((tool) => (
            <ToolRow
              key={tool.id}
              tool={tool}
              overrideState={getOverrideState(tool.id, toolsAllow, toolsDeny)}
              onOverrideChange={onOverrideChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolRow — single tool with 3-state override selector
// ---------------------------------------------------------------------------

const OVERRIDE_OPTIONS: OverrideState[] = ["default", "allow", "deny"];

function ToolRow({
  tool,
  overrideState,
  onOverrideChange,
}: {
  tool: ToolCatalogEntry;
  overrideState: OverrideState;
  onOverrideChange: (toolId: string, state: OverrideState) => void;
}) {
  const t = useTranslations("agentDetail.config");
  return (
    <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[var(--accent)] transition-colors">
      <div className="flex-1 min-w-0">
        <span className="text-xs text-[var(--foreground)] font-mono truncate block">
          {tool.label}
        </span>
        {tool.defaultProfiles.length > 0 && (
          <div className="flex gap-1 mt-0.5">
            {tool.defaultProfiles.map((p) => (
              <Badge
                key={p}
                variant="outline"
                className="text-[8px] border-[var(--border)] text-[var(--muted-foreground)] px-1 py-0"
              >
                {p}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <select
        value={overrideState}
        onChange={(e) => onOverrideChange(tool.id, e.target.value as OverrideState)}
        className={cn(
          "rounded border border-[var(--border)] bg-background px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]",
          overrideState === "deny" && "text-[var(--destructive)]",
          overrideState === "allow" && "text-[var(--success)]",
          overrideState === "default" && "text-[var(--muted-foreground)]",
        )}
      >
        {OVERRIDE_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {t(`tool${opt.charAt(0).toUpperCase() + opt.slice(1)}` as "toolDefault")}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(agents): add ToolsCatalog component with per-tool override" \
  dashboard/src/components/panels/agents/tabs/ToolsCatalog.tsx
```

---

### Task 5: Fallback Chain Editor Component [frontend]

covers: agent-model-fallback/spec.md > ADDED > Config tab supports model fallback chain editing > Add fallback model
covers: agent-model-fallback/spec.md > ADDED > Config tab supports model fallback chain editing > Remove fallback model
covers: agent-model-fallback/spec.md > ADDED > Config tab supports model fallback chain editing > Reorder fallback models
covers: agent-model-fallback/spec.md > ADDED > Config tab supports model fallback chain editing > Empty fallback list

**Files:**

- Create: `dashboard/src/components/panels/agents/tabs/FallbackChainEditor.tsx`

- [ ] **Step 1: Implement FallbackChainEditor component**

```tsx
// dashboard/src/components/panels/agents/tabs/FallbackChainEditor.tsx
"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useModelsStore } from "@/stores/models";

interface FallbackChainEditorProps {
  /** Current fallback model IDs (ordered). */
  fallbacks: string[];
  /** Called with new ordered fallback list on any change. */
  onChange: (fallbacks: string[]) => void;
}

export function FallbackChainEditor({ fallbacks, onChange }: FallbackChainEditorProps) {
  const t = useTranslations("agentDetail.config");
  const { usableModels: models, fetchUsableModels } = useModelsStore();
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (models.length === 0) void fetchUsableModels();
  }, [models.length, fetchUsableModels]);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!adding) return;
    const handler = (e: MouseEvent) => {
      if (
        listRef.current &&
        !listRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setAdding(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [adding]);

  const availableModels = useMemo(() => {
    const existing = new Set(fallbacks);
    const q = search.toLowerCase();
    return models
      .filter(
        (m) =>
          !existing.has(m.id) &&
          (!q || m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)),
      )
      .slice(0, 30);
  }, [models, fallbacks, search]);

  const handleAdd = useCallback(
    (modelId: string) => {
      onChange([...fallbacks, modelId]);
      setAdding(false);
      setSearch("");
    },
    [fallbacks, onChange],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onChange(fallbacks.filter((_, i) => i !== index));
    },
    [fallbacks, onChange],
  );

  const handleMove = useCallback(
    (index: number, direction: -1 | 1) => {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= fallbacks.length) return;
      const next = [...fallbacks];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      onChange(next);
    },
    [fallbacks, onChange],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--muted-foreground)]">
          {t("fallbackModels")}
        </span>
      </div>
      <p className="text-[10px] text-[var(--muted-foreground)]">{t("fallbackDescription")}</p>

      {fallbacks.length === 0 ? (
        <p className="text-[10px] text-[var(--muted-foreground)] italic py-2">{t("noFallback")}</p>
      ) : (
        <div className="space-y-1">
          {fallbacks.map((modelId, i) => (
            <div
              key={`${modelId}-${i}`}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--background)]"
            >
              <Badge
                variant="outline"
                className="text-[9px] border-[var(--border)] text-[var(--muted-foreground)] shrink-0"
              >
                #{i + 1}
              </Badge>
              <span className="text-xs font-mono text-[var(--foreground)] flex-1 min-w-0 truncate">
                {modelId}
              </span>
              <button
                type="button"
                onClick={() => handleMove(i, -1)}
                disabled={i === 0}
                className="p-0.5 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title={t("moveFallbackUp")}
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleMove(i, 1)}
                disabled={i === fallbacks.length - 1}
                className="p-0.5 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title={t("moveFallbackDown")}
              >
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="p-0.5 rounded hover:bg-[var(--destructive-muted)] text-[var(--destructive)] cursor-pointer"
                title={t("removeFallback")}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add fallback */}
      <div className="relative">
        {adding ? (
          <>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("addFallback")}
              className="w-full rounded-md border border-[var(--border)] bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              onBlur={() => {
                setTimeout(() => {
                  setAdding(false);
                  setSearch("");
                }, 150);
              }}
            />
            {availableModels.length > 0 && (
              <div
                ref={listRef}
                className="absolute z-50 mt-1 w-full max-h-40 overflow-y-auto rounded-md border border-[var(--border)] bg-popover shadow-md"
              >
                {availableModels.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="w-full text-left px-2 py-1 text-xs cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleAdd(m.id)}
                  >
                    <span className="text-foreground">{m.name}</span>
                    <span className="ml-1 text-muted-foreground text-[10px]">{m.id}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAdding(true)}
            className="h-7 text-xs gap-1 cursor-pointer"
          >
            <Plus size={12} />
            {t("addFallback")}
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(agents): add FallbackChainEditor component" \
  dashboard/src/components/panels/agents/tabs/FallbackChainEditor.tsx
```

---

### Task 6: Integrate ToolsCatalog + FallbackChainEditor into AgentConfigTab [frontend]

covers: agent-tools-catalog/spec.md > ADDED > Tools catalog displays grouped tool list > Expand tools catalog
covers: agent-model-fallback/spec.md > ADDED > Config tab supports model fallback chain editing > Add fallback model

**Files:**

- Modify: `dashboard/src/components/panels/agents/tabs/AgentConfigTab.tsx`

- [ ] **Step 1: Add imports and integrate components**

Add imports at top of AgentConfigTab.tsx:

```typescript
import { FallbackChainEditor } from "./FallbackChainEditor";
import { ToolsCatalog } from "./ToolsCatalog";
```

In the `handleResetAll` function, add `"model.fallbacks"` and `"tools.allow"` and `"tools.deny"` to the `editableFields` array.

After the Card 2 (Tools Profile) closing `</div>`, before Card 3 (Subagents), insert:

```tsx
{
  /* Card 2b: Model Fallback — below tools profile card */
}
<div className="rounded-lg border border-[var(--border-subtle)] bg-card p-4 flex flex-col gap-3">
  <FallbackChainEditor
    fallbacks={
      Array.isArray(effectiveValue("model.fallbacks"))
        ? (effectiveValue("model.fallbacks") as string[])
        : []
    }
    onChange={(fb) => handleChange("model.fallbacks", fb.length > 0 ? fb : null)}
  />
</div>;
```

After the entire 2x2 grid `</div>` (after the closing of the grid, before the Save Bar), insert:

```tsx
{
  /* Tools Catalog (collapsible, below grid) */
}
<ToolsCatalog
  agentId={agentId}
  toolsAllow={
    Array.isArray(effectiveValue("tools.allow")) ? (effectiveValue("tools.allow") as string[]) : []
  }
  toolsDeny={
    Array.isArray(effectiveValue("tools.deny")) ? (effectiveValue("tools.deny") as string[]) : []
  }
  onOverrideChange={(allow, deny) => {
    handleChange("tools.allow", allow.length > 0 ? allow : null);
    handleChange("tools.deny", deny.length > 0 ? deny : null);
  }}
/>;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(agents): integrate ToolsCatalog and FallbackChainEditor into Config tab" \
  dashboard/src/components/panels/agents/tabs/AgentConfigTab.tsx
```

---

### Task 7: Files Browser Component [frontend]

covers: agent-files-browser/spec.md > ADDED > Files browser displays complete file list > Display file list
covers: agent-files-browser/spec.md > ADDED > Files browser displays complete file list > Click to edit file
covers: agent-files-browser/spec.md > ADDED > Files browser displays complete file list > Missing file indicator
covers: agent-files-browser/spec.md > ADDED > Files browser supports create missing file > Create missing file

**Files:**

- Create: `dashboard/src/components/panels/agents/tabs/FilesBrowser.tsx`

- [ ] **Step 1: Implement FilesBrowser component**

```tsx
// dashboard/src/components/panels/agents/tabs/FilesBrowser.tsx
"use client";

import { File, FilePlus, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeckAgentsStore, type AgentFileEntry } from "@/stores/deck-agents";
import { BootstrapFileEditor } from "./BootstrapFileEditor";

interface FilesBrowserProps {
  agentId: string;
}

function formatSize(bytes?: number): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatRelativeTime(ms?: number): string {
  if (ms == null) return "—";
  return new Date(ms).toLocaleDateString();
}

export function FilesBrowser({ agentId }: FilesBrowserProps) {
  const t = useTranslations("context");
  const {
    agentFilesList,
    filesListLoading,
    fetchFilesList,
    fetchBootstrapFile,
    systemPromptPreview,
  } = useDeckAgentsStore();

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [creatingFile, setCreatingFile] = useState<string | null>(null);

  useEffect(() => {
    void fetchFilesList(agentId);
  }, [agentId, fetchFilesList]);

  const handleFileClick = useCallback(
    (file: AgentFileEntry) => {
      if (file.missing) {
        setCreatingFile(file.name);
        setSelectedFile(null);
      } else {
        setSelectedFile(file.name);
        setCreatingFile(null);
        void fetchBootstrapFile(agentId, file.name);
      }
    },
    [agentId, fetchBootstrapFile],
  );

  const handleCreateClick = useCallback((fileName: string) => {
    setCreatingFile(fileName);
    setSelectedFile(null);
  }, []);

  // Use files from agents.files.list if available, fall back to systemPromptPreview.bootstrapFiles
  const files =
    agentFilesList.length > 0
      ? agentFilesList
      : (systemPromptPreview?.bootstrapFiles ?? []).map((f) => ({
          name: f.name,
          path: f.path ?? f.name,
          missing: f.missing ?? false,
          size: undefined,
          updatedAtMs: undefined,
        }));

  if (filesListLoading) {
    return (
      <div className="flex items-center gap-2 py-4 justify-center">
        <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
        <span className="text-xs text-[var(--muted-foreground)]">{t("filesLoading")}</span>
      </div>
    );
  }

  if (files.length === 0) {
    return <p className="text-xs text-[var(--muted-foreground)] py-2">{t("filesEmpty")}</p>;
  }

  // Build a BootstrapFileEditor-compatible files array from the selected/creating state
  const editorFiles =
    systemPromptPreview?.bootstrapFiles ??
    files.map((f) => ({
      name: f.name,
      path: f.path,
      missing: f.missing,
    }));

  return (
    <div className="space-y-2">
      {/* File list table */}
      <div className="space-y-0.5">
        {files.map((file) => {
          const isSelected = selectedFile === file.name || creatingFile === file.name;
          return (
            <button
              key={file.name}
              type="button"
              onClick={() => handleFileClick(file)}
              className={`flex items-center gap-3 w-full px-2 py-1.5 rounded text-left transition-colors cursor-pointer ${
                isSelected
                  ? "bg-[var(--primary-muted)] ring-1 ring-[var(--primary)]/20"
                  : "hover:bg-[var(--accent)]"
              }`}
            >
              <File size={14} className="text-[var(--muted-foreground)] shrink-0" />
              <span className="text-xs font-mono text-[var(--foreground)] flex-1 min-w-0 truncate">
                {file.name}
              </span>
              {file.missing ? (
                <div className="flex items-center gap-1.5">
                  <Badge className="text-[9px] bg-[var(--destructive-muted)] text-[var(--destructive)] border-0">
                    {t("fileMissing")}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateClick(file.name);
                    }}
                  >
                    <FilePlus size={10} className="mr-0.5" />
                    {t("fileCreate")}
                  </Button>
                </div>
              ) : (
                <>
                  <span className="text-[10px] text-[var(--muted-foreground)] tabular-nums shrink-0">
                    {formatSize(file.size)}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)] shrink-0">
                    {formatRelativeTime(file.updatedAtMs)}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Editor area — BootstrapFileEditor has its own file selection UI.
          We pass the full files array and let it handle selection internally.
          When user clicks a file in our list above, we just expand this section. */}
      {(selectedFile || creatingFile) && (
        <div className="border-t border-[var(--border-subtle)] pt-2">
          <BootstrapFileEditor agentId={agentId} files={editorFiles} />
        </div>
      )}
    </div>
  );
}
```

NOTE: `BootstrapFileEditor` only accepts `{ agentId, files }` props — no `initialFile`. The FilesBrowser triggers visibility of the editor section; the user then clicks the desired file within BootstrapFileEditor's own UI. If deeper integration is needed (auto-selecting the file), extend BootstrapFileEditor during implementation by adding an optional `defaultFile?: string` prop.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | tail -5`
Expected: 0 errors (may need adjustments to BootstrapFileEditor integration)

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(agents): add FilesBrowser component for Context tab" \
  dashboard/src/components/panels/agents/tabs/FilesBrowser.tsx
```

---

### Task 8: Integrate FilesBrowser into ContextTab [frontend]

covers: agent-files-browser/spec.md > ADDED > Files browser displays complete file list > Display file list
covers: agent-files-browser/spec.md > ADDED > Files browser displays complete file list > Click to edit file

**Files:**

- Modify: `dashboard/src/components/panels/agents/tabs/ContextTab.tsx`

- [ ] **Step 1: Replace bootstrap files section with FilesBrowser**

Add import at top:

```typescript
import { FilesBrowser } from "./FilesBrowser";
```

Replace the Section 2 (Bootstrap Files) Collapsible content. In the `CollapsibleContent` for bootstrap files (around line 240-256), replace the inner content with:

```tsx
<CollapsibleContent>
  <div className="border-t border-[var(--border-subtle)] px-4 py-3">
    <FilesBrowser agentId={agentId} />
  </div>
</CollapsibleContent>
```

Update the section header to use the new i18n key. Change `{t("bootstrapFiles")}` to `{t("filesBrowser")}` in the CollapsibleTrigger for Section 2.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(agents): integrate FilesBrowser into ContextTab" \
  dashboard/src/components/panels/agents/tabs/ContextTab.tsx
```

---

### Task 9: Skill Install Dialog (Agent-level) [frontend]

covers: agent-skills-management/spec.md > ADDED > Skill install dialog supports local and ClawHub installation > Install local skill
covers: agent-skills-management/spec.md > ADDED > Skill install dialog supports local and ClawHub installation > Install ClawHub skill
covers: agent-skills-management/spec.md > ADDED > Skill install dialog supports local and ClawHub installation > Install failure

**Files:**

- Create: `dashboard/src/components/panels/agents/tabs/SkillInstallDialog.tsx`

- [ ] **Step 1: Implement SkillInstallDialog**

NOTE: `skills.install` requires `name` and `installId` matching entries from `skills.status` response (install options with spec IDs like `brew-0`, `npm-0`). Random UUIDs will fail. For local skills, the install spec comes from the skill's metadata. For ClawHub, use `source: "clawhub"` with a single-segment slug (no `/`).

This dialog has two tabs: "Install Options" (shows available install specs from skills.status) and "ClawHub" (slug input). The local path approach from the proposal is NOT viable — `skills.install` installs dependencies, not the skill itself from a path.

```tsx
// dashboard/src/components/panels/agents/tabs/SkillInstallDialog.tsx
"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface InstallOption {
  skillName: string;
  installId: string;
  label: string;
}

interface SkillInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstalled: () => void;
}

type InstallTab = "options" | "clawhub";

export function SkillInstallDialog({ open, onOpenChange, onInstalled }: SkillInstallDialogProps) {
  const t = useTranslations("agentDetail");
  const [tab, setTab] = useState<InstallTab>("clawhub");
  const [slug, setSlug] = useState("");
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [installOptions, setInstallOptions] = useState<InstallOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Fetch available install options from skills.status
  const fetchInstallOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const res = await fetch("/api/skills");
      if (!res.ok) return;
      const data = (await res.json()) as {
        skills?: Array<{
          key: string;
          label?: string;
          metadata?: { install?: Array<{ type?: string; id?: string }> };
        }>;
      };
      const options: InstallOption[] = [];
      for (const skill of data.skills ?? []) {
        const installs = skill.metadata?.install ?? [];
        for (const [idx, spec] of installs.entries()) {
          options.push({
            skillName: skill.key,
            installId: spec.id ?? `${spec.type ?? "unknown"}-${idx}`,
            label: `${skill.label ?? skill.key} (${spec.type ?? "install"})`,
          });
        }
      }
      setInstallOptions(options);
    } catch {
      // best-effort
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setError(null);
      setResult(null);
      void fetchInstallOptions();
    }
  }, [open, fetchInstallOptions]);

  const handleInstallOption = async (opt: InstallOption) => {
    setInstalling(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/skills/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: opt.skillName, installId: opt.installId }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        stderr?: string;
        error?: string;
      };
      if (!res.ok || data.ok === false) {
        setError(data.stderr || data.error || data.message || t("installFailed"));
      } else {
        setResult(data.message || t("installSuccess"));
        onInstalled();
      }
    } catch {
      setError(t("installFailed"));
    } finally {
      setInstalling(false);
    }
  };

  const handleInstallClawHub = async () => {
    setInstalling(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/skills/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "clawhub", slug: slug.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        stderr?: string;
        error?: string;
      };
      if (!res.ok || data.ok === false) {
        setError(data.stderr || data.error || data.message || t("installFailed"));
      } else {
        setResult(data.message || t("installSuccess"));
        onInstalled();
      }
    } catch {
      setError(t("installFailed"));
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{t("installSkill")}</DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 border-b border-[var(--border)] pb-0">
          {(["options", "clawhub"] as const).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              className="px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer"
              style={{
                color: tab === tabKey ? "var(--primary)" : "var(--muted-foreground)",
                borderBottom: tab === tabKey ? "2px solid var(--primary)" : "2px solid transparent",
              }}
              onClick={() => {
                setTab(tabKey);
                setError(null);
                setResult(null);
              }}
            >
              {tabKey === "options" ? t("installLocal") : t("installClawHub")}
            </button>
          ))}
        </div>

        <div className="space-y-3 pt-2">
          {tab === "options" ? (
            <div className="space-y-1">
              {optionsLoading ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 size={14} className="animate-spin text-[var(--muted-foreground)]" />
                </div>
              ) : installOptions.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)] py-2">
                  {t("noSkillsAvailable")}
                </p>
              ) : (
                installOptions.map((opt) => (
                  <button
                    key={`${opt.skillName}-${opt.installId}`}
                    type="button"
                    disabled={installing}
                    onClick={() => void handleInstallOption(opt)}
                    className="w-full text-left px-3 py-2 rounded border border-[var(--border)] text-xs hover:bg-[var(--accent)] transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          ) : (
            <div>
              <label className="text-xs text-[var(--muted-foreground)] block mb-1">
                {t("skillSlug")}
              </label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={t("skillSlugPlaceholder")}
                className="text-xs"
              />
              <Button
                onClick={() => void handleInstallClawHub()}
                disabled={!slug.trim() || installing}
                className="w-full mt-2 cursor-pointer"
                size="sm"
              >
                {installing ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1" />
                    {t("installing")}
                  </>
                ) : (
                  t("installSkill")
                )}
              </Button>
            </div>
          )}

          {/* Error / Result */}
          {error && (
            <p className="text-xs text-[var(--destructive)] bg-[var(--destructive-muted)] p-2 rounded">
              {error}
            </p>
          )}
          {result && (
            <p className="text-xs text-[var(--success)] bg-[var(--success-muted)] p-2 rounded">
              {result}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(agents): add SkillInstallDialog for agent-level skill installation" \
  dashboard/src/components/panels/agents/tabs/SkillInstallDialog.tsx
```

---

### Task 10: Skill Config Editor Component [frontend]

covers: agent-skills-management/spec.md > ADDED > Skill config editor supports apiKey and env > Edit skill API key
covers: agent-skills-management/spec.md > ADDED > Skill config editor supports apiKey and env > Edit skill env variables

**Files:**

- Create: `dashboard/src/components/panels/agents/tabs/SkillConfigEditor.tsx`

- [ ] **Step 1: Implement SkillConfigEditor**

```tsx
// dashboard/src/components/panels/agents/tabs/SkillConfigEditor.tsx
"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SkillConfigEditorProps {
  skillKey: string;
  initialApiKey?: string;
  initialEnv?: Record<string, string>;
  onSaved: () => void;
}

export function SkillConfigEditor({
  skillKey,
  initialApiKey,
  initialEnv,
  onSaved,
}: SkillConfigEditorProps) {
  const t = useTranslations("agentDetail");
  const tc = useTranslations("common");
  const [apiKey, setApiKey] = useState(initialApiKey ?? "");
  const [envPairs, setEnvPairs] = useState<Array<{ key: string; value: string }>>(
    initialEnv ? Object.entries(initialEnv).map(([key, value]) => ({ key, value })) : [],
  );
  const [saving, setSaving] = useState(false);

  const addEnvPair = useCallback(() => {
    setEnvPairs((prev) => [...prev, { key: "", value: "" }]);
  }, []);

  const removeEnvPair = useCallback((index: number) => {
    setEnvPairs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateEnvPair = useCallback((index: number, field: "key" | "value", val: string) => {
    setEnvPairs((prev) => prev.map((pair, i) => (i === index ? { ...pair, [field]: val } : pair)));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const env: Record<string, string> = {};
      for (const pair of envPairs) {
        if (pair.key.trim()) env[pair.key.trim()] = pair.value;
      }

      const res = await fetch(`/api/skills/${encodeURIComponent(skillKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(apiKey ? { apiKey } : {}),
          ...(Object.keys(env).length > 0 ? { env } : {}),
        }),
      });

      if (res.ok) {
        onSaved();
      }
    } catch {
      // best-effort
    } finally {
      setSaving(false);
    }
  }, [skillKey, apiKey, envPairs, onSaved]);

  return (
    <div className="space-y-3 p-3 rounded border border-[var(--border-subtle)] bg-[var(--background)]">
      {/* API Key */}
      <div>
        <label className="text-[10px] text-[var(--muted-foreground)] block mb-1">
          {t("skillApiKey")}
        </label>
        <Input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={t("skillApiKeyPlaceholder")}
          className="text-xs h-7"
        />
      </div>

      {/* Env vars */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-[var(--muted-foreground)]">{t("skillEnvVars")}</label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] gap-0.5 cursor-pointer"
            onClick={addEnvPair}
          >
            <Plus size={10} />
            {t("addEnvVar")}
          </Button>
        </div>
        <div className="space-y-1">
          {envPairs.map((pair, i) => (
            <div key={i} className="flex items-center gap-1">
              <Input
                value={pair.key}
                onChange={(e) => updateEnvPair(i, "key", e.target.value)}
                placeholder={t("skillEnvKey")}
                className="text-xs h-7 flex-1"
              />
              <Input
                value={pair.value}
                onChange={(e) => updateEnvPair(i, "value", e.target.value)}
                placeholder={t("skillEnvValue")}
                className="text-xs h-7 flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-[var(--destructive)] cursor-pointer"
                onClick={() => removeEnvPair(i)}
              >
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <Button
        size="sm"
        onClick={() => void handleSave()}
        disabled={saving}
        className="cursor-pointer"
      >
        {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
        {tc("save")}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(agents): add SkillConfigEditor for apiKey and env editing" \
  dashboard/src/components/panels/agents/tabs/SkillConfigEditor.tsx
```

---

### Task 11: Enhance SkillsTab with Install, Config, and Update [frontend]

covers: agent-skills-management/spec.md > ADDED > Skill install dialog supports local and ClawHub installation > Install local skill
covers: agent-skills-management/spec.md > ADDED > Skill config editor supports apiKey and env > Edit skill API key
covers: agent-skills-management/spec.md > ADDED > Skill update functionality

**Files:**

- Modify: `dashboard/src/components/panels/agents/tabs/SkillsTab.tsx`

- [ ] **Step 1: Add install button, config editor, and update buttons**

Add imports at top:

```typescript
import { Download, Loader2, RefreshCw, Settings } from "lucide-react";
import { SkillInstallDialog } from "./SkillInstallDialog";
import { SkillConfigEditor } from "./SkillConfigEditor";
```

Add state variables inside the component (after existing state):

```typescript
const [installOpen, setInstallOpen] = useState(false);
const [expandedSkillKey, setExpandedSkillKey] = useState<string | null>(null);
const [updatingKeys, setUpdatingKeys] = useState<Record<string, boolean>>({});
const [updateAllLoading, setUpdateAllLoading] = useState(false);
```

Add state for skills.status data (provides slug/source info that deck.agents.skills.get lacks):

```typescript
const [skillsStatusMap, setSkillsStatusMap] = useState<
  Map<string, { source?: string; slug?: string }>
>(new Map());
```

Fetch skills.status on mount to get slug/source metadata:

```typescript
useEffect(() => {
  void (async () => {
    try {
      const res = await fetch("/api/skills");
      if (!res.ok) return;
      const data = (await res.json()) as {
        skills?: Array<{ key: string; source?: string; slug?: string }>;
      };
      const map = new Map<string, { source?: string; slug?: string }>();
      for (const s of data.skills ?? []) {
        map.set(s.key, { source: s.source, slug: s.slug });
      }
      setSkillsStatusMap(map);
    } catch {
      /* best-effort */
    }
  })();
}, [agentId]);
```

Add update handler (uses slugs from skills.status):

```typescript
const handleUpdateClawHub = useCallback(
  async (slug?: string) => {
    if (slug) {
      setUpdatingKeys((prev) => ({ ...prev, [slug]: true }));
    } else {
      setUpdateAllLoading(true);
    }
    try {
      await fetch("/api/skills/update-clawhub", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slug ? { slug } : { all: true }),
      });
      await fetchSkills(agentId);
    } catch {
      // best-effort
    } finally {
      if (slug) {
        setUpdatingKeys((prev) => ({ ...prev, [slug]: false }));
      } else {
        setUpdateAllLoading(false);
      }
    }
  },
  [agentId, fetchSkills],
);
```

Modify the return JSX:

- Before the mode switcher Card, add a header row with install button:

```tsx
{/* Header with install + update all */}
<div className="flex items-center justify-between">
  <h3 className="text-xs font-semibold text-[var(--foreground)]">{t("skills")}</h3>
  <div className="flex items-center gap-2">
    <Button
      size="sm"
      variant="outline"
      onClick={() => void handleUpdateClawHub()}
      disabled={updateAllLoading}
      className="h-7 text-xs gap-1 cursor-pointer"
    >
      {updateAllLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
      {t("updateAll")}
    </Button>
    <Button
      size="sm"
      onClick={() => setInstallOpen(true)}
      className="h-7 text-xs gap-1 cursor-pointer"
    >
      <Download size={12} />
      {t("installSkill")}
    </Button>
  </div>
</div>

<SkillInstallDialog
  open={installOpen}
  onOpenChange={setInstallOpen}
  onInstalled={() => void fetchSkills(agentId)}
/>
```

- In each skill entry button, after the `Badge` for eligibility, add a config toggle button:

```tsx
<button
  type="button"
  className="p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] cursor-pointer"
  onClick={(e) => {
    e.stopPropagation();
    setExpandedSkillKey(expandedSkillKey === entry.key ? null : entry.key);
  }}
  title={t("configureSkill")}
>
  <Settings size={12} />
</button>
```

- After each skill button, conditionally render the config editor:

```tsx
{
  expandedSkillKey === entry.key && (
    <SkillConfigEditor
      skillKey={entry.key}
      initialApiKey={(entry as unknown as { config?: { apiKey?: string } }).config?.apiKey}
      initialEnv={(entry as unknown as { config?: { env?: Record<string, string> } }).config?.env}
      onSaved={() => {
        setExpandedSkillKey(null);
        void fetchSkills(agentId);
      }}
    />
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(agents): enhance SkillsTab with install, config, and update UI" \
  dashboard/src/components/panels/agents/tabs/SkillsTab.tsx
```

---

### Task 12: Agent Identity Display in OverviewTab [frontend]

covers: agent-identity-display/spec.md > ADDED > Overview tab displays full agent identity > Display identity with avatar
covers: agent-identity-display/spec.md > ADDED > Overview tab displays full agent identity > Identity API unavailable

**Files:**

- Modify: `dashboard/src/components/panels/agents/tabs/OverviewTab.tsx`

- [ ] **Step 1: Fetch and display identity data**

Add imports:

```typescript
import { useEffect } from "react";
import { useDeckAgentsStore } from "@/stores/deck-agents";
```

Inside the `OverviewTab` component, add identity fetching:

```typescript
const { agentIdentity, fetchIdentity } = useDeckAgentsStore();

useEffect(() => {
  void fetchIdentity(detail.id);
}, [detail.id, fetchIdentity]);
```

Replace the Identity preview Card section (around line 204-231). Replace the avatar placeholder with actual identity data:

```tsx
{
  /* Identity preview */
}
<Card className="bg-[var(--background)] border-[var(--border)]">
  <CardContent className="p-3">
    <div className="flex items-center gap-2 text-xs mb-2">
      <User size={14} className="text-[var(--primary)]" />
      <span className="text-[var(--muted-foreground)]">{t("identity")}</span>
      {detail.identityExists && (
        <Badge variant="secondary" className="text-[10px]">
          IDENTITY.md
        </Badge>
      )}
    </div>
    <div className="flex items-center gap-3">
      {agentIdentity?.avatar ? (
        <img
          src={agentIdentity.avatar}
          alt={t("avatarAlt")}
          className="w-10 h-10 rounded-xl ring-1 ring-[var(--primary)]/20 object-cover"
        />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-[var(--primary-muted)] flex items-center justify-center text-lg ring-1 ring-[var(--primary)]/20">
          {agentIdentity?.emoji ?? (detail.name || detail.id)?.charAt(0)?.toUpperCase() ?? "?"}
        </div>
      )}
      <div className="text-xs">
        <p className="text-[var(--foreground)] font-medium">
          {agentIdentity?.name || detail.name || detail.id}
        </p>
        {agentIdentity?.emoji && (
          <span className="text-[var(--muted-foreground)]">{agentIdentity.emoji}</span>
        )}
        <button
          onClick={() => onNavigateTab("context")}
          className="block text-[var(--primary)] hover:underline cursor-pointer mt-0.5"
        >
          {t("configureIdentity")}
        </button>
      </div>
    </div>
  </CardContent>
</Card>;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | tail -5`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(agents): display agent identity with avatar in OverviewTab" \
  dashboard/src/components/panels/agents/tabs/OverviewTab.tsx
```

---

### Task 13: Mark OpenSpec Tasks Complete + Final Verification [frontend]

covers: (cross-cutting)

**Files:**

- Modify: `openspec/changes/deck-agent-config-enhancement/tasks.md`

- [ ] **Step 1: Run full TypeScript check**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | tail -10`
Expected: 0 errors

- [ ] **Step 2: Run tests**

Run: `cd dashboard && pnpm test 2>&1 | tail -20`
Expected: All tests pass

- [ ] **Step 3: Mark OpenSpec tasks complete**

Replace all `- [ ]` with `- [x]` in `openspec/changes/deck-agent-config-enhancement/tasks.md`.

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] chore(openspec): mark deck-agent-config-enhancement tasks complete" \
  openspec/changes/deck-agent-config-enhancement/tasks.md
```

---

## Requirement Coverage Matrix

```
┌─────────────────────────────────────────────────────────────────────┬─────────┐
│ Spec Requirement                                                    │ Task    │
├─────────────────────────────────────────────────────────────────────┼─────────┤
│ agent-tools-catalog > Expand tools catalog                          │ 1, 2, 4 │
│ agent-tools-catalog > Tool entry details                            │ 4       │
│ agent-tools-catalog > Deny a tool                                   │ 4, 6    │
│ agent-tools-catalog > Allow a denied tool                           │ 4, 6    │
│ agent-tools-catalog > Reset to profile default                      │ 4, 6    │
│ agent-tools-catalog > Tools catalog graceful degradation            │ 4       │
│ agent-skills-management > Install local skill                       │ 9, 11   │
│ agent-skills-management > Install ClawHub skill                     │ 9, 11   │
│ agent-skills-management > Install failure                           │ 9       │
│ agent-skills-management > Edit skill API key                        │ 10, 11  │
│ agent-skills-management > Edit skill env variables                  │ 10, 11  │
│ agent-skills-management > Skill update functionality                │ 1, 11   │
│ agent-files-browser > Display file list                             │ 2, 7, 8 │
│ agent-files-browser > Click to edit file                            │ 7, 8    │
│ agent-files-browser > Missing file indicator                        │ 7       │
│ agent-files-browser > Create missing file                           │ 7       │
│ agent-identity-display > Display identity with avatar               │ 1, 2, 12│
│ agent-identity-display > Identity API unavailable                   │ 2, 12   │
│ agent-model-fallback > Add fallback model                           │ 5, 6    │
│ agent-model-fallback > Remove fallback model                        │ 5       │
│ agent-model-fallback > Reorder fallback models                      │ 5       │
│ agent-model-fallback > Empty fallback list                          │ 5       │
└─────────────────────────────────────────────────────────────────────┴─────────┘
```

All 22 spec requirements are covered. No gaps.
