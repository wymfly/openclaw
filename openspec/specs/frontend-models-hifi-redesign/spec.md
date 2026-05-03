# frontend-models-hifi-redesign Specification

## Purpose

TBD - created by archiving change frontend-models-hifi-contract-redesign. Update Purpose after archive.

## Requirements

### Requirement: Models handoff package defines the visual contract

The Models module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/models/` before the production UI rewrite is marked complete. The package SHALL use the current Deck-facing config, Gateway model/auth/catalog, and usage DTOs/routes as source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the Models handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** unsupported or uncertain model, auth, catalog, usage, or config behavior SHALL be documented as discrepancy notes or open questions rather than guaranteed UI behavior
- **AND** runtime inventory, provider auth, catalog discovery, provider config editing, fallback chains, allowlist controls, usage evidence, schema lookup, save, and probe behavior SHALL be documented explicitly

### Requirement: Models production panel follows contract-backed workflows

The production Models panel SHALL render and operate from contract-backed model config, runtime model inventory, auth overview, catalog providers, usage cost, provider pressure, schema lookup, save, and probe workflows while preserving the existing panel registry and API facade boundaries.

#### Scenario: Models data is loaded

- **WHEN** model config, runtime configured models, auth overview, catalog providers, usage cost, and usage provider pressure resolve
- **THEN** the panel SHALL show runtime inventory, provider groupings, auth health, catalog provider evidence, global provider config evidence, default/fallback chains, allowlist state, usage cost, and provider pressure
- **AND** missing optional fields SHALL render as unavailable, empty, or omitted rather than fabricated values

#### Scenario: Provider config is edited

- **WHEN** an operator edits provider fields, headers, models, Bedrock discovery, or catalog mode
- **THEN** the panel SHALL update the raw config draft without bypassing the current `/models/config` save contract
- **AND** save SHALL continue to submit the raw draft with the current base hash

#### Scenario: Catalog and fallback workflows are used

- **WHEN** an operator applies a catalog provider, selects catalog models, changes default text/image model chains, reorders fallback models, or toggles allowlist entries
- **THEN** the panel SHALL preserve existing mutation semantics for `models.providers` and `agents.defaults`
- **AND** unsupported or unavailable model refs SHALL remain visible as unavailable rather than being silently removed

#### Scenario: Auth probe is run

- **WHEN** an operator probes a provider
- **THEN** the panel SHALL call the existing `probeRuntimeModelAuth` wrapper
- **AND** it SHALL render the probe result and refreshed auth overview without direct browser-to-Gateway RPC

### Requirement: Models UI aligns with the settled frontend design system

The Models panel SHALL use the chat/agents/routing/subagents/logs/settings/sessions/channels/gateway design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms are not yet justified.

#### Scenario: Models UI is rendered

- **WHEN** the Models panel is rendered with contract-shaped mock data
- **THEN** the first viewport SHALL expose model readiness, provider/auth health, runtime inventory, catalog/config/fallback/usage navigation, and primary save/refresh affordances without overlapping text or nested decorative cards
- **AND** raw config editing SHALL remain available without dominating the first viewport

### Requirement: Models mock visual verification is available

The Models rewrite SHALL include focused mock visual verification that exercises the real frontend against contract-shaped config, model inventory, auth, catalog, and usage data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the Models mock visual E2E is executed
- **THEN** it SHALL load Models data through the frontend API path
- **AND** it SHALL capture or assert the ready workbench state and at least two interaction states such as provider config, fallback chain, catalog selection, usage pressure, or probe result
- **AND** closeout evidence SHALL label the test as mock visual coverage, not real Gateway/LLM E2E

### Requirement: Models mock Gateway supplies model contract data

The bundled mock Gateway SHALL provide contract-shaped model/auth/catalog responses needed by the Models visual workflow when those responses are not already available.

#### Scenario: Mock Gateway serves Models RPC

- **WHEN** frontend code requests `models.configured`, `deck.auth.overview`, `models.catalog.providers`, or `deck.auth.probe` through the Deck BFF mock stack
- **THEN** the mock Gateway SHALL return payloads compatible with the generated Gateway and Deck-facing DTOs
- **AND** mock-only fields SHALL not be treated as real Gateway guarantees in handoff documentation
