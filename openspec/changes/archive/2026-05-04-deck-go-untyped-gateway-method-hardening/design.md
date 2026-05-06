## Context

`deck-go-gateway-describe-and-schema-completeness` now reports Gateway method schema coverage. It shows 45 untyped methods in the full Gateway registry, but only eight are documented deck-go P0 control-chain exceptions:

- `tools.catalog`
- `tools.effective`
- `exec.approval.list`
- `plugin.approval.list`
- `logs.tail`
- `commands.list`
- `node.invoke`
- `node.pending.enqueue`

Several of these already have params/result schemas in `src/gateway/protocol/schema/**`; they are untyped because their method metadata was not wired into runtime/static metadata. The remaining approval list and node invoke surfaces need typed outer envelopes.

## Goals / Non-Goals

**Goals:**

- Remove the eight documented P0 untyped Gateway method exceptions when their contracts are hardened.
- Preserve intentionally dynamic inner payloads behind typed outer envelopes.
- Keep method behavior unchanged.
- Regenerate deck-go Gateway protocol artifacts and reports.
- Update the head matrix and the completeness report so the next child proposals see the narrowed surface.

**Non-Goals:**

- Do not harden every untyped Gateway method in the full registry.
- Do not add new Gateway APIs.
- Do not redesign node action-specific payloads; use typed outer envelopes first.
- Do not add product audit/history or list-query semantics; those belong to later platform-control proposals.

## Decisions

### Decision: Reuse existing schemas before adding new ones

Logs, commands, tools, and node pending enqueue already have schemas. This change should wire those schemas into method metadata rather than redefining DTOs.

### Decision: Approval list schemas can use typed outer records with dynamic request bodies

Approval list handlers return arrays of pending records. The record envelope is stable (`id`, `request`, `createdAtMs`, `expiresAtMs`), while the request body can remain dynamic until approval-product completion. This is enough to stop treating the whole method as untyped.

### Decision: node.invoke gets a typed outer result envelope

`node.invoke` has action-specific payloads. The correct first contract is a stable outer envelope (`ok`, `nodeId`, `command`, `payload`, `payloadJSON`) with dynamic payload contents. Action-specific payload schemas remain a follow-up for `deck-go-nodes-command-contract-completion`.

### Decision: Exception removal is part of verification

Resolved methods should be removed from `deck-go/contracts/source/deck-exceptions.contract.json`; generated exception docs and completeness docs become the evidence that the P0 set is no longer unresolved.

## Risks / Trade-offs

- Typed outer envelopes can hide inner payload ambiguity -> keep module follow-up items for action-specific payloads.
- Generated Go aliases for array result schemas may expose broad shapes -> verify generated code and focused tests.
- Runtime method metadata and side-effect-free metadata can drift again -> keep the describe completeness gate in contract-gate.

## Migration Plan

1. Add missing result schemas for approval list and node invoke where needed.
2. Wire method metadata for the eight documented P0 methods.
3. Remove resolved exception records and regenerate generated artifacts/docs.
4. Run focused Gateway describe tests, deck-go contract gate, OpenSpec validation, and diff checks.
