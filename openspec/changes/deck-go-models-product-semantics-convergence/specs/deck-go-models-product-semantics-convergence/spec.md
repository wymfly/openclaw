## ADDED Requirements

### Requirement: Models UI SHALL use product semantics for model asset operations

The Models control plane SHALL present provider/model management as product operations over model assets and catalog policy, not as raw OpenClaw implementation primitives.

#### Scenario: Catalog mode is shown

- **WHEN** the Models page renders `models.mode`
- **THEN** the UI SHALL describe it as catalog sync policy or equivalent product language
- **AND** raw `merge` / `replace` labels MAY appear only as secondary technical detail or advanced copy.

#### Scenario: Destructive action is started

- **WHEN** an operator starts deleting a provider or model
- **THEN** the UI SHALL frame the first step as checking impact or reviewing affected usage
- **AND** the final destructive action SHALL remain a separate confirm step after service-side impact evidence is available.

#### Scenario: Provider id collision is detected

- **WHEN** an operator adds or imports a provider id that already exists
- **THEN** the UI SHALL offer product choices such as edit existing, choose another id, or replace after impact review
- **AND** it SHALL not expose a raw "merge versus overwrite" decision without explaining the affected provider/model configuration.

### Requirement: Models SHALL show usage/default/fallback facts without owning Agents policy editing

The Models control plane SHALL display where configured models are used, including default and fallback roles, while preserving Agents as the primary owner of agent model strategy edits.

#### Scenario: Model has agent usage

- **WHEN** a model is referenced by `agents.defaults`, `agents.list`, or subagent model configuration
- **THEN** Models SHALL show the owning path, owner type, and role when known
- **AND** it SHALL provide an owner-module affordance or deferred-state explanation rather than silently hiding the reference.

#### Scenario: Operator wants to edit an agent default or fallback chain

- **WHEN** the operator tries to change an agent default model, per-agent primary model, per-agent fallback chain, or subagent model default from Models
- **THEN** Models SHALL route the operator to the Agents owner surface or mark the edit as pending Agents redesign
- **AND** it SHALL not present Models as the canonical editor for those `agents.*` policy fields.

#### Scenario: Raw editor is used for deferred policy editing

- **WHEN** an operator needs to manually change default/fallback policy before the Agents editor exists
- **THEN** the advanced raw editor MAY remain available
- **AND** the UI SHALL identify it as an advanced escape hatch, not as the product-complete policy editor.

### Requirement: Agents model-policy handoff SHALL be durable

The change SHALL create or update a follow-up record for the Agents redesign that captures model-policy editing requirements discovered during Models convergence.

#### Scenario: Follow-up is recorded

- **WHEN** this change is ready for closure
- **THEN** `openspec/follow-ups/` SHALL contain a tracked Agents model-policy handoff
- **AND** the handoff SHALL name `agents.defaults.model`, supported role defaults, per-agent `model`, subagent `model`, primary/fallback object shape, owner-boundary decisions, and acceptance hints.

#### Scenario: Agents redesign starts later

- **WHEN** a future Agents redesign proposal is created
- **THEN** it SHALL be able to use the handoff as an input without rediscovering the Models/Agents model ownership boundary.

### Requirement: Product semantics verification SHALL cover copy and owner boundaries

Models product-semantics changes SHALL include evidence that visible UI copy, owner boundaries, and usage states match the accepted design.

#### Scenario: Mock UI verification runs

- **WHEN** mock/component or browser verification runs for Models
- **THEN** it SHALL cover the catalog policy label, impact-check delete flow, usage/default/fallback display, and owner/deferred edit affordance.

#### Scenario: Implementation is reviewed

- **WHEN** the change is reviewed before archival
- **THEN** the review SHALL check that Models does not claim to edit unsupported agent model-policy fields
- **AND** any remaining ambiguous ownership item SHALL be recorded as a follow-up.
