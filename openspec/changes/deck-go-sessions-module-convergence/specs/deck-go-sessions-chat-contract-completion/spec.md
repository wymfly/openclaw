## ADDED Requirements

### Requirement: Sessions module convergence starts from refreshed contract truth

Deck Go SHALL refresh the Sessions workflow-to-contract matrix before changing
the production Sessions product surface for this module convergence pass.

#### Scenario: Sessions capability matrix is refreshed

- **WHEN** this change enters implementation
- **THEN** the implementation SHALL inspect current Gateway generated methods,
  Deck BFF routes, Deck-facing DTOs, frontend API facades, production Sessions
  code, mock fixtures, real E2E specs, and Sessions handoff notes
- **AND** it SHALL classify visible Sessions workflows as supported, degraded,
  projected, unsupported, skipped-safe, empty-valid, adjacent-owned,
  product-local, or handoff-blocked
- **AND** the classification SHALL cover inventory, previews, detail, chat
  history/cache, transcript export, usage/context, usage logs, compaction
  list/branch/restore, lineage, parent/child navigation, reset, clear, patch,
  compact, delete, BFF-only browser access, and projected live refresh or
  server-side pagination
- **AND** the classification SHALL identify Gateway-supported but currently
  BFF/product-unsurfaced parameters such as extra list filters, preview
  `limit/maxChars`, create `key/task`, compact `maxLines`, delete transcript /
  lifecycle-hook flags, and advanced patch execution/spawn/subagent fields

#### Scenario: Sessions product ownership is classified

- **WHEN** the matrix encounters `sessions.create`, `sessions.send`,
  `sessions.abort`, or `sessions.steer`
- **THEN** the implementation SHALL classify those workflows as Chat/runtime
  adjacent-owned unless current product evidence proves a Sessions-owned use
  case
- **AND** the Sessions production UI SHALL NOT add a second chat composer,
  live send control, abort control, or steer control in this change
- **AND** any cross-module affordance SHALL be navigation/context only and
  SHALL continue to use Deck BFF/shell boundaries

#### Scenario: Sessions safety metadata is enforced

- **WHEN** the production Sessions UI exposes reset, clear, compact, delete, or
  compaction restore
- **THEN** the first operator action SHALL arm a confirmation state rather than
  invoking the mutation wrapper
- **AND** only the confirming action SHALL call the existing frontend API
  facade
- **AND** focused tests SHALL prove the non-executing first-click behavior for
  each exposed confirmation-required action

#### Scenario: Deterministic Sessions drift is found

- **WHEN** implementation finds Sessions-scoped contract, backend, frontend,
  mock, i18n, handoff, or test drift and the correct behavior is
  evidence-backed
- **THEN** the implementation SHALL fix that drift at the source-owned layer
- **AND** it SHALL add or refresh focused verification evidence
- **AND** it SHALL NOT defer deterministic local code defects only because the
  primary user complaint was visual density

#### Scenario: Product expansion is not backed by Gateway or Deck truth

- **WHEN** a desired Sessions behavior is useful but not backed by current
  Gateway/Deck contract truth
- **THEN** the implementation SHALL label it projected, unsupported,
  handoff-blocked, or future-decision in the Sessions handoff notes
- **AND** it SHALL NOT present that behavior as currently operational in the
  production UI
