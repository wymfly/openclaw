# Models Hub Provider Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the Models Hub logical loop — let users add custom providers with models, verify connectivity, and see them appear in the catalog, all through existing RPC methods.

**Architecture:** Backend removes the hardcoded provider whitelist so any config-defined provider's models enter the catalog. Frontend adds an "Add Provider" dialog to the Config tab. Saving writes via `config.patch` which triggers Gateway restart → catalog cache invalidates → `models.list` returns new entries. No new RPC methods needed.

**Tech Stack:** TypeScript, Vitest, React 19, Zustand 5, shadcn/ui, next-intl

---

## File Map

### Backend (modify)

| File                                 | Action | Responsibility                                                                     |
| ------------------------------------ | ------ | ---------------------------------------------------------------------------------- |
| `src/agents/model-catalog.ts:84-130` | Modify | Remove `NON_PI_NATIVE_MODEL_PROVIDERS` gate in `readConfiguredOptInProviderModels` |
| `src/agents/model-catalog.ts:47`     | Modify | Remove or empty `NON_PI_NATIVE_MODEL_PROVIDERS` constant                           |

### Backend Test (modify)

| File                                       | Action | Responsibility                                           |
| ------------------------------------------ | ------ | -------------------------------------------------------- |
| `src/gateway/server-model-catalog.test.ts` | Modify | Add test for custom provider models appearing in catalog |

### Frontend Store (modify)

| File                             | Action | Responsibility                                                             |
| -------------------------------- | ------ | -------------------------------------------------------------------------- |
| `dashboard/src/stores/models.ts` | Modify | Add `addCustomProvider` action that writes to `config.patch` and refreshes |

### Frontend Components (create + modify)

| File                                                                  | Action | Responsibility                                                           |
| --------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------ |
| `dashboard/src/components/panels/models/config/AddProviderDialog.tsx` | Create | Dialog form for provider name + API format + base URL + API key + models |
| `dashboard/src/components/panels/models/config/ProviderSidebar.tsx`   | Modify | Add "Add Provider" button at bottom                                      |
| `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx`   | Modify | Wire dialog open/close + addCustomProvider action                        |

### i18n (modify)

| File                         | Action | Responsibility                           |
| ---------------------------- | ------ | ---------------------------------------- |
| `dashboard/src/i18n/zh.json` | Modify | Add translation keys for new UI elements |
| `dashboard/src/i18n/en.json` | Modify | Add matching English translations        |

---

## Requirement Coverage

| Requirement                                         | Task            |
| --------------------------------------------------- | --------------- |
| Config 中定义 `models[]` 的自定义 provider 进入目录 | Task 1          |
| 前端 Config tab 有「添加 Provider」入口             | Task 3          |
| 保存后 Gateway 重启 → 模型目录刷新                  | Task 2          |
| 新 provider 出现在 auth overview 和 catalog         | Task 1 + Task 2 |

---

### Task 1: Backend — Remove Provider Whitelist

**Domain:** `[backend]`
**Files:**

- Modify: `src/agents/model-catalog.ts:47,84-95`
- Modify: `src/gateway/server-model-catalog.test.ts`

The current `readConfiguredOptInProviderModels` only processes providers in the `NON_PI_NATIVE_MODEL_PROVIDERS` set (currently only `"kilocode"`). Remove this gate so ALL providers defined in `config.models.providers` with a `models[]` array get merged into the catalog. Pi SDK native providers won't duplicate because `mergeConfiguredOptInProviderModels` deduplicates by `provider::modelId`.

- [ ] **Step 1: Write failing test**

In `src/gateway/server-model-catalog.test.ts`, add a test case. Follow existing test pattern: mock `loadConfig` via `vi.mock` + set `mockConfig`, mock Pi SDK via `mockPiDiscoveryModels()`, call `loadGatewayModelCatalog()` (no params):

```typescript
it("includes custom provider models from config", async () => {
  // Pi SDK returns NO models for "my-llm" — it's purely config-defined
  mockPiDiscoveryModels([]);

  mockConfig = {
    models: {
      providers: {
        "my-llm": {
          baseUrl: "https://api.my-llm.com/v1",
          api: "openai-completions",
          models: [
            {
              id: "my-model-7b",
              name: "My Model 7B",
              reasoning: false,
              input: ["text"],
              cost: { input: 0.5, output: 1.0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 32768,
              maxTokens: 4096,
            },
          ],
        },
      },
    },
  } as unknown as OpenClawConfig;

  const catalog = await loadGatewayModelCatalog();
  const customModel = catalog.find((m) => m.provider === "my-llm" && m.id === "my-model-7b");
  expect(customModel).toBeDefined();
  expect(customModel!.name).toBe("My Model 7B");
  expect(customModel!.contextWindow).toBe(32768);
  expect(customModel!.cost?.input).toBe(0.5);
});
```

