# routing - high-fidelity handoff

**Status:** `implemented (sha pending-final-commit)`
**Protocol version:** `protocol-v1`
**Active visual target:** [`./prototype.html`](./prototype.html)
**OpenSpec change:** `frontend-routing-hifi-contract-redesign`

This package is the first full routing handoff package. There was no prior routing prototype under `frontend-handoff/modules/`, so this design starts from the current contract chain and the existing `frontend-new` behavior rather than from a design-agent artifact.

## What this module does

`routing/` is the operational workbench for mapping incoming channel/account/peer/team/guild/role traffic to OpenClaw agents. Operators need to scan the active binding order, notice conflict risk, test a hypothetical inbound message, update the DM scope strategy, and make controlled hash-aware mutations.

The design is dense but divided into clear work zones: overview health, binding queue, selected binding detail, simulator, mutation drawer, and recent activity. It follows the chat/agents typography and token posture while keeping routing-specific rows, conflict badges, and match chips local.

## Contract truth

Production and mocks must use the current Deck-facing DTOs:

- `DeckGoRoutingPeer`
- `DeckGoRoutingMatch`
- `DeckGoRoutingBinding`
- `DeckGoRoutingConflict`
- `DeckGoRoutingListResponse`
- `DeckGoRoutingAddResponse`
- `DeckGoRoutingRemoveResponse`
- `DeckGoRoutingValidateResponse`
- `DeckGoRoutingSimulationTier`
- `DeckGoRoutingSimulateResponse`

Endpoint truth:

- `GET /deck/routing` with optional `agentId`, `channel`, and `accountId` query filters.
- `POST /deck/routing` with action envelopes: `validate`, `add`, `remove`, and `simulate`.
- DM scope patching remains through the existing config patch API.

Gateway truth:

- The Go BFF adapts the route above to `deck.routing.list`, `deck.routing.add`, `deck.routing.remove`, `deck.routing.validate`, and `deck.routing.simulate`.
- `deck.routing.list` is backed by a Deck view that batches `config.get` and `agents.list` when the upstream Gateway path is not directly available.

## Depends on canonical atoms

`Badge`, `Banner`, `Button`, `Card`, `Chip`, `Input`, `SegmentedControl`, `Spinner`, `Select`, and `Textarea` where production fit is straightforward.

No canonical atom or token is required by this handoff. Local molecules:

- routing metric tile
- binding queue row
- match chip row
- conflict marker
- selected binding hero
- simulator tier timeline
- mutation result strip
- compact activity row

## How to implement

1. Open `prototype.html` and inspect ready, add-binding, simulation, and empty/error states.
2. Read `api-usage.md` before touching mocks or API wrappers.
3. Translate the prototype into `frontend-new/src/components/panels/routing/`, preserving existing API wrappers and navigation helpers.
4. Keep raw endpoint/action strings inside `frontend-new/src/api.ts` or tests only.
5. Add mock visual E2E with contract-shaped routing data and label evidence as mock visual coverage.
6. Update `implementation-notes.md` with any production divergence and design-system feedback.

## Open questions for follow-up

- Whether Gateway should expose a first-class reorder action instead of the current remove-plus-add flow.
- Whether backend validation should return a richer conflict severity or conflict ownership model.
- Whether route simulation should include a human-readable tier explanation field.
- Whether binding IDs should become stable backend IDs rather than computed hashes from match content.
- Whether local metric tiles, section headers, and row rhythms should be promoted after subagents repeats the same pattern.
