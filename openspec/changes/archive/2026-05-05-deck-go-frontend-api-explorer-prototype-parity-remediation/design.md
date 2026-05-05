## Context

The active API Explorer handoff is a multi-file React prototype with a
three-pane workspace and history rail. It is product input, not API authority.
The API authority remains Gateway describe metadata, deck-go generated
contracts, the Go BFF runtime RPC route, and frontend API wrappers.

Prior API Explorer work already made the mock visual spec green after updating
the expected Gateway method count. This child proposal closes the missing
strict visual comparison and repairs any scoped deterministic drift that the
comparison or real Gateway pass exposes.

## Decisions

### D1: `prototype.html` is active

`prototype.html` is the active target for this pass. `prototype-v1-codex.html`
is historical because the module README and latest handoff package describe the
multi-file v2 implementation.

### D2: Gateway describe truth wins over static prototype catalog

If prototype sample data and real/generated Gateway describe data differ,
production follows `fetchGatewayDescribe()` and generated contract truth. The
difference must be recorded as a product-shell, Gateway constraint, or later
enhancement exception rather than silently hardcoded.

### D3: Invocation evidence must be safe

Real Gateway evidence may invoke a low-risk read-only method or a local
describe/list method. Unsafe, mutating, or environment-sensitive invocations
must be skipped or handoff-blocked with evidence.

## Verification Strategy

- Run focused API Explorer frontend tests after UI/API changes.
- Run focused backend/contract checks only if those surfaces are touched.
- Run API Explorer mock visual E2E and generate a prototype-current report.
- Write a structured verdict and accepted-exception ledger.
- Run API Explorer real Gateway E2E if available, with a circuit breaker for
  startup, seed, credentials, or unsafe invocation blockers.
- Run OpenSpec validates before archive.
