# Models Usability Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the models module so that CatalogTab and Agent ModelCombobox only display actually usable models (configured provider + valid auth), while the full 800+ model catalog is reserved as reference data for "Add Provider" dialog.

**Architecture:** Introduce a new Gateway RPC `models.configured` that returns only models from `config.models.providers`, enriched with cost data from the full Pi SDK catalog and annotated with per-provider auth status. Dashboard store splits into two lists: `catalogModels` (lazy-loaded full catalog for AddProviderDialog) and `usableModels` (configured+auth-ready, used by CatalogTab and Agent ModelCombobox). The existing `models.list` RPC is preserved for backward compatibility.

**Tech Stack:** TypeScript, Zustand, Next.js App Router, Gateway RPC (Ajv validation), next-intl i18n

**Skill 依赖：**

| 域           | Skills                                                   | 加载方式         |
| ------------ | -------------------------------------------------------- | ---------------- |
| `[backend]`  | `superpowers:test-driven-development`                    | session 首次加载 |
| `[frontend]` | `frontend-design`, `superpowers:test-driven-development` | session 首次加载 |

---

## File Structure

| File                                                              | Responsibility                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/gateway/server-methods/models.ts`                            | Add `models.configured` RPC handler                                             |
| `src/gateway/protocol/schema/agents-models-skills.ts`             | Add `ModelsConfiguredParamsSchema` / `ModelsConfiguredResultSchema`             |
| `src/gateway/protocol/index.ts`                                   | Export new validators                                                           |
| `src/gateway/server-methods-list.ts`                              | Register `models.configured`                                                    |
| `src/gateway/method-scopes.ts`                                    | Add to `READ_SCOPE`                                                             |
| `dashboard/server/gateway-allowlist.ts`                           | Add `models.configured`                                                         |
| `dashboard/src/app/api/models/configured/route.ts`                | New API route proxying to `models.configured`                                   |
| `dashboard/src/stores/models.ts`                                  | Split `models` into `catalogModels` + `usableModels`; add `fetchUsableModels()` |
| `dashboard/src/components/panels/models/tabs/CatalogTab.tsx`      | Use `usableModels` + empty state with "go configure" CTA                        |
| `dashboard/src/components/panels/models/catalog/ProviderList.tsx` | Filter to auth-ready providers; add "no configured providers" empty state       |
| `dashboard/src/components/panels/agents/tabs/AgentConfigTab.tsx`  | `ModelCombobox` uses `usableModels` instead of `models`                         |
| `dashboard/src/i18n/zh.json`                                      | New i18n keys for empty states                                                  |
| `dashboard/src/i18n/en.json`                                      | Same keys in English                                                            |
| `dashboard/src/stores/__tests__/models.test.ts`                   | Update existing tests for renamed fields                                        |
| `src/gateway/server-methods/models.test.ts`                       | New test file for `models.configured`                                           |

---

### Task 1: Gateway RPC — `models.configured`

**Files:**

- Modify: `src/gateway/protocol/schema/agents-models-skills.ts:167-172`
- Modify: `src/gateway/protocol/index.ts` (export new validators)
- Modify: `src/gateway/server-methods/models.ts:1-39`
- Modify: `src/gateway/server-methods-list.ts:39` (add after `models.list`)
- Modify: `src/gateway/method-scopes.ts:62` (add to READ_SCOPE)
- Test: `src/gateway/server-methods/models.test.ts` (new file)

This RPC returns models from `config.models.providers` enriched with cost/maxTokens from the full Pi SDK catalog, then annotated with auth status from `buildAuthOverview`. It reuses the existing `buildConfiguredModelCatalog()` from `src/agents/model-selection.ts` and `buildAuthOverview()` from `src/agents/auth-diagnostics.ts`.

**Note:** `buildConfiguredModelCatalog()` only returns `{id, name, provider, contextWindow, reasoning, input}` — it does NOT include `cost` or `maxTokens`. The handler must cross-reference with the full catalog (`context.loadGatewayModelCatalog()`) to merge cost data.

- [ ] **Step 1: Write the failing test**

Create `src/gateway/server-methods/models.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the dependencies
vi.mock("../../config/config.js", () => ({
  loadConfig: vi.fn(),
}));
vi.mock("../../agents/model-selection.js", () => ({
  buildAllowedModelSet: vi.fn(),
  buildConfiguredModelCatalog: vi.fn(),
}));
vi.mock("../../agents/auth-diagnostics.js", () => ({
  buildAuthOverview: vi.fn(),
}));
vi.mock("../../agents/agent-paths.js", () => ({
  resolveOpenClawAgentDir: vi.fn(() => "/tmp/test-agent"),
}));
vi.mock("../../agents/defaults.js", () => ({
  DEFAULT_PROVIDER: "anthropic",
}));

