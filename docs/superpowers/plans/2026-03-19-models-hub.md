# Models Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Dashboard Models panel into a four-tab hub (Catalog, Config, Fallbacks, Usage) with gateway RPC support for auth diagnostics, replacing CLI-only model management.

**Architecture:** Backend-first — add gateway RPC methods and shared auth diagnostics, then dashboard API routes, store, shared components, and finally each tab. Each task produces a working, testable increment.

**Tech Stack:** TypeScript, Next.js 16, React 19, Zustand 5, shadcn/ui, Recharts 3, @dnd-kit 6, Vitest

**Spec:** `docs/superpowers/specs/2026-03-19-models-hub-design.md`

---

## File Map

### Gateway (new/modified)

| File                                           | Action | Responsibility                                        |
| ---------------------------------------------- | ------ | ----------------------------------------------------- |
| `src/agents/auth-diagnostics.ts`               | Create | Shared auth overview logic extracted from CLI         |
| `src/gateway/server-methods/deck-auth.ts`      | Create | `deck.auth.overview` + `deck.auth.probe` RPC handlers |
| `src/gateway/server-methods.ts`                | Modify | Import + spread `deckAuthHandlers`                    |
| `src/gateway/server-model-catalog.ts`          | Modify | Merge cost/maxTokens from ModelDefinitionConfig       |
| `src/agents/auth-diagnostics.test.ts`          | Create | Unit tests for auth diagnostics                       |
| `src/gateway/server-methods/deck-auth.test.ts` | Create | Unit tests for RPC handlers                           |

### Dashboard API Routes (new)

| File                                          | Action | Responsibility                 |
| --------------------------------------------- | ------ | ------------------------------ |
| `dashboard/src/app/api/models/auth/route.ts`  | Create | Proxy for `deck.auth.overview` |
| `dashboard/src/app/api/models/probe/route.ts` | Create | Proxy for `deck.auth.probe`    |

### Dashboard Store (modify)

| File                             | Action | Responsibility                            |
| -------------------------------- | ------ | ----------------------------------------- |
| `dashboard/src/stores/models.ts` | Modify | Add auth, fallback, usage state + actions |

### Dashboard Components (new)

| File                                                                    | Action | Responsibility                               |
| ----------------------------------------------------------------------- | ------ | -------------------------------------------- |
| `dashboard/src/components/panels/models/shared/AuthStatusDot.tsx`       | Create | 🟢🟡🔴⚫ status dot                          |
| `dashboard/src/components/panels/models/shared/ModelBadges.tsx`         | Create | Capability badges (reasoning, vision, text)  |
| `dashboard/src/components/panels/models/ModelsPanel.tsx`                | Modify | Four-tab layout with shadcn Tabs             |
| `dashboard/src/components/panels/models/tabs/CatalogTab.tsx`            | Create | Tab 1 container                              |
| `dashboard/src/components/panels/models/catalog/ProviderList.tsx`       | Create | Left pane: collapsible provider groups       |
| `dashboard/src/components/panels/models/catalog/ProviderOverview.tsx`   | Create | Right pane: provider model table             |
| `dashboard/src/components/panels/models/catalog/ModelDetail.tsx`        | Create | Right pane: single model detail              |
| `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx`     | Create | Tab 2 container                              |
| `dashboard/src/components/panels/models/config/ProviderSidebar.tsx`     | Create | Left pane: configured/unconfigured providers |
| `dashboard/src/components/panels/models/config/AuthHealthCard.tsx`      | Create | Auth health card with probe button           |
| `dashboard/src/components/panels/models/config/ConfigForm.tsx`          | Create | API Key / Base URL / Model ID form           |
| `dashboard/src/components/panels/models/tabs/FallbacksTab.tsx`          | Create | Tab 3 container                              |
| `dashboard/src/components/panels/models/fallbacks/FallbackChain.tsx`    | Create | Drag-sortable fallback chain                 |
| `dashboard/src/components/panels/models/fallbacks/ModelCard.tsx`        | Create | Draggable model card                         |
| `dashboard/src/components/panels/models/fallbacks/PrimaryModelCard.tsx` | Create | Non-draggable primary card                   |
| `dashboard/src/components/panels/models/fallbacks/AddModelSelect.tsx`   | Create | Add model to chain dropdown                  |
| `dashboard/src/components/panels/models/tabs/UsageTab.tsx`              | Create | Tab 4 container                              |
| `dashboard/src/components/panels/models/usage/SummaryCards.tsx`         | Create | Cost + active providers cards                |
| `dashboard/src/components/panels/models/usage/ProviderQuotaGrid.tsx`    | Create | Provider quota progress bars                 |
| `dashboard/src/components/panels/models/usage/CostTrendChart.tsx`       | Create | 7-day Recharts bar chart                     |

