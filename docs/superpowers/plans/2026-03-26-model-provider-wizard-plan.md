# Model Provider Configuration Wizard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AddProviderDialog with a multi-step wizard that auto-populates models from the 800+ catalog for known providers, while supporting fully custom and OAuth providers.

**Architecture:** New Gateway RPC `models.catalog.providers` groups catalog by provider with defaults mapping. Dashboard store adds `catalogProviders` + `fetchCatalogProviders()`. Frontend replaces AddProviderDialog with AddProviderWizard (step 1: select type → step 2A: known config / step 2B: custom config). Saves via existing `addCustomProvider`.

**Tech Stack:** TypeScript, React, shadcn/ui, next-intl, Zustand, Gateway RPC (WebSocket)

**Design Spec:** `docs/superpowers/specs/2026-03-26-model-provider-wizard-design.md`

**Skill Dependencies:**
| Domain | Skills | Loading |
|--------|--------|---------|
| `[backend]` | `superpowers:test-driven-development` | session first load |
| `[frontend]` | `superpowers:test-driven-development` | session first load |

---

## File Structure

### New Files

| File                                                                  | Responsibility                                                                     |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/agents/provider-defaults.ts`                                     | `KNOWN_PROVIDER_DEFAULTS` mapping (known provider → defaultBaseUrl, authType, api) |
| `src/gateway/server-methods/models-catalog-providers.ts`              | Gateway RPC handler for `models.catalog.providers`                                 |
| `src/gateway/server-methods/models-catalog-providers.test.ts`         | Unit tests for `models.catalog.providers` handler                                  |
| `dashboard/src/app/api/models/catalog-providers/route.ts`             | Next.js API route proxying to Gateway RPC                                          |
| `dashboard/src/components/panels/models/config/AddProviderWizard.tsx` | Wizard dialog container (step state management)                                    |
| `dashboard/src/components/panels/models/config/WizardStepSelect.tsx`  | Step 1: provider type selection (known grid + custom entry + OAuth section)        |
| `dashboard/src/components/panels/models/config/WizardStepKnown.tsx`   | Step 2A: known provider config form (auto-filled + model checkboxes)               |
| `dashboard/src/components/panels/models/config/WizardStepCustom.tsx`  | Step 2B: custom provider form (extracted from old AddProviderDialog)               |
| `dashboard/src/components/panels/models/config/ModelCheckboxList.tsx` | Reusable model checkbox list with select all/none toggle                           |

**Consolidation note:** The spec defines `KnownProviderGrid.tsx`, `CustomProviderEntry.tsx`, and `OAuthProviderSection.tsx` as separate files under `WizardStepSelect`. These are consolidated into `WizardStepSelect.tsx` since each is a simple section (search+grid, single card, short list) totaling ~200 LOC together — extracting them would create trivially small files with no reuse value. If `WizardStepSelect.tsx` exceeds ~300 LOC during implementation, extract them.

### Modified Files

| File                                                                | Change                                                                                                |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/gateway/server-methods/models.ts`                              | Add `models.catalog.providers` handler (or import from new file)                                      |
| `src/gateway/server-methods.ts`                                     | Register new handler object                                                                           |
| `src/gateway/server-methods-list.ts`                                | Add `"models.catalog.providers"` to `BASE_METHODS`                                                    |
| `src/gateway/method-scopes.ts`                                      | Add `"models.catalog.providers"` to `READ_SCOPE`                                                      |
| `dashboard/server/gateway-allowlist.ts`                             | Add `"models.catalog.providers"` to allowlist                                                         |
| `dashboard/server/__tests__/gateway-adapter.test.ts`                | Add `"models.catalog.providers"` to `deckAdditions` array                                             |
| `dashboard/src/stores/models.ts`                                    | Add `catalogProviders`, `catalogProvidersLoading`, `catalogProvidersError`, `fetchCatalogProviders()` |
| `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx` | Replace `AddProviderDialog` import with `AddProviderWizard`                                           |
| `dashboard/src/i18n/zh.json`                                        | Add wizard i18n keys under `models.wizard`                                                            |
| `dashboard/src/i18n/en.json`                                        | Add wizard i18n keys under `models.wizard`                                                            |

### Deleted Files

| File                                                                  | Reason                                           |
| --------------------------------------------------------------------- | ------------------------------------------------ |
| `dashboard/src/components/panels/models/config/AddProviderDialog.tsx` | Replaced by AddProviderWizard + WizardStepCustom |

---

## Task 1: Provider Defaults Mapping + Gateway RPC Handler

**Files:**

