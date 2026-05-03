# threads - high-fidelity handoff

**Status:** `implemented (sha pending-final-commit)`
**Protocol version:** `protocol-v1`
**Active visual target:** [`./prototype.html`](./prototype.html)
**OpenSpec change:** `frontend-threads-hifi-contract-redesign`

This package defines the visual and interaction target for the `threads/`
module rewrite in `frontend-new`. The current panel already reaches the thread
contract chain, but its layout is still an old dense table/detail shell. Code
and contracts remain the final authority when this handoff drifts.

## What this module does

`threads/` is the relationship workspace for platform thread bindings. Operators
use it to answer: which Discord or channel thread is bound, which OpenClaw
session key it targets, which agent receives the messages, who/what created the
binding, and when the relationship last moved.

The design keeps filter state, inventory health, selected thread identity, the
thread -> session -> agent relationship, metadata, and handoff actions in the
first viewport. It is intentionally more compact than a generic table because
the contract is a relationship list, not a full data-grid surface.

## Contract truth

Production and mocks must use the current generated Gateway and Deck-facing
DTOs:

- `DeckThreadsListParams`
- `DeckThreadsListResult`
- `DeckGoThreadEntry`
- `DeckGoThreadsResponse`

Endpoint/RPC truth:

- Gateway: `deck.threads.list`
- Go BFF: `GET /api/deck/threads?agentId=&channel=&status=`
- Frontend wrapper: `fetchThreads(params)`

Browser code must continue through `frontend-new/src/api.ts` and the Deck
backend. It must not call Gateway RPC directly.

## Workflow constraints

- Visual convergence is the goal of this module pass: mock + frontend should
  become stable against the contract and design system.
- Code truth wins over this handoff when the two disagree.
- Deterministic fixture/API drift may be fixed in this change. Uncertain real
  Gateway thread-source behavior must be recorded as follow-up instead of
  invented in the UI.
- Filters are contract-shaped only: `agentId`, `channel`, and `status` where
  status is `active` or `all`.
- Selection should remain stable after refresh if the selected thread still
  exists; otherwise select the most recently active thread.
- Clipboard failure must still give the operator a visible session-key fallback.
- No new Gateway endpoints, new dependencies, table libraries, or canonical atom
  promotion are part of this handoff.

## Depends on canonical atoms

`Badge`, `Button`, `Card`, `Chip`, `Code`, `Input`, `SegmentedControl`,
`Select`, `Spinner`, `Tag`, and `JsonTree` can be used where production fit is
straightforward.

No canonical atom or token is required by this handoff. Local molecules:

- thread metric tile
- filter rail
- thread inventory row
- selected relationship map
- selected thread hero
- handoff action strip
- payload disclosure
- mock visual evidence banner

## How to implement

1. Open `prototype.html` and inspect ready, selected, filtered, clipboard
   fallback, empty, loading, and error states.
2. Read `api-usage.md` before touching mocks, API wrappers, or backend
   behavior.
3. Translate the prototype into `frontend-new/src/components/panels/threads/`,
   preserving API wrapper use, filter normalization, selection stability,
   copy/open handoffs, and payload detail.
4. Move Threads styling out of global `theme.css` into module-local CSS.
5. Add mock visual E2E with contract-shaped data and label evidence as mock
   visual coverage.

## Open questions for follow-up

- Real Gateway projection currently reads persisted Discord thread bindings; it
  is unclear whether non-Discord thread sources will become supported by the
  same `deck.threads.list` shape or a broader route.
- The `status` filter accepts `active` or `all`, but the current projection does
  not expose inactive/archived rows with a separate status field. The UI should
  not invent one.
- It is unclear whether `label` is stable enough for primary identity, so the UI
  must keep `threadId` visible even when a label exists.
- Thread inventory rows, relationship maps, and handoff action strips may become
  shared patterns after more observe/control modules validate the same API.
