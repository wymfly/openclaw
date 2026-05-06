# Routing Implementation Notes

Status: implemented - real-contract verified.

## Contract Matrix

| Workflow        | Frontend wrapper                                       | BFF route                                  | Gateway / backend source                       | Classification                                                   |
| --------------- | ------------------------------------------------------ | ------------------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------- |
| List bindings   | `fetchRoutingBindings(filters)`                        | `GET /api/deck/routing`                    | `deck.routing.list` via Go BFF/runtime adapter | supported; empty-valid when no bindings exist                    |
| Validate draft  | `validateRoutingBinding({ agentId, match })`           | `POST /api/deck/routing` action=`validate` | `deck.routing.validate`                        | supported; `ok=false` is advisory                                |
| Add binding     | `addRoutingBinding({ agentId, match, baseHash, ... })` | `POST /api/deck/routing` action=`add`      | `deck.routing.add`                             | supported; inline confirmation required before wrapper call      |
| Remove binding  | `removeRoutingBinding({ id, baseHash })`               | `POST /api/deck/routing` action=`remove`   | `deck.routing.remove`                          | supported; inline confirmation required before wrapper call      |
| Reorder binding | remove + add wrappers                                  | two `POST /api/deck/routing` calls         | `deck.routing.remove` then `deck.routing.add`  | supported as two-step workaround; no first-class reorder method  |
| Simulate route  | `simulateRouting(payload)`                             | `POST /api/deck/routing` action=`simulate` | `deck.routing.simulate`                        | supported; default fallback is legitimate                        |
| Patch DM scope  | `patchRoutingDmScope(dmScope, baseHash)`               | config patch route                         | `deck.config.patch` / config hash path         | supported; inline confirmation required; mutation-evidence known |
| Activity        | `fetchActivityEvents(20)`                              | shared activity endpoint                   | Deck activity BFF/event feed                   | empty-valid/degraded; not a durable routing hit log              |

## Fixes Made

- Preserved the existing contract-backed production panel rather than rewriting the module from scratch.
- Added the v2 inline confirmation gate for hash-affecting actions: add, remove, reorder, and DM scope patch.
- Changed Add Binding from an always-visible form into a collapsed draft drawer to reduce initial density and match the v2 workbench.
- Kept raw `/deck/routing` action strings inside API wrappers/tests, not view code.
- Expanded focused Go route coverage from list/simulate to list/validate/add/remove/simulate forwarding.
- Refreshed mock visual E2E to cover ready state, draft drawer open/close, remove confirmation cancel, and simulation.
- Added real Gateway Routing E2E for route shapes, safe invalid-hash mutation shape, production render, and BFF-only browser access.

## Residual Risks

- Reorder is still remove + add because no first-class Gateway reorder method exists. A backend transaction or `deck.routing.reorder` would remove the partial-failure window.
- Conflict severity remains client-side/advisory. Gateway does not expose `severity: blocker | warn | info`.
- Simulation tiers do not include human-readable `reason` text; the UI only renders matched/checked/skipped.
- Binding IDs are still whatever the backend returns; the UI does not assume stable semantic IDs.
- Activity is filtered from the shared activity feed and may be empty. It is not a durable route history until the backend exposes one.
- Real E2E avoids committing user config mutations; destructive/persistent add/remove validation is limited to safe invalid-hash route-shape evidence.

## Verification Evidence

- Prototype smoke: `deck-go/frontend-handoff/modules/routing/prototype.html` loaded via local static server; queue, simulator, and buttons rendered without browser errors.
- Focused frontend tests: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/routing/RoutingPanel.test.tsx src/api.chat-helpers.test.ts` passed.
- Focused backend tests: `cd deck-go/backend && go test ./internal/server ./internal/runtime/openclaw -run 'TestGatewayFacade_DeckRouting|TestGatewayQueriesTyped'` passed.
- Mock visual E2E: `cd deck-go && pnpm exec playwright test test/e2e/routing-visual.spec.ts --config playwright.config.ts` passed.
- Real Gateway E2E: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/routing-real-gateway.spec.ts --config playwright.config.ts` passed.
- OpenSpec validation: `openspec validate frontend-routing-real-contract-verification --strict` passed.
- Endpoint classification: `cd deck-go && make endpoint-classification-check` passed.
- Frontend build: `cd deck-go && make frontend-build` passed.
- Diff hygiene: `git diff --check` passed.

## Review Result

No additional Routing-scoped defects were found in the final code review. The remaining items above are capability/product gaps rather than implementation regressions in this proposal.

## Codex contract completion closeout - 2026-05-05

- Added mutation evidence rows for `routing.add`, `routing.remove`, and
  `routing.dm-scope.patch`; all are config-write-safety governed and real
  config writes remain deferred until reversible routing/config fixtures exist.
- Routed `addRoutingBinding()` and `removeRoutingBinding()` through shared
  mutation evidence helpers.
- Added the product-specific `patchRoutingDmScope()` facade so Routing can
  acknowledge its own mutation action without making generic `patchDeckConfig()`
  product-specific.
- Kept validation and simulation read/advisory. They remain typed Routing
  workflows, not mutation evidence rows.
- Focused checks passed:
  `make deck-api-check mutation-evidence-contract-test mutation-evidence-contract-check`
  and `npm run test:deck-ui -- src/lib/mutation-evidence.test.ts src/api.chat-helpers.test.ts src/components/panels/routing/RoutingPanel.test.tsx src/components/panels/identity/IdentityPanel.test.tsx`.

## Prototype parity remediation closeout - 2026-05-05

- Confirmed `frontend-handoff/modules/routing/prototype.html` as the active
  target. The supported product flow remains the contract-backed two-card route
  workbench: binding queue, selected binding detail, simulator, activity
  projection, config hash, DM scope, and confirmation-gated mutations.
- Fixed deterministic drift by aligning the production title/detail copy with
  the prototype and expanding the mock Gateway fixture to eight
  prototype-shaped bindings with config hash `9af31c2d80ab`.
- Strengthened mock visual evidence now covers Chat -> Routing navigation,
  dark/en, dark/zh, light/en, light/zh, selected queue detail, add draft,
  remove confirmation cancellation, DM scope confirmation cancellation, and
  simulation result. The parity report lives under
  `.local/routing-prototype-remediation-parity-report/`.
- Strengthened real Gateway evidence covers runtime readiness, list, validate,
  simulate, add, post-add list, invalid remove/hash-mismatch shape, cleanup
  attempt, Chat -> Routing navigation, all four theme/locale variants,
  simulator, degraded empty/fixture state, BFF-only browser transport, and
  unexpected console/page/API error recording.
- Real mutation fixture evidence is degraded: `deck.routing.add` returned OK
  with run-scoped binding id `b24ef8343a8d`, but a follow-up
  `deck.routing.list` did not include that binding and cleanup by id returned
  `NOT_FOUND`. The UI therefore records the real surface as empty/degraded
  instead of claiming successful persistent add/remove round-trip behavior.
- Accepted exceptions: Deck shell chrome differs from the standalone prototype;
  production conflict detection is stricter and reports three conflicts for the
  prototype-shaped fixture where the static prototype shows two; reorder remains
  remove+add; conflict severity, simulation reasons, stable semantic binding
  IDs, dedicated routing activity, bulk actions, and server-side route history
  remain follow-up contract questions.
