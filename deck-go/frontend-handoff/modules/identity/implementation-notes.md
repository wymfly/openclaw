# identity implementation notes

## Source truth

This module is a canonical-to-channel-peer registry. Code truth is the
Deck-facing BFF and Gateway chain, not the v2 prototype's richer product
projection fields.

## Contract-chain matrix

| Workflow                       | Frontend wrapper                                           | Deck BFF route                                    | Gateway method                        | DTO / result                                        | Status                                            |
| ------------------------------ | ---------------------------------------------------------- | ------------------------------------------------- | ------------------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| List identity links            | `fetchIdentityLinks()`                                     | `GET /api/deck/identity`                          | `deck.identity.list`                  | `DeckGoIdentityLinksResponse`                       | supported                                         |
| Link peer                      | `linkIdentityPeer(canonical, channel, peerId, baseHash)`   | `POST /api/deck/identity` with `action: "link"`   | `deck.identity.link`                  | `DeckGoIdentityMutationResponse`; UI refetches list | supported; mutation-evidence known                |
| Unlink peer                    | `unlinkIdentityPeer(canonical, channel, peerId, baseHash)` | `POST /api/deck/identity` with `action: "unlink"` | `deck.identity.unlink`                | `DeckGoIdentityMutationResponse`; UI refetches list | supported; mutation-evidence known                |
| Agent profile hint             | `fetchAgentIdentity("main")`                               | `GET /api/agents/main/identity`                   | `agent.identity.get`                  | `DeckGoAgentIdentityResponse`                       | supported for known agent IDs, degraded otherwise |
| Missing hash guard             | UI state from `configHash`                                 | no mutation sent                                  | none                                  | local guard                                         | supported                                         |
| Failed mutation refresh        | UI catches wrapper error then refetches                    | `GET /api/deck/identity`                          | `deck.identity.list`                  | refreshed list/hash                                 | supported                                         |
| Empty identity list            | `fetchIdentityLinks()`                                     | `GET /api/deck/identity`                          | `deck.identity.list`                  | `links: []`                                         | empty-valid                                       |
| Browser Gateway access         | none                                                       | browser calls BFF only                            | none from browser                     | request review                                      | supported                                         |
| Create canonical               | none                                                       | no supported action                               | none                                  | none                                                | unsupported                                       |
| Rename canonical               | none                                                       | no supported action                               | none                                  | none                                                | unsupported                                       |
| Delete canonical               | none                                                       | no supported action                               | none                                  | none                                                | unsupported                                       |
| Peer activity fields           | none                                                       | no endpoint today                                 | none                                  | not in `DeckGoIdentityPeer`                         | unsupported / future projection                   |
| Recent mutation audit          | none                                                       | no endpoint today                                 | none                                  | not in `DeckGoIdentityLinksResponse`                | unsupported / future projection                   |
| Runtime-scoped identity routes | no browser wrapper today                                   | `/api/v1/runtimes/{runtimeId}/deck/identity`      | runtime provider delegates to Gateway | runtime envelope                                    | environment-dependent, backend-covered            |

## Fixes applied

- Production UI was tightened to a v2-style workbench: top contract bar,
  metric strip, searchable canonical rail, selected canonical hero, peer
  rows, mutation-safety banner, recent-mutation projection placeholder, and
  raw payload disclosure.
- Create, rename, delete, activity, and audit workflows are no longer
  presented as active Gateway guarantees. They surface as unsupported
  contract states until a matching Deck/Gateway contract exists.
- Link/unlink remain the only active mutations and continue to submit the
  current `configHash` as `baseHash`.
- UI metadata now has an `identity-registry` domain for the BFF endpoints,
  DTOs, and supported identity actions.
- Runtime route test fixture was corrected from stale `identities` shape to
  the current `links` shape.
- Handoff API notes were corrected from stale `gateway.deck.identity.*`
  naming and refreshed-list POST responses to the current
  `deck.identity.*` method names and generated mutation results.

## Prototype smoke

`prototype.html` was served from `deck-go/frontend-handoff/modules/identity`
on `127.0.0.1:49191` and opened with Playwright. Evidence:

- status: `200`
- title: `Identity (deck-go) · v2 prototype`
- first heading: `Identity`
- canonical tabs visible: `5`
- screenshot: `identity-prototype-smoke.png` in Playwright MCP output
- console: one Babel standalone warning, plus a static-server `favicon.ico`
  404; no React render/page error was observed.

## Residual risks

- Real Gateway identity state may be empty or lack `configHash`; L2 mutation
  verification must skip-safe rather than inventing an unsafe operator-data
  mutation.
- Agent profile enrichment is only read for the `main` canonical in the
  production panel; broader canonical-to-agent matching needs a future product
  decision.
- Peer activity and recent mutation rows need a new BFF/Gateway projection
  contract before they can become more than explicit unavailable states.

## Codex contract completion closeout - 2026-05-05

- Added `DeckGoIdentityMutationResponse` to the Deck-facing contract authority
  and regenerated Deck API TS/Go artifacts.
- Added `identity.link` and `identity.unlink` rows to
  `deck-mutations.contract.json`; both actions are config-write-safety governed
  and real execution remains deferred without reversible config fixtures.
- Routed `linkIdentityPeer()` and `unlinkIdentityPeer()` through shared mutation
  evidence helpers while keeping browser traffic BFF-only.
- Focused checks passed:
  `make deck-api-check mutation-evidence-contract-test mutation-evidence-contract-check`
  and `npm run test:deck-ui -- src/lib/mutation-evidence.test.ts src/api.chat-helpers.test.ts src/components/panels/routing/RoutingPanel.test.tsx src/components/panels/identity/IdentityPanel.test.tsx`.

## Prototype parity remediation closeout - 2026-05-06

- Active visual target confirmed: `frontend-handoff/modules/identity/prototype.html`.
  The implementation keeps the registry workbench shape but defers prototype-only
  create, rename, delete, peer activity, and recent mutation audit capabilities
  until matching Deck/Gateway contracts exist.
- Mock Gateway identity fixture was raised to prototype density: 5 canonicals
  (`main`, `team-builder`, `ops-rotation`, `review-pool`, `system`) and 8
  peers across telegram, discord, wecom, slack, email.
- Focused unit evidence now covers canonical inventory, search/selection,
  empty peer state, baseHash guard, link/unlink wrappers, unsupported actions,
  and Chinese copy.
- Mock visual evidence covers Chat -> Identity shell navigation, dark/en,
  dark/zh, light/en, light/zh, search, empty slot, raw payload, unsupported
  actions, Link dialog, and mock link mutation.
- Real Gateway evidence passed with degraded fixture status:
  `GET /api/deck/identity` returned `200` with empty `links` and a `configHash`;
  `POST /api/deck/identity` link returned OK, but the follow-up list did not
  expose the run-scoped fixture, so the test recorded skipped-safe/degraded
  fixture evidence and performed a run-scoped cleanup attempt.
- Real UI evidence still covered Chat -> Identity shell navigation, all four
  theme/locale variants, empty-valid/projection states, unsupported create
  action, no unexpected console/page/BFF errors, and no direct Gateway
  HTTP/websocket browser traffic.

Accepted exceptions:

- The active Gateway/BFF contract does not expose create/rename/delete
  canonical actions. The UI presents them as unsupported rather than verified
  product capabilities.
- Peer activity fields and recent mutation audit rows remain product
  projections with no current `DeckGoIdentityPeer` or list-response authority.
- Real stack identity data was empty and run-scoped link did not become visible
  through list; this is recorded as degraded fixture evidence, not as a
  production UI pass for persisted real identity data.
