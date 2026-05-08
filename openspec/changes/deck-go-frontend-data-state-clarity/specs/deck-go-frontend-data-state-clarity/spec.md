## ADDED Requirements

### Requirement: Data-backed panels SHALL distinguish data visibility states

`deck-go/frontend-new` data-backed list/workbench panels SHALL distinguish first-load loading, refresh-in-progress, blocking error, stale-data error, true-empty, filtered-empty, ready, and degraded/unsupported states where those states are applicable to the panel's data source.

#### Scenario: True empty is not shown as a load failure

- **WHEN** a panel's authoritative Data Fabric or BFF read succeeds and returns an empty collection
- **THEN** the panel SHALL render a true-empty state whose copy names the relevant source or configuration domain
- **AND** the panel SHALL NOT imply that the Gateway, BFF, or frontend failed to load data

#### Scenario: Filtered empty is recoverable

- **WHEN** a panel's authoritative read succeeds and the source collection has at least one item
- **AND** local search text, filter state, or tab state hides all visible rows
- **THEN** the panel SHALL render a filtered-empty state
- **AND** the state SHALL expose active criteria or equivalent context
- **AND** the state SHALL provide a clear-filters or equivalent recovery action

#### Scenario: Cached rows survive background refresh

- **WHEN** a panel has cached/current rows and a manual refresh or background refetch is in progress
- **THEN** the panel SHALL keep rendering the current rows
- **AND** it SHALL show a non-blocking refreshing indicator instead of replacing the workbench with a first-load skeleton

#### Scenario: Refresh failure with cached rows is non-blocking

- **WHEN** a panel has cached/current rows and the latest refresh fails
- **THEN** the panel SHALL keep rendering the cached rows
- **AND** it SHALL surface a non-blocking stale/error state with a retry affordance

### Requirement: Filter controls SHALL be valid for the current payload semantics

Panels SHALL ensure local filter controls cannot silently hide real data through stale or impossible values.

#### Scenario: Payload-derived filters reset or omit impossible values

- **WHEN** a filter group represents values derived from the current payload, such as capability kind, source origin, channel-specific capability, or another runtime inventory category
- **AND** the current payload does not contain a value
- **THEN** the panel SHALL either omit that value from the filter controls or render it disabled with count zero
- **AND** if the current selected filter becomes impossible after refresh or scope change, the panel SHALL reset it to `all` or another valid default

#### Scenario: Stable product filters disclose zero counts

- **WHEN** a filter group represents stable product states, such as enabled/disabled, warning/error, approval kind, or budget status
- **THEN** the panel MAY keep all stable values visible
- **BUT** it SHALL show counts or equivalent context sufficient to explain why selecting a value yields no rows
- **AND** a zero-result selection SHALL render filtered-empty rather than generic empty copy

#### Scenario: Refresh keeps filters only with explanation

- **WHEN** the user refreshes a panel while local filters or search text are active
- **THEN** the panel MAY preserve those criteria
- **BUT** if the refreshed source data has rows and the criteria hide all rows, the panel SHALL show filtered-empty copy and clear recovery

### Requirement: Selection state SHALL recover when source rows change

Panels with list-detail workbenches SHALL keep selected detail state aligned with the visible or source collection after refresh, filter change, or scope change.

#### Scenario: Selected row disappears after refresh

- **WHEN** a selected row no longer exists in the refreshed source collection
- **THEN** the panel SHALL select the first valid visible row, the first valid source row, or show an explicit no-selection state
- **AND** it SHALL NOT render stale detail data as if it still corresponded to the current source collection

#### Scenario: Selected row is hidden by filters

- **WHEN** a selected row still exists in the source collection but is hidden by current filters
- **THEN** the panel SHALL either move selection to a visible row or explicitly indicate that the selected row is hidden by current criteria
- **AND** clear-filter recovery SHALL make the row reachable again

### Requirement: High-risk panels SHALL be remediated or explicitly classified

The change SHALL audit and either fix or explicitly classify the known high-risk panels: Plugins, Skills, Models, Channels, Subagents, Approvals, Budget, Alerts, Cron, and Webhooks.

#### Scenario: Panel audit records final state

- **WHEN** implementation finishes
- **THEN** a tracked audit note SHALL classify each high-risk panel as `fixed`, `already-ok`, `empty-valid`, `degraded`, `deferred-uncertain`, or `follow-up-needed`
- **AND** each classification SHALL cite the code path or verification evidence that supports it

#### Scenario: Plugins reference regression remains protected

- **WHEN** the Plugins panel is rendered with a scoped payload that contains plugin rows but no provider-capability rows
- **THEN** the provider filter SHALL not be available as an active filter that can hide the scoped rows
- **AND** the panel SHALL still render the plugin rows or an explicit filtered-empty recovery state when other criteria hide them

### Requirement: Verification SHALL prove user-perceived visibility

Verification for this change SHALL prove visible state behavior rather than only proving API success.

#### Scenario: Component tests assert visible states

- **WHEN** component tests are added or updated for changed panels
- **THEN** they SHALL assert visible rows, filter controls, empty-state copy, clear-filter recovery, or selection recovery as applicable
- **AND** they SHALL NOT rely solely on mocked query success as proof of closure

#### Scenario: Mock browser smoke covers navigation and filtered-empty recovery

- **WHEN** mock browser evidence runs for this change
- **THEN** it SHALL navigate to the affected panels through the Deck shell
- **AND** it SHALL assert that pages do not remain indefinitely loading after mocked data resolves
- **AND** it SHALL exercise at least one filter/search path that produces filtered-empty and then clears back to visible rows

#### Scenario: Real-stack smoke separates empty-valid from broken

- **WHEN** real-stack evidence runs against the isolated real environment
- **THEN** each affected panel SHALL record API status, visible row count or empty reason, and whether the state is `ready`, `true-empty`, `filtered-empty`, `degraded`, or `handoff-blocked`
- **AND** a real API response with rows SHALL NOT be accepted as passing if the UI shows only a generic loading or generic empty state
- **AND** if real setup fails twice without new narrowing evidence, the scenario SHALL be recorded as a circuit-breaker handoff with command output and affected panels
