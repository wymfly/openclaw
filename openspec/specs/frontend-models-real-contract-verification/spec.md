# frontend-models-real-contract-verification Specification

## Purpose

TBD - created by archiving change frontend-models-real-contract-verification. Update Purpose after archive.

## Requirements

### Requirement: Models contract chain is verified before completion

The Models implementation SHALL be reviewed against the full Deck Models DTO, usage DTO, generated Gateway method, Go BFF/runtime route, endpoint classification, UI metadata, frontend wrapper, mock fixture, visual E2E, and real-stack evidence chain before this change is marked complete.

#### Scenario: Contract chain matrix is recorded

- **WHEN** the Models module is implemented or reviewed
- **THEN** the handoff notes SHALL record the workflow-to-contract matrix for config read, config save, schema lookup, runtime inventory, auth overview, catalog providers, auth probe, usage cost, usage provider pressure, provider config edits, catalog add, fallback chain edits, allowlist edits, Bedrock discovery edits, refresh, empty/error states, projected pricing, projected audit history, and BFF-only browser behavior
- **AND** every workflow SHALL be classified as supported, degraded, unsupported, environment-dependent, empty-valid, skipped-safe, or handoff-blocked
- **AND** stale prototype route, method, DTO, usage alias, pricing, audit, or probe-cache assumptions SHALL be corrected or explicitly recorded as stale

### Requirement: Models production behavior stays contract-backed

The production Models panel SHALL expose only behavior backed by current Deck-facing DTOs, frontend wrappers, Go BFF/runtime routes, generated Gateway methods, or documented Deck projections.

#### Scenario: Route and method truth is used

- **WHEN** Models handoff, frontend, backend, tests, or docs describe the contract chain
- **THEN** they SHALL name `fetchModelsConfig`, `saveModelsConfig`, `lookupConfigPath`, `fetchRuntimeConfiguredModels`, `fetchRuntimeModelAuthOverview`, `fetchRuntimeModelCatalogProviders`, `probeRuntimeModelAuth`, `fetchModelUsageCost`, and `fetchModelUsageProviders` as the production wrapper truth
- **AND** they SHALL use `models.configured`, `deck.auth.overview`, `models.catalog.providers`, and `deck.auth.probe` for upstream method truth
- **AND** they SHALL use `/models/config` for raw Models config mutation and `/usage/cost` plus `/usage/providers` as the canonical frontend usage route truth
- **AND** they SHALL distinguish `/models/usage/cost` and `/models/usage/providers` as compatibility aliases rather than the canonical frontend route unless implementation is intentionally changed and verified

#### Scenario: Raw config mutations are safety gated

- **WHEN** the Models panel exposes provider config edits, catalog add, default model changes, fallback edits, allowlist edits, Bedrock discovery edits, or other model config mutations
- **THEN** it SHALL update the raw config draft and submit through `PATCH /models/config`
- **AND** it SHALL submit the current base hash when available
- **AND** it SHALL render parse errors, BFF errors, 409-style drift, and missing hash states without breaking the rest of the panel
- **AND** it SHALL refresh or preserve enough visible config state after failed mutations so the operator can recover without silent data loss

#### Scenario: Projected or unsupported workflows are handled

- **WHEN** the refreshed handoff references pricing snapshots, PATCH audit history, force probe cache controls, richer provider-specific settings, inline fallback reorder, bulk import, streaming usage tiles, or per-model rate-limit overrides
- **THEN** production SHALL keep those workflows disabled, read-only, omitted, degraded, or recorded as unavailable unless verified in code and tests
- **AND** production SHALL NOT claim those workflows as real Gateway guarantees

### Requirement: Models has mock visual evidence

The Models implementation SHALL include L1 mock visual verification through the real frontend API path and contract-shaped model, auth, catalog, usage, and config data.

#### Scenario: Mock visual E2E verifies interaction states

- **WHEN** the Models mock visual E2E runs
- **THEN** it SHALL render the production Models panel with contract-shaped config, runtime inventory, auth overview, catalog providers, usage cost, usage provider pressure, and probe-capable mock data
- **AND** it SHALL verify ready state plus at least two interaction states among provider config, fallback chain, catalog selection, usage pressure, probe result, schema lookup, raw config save, or empty/error handling
- **AND** closeout evidence SHALL label the test as mock visual coverage rather than real Gateway/LLM, real provider billing, real auth, or production audit assurance

### Requirement: Models has bounded real-stack evidence

The Models implementation SHALL include bounded L2 real-stack verification for the Models BFF and runtime Gateway contract chain.

#### Scenario: Real stack exposes Models route and RPC shapes

- **WHEN** the real stack is available
- **THEN** the test SHALL verify runtime readiness and safe response shapes for `/models/config`, runtime `models.configured`, `deck.auth.overview`, `models.catalog.providers`, canonical usage routes, and the production Models UI
- **AND** the production Models UI SHALL render against the real BFF without browser-side direct Gateway calls
- **AND** empty runtime inventory, missing catalog entries, missing auth providers, or no usage data SHALL be recorded as empty-valid or degraded when the route shape is correct

#### Scenario: Real stack verifies safe mutation and probe only when safe

- **WHEN** the real stack exposes a usable config hash, controlled draft mutation, and provider/probe path that can be exercised without harming operator state
- **THEN** the test SHALL submit bounded config save or probe checks through the current frontend/BFF contract
- **AND** the test SHALL record pass, degraded, skipped-safe, or handoff-blocked evidence after at most three fresh attempts
- **AND** no real provider key rotation, unsafe model default change, or unsupported Gateway workflow SHALL be used solely for verification

#### Scenario: Real Models verification is unsafe or unavailable

- **WHEN** real stack startup fails, runtime Gateway methods are unavailable, provider auth is missing, usage data is empty, config mutation would affect uncontrolled operator state, or route shape is otherwise environment-blocked
- **THEN** the implementation SHALL record the blocker as degraded, skipped-safe, empty-valid, or handoff-blocked evidence
- **AND** static review, focused tests, BFF route-shape review, mock visual evidence, and build/contract checks SHALL still be completed before moving to the next module

### Requirement: Models deterministic drift is fixed directly

Clear Models-scoped issues found during explore or verification SHALL be fixed directly when the fix is low-risk and evidence-backed.

#### Scenario: Deterministic drift is found

- **WHEN** contract, backend, frontend, mock, i18n, handoff, UI metadata, endpoint classification, or test drift is discovered and no material product ambiguity exists
- **THEN** the implementation SHALL fix the drift in the source-owned layer
- **AND** focused regression evidence SHALL be added or refreshed
