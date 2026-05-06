## Context

Deck Go already has several contract governance surfaces:

- `deck-go/contracts/source/deck-api.contract.ts` owns Deck-facing DTOs.
- `deck-go/contracts/source/deck-streams.contract.json` owns SSE/event stream contracts.
- `deck-go/contracts/source/deck-endpoints.contract.json` classifies frontend-visible routes.
- `deck-go/contracts/source/deck-exceptions.contract.json` documents temporary/dynamic exceptions.
- `deck-go/docs/contract-inventory.*` scans server registrations and reports unclassified routes.

The gap is that route classification alone does not prove a route is part of a complete product contract chain. A route can be present in `deck-endpoints.contract.json` while lacking a clear module owner, DTO/stream/exception authority, frontend facade ownership, and verification evidence.

## Goals / Non-Goals

**Goals:**

- Make every registered Deck Go product route traceable to an owner/module.
- Tie each route to one of the allowed contract authorities: Deck API DTO, stream contract, endpoint transport, binary/static transport, or documented exception.
- Require every frontend-consumed route to have a frontend facade reference, while allowing intentional non-frontend/static/SSE routes to say so explicitly.
- Generate a deterministic route governance report and check.
- Keep the report synchronized through `make contract-gate`.
- Fix deterministic drift discovered while implementing the check.

**Non-Goals:**

- Do not introduce new Gateway APIs.
- Do not redesign BFF route behavior or product modules.
- Do not require real E2E success for every route in this proposal; real evidence can point to existing module-level evidence or explicit deferred real-gateway follow-up.
- Do not replace the endpoint classification source; extend or layer governance on top of it.

## Decisions

### Decision: Use route governance records as Deck-side product contract metadata

`deck-endpoints.contract.json` already lists route groups and categories. This change should either enrich that source or add a companion source that reuses those route groups. The source must include owner, contract authority, frontend facade/non-frontend rationale, mock evidence, and real evidence/deferred status.

Alternative considered: infer all ownership from route path prefixes. This was rejected because path prefixes are not enough to distinguish transport routes, gateway adapter routes, legacy aliases, and module-specific product ownership.

### Decision: The check compares source records to actual Go route registrations

The generated report should scan `deck-go/backend/internal/server/**/*.go` for `MethodFunc(...)` registrations and compare normalized method/path pairs against the route governance source. The existing endpoint inventory logic already proves this pattern works; this proposal makes the governance data stricter rather than relying only on category coverage.

Alternative considered: only check frontend API call sites. This was rejected because server-only, SSE, binary, admin, and future routes still need ownership even when they are not called from `frontend-new/src/api.ts`.

### Decision: Contract authority is explicit, not inferred from return type names

Each route group must name its authority kind:

- `deck-api-dto` for `deck-api.contract.ts` DTOs.
- `deck-stream` for SSE/event stream contracts.
- `gateway-transport` for generated Gateway typed transport/batch routes.
- `binary-static` for media/canvas/static transport.
- `documented-exception` for temporary dynamic routes.

This keeps the product-facing contract chain clear without forcing every route to have the same DTO shape.

### Decision: Frontend facade references use `frontend-new`

Route governance must use `deck-go/frontend-new/src/api.ts` and related active frontend files. Legacy `deck-go/frontend/` references in generated docs or source-audited fields are drift and should be corrected when encountered.

## Risks / Trade-offs

- **Risk: large metadata source** -> Keep route records grouped by existing route groups instead of one object per method/path when possible.
- **Risk: false positives from route pattern normalization** -> Reuse the existing route-pattern semantics for `{param}` and `*`, and record unmatched routes explicitly.
- **Risk: evidence becomes busywork** -> Allow module-level evidence paths and deferred real evidence, but require an explicit reason rather than leaving blanks.
- **Risk: generated report duplicates inventory** -> Keep inventory as broad audit and route governance as stricter route-contract evidence.

## Migration Plan

1. Explore current route registrations, endpoint classification, frontend facades, and inventory output.
2. Add or update route governance source fields.
3. Add a sync/check script that generates JSON and Markdown route governance evidence.
4. Wire the check into `contract-gate`.
5. Fix deterministic drift, especially stale `frontend/` references.
6. Refresh inventory and head matrix.
7. Validate, test, archive, and move to the next matrix child proposal.
