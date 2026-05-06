## Why

Deck Go now has route governance, config-write safety, in-process audit history, and safe real E2E fixture helpers, but module-level create/update/delete actions still return inconsistent success/error/conflict evidence. Downstream module completion proposals need one product-level mutation evidence contract so frontend panels, BFF handlers, audit entries, and real E2E fixtures can prove writes without inventing per-module semantics.

## What Changes

- Add a Deck-owned safe mutation evidence contract for non-read control actions, covering request IDs, idempotency truth, result status, target identity, conflict/degraded states, audit linkage, and fixture safety.
- Generate Markdown documentation and frontend-readable TypeScript metadata from the mutation evidence source contract.
- Introduce shared frontend helpers for mutation results/errors so panels can detect conflicts, preserve local edits, and attach request evidence consistently.
- Normalize representative local writable surfaces that are already fixture-safe: budget rules, alert rules, and webhooks.
- Record unsupported or unsafe mutation classes as skipped-safe/deferred instead of presenting mock-only writes as fully verified.
- Update the contract-chain audit matrix and head proposal evidence when this child is archived.

## Capabilities

### New Capabilities

- `deck-go-safe-mutation-evidence-contract`: Product-level contract for Deck Go control mutations, including request/result/error evidence, audit linkage, idempotency truth, and safe fixture verification status.

### Modified Capabilities

- None.

## Impact

- Affected contracts: new mutation evidence source contract, generated docs, generated TypeScript metadata, and contract gate.
- Affected backend: existing BFF mutation handlers and audit middleware only where deterministic evidence gaps are clear for already safe surfaces.
- Affected frontend: shared mutation evidence helper plus representative mutation facades for budget, alerts, and webhooks.
- Affected tests: contract generator tests, focused frontend helper/API tests, and backend tests for representative mutation evidence/audit behavior when practical.
- No new OpenClaw Gateway APIs are introduced. Existing Gateway-backed mutations remain governed by current Gateway/Deck contracts, and unsafe fixture classes remain deferred.
