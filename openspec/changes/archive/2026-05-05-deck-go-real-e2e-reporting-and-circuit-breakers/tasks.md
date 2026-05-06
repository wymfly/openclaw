## 1. Explore Existing Evidence

- [x] 1.1 Review existing real E2E evidence attachments, seed evidence, fixture helpers, and matrix status vocabulary.
- [x] 1.2 Confirm no existing child proposal/archive already owns `deck-go-real-e2e-reporting-and-circuit-breakers`.

## 2. Shared Reporting Helpers

- [x] 2.1 Add shared real E2E status constants/types and scenario evidence validation.
- [x] 2.2 Add a scenario evidence writer that records/validates status, `scenarioId`, `runId`, `maxAttempts`, and `attemptCount` before delegating to redacted evidence writing.
- [x] 2.3 Apply the scenario evidence writer to the `cpa` + `main` seed path.

## 3. Verification

- [x] 3.1 Add or update helper tests covering valid evidence, invalid status, and attempts exceeding max attempts.
- [x] 3.2 Run `openspec validate --type change deck-go-real-e2e-reporting-and-circuit-breakers --strict`.
- [x] 3.3 Run focused Playwright helper tests.
- [x] 3.4 Run the focused real seed command to prove scenario evidence is still produced.

## 4. Matrix And Archive

- [x] 4.1 Update the head proposal matrix JSON and generated Markdown so `deck-go-real-e2e-reporting-and-circuit-breakers` reflects the completed/archived lifecycle.
- [x] 4.2 Run `git diff --check`.
- [x] 4.3 Archive this child change after tasks and validation pass, syncing the spec delta into top-level specs as needed.