describe("models.configured", () => {
  let modelsHandlers: Record<string, Function>;
  let loadConfig: ReturnType<typeof vi.fn>;
  let buildConfiguredModelCatalog: ReturnType<typeof vi.fn>;
  let buildAuthOverview: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    const configMod = await import("../../config/config.js");
    loadConfig = configMod.loadConfig as unknown as ReturnType<typeof vi.fn>;

    const selectionMod = await import("../../agents/model-selection.js");
    buildConfiguredModelCatalog = selectionMod.buildConfiguredModelCatalog as unknown as ReturnType<
      typeof vi.fn
    >;

    const authMod = await import("../../agents/auth-diagnostics.js");
    buildAuthOverview = authMod.buildAuthOverview as unknown as ReturnType<typeof vi.fn>;

    // Re-import handlers after mocks are set up
    const mod = await import("./models.js");
    modelsHandlers = mod.modelsHandlers;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns configured models with auth status", async () => {
    const cfg = {
      models: {
        providers: {
          deepseek: {
            apiKey: "sk-xxx",
            models: [{ id: "deepseek-chat", name: "DeepSeek Chat" }],
          },
        },
      },
    };
    loadConfig.mockReturnValue(cfg);
    buildConfiguredModelCatalog.mockReturnValue([
      { id: "deepseek-chat", name: "DeepSeek Chat", provider: "deepseek" },
    ]);
    buildAuthOverview.mockResolvedValue({
      providers: [
        { provider: "deepseek", status: "ready", auth: { type: "api_key", source: "config" } },
      ],
    });

    const mockContext = {
      loadGatewayModelCatalog: vi.fn().mockResolvedValue([
        {
          id: "deepseek-chat",
          name: "DeepSeek Chat",
          provider: "deepseek",
          cost: { input: 0.14, output: 0.28, cacheRead: 0, cacheWrite: 0 },
          maxTokens: 8192,
        },
      ]),
    };
    const respond = vi.fn();
    await modelsHandlers["models.configured"]({
      params: {},
      respond,
      context: mockContext,
    });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        models: [
          expect.objectContaining({
            id: "deepseek-chat",
            provider: "deepseek",
            authStatus: "ready",
            cost: expect.objectContaining({ input: 0.14 }),
          }),
        ],
      }),
      undefined,
    );
  });

  it("returns empty array when no providers configured", async () => {
    loadConfig.mockReturnValue({});
    buildConfiguredModelCatalog.mockReturnValue([]);
    buildAuthOverview.mockResolvedValue({ providers: [] });

    const mockContext = { loadGatewayModelCatalog: vi.fn().mockResolvedValue([]) };
    const respond = vi.fn();
    await modelsHandlers["models.configured"]({
      params: {},
      respond,
      context: mockContext,
    });

    expect(respond).toHaveBeenCalledWith(true, { models: [] }, undefined);
  });

  it("marks models with missing auth as 'missing'", async () => {
    const cfg = {
      models: {
        providers: {
          openai: { models: [{ id: "gpt-5.4", name: "GPT 5.4" }] },
        },
      },
    };
    loadConfig.mockReturnValue(cfg);
    buildConfiguredModelCatalog.mockReturnValue([
      { id: "gpt-5.4", name: "GPT 5.4", provider: "openai" },
    ]);
    buildAuthOverview.mockResolvedValue({
      providers: [{ provider: "openai", status: "missing", auth: null }],
    });

    const mockContext = {
      loadGatewayModelCatalog: vi
        .fn()
        .mockResolvedValue([{ id: "gpt-5.4", name: "GPT 5.4", provider: "openai" }]),
    };
    const respond = vi.fn();
    await modelsHandlers["models.configured"]({
      params: {},
      respond,
      context: mockContext,
    });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        models: [
          expect.objectContaining({
            id: "gpt-5.4",
            authStatus: "missing",
          }),
        ],
      }),
      undefined,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/gateway/server-methods/models.test.ts -v`
Expected: FAIL — `models.configured` handler not found

- [ ] **Step 3: Add protocol schema**

In `src/gateway/protocol/schema/agents-models-skills.ts`, after `ModelsListResultSchema`:

```typescript
export const ModelsConfiguredParamsSchema = Type.Object({}, { additionalProperties: false });

