## MODIFIED Requirements

### Requirement: Cron handoff package defines the visual contract

The cron module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/cron/` before the production UI rewrite is marked complete. The package SHALL use the Deck-facing cron wrappers, current `/api/cron*` BFF route truth, Gateway `cron.*` methods, and `DeckGoCron*` DTOs as the source truth. Prototype claims that conflict with code truth SHALL be corrected in handoff notes during implementation.

#### Scenario: Handoff package is reviewed

- **WHEN** the cron handoff package is created or refreshed
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, `api-usage.md`, and implementation notes
- **AND** the package SHALL document scheduler inventory, job catalog, search/filter/sort controls, selected job detail, job builder, delete confirmation, run history, scheduler heartbeat state, last-action evidence, loading/error/empty states, and mock visual states
- **AND** unsupported or uncertain real Gateway cron payload details, schedule preview, cron-expression parser dependency, bulk operations, live history streams, cursor pagination, optimistic concurrency, and delivery semantics SHALL be documented as follow-up rather than silently fabricated in the UI
- **AND** any reference to non-existent BFF routes, undeclared dependencies, or backend features SHALL be reconciled against implementation notes before archive

### Requirement: Cron production panel follows contract-backed workflows

The production cron panel SHALL render and operate from contract-backed Deck cron data while preserving the existing panel registry and API facade boundaries.

#### Scenario: Cron inventory is loaded

- **WHEN** `fetchCronJobs`, `fetchCronStatus`, and `fetchCronRuns` resolve with contract-shaped data
- **THEN** the panel SHALL show scheduler readiness, running state, job count, enabled count, loaded-window run/error evidence, next execution evidence, filterable/sortable job catalog rows, selected job identity, selected schedule, selected next run, selected configuration payload, and run history evidence
- **AND** missing optional fields such as description, agent id, next run, duration, delivery, or error SHALL render as unavailable evidence rather than fabricated values
- **AND** generated Gateway cron fields already exposed by the BFF, such as `job.state.nextRunAtMs`, `status.jobs`, and `status.nextWakeAtMs`, SHALL be normalized into the current Deck-facing DTO fields before rendering

#### Scenario: Cron job actions are used

- **WHEN** an operator creates, edits, manually runs, refreshes, loads selected, saves selected, enables, disables, or deletes a job
- **THEN** the panel SHALL call the current Deck-facing wrappers with the existing mutation envelopes
- **AND** delete SHALL remain guarded by an explicit confirmation dialog
- **AND** run-now SHALL be disabled or guarded when no selected enabled job exists
- **AND** successful action results SHALL remain inspectable as raw evidence without replacing the loaded job contract payload

#### Scenario: Cron detail tabs are inspected

- **WHEN** an operator switches between overview, schedule, run history, payload, and scheduler heartbeat/detail evidence
- **THEN** selected job configuration SHALL remain available
- **AND** run history SHALL render from `DeckGoCronRunEntry[]`
- **AND** scheduler state SHALL render from `DeckGoCronStatus`
- **AND** tab switching SHALL NOT mutate loaded jobs or selected job identity

### Requirement: Cron UI aligns with the settled frontend design system

The cron panel SHALL use the current settled frontend design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: Cron UI is rendered

- **WHEN** the cron panel is rendered with contract-shaped mock data
- **THEN** the first viewport SHALL expose scheduler status, job inventory, selected job evidence, job controls, and primary actions without overlapping text or nested decorative cards
- **AND** long job names, descriptions, schedule expressions, payload text, and raw action fields SHALL wrap or truncate in stable constrained regions without shifting the layout

### Requirement: Cron mock visual verification is available

The cron rewrite SHALL include focused mock visual verification that exercises the real frontend against contract-shaped cron data without requiring a real Gateway or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the cron mock visual E2E is executed
- **THEN** it SHALL load cron jobs, status, and runs through the normal frontend API path
- **AND** it SHALL capture or assert the ready workspace state and at least one interaction state such as run-history inspection, scheduler detail inspection, builder opening, manual run result, selected job switching, filter/search/sort, or delete confirmation
- **AND** closeout evidence SHALL label the test as mock visual coverage, not real Gateway/LLM or full upstream scheduler-completeness evidence
