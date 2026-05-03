## Why

Routing is the next non-chat module to converge because it sits directly on the agent identity and channel matching contract chain, but the current `frontend-new` panel has no high-fidelity handoff package and still renders as a dense legacy shell. This change establishes a contract-led visual target first, then rewrites the production routing UI against the current Deck/Gateway truth with mock visual verification.

## What Changes

- Create a routing handoff package under `deck-go/frontend-handoff/modules/routing/` with a high-fidelity prototype and the required protocol documents.
- Redesign `deck-go/frontend-new/src/components/panels/routing/` into an enterprise routing workbench that exposes binding order, conflict risk, DM scope, route simulation, mutation envelopes, and recent activity without inventing unsupported backend fields.
- Add or adjust mock Gateway fixtures and a focused mock visual E2E so routing can be visually verified without a real Gateway/LLM dependency.
- Preserve deterministic contract/API behavior that is already correct, including `/deck/routing` BFF envelopes and `DeckGoRouting*` DTOs; document uncertain product or Gateway gaps as handoff notes instead of guessing.
- Record routing-specific design-system feedback in the cross-module readiness record.

## Capabilities

### New Capabilities

- `frontend-routing-hifi-redesign`: Covers the routing module handoff package, production routing panel rewrite, contract-shaped mocks, and mock visual evidence.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds routing as the second completed high-fidelity module and records which agents-local molecules should remain local or be promoted after routing evidence.

## Impact

- `deck-go/frontend-handoff/modules/routing/`
- `deck-go/frontend-new/src/components/panels/routing/`
- `deck-go/frontend-new/src/api.ts` and routing DTO consumers only if deterministic drift is found
- `deck-go/test/fixtures/mock-gateway.mjs` and focused Playwright visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-routing-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