export const ModelsConfiguredResultSchema = Type.Object(
  {
    models: Type.Array(
      Type.Object({
        id: Type.String(),
        name: Type.String(),
        provider: Type.String(),
        contextWindow: Type.Optional(Type.Number()),
        reasoning: Type.Optional(Type.Boolean()),
        input: Type.Optional(Type.Array(Type.String())),
        cost: Type.Optional(
          Type.Object({
            input: Type.Number(),
            output: Type.Number(),
            cacheRead: Type.Number(),
            cacheWrite: Type.Number(),
          }),
        ),
        maxTokens: Type.Optional(Type.Number()),
        authStatus: Type.String(), // "ready" | "warning" | "missing" | "unknown"
      }),
    ),
  },
  { additionalProperties: false },
);
```

In `src/gateway/protocol/index.ts`, add to the exports:

```typescript
export const validateModelsConfiguredParams = ajv.compile(ModelsConfiguredParamsSchema);
```

- [ ] **Step 4: Implement `models.configured` handler**

In `src/gateway/server-methods/models.ts`:

```typescript
import { resolveOpenClawAgentDir } from "../../agents/agent-paths.js";
import { buildAuthOverview } from "../../agents/auth-diagnostics.js";
import { DEFAULT_PROVIDER } from "../../agents/defaults.js";
import { buildAllowedModelSet, buildConfiguredModelCatalog } from "../../agents/model-selection.js";
import { loadConfig } from "../../config/config.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateModelsConfiguredParams,
  validateModelsListParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export const modelsHandlers: GatewayRequestHandlers = {
  // ... existing models.list handler unchanged ...

  "models.configured": async ({ params, respond, context }) => {
    if (!validateModelsConfiguredParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid models.configured params: ${formatValidationErrors(validateModelsConfiguredParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const cfg = loadConfig();
      const agentDir = resolveOpenClawAgentDir();
      const providers = Object.keys(cfg.models?.providers ?? {}).filter(Boolean);

      // Build catalog from config only (not Pi SDK full catalog)
      const configuredModels = buildConfiguredModelCatalog({ cfg });

      // Load full catalog to merge cost/maxTokens data
      const fullCatalog = await context.loadGatewayModelCatalog();
      const catalogMap = new Map(fullCatalog.map((c) => [`${c.provider}/${c.id}`, c]));

      // Get auth status per provider
      const authResult = await buildAuthOverview({ providers, cfg, agentDir });
      const authProviders = Array.isArray(authResult)
        ? authResult
        : Array.isArray(authResult?.providers)
          ? authResult.providers
          : [];
      const authMap = new Map<string, string>();
      for (const entry of authProviders) {
        if (entry.provider && entry.status) {
          authMap.set(entry.provider, entry.status);
        }
      }

      // Merge cost data from full catalog + auth status into each model
      const models = configuredModels.map((m) => {
        const catalogEntry = catalogMap.get(`${m.provider}/${m.id}`);
        return {
          ...m,
          cost: catalogEntry?.cost ?? m.cost,
          maxTokens: catalogEntry?.maxTokens ?? m.maxTokens,
          authStatus: authMap.get(m.provider) ?? "unknown",
        };
      });

      respond(true, { models }, undefined);
    } catch (err) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, String(err)));
    }
  },
};
```

- [ ] **Step 5: Register `models.configured` in method list and scopes**

In `src/gateway/server-methods-list.ts`, add after `"models.list"` (line 39):

```typescript
  "models.configured",
