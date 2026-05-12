# Go generated optional JSON semantics audit

- **Source**: Post-review verification of `deck-go-agents-section-ia-convergence`.
- **Category**: contract-chain / generated-code / verification.
- **Status**: deferred.
- **Facts**:
  - Gateway returned `impact.available: false` and omitted `impact.sessions` for unavailable session truth.
  - The Go generated Gateway client decoded the response into value-typed structs, then JSON re-encoding omitted `false` booleans and emitted zero-value optional nested structs such as `sessions: { total: 0 }`.
  - This would have undone the product contract fix at the BFF boundary for `deck.agents.detail` and `deck.agents.impactPreview.get`.
- **Current resolution**:
  - `deck-go/backend/internal/runtime/openclaw/gateway_queries.go` now uses raw `RequestTyped` passthrough for `deck.agents.detail` and `deck.agents.impactPreview.get`, preserving Gateway JSON semantics for these product surfaces.
- **Suggested next step**:
  - Audit generated Go optional object/boolean fields used by BFF passthrough routes.
  - Decide whether the generator should use pointer types for optional booleans/objects, or whether selected read models should intentionally return raw maps.
- **Needs new OpenSpec**: yes, if changing generator semantics globally.
- **Acceptance clues**:
  - A regression test should prove `false` optional booleans and absent optional objects survive Gateway → Go BFF → frontend JSON unchanged.
