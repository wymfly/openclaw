# Models Hub V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Models Hub UI to expose model allowlist management, per-model parameters, auth type selection, Bedrock discovery config, and secret reference hints.

**Architecture:** All changes are frontend-only. The existing `config.get`/`config.patch` Gateway RPCs already support all data flows. New store methods follow the established `updateFallbacks` pattern (read configRaw → parse → mutate → PATCH with baseHash → handle 409 → refetch). New UI components follow existing catalog/config patterns.

**Tech Stack:** React 18, Zustand, next-intl, shadcn/ui, Tailwind v4, TypeScript

**Design Spec:** `docs/superpowers/specs/2026-03-24-models-hub-v2-design.md`

---

## File Structure

| File                                                                     | Responsibility                                        | Action |
| ------------------------------------------------------------------------ | ----------------------------------------------------- | ------ |
| `dashboard/src/stores/models.ts`                                         | Zustand store: types, state, config-edit methods      | Modify |
| `dashboard/src/components/panels/models/tabs/CatalogTab.tsx`             | Catalog tab: allowlist toggle, pass props             | Modify |
| `dashboard/src/components/panels/models/catalog/ProviderList.tsx`        | Provider tree: enabled count badge                    | Modify |
| `dashboard/src/components/panels/models/catalog/ProviderOverview.tsx`    | Provider detail: enable toggle per model row          | Modify |
| `dashboard/src/components/panels/models/catalog/ModelDetail.tsx`         | Model detail: enabled toggle + params editor          | Modify |
| `dashboard/src/components/panels/models/catalog/ModelParamsEditor.tsx`   | Per-model params: alias, streaming, thinking, JSON    | Create |
| `dashboard/src/components/panels/models/config/AddProviderDialog.tsx`    | Add provider: auth type dropdown + conditional fields | Modify |
| `dashboard/src/components/panels/models/config/ConfigForm.tsx`           | Provider config: auth type label + secret hint        | Modify |
| `dashboard/src/components/panels/models/config/BedrockDiscoveryCard.tsx` | Global Bedrock discovery settings card                | Create |
| `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx`      | Provider Config tab: Bedrock card + auth type prop    | Modify |
| `dashboard/src/i18n/zh.json`                                             | Chinese translations                                  | Modify |
| `dashboard/src/i18n/en.json`                                             | English translations                                  | Modify |

---

### Task 1: Store — Types, Allowlist State, fetchFallbacks Extension

**Files:**

- Modify: `dashboard/src/stores/models.ts`

- [ ] **Step 1: Add new types and state fields**

Add after `UsageProviderStatus` interface (line ~73):

```typescript
export interface AllowlistEntry {
  alias?: string;
  streaming?: boolean;
  params?: Record<string, unknown>;
}

export interface BedrockDiscoveryConfig {
  enabled?: boolean;
  region?: string;
  providerFilter?: string[];
  refreshInterval?: number;
  defaultContextWindow?: number;
  defaultMaxTokens?: number;
}
```

Add to `ModelsState` interface (after `imageFallbacks: string[]` line ~87):

```typescript
// Model allowlist
allowlist: Record<string, AllowlistEntry>;
allowlistActive: boolean;

// Bedrock discovery
bedrockDiscovery: BedrockDiscoveryConfig;
```

Add method signatures to `ModelsState` (after `fetchUsageSummary`):

```typescript
toggleAllowlist: (active: boolean) => Promise<boolean>;
toggleModelEnabled: (ref: string, enabled: boolean) => Promise<boolean>;
updateModelAllowlistEntry: (ref: string, entry: Partial<AllowlistEntry>) => Promise<boolean>;
updateBedrockDiscovery: (config: BedrockDiscoveryConfig) => Promise<boolean>;
```

Add to `ModelsState` interface (in the state section, after `bedrockDiscovery`):

```typescript
// Provider API format map (derived from config.models.providers)
providerApiMap: Record<string, string>;
```

Add initial state in the store creation (after `usageProviders: []`):

```typescript
  allowlist: {},
  allowlistActive: false,
  bedrockDiscovery: {},
  providerApiMap: {},
```

- [ ] **Step 2: Add config parsing helper**

Add after `getNestedImageModel` function (line ~174):

```typescript
function getNestedAllowlist(config: Record<string, unknown>): {
  active: boolean;
  entries: Record<string, AllowlistEntry>;
} {
  const agents = config.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const models = defaults?.models;
  if (!models || typeof models !== "object" || Array.isArray(models)) {
    return { active: false, entries: {} };
  }
  const m = models as Record<string, unknown>;
  const entries: Record<string, AllowlistEntry> = {};
  for (const [key, value] of Object.entries(m)) {
    if (typeof value === "object" && value !== null) {
      const v = value as Record<string, unknown>;
      entries[key] = {
        alias: typeof v.alias === "string" ? v.alias : undefined,
        streaming: typeof v.streaming === "boolean" ? v.streaming : undefined,
        params:
          typeof v.params === "object" && v.params !== null
            ? (v.params as Record<string, unknown>)
            : undefined,
      };
    } else {
      entries[key] = {};
    }
  }
  // IMPORTANT: Empty object = backend treats as no allowlist (allowAny=true).
  // Match backend semantics: empty entries → inactive.
  if (Object.keys(entries).length === 0) {
    return { active: false, entries: {} };
  }
  return { active: true, entries };
}

function getNestedBedrockDiscovery(config: Record<string, unknown>): BedrockDiscoveryConfig {
  const models = config.models as Record<string, unknown> | undefined;
  const bd = models?.bedrockDiscovery as Record<string, unknown> | undefined;
  if (!bd) {
    return {};
  }
  return {
    enabled: typeof bd.enabled === "boolean" ? bd.enabled : undefined,
    region: typeof bd.region === "string" ? bd.region : undefined,
    providerFilter: Array.isArray(bd.providerFilter)
      ? (bd.providerFilter as string[]).filter((s) => typeof s === "string")
      : undefined,
    refreshInterval: typeof bd.refreshInterval === "number" ? bd.refreshInterval : undefined,
    defaultContextWindow:
      typeof bd.defaultContextWindow === "number" ? bd.defaultContextWindow : undefined,
    defaultMaxTokens: typeof bd.defaultMaxTokens === "number" ? bd.defaultMaxTokens : undefined,
  };
}
```

