# Models Hub V2: Core Capability Completion

## Goal

Supplement the existing Models Hub UI to fully cover OpenClaw's model integration capabilities, focusing on **model allowlist management**, **per-model parameters**, **auth type selection**, **Bedrock dynamic discovery**, and **secret reference hints**.

## Background

Models Hub V1 (completed 2026-03-19) delivered a 4-tab panel (Catalog, Provider Config, Fallbacks, Usage) covering model browsing, fallback chain editing, provider config, and auth probing. Gap analysis against the backend revealed 6 P0/P1 capabilities not yet exposed in the UI.

### Backend Capabilities Not Covered (P0+P1)

| #   | Capability                                                 | Backend Location          | Priority |
| --- | ---------------------------------------------------------- | ------------------------- | -------- |
| 1   | Model allowlist (`agents.defaults.models`)                 | `types.agent-defaults.ts` | P0       |
| 2   | Per-model params (alias, streaming, thinking budget)       | `types.agent-defaults.ts` | P0       |
| 3   | Provider auth type selection (api-key/oauth/aws-sdk/token) | `types.models.ts`         | P1       |
| 4   | Bedrock dynamic discovery config                           | `types.models.ts`         | P1       |
| 5   | Secret reference types (`${ENV_VAR}` template syntax)      | `types.secrets.ts`        | P1       |
| 6   | Model alias system                                         | `model-selection.ts`      | P1       |

Items 2 and 6 are covered together (alias is part of per-model params).

## Architecture

All changes are **frontend-only**. No Gateway RPC or API route changes needed — the existing `config.get` / `config.patch` / `models.list` / `deck.auth.overview` endpoints already support all required data flows.

### Data Flow

```
User interaction → store method → read configRaw → parse → mutate agents.defaults.models
  → config.patch(raw, baseHash) → 409? refetch : success → refetch to confirm
```

This is identical to the existing `updateFallbacks` / `updateImageFallbacks` pattern.

---

## Design

### 1. Catalog Tab Enhancement — Model Allowlist

**Two modes:**

- **No allowlist** (default): `agents.defaults.models` undefined. All models available. Catalog shows info banner: "All models available — enable allowlist to restrict."
- **Allowlist active**: Once user enables the first model, allowlist mode activates. Disabled models appear dimmed but visible.

**UI changes:**

| Component          | Change                                                       |
| ------------------ | ------------------------------------------------------------ |
| `CatalogTab`       | Top-level toggle: "Model Allowlist: On/Off"                  |
| `ModelDetail`      | "Enabled" toggle switch + expandable params editor           |
| `ProviderOverview` | Enable/disable toggle per model row                          |
| `ProviderList`     | Show "3/12 enabled" badge per provider (allowlist mode only) |

**Toggle interaction:**

- Turning allowlist OFF removes `agents.defaults.models` entirely from config
- Turning allowlist ON shows confirmation dialog warning that only explicitly enabled models will be available; on confirm, auto-populates with current primary + fallback models (from `agents.defaults.model`); on cancel, no change
- Enabling a model adds `"provider/modelId": {}` to the object
- Disabling removes the key

### 2. Per-Model Parameter Editor

Visible in `ModelDetail` when a model is enabled (in allowlist). Two layers:

**Dedicated controls (common params):**

