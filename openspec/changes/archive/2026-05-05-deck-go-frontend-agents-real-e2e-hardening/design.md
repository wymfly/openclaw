## Context

Agents is the sample module for the prototype remediation program. Its archived
parity proposal is still valid for mock prototype alignment, but its real
Gateway evidence was intentionally read-only because disposable mutation
fixtures were not yet part of the standard.

The current real E2E helper already isolates OpenClaw state by copying the
source `openclaw.json` into a temporary state directory and rewriting agent
workspaces. That makes run-scoped agents safe to create and clean up through the
Deck BFF or Gateway RPC path, as long as cleanup refuses non-run-scoped ids.

## Decisions

### D1: Preserve null selection on live events

`selectedAgentId: null` is an explicit list-view state. Live projection events
may update agent metrics, but they must not choose a default agent while the
operator is looking at the list.

Alternative considered: special-case only the back button. Rejected because any
route that intentionally has no selected agent should remain stable.

### D2: Seed agents through the Deck BFF in isolated real E2E

The real E2E test will create a run-scoped agent through the same `/api/agents`
BFF route used by the frontend, then clean it up through the delete route. This
tests Deck's product contract while avoiding direct browser-to-Gateway access.

Alternative considered: hand-edit the isolated `openclaw.json` before startup.
Rejected for agents because the BFF path is available, typed, reversible, and
closer to the user workflow.

### D3: Validate variants as product smokes, not pixel parity

The strengthened real E2E test will assert that light/dark and zh/en variants
render meaningful localized content and maintain clean BFF responses. It will
not try to pixel-match real Gateway pages against prototypes because real data
can legitimately differ from mock visual states.

## Risks / Trade-offs

- Real Gateway startup can be slow. The test keeps the existing bounded
  beforeAll timeout and records failures as real E2E evidence rather than
  hiding them.
- Agent mutation tests write to isolated state. Cleanup uses run-scoped ids and
  `deleteFiles=true` semantics through the BFF path, so it must not target
  global user agents.
- Detail child sections can be partially empty depending on real Gateway data.
  Interactivity assertions focus on visible tabs, controls, and reload/recompute
  actions rather than requiring specific upstream content volume.

## Verification Plan

1. Run focused agents store tests.
2. Run the agents real Gateway Playwright spec with
   `DECK_GO_REAL_GATEWAY_E2E=1`.
3. Run `make frontend-build`.
4. Validate this child change and the head change with `openspec validate`.
