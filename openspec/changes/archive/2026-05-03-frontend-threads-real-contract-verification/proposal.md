## Why

The `threads` handoff is a fresh v2 high-fidelity package, but the production module must be verified against real `deck.threads.list` behavior before it can be treated as a reliable Deck control surface. Threads is especially easy to overbuild because the prototype includes BFF-assumed mutation, recent-activity, and audit flows that are not part of the current typed contract.

## What Changes

- Treat `deck-go/frontend-handoff/modules/threads/` v2 as the visual/product target, but keep production behavior anchored to `DeckGoThreadEntry`, `fetchThreads()`, and `GET /api/deck/threads`.
- Audit the full contract chain from Gateway `deck.threads.list` through generated DTOs, Go BFF query forwarding/projection, frontend wrapper filters, production UI, mock Gateway data, and real-stack behavior.
- Keep supported production workflows focused on list, filter, select, relationship detail, raw entry visibility, copy session key, and cross-panel handoff to Sessions/Agents.
- Fix deterministic Threads-scoped drift directly when backed by evidence, including query parameter naming, mock Gateway filtering, Go forwarding, frontend state, i18n, visual tests, or real-stack handling.
- Record unsupported or ambiguous prototype capabilities rather than fabricating them: unbind/rebind/rename mutations, durable audit history, projected recent activity, transcript rendering, branch indicators, non-Discord channel semantics, and inactive/archive status semantics.
- Add or refresh L1 mock visual evidence and L2 real-stack API/UI evidence. If the real Gateway has no persisted thread bindings, classify the scenario as `real-empty-valid` after proving the BFF returns a valid contract-shaped empty response.

## Capabilities

### New Capabilities

- `frontend-threads-real-contract-verification`: Covers Threads v2 production implementation review, contract-chain audit, deterministic scoped fixes, code-level review, L1 mock visual evidence, L2 real-stack evidence, circuit breaker handling, and handoff of unsupported mutation/activity/audit/transcript semantics.

### Modified Capabilities

- `frontend-threads-hifi-redesign`: Clarifies that the v2 handoff is the visual target, but real completion requires production implementation and contract verification; BFF-assumed mutation/activity/audit capabilities must be simplified or recorded unless verified.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/threads/**`, especially `README.md`, `api-usage.md`, and `implementation-notes.md`.
- **Contracts**: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-endpoints.contract.json`, generated Deck DTOs/docs only if deterministic contract drift is found.
- **Backend**: `deck-go/backend/internal/server/inventory.go`, Gateway query/projection code under `deck-go/backend/internal/runtime/openclaw/`, mock Gateway fixture, and route tests.
- **Frontend**: `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/components/panels/threads/**`, module CSS, panel navigation handoff behavior, and i18n copy.
- **Testing**: focused Threads unit tests, Go route/projection tests, mock visual E2E, and bounded real-stack Threads API/UI E2E.
- **Out of scope**: new Gateway mutation RPCs, durable thread audit storage, transcript/message surface, branch visualization, or persistent non-Discord thread binding semantics unless already supported by Gateway.
