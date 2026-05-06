## Why

The 2026-05-06 frontend review exposed real protocol-closure gaps, but the review also contained factual errors. deck-go needs a strict, machine-checkable verification discipline so future module closure is based on current code truth, reproducible evidence, and explicit acceptance criteria rather than historical task checkboxes or unverified review claims.

## What Changes

- Establish a verified fact baseline for the review findings accepted by Codex, including README status drift, weak reverse sign-off, token namespace drift, panel a11y gaps, unused list primitives, and untracked parity evidence.
- Add a front-end verification discipline spec that requires every future closure task to cite command output or file evidence before a task checkbox can be marked complete.
- Tighten `frontend-handoff-protocol` requirements for README status, reverse sign-off, mock/prototype/real evidence manifests, and correction of stale or contradictory review claims.
- Tighten design-system readiness requirements so token drift and unused cross-module primitives cannot be treated as complete without a decision and verification command.
- Do not redesign panels, split large panel files, or promote molecules in this change; those are follow-up implementation changes that must be separately justified by this gate.

## Capabilities

### New Capabilities

- `deck-go-frontend-verification-discipline`: Fact-led acceptance gates for frontend review remediation, including evidence manifests, task completion rules, and machine-checkable closure commands.

### Modified Capabilities

- `frontend-handoff-protocol`: Strengthen module README status, reverse sign-off, and three-layer evidence requirements so they are current, structured, and linked from module handoff files.
- `design-system-cross-module-readiness`: Require token drift and unused shared primitives to be resolved or explicitly classified before readiness/closure is claimed.

## Impact

- Affected documentation/protocol surfaces:
  - `deck-go/frontend-handoff/CLAUDE.md`
  - `deck-go/frontend-new/CLAUDE.md`
  - `deck-go/frontend-handoff/modules/*/README.md`
  - `deck-go/frontend-handoff/modules/*/implementation-notes.md`
  - `deck-go/frontend-handoff/audit/`
  - `deck-go/scripts/check-tokens-drift.sh`
  - `deck-go/scripts/generate-prototype-parity-report.mjs`
- Affected validation surfaces:
  - `deck-go/frontend-new/src/components/panels/*`
  - `deck-go/frontend-new/src/design-system/*`
  - `deck-go/frontend-new/src/components/shared/lists/*`
- No new runtime dependency is expected.
- No Gateway, Go backend, or Deck API contract behavior changes are in scope unless an implementation task discovers a deterministic mismatch and creates a separate change.
