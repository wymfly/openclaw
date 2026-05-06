## Context

`nodes.commands` is degraded in the head matrix even though current code truth
has moved forward:

- `node.invoke` has typed params and a typed outer result envelope
  (`ok`, `nodeId`, `command`, `payload`, `payloadJSON`).
- `node.pending.enqueue` has typed params and a typed outer result envelope
  (`nodeId`, `revision`, `queued`, `wakeTriggered`).
- Command-specific invoke payloads remain intentionally dynamic because Gateway
  does not expose per-command schemas.
- Pairing actions and node rename have typed Gateway result schemas, but several
  frontend facades still return generic records and lack mutation evidence.

Prior `frontend-nodes-real-contract-verification` evidence established safe
read-path coverage, bounded safe action-shape checks, BFF-only browser access,
and residual product gaps such as command schema forms, polling/WS refresh, and
pairing audit integration.

## Goals / Non-Goals

**Goals:**

- Reconfirm Nodes inventory, describe, rename, invoke, pending work, and pairing
  workflows against current Gateway, Deck BFF, Deck DTO, frontend facade, test,
  and prior real evidence truth.
- Add Deck-facing action response DTOs for node action facades that currently
  return generic records.
- Add mutation evidence for node rename, invoke, pending enqueue, and pairing
  request/approve/reject/verify.
- Keep command-specific payloads dynamic but bounded by typed outer envelopes
  and generated dynamic-surface docs.
- Update Nodes notes, head matrix, generated matrix Markdown, head evidence, and
  archive this child proposal after validation.

**Non-Goals:**

- Do not add Gateway APIs or command-specific schema discovery.
- Do not add generated command forms, QR/camera token UX, bulk pairing actions,
  node audit feed integration, or live/polling refresh changes in this pass.
- Do not execute destructive real node/device mutations in automated tests
  without disposable device/node fixtures.
- Do not redesign the Nodes UI.

## Decisions

### Decision: Treat typed node invoke and pending enqueue outer envelopes as truth

The old matrix gap is stale. `node.invoke` and `node.pending.enqueue` are typed
at the params/result envelope level; only their command/payload leaves remain
dynamic.

Alternative rejected: keep the whole workflow marked as dynamic/untyped. That
would obscure current Gateway schema coverage and overstate the gap.

### Decision: Keep command payloads dynamic until Gateway exposes command schemas

The product contract can claim a stable invoke/pending envelope, but it cannot
claim payload semantics for every node command.

Alternative rejected: infer payload shapes from examples. That would turn
fixture data into a false contract.

### Decision: Record real node/device mutations as skipped-safe

Rename, invoke, pending enqueue, and pairing mutations can alter real device or
operator trust state. They should be contract-known but not automatically run
against real state without disposable fixtures.

Alternative rejected: run real actions against available nodes. That can alter
operator devices and violates the real E2E isolation rules.

## Risks / Trade-offs

- **Risk:** Adding Deck-facing action DTOs may surface existing dynamic nested
  fields in generated dynamic-surface reports.  
  **Mitigation:** Keep DTOs to stable outer fields and synchronize generated
  dynamic-surface docs when needed.

- **Risk:** Mutation evidence can be read as permission to run real node
  actions.  
  **Mitigation:** Mark fixture safety skipped-safe and keep automated real
  mutation blocked without disposable node fixtures.

- **Risk:** Invoke/pending envelopes are typed but payload semantics remain
  dynamic.  
  **Mitigation:** Preserve dynamic-surface metadata and matrix gap language for
  payload leaves only.

## Migration Plan

1. Create the child OpenSpec artifacts and validate the change scope.
2. Add Deck-facing action response DTOs and regenerate Deck API artifacts.
3. Add Nodes action rows to mutation evidence and regenerate metadata/docs.
4. Refactor representative Nodes action facades through mutation evidence
   helpers and update focused tests.
5. Update Nodes implementation notes, matrix rows, head evidence, and generated
   matrix Markdown.
6. Run focused contract/frontend/build/OpenSpec checks, archive the child
   change, validate the archived spec, then continue the head matrix.