- Create: `src/agents/provider-defaults.ts`
- Create: `src/gateway/server-methods/models-catalog-providers.ts`
- Modify: `src/gateway/server-methods/models.ts` (import + re-export)
- Modify: `src/gateway/server-methods.ts` (register handler)
- Modify: `src/gateway/server-methods-list.ts` (add to BASE_METHODS)
- Modify: `src/gateway/method-scopes.ts` (add to READ_SCOPE)

- [ ] **Step 1: Create provider-defaults.ts**

Create `src/agents/provider-defaults.ts`:

```typescript
export interface ProviderDefaults {
  displayName: string;
  defaultBaseUrl: string;
  authType: "api-key" | "oauth" | "aws-sdk" | "token";
  api: string;
}

export const KNOWN_PROVIDER_DEFAULTS: Record<string, ProviderDefaults> = {
  anthropic: {
    displayName: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    authType: "api-key",
    api: "anthropic-messages",
  },
  openai: {
    displayName: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    authType: "api-key",
    api: "openai-responses", // Aligns with IMPLICIT_PROVIDER_API in dashboard/src/stores/models.ts:315
  },
  deepseek: {
    displayName: "DeepSeek",
    defaultBaseUrl: "https://api.deepseek.com",
    authType: "api-key",
    api: "openai-completions",
  },
  google: {
    displayName: "Google",
    defaultBaseUrl: "https://generativelanguage.googleapis.com",
    authType: "api-key",
    api: "google-generative-ai",
  },
  moonshot: {
    displayName: "Moonshot",
    defaultBaseUrl: "https://api.moonshot.cn/v1",
    authType: "api-key",
    api: "openai-completions",
  },
  mistral: {
    displayName: "Mistral",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    authType: "api-key",
    api: "openai-completions",
  },
  groq: {
    displayName: "Groq",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    authType: "api-key",
    api: "openai-completions",
  },
};
```

- [ ] **Step 2: Create models-catalog-providers handler**

Create `src/gateway/server-methods/models-catalog-providers.ts`:

```typescript
import { KNOWN_PROVIDER_DEFAULTS } from "../../agents/provider-defaults.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export interface CatalogProviderModel {
  id: string;
  name: string;
  contextWindow: number;
  reasoning: boolean;
  maxTokens: number;
}

export interface CatalogProviderEntry {
  id: string;
  displayName: string;
  modelCount: number;
  defaultBaseUrl: string;
  authType: string;
  api: string;
  models: CatalogProviderModel[];
}

export const modelsCatalogProvidersHandlers: GatewayRequestHandlers = {
  "models.catalog.providers": async ({ respond, context }) => {
    try {
      const catalog = await context.loadGatewayModelCatalog();

      // Group by provider
      const grouped = new Map<string, CatalogProviderModel[]>();
      for (const entry of catalog) {
        const provider = entry.provider;
        if (!grouped.has(provider)) {
          grouped.set(provider, []);
        }
        grouped.get(provider)!.push({
          id: entry.id,
          name: entry.name ?? entry.id,
          contextWindow: entry.contextWindow ?? 128_000,
          reasoning: entry.reasoning ?? false,
          maxTokens: entry.maxTokens ?? 4096,
        });
      }

      // Build response with defaults merging
      const providers: CatalogProviderEntry[] = [];
      for (const [id, models] of grouped) {
        const defaults = KNOWN_PROVIDER_DEFAULTS[id];
        providers.push({
          id,
          displayName: defaults?.displayName ?? id,
          modelCount: models.length,
          defaultBaseUrl: defaults?.defaultBaseUrl ?? "",
          authType: defaults?.authType ?? "api-key",
          api: defaults?.api ?? "openai-completions",
          models,
        });
      }

      // Sort: known providers first (have defaultBaseUrl), then alphabetical
      providers.sort((a, b) => {
        const aKnown = a.defaultBaseUrl ? 0 : 1;
        const bKnown = b.defaultBaseUrl ? 0 : 1;
        if (aKnown !== bKnown) return aKnown - bKnown;
        return a.displayName.localeCompare(b.displayName);
      });

      respond(true, { providers }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
```

- [ ] **Step 3: Register handler in server-methods.ts**

In `src/gateway/server-methods.ts`, add import and spread into `coreGatewayHandlers` (note: the actual export name is `coreGatewayHandlers`, NOT `gatewayRequestHandlers`):

```typescript
import { modelsCatalogProvidersHandlers } from "./server-methods/models-catalog-providers.js";

export const coreGatewayHandlers: GatewayRequestHandlers = {
  // ... existing spreads ...
  ...modelsCatalogProvidersHandlers,
};
```

- [ ] **Step 4: Add to method list and scopes**