### Cleanup (delete)

| File                                                        | Action | Reason                  |
| ----------------------------------------------------------- | ------ | ----------------------- |
| `dashboard/src/components/panels/models/ModelCatalog.tsx`   | Delete | Replaced by `catalog/*` |
| `dashboard/src/components/panels/models/ProviderConfig.tsx` | Delete | Replaced by `config/*`  |

---

## Task 1: Auth Diagnostics Shared Module

**Domain:** `[gateway]`
**Files:**

- Create: `src/agents/auth-diagnostics.ts`
- Create: `src/agents/auth-diagnostics.test.ts`

This task extracts auth overview logic from the CLI into a reusable module that both the CLI and the new gateway RPC can call.

- [ ] **Step 1: Write failing test for `buildAuthOverview`**

```typescript
// src/agents/auth-diagnostics.test.ts
import { describe, it, expect, vi } from "vitest";
import { buildAuthOverview, type AuthOverviewEntry } from "./auth-diagnostics.js";

describe("buildAuthOverview", () => {
  it("returns ready status for provider with valid api_key profile", async () => {
    const result = await buildAuthOverview({
      providers: ["moonshot"],
      cfg: {},
      agentDir: "/tmp/test-agent",
    });
    expect(result.providers).toHaveLength(1);
    expect(result.providers[0].provider).toBe("moonshot");
    expect(result.providers[0].status).toMatch(/ready|missing|unknown/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/agents/auth-diagnostics.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `buildAuthOverview`**

Create `src/agents/auth-diagnostics.ts`:

- Import and call `resolveProviderAuthOverview()` from `src/commands/models/list.auth-overview.ts`
- Import and call `buildAuthHealthSummary()` from `src/agents/auth-health.ts`
- Import and call `resolveProfileUnusableUntilForDisplay()` from `src/agents/auth-profiles.ts`
- Import and call `loadProviderUsageSummary()` from `src/infra/provider-usage.ts`
- Map `AuthProviderHealthStatus` → UI `status` using the spec mapping table:
  - `ok` / `static` → `"ready"`
  - `expiring` → `"warning"`
  - `expired` / `missing` → `"missing"`
  - no profile → `"unknown"`
- Extract auth type from profile store (`store.profiles[profileId]?.type`)
- Convert `UsageWindow.resetAt` (timestamp) to `resetsInMs` (relative ms)
- Export type `AuthOverviewEntry` matching the spec's `deck.auth.overview` response schema
- Export async function `buildAuthOverview(params: { providers: string[]; cfg: OpenClawConfig; agentDir: string }): Promise<{ providers: AuthOverviewEntry[] }>`

- [ ] **Step 4: Write additional tests for edge cases**

Add tests for:

- Provider with `expiring` OAuth → `warning` status
- Provider with expired OAuth + valid API key fallback → `ready` status
- Provider with cooldown → includes `cooldown` field
- Provider with usage windows → includes `usage.windows[]` array
- Unknown provider (no profile) → `unknown` status

- [ ] **Step 5: Run tests and verify they pass**

Run: `pnpm test src/agents/auth-diagnostics.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] feat(gateway): add auth-diagnostics shared module" src/agents/auth-diagnostics.ts src/agents/auth-diagnostics.test.ts
```

---

## Task 2: Gateway RPC — `deck.auth.overview` + `deck.auth.probe`

**Domain:** `[gateway]`
**Files:**

- Create: `src/gateway/server-methods/deck-auth.ts`
- Create: `src/gateway/server-methods/deck-auth.test.ts`
- Modify: `src/gateway/server-methods.ts` (add import + spread)
- Modify: `src/gateway/server-methods-list.ts` (add to BASE_METHODS)
- Modify: `src/gateway/method-scopes.ts` (add scope classification)

- [ ] **Step 1: Write failing test for `deck.auth.overview` handler**

```typescript
// src/gateway/server-methods/deck-auth.test.ts
import { describe, it, expect, vi } from "vitest";

describe("deck.auth.overview handler", () => {
  it("responds with provider auth status list", async () => {
    // Mock buildAuthOverview to return test data
    // Call handler with mock respond function
    // Verify respond(true, { providers: [...] }) was called
  });
});
```

- [ ] **Step 2: Implement `deckAuthHandlers`**

Create `src/gateway/server-methods/deck-auth.ts`:

- `"deck.auth.overview"` handler: calls `buildAuthOverview()` with providers from config, responds with result
- `"deck.auth.probe"` handler: validates `provider` param, calls `runAuthProbes()` from `src/commands/models/list.probe.ts` with single-provider filter, cleans up temp session files, deduplicates concurrent requests per provider
- Export as `deckAuthHandlers: GatewayRequestHandlers`

Follow existing handler pattern from `src/gateway/server-methods/models.ts`:

```typescript
export const deckAuthHandlers: GatewayRequestHandlers = {
  "deck.auth.overview": async ({ params, respond, context }) => { ... },
  "deck.auth.probe": async ({ params, respond, context }) => { ... },
};
```

- [ ] **Step 3: Register handlers + method scopes**

Modify `src/gateway/server-methods.ts`:

```typescript
import { deckAuthHandlers } from "./server-methods/deck-auth.js";

