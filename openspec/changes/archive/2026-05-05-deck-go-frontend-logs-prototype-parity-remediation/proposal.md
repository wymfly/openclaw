## Why

`logs` is the next blocking/failing-evidence module in the frontend prototype
remediation head proposal. The module already has real-contract verification
history, but the matrix still marks it as mock-functional only with strict
prototype parity unreviewed.

Logs is also an operational observability surface. It must stay grounded in the
Deck BFF log tail and stream contracts while proving that the production panel
matches the active high-fidelity handoff or records source-linked exceptions.

## What Changes

- Identify `deck-go/frontend-handoff/modules/logs/prototype.html` as the active
  visual target and treat `prototype-v1-codex.html` as historical context.
- Reconcile the prototype's normalized log-line assumptions, filters, details
  pane, live tape, pause/resume, clear-local, and export-preview workflows with
  the current Deck logs contract chain: typed `logs.tail` string rows plus
  dynamic stream event payload leaves.
- Fix deterministic logs UI, parser, stream, fixture, API facade, contract,
  backend, or handoff-doc drift discovered during the parity pass.
- Produce strict mock prototype parity evidence for the ready logs workbench:
  prototype screenshot, mock-current screenshot, side-by-side contact sheet,
  structured verdict, and accepted-exception ledger.
- Attempt bounded real Gateway evidence for shell navigation into Logs,
  dark/light themes, English/Chinese locale variants, safe child-surface
  interactions, `/api/logs` safe reads, `/api/logs/stream` reachability or quiet
  timeout, and BFF-only browser transport.
- Record real-stack cold-start, quiet-stream, or data-sparse outcomes as
  circuit-breaker handoff evidence rather than fabricating rows.
- Update the remediation matrix, logs handoff notes, and head task status.

## Capabilities

### New Capabilities

- `frontend-logs-prototype-parity-remediation`: Captures strict logs prototype
  parity, logs contract-truth reconciliation, accepted exceptions, and bounded
  real Gateway evidence.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Progresses the blocking/failing
  evidence module batch for `logs`.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/logs/**`.
- **Frontend**:
  `deck-go/frontend-new/src/components/panels/logs/**`, logs API wrappers,
  live projection/stream handling, mocks, and visual/real E2E specs if
  deterministic drift is found.
- **Contracts/backend**: logs DTOs, endpoint classification, stream contracts,
  Go BFF routes, and generated Gateway coverage only if source-backed drift is
  discovered.
- **Evidence/docs**:
  `deck-go/docs/project/frontend-prototype-remediation-matrix.md`, this child
  proposal, and `.local/` parity evidence artifacts.
