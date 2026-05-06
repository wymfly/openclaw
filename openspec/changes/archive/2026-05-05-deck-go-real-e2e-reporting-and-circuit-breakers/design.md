## Context

The seed proposal made `cpa` + `main` evidence repeatable, and the fixture proposal made safe writable resources reusable. Existing real specs already use words such as `degraded`, `empty-valid`, and `skipped-safe`, but there is no shared helper that validates the vocabulary or attempt-count metadata.

This change is intentionally small: it adds evidence guardrails in the test helper layer and applies them to the seed. It does not rewrite every module real spec.

## Goals / Non-Goals

**Goals:**

- Define the canonical real E2E status vocabulary in code.
- Validate scenario evidence before it is written.
- Ensure seed evidence includes bounded retry metadata.
- Make invalid statuses or unbounded attempt arrays fail in helper tests.
- Keep evidence redaction and persistent output behavior from the seed proposal.

**Non-Goals:**

- Do not migrate every module-specific real spec to the scenario evidence helper in this change.
- Do not introduce a custom Playwright reporter.
- Do not add CI requirements for all real Gateway specs.
- Do not change product runtime behavior.

## Decisions

### Decision: Put reporting guardrails in helpers, not a custom reporter

The helper layer already owns stack setup, redaction, persistent evidence, seed execution, and fixture helpers. Adding scenario evidence validation there keeps the path explicit and testable without introducing a separate reporter lifecycle.

Alternative rejected: build a custom Playwright reporter now. That would be broader than the current need and would not help tests that attach JSON directly.

### Decision: Validate evidence at write time

Scenario evidence SHALL be validated before JSON is written. Invalid status values, missing scenario ids, missing run ids, or attempt counts larger than max attempts fail immediately. This catches reporting drift at the closest source.

### Decision: Apply the helper to seed first

The `cpa` + `main` seed is the shared minimum gate and already has bounded attempts. Applying the scenario helper there proves the contract without forcing each module proposal to change before its own product scope is open.

## Risks / Trade-offs

- Module specs remain partly ad hoc -> downstream module proposals can migrate their own evidence as they harden contracts.
- Strict validation could block useful exploratory evidence -> only the shared scenario helper is strict; raw `testInfo.attach` remains available for local diagnostics.
- Attempt counts may be misunderstood -> evidence records both `maxAttempts` and `attemptCount`, and the matrix keeps `seed-covered` separate from module proof.

## Migration Plan

1. Add status constants, types, and scenario-evidence write helper.
2. Update seed evidence to include `scenarioId`, `maxAttempts`, and `attemptCount`.
3. Add helper tests for valid evidence, invalid status, and excessive attempts.
4. Run the focused seed and helper checks.
5. Update the matrix and archive this change.

Rollback is straightforward: remove the scenario helper and return seed to raw `writeRealE2EEvidence`.

## Open Questions

- Module-specific real specs should migrate to the helper when their module contract-completion proposals are implemented.