export const coreGatewayHandlers: GatewayRequestHandlers = {
  ...existingHandlers,
  ...deckAuthHandlers,
};
```

Modify `src/gateway/server-methods-list.ts` — add to `BASE_METHODS`:

```typescript
"deck.auth.overview",
"deck.auth.probe",
```

Modify `src/gateway/method-scopes.ts` — add scope classification:

- `"deck.auth.overview"` → `READ_SCOPE` (read-only auth status)
- `"deck.auth.probe"` → `WRITE_SCOPE` (sends real request, side effects)

This is required because `method-scopes.test.ts` asserts every key in `coreGatewayHandlers` is classified.

- [ ] **Step 4: Write test for `deck.auth.probe` handler**

Test: validates required `provider` param, returns probe result with status/latencyMs, handles timeout.

- [ ] **Step 5: Run tests**

Run: `pnpm test src/gateway/server-methods/deck-auth.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Type check**

Run: `pnpm tsgo`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] feat(gateway): add deck.auth.overview and deck.auth.probe RPC" src/gateway/server-methods/deck-auth.ts src/gateway/server-methods/deck-auth.test.ts src/gateway/server-methods.ts src/gateway/server-methods-list.ts src/gateway/method-scopes.ts
```

---

## Task 3: Extend `models.list` with Cost Data

**Domain:** `[gateway]`
**Files:**

- Modify: `src/gateway/server-model-catalog.ts`
- Test: existing model catalog tests

- [ ] **Step 1: Read current `loadGatewayModelCatalog()` implementation**

Understand how `ModelCatalogEntry` is built from Pi SDK's `ModelRegistry`.

- [ ] **Step 2: Extend `ModelCatalogEntry` type**

Modify `src/agents/model-catalog.ts` to add optional fields:

```typescript
export type ModelCatalogEntry = {
  // existing fields...
  cost?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  maxTokens?: number;
};
```

- [ ] **Step 3: Write test for cost data in catalog entries**

```typescript
it("includes cost data when ModelDefinitionConfig has pricing", () => {
  // Setup: config with provider having cost: { input: 0.5, output: 2.0, ... }
  // Call loadGatewayModelCatalog
  // Verify returned entries include cost field
});
```

- [ ] **Step 4: Implement cost data merge**

In `loadGatewayModelCatalog()`:

1. Load `models.json` config (already available via `loadConfig()`)
2. For each `ModelCatalogEntry`, look up matching `ModelDefinitionConfig` by `provider + model.id`
3. If found, merge `cost` and `maxTokens` fields onto the entry
4. Return extended entries

- [ ] **Step 5: Run tests**

Run: `pnpm test src/gateway/server-model-catalog`
Expected: PASS

- [ ] **Step 6: Type check + commit**

Run: `pnpm tsgo`

```bash
scripts/committer "[enhanced] feat(gateway): include cost and maxTokens in models.list response" src/agents/model-catalog.ts src/gateway/server-model-catalog.ts
```

---

## Task 4: Dashboard API Routes

**Domain:** `[dashboard]`
**Files:**

- Create: `dashboard/src/app/api/models/auth/route.ts`
- Create: `dashboard/src/app/api/models/probe/route.ts`

- [ ] **Step 1: Create auth overview route**

```typescript
// dashboard/src/app/api/models/auth/route.ts
import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { gatewayRequest } from "@/lib/api-helpers";

export const GET = withAuth(async (_request: NextRequest) => {
  return gatewayRequest("deck.auth.overview", {});
});
```

- [ ] **Step 2: Create probe route**

```typescript
// dashboard/src/app/api/models/probe/route.ts
import { type NextRequest } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { gatewayRequest } from "@/lib/api-helpers";

export const POST = withAuth(async (request: NextRequest) => {
  const body = await request.json();
  if (!body?.provider || typeof body.provider !== "string") {
    return Response.json({ error: "provider is required" }, { status: 400 });
  }
  return gatewayRequest(
    "deck.auth.probe",
    {
      provider: body.provider,
      profileId: body.profileId,
      timeoutMs: body.timeoutMs,
      maxTokens: body.maxTokens,
    },
    { timeoutMs: (body.timeoutMs ?? 8000) + 2000 },
  );
});
```

- [ ] **Step 3: Type check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add auth overview and probe API routes" dashboard/src/app/api/models/auth/route.ts dashboard/src/app/api/models/probe/route.ts
```

