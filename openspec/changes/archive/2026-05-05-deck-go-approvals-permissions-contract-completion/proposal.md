## Why

Approvals already has a production UI and safe real read-path evidence, but the
head matrix still marks the module degraded because its approval queue schema
status is stale and product-visible policy/decision actions are not closed
against mutation evidence. Current Gateway truth shows typed exec/plugin queue
methods exist, while Deck's TypeScript protocol generator incorrectly emits
array-of-object results as interfaces followed by `[]`.

This child proposal closes the deterministic Approvals contract-chain drift
without introducing new Gateway APIs.

## What Changes

- Re-audit Approvals workflows against current Gateway approval schemas/method
  definitions, generated Gateway artifacts, Deck BFF routes, Deck-facing DTOs,
  frontend facades, prior L1/L2 evidence, and handoff notes.
- Fix Gateway TypeScript protocol generation for array-of-object result types
  so approval queue results are emitted as array type aliases rather than
  invalid-looking object interfaces.
- Add the existing `plugin.approval.resolve` result schema because the Gateway
  handler already responds with `{ ok: true }`.
- Add Deck-facing mutation evidence for approval policy save, exec decision
  resolution, and plugin decision resolution.
- Route representative Approvals action facades through shared mutation
  evidence helpers and correct policy-save return typing.
- Update Approvals implementation notes, the contract-chain audit matrix,
  generated matrix Markdown, and head verification evidence.

## Capabilities

### New Capabilities

- `deck-go-approvals-permissions-contract-completion`: Completes the Approvals
  module contract-chain by mapping exec/plugin queues, policy reads/writes,
  decision resolution, SSE refresh, unsupported reason capture, and unsupported
  recent-summary projections to Gateway-backed or explicitly unsupported
  Deck-facing contracts and evidence.

### Modified Capabilities

- `deck-go-gateway-protocol-full-alignment`: Narrows protocol codegen drift for
  array-of-object schemas and adds a result schema for the existing plugin
  approval resolve method.

## Impact

- Affected Gateway protocol schema/source:
  `src/gateway/protocol/schema/plugin-approvals.ts`,
  `src/gateway/protocol/schema/protocol-schemas.ts`, and
  `src/gateway/server-methods/control-plane-method-defs.ts`.
- Affected contract generation:
  `deck-go/contracts/scripts/protocol-common.ts`, generated Gateway TS/Go
  artifacts, Deck API DTO source/generated artifacts, and mutation evidence
  metadata/docs.
- Affected frontend: `frontend-new/src/api.ts`, API type shims, Approvals/API
  focused tests, and mutation evidence helper coverage.
- Affected docs/evidence: Approvals implementation notes, contract-chain audit
  matrix, generated matrix Markdown, and head proposal verification evidence.
- No new Gateway APIs, queue summary RPCs, recent decision audit stream, or
  decision-reason params are introduced.
