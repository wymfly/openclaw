## Context

deck-go Models is the control surface for OpenClaw model provider configuration, but the current implementation is not a stable product contract chain. The frontend panel already combines runtime-visible models, provider auth overview, catalog providers, usage, config save, schema lookup, default badges, provider/model editing, probe, and raw JSON editing. The problem is not that the page has no capability; the problem is that too much product logic lives in a large frontend component that parses and patches raw config directly.

The highest truth for this change is OpenClaw model configuration and Gateway write behavior:

- `src/config/types.models.ts` defines `ModelsConfig`, `ModelProviderConfig`, `ModelDefinitionConfig`, `ModelCompatConfig`, `ModelProviderAuthMode`, and `MODEL_APIS`.
- `src/config/zod-schema.core.ts` defines write validation. Important implementation detail: several `ModelDefinitionConfig` fields that appear required in TypeScript are optional in zod, so existing partial configs must be preserved.
- `src/config/schema.help.ts` and generated schema docs explain operator-facing semantics such as `models.mode`.
- Gateway `config.get` / `config.patch` are the actual write path. There is no upstream Gateway `models.providers.upsert`, `models.mode.set`, or equivalent model-specific write RPC.
- Runtime read capabilities such as `models.configured`, `models.catalog.providers`, `deck.auth.overview`, and `deck.auth.probe` are inventory/probe inputs, not write authority.

deck-go contracts are therefore a product adaptation layer. If existing deck-go DTOs, generated types, mutation metadata, frontend mocks, or panel code disagree with OpenClaw config truth, this change repairs the contract chain before implementation code relies on it.

## Goals / Non-Goals

**Goals:**

- Productize editing of `openclaw.json > models.mode` and `openclaw.json > models.providers` through typed deck-go BFF routes.
- Keep ordinary provider/model CRUD out of frontend raw JSON patching.
- Preserve Gateway `config.patch` semantics: current config read, base hash, minimal merge patch, redacted-value restoration, validation, conflict reporting, and restart behavior.
- Cover the OpenClaw-supported provider/model fields with a clear UI decision matrix while preserving unknown or advanced fields through explicit advanced/raw escape hatches.
- Add service-side impact preview for deleting providers/models and changing catalog mode, backed by a tested reference index derived from config truth.
- Separate mock visual/interaction evidence from real Gateway smoke evidence.
- Rewrite the Models handoff prototype and notes so future frontend work starts from contract truth rather than decorative KPI placeholders.

**Non-Goals:**

- Adding new upstream OpenClaw schema fields such as model rate limits, quotas, or usage caps.
- Adding upstream Gateway model-specific write RPCs.
- Editing owning-module defaults such as `agents.defaults.*` from the Models module. Models may show badges and deep links, but Agents remains the write owner.
- Implementing OAuth runner flows for providers with `auth: "oauth"`.
- Building a secrets control plane or storing secret values. New Models writes may construct/select `SecretRef`; they must not claim to create a durable secret value store unless a separate proposal adds that truth.
- Fully form-editing all `compat` and `request` leaves. This change summarizes them and keeps raw advanced editing as an explicit escape hatch.

## Decisions

### Decision: Use OpenClaw config truth as the contract authority

deck-go SHALL derive writable Models fields from `types.models.ts`, zod schemas, schema help, and Gateway config write semantics. Existing deck-go contracts are allowed to change because they are product-facing adaptations, not source authority.

Rejected: Treat current `DeckGoModelsConfigResponse` or `ModelsPanel.tsx` as the source of truth. That would preserve the raw-heavy implementation and make future UI decisions depend on accidental frontend parsing.

### Decision: Add typed deck-go BFF product routes over Gateway `config.patch`

The proposal names product actions such as provider upsert, model upsert, delete preview, delete commit, and mode set. These are deck-go BFF routes/actions. Their implementation SHALL call Gateway `config.get` to read the current config/hash, build a minimal `models` merge patch, and call Gateway `config.patch`.

Candidate route shape:

- `GET /models/config/detail`
- `POST /models/providers/{providerId}:upsert`
- `POST /models/providers/{providerId}:delete-preview`
- `DELETE /models/providers/{providerId}`
- `POST /models/providers/{providerId}/models/{modelId}:upsert`
- `POST /models/providers/{providerId}/models/{modelId}:delete-preview`
- `DELETE /models/providers/{providerId}/models/{modelId}`
- `POST /models/mode:set`

The exact route paths may be adjusted to match deck-go route conventions during implementation, but the contract MUST keep these product actions typed and MUST mark their Gateway support basis as `config.get` plus `config.patch`, not as new upstream Gateway methods.

Rejected: Add frontend helpers that assemble raw full config JSON for every operation. That hides conflict semantics and duplicates config validation in the UI.

### Decision: Keep raw config save as advanced fallback only

`models.config.save` and `PATCH /models/config` remain available for advanced users and for fields that are not productized in this change. Ordinary create/edit/delete/mode flows SHALL use typed BFF actions.

Rejected: Remove raw editor entirely. `compat` and `request` are large, low-level OpenClaw surfaces that need an escape hatch until they are separately productized.

### Decision: SecretInput is supported broadly, but new UI writes prefer SecretRef

OpenClaw supports `SecretInput = string | SecretRef`. The product rule for new and edited sensitive fields is to write a `SecretRef` object or an accepted template/ref representation, never to reveal or write a new literal secret through normal Models forms. Existing literal values are detected and redacted. Because a reusable deck-go secret-value store is not code truth for this module, inline secret-value creation is not part of this change.

Rejected: Claim `SecretRef-only` is an upstream schema rule. It is a deck-go safety product decision for normal UI writes.

### Decision: Preserve partial model configs

