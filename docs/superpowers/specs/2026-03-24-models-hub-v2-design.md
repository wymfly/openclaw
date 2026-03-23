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
| 5   | Secret reference types ($ENV, $KEYCHAIN, $PASS)            | `types.secrets.ts`        | P1       |
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
- Turning allowlist ON initializes `agents.defaults.models` as `{}` (empty = no models allowed until user enables some)
- Enabling a model adds `"provider/modelId": {}` to the object
- Disabling removes the key

### 2. Per-Model Parameter Editor

Visible in `ModelDetail` when a model is enabled (in allowlist). Two layers:

**Dedicated controls (common params):**

| Parameter                | Control               | Notes                                                |
| ------------------------ | --------------------- | ---------------------------------------------------- |
| `alias`                  | Text input            | Placeholder: "e.g. opus, sonnet"                     |
| `streaming`              | Toggle switch         | Default: true                                        |
| `thinking.type`          | Dropdown              | "disabled" / "enabled"                               |
| `thinking.budget_tokens` | Slider + number input | Range 1K-100K, shown only when thinking.type=enabled |

**JSON fallback (advanced params):**

- Collapsible "Advanced Parameters" section
- Embedded JSON editor (`<textarea>` + validation)
- Shows full `params` object as JSON
- Invalid JSON disables save button

**Sync rules:**

- Dedicated controls update JSON editor in real-time
- JSON editor updates refresh dedicated controls for known fields
- Last-edit-wins on conflict

**Save mechanism:** 500ms debounce auto-save, same as FallbackChain. Writes to `agents.defaults.models["provider/modelId"]` via `config.patch`.

### 3. AddProviderDialog + ConfigForm Extension — Auth Type & Bedrock

**AddProviderDialog additions:**

New "Auth Type" dropdown after API Format:

| Auth Type | Visible Fields                             |
| --------- | ------------------------------------------ |
| `api-key` | Base URL + API Key (existing behavior)     |
| `oauth`   | Base URL + hint "OAuth configured via CLI" |
| `aws-sdk` | Bedrock Discovery config area (no API Key) |
| `token`   | Base URL + Token input                     |

**Bedrock Discovery config area** (shown only when auth=aws-sdk):

- Region: text input with common-value dropdown (us-east-1, us-west-2, eu-west-1, ap-northeast-1)
- Provider Filter: checkbox multi-select (anthropic, amazon, meta, cohere, mistral)
- Refresh Interval: number input, default 3600 seconds

**ConfigForm additions:**

- Auth type displayed as read-only label at top
- aws-sdk providers: Bedrock Discovery settings (editable)
- oauth providers: OAuth status display (read-only — expiry, refresh status from authOverview)

### 4. Secret Reference Hints

All API Key / Token input fields get helper text below:

```
Supports: $ENV_VAR_NAME, $KEYCHAIN:account:user, $PASS:path/entry
```

- Styled as `text-xs text-[var(--muted-foreground)]`
- When input value starts with `$`, show a link icon indicating "reference, not literal"
- No store changes needed — existing store passes string as-is to backend

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

| Method                                                                   | Purpose                       | Config Path                                |
| ------------------------------------------------------------------------ | ----------------------------- | ------------------------------------------ |
| `fetchAllowlist()`                                                       | Parse allowlist from config   | Read `agents.defaults.models`              |
| `toggleAllowlist(active: boolean)`                                       | Enable/disable allowlist mode | Set/delete `agents.defaults.models`        |
| `toggleModelEnabled(ref: string, enabled: boolean)`                      | Enable/disable single model   | Add/remove key in `agents.defaults.models` |
| `updateModelAllowlistEntry(ref: string, entry: Partial<AllowlistEntry>)` | Update alias/streaming/params | Merge into `agents.defaults.models[ref]`   |

**addCustomProvider extension:**

```typescript
addCustomProvider(params: {
  name: string;
  baseUrl?: string;
  apiKey?: string;
  api?: string;
  auth?: string;                    // NEW
  bedrockDiscovery?: {              // NEW
    enabled?: boolean;
    region?: string;
    providerFilter?: string[];
    refreshInterval?: number;
  };
  models?: Array<{...}>;
}) => Promise<boolean>;
```

All write operations share the same flow: read configRaw → parseConfig → mutate → config.patch(raw, baseHash) → handle 409 conflict → refetch.

---

## File Impact

| Area                        | Files                                                                                                        | Estimated Change              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| Store                       | `stores/models.ts`                                                                                           | ~80 lines (types + 4 methods) |
| Catalog allowlist UI        | `catalog/ModelDetail.tsx`, `catalog/ProviderOverview.tsx`, `catalog/ProviderList.tsx`, `tabs/CatalogTab.tsx` | 20-40 lines each              |
| Per-model params editor     | **New:** `catalog/ModelParamsEditor.tsx`                                                                     | ~120 lines                    |
| AddProviderDialog extension | `config/AddProviderDialog.tsx`                                                                               | ~60 lines                     |
| ConfigForm extension        | `config/ConfigForm.tsx`                                                                                      | ~30 lines                     |
| Secret hints                | `config/AddProviderDialog.tsx`, `config/ConfigForm.tsx`                                                      | ~5 lines each                 |
| i18n                        | `i18n/zh.json`, `i18n/en.json`                                                                               | ~30 keys                      |

**No backend changes.** Existing Gateway RPCs (`config.get`, `config.patch`, `models.list`, `deck.auth.overview`) fully support all features.

---

## Out of Scope

- Provider deletion (P2 — requires confirming no active sessions use the provider)
- Provider mode merge/replace toggle (P2)
- Custom headers per provider/model (P2)
- Model compatibility flags editing (P2)
- Usage API route implementation (P2 — needs Gateway-side aggregation RPC)
- Probe advanced parameters (P3)