- [ ] **Step 3: Add providerApiMap helper**

Add after `getNestedBedrockDiscovery`:

```typescript
// Static fallback for implicit (built-in) providers not in config.models.providers.
// Backend normalizes provider names (e.g. "bedrock" → "amazon-bedrock"), so include aliases.
const IMPLICIT_PROVIDER_API: Record<string, string> = {
  anthropic: "anthropic-messages",
  openai: "openai-responses",
  google: "google-generative-ai",
  "google-generative-ai": "google-generative-ai",
  "github-copilot": "github-copilot",
  "amazon-bedrock": "bedrock-converse-stream",
  bedrock: "bedrock-converse-stream",
  ollama: "ollama",
};

function getNestedProviderApiMap(config: Record<string, unknown>): Record<string, string> {
  // Start with implicit provider defaults
  const map: Record<string, string> = { ...IMPLICIT_PROVIDER_API };
  // Override with explicit config (user-defined providers take precedence)
  const models = config.models as Record<string, unknown> | undefined;
  const providers = models?.providers as Record<string, unknown> | undefined;
  if (providers) {
    for (const [name, value] of Object.entries(providers)) {
      if (typeof value === "object" && value !== null) {
        const api = (value as Record<string, unknown>).api;
        if (typeof api === "string") map[name] = api;
      }
    }
  }
  return map;
}
```

- [ ] **Step 4: Extend `fetchFallbacks` to populate allowlist, bedrockDiscovery, and providerApiMap**

In the `fetchFallbacks` method, after line `const { primary: imagePrimary, fallbacks: imageFallbacks } = getNestedImageModel(config);` (line ~303), add:

```typescript
const { active: allowlistActive, entries: allowlist } = getNestedAllowlist(config);
const bedrockDiscovery = getNestedBedrockDiscovery(config);
const providerApiMap = getNestedProviderApiMap(config);
```

And in the `set()` call below, add:

```typescript
        allowlistActive,
        allowlist,
        bedrockDiscovery,
        providerApiMap,
```

Also update the error reset at line ~298 to include:

```typescript
set({
  configRaw: null,
  configHash: null,
  primaryModel: null,
  fallbacks: [],
  allowlist: {},
  allowlistActive: false,
  bedrockDiscovery: {},
  providerApiMap: {},
});
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/stores/models.ts
git commit -m "[enhanced] feat(deck): add allowlist types, state, and fetchFallbacks extension"
```

---

### Task 2: Store — Allowlist Mutation Methods

**Files:**

- Modify: `dashboard/src/stores/models.ts`

- [ ] **Step 1: Extract shared `patchConfig` helper**

To avoid repeating the PATCH+409+refetch logic, extract a helper above the store (before `useModelsStore`):

```typescript
async function patchConfig(
  get: () => ModelsState,
  _set: (partial: Partial<ModelsState>) => void,
  updatedConfig: Record<string, unknown>,
): Promise<boolean> {
  try {
    const res = await fetch("/api/models/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw: JSON.stringify(updatedConfig),
        baseHash: get().configHash,
      }),
    });
    if (res.status === 409) {
      await get().fetchFallbacks();
      return false;
    }
    if (!res.ok) return false;
    await get().fetchFallbacks();
    return true;
  } catch {
    return false;
  }
}
```

Then refactor `updateFallbacks`, `updateImageFallbacks` to also use this helper (reduces ~40 lines of duplication).

- [ ] **Step 2: Implement `toggleAllowlist`**

Add after `fetchUsageSummary` method. This method sets or removes `agents.defaults.models` in the config. When activating, auto-populate with current primary + fallback models:

```typescript
  toggleAllowlist: async (active) => {
    const state = get();
    if (!state.configRaw) return false;
    const config = parseConfig(state.configRaw);
    if (!config) return false;

    const agents = (config.agents as Record<string, unknown>) ?? {};
    const defaults = (agents.defaults as Record<string, unknown>) ?? {};

    if (active) {
      // Auto-populate with current primary + fallbacks
      const initial: Record<string, Record<string, unknown>> = {};
      if (state.primaryModel) initial[state.primaryModel] = {};
      for (const fb of state.fallbacks) initial[fb] = {};
      if (state.imagePrimaryModel) initial[state.imagePrimaryModel] = {};
      for (const fb of state.imageFallbacks) initial[fb] = {};

      const updatedConfig = {
        ...config,
        agents: { ...agents, defaults: { ...defaults, models: initial } },
      };
      return await patchConfig(get, set, updatedConfig);
    } else {
      // Remove models key entirely
      const { models: _removed, ...restDefaults } = defaults;
      const updatedConfig = {
        ...config,
        agents: { ...agents, defaults: restDefaults },
      };
      return await patchConfig(get, set, updatedConfig);
    }
  },
```

- [ ] **Step 3: Implement `toggleModelEnabled`**

Note: Use spread `{ ... }` to create new objects — do NOT mutate parsed config references.

```typescript
  toggleModelEnabled: async (ref, enabled) => {
    const state = get();
    if (!state.configRaw) return false;
    const config = parseConfig(state.configRaw);
    if (!config) return false;

    const agents = (config.agents as Record<string, unknown>) ?? {};
    const defaults = (agents.defaults as Record<string, unknown>) ?? {};
    const existingModels = (defaults.models as Record<string, unknown>) ?? {};
    // Immutable update — spread to new object
    const models = { ...existingModels };

    if (enabled) {
      models[ref] = {};
    } else {
      delete models[ref];
    }

    // If allowlist becomes empty after removing last model, delete the
    // models key entirely to match backend semantics (empty = allowAny).
    const hasEntries = Object.keys(models).length > 0;

    const updatedConfig = {
      ...config,
      agents: {
        ...agents,
        defaults: hasEntries
          ? { ...defaults, models }
          : (() => { const { models: _, ...rest } = defaults; return rest; })(),
      },
    };
    return await patchConfig(get, set, updatedConfig);
  },
```

