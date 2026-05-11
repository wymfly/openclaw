## ADDED Requirements

### Requirement: Agents SHALL own model usage policy editing

The Agents module SHALL provide the product editing surface for model usage policy that affects agent runtime behavior, while Models SHALL remain the provider/model asset owner.

#### Scenario: Model policy ownership is visible

- **WHEN** the Agents model policy surface is rendered
- **THEN** it SHALL identify policy fields as Agents-owned runtime usage policy
- **AND** it SHALL link to Models only for provider/model asset creation, configuration, or repair
- **AND** it SHALL NOT expose a raw `openclaw.json` editor as the normal way to edit model policy.

#### Scenario: Models remains read-only for usage policy

- **WHEN** the operator views model defaults or per-agent references from Models
- **THEN** Models SHALL keep those facts read-only
- **AND** the operator SHALL be directed to Agents for policy editing.

### Requirement: Agents model policy contracts SHALL represent OpenClaw model config truth

Deck-facing Agents model policy DTOs SHALL represent OpenClaw model policy fields as normalized product data, including `AgentModelConfig` string/object forms, string-only model fields, inheritance, unavailable references, and base-hash protected writes.

#### Scenario: AgentModelConfig fields expose primary and fallback chains

- **WHEN** a policy target is backed by `AgentModelConfig`
- **THEN** the contract SHALL expose normalized `primary` and ordered `fallbacks`
- **AND** existing string config such as `"provider/model"` SHALL normalize to `{ primary: "provider/model" }`
- **AND** existing object config such as `{ primary, fallbacks }` SHALL preserve fallback order.

#### Scenario: String-only fields do not expose fallback editing

- **WHEN** a policy target is backed by a string-only config field such as `agents.defaults.compaction.model` or `agents.defaults.memorySearch.model`
- **THEN** the contract and UI SHALL expose primary-only editing
- **AND** they SHALL NOT render a fallback-chain editor for that target.

#### Scenario: Unsupported model-like fields are not editable

- **WHEN** the system encounters a model-like field that is not backed by verified OpenClaw config truth for Agents model policy
- **THEN** it MAY show read-only metadata or a deferred note
- **AND** it SHALL NOT expose an editor that appears to save successfully.

### Requirement: Global role defaults SHALL be productized from supported OpenClaw fields

Agents SHALL expose supported global role defaults from `agents.defaults.*` as model policy targets, preserving each target's config path and supported shape.

#### Scenario: Supported role defaults are listed

- **WHEN** the model policy surface loads
- **THEN** it SHALL include supported defaults for text, image input, image generation, video generation, music generation, PDF, compaction, memory search, and subagents where those fields exist in current OpenClaw config truth
- **AND** each role SHALL name its config path and whether fallback chains are supported.

#### Scenario: Role default is saved with base hash

- **WHEN** the operator edits a supported global role default
- **THEN** the write SHALL include the target role/path, normalized selection or clear action, and current base hash
- **AND** stale base hash conflicts SHALL be reported without silently overwriting newer config.

### Requirement: Per-agent model policies SHALL support inherit and override

Agents SHALL let operators inspect and edit per-agent model policy without losing inheritance from global defaults.

#### Scenario: Agent inherits default policy

- **WHEN** `agents.list[].model` is absent for the selected agent
- **THEN** the UI SHALL show that the agent inherits the global text default
- **AND** it SHALL display the effective primary/fallback policy when available.

#### Scenario: Agent override is saved

- **WHEN** the operator saves an explicit per-agent model policy
- **THEN** the write SHALL update only the selected `agents.list[].model` target
- **AND** the saved policy SHALL support primary plus fallback chain when the selected target uses `AgentModelConfig`.

#### Scenario: Agent override is cleared

- **WHEN** the operator chooses to inherit the default again
- **THEN** the write SHALL remove the selected per-agent override
- **AND** the UI SHALL return to inherited/default source labeling after refresh.

### Requirement: Subagent model policy SHALL preserve global and per-agent semantics

Agents SHALL expose subagent model policy for global defaults and per-agent overrides without confusing it with subagent runtime monitoring.

#### Scenario: Global subagent default is editable

- **WHEN** the operator edits `agents.defaults.subagents.model`
- **THEN** the UI SHALL treat it as the default model policy for spawned subagents
- **AND** it SHALL support primary and fallback chain because the field uses `AgentModelConfig`.

#### Scenario: Per-agent subagent override is editable

- **WHEN** the operator edits `agents.list[].subagents.model`
- **THEN** the UI SHALL show whether the selected agent inherits the global subagent default or overrides it
- **AND** save/clear behavior SHALL affect only that selected agent's subagent model policy.

### Requirement: Unavailable model references SHALL be preserved and explained

Agents SHALL preserve existing model references that are not currently present in configured provider/model assets and SHALL explain how to repair them.

#### Scenario: Existing unavailable reference is displayed

- **WHEN** a policy contains a primary or fallback reference missing from configured model choices
- **THEN** the UI SHALL display the reference as unavailable
- **AND** it SHALL keep the reference in the draft unless the operator explicitly removes or replaces it.

#### Scenario: New model selection prefers configured assets

- **WHEN** configured model choices are available
- **THEN** new primary and fallback selections SHALL be chosen from configured assets by default
- **AND** freeform/manual entry SHALL only appear as a labeled degraded or advanced fallback state.

### Requirement: Model policy edits SHALL be guarded high-impact mutations

Agents SHALL treat model policy changes as high-impact runtime edits with confirmation, protected-agent copy, conflict handling, and reversible draft behavior.

#### Scenario: Main agent policy edit is guarded

- **WHEN** the selected agent id is `main` and the operator edits model policy
- **THEN** the UI SHALL state that the change affects the protected system/fallback agent
- **AND** it SHALL require an explicit confirmation before submitting the save.

#### Scenario: Non-main policy edit shows runtime impact

- **WHEN** the selected agent is not `main` and the operator edits model policy
- **THEN** the UI SHALL still show runtime-impact copy covering cost, capability, fallback, and availability effects
- **AND** it SHALL require an explicit save action rather than casual inline persistence.

#### Scenario: Conflict preserves local draft

- **WHEN** a model policy save fails because the config base hash is stale
- **THEN** the UI SHALL keep the user's draft values
- **AND** it SHALL present a recoverable conflict/degraded state.

### Requirement: Verification SHALL prove model policy contract and product behavior

The change SHALL include verification that proves contract-chain correctness, UI behavior, and real Gateway read/write safety for model policy.

#### Scenario: Contract and backend verification run

- **WHEN** implementation is ready for review
- **THEN** contract/protocol generation and checks SHALL pass for changed DTOs and Gateway methods
- **AND** focused Gateway or Go backend tests SHALL prove normalized string/object policy reads, base-hash conflict rejection, supported target writes, and unsupported target rejection.

#### Scenario: Frontend and mock verification run

- **WHEN** frontend implementation is ready for review
- **THEN** focused tests and mock E2E SHALL cover inherit, override, fallback ordering, unavailable references, protected `main`, string-only targets, empty configured choices, dark/light mode, and Chinese/English states where practical.

#### Scenario: Real Gateway verification is bounded and isolated

- **WHEN** real Gateway verification runs
- **THEN** it SHALL use the isolated real-stack config/workspace
- **AND** it SHALL perform only reversible model-policy fixture edits or safe read/negative checks
- **AND** any environment blocker after bounded attempts SHALL be recorded with evidence instead of silently replacing real evidence with mock evidence.