| Parameter                | Control               | Notes                                                                                                                                                                               |
| ------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alias`                  | Text input            | Placeholder: "e.g. opus, sonnet". Maps to `AllowlistEntry.alias`                                                                                                                    |
| `streaming`              | Toggle switch         | Default: true. Maps to `AllowlistEntry.streaming`                                                                                                                                   |
| `thinking.type`          | Dropdown              | "disabled" / "enabled". **Provider-aware:** only shown for models using `anthropic-messages` or `bedrock-converse-stream` API format. Maps to `AllowlistEntry.params.thinking.type` |
| `thinking.budget_tokens` | Slider + number input | Range 1K-100K, shown only when thinking.type=enabled. Maps to `AllowlistEntry.params.thinking.budget_tokens`                                                                        |

**Provider-awareness:** The `thinking.*` controls are Anthropic-specific. For models using other API formats (e.g., `openai-responses`, `google-generative-ai`), these controls are hidden. The model's API format is determined by looking up its provider in the `models` array and checking the provider's `api` field from the catalog data.

**JSON fallback (advanced params):**

- Collapsible "Advanced Parameters" section
- Embedded JSON editor (`<textarea>` + validation)
- Shows full `params` object as JSON (includes `thinking.*` if present)
- Invalid JSON disables save button
- Unrecognized fields in `params` (e.g., provider-specific extensions) are preserved as-is

**Data mapping between controls and store:**

- `alias` and `streaming` are top-level fields on `AllowlistEntry`
- `thinking.*` controls read/write `AllowlistEntry.params.thinking.type` and `AllowlistEntry.params.thinking.budget_tokens`
- Dedicated controls update the JSON editor in real-time (one-way sync: controls → JSON)
- JSON editor is the source of truth for `params`; editing JSON updates `params` as a whole
- When user edits JSON, dedicated controls refresh to reflect new values for known fields
- Unknown fields in `params` (not covered by dedicated controls) are preserved during dedicated-control edits

**Save mechanism:** 500ms debounce auto-save, same as FallbackChain. Timer cleared on component unmount. Writes to `agents.defaults.models["provider/modelId"]` via `config.patch`.

### 3. AddProviderDialog + ConfigForm Extension — Auth Type & Bedrock

**AddProviderDialog additions:**

New "Auth Type" dropdown after API Format:

| Auth Type | Visible Fields                             |
| --------- | ------------------------------------------ |
| `api-key` | Base URL + API Key (existing behavior)     |
| `oauth`   | Base URL + hint "OAuth configured via CLI" |
| `aws-sdk` | Base URL (optional) + no API Key field     |
| `token`   | Base URL + Token input                     |

**`addCustomProvider` rewrite:** The current `addCustomProvider` calls `POST /api/models/config` which does not exist (only GET/PATCH are implemented). Rewrite to use the `config.patch` flow:

1. Read `configRaw` via `fetchFallbacks()` (which calls `config.get`)
2. Parse config, deep-merge new provider into `config.models.providers[name]`
3. PATCH back via `config.patch` with `baseHash`
4. Handle 409 conflict with refetch

**ConfigForm additions:**

- Auth type displayed as read-only label at top (sourced from `authOverview` entry's `auth.type` field, passed as prop from `ProviderConfigTab`)
- oauth providers: OAuth status display (read-only — expiry, refresh status from authOverview)

**Bedrock Discovery — separate global config section:**

`bedrockDiscovery` is a **global** config field at `config.models.bedrockDiscovery`, not per-provider. It is rendered as a dedicated section in `ProviderConfigTab` (below the provider list, or as a collapsible card when no provider is selected):

```
┌─ AWS Bedrock Discovery (Global) ─────┐
│ Enabled:          [toggle]            │
│ Region:           [us-east-1 ▾]       │
│ Provider Filter:  [☑ anthropic]       │
│                   [☑ amazon]          │
│                   [☐ meta]            │
│                   [☐ cohere]          │
│ Refresh Interval: [3600] seconds      │
│ Default Context:  [200000] tokens     │
│ Default Max Out:  [4096] tokens       │
└───────────────────────────────────────┘
```

- Region: text input with common-value dropdown (us-east-1, us-west-2, eu-west-1, ap-northeast-1)
- Provider Filter: checkbox multi-select (anthropic, amazon, meta, cohere, mistral)
- Refresh Interval: number input, default 3600s
- Default Context Window: number input, default 200000
- Default Max Tokens: number input, default 4096

**Store method:** `updateBedrockDiscovery(config: BedrockDiscoveryConfig)` — patches `models.bedrockDiscovery` via the standard config.patch flow.

### 4. Secret Reference Hints

All API Key / Token input fields get helper text below:

```
Supports environment variable references: ${OPENAI_API_KEY}
```

- Styled as `text-xs text-[var(--muted-foreground)]`
- The backend recognizes `${ENV_VAR_NAME}` template syntax (matching `ENV_SECRET_TEMPLATE_RE = /^\$\{([A-Z][A-Z0-9_]{0,127})\}$/`)
- When input value matches `${...}` pattern, show a 🔗 icon indicating "environment variable reference"
- No store changes needed — existing store passes string as-is to backend for secret resolution

### 5. Store Extension

**New types:**

```typescript
export interface AllowlistEntry {
  alias?: string;
  streaming?: boolean;
  params?: Record<string, unknown>;
}
```

**New state:**

```typescript
allowlist: Record<string, AllowlistEntry>; // key = "provider/modelId"
allowlistActive: boolean;
```

**New methods:**

| Method                                                                   | Purpose                         | Config Path                                |
| ------------------------------------------------------------------------ | ------------------------------- | ------------------------------------------ |
| `toggleAllowlist(active: boolean)`                                       | Enable/disable allowlist mode   | Set/delete `agents.defaults.models`        |
| `toggleModelEnabled(ref: string, enabled: boolean)`                      | Enable/disable single model     | Add/remove key in `agents.defaults.models` |
| `updateModelAllowlistEntry(ref: string, entry: Partial<AllowlistEntry>)` | Update alias/streaming/params   | Merge into `agents.defaults.models[ref]`   |
| `updateBedrockDiscovery(config: BedrockDiscoveryConfig)`                 | Edit Bedrock discovery settings | Patch `models.bedrockDiscovery`            |

**Allowlist fetching:** No separate `fetchAllowlist()` method. Extend existing `fetchFallbacks()` to also parse `agents.defaults.models` from the same `config.get` response, populating `allowlist` and `allowlistActive` state. This avoids redundant network requests.

**`addCustomProvider` rewrite:**

The current implementation uses `POST /api/models/config` which does not exist. Rewrite to use the config.patch flow:

```typescript
addCustomProvider: async (params) => {
  const state = get();
  if (!state.configRaw) {
    await get().fetchFallbacks(); // ensure config loaded
  }
  const config = parseConfig(get().configRaw);
  if (!config) return false;

  // Deep-merge new provider into models.providers
  const models = (config.models as Record<string, unknown>) ?? {};
  const providers = (models.providers as Record<string, unknown>) ?? {};
  providers[params.name] = {
    baseUrl: params.baseUrl,
    apiKey: params.apiKey,
    auth: params.auth ?? "api-key",
    api: params.api,
    models: params.models ?? [],
  };

  const updatedConfig = {
    ...config,
    models: { ...models, providers },
  };

  // Standard config.patch flow with hash-based conflict detection
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
  await get().fetchAuthOverview();
  return true;
};
```

All write operations share the same flow: read configRaw → parseConfig → mutate → config.patch(raw, baseHash) → handle 409 conflict → refetch.

---

## File Impact

| Area                        | Files                                                                                                        | Estimated Change                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Store                       | `stores/models.ts`                                                                                           | ~100 lines (types + 5 methods + addCustomProvider rewrite) |
| Catalog allowlist UI        | `catalog/ModelDetail.tsx`, `catalog/ProviderOverview.tsx`, `catalog/ProviderList.tsx`, `tabs/CatalogTab.tsx` | 20-40 lines each                                           |
| Per-model params editor     | **New:** `catalog/ModelParamsEditor.tsx`                                                                     | ~150 lines (provider-aware thinking controls)              |
| Bedrock Discovery section   | **New:** `config/BedrockDiscoveryCard.tsx`                                                                   | ~80 lines                                                  |
| AddProviderDialog extension | `config/AddProviderDialog.tsx`                                                                               | ~40 lines (auth type dropdown)                             |
| ConfigForm extension        | `config/ConfigForm.tsx`                                                                                      | ~20 lines (auth type label)                                |
| ProviderConfigTab           | `tabs/ProviderConfigTab.tsx`                                                                                 | ~15 lines (Bedrock card + auth type prop)                  |
| Secret hints                | `config/AddProviderDialog.tsx`, `config/ConfigForm.tsx`                                                      | ~5 lines each                                              |
| i18n                        | `i18n/zh.json`, `i18n/en.json`                                                                               | ~40 keys                                                   |

**No Gateway RPC changes.** Existing RPCs (`config.get`, `config.patch`, `models.list`, `deck.auth.overview`) fully support all features. The `POST /api/models/config` route is **not needed** — `addCustomProvider` is rewritten to use the PATCH flow.

---

## Out of Scope

- Provider deletion (P2 — requires confirming no active sessions use the provider)
- Provider mode merge/replace toggle (P2)
- Custom headers per provider/model (P2)
- Model compatibility flags editing (P2)
- Usage API route implementation (P2 — needs Gateway-side aggregation RPC)
- Probe advanced parameters (P3)
