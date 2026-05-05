## 1. Baseline And Scope

- [x] 1.1 Read the remediation head proposal, design, specs, and matrix before editing.
- [x] 1.2 Confirm current failing mock visual specs for `api-explorer`, `approvals`, and `logs` or document if already fixed.
- [x] 1.3 Identify primary mock screenshot names for all active modules.

## 2. Parity Evidence Tooling

- [x] 2.1 Add a repeatable deck-go script for prototype-vs-current contact sheets and verdict skeleton generation.
- [x] 2.2 Make the script mark missing prototype/current screenshots as missing evidence.
- [x] 2.3 Add docs or script output explaining evidence levels: mock functional versus mock prototype parity.

## 3. Mock Visual Spec Repair

- [x] 3.1 Repair `api-explorer` mock visual spec drift around current Gateway method counts.
- [x] 3.2 Repair `approvals` mock visual ready-state assertion or deterministic fixture/state drift.
- [x] 3.3 Repair `logs` mock visual ready-state assertion or deterministic fixture/state drift.

## 4. Verification

- [x] 4.1 Run the focused repaired mock visual specs.
- [x] 4.2 Run the full `test/e2e/*-visual.spec.ts` suite.
- [x] 4.3 Generate parity contact sheets and verdict skeleton from the latest mock visual output.
- [x] 4.4 Update `frontend-prototype-remediation-matrix.md` with the shared gate child proposal and current evidence statuses.
- [x] 4.5 Run `openspec validate deck-go-frontend-prototype-parity-gate --strict`.
- [x] 4.6 Archive and commit the shared parity gate change.