**Important:** The test file already has `installModelCatalogTestHooks()` which calls `__resetModelCatalogCacheForTest()` in `beforeEach`, so cache reset is handled automatically.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/gateway/server-model-catalog.test.ts -- -t "includes custom provider"`
Expected: FAIL — custom provider models filtered out by whitelist

- [ ] **Step 3: Implement — remove whitelist gate**

In `src/agents/model-catalog.ts`, modify `readConfiguredOptInProviderModels` to remove the `NON_PI_NATIVE_MODEL_PROVIDERS` check:

```typescript
// Line 47: Keep the constant but don't use it as a gate
// (It can still be referenced elsewhere if needed for legacy behavior)

// Lines 92-95: Remove these three lines:
//   if (!NON_PI_NATIVE_MODEL_PROVIDERS.has(provider)) {
//     continue;
//   }
```

The function should now iterate ALL entries in `config.models.providers` that have a `models[]` array, not just those in the whitelist.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/gateway/server-model-catalog.test.ts`
Expected: ALL PASS including the new test

- [ ] **Step 5: Verify deduplication — Pi SDK native providers don't duplicate**

Add a second test:

```typescript
it("does not duplicate Pi SDK native provider models from config", async () => {
  // "deepseek" is a Pi SDK native provider — Pi SDK returns its models
  mockPiDiscoveryModels([{ id: "deepseek-chat", provider: "deepseek", name: "DeepSeek Chat" }]);

  // Config ALSO defines deepseek with the same model ID — should deduplicate
  mockConfig = {
    models: {
      providers: {
        deepseek: {
          baseUrl: "https://api.deepseek.com",
          models: [
            {
              id: "deepseek-chat", // Same ID as Pi SDK catalog entry
              name: "DeepSeek Chat Override",
              reasoning: false,
              input: ["text"],
              cost: { input: 0.14, output: 0.28, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 65536,
              maxTokens: 4096,
            },
          ],
        },
      },
    },
  } as unknown as OpenClawConfig;

  const catalog = await loadGatewayModelCatalog();
  const deepseekModels = catalog.filter(
    (m) => m.provider === "deepseek" && m.id === "deepseek-chat",
  );
  // Should have exactly 1, not 2 (Pi SDK entry wins, config cost merged on top)
  expect(deepseekModels).toHaveLength(1);
});
```

Run: `pnpm test src/gateway/server-model-catalog.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/agents/model-catalog.ts src/gateway/server-model-catalog.test.ts
git commit -m "[enhanced] feat(models): allow all config-defined provider models in catalog"
```

---

### Task 2: Frontend Store — Add Custom Provider Action

**Domain:** `[frontend]`
**Files:**

- Modify: `dashboard/src/stores/models.ts`

Add an `addCustomProvider` action that:

1. Reads current config via `config.get` (fetchFallbacks reuses this)
2. Injects `models.providers.<name>` into the raw config JSON
3. Writes via `config.patch` (triggers Gateway restart)
4. Waits for Gateway reconnect
5. Refreshes models + auth overview

- [ ] **Step 1: Add the `addCustomProvider` action type**

In `dashboard/src/stores/models.ts`, add to the `ModelsState` interface:

```typescript
// Add to ModelsState interface after line 102
addCustomProvider: (params: {
  name: string;
  api: string;
  baseUrl: string;
  apiKey?: string;
  models: Array<{
    id: string;
    name: string;
    contextWindow: number;
    maxTokens: number;
    reasoning?: boolean;
    input?: string[];
  }>;
}) => Promise<boolean>;
```

- [ ] **Step 2: Implement the action**

Add the implementation in the `create` call after `fetchUsageSummary`:

```typescript
addCustomProvider: async (params) => {
  // 1. Read current config
  const configRes = await fetch("/api/models/config");
  if (!configRes.ok) return false;
  const data = await configRes.json();
  const raw: string | undefined = data?.raw;
  const hash: string | undefined = data?.hash;
  if (typeof raw !== "string") return false;

  try {
    // 2. Inject provider into config
    const config = JSON.parse(raw) as Record<string, unknown>;
    if (!config.models || typeof config.models !== "object") {
      config.models = {};
    }
    const models = config.models as Record<string, unknown>;
    if (!models.providers || typeof models.providers !== "object") {
      models.providers = {};
    }
    const providers = models.providers as Record<string, unknown>;

    // Build ModelProviderConfig-shaped entry
    const providerEntry: Record<string, unknown> = {
      baseUrl: params.baseUrl,
      api: params.api,
      models: params.models.map((m) => ({
        id: m.id,
        name: m.name,
        reasoning: m.reasoning ?? false,
        input: m.input ?? ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: m.contextWindow,
        maxTokens: m.maxTokens,
      })),
    };
    if (params.apiKey) {
      providerEntry.apiKey = params.apiKey;
    }

    providers[params.name.toLowerCase().trim()] = providerEntry;

    // 3. Write via config.patch
    const newRaw = JSON.stringify(config, null, 2);
    const patchRes = await fetch("/api/models/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: newRaw, baseHash: hash }),
    });
    if (!patchRes.ok) return false;

    // 4. Gateway restarts after config.patch — wait briefly for reconnect
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 5. Refresh all data
    await Promise.all([
      get().fetchModels(),
      get().fetchAuthOverview(),
      get().fetchProviderConfig(),
    ]);

    return true;
  } catch {
    return false;
  }
},
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/stores/models.ts
git commit -m "[enhanced] feat(models): add addCustomProvider store action"
```

---

### Task 3: Frontend — AddProviderDialog Component

**Domain:** `[frontend]`
**Skills:** `frontend-design`, `ui-ux-pro-max`
**Files:**

- Create: `dashboard/src/components/panels/models/config/AddProviderDialog.tsx`
- Modify: `dashboard/src/components/panels/models/config/ProviderSidebar.tsx`
- Modify: `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add i18n keys**

Add to both `zh.json` and `en.json` under `models.config`:

```json
// zh.json — models.config 节内追加:
"addProvider": "添加供应商",
"addProviderTitle": "添加自定义供应商",
"providerName": "供应商名称",
"providerNamePlaceholder": "如: my-llm",
"providerNameHint": "小写字母、数字和连字符",
"apiFormat": "API 格式",
"addModel": "添加模型",
"removeModel": "移除",
"modelId": "模型 ID",
"modelIdPlaceholder": "如: gpt-4o",
"modelName": "显示名称",
"modelNamePlaceholder": "如: GPT-4o",
"contextWindowLabel": "上下文窗口",
"maxTokensLabel": "最大输出",
"noModelsAdded": "请至少添加一个模型",
"providerAdding": "正在添加...",
"providerAdded": "供应商已添加，Gateway 正在重启...",
"providerAddFailed": "添加失败"
```

```json
// en.json — models.config 节内追加:
"addProvider": "Add Provider",
"addProviderTitle": "Add Custom Provider",
"providerName": "Provider Name",
"providerNamePlaceholder": "e.g. my-llm",
"providerNameHint": "Lowercase letters, numbers, and hyphens",
"apiFormat": "API Format",
"addModel": "Add Model",
"removeModel": "Remove",
"modelId": "Model ID",
"modelIdPlaceholder": "e.g. gpt-4o",
"modelName": "Display Name",
"modelNamePlaceholder": "e.g. GPT-4o",
"contextWindowLabel": "Context Window",
"maxTokensLabel": "Max Output",
"noModelsAdded": "Add at least one model",
"providerAdding": "Adding...",
"providerAdded": "Provider added, Gateway restarting...",
"providerAddFailed": "Failed to add provider"
```

- [ ] **Step 2: Create AddProviderDialog component**

Create `dashboard/src/components/panels/models/config/AddProviderDialog.tsx`:

```tsx
"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Must match MODEL_APIS in src/config/types.models.ts
const MODEL_APIS = [
  "openai-completions",
  "openai-responses",
  "openai-codex-responses",
  "anthropic-messages",
  "google-generative-ai",
  "github-copilot",
  "bedrock-converse-stream",
  "ollama",
] as const;

interface ModelEntry {
  id: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
}

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (params: {
    name: string;
    api: string;
    baseUrl: string;
    apiKey?: string;
    models: ModelEntry[];
  }) => Promise<boolean>;
}

const emptyModel = (): ModelEntry => ({
  id: "",
  name: "",
  contextWindow: 128000,
  maxTokens: 4096,
});