New-model forms can require product-friendly fields such as id/name/input/capacity/cost, but editing an existing model SHALL preserve omitted optional fields instead of silently filling defaults. The BFF writes minimal patches and validates only the changed product inputs.

Rejected: Normalize every existing model to the full TypeScript type shape during save. That can expand user config and alter runtime semantics.

### Decision: Compute delete and mode impact on the service side

The BFF owns `modelReferenceIndex`. It scans OpenClaw config structures for model references and can optionally include runtime/workspace references when safe and available. Delete and mode-change commits re-run the index and compare a preview token or reference hash before mutating config.

The reference source list MUST be implemented from code truth, not from the old design draft. At minimum the implementation must inspect and test:

- `agents.defaults.*` fields that use `AgentModelConfig` or model strings.
- `agents.list[]` model-bearing fields, including subagent, heartbeat, compaction, and memory-search related fields where present.
- `channels.modelByChannel`.
- `hooks.*` model-bearing fields.
- `tools.media.*.models`, `tools.links.models`, `tools.search.embedding.model`, and other model-bearing tool config leaves discovered during implementation.
- Runtime session model overrides only as read-only/degraded impact if they can be accessed safely from the isolated real environment.

Rejected: Rely only on UI type-to-confirm. That confirms operator intent but does not prove the config mutation is safe.

### Decision: Provider catalog and wizard data come from Gateway/BFF projection

The Add Provider wizard SHALL use Gateway `models.catalog.providers` plus BFF projection for known defaults. The frontend must not hardcode a broad commercial provider catalog. If Gateway catalog metadata lacks base URL/auth defaults for a provider, the UI presents it as a custom/catalog entry rather than inventing defaults.

Rejected: Copy a static provider list from an old prototype. It will drift from OpenClaw and upstream provider defaults.

### Decision: Frontend remains Data Fabric based

The frontend data layer already has scoped transports and module query keys. This change extends that layer with Models config-detail queries and typed mutation hooks. Components consume these hooks and product DTOs; they do not call Gateway transport directly or parse full raw config for normal operations.

Rejected: Rewrite the frontend state layer specifically for Models. The project already has a Data Fabric architecture and query invalidation conventions.

## Product Blueprint

The target page is an enterprise control plane, not a decorative dashboard.

- Catalog header: current mode (`merge` / `replace`), configured provider/model counts, runtime inventory status, raw editor link, and Add Provider.
- Provider grouped list: each provider section shows id/display name, config/source status, auth/probe status, model count, and actions.
- Model rows: name/id/provider, capacity (`contextWindow`, `contextTokens`, `maxTokens`), cost (`input`, `output`, cache values in tooltip/detail), input modalities, reasoning, default/reference badges, and health.
- Provider drawer: Overview, Identity, Networking, Models, Advanced.
- Model drawer: Overview, Identity, Capacity, Cost, Networking, Advanced.
- Add Provider wizard: select catalog/custom provider, configure identity/auth ref, select starter models when catalog data supports it, review patch summary.
- Impact preview dialog: lists provider/model/default/tool/hook/channel/session references, severity, and commit guard.
- Type-to-confirm dialog: confirms destructive operations after service impact preview.
- Advanced raw editor: explicitly labeled fallback for low-level config fields and unproductized leaves.

## Data Flow

```text
OpenClaw config types/zod/help
        ↓
Gateway config.get / config.patch and runtime model read/probe RPCs
        ↓
deck-go BFF typed Models routes and DTO projection
        ↓
deck-go contract sources and generated TS/Go artifacts
        ↓
frontend-new Data Fabric queries/mutations and api facades
        ↓
Models product UI, mock fixtures, real smoke fixtures, handoff prototype
```

## Migration Plan

1. Baseline and contract repair: enumerate current OpenClaw model config fields and deck-go drift, update contract sources, regenerate artifacts, and run contract gates.
2. BFF projection and typed write adapter: add detail projection, upsert/delete/mode routes, minimal patch helpers, reference index, and backend tests.
3. Frontend data migration: add typed queries/mutations, route existing panel behavior away from raw save, and preserve raw editor only in advanced flows.
4. Product UI rewrite: split the Models panel into focused components, implement drawers/wizard/dialogs/widgets, update i18n and mocks.
5. Handoff rewrite: update `frontend-handoff/modules/models` to match the new product blueprint and contract chain.
6. Verification: run OpenSpec validation, contract gate, focused backend tests, focused frontend tests, frontend build, mock E2E/visual smoke, and bounded real Gateway smoke with an isolated config/workspace.

Rollback strategy: typed routes and frontend components are additive until the UI switches over. If a typed write path fails validation late, keep raw editor and read-only inventory available, record the failing action as a verification gap, and do not claim product-complete CRUD for that action.

## Risks / Trade-offs

- Reference scanning can miss a config path → mitigate by deriving the path list from config types and requiring fixture tests for every included source.
- `config.patch` merge semantics can surprise frontend assumptions → mitigate by building BFF-level patch helpers and checking before/after hashes in tests.
- Secret handling can overclaim capabilities → mitigate by forbidding inline secret-value store claims and recording secret-store CRUD as a follow-up if needed.
- A full panel rewrite can regress existing useful behavior → mitigate by preserving runtime inventory/auth/catalog/probe/read states through component tests and mock E2E.
- Real smoke can be blocked by environment or credentials → mitigate with a circuit breaker that records bounded evidence and still requires code-level contract/backend/frontend verification.
- Provider catalog metadata can be incomplete → mitigate by showing custom/catalog entries without invented defaults.

## Open Questions

No user decision is required before creating this proposal. Implementation must still verify the exact reference index field list against current OpenClaw config types before writing code. If that verification contradicts this design in a product-significant way, the OpenSpec artifacts must be corrected before completing the affected task.
