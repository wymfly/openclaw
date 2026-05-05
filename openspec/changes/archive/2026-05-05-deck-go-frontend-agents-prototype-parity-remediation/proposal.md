## Why

`agents` is the first sample module in the frontend prototype parity remediation
program. Earlier agents work produced a stronger high-fidelity handoff,
contract-chain mapping, mock visual coverage, and real Gateway smoke evidence,
but it did not produce the stricter proof now required by the head proposal:
active prototype screenshot, mock-current screenshot, side-by-side comparison,
structured verdict, and accepted-exception ledger.

Because `agents` is also one of the most contract-heavy control modules, it is
the right sample for proving the new workflow before applying it to the
remaining modules.

## What Changes

- Identify the active agents visual target and reject stale prototype files as
  implementation authority.
- Reconcile the active prototype with Gateway/deck-go contract truth and the
  existing agents real-contract verification evidence.
- Fix deterministic production UI, mock fixture, API facade, contract, or
  backend defects discovered during the parity pass.
- Produce strict mock prototype parity evidence for agents:
  - prototype screenshot;
  - mock-current screenshot;
  - side-by-side contact sheet;
  - structured verdict;
  - accepted-exception ledger, if any differences remain.
- Refresh bounded real Gateway evidence for non-destructive agents workflows or
  record an explicit circuit-breaker handoff if the real stack is unavailable.
- Update the remediation matrix and agents handoff notes with the final verdict.

## Capabilities

### New Capabilities

- `frontend-agents-prototype-parity-remediation`: Captures the agents strict
  parity remediation workflow, verdict requirements, accepted exceptions, and
  bounded real evidence for the head remediation program.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Completes the first sample module
  milestone for `agents`.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/agents/**`, especially
  `README.md`, `prototype.html`, and `implementation-notes.md`.
- **Frontend**:
  `deck-go/frontend-new/src/components/panels/agents/**`,
  agents store/API wrappers/tests, and the agents mock visual E2E if corrections
  are required.
- **Contracts/backend**: agents-scoped contract, generated, Go adapter, or BFF
  files only if exploration finds deterministic drift.
- **Evidence/docs**:
  `deck-go/docs/project/frontend-prototype-remediation-matrix.md` and generated
  parity report artifacts under `.local/`.