export function AddProviderDialog({ open, onOpenChange, onAdd }: AddProviderDialogProps) {
  const t = useTranslations("models.config");
  const tc = useTranslations("common");

  const [providerName, setProviderName] = useState("");
  const [api, setApi] = useState<string>("openai-completions");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelEntry[]>([emptyModel()]);
  const [saving, setSaving] = useState(false);

  const reset = useCallback(() => {
    setProviderName("");
    setApi("openai-completions");
    setBaseUrl("");
    setApiKey("");
    setModels([emptyModel()]);
    setSaving(false);
  }, []);

  const addModelRow = () => setModels((prev) => [...prev, emptyModel()]);
  const removeModelRow = (idx: number) => setModels((prev) => prev.filter((_, i) => i !== idx));
  const updateModel = (idx: number, field: keyof ModelEntry, value: string | number) =>
    setModels((prev) => prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));

  const canSave =
    providerName.trim().length > 0 &&
    baseUrl.trim().length > 0 &&
    models.length > 0 &&
    models.every((m) => m.id.trim().length > 0) &&
    !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const ok = await onAdd({
        name: providerName.trim(),
        api,
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim() || undefined,
        models: models.map((m) => ({
          ...m,
          id: m.id.trim(),
          name: m.name.trim() || m.id.trim(),
        })),
      });
      if (ok) {
        reset();
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("addProviderTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Provider Name */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("providerName")}</Label>
            <Input
              value={providerName}
              onChange={(e) =>
                setProviderName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              placeholder={t("providerNamePlaceholder")}
              className="font-mono text-xs"
            />
            <p className="text-[10px] text-[var(--text-secondary)]">{t("providerNameHint")}</p>
          </div>

          {/* API Format */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("apiFormat")}</Label>
            <Select value={api} onValueChange={setApi}>
              <SelectTrigger className="text-xs font-mono cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_APIS.map((a) => (
                  <SelectItem key={a} value={a} className="text-xs font-mono">
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Base URL */}
          <div className="space-y-1.5">
            <Label className="text-xs">Base URL</Label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
              className="font-mono text-xs"
            />
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <Label className="text-xs">API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="font-mono text-xs"
              autoComplete="off"
            />
          </div>

          {/* Models */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t("addModel")}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addModelRow}
                className="h-6 gap-1 text-[10px] cursor-pointer"
              >
                <Plus size={10} /> {t("addModel")}
              </Button>
            </div>

            {models.map((model, idx) => (
              <div
                key={idx}
                className="flex gap-2 items-start rounded-lg border border-[var(--border)] p-2"
              >
                <div className="flex-1 space-y-1.5">
                  <div className="flex gap-2">
                    <Input
                      value={model.id}
                      onChange={(e) => updateModel(idx, "id", e.target.value)}
                      placeholder={t("modelIdPlaceholder")}
                      className="font-mono text-xs flex-1"
                    />
                    <Input
                      value={model.name}
                      onChange={(e) => updateModel(idx, "name", e.target.value)}
                      placeholder={t("modelNamePlaceholder")}
                      className="text-xs flex-1"
                    />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-[10px] text-[var(--text-secondary)]">
                        {t("contextWindowLabel")}
                      </Label>
                      <Input
                        type="number"
                        value={model.contextWindow}
                        onChange={(e) => updateModel(idx, "contextWindow", Number(e.target.value))}
                        className="font-mono text-xs"
                      />
                    </div>
                    <div className="flex-1">
                      <Label className="text-[10px] text-[var(--text-secondary)]">
                        {t("maxTokensLabel")}
                      </Label>
                      <Input
                        type="number"
                        value={model.maxTokens}
                        onChange={(e) => updateModel(idx, "maxTokens", Number(e.target.value))}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
                {models.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeModelRow(idx)}
                    className="h-6 w-6 p-0 shrink-0 text-[var(--danger)] cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
            ))}

            {models.length === 0 && (
              <p className="text-xs text-[var(--text-secondary)] text-center py-2">
                {t("noModelsAdded")}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="cursor-pointer">
            {tc("cancel")}
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="gap-1.5 cursor-pointer"
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            {saving ? t("providerAdding") : t("addProvider")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Add "Add Provider" button to ProviderSidebar**

In `dashboard/src/components/panels/models/config/ProviderSidebar.tsx`, add a new prop and button:

```tsx
// Update interface (add onAddProvider prop):
interface ProviderSidebarProps {
  auth: AuthOverviewEntry[];
  selected: string | null;
  onSelect: (provider: string) => void;
  onAddProvider?: () => void; // NEW
}

// Add button before the closing </ScrollArea>, after the empty state div:
{
  /* Add provider button */
}
<div className="px-3 py-2 border-t border-[var(--border)]">
  <button
    type="button"
    onClick={onAddProvider}
    className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-[var(--accent)] hover:bg-[var(--accent-muted)] transition-colors cursor-pointer"
  >
    <Plus size={12} />
    {t("config.addProvider")}
  </button>
</div>;
```

Import `Plus` from `lucide-react` at the top.

- [ ] **Step 4: Wire dialog into ProviderConfigTab**

In `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx`:

```tsx
// Add imports:
import { AddProviderDialog } from "../config/AddProviderDialog";

// Add state in the component:
const [addDialogOpen, setAddDialogOpen] = useState(false);

// Get addCustomProvider from store:
const { ..., addCustomProvider } = useModelsStore();

// Add handleAddProvider callback:
const handleAddProvider = useCallback(async (params: Parameters<typeof addCustomProvider>[0]) => {
  const ok = await addCustomProvider(params);
  if (ok) {
    // After gateway restart + data refresh, select the new provider
    setSelectedProvider(params.name.toLowerCase().trim());
  }
  return ok;
}, [addCustomProvider]);

// Pass onAddProvider to ProviderSidebar:
<ProviderSidebar
  auth={authOverview}
  selected={selectedProvider}
  onSelect={setSelectedProvider}
  onAddProvider={() => setAddDialogOpen(true)}
/>

// Add dialog before the closing </div> of the component:
<AddProviderDialog
  open={addDialogOpen}
  onOpenChange={setAddDialogOpen}
  onAdd={handleAddProvider}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/panels/models/config/AddProviderDialog.tsx \
      dashboard/src/components/panels/models/config/ProviderSidebar.tsx \
      dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx \
      dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(models): add custom provider registration dialog"
```

---

### Task 4: Integration Test — Full Loop Verification

**Domain:** `[test]`
**Files:** None (browser-based verification)

Verify the complete logical loop in the running dashboard:

- [ ] **Step 1: Start Gateway + Dashboard**

Ensure both services are running:

- Gateway on port 18789
- Dashboard on port 3000

- [ ] **Step 2: Navigate to Models → Provider Config tab**

Open `http://localhost:3000`, navigate to 模型 → 提供商配置

- [ ] **Step 3: Click "Add Provider" button**

Verify:

- Button appears at bottom of ProviderSidebar
- Dialog opens with all fields
- Provider name input enforces lowercase + hyphens
- API format dropdown shows 5 options
- Model list has one empty row by default
- "Add Model" button adds rows
- "Remove" button removes rows (min 1)

- [ ] **Step 4: Fill and submit a test provider**

Fill in:

- Provider: `test-provider`
- API Format: `openai-completions`
- Base URL: `https://api.example.com/v1`
- API Key: (leave empty)
- Model 1: ID=`test-model-1`, Name=`Test Model`, Context=32768, Max Output=4096

Click Add → verify:

- Loading state shown
- Dialog closes on success
- Gateway restarts (brief disconnection)
- After reconnect, `test-provider` appears in sidebar

- [ ] **Step 5: Verify model appears in Catalog tab**

Switch to 目录 tab → verify:

- `test-provider` group appears in left pane
- `Test Model` listed with `32K` context badge
- Click model → right pane shows detail

- [ ] **Step 6: Clean up test provider**

Remove `test-provider` from config manually or via config.patch to leave system clean.

- [ ] **Step 7: Commit integration test documentation**

```bash
git add docs/superpowers/plans/2026-03-20-models-hub-provider-registration.md
git commit -m "[enhanced] docs: add models hub provider registration plan"
```

---

## File Cross Matrix

| File                                       | Task 1 | Task 2 | Task 3 | Task 4 |
| ------------------------------------------ | ------ | ------ | ------ | ------ |
| `src/agents/model-catalog.ts`              | ✏️     |        |        |        |
| `src/gateway/server-model-catalog.test.ts` | ✏️     |        |        |        |
| `dashboard/src/stores/models.ts`           |        | ✏️     |        |        |
| `dashboard/src/.../AddProviderDialog.tsx`  |        |        | ➕     |        |
| `dashboard/src/.../ProviderSidebar.tsx`    |        |        | ✏️     |        |
| `dashboard/src/.../ProviderConfigTab.tsx`  |        |        | ✏️     |        |
| `dashboard/src/i18n/zh.json`               |        |        | ✏️     |        |
| `dashboard/src/i18n/en.json`               |        |        | ✏️     |        |

无文件交叉冲突。Task 1-3 可串行执行（Task 2 依赖 Task 1 的后端改动，Task 3 依赖 Task 2 的 store action），Task 4 依赖前三个全部完成。