In `src/gateway/server-methods-list.ts`, add `"models.catalog.providers"` to `BASE_METHODS` array (after `"models.configured"`).

In `src/gateway/method-scopes.ts`, add `"models.catalog.providers"` to the `READ_SCOPE` array (after `"models.configured"`).

- [ ] **Step 5: Write unit tests**

Create `src/gateway/server-methods/models-catalog-providers.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { modelsCatalogProvidersHandlers } from "./models-catalog-providers.js";

function mockRespond() {
  const calls: Array<{ ok: boolean; payload: unknown; error: unknown }> = [];
  const fn = (ok: boolean, payload: unknown, error: unknown) => {
    calls.push({ ok, payload, error });
  };
  return { fn, calls };
}

function makeCatalogEntry(provider: string, id: string, overrides?: Record<string, unknown>) {
  return {
    id,
    name: id,
    provider,
    contextWindow: 128000,
    reasoning: false,
    maxTokens: 4096,
    ...overrides,
  };
}

describe("models.catalog.providers", () => {
  const handler = modelsCatalogProvidersHandlers["models.catalog.providers"];

  it("groups catalog entries by provider", async () => {
    const { fn, calls } = mockRespond();
    await handler({
      respond: fn,
      context: {
        loadGatewayModelCatalog: async () => [
          makeCatalogEntry("deepseek", "deepseek-chat"),
          makeCatalogEntry("deepseek", "deepseek-reasoner", { reasoning: true }),
          makeCatalogEntry("openai", "gpt-5.4"),
        ],
      },
    } as any);
    expect(calls).toHaveLength(1);
    expect(calls[0].ok).toBe(true);
    const providers = (calls[0].payload as any).providers;
    expect(providers).toHaveLength(2);
    const deepseek = providers.find((p: any) => p.id === "deepseek");
    expect(deepseek.models).toHaveLength(2);
    expect(deepseek.modelCount).toBe(2);
  });

  it("merges KNOWN_PROVIDER_DEFAULTS for known providers", async () => {
    const { fn, calls } = mockRespond();
    await handler({
      respond: fn,
      context: {
        loadGatewayModelCatalog: async () => [makeCatalogEntry("deepseek", "deepseek-chat")],
      },
    } as any);
    const providers = (calls[0].payload as any).providers;
    const deepseek = providers.find((p: any) => p.id === "deepseek");
    expect(deepseek.displayName).toBe("DeepSeek");
    expect(deepseek.defaultBaseUrl).toBe("https://api.deepseek.com");
    expect(deepseek.authType).toBe("api-key");
    expect(deepseek.api).toBe("openai-completions");
  });

  it("falls back to defaults for unknown providers", async () => {
    const { fn, calls } = mockRespond();
    await handler({
      respond: fn,
      context: {
        loadGatewayModelCatalog: async () => [makeCatalogEntry("my-custom-llm", "custom-model")],
      },
    } as any);
    const providers = (calls[0].payload as any).providers;
    const custom = providers.find((p: any) => p.id === "my-custom-llm");
    expect(custom.displayName).toBe("my-custom-llm");
    expect(custom.defaultBaseUrl).toBe("");
    expect(custom.authType).toBe("api-key");
    expect(custom.api).toBe("openai-completions");
  });

  it("sorts known providers before unknown", async () => {
    const { fn, calls } = mockRespond();
    await handler({
      respond: fn,
      context: {
        loadGatewayModelCatalog: async () => [
          makeCatalogEntry("zzz-custom", "model-a"),
          makeCatalogEntry("openai", "gpt-5.4"),
          makeCatalogEntry("aaa-custom", "model-b"),
        ],
      },
    } as any);
    const ids = (calls[0].payload as any).providers.map((p: any) => p.id);
    expect(ids[0]).toBe("openai"); // known first
    expect(ids[1]).toBe("aaa-custom"); // then alphabetical
    expect(ids[2]).toBe("zzz-custom");
  });

  it("handles catalog load failure", async () => {
    const { fn, calls } = mockRespond();
    await handler({
      respond: fn,
      context: {
        loadGatewayModelCatalog: async () => {
          throw new Error("catalog unavailable");
        },
      },
    } as any);
    expect(calls[0].ok).toBe(false);
  });

  it("applies default contextWindow and maxTokens when missing", async () => {
    const { fn, calls } = mockRespond();
    await handler({
      respond: fn,
      context: {
        loadGatewayModelCatalog: async () => [
          { id: "model-x", name: "Model X", provider: "test" }, // no contextWindow or maxTokens
        ],
      },
    } as any);
    const model = (calls[0].payload as any).providers[0].models[0];
    expect(model.contextWindow).toBe(128000);
    expect(model.maxTokens).toBe(4096);
  });
});
```