- [ ] **Step 4: Implement `updateModelAllowlistEntry`**

```typescript
  updateModelAllowlistEntry: async (ref, entry) => {
    const state = get();
    if (!state.configRaw) return false;
    const config = parseConfig(state.configRaw);
    if (!config) return false;

    const agents = (config.agents as Record<string, unknown>) ?? {};
    const defaults = (agents.defaults as Record<string, unknown>) ?? {};
    const existingModels = (defaults.models as Record<string, unknown>) ?? {};
    // Immutable update
    const models = { ...existingModels };
    const existing = (models[ref] as Record<string, unknown>) ?? {};

    // Merge: alias and streaming are top-level, params is deep-merged
    const merged = { ...existing };
    if (entry.alias !== undefined) merged.alias = entry.alias || undefined;
    if (entry.streaming !== undefined) merged.streaming = entry.streaming;
    if (entry.params !== undefined) merged.params = entry.params;

    models[ref] = merged;

    const updatedConfig = {
      ...config,
      agents: { ...agents, defaults: { ...defaults, models } },
    };
    return await patchConfig(get, set, updatedConfig);
  },
```

- [ ] **Step 5: Implement `updateBedrockDiscovery`**

```typescript
  updateBedrockDiscovery: async (bdConfig) => {
    const state = get();
    if (!state.configRaw) return false;
    const config = parseConfig(state.configRaw);
    if (!config) return false;

    const models = (config.models as Record<string, unknown>) ?? {};
    const updatedConfig = {
      ...config,
      models: { ...models, bedrockDiscovery: bdConfig },
    };
    return await patchConfig(get, set, updatedConfig);
  },
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/stores/models.ts
git commit -m "[enhanced] feat(deck): add allowlist mutation methods and patchConfig helper"
```

---

### Task 3: Store — addCustomProvider Rewrite

**Files:**

- Modify: `dashboard/src/stores/models.ts`

- [ ] **Step 1: Update `addCustomProvider` signature**

In `ModelsState` interface, update the `addCustomProvider` signature:

```typescript
addCustomProvider: (params: {
  name: string;
  baseUrl?: string;
  apiKey?: string;
  api?: string;
  auth?: string;
  models?: Array<{ id: string; name: string; contextWindow: number; maxTokens: number }>;
}) => Promise<boolean>;
```

- [ ] **Step 2: Rewrite implementation to use config.patch flow**

Replace the existing `addCustomProvider` method body:

```typescript
  addCustomProvider: async (params) => {
    // Ensure config is loaded
    if (!get().configRaw) {
      await get().fetchFallbacks();
    }
    const config = parseConfig(get().configRaw);
    if (!config) return false;

    const modelsConfig = (config.models as Record<string, unknown>) ?? {};
    const providers = (modelsConfig.providers as Record<string, unknown>) ?? {};

    providers[params.name] = {
      ...(params.baseUrl ? { baseUrl: params.baseUrl } : {}),
      ...(params.apiKey ? { apiKey: params.apiKey } : {}),
      ...(params.auth ? { auth: params.auth } : {}),
      ...(params.api ? { api: params.api } : {}),
      ...(params.models ? { models: params.models } : {}),
    };

    const updatedConfig = {
      ...config,
      models: { ...modelsConfig, providers },
    };

    const ok = await patchConfig(get, set, updatedConfig);
    if (ok) {
      await get().fetchAuthOverview();
    }
    return ok;
  },
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/stores/models.ts
git commit -m "[enhanced] fix(deck): rewrite addCustomProvider to use config.patch flow"
```

---

### Task 4: CatalogTab — Allowlist Toggle + ProviderList Badge

**Files:**

- Modify: `dashboard/src/components/panels/models/tabs/CatalogTab.tsx`
- Modify: `dashboard/src/components/panels/models/catalog/ProviderList.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add i18n keys**

Add to `models.catalog` in both locale files:

```json
"allowlistToggle": "模型白名单",
"allowlistOff": "所有模型可用 — 开启白名单以限制可用范围",
"allowlistConfirm": "开启白名单后，只有显式启用的模型可用。当前主模型和备选模型将自动加入。确定继续？",
"enabledCount": "{count}/{total} 已启用"
```

English:

```json
"allowlistToggle": "Model Allowlist",
"allowlistOff": "All models available — enable allowlist to restrict",
"allowlistConfirm": "Enabling the allowlist restricts access to only explicitly enabled models. Current primary and fallback models will be auto-added. Continue?",
"enabledCount": "{count}/{total} enabled"
```

- [ ] **Step 2: Add allowlist toggle to CatalogTab**

In `CatalogTab.tsx`, import Switch from shadcn/ui and add store fields:

```typescript
import { Switch } from "@/components/ui/switch";

// In component:
const { allowlistActive, allowlist, toggleAllowlist } = useModelsStore();
```

Add the toggle bar between the component return's `<div className="flex h-full">` and `<ProviderList>`:

```tsx
{
  /* Allowlist toggle bar */
}
<div className="flex h-full flex-col">
  <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2">
    <Switch
      checked={allowlistActive}
      onCheckedChange={(checked) => {
        if (checked) {
          if (window.confirm(t("catalog.allowlistConfirm"))) {
            void toggleAllowlist(true);
          }
        } else {
          void toggleAllowlist(false);
        }
      }}
    />
    <span className="text-xs font-medium">{t("catalog.allowlistToggle")}</span>
    {!allowlistActive && (
      <span className="text-[10px] text-[var(--muted-foreground)]">
        {t("catalog.allowlistOff")}
      </span>
    )}
  </div>
  <div className="flex flex-1 overflow-hidden">{/* existing ProviderList + detail pane */}</div>
</div>;
```

Pass `allowlist` and `allowlistActive` to `ProviderList`:

```tsx
<ProviderList
  models={models}
  auth={authOverview}
  loading={loading}
  selectedProvider={selectedProvider}
  selectedModel={selectedModel}
  onSelectProvider={handleSelectProvider}
  onSelectModel={handleSelectModel}
  allowlist={allowlist}
  allowlistActive={allowlistActive}