---

## Task 5: Store Extension + Types

**Domain:** `[dashboard]`
**Files:**

- Modify: `dashboard/src/stores/models.ts`

- [ ] **Step 1: Extend Model interface**

Add to existing `Model` interface:

```typescript
export interface Model {
  // existing fields...
  reasoning?: boolean;
  input?: string[]; // ["text", "image"]
  maxTokens?: number;
  cacheReadPrice?: number;
  cacheWritePrice?: number;
}
```

- [ ] **Step 2: Add auth types**

```typescript
export interface AuthOverviewEntry {
  provider: string;
  status: "ready" | "warning" | "missing" | "unknown";
  auth: {
    type: "api_key" | "oauth" | "token" | "aws-sdk" | null;
    source: string;
    profileId?: string;
  } | null;
  oauth?: { expiresAt: number; remainingMs: number; status: string };
  cooldown?: { reason: string; remainingMs: number; until: number };
  usage?: {
    windows: Array<{ label: string; usedPercent: number; resetsInMs: number }>;
    plan?: string;
  };
}

export interface ProbeResult {
  provider: string;
  profileId?: string;
  status: string;
  latencyMs: number;
  error?: string;
  model?: string;
}
```

- [ ] **Step 3: Add fallback and usage types**

```typescript
export interface DailyCost {
  date: string;
  cost: number;
}

export interface UsageProviderStatus {
  provider: string;
  displayName: string;
  windows: Array<{ label: string; usedPercent: number; resetsInMs: number }>;
  plan?: string;
  error?: string;
}
```

- [ ] **Step 4: Extend store state + actions**

Add to the Zustand store:

- State: `authOverview`, `authLoading`, `probeResults`, `primaryModel`, `fallbacks`, `imagePrimaryModel`, `imageFallbacks`, `usageCost`, `usageProviders`, `configRaw: string | null`, `configHash: string | null`
- Actions: `fetchAuthOverview()`, `runProbe(provider)`, `fetchFallbacks()`, `updateFallbacks(primary, fallbacks)`, `updateImageFallbacks(primary, fallbacks)`, `fetchUsageSummary()`

Each action follows the existing pattern: `set({ loading: true })` → `fetch("/api/...")` → `set({ data, loading: false })`.

**`fetchFallbacks()` implementation detail:**

1. Calls `GET /api/models/config` (maps to `config.get` RPC)
2. Response is `ConfigFileSnapshot` — extract `raw` and `hash`, store as `configRaw` and `configHash`
3. Parse `raw` (JSON5 string) client-side to get config object
4. Extract `agents.defaults.model` → `resolveAgentModelPrimaryValue()` equivalent logic (handle both string and `{ primary, fallbacks }` shapes)
5. Extract `agents.defaults.imageModel` → same logic
6. Set `primaryModel`, `fallbacks`, `imagePrimaryModel`, `imageFallbacks`

**`updateFallbacks()` implementation detail:**

1. Read current `configRaw` and `configHash` from store
2. Parse `configRaw`, update `agents.defaults.model.primary` and `agents.defaults.model.fallbacks`
3. Serialize back to JSON string
4. Call `PATCH /api/models/config` with `{ raw: newRaw, baseHash: configHash }`
5. On success → update `configRaw` and `configHash` with response
6. On 409 (hash mismatch) → toast error → auto refetch

