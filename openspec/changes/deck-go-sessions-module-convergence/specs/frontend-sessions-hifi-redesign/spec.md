## MODIFIED Requirements

### Requirement: Sessions handoff package defines the visual contract

The sessions module SHALL have a complete handoff package under
`deck-go/frontend-handoff/modules/sessions/` before the production UI rewrite is
marked complete. The package SHALL use the current Deck-facing session, chat
history, usage, compaction, and subagent lineage DTOs and BFF routes as source
truth. The active visual contract SHALL use a list + selected-session workbench
+ default-open Inspector-tab layout, and the previous dense prototype SHALL be
preserved as a versioned backup before `prototype.html` is replaced.

#### Scenario: Handoff package is reviewed

- **WHEN** the sessions handoff package is created or revised for this change
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`,
  `states.md`, `interactions.md`, and `api-usage.md`
- **AND** `prototype.html` SHALL be the active visual target for the
  list/workbench/default-open Inspector-tab layout
- **AND** the previous dense `prototype.html` SHALL remain available as a
  versioned backup in the same module handoff directory
- **AND** unsupported or uncertain product/Gateway behavior SHALL be documented
  as discrepancy notes or open questions rather than guaranteed UI behavior
- **AND** transcript cache, destructive mutation, Inspector tabs, and export
  behavior SHALL be documented explicitly
- **AND** the handoff package SHALL distinguish Sessions-owned workflows from
  Chat/Subagents/Usage adjacent-owned workflows
- **AND** Gateway-supported but currently BFF/product-unsurfaced parameters
  SHALL be classified rather than rendered as guaranteed controls

### Requirement: Sessions production panel follows contract-backed workflows

The production sessions panel SHALL render and operate from contract-backed
session inventory, preview, detail, history, usage, compaction, subagent
lineage, and mutation data while preserving the existing panel registry and API
facade boundaries. The production panel SHALL reduce visual density by keeping
the inventory on the left, selected-session reading/review work in the center,
and secondary evidence plus mutations in a default-open right-side Inspector
with tabs.

#### Scenario: Sessions data is loaded

- **WHEN** session inventory, previews, selected detail, chat history,
  usage/context data, compaction checkpoints, and optional subagent lineage
  resolve
- **THEN** the panel SHALL show inventory status, detail status, visible count,
  filters, selected-session metadata, transcript evidence, and Inspector tab
  summaries
- **AND** usage/context diagnostics, compaction history, lineage/relations when
  present, and action controls SHALL be available through Inspector tabs rather
  than all being expanded in the first viewport
- **AND** missing optional fields SHALL render as unavailable, empty, or omitted
  rather than fabricated values

#### Scenario: Session filters and selection are used

- **WHEN** an operator searches, changes type/time filters, pages inventory,
  selects a session, or opens a session from a navigation `sessionKey`
- **THEN** the panel SHALL use the existing sessions wrappers and keep
  selected-session detail/history consistent with the selected key
- **AND** transcript cache usage SHALL remain intact for cached histories
- **AND** switching Inspector tabs SHALL NOT change the selected session key or
  invalidate loaded transcript cache by itself
- **AND** the panel SHALL NOT expose server-side cursor pagination or
  unsupported Gateway list filters as live controls unless the refreshed Deck
  contract chain exposes them

#### Scenario: Session transcript is searched or exported

- **WHEN** an operator searches transcript history or prepares JSON/Markdown
  export
- **THEN** the panel SHALL search the loaded normalized transcript messages
- **AND** export previews SHALL be generated from the selected session and
  current transcript messages without mutating server state
- **AND** transcript search/export SHALL remain part of the selected-session
  workbench rather than hidden inside destructive action controls

#### Scenario: Session actions are executed

- **WHEN** an operator opens the Inspector `Actions` tab and resets, clears,
  patches, compacts, or deletes a session
- **THEN** the panel SHALL call the existing session action wrapper with the
  current selected session key and required payload
- **AND** reset, clear, compact, delete, and compaction restore SHALL require a
  confirmation gate before invoking their mutation wrappers
- **AND** patch controls SHALL remain a safe scoped editor for currently
  product-backed fields rather than an exhaustive Gateway patch schema editor
- **AND** successful actions SHALL invalidate the selected transcript cache and
  refresh session state according to the existing selection-preservation
  behavior
- **AND** delete SHALL remain visually distinct as a dangerous action

#### Scenario: Adjacent chat/run workflows are represented safely

- **WHEN** Sessions renders selected-session context for a session that can be
  continued, aborted, or steered through Chat/runtime workflows
- **THEN** Sessions SHALL present that state as evidence or navigation context
  only
- **AND** it SHALL NOT add message compose, live send, abort, or steer controls
  to the Sessions page in this change
- **AND** any "open in Chat" style affordance SHALL be navigation-only and
  SHALL not bypass the Deck BFF boundary

### Requirement: Sessions UI aligns with the settled frontend design system

The sessions panel SHALL use the chat/agents/routing/subagents/logs/settings
design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens,
compact workbench density, low-radius surfaces, clear focus states, and local
molecules only when canonical atoms are not yet justified. The redesign SHALL
reduce visible density by grouping secondary details inside Inspector tabs
without introducing a new frontend dependency or new canonical tokens.

#### Scenario: Sessions UI is rendered

- **WHEN** the sessions panel is rendered with contract-shaped mock data
- **THEN** the first viewport SHALL expose inventory health, selected-session
  identity, core runtime summary, transcript search/export, transcript reading,
  and a default-open Inspector with visible tab navigation
- **AND** usage/context, compaction, lineage, and action affordances SHALL be
  reachable from Inspector tabs without overlapping text or nested decorative
  cards
- **AND** destructive actions SHALL remain visually distinct from
  non-destructive actions
- **AND** the tab control SHALL use existing design-system primitives such as
  `SegmentedControl` or a local molecule built from the same tokens

### Requirement: Sessions mock visual verification is available

The sessions rewrite SHALL include focused mock visual verification that
exercises the real frontend against contract-shaped
sessions/history/usage/compaction/lineage data without requiring a real Gateway
or LLM.

#### Scenario: Mock visual E2E runs

- **WHEN** the sessions mock visual E2E is executed
- **THEN** it SHALL load session data through the frontend API path
- **AND** it SHALL capture or assert the ready list/workbench/default-open
  Inspector state
- **AND** it SHALL exercise at least one secondary Inspector tab and at least
  one interaction state such as transcript export, filter state, compaction
  confirmation, patch result, or delete confirmation
- **AND** closeout evidence SHALL label the test as mock visual coverage, not
  real Gateway/LLM E2E