/>
```

- [ ] **Step 3: Add enabled count badge to ProviderList**

In `ProviderList.tsx`, add props:

```typescript
interface ProviderListProps {
  // ... existing props
  allowlist?: Record<string, unknown>;
  allowlistActive?: boolean;
}
```

In the provider trigger row, replace the model count badge with a conditional display:

```tsx
<span className="ml-auto shrink-0 rounded-full bg-[var(--muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted-foreground)]">
  {allowlistActive
    ? t("catalog.enabledCount", {
        count: providerModels.filter((m) => allowlist?.[`${provider}/${m.id}`] != null).length,
        total: providerModels.length,
      })
    : providerModels.length}
</span>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/panels/models/tabs/CatalogTab.tsx \
       dashboard/src/components/panels/models/catalog/ProviderList.tsx \
       dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): add allowlist toggle to CatalogTab with enabled count"
```

---

### Task 5: ModelDetail + ProviderOverview — Enable/Disable Toggles

**Files:**

- Modify: `dashboard/src/components/panels/models/catalog/ModelDetail.tsx`
- Modify: `dashboard/src/components/panels/models/catalog/ProviderOverview.tsx`
- Modify: `dashboard/src/components/panels/models/tabs/CatalogTab.tsx`
- Modify: `dashboard/src/i18n/zh.json`, `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add i18n keys**

Add to `models.catalog`:

```json
"enabled": "已启用",
"disabled": "未启用",
"enableModel": "启用",
"disableModel": "禁用"
```

English:

```json
"enabled": "Enabled",
"disabled": "Disabled",
"enableModel": "Enable",
"disableModel": "Disable"
```

- [ ] **Step 2: Add enabled toggle to ModelDetail**

Add new props and import:

```typescript
import { Switch } from "@/components/ui/switch";

interface ModelDetailProps {
  model: Model;
  auth: AuthOverviewEntry | undefined;
  onSetDefault: (provider: string, modelId: string) => void;
  onAddToFallback: (provider: string, modelId: string) => void;
  allowlistActive?: boolean;
  isEnabled?: boolean;
  onToggleEnabled?: (provider: string, modelId: string, enabled: boolean) => void;
}
```

Add the toggle in the header section, after the model id line:

```tsx
{
  /* Allowlist toggle */
}
{
  allowlistActive && onToggleEnabled && (
    <div className="mt-2 flex items-center gap-2">
      <Switch
        checked={isEnabled ?? false}
        onCheckedChange={(checked) => onToggleEnabled(model.provider, model.id, checked)}
      />
      <span className="text-xs text-[var(--muted-foreground)]">
        {isEnabled ? t("catalog.enabled") : t("catalog.disabled")}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Add enable toggle to ProviderOverview table**

Add new props:

```typescript
interface ProviderOverviewProps {
  // ... existing
  allowlistActive?: boolean;
  allowlist?: Record<string, unknown>;
  onToggleEnabled?: (provider: string, modelId: string, enabled: boolean) => void;
}
```

Add a new column header "Enable" (only when allowlistActive) and a toggle per row:

```tsx
{
  /* In thead, add before the actions column: */
}
{
  allowlistActive && (
    <th className="px-4 py-2.5 text-center font-medium">{t("catalog.enableModel")}</th>
  );
}

{
  /* In tbody row, add before actions td: */
}
{
  allowlistActive && onToggleEnabled && (
    <td className="px-4 py-2.5 text-center">
      <Switch
        checked={allowlist?.[`${provider}/${model.id}`] != null}
        onCheckedChange={(checked) => onToggleEnabled(provider, model.id, checked)}
      />
    </td>
  );
}
```

- [ ] **Step 4: Wire up CatalogTab to pass allowlist props**

In `CatalogTab.tsx`, add `toggleModelEnabled` from store and create handler:

```typescript
const { toggleModelEnabled } = useModelsStore();

const handleToggleEnabled = useCallback(
  (provider: string, modelId: string, enabled: boolean) => {
    void toggleModelEnabled(`${provider}/${modelId}`, enabled);
  },
  [toggleModelEnabled],
);
```

Pass to `ProviderOverview`:

```tsx
<ProviderOverview
  provider={selected.provider}
  models={providerModels}
  auth={selectedAuth}
  onSetDefault={handleSetDefault}
  onGoConfig={handleGoConfig}
  allowlistActive={allowlistActive}
  allowlist={allowlist}
  onToggleEnabled={handleToggleEnabled}
/>
```

Pass to `ModelDetail`:

```tsx
<ModelDetail
  model={selectedModelObj}
  auth={selectedAuth}
  onSetDefault={handleSetDefault}
  onAddToFallback={handleAddToFallback}
  allowlistActive={allowlistActive}
  isEnabled={allowlist[`${selectedModelObj.provider}/${selectedModelObj.id}`] != null}
  onToggleEnabled={handleToggleEnabled}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/panels/models/catalog/ModelDetail.tsx \
       dashboard/src/components/panels/models/catalog/ProviderOverview.tsx \
       dashboard/src/components/panels/models/tabs/CatalogTab.tsx \
       dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): add model enable/disable toggles for allowlist"
```

---

### Task 6: ModelParamsEditor — New Component

**Files:**

- Create: `dashboard/src/components/panels/models/catalog/ModelParamsEditor.tsx`
- Modify: `dashboard/src/components/panels/models/catalog/ModelDetail.tsx`
- Modify: `dashboard/src/i18n/zh.json`, `dashboard/src/i18n/en.json`

- [ ] **Step 0: Install shadcn/ui Slider component**

Run: `cd dashboard && npx shadcn@latest add slider`
Expected: `src/components/ui/slider.tsx` created

If the command is not available, create a minimal slider using `<input type="range">` with Tailwind styling as fallback.

- [ ] **Step 1: Add i18n keys**

Add to `models.catalog`:

```json
"params": "模型参数",
"alias": "别名",
"aliasPlaceholder": "例如 opus, sonnet",
"streaming": "流式输出",
"thinkingType": "思考模式",
"thinkingDisabled": "关闭",
"thinkingEnabled": "开启",
"thinkingBudget": "思考预算 (tokens)",
"advancedParams": "高级参数",
"invalidJson": "JSON 格式无效"
```

English:

```json
"params": "Model Parameters",
"alias": "Alias",
"aliasPlaceholder": "e.g. opus, sonnet",
"streaming": "Streaming",
"thinkingType": "Thinking Mode",
"thinkingDisabled": "Disabled",
"thinkingEnabled": "Enabled",
"thinkingBudget": "Thinking Budget (tokens)",
"advancedParams": "Advanced Parameters",
"invalidJson": "Invalid JSON"
```

- [ ] **Step 2: Create ModelParamsEditor component**

```typescript
"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AllowlistEntry } from "@/stores/models";

