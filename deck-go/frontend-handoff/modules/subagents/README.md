# subagents - high-fidelity handoff

**Status:** `implemented (sha pending-final-commit)`
**Protocol version:** `protocol-v1`
**Active visual target:** [`./prototype.html`](./prototype.html)
**OpenSpec change:** `frontend-subagents-hifi-contract-redesign`

This package defines the visual and interaction target used for the `subagents/`
module rewrite in `frontend-new`. The previous production panel was functional
and had useful behavior, but this package is the visual truth for the
high-fidelity pass. Code and contracts remain the final authority when a handoff
note drifts.

## What this module does

`subagents/` is the operations workbench for child-agent runs created by
OpenClaw agents. Operators use it to scan active and historical runs, filter by
child or requester agent, select a run, inspect lineage, steer an active run,
kill an active run after confirmation, inspect raw payloads, and maintain global
`agents.defaults.subagents` settings.

The design is compact and work-focused. It repeats the chat/agents/routing
typography and token posture while keeping subagent run rows, lineage nodes, and
spawn-default controls local until a separate design-system proposal promotes
them.

## Contract truth

Production and mocks must use the current Deck-facing DTOs:

- `DeckGoSubagentRun`
- `DeckGoSubagentsListResponse`
- `DeckGoSubagentLineageRoot`
- `DeckGoSubagentLineageNode`
- `DeckGoSubagentsLineageResponse`
- `DeckGoSubagentKillResponse`
- `DeckGoSubagentSteerResponse`
- `DeckGoAgentSubagentConfigResponse`
- `DeckGoConfigSnapshotResponse`
- `DeckGoConfigApplyResponse`

Endpoint truth:

- `GET /deck/subagents` with optional `status`, `agentId`,
  `requesterAgentId`, `limit`, and `offset` query filters.
- `POST /deck/subagents` with action envelopes: `lineage`, `kill`, and
  `steer`.
- Global defaults are edited through existing config get/apply wrappers, not a
  dedicated subagents mutation route.

## Depends on canonical atoms

`Badge`, `Banner`, `Button`, `Card`, `Chip`, `Input`, `Select`,
`SegmentedControl`, `Spinner`, `Textarea`, and `Toggle` where production fit is
straightforward.

No canonical atom or token is required by this handoff. Local molecules:

- subagent metric tile
- run queue row
- selected run hero
- lineage node/timeline
- config defaults grid
- per-agent permission row
- action result strip

## How to implement

1. Open `prototype.html` and inspect ready, history, config, empty, and error
   states with the toolbar controls.
2. Read `api-usage.md` before touching mocks, API wrappers, or backend
   forwarding.
3. Translate the prototype into `frontend-new/src/components/panels/subagents/`,
   preserving existing wrappers, navigation helpers, polling, and confirmation
   gates.
4. Keep raw endpoint/action strings inside `frontend-new/src/api.ts` or tests
   only.
5. Add mock visual E2E with contract-shaped data and label evidence as mock
   visual coverage.
6. Update `implementation-notes.md` with any production divergence and
   design-system feedback.

## Open questions for follow-up

- Whether subagent history should support durable server-side pagination beyond
  the current `limit`/`offset` contract.
- Whether lineage should expose per-node logs or stream state instead of static
  nodes.
- Whether `steer` should return a richer action outcome for UI copy.
- Whether global subagent defaults should eventually have a typed dedicated BFF
  route rather than config get/apply.
- Whether metric tiles, run rows, selected heroes, and section headers should be
  promoted after agents, routing, and subagents repeat them.