```

In `src/gateway/method-scopes.ts`, add to `READ_SCOPE` array (after `"models.list"` at line 62):

```typescript
    "models.configured",
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test -- src/gateway/server-methods/models.test.ts -v`
Expected: 3 tests PASS

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] feat(gateway): add models.configured RPC returning only configured models with auth status" \
  src/gateway/server-methods/models.ts \
  src/gateway/server-methods/models.test.ts \
  src/gateway/protocol/schema/agents-models-skills.ts \
  src/gateway/protocol/index.ts \
  src/gateway/server-methods-list.ts \
  src/gateway/method-scopes.ts
```

---

### Task 2: Dashboard API route + Gateway allowlist

**Files:**

- Create: `dashboard/src/app/api/models/configured/route.ts`
- Modify: `dashboard/server/gateway-allowlist.ts:35`

- [ ] **Step 1: Add `models.configured` to gateway allowlist**

In `dashboard/server/gateway-allowlist.ts`, add after `"models.list"` (line 35):

```typescript
  "models.configured",
```

- [ ] **Step 2: Create Dashboard API route**

Create `dashboard/src/app/api/models/configured/route.ts`:

```typescript
/**
 * GET /api/models/configured — Configured models with auth status.
 *
 * Calls `models.configured` RPC to retrieve only models from
 * config.models.providers, each annotated with provider auth status.
 *
 * Gateway contract: {} (no params)
 */
import { type NextRequest } from "next/server";
import { gatewayRequest } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth(async (_request: NextRequest) => {
  return gatewayRequest("models.configured", {});
});
```

- [ ] **Step 3: Verify route compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to the new route

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add /api/models/configured route and gateway allowlist entry" \
  dashboard/src/app/api/models/configured/route.ts \
  dashboard/server/gateway-allowlist.ts
```

---

### Task 3: Store refactor — split `models` into `catalogModels` + `usableModels`

**Files:**

- Modify: `dashboard/src/stores/models.ts:102-159` (state interface), `374-428` (fetchModels → rename + add fetchUsableModels)

The core change: rename `models` → `catalogModels` (lazy-loaded for AddProviderDialog), add `usableModels` (default data source for all UI). `fetchModels` becomes `fetchCatalog` (lazy). New `fetchUsableModels` calls `/api/models/configured`.

- [ ] **Step 1: Update state interface**

In `dashboard/src/stores/models.ts`, update `ModelsState` interface:

```typescript
interface ModelsState {
  // L1: Full catalog (800+) — lazy loaded for AddProviderDialog only
  catalogModels: Model[];
  catalogLoading: boolean;

  // L3: Configured + auth-ready models — primary data source
  usableModels: Model[];
  usableLoading: boolean;

  providers: ProviderConfig[];
  selectedProvider: string | null;

  // ... rest of state unchanged ...

  // Renamed: fetchModels → fetchCatalog (lazy)
  fetchCatalog: () => Promise<void>;
  // New: primary fetch for configured models
  fetchUsableModels: () => Promise<void>;

