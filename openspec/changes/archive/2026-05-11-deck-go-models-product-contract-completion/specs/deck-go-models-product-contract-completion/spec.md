## ADDED Requirements

### Requirement: Models SHALL expose a typed-only product surface

The Models module SHALL present provider/model asset management through typed BFF-backed controls and SHALL NOT expose a Models-page raw JSON editor as the normal product fallback.

#### Scenario: Models page renders normal actions

- **WHEN** the Models page header and drawers are rendered
- **THEN** the UI SHALL expose typed actions for refresh, add provider, edit provider, add model, edit model, impact check, and delete
- **AND** it SHALL NOT expose an "advanced raw editor" action, raw JSON textarea, or copy that tells operators to use raw JSON to complete a Models workflow.

#### Scenario: Unsupported technical leaves are present

- **WHEN** provider `request`, provider/model headers, model `compat`, or another unsupported typed leaf is present in current config
- **THEN** Models SHALL display read-only summaries or explicit deferred/follow-up language
- **AND** it SHALL NOT claim that the leaf can be safely edited through Models unless a typed contract and verification exist.

### Requirement: Models SHALL distinguish model capabilities from model usage policy

The Models module SHALL treat `models.providers.*.models[].input` as model asset input capability and SHALL treat `agents.defaults.*` / per-agent model references as model usage policy.

#### Scenario: Model capabilities are edited

- **WHEN** the operator edits a model entry
- **THEN** the model input controls SHALL only offer OpenClaw-supported model input modalities from the model config schema
- **AND** the UI SHALL NOT add role defaults such as PDF, summary, compaction, memory search, media generation, or subagents as model input modality checkboxes.

#### Scenario: Role defaults are displayed

- **WHEN** `DeckGoModelsConfigDetail.defaults` contains role defaults for text, image, image generation, video generation, music generation, PDF, summary, compaction, memory search, or subagents
- **THEN** Models SHALL display those entries as read-only usage-policy facts with available primary model and fallback information
- **AND** the copy SHALL identify Agents as the owner for policy editing where the role comes from `agents.defaults` or per-agent policy.

### Requirement: Agents model-policy handoff SHALL be durable

The Models completion work SHALL leave a durable handoff for the upcoming Agents module convergence covering the exact model-policy fields that Models displays but does not edit.

#### Scenario: Models convergence completes

- **WHEN** this change is marked complete
- **THEN** `openspec/follow-ups/2026-05-09-agents-model-policy-redesign-handoff.md` SHALL name the OpenClaw source fields, product decisions, and acceptance hints for editing default model, per-agent primary/fallback, role defaults, and subagent model policy in Agents.

#### Scenario: Future Agents work begins

- **WHEN** the Agents module convergence uses the Models handoff
- **THEN** it SHALL be able to distinguish model asset ownership in Models from model strategy ownership in Agents without rediscovering the OpenClaw config boundary.
