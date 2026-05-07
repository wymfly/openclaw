## MODIFIED Requirements

### Requirement: Sessions remediation uses the active prototype

The Sessions remediation child proposal SHALL treat
`deck-go/frontend-handoff/modules/sessions/prototype.html` as the active visual
target unless a source-linked accepted exception supersedes it. For this
information-architecture convergence pass, the previous dense prototype SHALL
be preserved as a versioned backup before the active prototype is replaced.

#### Scenario: Sessions prototype parity is claimed

- **WHEN** Sessions mock prototype parity is marked passed
- **THEN** evidence SHALL include the active prototype screenshot, mock-current
  screenshot, side-by-side comparison, structured verdict, and accepted
  exceptions for remaining material differences
- **AND** the active prototype screenshot SHALL come from the new
  list/workbench/default-open Inspector-tab `prototype.html`
- **AND** the handoff notes SHALL identify the previous dense prototype backup
  path so reviewers can distinguish historical visual truth from the active
  target
- **AND** screenshot capture alone SHALL NOT be enough

### Requirement: Sessions real E2E covers product surface variants

Sessions real Gateway evidence SHALL exercise the product UI instead of relying
only on direct route or RPC checks.

#### Scenario: Sessions real product surface evidence is claimed

- **WHEN** real Sessions evidence is marked passed
- **THEN** evidence SHALL include navigation from the Deck shell to the Sessions
  main page
- **AND** SHALL include dark-mode English and light-mode Chinese renders
- **AND** SHALL exercise meaningful child sections such as inventory selection,
  transcript search/export, at least one Inspector tab switch, compaction
  disclosure or empty state, lineage or relation navigation when available, and
  guarded action confirmation
- **AND** SHALL record unexpected console/page/BFF API errors and direct browser
  Gateway request/socket checks
