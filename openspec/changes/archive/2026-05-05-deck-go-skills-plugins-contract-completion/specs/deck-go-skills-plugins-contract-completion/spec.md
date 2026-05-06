## ADDED Requirements

### Requirement: Skills and Plugins product claims SHALL map to contract truth

Deck Go SHALL ensure visible Skills and Plugins workflows map to current Gateway
support, Deck BFF routes, Deck-facing DTOs, frontend facades, dynamic-surface
metadata, mutation evidence, and evidence status.

#### Scenario: Supported or degraded workflow is exposed

- **WHEN** the UI exposes Skills inventory/config/hub/agent-matrix workflows or
  Plugins inventory/capability/diagnostic workflows
- **THEN** the workflow SHALL have a Gateway support basis, Deck BFF route,
  Deck-facing DTO or explicit dynamic-surface entry, frontend facade, panel
  surface, and evidence status

#### Scenario: Capability is not implemented

- **WHEN** product design wants plugin lifecycle mutations, plugin manifest or
  audit routes, marketplace trust, package signature verification, per-skill
  config schemas, or fixture-safe real skill writes
- **THEN** the capability SHALL remain unsupported, degraded, deferred, or
  skipped-safe until Gateway or Deck contracts and fixtures support it

### Requirement: Skills inventory SHALL use a Deck-facing product DTO

Deck Go SHALL expose Skills inventory to the frontend as `DeckGoSkillEntry[]`
instead of raw Gateway-shaped records.

#### Scenario: Skills inventory is returned

- **WHEN** `/api/skills` returns a Skills inventory response
- **THEN** `DeckGoSkillsResponse.skills` SHALL be an array of
  `DeckGoSkillEntry`
- **AND** each row SHALL include stable product fields for key, name, status,
  source, enabled state, missing requirements, install options, and optional
  display metadata

#### Scenario: Older or raw rows are consumed by frontend code

- **WHEN** frontend normalization receives an older Gateway-shaped skill row
- **THEN** it SHALL still produce a `DeckGoSkillEntry` without requiring browser
  code to call Gateway directly

### Requirement: Skills write actions SHALL be mutation-evidence known

Deck Go SHALL record action-level mutation evidence for production-visible
Skills update/install and Skill Hub install/update workflows.

#### Scenario: Skill config or enabled state is updated

- **WHEN** the frontend calls `PATCH /api/skills/{skillKey}`
- **THEN** the response SHALL use `DeckGoSkillUpdateResponse`
- **AND** mutation evidence for `skills.update` SHALL use route `skillKey` as
  the target id

#### Scenario: Local skill install runs

- **WHEN** the frontend calls `POST /api/skills/install`
- **THEN** the response SHALL use `DeckGoSkillInstallResponse`
- **AND** mutation evidence for `skills.install` SHALL mark `ok=true` as the
  success indicator

#### Scenario: Skill Hub install or update runs

- **WHEN** the frontend calls `/api/skills/hub` with action `install` or
  `update`
- **THEN** the response SHALL use a named Skill Hub mutation DTO
- **AND** mutation evidence SHALL distinguish `skills.hub.install` from
  `skills.hub.update`

### Requirement: Plugins dynamic envelopes SHALL be intentional

Deck Go SHALL keep Plugins inventory as a read-only, typed product surface and
shall not leave accidental dynamic DTO leaves for current Plugins workflows.

#### Scenario: Plugins inventory is inspected

- **WHEN** `/api/deck/plugins` returns plugin inventory
- **THEN** the response SHALL use `DeckGoPluginsListResponse`
- **AND** any open string or extension-owned values SHALL be documented as
  intentional product flexibility rather than accidental unknown records

#### Scenario: Unsupported plugin capability is requested

- **WHEN** product design wants manifest, audit, enable/disable, reload,
  install/uninstall, marketplace trust, or package signature verification
- **THEN** those workflows SHALL remain unsupported or degraded until dedicated
  contracts exist

### Requirement: Skills / Plugins completion SHALL update durable evidence

Deck Go SHALL keep the head contract-chain matrix, generated matrix Markdown,
module handoff notes, dynamic-surface docs, mutation-evidence docs, and head
verification evidence synchronized with this module completion result.

#### Scenario: Child proposal is archived

- **WHEN** this child proposal passes validation and is archived
- **THEN** Skills and Plugins matrix rows SHALL mark the follow-up as archived
- **AND** remaining workspace-write, per-skill config, plugin lifecycle, and
  plugin trust limits SHALL stay visible in matrix gaps and implementation notes