- [ ] **Step 6: Run tests**

```bash
cd /Users/wangym/workspace/agents/openclaw && pnpm test -- src/gateway/server-methods/models-catalog-providers.test.ts -v
```

Expected: All tests PASS.

- [ ] **Step 7: Run build**

```bash
cd /Users/wangym/workspace/agents/openclaw && pnpm build
```

Expected: Build succeeds with no errors.

- [ ] **Step 8: Commit**

```bash
git add src/agents/provider-defaults.ts src/gateway/server-methods/models-catalog-providers.ts src/gateway/server-methods/models-catalog-providers.test.ts src/gateway/server-methods.ts src/gateway/server-methods-list.ts src/gateway/method-scopes.ts
git commit -m "[enhanced] feat(gateway): add models.catalog.providers RPC + provider defaults mapping"
```

---

## Task 2: Dashboard Allowlist + API Route + Store

**Files:**

- Modify: `dashboard/server/gateway-allowlist.ts` (add to allowlist set)
- Modify: `dashboard/server/__tests__/gateway-adapter.test.ts` (add to deckAdditions)
- Create: `dashboard/src/app/api/models/catalog-providers/route.ts`
- Modify: `dashboard/src/stores/models.ts` (add catalogProviders state + fetchCatalogProviders)

- [ ] **Step 1: Add to gateway allowlist**

In `dashboard/server/gateway-allowlist.ts`, add `"models.catalog.providers"` to the `DEFAULT_METHOD_ALLOWLIST` set (after `"models.configured"`).

- [ ] **Step 2: Update allowlist test**

In `dashboard/server/__tests__/gateway-adapter.test.ts`, add `"models.catalog.providers"` to the `deckAdditions` array (after `"skills.install"` or at end of list).

- [ ] **Step 3: Run allowlist test**

```bash
cd /Users/wangym/workspace/agents/openclaw && pnpm test -- dashboard/server/__tests__/gateway-adapter.test.ts -v
```

Expected: All tests PASS including "has exactly the expected number of methods".

- [ ] **Step 4: Create API route**

Create `dashboard/src/app/api/models/catalog-providers/route.ts`:

```typescript
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest) => {
  return gatewayRequest("models.catalog.providers", {});
});
```

Verify the pattern matches `dashboard/src/app/api/models/configured/route.ts` (should be identical structure).

- [ ] **Step 5: Add store state and fetch method**

In `dashboard/src/stores/models.ts`:

Add type after existing `BedrockDiscoveryConfig`:

```typescript
export interface CatalogProviderModel {
  id: string;
  name: string;
  contextWindow: number;
  reasoning: boolean;
  maxTokens: number;
}

export interface CatalogProvider {
  id: string;
  displayName: string;
  modelCount: number;
  defaultBaseUrl: string;
  authType: string;
  api: string;
  models: CatalogProviderModel[];
}
```

Add to `ModelsState` interface:

```typescript
// Catalog providers (for wizard, lazy loaded)
catalogProviders: CatalogProvider[];
catalogProvidersLoading: boolean;
catalogProvidersError: boolean;

fetchCatalogProviders: () => Promise<void>;
```

Add to initial state in `create<ModelsState>()`:

```typescript
catalogProviders: [],
catalogProvidersLoading: false,
catalogProvidersError: false,
```

Add implementation (after `fetchCatalog`):

```typescript
fetchCatalogProviders: async () => {
  set({ catalogProvidersLoading: true, catalogProvidersError: false });
  try {
    const res = await fetch("/api/models/catalog-providers");
    if (!res.ok) {
      set({ catalogProviders: [], catalogProvidersError: true });
      return;
    }
    const data = (await res.json()) as { providers?: unknown };
    const providers = Array.isArray(data.providers) ? (data.providers as CatalogProvider[]) : [];
    set({ catalogProviders: providers });
  } catch {
    set({ catalogProviders: [], catalogProvidersError: true });
  } finally {
    set({ catalogProvidersLoading: false });
  }
},
```

- [ ] **Step 6: Add store unit tests for fetchCatalogProviders**

In `dashboard/src/stores/__tests__/models.test.ts`, add test cases for `fetchCatalogProviders`:

```typescript
describe("fetchCatalogProviders", () => {
  it("populates catalogProviders on success", async () => {
    const mockProviders = [
      {
        id: "deepseek",
        displayName: "DeepSeek",
        modelCount: 2,
        defaultBaseUrl: "https://api.deepseek.com",
        authType: "api-key",
        api: "openai-completions",
        models: [],
      },
    ];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ providers: mockProviders }) });
    await useModelsStore.getState().fetchCatalogProviders();
    expect(useModelsStore.getState().catalogProviders).toEqual(mockProviders);
    expect(useModelsStore.getState().catalogProvidersError).toBe(false);
    expect(useModelsStore.getState().catalogProvidersLoading).toBe(false);
  });

  it("sets error flag on HTTP failure and clears stale data", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 502 });
    await useModelsStore.getState().fetchCatalogProviders();
    expect(useModelsStore.getState().catalogProviders).toEqual([]);
    expect(useModelsStore.getState().catalogProvidersError).toBe(true);
    expect(useModelsStore.getState().catalogProvidersLoading).toBe(false);
  });

  it("sets error flag on network exception", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    await useModelsStore.getState().fetchCatalogProviders();
    expect(useModelsStore.getState().catalogProviders).toEqual([]);
    expect(useModelsStore.getState().catalogProvidersError).toBe(true);
    expect(useModelsStore.getState().catalogProvidersLoading).toBe(false);
  });
});
```

Adapt the test setup to match the existing file's mock patterns (e.g., `mockFetch`, store reset in `beforeEach`).

- [ ] **Step 7: Run tests**

```bash
cd /Users/wangym/workspace/agents/openclaw && pnpm test -- dashboard/src/stores/__tests__/models.test.ts -v
```

Expected: All tests PASS.

- [ ] **Step 8: Run type check**

```bash
cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 9: Commit**

```bash
git add dashboard/server/gateway-allowlist.ts dashboard/server/__tests__/gateway-adapter.test.ts dashboard/src/app/api/models/catalog-providers/route.ts dashboard/src/stores/models.ts dashboard/src/stores/__tests__/models.test.ts
git commit -m "[enhanced] feat(deck): add models.catalog.providers allowlist, API route, and store"
```

---

## Task 3: i18n Keys

**Files:**

- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add zh.json wizard keys**

Add under the `"models"` namespace, after the `"config"` section (before closing `}` of models), a new `"wizard"` section:

```json
"wizard": {
  "title": "添加供应商",
  "stepSelect": "选择供应商",
  "stepConfigure": "配置供应商",
  "configureProvider": "配置 {provider}",
  "knownProviders": "已知供应商",
  "knownProvidersHint": "从目录选择，自动填充模型列表",
  "customProvider": "自定义供应商",
  "customProviderHint": "手动配置 API 兼容的供应商（Ollama / vLLM / LiteLLM 等）",
  "oauthProviders": "OAuth / 插件",
  "authorized": "已授权",
  "connectable": "可接入",
  "oauthCliHint": "请通过 CLI 运行 openclaw login --provider {provider} 完成授权",
  "selectAll": "全选",
  "deselectAll": "全不选",
  "noModelsInCatalog": "暂无预设模型，请手动添加",
  "addModelManually": "手动添加模型",
  "configured": "已配置",
  "catalogLoadError": "无法加载供应商目录",
  "retry": "重试",
  "addProvider": "添加供应商",
  "contextWindow": "上下文窗口",
  "reasoning": "推理",
  "maxOutput": "最大输出",
  "saving": "保存中...",
  "loadingProviders": "加载供应商列表...",
  "searchProviders": "搜索供应商...",
  "models": "{count} 个模型",
  "back": "返回",
  "baseUrl": "Base URL",
  "apiFormat": "API 格式",
  "apiKey": "API Key",
  "apiKeyPlaceholder": "sk-... 或 $ENV_VAR_NAME",
  "envVarHint": "以 $ 开头将作为环境变量引用"
}
```

- [ ] **Step 2: Add en.json wizard keys**

Add matching keys under `"models"` → `"wizard"`:

```json
"wizard": {
  "title": "Add Provider",
  "stepSelect": "Select Provider",
  "stepConfigure": "Configure Provider",
  "configureProvider": "Configure {provider}",
  "knownProviders": "Known Providers",
  "knownProvidersHint": "Select from catalog, auto-populate models",
  "customProvider": "Custom Provider",
  "customProviderHint": "Manually configure API-compatible providers (Ollama / vLLM / LiteLLM etc.)",
  "oauthProviders": "OAuth / Plugins",
  "authorized": "Authorized",
  "connectable": "Available",
  "oauthCliHint": "Run openclaw login --provider {provider} via CLI to authorize",
  "selectAll": "Select All",
  "deselectAll": "Deselect All",
  "noModelsInCatalog": "No preset models available, add manually",
  "addModelManually": "Add Model Manually",
  "configured": "Configured",
  "catalogLoadError": "Failed to load provider catalog",
  "retry": "Retry",
  "addProvider": "Add Provider",
  "contextWindow": "Context Window",
  "reasoning": "Reasoning",
  "maxOutput": "Max Output",
  "saving": "Saving...",
  "loadingProviders": "Loading providers...",
  "searchProviders": "Search providers...",
  "models": "{count} models",
  "back": "Back",
  "baseUrl": "Base URL",
  "apiFormat": "API Format",
  "apiKey": "API Key",
  "apiKeyPlaceholder": "sk-... or $ENV_VAR_NAME",
  "envVarHint": "Prefix with $ to reference an environment variable"
}
```

- [ ] **Step 3: Run type check**

```bash
cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): add i18n keys for provider wizard"
```

---

## Task 4: ModelCheckboxList Component

**Files:**

- Create: `dashboard/src/components/panels/models/config/ModelCheckboxList.tsx`

- [ ] **Step 1: Create ModelCheckboxList**

Create `dashboard/src/components/panels/models/config/ModelCheckboxList.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Brain } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { CatalogProviderModel } from "@/stores/models";

