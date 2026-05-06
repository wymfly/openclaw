## Why

`sessions` is the remaining blocking/failing-evidence module in the first
prototype-remediation batch. The module has useful contract and real-stack
history, but the head remediation matrix still classifies it as mock-functional
only and records a critical real-data crash around nullable
`contextWeight.*.entries`.

Sessions is also a core operator workflow. It must prove that the production
panel matches the active high-fidelity prototype, stays grounded in the
Deck-facing session contract chain, and works against real OpenClaw session
state created safely for the current E2E run.

## What Changes

- Identify `deck-go/frontend-handoff/modules/sessions/prototype.html` as the
  active visual target for this pass.
- Reconcile the prototype's inventory, selected-session evidence,
  usage/context-weight, compaction, lineage, transcript search/export, and
  guarded actions with the current Deck BFF/session DTO truth.
- Fix deterministic sessions UI, fixture, API facade, backend adapter, contract,
  test, or handoff-doc drift discovered during the parity pass.
- Fix the known nullable context-weight crash so missing `tools.entries`,
  `skills.entries`, or related nested fields render a safe empty value instead
  of throwing.
- Produce strict mock prototype parity evidence: prototype screenshot,
  mock-current screenshot, side-by-side contact sheet, structured verdict, and
  accepted-exception ledger.
- Strengthen real Gateway evidence for Sessions: Deck shell navigation into the
  module, dark/light themes, English/Chinese locales, meaningful child-surface
  interactions, run-scoped session fixture creation, safe cleanup/refusal rules,
  BFF-only browser transport, and unexpected console/page/API error checks.
- Update the remediation matrix, sessions handoff notes, and head task status.

## Capabilities

### New Capabilities

- `frontend-sessions-prototype-parity-remediation`: Captures strict sessions
  prototype parity, nullable real-data hardening, accepted exceptions, and
  strengthened real Gateway product-surface evidence.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Progresses the blocking/failing
  evidence module batch for `sessions`.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/sessions/**`.
- **Frontend**:
  `deck-go/frontend-new/src/components/panels/sessions/**`, Sessions tests,
  and Sessions mock/real E2E specs.
- **Contracts/backend**: session usage/context DTOs, Go projection/adapter code,
  and generated contracts only if source-backed drift is discovered.
- **Evidence/docs**:
  `deck-go/docs/project/frontend-prototype-remediation-matrix.md`, this child
  proposal, and `.local/` parity evidence artifacts.