  // ... rest of methods unchanged ...
}
```

- [ ] **Step 2: Update store initial state and fetchCatalog**

Rename existing `models` → `catalogModels`, `loading` → `catalogLoading`, `fetchModels` → `fetchCatalog`:

```typescript
export const useModelsStore = create<ModelsState>((set, get) => ({
  catalogModels: [],
  catalogLoading: false,
  usableModels: [],
  usableLoading: false,
  providers: [],
  selectedProvider: null,
  // ... rest unchanged ...

  fetchCatalog: async () => {
    set({ catalogLoading: true });
    try {
      const res = await fetch("/api/models");
      if (!res.ok) return;
      const data = await res.json();
      const raw = Array.isArray(data) ? data : Array.isArray(data?.models) ? data.models : [];
      const list: Model[] = raw.map((m: Record<string, unknown>) => {
        const cost = m.cost as Record<string, number> | undefined;
        return {
          id: m.id as string,
          name: (m.name as string) || (m.id as string),
          provider: m.provider as string,
          contextWindow: (m.contextWindow as number) ?? 0,
          inputPrice: cost?.input ?? (m.inputPrice as number) ?? 0,
          outputPrice: cost?.output ?? (m.outputPrice as number) ?? 0,
          cacheReadPrice: cost?.cacheRead ?? (m.cacheReadPrice as number),
          cacheWritePrice: cost?.cacheWrite ?? (m.cacheWritePrice as number),
          isDefault: m.isDefault as boolean | undefined,
          reasoning: m.reasoning as boolean | undefined,
          input: m.input as string[] | undefined,
          maxTokens: m.maxTokens as number | undefined,
        };
      });
      set({ catalogModels: list });
    } finally {
      set({ catalogLoading: false });
    }
  },
```

- [ ] **Step 3: Add `fetchUsableModels`**

```typescript
  fetchUsableModels: async () => {
    set({ usableLoading: true });
    try {
      const res = await fetch("/api/models/configured");
      if (!res.ok) {
        // Fallback: if new endpoint not available, use full catalog
        await get().fetchCatalog();
        set({ usableModels: get().catalogModels });
        return;
      }
      const data = await res.json();
      const raw = Array.isArray(data) ? data : Array.isArray(data?.models) ? data.models : [];
      const list: Model[] = raw
        .filter((m: Record<string, unknown>) => {
          // Only include models whose provider auth is ready or warning (usable)
          const status = m.authStatus as string;
          return status === "ready" || status === "warning";
        })
        .map((m: Record<string, unknown>) => {
          const cost = m.cost as Record<string, number> | undefined;
          return {
            id: m.id as string,
            name: (m.name as string) || (m.id as string),
            provider: m.provider as string,
            contextWindow: (m.contextWindow as number) ?? 0,
            inputPrice: cost?.input ?? (m.inputPrice as number) ?? 0,
            outputPrice: cost?.output ?? (m.outputPrice as number) ?? 0,
            cacheReadPrice: cost?.cacheRead ?? (m.cacheReadPrice as number),
            cacheWritePrice: cost?.cacheWrite ?? (m.cacheWritePrice as number),
            isDefault: m.isDefault as boolean | undefined,
            reasoning: m.reasoning as boolean | undefined,
            input: m.input as string[] | undefined,
            maxTokens: m.maxTokens as number | undefined,
          };
        });
      set({ usableModels: list });
    } finally {
      set({ usableLoading: false });
    }
  },
```

- [ ] **Step 4: Update existing store tests**

`dashboard/src/stores/__tests__/models.test.ts` references the old `models`, `loading`, and `fetchModels` fields. Update all references:

- `state.models` → `state.catalogModels` (for tests about full catalog fetching)
- `state.loading` → `state.catalogLoading`
- `fetchModels` → `fetchCatalog`
- Add new tests for `fetchUsableModels` (calls `/api/models/configured`, filters by `authStatus`)

- [ ] **Step 5: Verify store compiles**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | grep -i error | head -20`
Expected: Will show errors from consumers still referencing old `models` field — this is expected, fixed in subsequent tasks

- [ ] **Step 6: Run store tests**

Run: `cd dashboard && npx vitest run src/stores/__tests__/models.test.ts -v`
Expected: All store tests pass with renamed fields

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] refactor(deck): split models store into catalogModels + usableModels" \
  dashboard/src/stores/models.ts \
  dashboard/src/stores/__tests__/models.test.ts
```

---

### Task 4: Update CatalogTab to use `usableModels`

**Files:**

- Modify: `dashboard/src/components/panels/models/tabs/CatalogTab.tsx`
- Modify: `dashboard/src/components/panels/models/catalog/ProviderList.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add i18n keys for empty states**

In `zh.json` under `models.catalog`:

```json
"noConfiguredModels": "暂无可用模型",
"noConfiguredModelsHint": "请先在「提供商配置」中添加并配置 API Key",
"goConfigProvider": "前往配置"
```

In `en.json` under `models.catalog`:

```json
"noConfiguredModels": "No usable models",
"noConfiguredModelsHint": "Add a provider and configure its API key in Provider Config first",
"goConfigProvider": "Go to Provider Config"
```

- [ ] **Step 2: Update CatalogTab data source**

In `CatalogTab.tsx`, change the destructured store fields:

```typescript
const {
  usableModels: models, // ← was: models
  authOverview,
  usableLoading: loading, // ← was: loading
  fetchUsableModels, // ← was: fetchModels
  fetchAuthOverview,
  // ... rest unchanged
} = useModelsStore();
```

Update the `useEffect`:

```typescript
useEffect(() => {
  void fetchUsableModels();
  void fetchAuthOverview();
}, [fetchUsableModels, fetchAuthOverview]);
```

- [ ] **Step 3: Add "go configure" empty state to ProviderList**

In `ProviderList.tsx`, update the empty state block (line 113-118):

```typescript
{/* Empty state — no configured models */}
{!loading && models.length === 0 && (
  <div className="px-4 py-8 text-center">
    <p className="text-xs text-[var(--muted-foreground)]">
      {t("catalog.noConfiguredModels")}
    </p>
    <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
      {t("catalog.noConfiguredModelsHint")}
    </p>
  </div>
)}
```

- [ ] **Step 4: Verify compilation**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Possibly remaining errors from other consumers — address in next tasks

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] refactor(deck): CatalogTab uses usableModels instead of full catalog" \
  dashboard/src/components/panels/models/tabs/CatalogTab.tsx \
  dashboard/src/components/panels/models/catalog/ProviderList.tsx \
  dashboard/src/i18n/zh.json \
  dashboard/src/i18n/en.json
```

---

### Task 5: Update Agent ModelCombobox to use `usableModels`

**Files:**

- Modify: `dashboard/src/components/panels/agents/tabs/AgentConfigTab.tsx:467-568`

- [ ] **Step 1: Update ModelCombobox data source**

In `AgentConfigTab.tsx`, update the `ModelCombobox` function:

```typescript
function ModelCombobox({ value, placeholder, onChange }: ModelComboboxProps) {
  const { usableModels: models, fetchUsableModels } = useModelsStore(); // ← changed
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (models.length === 0) {
      void fetchUsableModels(); // ← changed
    }
  }, [models.length, fetchUsableModels]);

  // ... rest unchanged
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] refactor(deck): Agent ModelCombobox uses usableModels for model selection" \
  dashboard/src/components/panels/agents/tabs/AgentConfigTab.tsx