interface ModelCheckboxListProps {
  models: CatalogProviderModel[];
  selected: Set<string>;
  onToggle: (modelId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function ModelCheckboxList({
  models,
  selected,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: ModelCheckboxListProps) {
  const t = useTranslations("models.wizard");

  const allSelected = models.length > 0 && selected.size === models.length;

  return (
    <div className="space-y-2">
      {/* Select all / deselect all toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {selected.size} / {models.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="h-6 text-[10px] cursor-pointer"
        >
          {allSelected ? t("deselectAll") : t("selectAll")}
        </Button>
      </div>

      {/* Scrollable model list */}
      <div className="max-h-[280px] overflow-y-auto space-y-1 rounded-lg border border-[var(--border)] p-2">
        {models.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">{t("noModelsInCatalog")}</p>
        ) : (
          models.map((model) => (
            <label
              key={model.id}
              className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-pointer"
            >
              <Checkbox
                checked={selected.has(model.id)}
                onCheckedChange={() => onToggle(model.id)}
                className="cursor-pointer"
              />
              <span className="flex-1 text-xs font-mono truncate">{model.name}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                {(model.contextWindow / 1000).toFixed(0)}K
              </span>
              {model.reasoning && <Brain size={12} className="text-[var(--purple)] shrink-0" />}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/panels/models/config/ModelCheckboxList.tsx
git commit -m "[enhanced] feat(deck): add ModelCheckboxList component for wizard"
```

---

## Task 5: WizardStepCustom (extract from AddProviderDialog)

**Files:**

- Create: `dashboard/src/components/panels/models/config/WizardStepCustom.tsx`

This component extracts the form logic from `AddProviderDialog.tsx` into a step that fits inside the wizard container (no Dialog wrapper).

- [ ] **Step 1: Create WizardStepCustom**

Create `dashboard/src/components/panels/models/config/WizardStepCustom.tsx`.

Extract the form body from `AddProviderDialog.tsx` (lines 139–331: provider name, API format, auth type, base URL, API key, model list). The component receives:

```tsx
interface WizardStepCustomProps {
  onAdd: (params: {
    name: string;
    api: string;
    auth: string;
    baseUrl: string;
    apiKey?: string;
    models: Array<{ id: string; name: string; contextWindow: number; maxTokens: number }>;
  }) => Promise<boolean>;
  onBack: () => void;
  onComplete: () => void;
}
```

Copy the internal state and handlers from `AddProviderDialog` (providerName, api, authType, baseUrl, apiKey, models, saving, reset, addModelRow, removeModelRow, updateModel, canSave, handleSave). Replace Dialog/DialogContent/DialogHeader/DialogFooter with plain `<div>` layout. Footer has a "Back" button (`onBack()`) on the left side only — there is no separate Cancel button because the Dialog's close button (X) in the container handles cancel. On successful save, call `onComplete()`.

Keep the same `MODEL_APIS` const, `ModelEntry` interface, and `emptyModel()` helper — move them here since `AddProviderDialog.tsx` will be deleted.

Use `useTranslations("models.config")` for existing keys (providerName, apiFormat, authType, etc.) and `useTranslations("models.wizard")` for new keys (back button).

- [ ] **Step 2: Run type check**

```bash
cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/panels/models/config/WizardStepCustom.tsx
git commit -m "[enhanced] feat(deck): add WizardStepCustom extracted from AddProviderDialog"
```

---

## Task 6: WizardStepKnown (known provider configuration form)

**Files:**

- Create: `dashboard/src/components/panels/models/config/WizardStepKnown.tsx`

- [ ] **Step 1: Create WizardStepKnown**

Create `dashboard/src/components/panels/models/config/WizardStepKnown.tsx`:

```tsx
interface WizardStepKnownProps {
  provider: CatalogProvider; // Selected provider from step 1
  configuredProviders: Set<string>; // Already configured (for dupe check)
  onAdd: (params: {
    name: string;
    api: string;
    auth: string;
    baseUrl: string;
    apiKey?: string;
    models: Array<{ id: string; name: string; contextWindow: number; maxTokens: number }>;
  }) => Promise<boolean>;
  onBack: () => void;
  onComplete: () => void;
}
```

Form fields (all pre-filled from `provider` prop, editable):

- **Base URL**: `useState(provider.defaultBaseUrl)` — Input, font-mono
- **API Format**: `useState(provider.api)` — Select with `MODEL_APIS` options (import from WizardStepCustom or define shared const)
- **API Key**: `useState("")` — password Input, with env var hint. **Format**: follow existing convention from `AddProviderDialog` — `${VAR_NAME}` syntax (e.g. `${DEEPSEEK_API_KEY}`). Detect with `apiKey.startsWith("${") && apiKey.endsWith("}")`. Show link icon when detected.
- **Model Checkbox List**: `ModelCheckboxList` component. Initialize `selectedModels` as `new Set(provider.models.map(m => m.id))` (default all selected).

On "Add Provider":

1. Collect selected models from `provider.models` filtered by `selectedModels` set
2. Map each to `{ id, name, contextWindow, maxTokens }` (use model defaults from catalog)
3. Call `onAdd({ name: provider.id, api, auth: provider.authType, baseUrl, apiKey, models })`
4. If successful, call `onComplete()`

The `canSave` check: `baseUrl.trim().length > 0 && selectedModels.size > 0 && !saving`.

Edge case: if `provider.models.length === 0`, show "no preset models" message + a manual model entry row (same as WizardStepCustom's model list). Use the `noModelsInCatalog` i18n key.

- [ ] **Step 2: Run type check**

```bash
cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/panels/models/config/WizardStepKnown.tsx
git commit -m "[enhanced] feat(deck): add WizardStepKnown for known provider configuration"
```

---

## Task 7: WizardStepSelect (provider type selection)

**Files:**

- Create: `dashboard/src/components/panels/models/config/WizardStepSelect.tsx`

- [ ] **Step 1: Create WizardStepSelect**

Create `dashboard/src/components/panels/models/config/WizardStepSelect.tsx`:

```tsx
interface WizardStepSelectProps {
  catalogProviders: CatalogProvider[];
  catalogLoading: boolean;
  catalogError: boolean; // First-class error state from store
  configuredProviders: Set<string>; // Provider IDs already in config.models.providers
  authOverview: AuthOverviewEntry[]; // For OAuth section
  onSelectKnown: (provider: CatalogProvider) => void;
  onSelectCustom: () => void;
  onRetryLoad: () => void;
}
```

Layout (top to bottom):

**1. Known Providers section:**

- Section header: `t("knownProviders")` + description `t("knownProvidersHint")`
- Search input: `useState("")`, filters providers by displayName or id containing search string (case-insensitive)
- Loading state: `catalogLoading` → show spinner + `t("loadingProviders")`
- Error state: `catalogError` → show `t("catalogLoadError")` + retry button
- Provider grid: 2-column grid of provider cards
  - Each card: `displayName`, model count badge (`t("models", { count })`), auth type badge
  - Already configured providers: `bg-muted opacity-60` + `t("configured")` badge, `pointer-events-none`
  - Unconfigured: clickable → `onSelectKnown(provider)`

**2. Custom Provider section:**

- Divider
- Single card: `t("customProvider")` title + `t("customProviderHint")` description
- Click → `onSelectCustom()`

**3. OAuth / Plugin section (conditional):**

- Only render if `authOverview.some(a => a.auth?.type === "oauth" || a.auth?.type === "token")`
- Divider + section header: `t("oauthProviders")`
- For each OAuth entry in authOverview:
  - `status === "ready"`: green check + name + `t("authorized")`
  - `status === "missing" && auth.type === "oauth"`: name + `t("connectable")`, click shows CLI hint `t("oauthCliHint", { provider: entry.provider })`

- [ ] **Step 2: Run type check**

```bash
cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/panels/models/config/WizardStepSelect.tsx
git commit -m "[enhanced] feat(deck): add WizardStepSelect for provider type selection"
```

---

## Task 8: AddProviderWizard Container + Integration

**Files:**

- Create: `dashboard/src/components/panels/models/config/AddProviderWizard.tsx`
- Modify: `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx`
- Delete: `dashboard/src/components/panels/models/config/AddProviderDialog.tsx`

- [ ] **Step 1: Create AddProviderWizard**

Create `dashboard/src/components/panels/models/config/AddProviderWizard.tsx`:

```tsx
interface AddProviderWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (params: {
    name: string;
    api: string;
    auth: string;
    baseUrl: string;
    apiKey?: string;
    models: Array<{ id: string; name: string; contextWindow: number; maxTokens: number }>;
  }) => Promise<boolean>;
}
```

Wizard state machine:

```typescript
type WizardStep =
  | { type: "select" }
  | { type: "known"; provider: CatalogProvider }
  | { type: "custom" };

const [step, setStep] = useState<WizardStep>({ type: "select" });
```

On dialog open:

- Reset step to `{ type: "select" }`
- Call `fetchCatalogProviders()` (lazy load)

Derive `configuredProviders` from `useModelsStore().providers` → `new Set(providers.map(p => p.provider))`. Note: `providers` is `ProviderConfig[]` where each entry has a `provider: string` field (the provider key from `config.models.providers`). See `dashboard/src/stores/models.ts:104`.

Read `authOverview` from `useModelsStore()` for OAuth section.

Read `catalogProvidersError` directly from `useModelsStore()` (added in Task 2, first-class error state — no heuristic needed).

Dialog structure:

```tsx
<Dialog open={open} onOpenChange={handleClose}>
  <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>
        {step.type === "select"
          ? t("title")
          : step.type === "known"
            ? t("configureProvider", { provider: step.provider.displayName })
            : t("title")}
      </DialogTitle>
    </DialogHeader>

    {step.type === "select" && (
      <WizardStepSelect
        catalogProviders={catalogProviders}
        catalogLoading={catalogProvidersLoading}
        catalogError={catalogProvidersError}
        configuredProviders={configuredProviders}
        authOverview={authOverview}
        onSelectKnown={(p) => setStep({ type: "known", provider: p })}
        onSelectCustom={() => setStep({ type: "custom" })}
        onRetryLoad={() => fetchCatalogProviders()}
      />
    )}

    {step.type === "known" && (
      <WizardStepKnown
        provider={step.provider}
        configuredProviders={configuredProviders}
        onAdd={onAdd}
        onBack={() => setStep({ type: "select" })}
        onComplete={handleComplete}
      />
    )}

    {step.type === "custom" && (
      <WizardStepCustom
        onAdd={onAdd}
        onBack={() => setStep({ type: "select" })}
        onComplete={handleComplete}
      />
    )}
  </DialogContent>
</Dialog>
```

`handleComplete`: reset step + close dialog. `handleClose`: reset step + `onOpenChange(false)`.

- [ ] **Step 2: Update ProviderConfigTab to use wizard**

In `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx`:

Replace import:

```typescript
// OLD: import { AddProviderDialog } from "../config/AddProviderDialog";
import { AddProviderWizard } from "../config/AddProviderWizard";
```

Replace JSX (line 149–153):

```tsx
// OLD: <AddProviderDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} onAdd={handleAddProvider} />
<AddProviderWizard open={addDialogOpen} onOpenChange={setAddDialogOpen} onAdd={handleAddProvider} />
```

- [ ] **Step 3: Delete old AddProviderDialog**

Delete `dashboard/src/components/panels/models/config/AddProviderDialog.tsx`.

Verify no other files import it:

```bash
grep -r "AddProviderDialog" dashboard/src/ --include="*.ts" --include="*.tsx"
```

Expected: No matches (only the wizard import).

- [ ] **Step 4: Run type check**

```bash
cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/wangym/workspace/agents/openclaw && pnpm test -- dashboard/ -v
```

Expected: All dashboard tests pass.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/panels/models/config/AddProviderWizard.tsx dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx
git rm dashboard/src/components/panels/models/config/AddProviderDialog.tsx
git commit -m "[enhanced] feat(deck): add AddProviderWizard, replace AddProviderDialog in ProviderConfigTab"
```

---

## Task 9: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Build Gateway**

```bash
cd /Users/wangym/workspace/agents/openclaw && pnpm build
```

Expected: Build succeeds.

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/wangym/workspace/agents/openclaw && pnpm test -v
```

Expected: All tests pass (including gateway-adapter allowlist test with new `models.catalog.providers`).

- [ ] **Step 3: Type check dashboard**

```bash
cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Verify lint/format**

```bash
cd /Users/wangym/workspace/agents/openclaw && pnpm check
```

Expected: No lint or format errors. If format errors, fix with `pnpm format:fix` and commit.

- [ ] **Step 5: Commit any format fixes**

If Step 4 found format issues:

```bash
pnpm format:fix
git add -A
git commit -m "[enhanced] style: auto-format provider wizard files"
```
