## Context

The head audit matrix marks `deck-go-gateway-describe-and-schema-completeness` as the first Wave 1/P0 hardening item. Today deck-go protocol generation reads side-effect-free Gateway metadata from `src/gateway/method-registry-data.ts`, while real Gateway environments expose runtime capability truth through `gateway.describe`. Existing checks prove generated artifacts are in sync with static metadata, but they do not explicitly prove that:

- static known method names match runtime registered handlers;
- `gateway.describe` typed/untyped membership matches static metadata;
- params schemas, result schemas, event payload schemas, and documented dynamic exceptions are reported separately;
- methods with params-only or result-only metadata are not mistaken for complete result-schema coverage.

This matters because the next proposal, `deck-go-untyped-gateway-method-hardening`, depends on a reliable inventory of missing or intentionally dynamic schema surfaces.

## Goals / Non-Goals

**Goals:**

- Add a reusable completeness report for Gateway describe/schema evidence.
- Gate static metadata against runtime `gateway.describe` output.
- Produce a deck-go-readable report that separates method presence, typed membership, params schema coverage, result schema coverage, event payload coverage, and exceptions.
- Keep current dynamic surfaces usable when they are documented in `deck-go/contracts/source/deck-exceptions.contract.json`.
- Update the head matrix state for this child proposal as it moves through implementation.

**Non-Goals:**

- Do not add new Gateway methods, events, or RPC behavior.
- Do not resolve all untyped Gateway methods here; that belongs to `deck-go-untyped-gateway-method-hardening`.
- Do not require every method to have a result schema in this proposal; require missing coverage to be visible and documented.
- Do not depend on the operator's real OpenClaw state for the static/runtime comparison.

## Decisions

### Decision: Separate completeness from hardening

This proposal defines the inventory and gates. It should fail on undocumented drift, but it should not force every known dynamic method to become typed. The next proposal consumes the inventory to narrow or type specific methods.

Alternative rejected: directly add result schemas for all missing methods in this proposal. That would mix an evidence foundation with method-specific product/API design and make failures harder to attribute.

### Decision: Compare static metadata to runtime describe through a pure report model

The implementation should build a pure report from:

- static known methods and method metadata;
- static known events and event metadata;
- runtime registry/`gateway.describe` method and event output;
- deck-go exception records.

The report should be usable by focused Vitest coverage and deck-go contract scripts. This keeps the comparison testable without adding product routes or production-only test endpoints.

### Decision: Treat params/result coverage as separate dimensions

Gateway method membership is not enough. A method can be known but lack metadata, typed because it has params but still lack result schema, or typed because it has result schema but no params schema. The report must expose these states separately so Deck-facing contracts do not treat "typed method name" as equivalent to "complete response DTO".

### Decision: Runtime side effects stay isolated

Side-effect-free metadata remains the source for codegen. Runtime registry imports are allowed only in focused tests or Gateway runtime checks where side effects are expected. The deck-go contract gate should not require importing the full Gateway runtime from a generic codegen script.

## Risks / Trade-offs

- Runtime registry imports can pull in optional provider/plugin dependencies -> keep generic contract scripts side-effect-free and run runtime comparison in focused tests.
- Existing methods with intentionally dynamic shapes could make the first gate noisy -> allow documented exceptions and keep the hardening work for the next child proposal.
- A report can become stale if it is prose-only -> generate machine-readable JSON plus Markdown, and include the check in contract verification.

## Migration Plan

1. Add the completeness report model and generator/check script.
2. Add focused Gateway tests proving static metadata and runtime `gateway.describe` stay aligned.
3. Generate deck-go report artifacts for human review.
4. Wire the check into the relevant deck-go contract gate.
5. Update the head matrix proposal status and evidence.
6. Run OpenSpec validation plus focused Gateway/deck-go checks.

Rollback is straightforward: remove the report script/artifacts, the focused tests, and the contract-gate hook. No production data is migrated.

## Open Questions

- Which missing result-schema rows should be promoted from documented exception to typed schema in `deck-go-untyped-gateway-method-hardening`?
- Should event payload exceptions get a dedicated contract file if future Gateway events intentionally remain dynamic?
