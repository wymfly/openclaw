## Context

Nodes is Deck's device trust and remote-control workbench. The current contract
chain is:

`NodesPanel` -> `frontend-new/src/api.ts` wrappers -> Deck BFF routes:

- `GET /api/nodes`;
- `POST /api/nodes` action=`describe`;
- `POST /api/nodes` action=`rename`;
- `POST /api/nodes` action=`invoke`;
- `POST /api/nodes` action=`pending.enqueue`;
- `GET /api/nodes/pair`;
- `POST /api/nodes/pair` action=`request`;
- `POST /api/nodes/pair` action=`approve`;
- `POST /api/nodes/pair` action=`reject`;
- `POST /api/nodes/pair` action=`verify`.

Those routes adapt Gateway node inventory, node detail, pairing, remote command,
and pending-work methods through the deck-go backend. Deck-facing DTO authority
lives in `contracts/source/deck-api.contract.ts`; dynamic payload leaves are
declared in `contracts/source/deck-api-dynamic-surfaces.contract.json`.

The active visual target is
`frontend-handoff/modules/nodes/prototype.html`. Production already exposes a
two-pane operations workbench, but the head matrix has not verified strict
prototype parity or strengthened real Gateway product-flow evidence.

## Goals / Non-Goals

**Goals:**

- Confirm the active Nodes prototype and reconcile it with current Gateway,
  BFF, Deck-facing DTO, mutation, and dynamic-surface contract truth.
- Audit production Nodes code, handoff files, mock fixtures, and real E2E
  against the strengthened head remediation standard.
- Fix deterministic visual, interaction, i18n, fixture, route-wrapper,
  mutation-evidence, or documentation drift when supported by code truth.
- Preserve BFF-only browser access for inventory, detail, pairing, rename,
  invoke, pending-work, and verification data.
- Exercise representative real product data through route shapes and, when
  safely available, real node/pairing data.
- Validate that non-disposable device mutations remain confirmation-gated and
  skipped-safe unless a disposable node/pairing fixture and cleanup proof exist.
- Upgrade mock visual and real Gateway E2E to cover shell navigation, all four
  localized theme variants, safe child interactions, route-shape evidence,
  BFF-only transport, unexpected-error evidence, and accepted exceptions.
- Update Nodes implementation notes, the remediation matrix, and head task
  `6.8`.

**Non-Goals:**

- Do not implement Gateway command-specific schemas or generated command forms.
- Do not add polling or websocket push unless already present and deterministic.
- Do not execute real rename/invoke/pending/pair approve/reject mutations
  against user/device state without disposable fixtures and cleanup proof.
- Do not build QR/camera pairing token UX, bulk actions, or pairing audit feed
  integration in this pass.
- Do not replace the production module wholesale with prototype files.

## Decisions

### D1: Nodes is a trust and remote-control surface

The prototype is the visual and interaction reference, but the Deck/Gateway/BFF
contract truth wins. The panel is not a compute-resource inventory and must not
invent CPU/load/region semantics that Gateway does not provide.

### D2: Dynamic envelopes stay dynamic

`node.invoke` and `node.pending.enqueue` have typed outer envelopes, but command
payload leaves are intentionally dynamic. The UI keeps a freeform JSON textarea
validated by `JSON.parse`, then renders BFF responses verbatim.

### D3: Real device mutations are skipped-safe by default

List, detail, pair-list, and safe shape checks are valid real evidence. Rename,
invoke, pending enqueue, approve, reject, request, and verify only become real
mutation evidence when the test owns a disposable node/pairing fixture and
cleanup proof. Otherwise they remain confirmation-gated and skipped-safe.

### D4: Browser transport remains BFF-only

Nodes browser code may call relative `/api/*` routes through the frontend API
facade, but it must not call the Gateway port directly.

## Risks / Trade-offs

- **Risk: real stack has no paired nodes or pending pair requests.** -> Verify
  route shapes and empty/degraded UI states, and record skipped-safe fixture
  evidence instead of fabricating devices.
- **Risk: real mutations affect user/device state.** -> Exercise confirmation
  gates in UI and use non-existent ids only for bounded route-shape checks
  unless disposable fixtures exist.
- **Risk: command payloads are unknown.** -> Keep dynamic envelope UI honest;
  do not generate fake forms.
- **Risk: prototype static density exceeds real data.** -> Preserve prototype
  shape in mock evidence and record real empty/degraded states as environment
  truth.

## Migration Plan

1. Audit prototype files, production Nodes code, contract sources, BFF routes,
   mock Gateway support, visual spec, real E2E, and mutation-evidence policy.
2. Patch deterministic Nodes UI, i18n, API facade, fixture, mutation guard, or
   documentation drift.
3. Upgrade mock visual E2E to capture selected node, pairing repair/orphan,
   invoke result, pending-work result, confirm states, and all required
   localized theme variants.
4. Upgrade real Gateway E2E to verify route shapes, shell navigation, all
   localized theme variants, safe child interactions, BFF-only transport,
   unexpected-error evidence, and skipped-safe mutation policy.
5. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether Gateway should expose command-specific schemas through a future
  `node.commands.describe`.
- Whether pairing audit events belong in Activity or a dedicated Nodes audit
  surface.
- Whether production should use polling, websocket push, or manual refresh for
  node inventory.
- Whether QR/camera token verification and bulk pairing actions belong in a
  later product proposal.
