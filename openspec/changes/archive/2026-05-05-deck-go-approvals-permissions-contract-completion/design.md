## Context

`approvals.queues` is degraded in the head matrix because earlier evidence was
captured before approval list result schemas were fully present in the Gateway
protocol chain. Current code truth is different:

- `exec.approval.list` has params and result schemas.
- `plugin.approval.list` has params and result schemas.
- `exec.approval.resolve` has a typed `{ ok: true }` result schema.
- `plugin.approval.resolve` uses the same shared resolve handler and responds
  `{ ok: true }`, but its method definition still declares no result schema.
- Deck's generated Go Gateway artifacts already model approval list results as
  arrays, while generated TypeScript protocol output incorrectly emits
  `export interface ... { ... }` followed by `[]`.

Prior `frontend-approvals-real-contract-verification` evidence established safe
read-path coverage for policy, exec pending queue, plugin queue, stream
boundary, BFF-only browser access, and unsupported prototype affordances.

## Goals / Non-Goals

**Goals:**

- Reconfirm Approvals queue/policy/decision workflows against current Gateway,
  Deck BFF, Deck DTO, frontend facade, test, and prior real evidence truth.
- Fix the deterministic TypeScript protocol generator bug for array-of-object
  schemas and protect it with a regression test.
- Add the current Gateway result schema for `plugin.approval.resolve`.
- Add mutation evidence rows for policy save, exec decision resolution, and
  plugin decision resolution.
- Preserve the Deck BFF transport boundary and avoid direct browser Gateway
  calls.
- Update Approvals notes, head matrix, generated matrix Markdown, head evidence,
  and archive this child proposal after validation.

**Non-Goals:**

- Do not add new Gateway methods or expand Gateway approval params.
- Do not add decision reason capture, recent decision history, approval summary
  KPIs, or approval audit retention as product-complete features in this pass.
- Do not mutate the operator's real approval policy or resolve real pending
  approvals in automated tests without disposable fixture proof.
- Do not redesign the Approvals UI.

## Decisions

### Decision: Treat current Gateway approval list schemas as truth

The old matrix gap about list methods being upstream-schema-missing is stale.
The correct fix is to repair the generated TypeScript projection and update the
matrix rather than keeping an exception alive.

Alternative rejected: keep approval lists marked as untyped. That hides a
current codegen bug and makes future frontend work over-defensive.

### Decision: Add a plugin approval resolve result schema from handler truth

`plugin.approval.resolve` delegates to the same shared resolver as exec
approvals and already responds with `{ ok: true }` on success. Adding the result
schema documents existing behavior instead of changing runtime behavior.

Alternative rejected: leave plugin resolve as `unknown`. That keeps one approval
decision path weaker than the other without a Gateway-source reason.

### Decision: Record approval decisions as mutation-evidence known but real

fixture skipped-safe

Resolving pending approvals can affect active operator workflows. Evidence
metadata should make the action contract-known while automated real E2E remains
skipped-safe unless a disposable pending approval fixture exists.

Alternative rejected: run real resolve against whatever queue is present. That
could alter operator state and violates the real E2E isolation rules.

### Decision: Record policy save with config-style conflict behavior

Approval policy writes use a `baseHash` and return the updated snapshot. Mutation
evidence should reflect conflict capability and keep real policy mutation
deferred until reversible config state is proven.

Alternative rejected: treat policy save as a validation-only mutation. That
would understate stale-hash behavior already visible in the route contract.

## Risks / Trade-offs

- **Risk:** Protocol codegen fix affects all array-of-object schemas, not just
  approvals.  
  **Mitigation:** Use a narrow generator predicate and run protocol checks plus
  existing generated-artifact tests.

- **Risk:** Adding plugin resolve result schema changes generated clients.  
  **Mitigation:** It matches current shared handler behavior and is verified by
  protocol generation/checks.

- **Risk:** Mutation evidence can be mistaken for permission to run real
  approval decisions.  
  **Mitigation:** Mark decision fixture safety skipped-safe and keep real
  mutation execution blocked without disposable approval fixtures.

## Migration Plan

1. Create the child OpenSpec artifacts and validate the change scope.
2. Fix TypeScript Gateway protocol array type emission and add regression
   coverage.
3. Add `plugin.approval.resolve` result schema and regenerate Gateway protocol
   artifacts.
4. Add Deck approval resolution DTO and approval mutation evidence rows, then
   regenerate Deck API and mutation evidence artifacts.
5. Refactor Approvals API facades through mutation evidence helpers and correct
   policy-save return typing.
6. Update tests, Approvals handoff notes, head matrix, generated matrix
   Markdown, and head verification evidence.
7. Run focused contract/frontend/build/OpenSpec checks, archive the child
   change, validate the archived spec, then continue the head matrix.
