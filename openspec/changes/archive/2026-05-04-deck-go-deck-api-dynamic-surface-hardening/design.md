## Context

Deck-facing DTOs are the product contract between the Go BFF and `frontend-new`. They are generated from `deck-go/contracts/source/deck-api.contract.ts`, but the current source still contains many broad `Record<string, unknown>`, `unknown`, and index-signature leaves. Some are legitimate because Deck must carry Gateway JSON schemas, plugin data, config fragments, canvas payloads, or action-specific results. Others are stable product fields that should be named so frontend work can rely on generated contracts.

The previous child proposal hardened Gateway method coverage. This change works one layer above that: it does not mirror Gateway contracts directly; it decides which Deck-facing fields are product DTOs and which are intentional dynamic envelopes.

## Goals / Non-Goals

**Goals:**

- Produce an auditable inventory of Deck-facing dynamic leaves.
- Narrow deterministic stable product gaps when code truth makes the shape clear.
- Preserve dynamic leaves that are genuinely extension, plugin, schema, config, or action envelopes.
- Make every remaining dynamic leaf intentional and documented with an owner, reason, and exit criteria.
- Keep generated TS/Go Deck API artifacts synchronized with source contract changes.

**Non-Goals:**

- Do not remove legitimate extensibility or plugin passthrough envelopes.
- Do not invent new Gateway APIs or new product behavior.
- Do not attempt to type every action-specific payload in this proposal; module completion proposals own deeper payload specialization.
- Do not rewrite frontend panels for visual parity; only update facades/types where contract changes require it.

## Decisions

### Decision: Dynamic leaves need a Deck-facing classification

Dynamic leaves are allowed only when they have a named classification such as `gateway-schema-envelope`, `config-fragment`, `plugin-payload`, `extension-envelope`, `action-result-envelope`, `canvas-payload`, or `deferred-product-dto`. This avoids treating all `unknown` usage as either automatically bad or automatically acceptable.

### Decision: Deterministic narrowing happens only when product shape is already code truth

If backend adapters, generated Gateway bindings, tests, and frontend usage all imply the same stable fields, narrow the DTO in `deck-api.contract.ts` and regenerate artifacts. If shape depends on module-specific product decisions or Gateway evolution, keep it dynamic with explicit exit criteria for the responsible follow-up proposal.

### Decision: A generated report becomes the governance evidence

The implementation should add or update a small contract-gate report that lists dynamic Deck API leaves and their classification. The report is evidence; the source of truth remains code and contract source. The check should fail when a new dynamic leaf is introduced without classification.

### Decision: Frontend facades should consume generated DTOs where available

When a route already has a named generated DTO, `frontend-new/src/api.ts` should not return `Record<string, unknown>` unless the contract classification says the route is intentionally dynamic.

## Risks / Trade-offs

- **Risk: over-narrowing extension payloads** -> Preserve intentional envelopes and require module proposals for deeper specialization.
- **Risk: text scanning misses TypeScript shapes** -> Keep the report conservative and pair it with generated artifact checks; upgrade parsing later if needed.
- **Risk: broad blast radius in generated artifacts** -> Prefer small deterministic DTO changes and run `make contract-gate`.
- **Risk: dynamic leaves become permanently accepted** -> Every documented dynamic exception must include owner and exit criteria so later proposals can retire it.

## Migration Plan

1. Audit current dynamic leaves in `deck-api.contract.ts`, generated artifacts, backend adapters, and frontend facade returns.
2. Add a dynamic-surface classification source and generated report/check, or update an existing governance surface if one already exists.
3. Narrow safe stable DTO gaps and update affected backend/frontend code.
4. Regenerate Deck API artifacts and reports.
5. Update the head matrix status and verification evidence.
