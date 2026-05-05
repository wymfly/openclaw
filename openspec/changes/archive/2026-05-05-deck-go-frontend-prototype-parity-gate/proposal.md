## Why

The deck-go frontend remediation head requires strict prototype parity evidence,
but the current mock visual suite only captures screenshots and currently fails
for `api-explorer`, `approvals`, and `logs`. Before module-by-module UI
correction can be reliable, the shared evidence gate must be repeatable and the
mock visual baseline must be green enough to distinguish functional screenshots
from prototype parity.

## What Changes

- Add a repeatable parity evidence workflow for active prototype versus
  `frontend-new` mock-current screenshots.
- Generate side-by-side contact sheets and machine-readable verdict skeletons so
  module child proposals can record `pass`, `needs-fix`, or accepted exceptions.
- Repair deterministic mock visual spec drift for:
  - `api-explorer`;
  - `approvals`;
  - `logs`.
- Update docs so the full mock visual suite output is classified correctly:
  passing `*-visual.spec.ts` means mock functional coverage unless paired with
  prototype comparison evidence.
- Do not use this change to visually fix every module. It provides the gate and
  repairs stale test/fixture drift only.

## Capabilities

### New Capabilities

- `frontend-prototype-parity-gate`: Provides shared prototype-vs-current capture,
  contact-sheet, verdict, and mock visual gate behavior for deck-go frontend
  module remediation.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Implements the shared gate required
  by the remediation head before individual module child proposals claim visual
  parity.

## Impact

- `deck-go/scripts/` or `deck-go/test/e2e/` parity evidence tooling.
- `deck-go/test/e2e/*-visual.spec.ts` for stale mock visual assertions.
- `deck-go/test/fixtures/mock-gateway.mjs` if deterministic fixture drift is the
  root cause.
- `deck-go/docs/project/frontend-prototype-remediation-matrix.md` and
  `deck-go/docs/project/frontend-prototype-gap-audit.md`.
- OpenSpec head task progress in
  `openspec/changes/deck-go-frontend-prototype-parity-remediation/tasks.md`.