```

---

### Task 6: Update remaining consumers of old `models` field

**Files:**

- Modify: Any component still referencing `useModelsStore().models` or `fetchModels`
- Expected consumers: `ProviderOverview.tsx`, `ModelDetail.tsx`, `FallbacksTab.tsx`, `AddModelSelect.tsx`

- [ ] **Step 1: Find all remaining references to old field names**

Run: `cd dashboard && grep -rn "useModelsStore.*models\b\|\.models\b\|fetchModels\b" --include="*.tsx" --include="*.ts" src/`

Identify each consumer and determine:

- If it shows user-selectable models → use `usableModels` / `fetchUsableModels`
- If it's AddProviderDialog reference data → use `catalogModels` / `fetchCatalog`

- [ ] **Step 2: Update FallbacksTab**

`FallbacksTab.tsx` directly destructures `models` and `fetchModels` from the store and passes them as props to `FallbackChain` → `AddModelSelect`. The downstream components receive models via props, so only `FallbacksTab.tsx` needs store-level changes:

In `dashboard/src/components/panels/models/tabs/FallbacksTab.tsx`, change:

```typescript
const {
  usableModels: models, // ← was: models
  authOverview,
  primaryModel,
  fallbacks,
  imagePrimaryModel,
  imageFallbacks,
  fetchFallbacks,
  fetchUsableModels, // ← was: fetchModels
  fetchAuthOverview,
  updateFallbacks,
  updateImageFallbacks,
} = useModelsStore();
```

Update the useEffect:

```typescript
useEffect(() => {
  void fetchFallbacks();
  void fetchUsableModels(); // ← was: fetchModels()
  void fetchAuthOverview();
}, [fetchFallbacks, fetchUsableModels, fetchAuthOverview]);
```

**Note:** `AddModelSelect.tsx` and `FallbackChain.tsx` do NOT import from the store — they receive `models` as props. No changes needed there.

- [ ] **Step 3: Update AddProviderDialog to use `catalogModels`**

This is the one consumer that legitimately needs the full catalog as reference:

```typescript
const { catalogModels, fetchCatalog } = useModelsStore();

useEffect(() => {
  if (open && catalogModels.length === 0) {
    void fetchCatalog(); // Lazy load only when dialog opens
  }
}, [open, catalogModels.length, fetchCatalog]);
```

- [ ] **Step 4: Update ProviderOverview and ModelDetail**

These display details of models already shown in the provider tree. Since the tree now uses `usableModels`, these receive props from the parent — they likely don't import models directly. Verify and fix if needed.

- [ ] **Step 5: Verify full compilation**

Run: `cd dashboard && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: Zero errors

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] refactor(deck): update all model consumers to use catalogModels or usableModels" \
  dashboard/src/components/panels/models/tabs/FallbacksTab.tsx \
  dashboard/src/components/panels/models/config/AddProviderDialog.tsx \
  # ... any other modified files found in Step 1
