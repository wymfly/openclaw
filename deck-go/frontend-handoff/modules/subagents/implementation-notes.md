# subagents implementation notes

## Production migration

- Implemented the v2 workbench in `frontend-new/src/components/panels/subagents/`.
- Preserved the panel registry and frontend API facade boundaries.
- Production uses `GET /api/deck/subagents` plus `POST /api/deck/subagents` action envelopes for
  list, lineage, kill, and steer.
- Production uses `POST /api/deck/agents` with `subagents.get/set` actions for per-agent
  permissions.
- Global `agents.defaults.subagents` is shown as context only in this pass; per-agent permissions
  are the contract-backed edit path.

## Deterministic drift fixed

- Corrected handoff docs away from prototype-only REST routes:
  `/api/deck/subagents/<runId>/kill`, `/api/deck/subagents/<runId>/steer`, and
  `/api/deck/agents/<agentId>/subagent-config`.
- Corrected status truth: current Gateway filter schema is
  `active | completed | failed | timeout | all`, not `running | succeeded | killed | stalled`.
- Updated production UI metadata with Subagents runs/lineage/steer/kill DTOs, routes, and actions.
- Updated production tests and L1 visual E2E for the v2 runs/permissions workbench.
- Added bounded L2 real-stack E2E for safe reads and BFF-only browser access.

## Contract matrix

| Workflow                    | Frontend wrapper                          | BFF route/action                        | Gateway/contract truth                                                      | Classification                                 |
| --------------------------- | ----------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| Runs list                   | `fetchSubagentRuns`                       | `GET /api/deck/subagents`               | `deck.subagents.list`, `DeckGoSubagentsListResponse`                        | Supported                                      |
| Status/search/spawn filters | local UI + list query support             | `GET /api/deck/subagents`               | status schema `active/completed/failed/timeout/all`; spawn mode open string | Supported/degraded for prototype-only statuses |
| Lineage                     | `fetchSubagentLineage`                    | `POST /api/deck/subagents` `lineage`    | `deck.subagents.lineage`                                                    | Supported; empty-valid when no real run        |
| Steer                       | `steerSubagentRun`                        | `POST /api/deck/subagents` `steer`      | `deck.subagents.steer` accepts `instruction`                                | Supported; real mutation skipped-safe          |
| Kill                        | `killSubagentRun`                         | `POST /api/deck/subagents` `kill`       | `deck.subagents.kill`                                                       | Supported; real mutation skipped-safe          |
| Per-agent permissions read  | `fetchAgentSubagentConfig`                | `POST /api/deck/agents` `subagents.get` | `deck.agents.subagents.get`                                                 | Supported                                      |
| Per-agent permissions write | `updateAgentSubagentConfig`               | `POST /api/deck/agents` `subagents.set` | `allowAgents`, `model?`, `baseHash`; `allowAny` is `["*"]`                  | Supported; real write skipped-safe             |
| Global defaults             | `fetchDeckConfig`                         | `GET /api/config`                       | `agents.defaults.subagents` config                                          | Read-only context in this module               |
| Audit                       | none                                      | none                                    | no declared route                                                           | Unsupported/degraded                           |
| Stalled/killed statuses     | none                                      | none                                    | not in current status filter schema                                         | Unsupported prototype assumption               |
| BFF-only access             | `fetchDeckJson` / approved runtime facade | deck-go backend                         | browser does not call real Gateway URL                                      | Supported                                      |

## Verification evidence

- Prototype smoke: `prototype.html` loaded with `h1 = "Subagents"`, Permissions button present,
  and browser console/page errors were `[]`.
- Focused frontend: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/subagents/SubagentsPanel.test.tsx src/api.chat-helpers.test.ts` -> 52 tests passed.
- Focused backend: `cd deck-go/backend && go test ./internal/server ./internal/runtime/openclaw ./internal/runtime/openclaw/views ./internal/api/http -run 'TestGatewayFacade_DeckSubagentsAndThreads|TestRegistryDispatchProjectsSubagentsFromStateAndBatch|TestAdapter|TestMountRuntimeRoutes|TestNewHandlerWithDependencies_ExposesStage2RuntimeRoutes|TestManagedRuntime|TestDeckSubagents'` -> passed.
- L1 mock visual: `cd deck-go && pnpm exec playwright test test/e2e/subagents-visual.spec.ts --config playwright.config.ts` -> 1 passed.
- L2 real-stack: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/subagents-real-gateway.spec.ts --config playwright.config.ts` -> 2 passed.

## Residual risks

- Real Gateway may have zero subagent runs; lineage coverage is empty-valid when no run exists.
- Real kill/steer and config writes are skipped-safe unless a disposable fixture exists.
- Audit, stalled detection, killed-state taxonomy, kill cascade, and client-generated steer dedup
  keys need explicit Gateway/BFF contracts before becoming production claims.

## Design-system feedback

- Current atoms were sufficient: `Badge`, `Button`, `Card`, `Input`, `Modal`,
  `SegmentedControl`, `Tab`, `Tag`, `Textarea`, and `Toggle`.
- Repeated local molecules that may deserve later promotion: run row, permission row, agent glyph,
  compact KPI strip, lineage tree node, and permission checkbox row.
- No new tokens or dependencies were introduced.

## Prototype parity remediation closeout - 2026-05-05

- Confirmed `frontend-handoff/modules/subagents/prototype.html` as the active
  target. The supported product flow remains the contract-backed runs and
  permissions workbench: run list, search/filter, selected detail, lineage,
  outcome/raw, permission editing, global defaults context, steer, kill, and
  unsupported audit projection.
- Fixed deterministic drift by expanding the mock Gateway fixture from four
  runs to fourteen prototype-shaped runs and mapping prototype-only statuses to
  current Gateway truth: `active`, `completed`, `failed`, and `timeout`.
- Fixed a production visual/interaction mismatch: Steer and Kill now appear
  only for live `active` runs, matching the prototype's live-run action rule and
  avoiding mutation affordances on completed runs.
- Fixed a dense-table visual issue by forcing row model tags to truncate on one
  line instead of wrapping `openai/gpt-5.4` across two lines.
- Strengthened mock visual evidence now covers Chat -> Subagents navigation,
  dark/en, dark/zh, light/en, light/zh, fourteen-row workbench, selected detail,
  lineage, outcome running state, audit degraded state, raw dialog, permissions
  dialog, steer dialog, and kill confirmation cancellation. The parity report
  lives under `.local/subagents-prototype-remediation-parity-report/`.
- Strengthened real Gateway evidence covers runtime readiness, `agents.list`
  through the generated Gateway RPC BFF transport, `deck.subagents.list`,
  `deck.subagents.lineage`, `deck.agents.subagents.get`, invalid kill, invalid
  steer, invalid-hash `deck.agents.subagents.set`, all four UI variants,
  permissions dialog exercise, BFF-only browser transport, and unexpected
  console/page/API error recording.
- Real run evidence is degraded: the fresh real stack returned zero subagent
  runs, so lineage/live kill/steer are recorded as empty-valid or skipped-safe
  with invalid-target route-shape evidence instead of fabricated active runs.
- Accepted exceptions: Deck shell chrome differs from the standalone prototype;
  audit remains unsupported/degraded because no route is declared; `killed` and
  `stalled` remain prototype-only taxonomy; kill cascade and client-generated
  steer dedup keys remain follow-up Gateway/BFF contract questions.
