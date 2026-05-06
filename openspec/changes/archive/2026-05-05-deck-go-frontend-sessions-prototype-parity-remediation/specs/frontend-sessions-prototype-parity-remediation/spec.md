## ADDED Requirements

### Requirement: Sessions remediation uses the active prototype

The Sessions remediation child proposal SHALL treat
`deck-go/frontend-handoff/modules/sessions/prototype.html` as the active visual
target unless a source-linked accepted exception supersedes it.

#### Scenario: Sessions prototype parity is claimed

- **WHEN** Sessions mock prototype parity is marked passed
- **THEN** evidence SHALL include a prototype screenshot, mock-current
  screenshot, side-by-side comparison, structured verdict, and accepted
  exceptions for remaining material differences
- **AND** screenshot capture alone SHALL NOT be enough.

### Requirement: Sessions context-weight rendering tolerates partial real data

The Sessions UI SHALL render optional context-weight sections safely when real
Gateway/BFF data omits nested arrays or nested objects.

#### Scenario: Context-weight tools or skills entries are missing

- **WHEN** a selected session usage row includes `contextWeight.tools` or
  `contextWeight.skills` without an `entries` array
- **THEN** the usage/context panel SHALL render zero entries or an equivalent
  empty value
- **AND** it SHALL NOT throw a page error.

#### Scenario: Context-weight report is absent

- **WHEN** the selected session usage row has no context-weight report
- **THEN** the usage/context panel SHALL render the existing compact empty
  context state.

### Requirement: Sessions real E2E creates safe run-scoped session data

Sessions real Gateway evidence SHALL create representative session data in the
isolated real E2E state when the Gateway/BFF chain supports safe creation.

#### Scenario: Run-scoped session fixture is created

- **WHEN** real Sessions evidence runs against a configured real Gateway
- **THEN** it SHALL attempt to create a session whose key or label includes the
  current run id through a Deck backend Gateway RPC or BFF route
- **AND** it SHALL use that session for inventory/detail/history or record why
  the created fixture could not be observed
- **AND** cleanup SHALL delete only session keys that include the current run id.

#### Scenario: Fixture mutation is blocked

- **WHEN** fixture creation, observation, or cleanup cannot complete because of
  environment, Gateway support, or external-state limits
- **THEN** the child proposal SHALL record concrete failure evidence and MAY
  circuit-break only after mock functional evidence, mock prototype parity, and
  deterministic local fixes are complete.

### Requirement: Sessions real E2E covers product surface variants

Sessions real Gateway evidence SHALL exercise the product UI instead of relying
only on direct route or RPC checks.

#### Scenario: Sessions real product surface evidence is claimed

- **WHEN** real Sessions evidence is marked passed
- **THEN** evidence SHALL include navigation from the Deck shell to the Sessions
  main page
- **AND** SHALL include dark-mode English and light-mode Chinese renders
- **AND** SHALL exercise meaningful child sections such as inventory selection,
  transcript search/export, compaction disclosure or empty state, lineage or
  relation navigation when available, and guarded action confirmation
- **AND** SHALL record unexpected console/page/BFF API errors and direct browser
  Gateway request/socket checks.
