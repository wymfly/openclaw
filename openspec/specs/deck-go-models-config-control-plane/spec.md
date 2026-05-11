# deck-go-models-config-control-plane Specification

## Purpose

TBD - created by archiving change deck-go-models-config-control-plane. Update Purpose after archive.

## Requirements

### Requirement: Models control plane SHALL follow OpenClaw config truth

The Models control plane SHALL treat OpenClaw model config types, zod validation, schema help, and Gateway config write semantics as the source of truth for writable model provider behavior.

#### Scenario: Writable field is exposed

- **WHEN** the Models UI or BFF exposes a writable provider/model field
- **THEN** that field SHALL trace to `src/config/types.models.ts`, `src/config/zod-schema.core.ts`, `src/config/schema.help.ts`, or another verified OpenClaw config authority
- **AND** the implementation SHALL not invent unsupported fields such as rate limits, quotas, or OAuth runner settings.

#### Scenario: deck-go contract drift is found

- **WHEN** an existing deck-go DTO, mutation contract, generated type, mock, or frontend field conflicts with OpenClaw config truth
- **THEN** the change SHALL repair the deck-go contract chain before relying on that field in BFF or frontend implementation.

#### Scenario: Unsupported product idea is identified

- **WHEN** a desired UI behavior depends on OpenClaw schema or Gateway behavior that does not exist
- **THEN** it SHALL be omitted, marked unsupported, or recorded as a follow-up rather than being simulated as a production capability.

### Requirement: Models typed product contract SHALL cover config detail and actions

Deck-go SHALL expose typed product contracts for Models config detail, provider/model upsert, provider/model delete preview, provider/model delete commit, and model catalog mode updates.

#### Scenario: Contract source is updated

- **WHEN** the typed Models actions are introduced
- **THEN** `deck-go/contracts/source/*` SHALL define request DTOs, response DTOs, endpoint metadata, mutation evidence metadata, owner module, Gateway support basis, and conflict behavior
- **AND** generated TypeScript and Go artifacts SHALL be synchronized.

#### Scenario: Runtime read data is combined with config detail

- **WHEN** the frontend requests Models config detail
- **THEN** the deck-go BFF SHALL project authored config, base hash, runtime catalog/auth/probe summaries where available, redacted sensitive status, and advanced-field summaries without exposing literal secret values.

### Requirement: Models typed writes SHALL use Gateway config get and patch

All ordinary Models config writes SHALL be implemented by deck-go BFF routes that read current Gateway config, build a minimal `models` merge patch, and forward the write through Gateway `config.patch`.

#### Scenario: Provider or model is upserted

- **WHEN** a provider or model upsert is submitted through the normal UI
- **THEN** the frontend SHALL call a typed BFF action
- **AND** the BFF SHALL use `config.get` plus `config.patch` with an expected base hash
- **AND** the frontend SHALL not assemble or submit a raw full config document for that operation.

#### Scenario: Base hash conflict occurs

- **WHEN** Gateway rejects a typed Models write because config changed
- **THEN** deck-go SHALL preserve local edits, expose a stable conflict/degraded state, and avoid silently overwriting newer config.

#### Scenario: Idempotency or audit is unavailable

- **WHEN** a typed Models write path lacks code truth for idempotency, rollback, or durable audit
- **THEN** the contract metadata and UI copy SHALL mark that behavior unsupported or deferred instead of claiming it exists.

### Requirement: Provider and model lifecycle SHALL preserve OpenClaw semantics

The product UI and BFF SHALL support provider/model lifecycle operations while preserving OpenClaw validation, optionality, and advanced-field boundaries.

#### Scenario: Provider fields are edited

- **WHEN** a provider is created or edited
- **THEN** deck-go SHALL support product controls for typed provider fields that are safe and supported by the current contract, including `baseUrl`, `apiKey`, `auth`, `api`, `authHeader`, `injectNumCtxForOpenAICompat`, and contained `models`
- **AND** provider `headers` and `request` SHALL remain read-only summaries or explicit follow-ups unless separately productized through typed, secret-safe controls.
- **AND** the Models UI SHALL NOT route the operator to a Models-page raw editor as the way to edit unsupported provider leaves.

#### Scenario: Model fields are edited

