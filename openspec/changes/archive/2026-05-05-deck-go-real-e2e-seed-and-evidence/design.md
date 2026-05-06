## Context

The head change `deck-go-contract-chain-audit-and-real-e2e-foundation` introduced the isolated real E2E root, config/workspace copying, channel sanitization, fixture safety helpers, and `seedRealGatewayChat`. Its verification already found and fixed the first deterministic failure: copied operator config could include stale external channel/plugin entries, causing Gateway startup to fail before `cpa` + `main` could run.

The proposal matrix still tracks `deck-go-real-e2e-seed-and-evidence` as a deferred P0 child change. This change turns the proven helper into a repeatable, independently verifiable seed lane with durable evidence and a stable command that downstream module proposals can cite.

## Goals / Non-Goals

**Goals:**

- Provide a focused command for the isolated `cpa` + `main` real seed.
- Preserve the existing temporary isolated root behavior that protects operator state.
- Persist redacted machine-readable seed evidence when a caller supplies an output directory.
- Keep seed attempts bounded and evidence status vocabulary comparable across modules.
- Update the head matrix so this child proposal is archived only after validation evidence exists.

**Non-Goals:**

- Do not add Gateway APIs, production test endpoints, or browser-only test bypasses.
- Do not require every module-specific real E2E spec to pass in this change.
- Do not introduce fixture create/delete helpers beyond the current seed; that belongs to `deck-go-real-e2e-fixture-library`.
- Do not standardize all reporting/circuit-breaker formats beyond seed needs; that belongs to `deck-go-real-e2e-reporting-and-circuit-breakers`.

## Decisions

### Decision: Add a focused seed target over the existing Playwright spec

The seed entrypoint SHALL run the existing real Gateway smoke with the `exercises the real Gateway control plane` test selected. This avoids creating a second seed path that could drift from the real BFF/browser stack already used by module E2E tests.

Alternative rejected: create a production `/api/e2e/seed` route. It would be easier to call from scripts but would bypass the same BFF contracts that frontend modules must prove.

### Decision: Persist evidence outside the temp root only when explicitly requested

`writeRealE2EEvidence` SHALL keep writing to the isolated run root for Playwright attachments. When `DECK_GO_REAL_E2E_EVIDENCE_DIR` is set, it SHALL also write the same redacted JSON to that directory using a run-id-prefixed filename.

This keeps normal tests self-cleaning while allowing goal-mode and CI-like runs to retain machine-readable evidence after the isolated root is removed.

### Decision: The seed evidence is a minimum gate, not module proof

A successful seed proves that deck-go can start the real Gateway path, authenticate through deck-go, use `cpa` + `main`, create a real chat/session, and probe supporting read endpoints. It does not prove every module-specific contract. Downstream proposals must still add their own read-path or fixture evidence.

### Decision: Environment blockers are recorded, not hidden

The seed keeps bounded attempts. If `cpa`, the selected model, the runtime, or network access fails after the bounded attempts, evidence SHALL be `handoff-blocked` or `degraded` with response status/payload excerpts. Deterministic code/config drift discovered during the run may be fixed directly; credential or upstream-service failures are recorded for handoff.

## Risks / Trade-offs

- Real LLM seed can be slow or unavailable -> keep the target focused, bounded, and evidence-producing.
- Persisted evidence could leak secrets -> write only redacted JSON and reuse the existing redaction helper for both attachment and persistent copies.
- A passing seed can be overinterpreted -> keep matrix and docs explicit that `seed-covered` is not module-specific proof.
- Output directory misuse could write outside the repo -> this is opt-in test infrastructure; files are redacted and named by sanitized run id plus evidence name.

## Migration Plan

1. Add persistent evidence support behind `DECK_GO_REAL_E2E_EVIDENCE_DIR`.
2. Add a focused Makefile target for the seed smoke.
3. Extend helper coverage for persistent evidence redaction.
4. Run the focused seed target with a temporary evidence directory.
5. Update the head matrix child status to `archived` after this change passes validation and is archived.

Rollback is straightforward: remove the Makefile target and persistent-evidence branch. The production application surface is unchanged.

## Open Questions

- None for this child proposal. Later module proposals still decide which capabilities need fixture-level real proof beyond `seed-covered`.
