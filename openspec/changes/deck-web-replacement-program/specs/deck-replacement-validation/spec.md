## ADDED Requirements

### Requirement: The Deck replacement program SHALL maintain a capability and closure matrix

The program SHALL maintain a living matrix that maps Gateway capability families, Deck modules, existing changes, current closure status, and planned phase.

#### Scenario: Existing change is positioned in the matrix

- **WHEN** an existing `deck-*` proposal or implementation area is reviewed
- **THEN** it SHALL be assigned a track, a phase, and a current closure status in the matrix

#### Scenario: Replacement readiness is visible

- **WHEN** stakeholders need to assess whether Deck can replace the official Web UI for a capability area
- **THEN** the matrix SHALL show whether that area is `unassessed`, `partial`, `platform-first`, or `replacement-ready`

Note: `platform-first` indicates an area that has been assessed but cannot progress until its platform-track dependencies stabilize. It is distinct from `partial` (which has begun implementation but is not yet complete) and `unassessed` (which has not been structurally reviewed).

#### Scenario: Each phase gate includes incremental validation

- **WHEN** a phase completes and a phase gate review is triggered
- **THEN** all areas within that phase SHALL be validated against the closure checklist applicable to their current scope, not deferred to Phase 5

### Requirement: Replacement progress SHALL be validated by workflows, not only by page availability

Deck replacement progress SHALL be measured using real workflows and recovery behavior, not only by whether pages or actions exist.

#### Scenario: Module requires workflow validation

- **WHEN** a module is proposed as replacement-ready
- **THEN** it SHALL identify at least one representative workflow that passes under live updates, refresh, reconnect, and historical reopen conditions when applicable

#### Scenario: Enhanced integration waits for replacement gates

- **WHEN** work from a Deck replacement track is prepared for stable integration into `enhanced`
- **THEN** it SHALL satisfy the relevant closure checklist and workflow validation gate for that track

### Requirement: The program SHALL support phased multi-worktree delivery

The Deck replacement program SHALL support staged implementation through multiple worktrees while keeping a single program-level source of truth.

#### Scenario: Program worktree remains the governance entry point

- **WHEN** multiple implementation worktrees exist
- **THEN** the program documentation and matrices SHALL remain the single source of truth for phase ordering, dependencies, and replacement gates

#### Scenario: Shared contracts stabilize before parallel module work

- **WHEN** multiple worktrees would otherwise modify unstable shared contracts
- **THEN** those shared contracts SHALL be stabilized in the relevant platform track before large-scale parallel module implementation proceeds
