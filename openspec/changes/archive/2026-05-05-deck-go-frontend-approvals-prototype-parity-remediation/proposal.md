## Why

`approvals` is a decision-critical security operations panel, and the head
prototype remediation program currently marks it as mock-functional only with
strict parity unreviewed. Existing implementation work needs to be reconciled
against the active v2 prototype, the approval contract chain, and bounded real
Gateway evidence before the module can be considered complete.

## What Changes

- Identify `deck-go/frontend-handoff/modules/approvals/prototype.html` as the
  active visual target and treat `prototype-v1-codex.html` as historical.
- Reconcile prototype decision UI, policy editor, stream behavior, and recent
  decision assumptions with the current Deck approval BFF/Gateway contract
  chain.
- Fix deterministic approvals UI, fixture, stream handling, contract, backend,
  or documentation drift discovered during the parity pass.
- Produce strict mock prototype parity evidence for the ready approvals
  workbench state: prototype screenshot, mock-current screenshot, side-by-side
  contact sheet, structured verdict, and accepted-exception ledger.
- Attempt bounded real Gateway evidence for shell navigation into Approvals,
  dark/light themes, English/Chinese locale variants, child section
  interactivity, safe read routes, and BFF-only UI rendering while avoiding
  unsafe real approval/policy mutations unless disposable fixtures exist.
- Classify any real approval/policy mutation fixture as fixture-safe only after
  run-scoped creation, cleanup, and non-shared-state targeting are proven;
  otherwise keep the action skipped-safe with concrete handoff evidence.
- Update the remediation matrix, approvals handoff notes, and head task status.

## Capabilities

### New Capabilities

- `frontend-approvals-prototype-parity-remediation`: Captures strict approvals
  prototype parity, approval contract-truth reconciliation, accepted exceptions,
  and bounded real Gateway evidence.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Progresses the blocking/failing
  evidence module batch for `approvals`.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/approvals/**`.
- **Frontend**:
  `deck-go/frontend-new/src/components/panels/approvals/**`, approvals API
  wrappers, stream handling, mocks, and visual/real E2E specs if deterministic
  drift is found.
- **Contracts/backend**: approval DTOs, route classification, mutation
  evidence, stream contracts, Go BFF routes, and generated Gateway method
  coverage only if source-backed drift is discovered.
- **Evidence/docs**:
  `deck-go/docs/project/frontend-prototype-remediation-matrix.md`, this child
  proposal, and `.local/` parity evidence artifacts.
