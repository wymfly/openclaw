## ADDED Requirements

### Requirement: Models completion SHALL distinguish asset editing from policy editing

Models contract completion SHALL treat provider/model asset configuration, model usage inspection, and agent model-policy editing as separate capabilities with explicit owner boundaries.

#### Scenario: Provider or model asset is edited

- **WHEN** the operator creates, edits, or deletes provider/model config owned by `models.providers`
- **THEN** Models SHALL use typed Models BFF actions and normal Models verification evidence.

#### Scenario: Agent model policy is displayed

- **WHEN** Models displays references from `agents.*`
- **THEN** those references SHALL be read-only usage/impact information unless a separate owner-approved Agents policy editor is implemented.

#### Scenario: Agent model policy is deferred

- **WHEN** full default/fallback editing remains out of scope for Models
- **THEN** completion evidence SHALL include a handoff to the Agents redesign rather than marking the policy editor complete.

### Requirement: Models handoff SHALL mark stale prototype assumptions

Models handoff artifacts SHALL identify which older prototype assumptions are active, stale, deferred, or superseded by OpenClaw contract truth.

#### Scenario: Old prototype includes fallback editing

- **WHEN** an older Models prototype shows "Set default", "Add fallback", or fallback-chain editing
- **THEN** handoff documentation SHALL classify that behavior as Agents-owned or deferred unless the current change implements a verified product contract for it.

#### Scenario: Old prototype includes unsupported metrics or audit claims

- **WHEN** an older Models prototype shows pricing snapshots, audit history, quota/rate-limit, or probe-cache controls without current contract truth
- **THEN** handoff documentation SHALL mark those items unsupported/deferred rather than production-ready.

### Requirement: Models completion SHALL include product-semantics evidence

Models completion evidence SHALL prove that product wording and visible actions no longer force operators to reason in raw implementation terms for common flows.

#### Scenario: Product UI evidence is collected

- **WHEN** frontend verification is run
- **THEN** evidence SHALL cover common provider/model asset workflows using product labels for impact checks, delete confirmation, catalog policy, and owner-module handoff.

#### Scenario: Raw primitive remains visible

- **WHEN** a raw primitive such as `merge`, `replace`, base hash, or config path remains visible
- **THEN** it SHALL be secondary technical detail, advanced-only copy, or diagnostic evidence rather than the main user-facing decision label.