interface ModelParamsEditorProps {
  modelRef: string;
  entry: AllowlistEntry;
  /** API format of this model's provider (e.g. "anthropic-messages"). */
  providerApi?: string;
  onUpdate: (ref: string, entry: Partial<AllowlistEntry>) => void;
}

const ANTHROPIC_APIS = new Set(["anthropic-messages", "bedrock-converse-stream"]);

export function ModelParamsEditor({ modelRef, entry, providerApi, onUpdate }: ModelParamsEditorProps) {
  const t = useTranslations("models.catalog");

  // Local state for dedicated controls
  const [alias, setAlias] = useState(entry.alias ?? "");
  const [streaming, setStreaming] = useState(entry.streaming ?? true);
  const [thinkingType, setThinkingType] = useState<string>(
    (entry.params?.thinking as Record<string, unknown>)?.type as string ?? "disabled",
  );
  const [thinkingBudget, setThinkingBudget] = useState<number>(
    ((entry.params?.thinking as Record<string, unknown>)?.budget_tokens as number) ?? 10000,
  );

  // JSON editor state
  const [jsonText, setJsonText] = useState(JSON.stringify(entry.params ?? {}, null, 2));
  const [jsonValid, setJsonValid] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Debounce save timer
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from props when entry changes externally
  useEffect(() => {
    setAlias(entry.alias ?? "");
    setStreaming(entry.streaming ?? true);
    const thinking = entry.params?.thinking as Record<string, unknown> | undefined;
    setThinkingType((thinking?.type as string) ?? "disabled");
    setThinkingBudget((thinking?.budget_tokens as number) ?? 10000);
    setJsonText(JSON.stringify(entry.params ?? {}, null, 2));
    setJsonValid(true);
  }, [entry]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const showThinking = providerApi ? ANTHROPIC_APIS.has(providerApi) : false;

  const debouncedSave = useCallback(
    (update: Partial<AllowlistEntry>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onUpdate(modelRef, update);
      }, 500);
    },
    [modelRef, onUpdate],
  );

  // Build params from dedicated controls
  const buildParams = useCallback(
    (overrides?: { thType?: string; thBudget?: number }): Record<string, unknown> => {
      // Start from current JSON params to preserve unknown fields
      let base: Record<string, unknown> = {};
      try {
        base = JSON.parse(jsonText) as Record<string, unknown>;
      } catch {
        base = entry.params ?? {};
      }

      const tType = overrides?.thType ?? thinkingType;
      const tBudget = overrides?.thBudget ?? thinkingBudget;

      if (showThinking && tType === "enabled") {
        base.thinking = { type: "enabled", budget_tokens: tBudget };
      } else if (showThinking) {
        delete base.thinking;
      }

      return base;
    },
    [jsonText, entry.params, thinkingType, thinkingBudget, showThinking],
  );

  const handleAliasChange = (value: string) => {
    setAlias(value);
    debouncedSave({ alias: value || undefined });
  };

  const handleStreamingChange = (value: boolean) => {
    setStreaming(value);
    debouncedSave({ streaming: value });
  };

  const handleThinkingTypeChange = (value: string) => {
    setThinkingType(value);
    const params = buildParams({ thType: value });
    setJsonText(JSON.stringify(params, null, 2));
    debouncedSave({ params });
  };

  const handleThinkingBudgetChange = (value: number[]) => {
    const budget = value[0];
    setThinkingBudget(budget);
    const params = buildParams({ thBudget: budget });
    setJsonText(JSON.stringify(params, null, 2));
    debouncedSave({ params });
  };

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      setJsonValid(true);
      // Sync dedicated controls from JSON
      const thinking = parsed.thinking as Record<string, unknown> | undefined;
      if (thinking) {
        setThinkingType((thinking.type as string) ?? "disabled");
        setThinkingBudget((thinking.budget_tokens as number) ?? 10000);
      }
      debouncedSave({ params: parsed });
    } catch {
      setJsonValid(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--muted)]/30 p-4">
      <h4 className="text-xs font-medium text-[var(--foreground)]">{t("params")}</h4>

      {/* Alias */}
      <div className="space-y-1">
        <Label className="text-[10px] text-[var(--muted-foreground)]">{t("alias")}</Label>
        <Input
          value={alias}
          onChange={(e) => handleAliasChange(e.target.value)}
          placeholder={t("aliasPlaceholder")}
          className="max-w-xs text-xs font-mono"
        />
      </div>

      {/* Streaming */}
      <div className="flex items-center gap-2">
        <Switch checked={streaming} onCheckedChange={handleStreamingChange} />
        <Label className="text-xs text-[var(--muted-foreground)]">{t("streaming")}</Label>
      </div>

      {/* Thinking controls — provider-aware */}
      {showThinking && (
        <div className="space-y-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-[var(--muted-foreground)]">{t("thinkingType")}</Label>
            <Select value={thinkingType} onValueChange={handleThinkingTypeChange}>
              <SelectTrigger className="max-w-xs text-xs cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled" className="text-xs">{t("thinkingDisabled")}</SelectItem>
                <SelectItem value="enabled" className="text-xs">{t("thinkingEnabled")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {thinkingType === "enabled" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] text-[var(--muted-foreground)]">{t("thinkingBudget")}</Label>
                <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                  {thinkingBudget.toLocaleString()}
                </span>
              </div>
              <Slider
                value={[thinkingBudget]}
                onValueChange={handleThinkingBudgetChange}
                min={1000}
                max={100000}
                step={1000}
                className="max-w-xs"
              />
            </div>
          )}
        </div>
      )}

      {/* Advanced: JSON editor */}
      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
        >
          {advancedOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          {t("advancedParams")}
        </button>

        {advancedOpen && (
          <div className="mt-2 space-y-1">
            <textarea
              value={jsonText}
              onChange={(e) => handleJsonChange(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] p-2 font-mono text-xs text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              rows={6}
              spellCheck={false}
            />
            {!jsonValid && (
              <p className="text-[10px] text-[var(--destructive)]">{t("invalidJson")}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Integrate ModelParamsEditor into ModelDetail**

In `ModelDetail.tsx`, add import and render the editor when model is enabled:

```typescript
import { ModelParamsEditor } from "./ModelParamsEditor";
import type { AllowlistEntry } from "@/stores/models";
```

Add props:

```typescript
interface ModelDetailProps {
  // ... existing + allowlist props from Task 5
  allowlistEntry?: AllowlistEntry;
  providerApi?: string;
  onUpdateEntry?: (ref: string, entry: Partial<AllowlistEntry>) => void;
}
```

Add after the Quick actions section:

```tsx
{
  /* Per-model params editor — shown when model is in allowlist */
}
{
  allowlistActive && isEnabled && allowlistEntry && onUpdateEntry && (
    <ModelParamsEditor
      modelRef={`${model.provider}/${model.id}`}
      entry={allowlistEntry}
      providerApi={providerApi}
      onUpdate={onUpdateEntry}
    />
  );
}
```

- [ ] **Step 4: Pass new props from CatalogTab**

In `CatalogTab.tsx`, add `updateModelAllowlistEntry` from store:

```typescript
const { updateModelAllowlistEntry } = useModelsStore();
```

Pass to `ModelDetail`:

```tsx
<ModelDetail
  model={selectedModelObj}
  auth={selectedAuth}
  onSetDefault={handleSetDefault}
  onAddToFallback={handleAddToFallback}
  allowlistActive={allowlistActive}
  isEnabled={allowlist[`${selectedModelObj.provider}/${selectedModelObj.id}`] != null}
  onToggleEnabled={handleToggleEnabled}
  allowlistEntry={allowlist[`${selectedModelObj.provider}/${selectedModelObj.id}`]}
  onUpdateEntry={updateModelAllowlistEntry}
/>
```

The `providerApi` is sourced from `providerApiMap` (populated by `fetchFallbacks` from `config.models.providers[name].api`):

```typescript
const { providerApiMap } = useModelsStore();
```

Pass to `ModelDetail`:

```tsx
providerApi={providerApiMap[selectedModelObj.provider]}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/panels/models/catalog/ModelParamsEditor.tsx \
       dashboard/src/components/panels/models/catalog/ModelDetail.tsx \
       dashboard/src/components/panels/models/tabs/CatalogTab.tsx \
       dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): add ModelParamsEditor with provider-aware thinking controls"
```

---

### Task 7: AddProviderDialog — Auth Type Dropdown

**Files:**

- Modify: `dashboard/src/components/panels/models/config/AddProviderDialog.tsx`
- Modify: `dashboard/src/i18n/zh.json`, `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add i18n keys**

Add to `models.config`:

```json
"authType": "认证类型",
"authApiKey": "API Key",
"authOAuth": "OAuth",
"authAwsSdk": "AWS SDK",
"authToken": "Token",
"oauthHint": "OAuth 通过 CLI 配置",
"secretHint": "支持环境变量引用：${OPENAI_API_KEY}"
```

English:

```json
"authType": "Auth Type",
"authApiKey": "API Key",
"authOAuth": "OAuth",
"authAwsSdk": "AWS SDK",
"authToken": "Token",
"oauthHint": "OAuth configured via CLI",
"secretHint": "Supports environment variable references: ${OPENAI_API_KEY}"
```

- [ ] **Step 2: Add auth type state and dropdown**

In `AddProviderDialog.tsx`, add state:

```typescript
const [authType, setAuthType] = useState<string>("api-key");
```

Add to `reset()`:

```typescript
setAuthType("api-key");
```

Add the Auth Type dropdown after the API Format section:

```tsx
{
  /* Auth Type */
}
<div className="space-y-1.5">
  <Label className="text-xs">{t("authType")}</Label>
  <Select value={authType} onValueChange={setAuthType}>
    <SelectTrigger className="text-xs cursor-pointer">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="api-key" className="text-xs">
        {t("authApiKey")}
      </SelectItem>
      <SelectItem value="oauth" className="text-xs">
        {t("authOAuth")}
      </SelectItem>
      <SelectItem value="aws-sdk" className="text-xs">
        {t("authAwsSdk")}
      </SelectItem>
      <SelectItem value="token" className="text-xs">
        {t("authToken")}
      </SelectItem>
    </SelectContent>
  </Select>
</div>;
```

- [ ] **Step 3: Make API Key/Base URL conditional on auth type**

Replace the API Key section with conditional rendering:

```tsx
{
  /* API Key — shown for api-key and token auth types */
}
{
  (authType === "api-key" || authType === "token") && (
    <div className="space-y-1.5">
      <Label className="text-xs">{authType === "token" ? t("authToken") : t("apiKey")}</Label>
      <Input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="sk-..."
        className="font-mono text-xs"
        autoComplete="off"
      />
      <div className="flex items-center gap-1">
        {apiKey.startsWith("${") && apiKey.endsWith("}") && (
          <span className="text-[var(--primary)]" title="Environment variable reference">
            🔗
          </span>
        )}
        <p className="text-[10px] text-[var(--muted-foreground)]">{t("secretHint")}</p>
      </div>
    </div>
  );
}

{
  /* OAuth hint */
}
{
  authType === "oauth" && (
    <p className="text-xs text-[var(--muted-foreground)] rounded-lg bg-[var(--muted)] p-3">
      {t("oauthHint")}
    </p>
  );
}

{
  /* aws-sdk: no API key needed */
}
```

Update `canSave` — Base URL is required for ALL auth types (schema enforces `baseUrl: z.string()`):

```typescript
const canSave =
  providerName.trim().length > 0 &&
  baseUrl.trim().length > 0 &&
  models.length > 0 &&
  models.every((m) => m.id.trim().length > 0) &&
  !saving;
```

- [ ] **Step 4: Update `onAdd` interface and handleSave**

Update `AddProviderDialogProps.onAdd` to include `auth`:

```typescript
onAdd: (params: {
  name: string;
  api: string;
  auth: string;
  baseUrl: string;
  apiKey?: string;
  models: ModelEntry[];
}) => Promise<boolean>;
```

In `handleSave`, include `auth`:

```typescript
const ok = await onAdd({
  name: providerName.trim(),
  api,
  auth: authType,
  baseUrl: baseUrl.trim(),
  apiKey: apiKey.trim() || undefined,
  models: models.map((m) => ({
    ...m,
    id: m.id.trim(),
    name: m.name.trim() || m.id.trim(),
  })),
});
```

- [ ] **Step 5: Update ProviderConfigTab handleAddProvider**

In `ProviderConfigTab.tsx`, update the `handleAddProvider` callback to pass through the new `auth` field:

```typescript
const handleAddProvider = useCallback(
  async (params: Parameters<typeof addCustomProvider>[0]) => {
    const ok = await addCustomProvider(params);
    if (ok) {
      setSelectedProvider(params.name.toLowerCase().trim());
    }
    return ok;
  },
  [addCustomProvider],
);
```

This already works because the `addCustomProvider` signature was updated in Task 3.

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/components/panels/models/config/AddProviderDialog.tsx \
       dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx \
       dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): add auth type dropdown to AddProviderDialog"
```

---

### Task 8: BedrockDiscoveryCard + ProviderConfigTab Integration

**Files:**

- Create: `dashboard/src/components/panels/models/config/BedrockDiscoveryCard.tsx`
- Modify: `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx`
- Modify: `dashboard/src/i18n/zh.json`, `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add i18n keys**

Add to `models.config`:

```json
"bedrockTitle": "AWS Bedrock 动态发现",
"bedrockEnabled": "启用发现",
"bedrockRegion": "区域",
"bedrockProviderFilter": "提供商过滤",
"bedrockRefreshInterval": "刷新间隔（秒）",
"bedrockDefaultContext": "默认上下文窗口",
"bedrockDefaultMaxTokens": "默认最大输出"
```

English:

```json
"bedrockTitle": "AWS Bedrock Discovery",
"bedrockEnabled": "Enable Discovery",
"bedrockRegion": "Region",
"bedrockProviderFilter": "Provider Filter",
"bedrockRefreshInterval": "Refresh Interval (seconds)",
"bedrockDefaultContext": "Default Context Window",
"bedrockDefaultMaxTokens": "Default Max Output"
```

- [ ] **Step 2: Create BedrockDiscoveryCard**

```typescript
"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { BedrockDiscoveryConfig } from "@/stores/models";

const COMMON_REGIONS = ["us-east-1", "us-west-2", "eu-west-1", "ap-northeast-1"];
const BEDROCK_PROVIDERS = ["anthropic", "amazon", "meta", "cohere", "mistral"];

interface BedrockDiscoveryCardProps {
  config: BedrockDiscoveryConfig;
  onUpdate: (config: BedrockDiscoveryConfig) => Promise<boolean>;
}

export function BedrockDiscoveryCard({ config, onUpdate }: BedrockDiscoveryCardProps) {
  const t = useTranslations("models.config");

  const [enabled, setEnabled] = useState(config.enabled ?? false);
  const [region, setRegion] = useState(config.region ?? "us-east-1");
  const [filter, setFilter] = useState<Set<string>>(new Set(config.providerFilter ?? []));
  const [refreshInterval, setRefreshInterval] = useState(config.refreshInterval ?? 3600);
  const [defaultContext, setDefaultContext] = useState(config.defaultContextWindow ?? 200000);
  const [defaultMaxTokens, setDefaultMaxTokens] = useState(config.defaultMaxTokens ?? 4096);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setEnabled(config.enabled ?? false);
    setRegion(config.region ?? "us-east-1");
    setFilter(new Set(config.providerFilter ?? []));
    setRefreshInterval(config.refreshInterval ?? 3600);
    setDefaultContext(config.defaultContextWindow ?? 200000);
    setDefaultMaxTokens(config.defaultMaxTokens ?? 4096);
  }, [config]);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const save = useCallback(
    (overrides: Partial<BedrockDiscoveryConfig>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void onUpdate({
          enabled,
          region,
          providerFilter: [...filter],
          refreshInterval,
          defaultContextWindow: defaultContext,
          defaultMaxTokens,
          ...overrides,
        });
      }, 500);
    },
    [enabled, region, filter, refreshInterval, defaultContext, defaultMaxTokens, onUpdate],
  );

  const toggleProvider = (provider: string) => {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      save({ providerFilter: [...next] });
      return next;
    });
  };

  return (
    <Card className="transition-panel">
      <CardHeader className="border-b pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{t("bedrockTitle")}</CardTitle>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => { setEnabled(v); save({ enabled: v }); }}
          />
        </div>
      </CardHeader>
      {enabled && (
        <CardContent className="space-y-3 pt-4">
          {/* Region */}
          <div className="space-y-1">
            <Label className="text-[10px] text-[var(--muted-foreground)]">{t("bedrockRegion")}</Label>
            <div className="flex gap-2 max-w-xs">
              <Input
                value={region}
                onChange={(e) => { setRegion(e.target.value); save({ region: e.target.value }); }}
                className="text-xs font-mono flex-1"
                list="bedrock-regions"
              />
              <datalist id="bedrock-regions">
                {COMMON_REGIONS.map((r) => <option key={r} value={r} />)}
              </datalist>
            </div>
          </div>

          {/* Provider Filter */}
          <div className="space-y-1">
            <Label className="text-[10px] text-[var(--muted-foreground)]">{t("bedrockProviderFilter")}</Label>
            <div className="flex flex-wrap gap-2">
              {BEDROCK_PROVIDERS.map((p) => (
                <label key={p} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.has(p)}
                    onChange={() => toggleProvider(p)}
                    className="rounded border-[var(--border)]"
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>

          {/* Numeric fields */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--muted-foreground)]">{t("bedrockRefreshInterval")}</Label>
              <Input
                type="number"
                value={refreshInterval}
                onChange={(e) => { const v = Number(e.target.value); setRefreshInterval(v); save({ refreshInterval: v }); }}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--muted-foreground)]">{t("bedrockDefaultContext")}</Label>
              <Input
                type="number"
                value={defaultContext}
                onChange={(e) => { const v = Number(e.target.value); setDefaultContext(v); save({ defaultContextWindow: v }); }}
                className="text-xs font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-[var(--muted-foreground)]">{t("bedrockDefaultMaxTokens")}</Label>
              <Input
                type="number"
                value={defaultMaxTokens}
                onChange={(e) => { const v = Number(e.target.value); setDefaultMaxTokens(v); save({ defaultMaxTokens: v }); }}
                className="text-xs font-mono"
              />
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
```

- [ ] **Step 3: Integrate into ProviderConfigTab**

In `ProviderConfigTab.tsx`, import and add:

```typescript
import { BedrockDiscoveryCard } from "../config/BedrockDiscoveryCard";

// In component, add store fields:
const { bedrockDiscovery, updateBedrockDiscovery, fetchFallbacks } = useModelsStore();

// Ensure config is loaded for Bedrock discovery
useEffect(() => {
  void fetchFallbacks();
}, [fetchFallbacks]);
```

Add the Bedrock card at the bottom of the right pane, after the ConfigForm or empty state:

```tsx
{
  /* Bedrock Discovery — global config */
}
<BedrockDiscoveryCard config={bedrockDiscovery} onUpdate={updateBedrockDiscovery} />;
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/panels/models/config/BedrockDiscoveryCard.tsx \
       dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx \
       dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): add BedrockDiscoveryCard for global Bedrock config"
```

---

### Task 9: ConfigForm — Auth Type Label + Secret Hint

**Files:**

- Modify: `dashboard/src/components/panels/models/config/ConfigForm.tsx`
- Modify: `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx`

- [ ] **Step 1: Add authType prop to ConfigForm**

```typescript
interface ConfigFormProps {
  provider: string;
  initialConfig?: { apiKey?: string; baseUrl?: string; modelId?: string };
  authType?: string | null; // NEW
  onSave: (config: ProviderConfig) => Promise<boolean>;
}
```

- [ ] **Step 2: Add auth type label at top of ConfigForm**

After `<CardTitle>` in CardHeader:

```tsx
<CardHeader className="border-b pb-3">
  <CardTitle className="text-sm">{t("config.advanced")}</CardTitle>
  {authType && (
    <div className="mt-1 flex items-center gap-2">
      <span className="text-[10px] text-[var(--muted-foreground)]">{t("config.authType")}:</span>
      <span className="rounded bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-mono">
        {authType}
      </span>
    </div>
  )}
</CardHeader>
```

- [ ] **Step 3: Add secret hint below API Key input**

After the API Key input closing `</div>`, add hint + dynamic icon:

```tsx
<div className="flex items-center gap-1">
  {apiKey.startsWith("${") && apiKey.endsWith("}") && (
    <span className="text-[var(--primary)]" title="Environment variable reference">
      🔗
    </span>
  )}
  <p className="text-[10px] text-[var(--muted-foreground)]">{t("config.secretHint")}</p>
</div>
```

The `secretHint` key was already added in Task 7. The 🔗 icon appears dynamically when the input matches `${...}` pattern.

- [ ] **Step 4: Pass authType from ProviderConfigTab**

In `ProviderConfigTab.tsx`, derive auth type from config (primary) with authOverview fallback. Add store access:

```typescript
const { configRaw } = useModelsStore();

// Derive auth type from config.models.providers[selected].auth (primary source)
// Fall back to authOverview.auth.type (may lag behind for newly added providers)
const configAuthType = useMemo(() => {
  if (!configRaw || !selectedProvider) return null;
  try {
    const config = JSON.parse(configRaw) as Record<string, unknown>;
    const models = config.models as Record<string, unknown> | undefined;
    const providers = models?.providers as Record<string, unknown> | undefined;
    const providerCfg = providers?.[selectedProvider] as Record<string, unknown> | undefined;
    return (providerCfg?.auth as string) ?? null;
  } catch {
    return null;
  }
}, [configRaw, selectedProvider]);
```

Pass to ConfigForm:

```tsx
<ConfigForm
  provider={selectedProvider!}
  initialConfig={selectedConfig}
  authType={configAuthType ?? selectedEntry?.auth?.type ?? null}
  onSave={updateProviderConfig}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/panels/models/config/ConfigForm.tsx \
       dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx
git commit -m "[enhanced] feat(deck): add auth type label and secret reference hint to ConfigForm"
```

---

### Task 10: Final Verification

**Files:** All modified files

- [ ] **Step 1: Full TypeScript check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 2: Verify i18n completeness**

Check that all new keys exist in both `zh.json` and `en.json`. Search for any hardcoded strings in the new/modified components:

```bash
cd dashboard && grep -rn '"[A-Z][a-z]' src/components/panels/models/catalog/ModelParamsEditor.tsx src/components/panels/models/config/BedrockDiscoveryCard.tsx || echo "No hardcoded strings found"
```

- [ ] **Step 3: Verify no HTML nesting violations**

Check that no `<Switch>` or `<button>` is nested inside another `<button>`. The ProviderOverview table uses `<Switch>` inside `<td>` (not inside a button) — this is correct.

- [ ] **Step 4: Run existing tests**

Run: `cd dashboard && pnpm test`
Expected: All existing tests pass (no regressions)

- [ ] **Step 5: Commit any fixes**

If any issues found in Steps 1-4, fix and commit:

```bash
git add -A
git commit -m "[enhanced] fix(deck): address Models Hub V2 verification findings"
```