- **WHEN** a model is created or edited
- **THEN** deck-go SHALL support product controls for supported model fields including `id`, `name`, `api`, `reasoning`, `input`, `cost`, `contextWindow`, `contextTokens`, and `maxTokens`
- **AND** `input` SHALL remain limited to the OpenClaw model input modalities accepted by the config schema
- **AND** model `headers` and `compat` SHALL remain read-only summaries or explicit follow-ups unless separately productized through typed controls.
- **AND** the Models UI SHALL NOT route the operator to a Models-page raw editor as the way to edit unsupported model leaves.

#### Scenario: Existing partial config is saved

- **WHEN** an existing provider/model omits fields that zod treats as optional
- **THEN** deck-go SHALL preserve omitted fields unless the operator explicitly edits them
- **AND** it SHALL not silently expand authored config to frontend defaults.

### Requirement: SecretInput handling SHALL be safe and truthful

Deck-go SHALL distinguish OpenClaw `SecretInput` schema truth from product safety policy and SHALL not expose or invent secret-value storage behavior.

#### Scenario: New sensitive value is edited

- **WHEN** the operator edits provider `apiKey` or provider `headers` through normal Models forms
- **THEN** the UI SHALL write a `SecretRef` or verified ref/template representation
- **AND** it SHALL not display or submit a new literal secret value through the normal form.

#### Scenario: Existing literal secret is read

- **WHEN** authored config contains a literal SecretInput string
- **THEN** deck-go SHALL display only redacted status and replacement guidance
- **AND** it SHALL not claim to migrate the secret into a durable secret store unless a verified secret-store write path exists.

### Requirement: Destructive and mode-changing actions SHALL have service-side impact guardrails

Deck-go SHALL require BFF-computed impact previews before deleting providers/models or switching catalog mode in a way that can remove available providers.

#### Scenario: Delete preview is requested

- **WHEN** the operator starts deleting a provider or model
- **THEN** the BFF SHALL compute a reference impact preview from a tested `modelReferenceIndex`
- **AND** the UI SHALL present affected defaults, agents, hooks, channels, tools, sessions when available, severity, and a confirmation guard before commit.

#### Scenario: Delete commit is submitted

- **WHEN** the operator commits a provider/model delete
- **THEN** the BFF SHALL re-run the reference scan and compare the preview token or reference hash
- **AND** stale previews SHALL be rejected with a recoverable conflict/degraded response.

#### Scenario: Mode is switched to replace

- **WHEN** the operator changes `models.mode` from merge to replace
- **THEN** the UI SHALL require a BFF dry-run impact preview before commit
- **AND** the BFF SHALL base unavailable-provider impact on Gateway/BFF catalog/config truth rather than frontend hardcoded provider lists.

### Requirement: Frontend Models UI SHALL use Data Fabric and product components

The frontend Models module SHALL consume typed Models data through Data Fabric queries/mutations and SHALL present a design-system-aligned product UI.

#### Scenario: Normal UI renders configured models

- **WHEN** the Models page loads
- **THEN** it SHALL render a catalog header, provider-grouped list, model rows, provider/model drawers, add-provider wizard, usage-policy overview, and impact dialogs from typed DTOs
- **AND** loading, error, true-empty, filtered-empty, stale-data, and degraded states SHALL be explicit.

#### Scenario: Normal UI mutates model config

- **WHEN** the operator creates, edits, deletes, or changes mode from the product UI
- **THEN** the component SHALL call typed model mutation hooks/facades
- **AND** raw config save SHALL NOT appear as a Models-page product action.

### Requirement: Verification SHALL separate mock, contract, build, and real evidence

This change SHALL not treat mock UI evidence as proof of real Gateway correctness or real Gateway smoke as proof of visual/product completeness.

#### Scenario: Mock verification is run

- **WHEN** mock/component/visual E2E verification runs
- **THEN** it SHALL cover product UI flows, edge states, and design-system behavior using deterministic fixtures.

#### Scenario: Real Gateway verification is run

- **WHEN** real Gateway smoke verification runs
- **THEN** it SHALL use an isolated config/workspace, perform only reversible provider/model mutations, clean up test data, and record bounded circuit-breaker evidence for environment-blocked steps.

#### Scenario: Final validation is claimed

- **WHEN** the change is ready to archive
- **THEN** OpenSpec strict validation, relevant deck-go contract/build/backend/frontend checks, mock evidence, real safe-smoke evidence or handoff, and scenario-level verification status SHALL be fresh and recorded.
