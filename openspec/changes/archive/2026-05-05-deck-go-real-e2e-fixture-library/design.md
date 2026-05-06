## Context

The real E2E foundation already provides `buildRunScopedName`, `filterRunScopedResources`, and `assertRunScopedCleanupTarget`. Budget, alerts, and webhooks specs independently create and delete resources with run-id names. The matrix calls this out as a follow-up because future writable module proposals need a shared safety surface rather than copy/paste cleanup logic.

## Goals / Non-Goals

**Goals:**

- Centralize creation and cleanup helpers for the writable resource types already proven safe in current real specs.
- Require run-id evidence before cleanup deletes a resource.
- Preserve the current real specs' behavior while removing duplicate fixture code.
- Leave unsupported or higher-risk mutation classes as skipped-safe.

**Non-Goals:**

- Do not add create/delete helpers for agents, cron, routing, or docs until their module proposals prove safe cleanup semantics.
- Do not add production-only test APIs.
- Do not standardize real E2E reporting beyond fixture lifecycle evidence.
- Do not change product behavior or frontend rendering.

## Decisions

### Decision: Start with proven writable fixtures

The shared library SHALL initially cover budget rules, alert rules, and webhooks because existing real specs already create and clean those resources through normal BFF routes. This converts proven behavior into reusable infrastructure without inventing new mutation coverage.

### Decision: Cleanup must assert run scope

Every shared cleanup helper SHALL call `assertRunScopedCleanupTarget` on the resource descriptor before issuing a delete call. If a spec loses the run-id marker or tries to delete a non-fixture resource, the helper fails before touching the BFF.

### Decision: Keep local receivers but share webhook fixture flow

Webhook specs still need a local HTTP receiver for delivery tests. The fixture helper owns BFF create/delete and redacted secret expectations; the spec may continue to own the local receiver process because it is test-local infrastructure, not a Deck resource.

### Decision: Do not overgeneralize into a generic CRUD framework

The helper layer SHALL use explicit typed functions for each proven resource class. A generic HTTP CRUD wrapper would be more compact, but explicit functions are easier to review and safer when cleanup rules differ by resource.

## Risks / Trade-offs

- Shared helpers can hide endpoint-specific assertions -> keep resource-specific helper names and payload validation.
- A helper bug could affect multiple specs -> add focused helper tests for cleanup refusal and run-id naming, then keep module specs as integration evidence.
- Some matrix modules remain without fixtures -> record them as deferred/skipped-safe rather than pretending they are covered.

## Migration Plan

1. Add shared fixture helpers for budget, alerts, and webhooks in `test/e2e/helpers.ts`.
2. Update existing real specs to use the shared helpers.
3. Extend foundation helper tests to verify shared fixture naming and cleanup refusal behavior.
4. Run focused helper tests and at least lightweight TypeScript/Playwright coverage for migrated specs where feasible.
5. Update the head matrix and archive this change.

Rollback is straightforward: restore local helper functions in the affected specs. No production state is migrated.

## Open Questions

- Agents, cron, routing, and docs fixtures remain intentionally deferred until their module-specific proposals define safe create/delete semantics.