- [ ] **Step 5: Type check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] feat(deck): extend models store with auth, fallback, usage state" dashboard/src/stores/models.ts
```

---

## Task 6: Shared Components + i18n

**Domain:** `[dashboard]`
**Files:**

- Create: `dashboard/src/components/panels/models/shared/AuthStatusDot.tsx`
- Create: `dashboard/src/components/panels/models/shared/ModelBadges.tsx`
- Modify: `dashboard/src/i18n/en.json`
- Modify: `dashboard/src/i18n/zh.json`

- [ ] **Step 1: Create AuthStatusDot**

```tsx
// Props: { status: "ready" | "warning" | "missing" | "unknown"; size?: "sm" | "md" }
// Renders: colored dot with tooltip showing status text
// Colors: ready=green-500, warning=yellow-500, missing=red-500, unknown=gray-500
```

Use shadcn `Tooltip` component. Size `sm` = 8px, `md` = 10px.

- [ ] **Step 2: Create ModelBadges**

```tsx
// Props: { reasoning?: boolean; input?: string[]; className?: string }
// Renders: Badge components for capabilities
// reasoning=true → Badge "Reasoning"
// input.includes("image") → Badge "Vision"
// Always → Badge "Text"
```

Use shadcn `Badge` component with `variant="secondary"`.

- [ ] **Step 3: Add i18n keys**

Add to `models` namespace in `en.json` and `zh.json`:

```json
{
  "models": {
    "tabs": {
      "catalog": "Catalog",
      "config": "Provider Config",
      "fallbacks": "Fallbacks",
      "usage": "Usage"
    },
    "auth": {
      "ready": "Ready",
      "warning": "Warning",
      "missing": "Not configured",
      "unknown": "Unknown",
      "probe": "Run Diagnostic",
      "probing": "Testing...",
      "probeHint": "Sends a test request (uses a small amount of tokens)",
      "source": "Source",
      "type": "Auth Type",
      "expires": "Expires in",
      "cooldown": "Cooldown"
    },
    "fallbacks": {
      "primary": "Primary Model",
      "failsOver": "On failure",
      "empty": "No fallback chain configured. Requests will fail if the primary model is unavailable.",
      "add": "Add Fallback Model",
      "saved": "Saved",
      "imageModels": "Image Models",
      "emptyImage": "No image model configured.",
      "authWarning": "This provider has no auth configured. It will be skipped during failover.",
      "goConfig": "Configure"
    },
    "usage": {
      "todayCost": "Today",
      "weekCost": "This Week",
      "activeProviders": "Active Providers",
      "vsYesterday": "vs yesterday",
      "vsLastWeek": "vs last week",
      "quota": "Quota",
      "resetsIn": "Resets in",
      "noQuotaData": "Quota data unavailable",
      "viewDetails": "View detailed analysis"
    },
    "config": {
      "configured": "Configured",
      "unconfigured": "Unconfigured",
      "apiKey": "API Key",
      "baseUrl": "Base URL",
      "modelId": "Model ID",
      "save": "Save",
      "saved": "Saved",
      "providerReady": "{provider} is ready",
      "needsApiKey": "Requires an API Key to use this provider",
      "apiFormat": "API Format",
      "envHint": "Environment variable: {envVar}",
      "advanced": "Advanced",
      "profiles": "Auth Profiles"
    },
    "catalog": {
      "setDefault": "Set as Default",
      "addToFallback": "Add to Fallback Chain",
      "goConfig": "Configure",
      "contextWindow": "Context",
      "inputPrice": "Input",
      "outputPrice": "Output",
      "noModels": "No models found"
    }
  }
}
```

Add corresponding Chinese translations in `zh.json`.

- [ ] **Step 4: Type check + commit**

```bash
cd dashboard && npx tsc --noEmit
scripts/committer "[enhanced] feat(deck): add AuthStatusDot, ModelBadges, i18n for Models Hub" dashboard/src/components/panels/models/shared/AuthStatusDot.tsx dashboard/src/components/panels/models/shared/ModelBadges.tsx dashboard/src/i18n/en.json dashboard/src/i18n/zh.json
```

---

## Task 7: ModelsPanel Tab Shell

**Domain:** `[dashboard]`
**Files:**

- Modify: `dashboard/src/components/panels/models/ModelsPanel.tsx`
- Create: `dashboard/src/components/panels/models/tabs/CatalogTab.tsx`
- Create: `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx`
- Create: `dashboard/src/components/panels/models/tabs/FallbacksTab.tsx`
- Create: `dashboard/src/components/panels/models/tabs/UsageTab.tsx`

- [ ] **Step 1: Create stub tab components**

Each tab starts as a placeholder:

```tsx
// tabs/CatalogTab.tsx
export function CatalogTab() {
  return <div className="p-4 text-muted-foreground">Catalog — coming soon</div>;
}
```

Same pattern for `ProviderConfigTab`, `FallbacksTab`, `UsageTab`.

- [ ] **Step 2: Rewrite ModelsPanel with Tabs**

Replace current left-right split with shadcn `Tabs`:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CatalogTab } from "./tabs/CatalogTab";
// ... other tab imports

export function ModelsPanel() {
  const t = useTranslations("models");
  return (
    <div className="flex h-full flex-col">
      <Tabs defaultValue="catalog" className="flex h-full flex-col">
        <TabsList className="mx-4 mt-2">
          <TabsTrigger value="catalog">{t("tabs.catalog")}</TabsTrigger>
          <TabsTrigger value="config">{t("tabs.config")}</TabsTrigger>
          <TabsTrigger value="fallbacks">{t("tabs.fallbacks")}</TabsTrigger>
          <TabsTrigger value="usage">{t("tabs.usage")}</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog" className="flex-1 overflow-hidden">
          <CatalogTab />
        </TabsContent>
        {/* ... other tabs */}
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 3: Verify tabs render**

Run: `cd dashboard && pnpm dev` → navigate to Models panel → verify 4 tabs are visible and switchable.

- [ ] **Step 4: Type check + commit**

```bash
cd dashboard && npx tsc --noEmit
scripts/committer "[enhanced] feat(deck): ModelsPanel four-tab shell with stubs" dashboard/src/components/panels/models/ModelsPanel.tsx dashboard/src/components/panels/models/tabs/CatalogTab.tsx dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx dashboard/src/components/panels/models/tabs/FallbacksTab.tsx dashboard/src/components/panels/models/tabs/UsageTab.tsx
```

---

## Task 8: Catalog Tab

**Domain:** `[dashboard]`
**Files:**

- Create: `dashboard/src/components/panels/models/catalog/ProviderList.tsx`
- Create: `dashboard/src/components/panels/models/catalog/ProviderOverview.tsx`
- Create: `dashboard/src/components/panels/models/catalog/ModelDetail.tsx`
- Modify: `dashboard/src/components/panels/models/tabs/CatalogTab.tsx`

- [ ] **Step 1: Build ProviderList**

Left-pane component:

- Group models by provider using `models.list` data from store
- Each provider: `Collapsible` with `AuthStatusDot` + name + model count badge
- Each model row: name + `★` default marker + context window badge
- Click provider → `onSelectProvider(provider)`
- Click model → `onSelectModel(provider, modelId)`
- Loading state: skeleton rows (5)

- [ ] **Step 2: Build ProviderOverview**

Right-pane when provider selected:

- Auth status summary line (from `authOverview`)
- Model comparison table using existing `renderTable` pattern:
  - Columns: name (★ default), context window, input price, output price, reasoning, vision
- Action buttons: [Set as Default] → `config.patch`, [Configure →] → switch to Config tab

- [ ] **Step 3: Build ModelDetail**

Right-pane when model selected:

- Model name, provider, ID
- `ModelBadges` for capabilities
- Price detail card (input / output / cache read / cache write)
- Context window + max output tokens
- Quick actions: [Set as Default] / [Add to Fallback Chain]

- [ ] **Step 4: Wire CatalogTab**

```tsx
export function CatalogTab() {
  const { models, authOverview, loading, fetchModels, fetchAuthOverview } = useModelsStore();
  const [selected, setSelected] = useState<{ type: "provider" | "model"; provider: string; model?: string } | null>(null);

  useEffect(() => { fetchModels(); fetchAuthOverview(); }, []);

  return (
    <div className="flex h-full">
      <ProviderList models={models} auth={authOverview} loading={loading}
        onSelectProvider={...} onSelectModel={...} />
      <div className="flex-1 overflow-auto border-l">
        {selected?.type === "provider" && <ProviderOverview ... />}
        {selected?.type === "model" && <ModelDetail ... />}
        {!selected && <EmptyState />}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Delete old ModelCatalog.tsx**

Remove `dashboard/src/components/panels/models/ModelCatalog.tsx`.

- [ ] **Step 6: Type check + manual test + commit**

Run: `cd dashboard && npx tsc --noEmit`
Manual: verify catalog tab shows providers, models, prices, auth dots.

```bash
scripts/committer "[enhanced] feat(deck): Catalog Tab — provider list, model detail, pricing" dashboard/src/components/panels/models/tabs/CatalogTab.tsx dashboard/src/components/panels/models/catalog/ProviderList.tsx dashboard/src/components/panels/models/catalog/ProviderOverview.tsx dashboard/src/components/panels/models/catalog/ModelDetail.tsx
```

---

## Task 9: Provider Config Tab

**Domain:** `[dashboard]`
**Files:**

- Create: `dashboard/src/components/panels/models/config/ProviderSidebar.tsx`
- Create: `dashboard/src/components/panels/models/config/AuthHealthCard.tsx`
- Create: `dashboard/src/components/panels/models/config/ConfigForm.tsx`
- Create: `dashboard/src/components/panels/models/config/ProbeButton.tsx`
- Modify: `dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx`

- [ ] **Step 1: Build ProviderSidebar**

Left pane:

- Two sections: "Configured" / "Unconfigured"
- Each row: `AuthStatusDot` + name + auth type badge (`API Key` / `OAuth` / `Token`)
- Sorted: configured by usage frequency, unconfigured alphabetical
- Selected state: highlight with accent border

- [ ] **Step 2: Build ProbeButton**

```tsx
// Calls runProbe(provider) from store
// States: idle → loading (spinner) → result (✅ ok · 238ms / ❌ error)
// Tooltip: "Sends test request, uses small amount of tokens"
// Debounce: disable during loading
```

- [ ] **Step 3: Build AuthHealthCard**

Top area of right pane (imports ProbeButton built in Step 2):

- Provider name + status badge
- Auth type + source line
- OAuth section (if applicable): expiry countdown, refresh button
- Cooldown section (if applicable): reason + remaining time + progress bar
- `ProbeButton` at bottom

- [ ] **Step 4: Build ConfigForm**

- API Key: `Input type="password"` with eye toggle
- Base URL: `Input` with placeholder showing default URL
- Model ID: `Input` (optional)
- Save button → calls `config.patch` via store
- On save success: refresh auth overview, toast if status changed to `ready`

- [ ] **Step 5: Wire ProviderConfigTab**

Left-right split. Show `AuthHealthCard` + `ConfigForm` for configured providers. Show setup guidance + empty `ConfigForm` for unconfigured providers.

- [ ] **Step 6: Delete old ProviderConfig.tsx**

Remove `dashboard/src/components/panels/models/ProviderConfig.tsx`.

- [ ] **Step 7: Type check + manual test + commit**

Remove `dashboard/src/components/panels/models/ProviderConfig.tsx`.

```bash
scripts/committer "[enhanced] feat(deck): Config Tab — auth health, probe, provider config form" dashboard/src/components/panels/models/tabs/ProviderConfigTab.tsx dashboard/src/components/panels/models/config/ProviderSidebar.tsx dashboard/src/components/panels/models/config/AuthHealthCard.tsx dashboard/src/components/panels/models/config/ConfigForm.tsx dashboard/src/components/panels/models/config/ProbeButton.tsx
```

---

## Task 10: Fallbacks Tab (with @dnd-kit)

**Domain:** `[dashboard]`
**Files:**

- Create: `dashboard/src/components/panels/models/fallbacks/FallbackChain.tsx`
- Create: `dashboard/src/components/panels/models/fallbacks/ModelCard.tsx`
- Create: `dashboard/src/components/panels/models/fallbacks/PrimaryModelCard.tsx`
- Create: `dashboard/src/components/panels/models/fallbacks/AddModelSelect.tsx`
- Modify: `dashboard/src/components/panels/models/tabs/FallbacksTab.tsx`

- [ ] **Step 1: Install @dnd-kit**

```bash
cd dashboard && pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Build ModelCard (draggable)**

```tsx
// Props: { model: Model; auth: AuthOverviewEntry; onRemove: () => void }
// Content: AuthStatusDot + provider/model name + context + price + badges
// Right side: ≡ drag handle + ✕ delete
// Auth missing: red dashed border + warning + [Configure →] link
// Uses useSortable() from @dnd-kit/sortable
```

- [ ] **Step 3: Build PrimaryModelCard**

Same content as `ModelCard` but:

- No drag handle, no delete
- [Change ▾] dropdown to select a new primary model
- Uses shadcn `Select` with models grouped by provider

- [ ] **Step 4: Build AddModelSelect**

```tsx
// Dropdown showing models NOT already in the chain
// Grouped by provider, each option has AuthStatusDot
// On select → add to fallbacks array → auto-save
```

- [ ] **Step 5: Build FallbackChain**

```tsx
// DndContext + SortableContext from @dnd-kit
// Layout: PrimaryModelCard → "▼ On failure" arrows → ModelCard[] → [+ Add]
// onDragEnd: reorder fallbacks array → debounced config.patch
// Debounce: 500ms trailing, disable drag during save
// Error recovery: toast + revert to last known state + refetch
```

- [ ] **Step 6: Wire FallbacksTab**

```tsx
export function FallbacksTab() {
  const {
    models,
    authOverview,
    primaryModel,
    fallbacks,
    imagePrimaryModel,
    imageFallbacks,
    fetchFallbacks,
    updateFallbacks,
    updateImageFallbacks,
  } = useModelsStore();

  useEffect(() => {
    fetchFallbacks();
  }, []);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        <FallbackChain
          type="text"
          primary={primaryModel}
          fallbacks={fallbacks}
          models={models}
          auth={authOverview}
          onUpdate={(p, f) => updateFallbacks(p, f)}
        />
        <Separator />
        <h3>Image Models</h3>
        <FallbackChain
          type="image"
          primary={imagePrimaryModel}
          fallbacks={imageFallbacks}
          models={models}
          auth={authOverview}
          onUpdate={(p, f) => updateImageFallbacks(p, f)}
        />
      </div>
    </ScrollArea>
  );
}
```

- [ ] **Step 7: Type check + manual test drag/drop + commit**

Manual: verify drag reorder works, auto-save fires, error state on concurrent edit.

```bash
scripts/committer "[enhanced] feat(deck): Fallbacks Tab — drag-sort chain with auto-save" dashboard/src/components/panels/models/tabs/FallbacksTab.tsx dashboard/src/components/panels/models/fallbacks/FallbackChain.tsx dashboard/src/components/panels/models/fallbacks/ModelCard.tsx dashboard/src/components/panels/models/fallbacks/PrimaryModelCard.tsx dashboard/src/components/panels/models/fallbacks/AddModelSelect.tsx
```

---

## Task 11: Usage Tab

**Domain:** `[dashboard]`
**Files:**

- Create: `dashboard/src/components/panels/models/usage/SummaryCards.tsx`
- Create: `dashboard/src/components/panels/models/usage/ProviderQuotaGrid.tsx`
- Create: `dashboard/src/components/panels/models/usage/CostTrendChart.tsx`
- Modify: `dashboard/src/components/panels/models/tabs/UsageTab.tsx`

- [ ] **Step 1: Build SummaryCards**

3 cards in a row:

- Today cost: `¥ XX.XX` + vs yesterday % (red ↑ / green ↓)
- Week cost: `¥ XX.XX` + vs last week %
- Active providers: `N / M` (from auth overview: status=ready count / total)

Use shadcn `Card`.

- [ ] **Step 2: Build ProviderQuotaGrid**

2-column grid of cards, one per provider with quota windows:

- Progress bar: `<div className="h-2 rounded-full bg-muted"><div style={{width}} /></div>`
- Color: <70% blue, 70-90% yellow, >90% red
- Label + used% + "Resets in X h" + plan name
- Skip providers without quota data

- [ ] **Step 3: Build CostTrendChart**

Recharts `BarChart` with 7 days:

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
// data = usageCost (DailyCost[])
// X: date, Y: cost
// Tooltip: date + exact amount
// Below chart: link "View detailed analysis →" → navigate to Usage panel
```

- [ ] **Step 4: Wire UsageTab**

```tsx
export function UsageTab() {
  const { authOverview, usageCost, usageProviders, fetchUsageSummary, fetchAuthOverview } =
    useModelsStore();
  useEffect(() => {
    fetchUsageSummary();
    fetchAuthOverview();
  }, []);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        <SummaryCards cost={usageCost} auth={authOverview} />
        <ProviderQuotaGrid providers={usageProviders} />
        <CostTrendChart data={usageCost} />
      </div>
    </ScrollArea>
  );
}
```

- [ ] **Step 5: Type check + manual test + commit**

```bash
scripts/committer "[enhanced] feat(deck): Usage Tab — cost cards, provider quotas, trend chart" dashboard/src/components/panels/models/tabs/UsageTab.tsx dashboard/src/components/panels/models/usage/SummaryCards.tsx dashboard/src/components/panels/models/usage/ProviderQuotaGrid.tsx dashboard/src/components/panels/models/usage/CostTrendChart.tsx
```

---

## Task 12: Final Integration + Cleanup

**Domain:** `[dashboard]` `[gateway]`

- [ ] **Step 1: Full type check**

```bash
pnpm tsgo
cd dashboard && npx tsc --noEmit
```

- [ ] **Step 2: Run all tests**

```bash
pnpm test
```

- [ ] **Step 3: Lint + format**

```bash
pnpm check
pnpm format:fix
```

- [ ] **Step 4: Manual E2E verification**

1. Open Dashboard → Models panel
2. Catalog tab: providers grouped, auth dots visible, model detail shows pricing
3. Config tab: select provider, see auth health, save API key, run probe
4. Fallbacks tab: see primary + chain, drag to reorder, add/remove, auto-save
5. Usage tab: cost cards, provider quotas with progress bars, 7-day chart

- [ ] **Step 5: Remove old files if not already removed**

Verify `ModelCatalog.tsx` and `ProviderConfig.tsx` are deleted.

- [ ] **Step 6: Final commit**

```bash
scripts/committer "[enhanced] chore(deck): Models Hub cleanup and integration verification"
```

---

## Dependency Graph

```
Task 1 (auth-diagnostics)
  └→ Task 2 (deck.auth RPC)
       └→ Task 4 (API routes)
            └→ Task 5 (store)
                 ├→ Task 6 (shared + i18n)
                 │    └→ Task 7 (tab shell)
                 │         ├→ Task 8 (Catalog)
                 │         ├→ Task 9 (Config)
                 │         ├→ Task 10 (Fallbacks)
                 │         └→ Task 11 (Usage)
                 └────────────────┘
Task 3 (models.list cost) ──→ Task 5 (store)

Task 12 (integration) depends on all above
```

Tasks 8, 9, 10, 11 are independent of each other and can be parallelized.
Task 3 is independent of Tasks 1-2 and can run in parallel with them.
