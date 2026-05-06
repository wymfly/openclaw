## Context

Routing is Deck's agent route-binding workbench. The current contract chain is:

`RoutingPanel` -> `frontend-new/src/api.ts` wrappers -> Deck BFF routes:

- `GET /api/deck/routing`;
- `POST /api/deck/routing` action=`validate`;
- `POST /api/deck/routing` action=`add`;
- `POST /api/deck/routing` action=`remove`;
- `POST /api/deck/routing` action=`simulate`;
- DM scope mutation through the config patch wrapper;
- shared `GET /api/activity` projection for routing-relevant activity.

Those routes adapt typed `deck.routing.*` Gateway methods and the config patch
path through the deck-go backend. Deck-facing DTO authority lives in
`contracts/source/deck-api.contract.ts`.

The active visual target is
`frontend-handoff/modules/routing/prototype.html`. Production already exposes a
queue/detail workbench, but the head matrix has not verified strict prototype
parity or strengthened real Gateway product-flow evidence.

## Goals / Non-Goals

**Goals:**

- Confirm the active Routing prototype and reconcile it with current Gateway,
  BFF, Deck-facing DTO, mutation, config-hash, and activity contract truth.
- Audit production Routing code, handoff files, mock fixtures, and real E2E
  against the strengthened head remediation standard.
- Fix deterministic visual, interaction, i18n, fixture, route-wrapper,
  mutation-evidence, or documentation drift when supported by code truth.
- Preserve BFF-only browser access for list, validate, add, remove, simulate,
  DM scope patch, and activity projection.
- Exercise representative real product data through route shapes and, when
  safely available, run-scoped add/remove fixture data.
- Validate that persistent config mutations remain confirmation-gated and
  skipped-safe unless the test owns a reversible run-scoped binding and cleanup
  proof.
- Upgrade mock visual and real Gateway E2E to cover shell navigation, all four
  localized theme variants, safe child interactions, route-shape evidence,
  BFF-only transport, unexpected-error evidence, and accepted exceptions.
- Update Routing implementation notes, the remediation matrix, and head task
  `6.9`.

**Non-Goals:**

- Do not add a first-class reorder contract; keep move as remove+add.
- Do not add conflict severity, simulation reasons, stable backend binding IDs,
  URL-persistent filters, bulk actions, or server-side activity filters.
- Do not mutate user routing config without run-scoped add/remove cleanup proof.
- Do not replace the production module wholesale with prototype files.

## Decisions

### D1: Routing is a typed config-hash workbench

The prototype is the visual and interaction reference, but the Deck/Gateway/BFF
contract truth wins. All persistent mutations must carry the current
`configHash` and surface the resulting hash or hash mismatch.

### D2: Reorder remains a workaround

The UI may support move as remove+add because no first-class Gateway reorder
method exists. Evidence must record that this remains a follow-up contract
question.

### D3: Real config mutations require cleanup proof

Add/remove can become real mutation evidence only when the test creates a
run-scoped binding and deletes exactly that binding. Otherwise mutation actions
remain confirmation-gated and skipped-safe.

### D4: Browser transport remains BFF-only

Routing browser code may call relative `/api/*` routes through the frontend API
facade, but it must not call the Gateway port directly.

## Risks / Trade-offs

- **Risk: real stack has no route bindings.** -> Verify route shapes and
  empty/degraded UI states, and try a run-scoped add/remove fixture when a
  usable configHash exists.
- **Risk: add/remove changes user config.** -> Use isolated real stack, run-id
  names, current hash, and cleanup-by-id; otherwise record skipped-safe.
- **Risk: move partial failure.** -> Keep accepted exception for no first-class
  reorder action.
- **Risk: activity feed is empty.** -> Treat empty projection as valid, but do
  not claim durable route history.

## Migration Plan

1. Audit prototype files, production Routing code, contract sources, BFF routes,
   mock Gateway support, visual spec, real E2E, and mutation-evidence policy.
2. Patch deterministic Routing UI, i18n, API facade, fixture, mutation guard, or
   documentation drift.
3. Upgrade mock visual E2E to capture queue, selected binding, draft, remove,
   DM scope, simulation, activity, confirmation states, and all required
   localized theme variants.
4. Upgrade real Gateway E2E to verify route shapes, shell navigation, all
   localized theme variants, safe child interactions, BFF-only transport,
   unexpected-error evidence, and safe add/remove fixture or skipped-safe
   mutation policy.
5. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether Gateway should expose `deck.routing.reorder`.
- Whether validation should return severity and ownership metadata.
- Whether simulation tiers should include human-readable reasons.
- Whether routing activity should become a dedicated server-side filtered feed.