```

---

### Task 7: Build Gateway + integration verification

**Files:**

- No new files — verification task

- [ ] **Step 1: Build Gateway**

Run: `pnpm build`
Expected: Build succeeds with no errors related to models handlers

- [ ] **Step 2: Run all Gateway tests**

Run: `pnpm test -- src/gateway/ -v`
Expected: All tests pass including new `models.test.ts`

- [ ] **Step 3: Run Dashboard type check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 4: Manual smoke test**

Start Gateway + Dashboard:

```bash
scripts/dev/deck-dev.sh
```

Verify:

1. `curl -s http://localhost:3000/api/models/configured | python3 -m json.tool | head -30` — should return only configured provider models with `authStatus` field
2. `curl -s http://localhost:3000/api/models | python3 -m json.tool | wc -l` — should return full 800+ catalog (unchanged)
3. CatalogTab should only show configured providers
4. Agent Config Tab ModelCombobox should only show usable models
5. AddProviderDialog should still show full catalog when opened

- [ ] **Step 5: Commit (if any fixes needed)**

```bash
scripts/committer "[enhanced] fix(deck): integration fixes for models usability refactor" \
  # ... any files fixed during verification
```

---

### Task 8: Refresh usable models after provider config save

**Files:**

- Modify: `dashboard/src/stores/models.ts` — `updateProviderConfig`, `addCustomProvider`
- Modify: `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx` — trigger refresh after save

After a user configures a new provider (adds API key), the usable models list must refresh.

- [ ] **Step 1: Add auto-refresh in store methods**

In `updateProviderConfig` (line ~450-493), after successful `patchConfig`:

```typescript
if (ok) {
  await get().fetchProviderConfig();
  await get().fetchUsableModels(); // ← add: refresh usable models after config change
}
```

In `addCustomProvider`, after successful save:

```typescript
if (ok) {
  await get().fetchProviderConfig();
  await get().fetchUsableModels(); // ← add
}
```

- [ ] **Step 2: Also refresh after probe succeeds**

In `runProbe`, after successful probe (confirms API key works):

```typescript
// After probe succeeds, refresh usable models in case auth status changed
if (result?.status === "ok") {
  void get().fetchUsableModels();
}
```

- [ ] **Step 3: Verify end-to-end flow**

1. Add a new provider with API key in ProviderConfigTab
2. CatalogTab should immediately show the new provider's models
3. Agent ModelCombobox should include the new models

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(deck): auto-refresh usable models after provider config/probe changes" \
  dashboard/src/stores/models.ts
```

---

## Summary

| Task | Focus                                                        | Files             |
| ---- | ------------------------------------------------------------ | ----------------- |
| 1    | Gateway `models.configured` RPC + test                       | 6 files (backend) |
| 2    | Dashboard API route + allowlist                              | 2 files           |
| 3    | Store split: `catalogModels` + `usableModels` + test update  | 2 files           |
| 4    | CatalogTab → `usableModels` + empty state                    | 4 files           |
| 5    | Agent ModelCombobox → `usableModels`                         | 1 file            |
| 6    | Update remaining consumers (FallbacksTab, AddProviderDialog) | 2-3 files         |
| 7    | Build + integration verification                             | 0 files           |
| 8    | Auto-refresh after config changes                            | 1-2 files         |

**Total: 8 tasks, ~16-20 files modified/created**

## Review Findings Addressed

| #   | Issue                                                       | Fix                                                                                |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | `buildConfiguredModelCatalog` doesn't return cost/maxTokens | Handler cross-references with full catalog via `context.loadGatewayModelCatalog()` |
| 2   | `FallbacksTab` is the store consumer, not `AddModelSelect`  | Task 6 Step 2 fixed to target `FallbacksTab.tsx`                                   |
| 3   | Store test file not mentioned                               | Added to Task 3 Step 4-6                                                           |
| 4   | Fallback to full catalog during transition                  | Documented as expected behavior in `fetchUsableModels`                             |
