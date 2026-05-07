# Skills Implementation Notes

## Real-Contract Verification Pass

OpenSpec change: `frontend-skills-real-contract-verification`
Date: 2026-05-04

The current `frontend-new` Skills panel is already a high-fidelity production implementation from the archived `frontend-skills-hifi-contract-redesign` pass. The `frontend-handoff/modules/skills/README.md` status was stale: the multi-file prototype package is useful visual/product context, but it is not a new implementation mandate.

No production UI rewrite was made in this pass. The real-contract audit found one deterministic Gateway metadata defect and fixed it in `src/gateway/server-methods/skills-method-defs.ts`: real `gateway.describe` now advertises the same Skills methods that source/generated clients and direct RPC already supported.

## Prototype vs Real Contract Decisions

- Prototype rows include richer mock-only projections for Files, Audit, trigger chips, install progress, dependency/setup storytelling, and marketplace metadata. These are not all present as stable Deck DTO authority today.
- Production must prefer `DeckGoSkill*`, `DeckGoSkillHub*`, `DeckGoAgentSkills*`, Go BFF behavior, and real Gateway evidence over handoff fixtures.
- The prototype assumes config, disable, hub install/update, and agent matrix writes are product-safe. In real verification these remain mutation-isolation-blocked unless a disposable skill/config/agent state exists.
- The prototype remains a visual reference for future UX work, but unsupported authoring, credential-vault, trust, file-system, and audit surfaces should not be promoted without a contract proposal.

## Gateway/BFF Capability Findings

- Generated Gateway artifacts include `skills.status`, `skills.bins`, `skills.search`, `skills.detail`, `skills.install`, `skills.update`, `deck.agents.skills.get`, and `deck.agents.skills.set`.
- Gateway source and method definitions include the same methods, with Skills reads in `src/gateway/server-methods/skills.ts` and agent matrix methods in `src/gateway/server-methods/deck/agents-skills.ts`.
- Real `gateway.describe` now advertises `skills.status`, `skills.bins`, `skills.search`, `skills.detail`, `skills.install`, `skills.update`, and `deck.agents.skills.*`. The initial real-stack run exposed that Skills read/update metadata lived only in the codegen-oriented control-plane definitions; this pass moved the metadata onto the runtime Skills module and added a regression test.
- Deck endpoint classification keeps `/skills*` and `/deck/agents` as `deck-go-bff`. Browser code should continue using `frontend-new/src/api.ts`; panel components must not call Gateway, ClawHub, package managers, or the filesystem directly.
- No Skills rows were found in active dynamic or upstream-schema-missing exception docs during this pass.

## Contract Chain Matrix

| Workflow                        | Frontend wrapper                              | Deck endpoint/DTO                                                    | Go BFF / Gateway                                  | Classification             | Verification                                   |
| ------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------- | -------------------------- | ---------------------------------------------- |
| Refresh installed inventory     | `fetchSkills`                                 | `GET /skills`, `DeckGoSkillsResponse`                                | `SkillsStatus` -> `skills.status`                 | supported                  | Real typed RPC and BFF GET passed              |
| Skill selection/filtering       | local panel selectors over `DeckGoSkillEntry` | no extra endpoint                                                    | BFF payload only                                  | supported                  | Real UI search/empty state passed              |
| Missing requirements display    | `fetchSkills`                                 | optional skill fields                                                | `skills.status` payload                           | degraded                   | Render only fields present from Gateway        |
| Enable/disable                  | `updateSkill`                                 | `PATCH /skills/{skillKey}`                                           | `SkillsUpdate` -> `skills.update`                 | mutation-isolation-blocked | Mock visual only; real write not run           |
| Config save                     | `updateSkill`                                 | `PATCH /skills/{skillKey}`                                           | `SkillsUpdate` -> `skills.update`                 | mutation-isolation-blocked | Mock visual only; real write not run           |
| Install option                  | `installSkill`                                | `POST /skills/install`                                               | `SkillsInstall` -> `skills.install`               | mutation-isolation-blocked | Describe/source verified; real install not run |
| ClawHub bins                    | `fetchSkillHubBins`                           | `POST /skills/hub` action `bins`, `DeckGoSkillHubBinsResponse`       | `SkillsBins` -> `skills.bins`                     | supported                  | Real typed RPC and BFF hub bins passed         |
| ClawHub search                  | `searchSkillHub`                              | `POST /skills/hub` action `search`                                   | `SkillsSearch` -> `skills.search`                 | environment-dependent      | Source/generated verified; network-sensitive   |
| ClawHub detail                  | `fetchSkillHubDetail`                         | `POST /skills/hub` action `detail`                                   | `SkillsDetail` -> `skills.detail`                 | environment-dependent      | Source/generated verified; network-sensitive   |
| ClawHub install                 | `installSkillHub`                             | `POST /skills/hub` action `install`                                  | `SkillsInstall` with `source=clawhub`             | mutation-isolation-blocked | Real install not run                           |
| ClawHub update                  | `updateSkillHub`                              | `POST /skills/hub` action `update`                                   | `SkillsUpdate` with `source=clawhub`              | mutation-isolation-blocked | Real update not run                            |
| Agent matrix read               | `fetchAgentSkills`                            | `POST /deck/agents` action `skills.get`, `DeckGoAgentSkillsResponse` | `DeckAgentsSkillsGet` -> `deck.agents.skills.get` | supported                  | Real typed RPC and BFF action passed           |
| Agent matrix write              | `updateAgentSkills`                           | `POST /deck/agents` action `skills.set`                              | `DeckAgentsSkillsSet` -> `deck.agents.skills.set` | mutation-isolation-blocked | Mock visual only; real write not run           |
| Agent navigation                | `navigateToAgent`                             | UI navigation only                                                   | no Gateway mutation                               | supported                  | Code review; existing panel behavior           |
| Authoring / trust / credentials | none                                          | none                                                                 | no stable Deck DTO in this pass                   | unsupported                | Handoff follow-up only                         |

## Verification Evidence

- L1 focused tests: `cd deck-go/frontend-new && npm run test:deck-ui -- src/api.chat-helpers.test.ts src/components/panels/skills/SkillsPanel.test.tsx` passed, 2 files / 51 tests.
- L1 mock visual: `cd deck-go && pnpm exec playwright test test/e2e/skills-visual.spec.ts --config playwright.config.ts` passed.
- L2 real API/UI: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/skills-real-gateway.spec.ts --config playwright.config.ts` passed, 2 tests.
- Gateway describe regression: `pnpm test src/gateway/server-methods/describe.test.ts src/gateway/method-registry-data.test.ts` passed, 2 files / 11 tests.
- Backend focused routes: `cd deck-go/backend && go test ./internal/server -run 'TestGatewayFacade_SkillsRoutes|TestGatewayFacade_DeckAgentsDetailAndSkills|TestGatewayFacade_DeckAgentsActions'` passed.
- Backend typed wrappers: `cd deck-go/backend && go test ./internal/runtime/openclaw -run 'TestGatewayQueriesRepresentativeWrappersSmoke|TestGatewayQueriesLowRiskWrappersUseTypedClient'` passed.
- Gateway protocol check: `cd deck-go && make protocol-check` passed; generated deck-go protocol artifacts remained in sync.
- Build: `cd deck-go && make frontend-build` passed with the existing Vite chunk-size warning only.

## Code Review Result

No blocking code findings in the scoped Skills contract chain.

Reviewed surfaces:

- `frontend-new/src/components/panels/skills/**`: no raw Gateway, ClawHub, package-manager, or filesystem access in panel components.
- `frontend-new/src/api.ts`: Skills calls stay on Deck BFF endpoints.
- `backend/internal/server/inventory.go`: Skills BFF routes forward through generated runtime adapter methods and preserve explicit error mapping.
- `src/gateway/server-methods/skills-method-defs.ts`: runtime method metadata now covers all Skills handlers used by describe and Deck protocol discovery.
- `test/e2e/skills-visual.spec.ts` and `test/e2e/skills-real-gateway.spec.ts`: mock visual and real Gateway evidence are separated.

Residual risks:

- Real write coverage for Skills remains blocked without disposable/reversible state.
- ClawHub search/detail are network-sensitive and should be verified again in the final cross-module real E2E audit.

## Contract-chain completion closeout — 2026-05-05

### Contract evidence update

- `DeckGoSkillsResponse.skills` is now the normalized Deck-facing product DTO `DeckGoSkillEntry[]`; `/api/skills` maps raw Gateway `skills.status` rows at the Go BFF boundary.
- Frontend `normalizeSkill()` remains tolerant of older/raw Gateway-shaped rows so UI behavior does not depend on a hard migration instant.
- Added `DeckGoSkillInstallResponse` and narrowed `DeckGoSkillHubMutationResponse` to current Gateway install/update result fields instead of a catch-all record envelope.
- Added action-level mutation evidence for `skills.update`, `skills.install`, `skills.hub.install`, and `skills.hub.update`; real write execution remains deferred or skipped-safe without disposable config/workspace fixtures.
- Routed Skills write facades through the shared mutation evidence helper.

### Current truth

- Skills inventory, Hub bins/search/detail, and agent skill matrix read are product-visible and contract-known.
- Agent skill matrix save is already `agents.skills.save`; installed skill and Skill Hub writes are now action-known but not fixture-safe.
- Per-skill config remains an intentional dynamic config fragment; do not invent fixed schemas unless Skills become fixed product forms.
- Code truth remains authoritative over this note; update contract sources and regenerate artifacts before changing UI claims.

### Additional verification

- `cd deck-go && make deck-api-check mutation-evidence-contract-test mutation-evidence-contract-check deck-api-dynamic-surfaces-check` passed.
- `cd deck-go/backend && go test ./internal/server ./internal/runtime/openclaw ./internal/api/http -run 'TestGatewayFacade_SkillsRoutes|TestGatewayFacade_ChannelsAndPlugins|TestGatewayQueriesRepresentativeWrappersSmoke|TestGatewayQueriesLowRiskWrappersUseTypedClient|TestMountRuntimeRoutes|TestManagedRuntime|TestLegacyInventorySurface'` passed.
- `cd deck-go/frontend-new && npm run test:deck-ui -- src/api.chat-helpers.test.ts src/lib/mutation-evidence.test.ts src/components/panels/skills/SkillsPanel.test.tsx src/components/panels/plugins/PluginsPanel.test.tsx` passed, 82 tests.

## Prototype parity remediation — 2026-05-05

OpenSpec change: `deck-go-frontend-skills-prototype-parity-remediation`

### Active target

- Active prototype: `frontend-handoff/modules/skills/prototype.html`, backed by
  `list-view.jsx`, `detail-view.jsx`, `dialogs.jsx`, `data.js`, and `styles.css`.
- Reference-only prototype: `frontend-handoff/modules/skills/prototype-v1-codex.html`.
- Production target: `frontend-new/src/components/panels/skills/SkillsPanel.tsx`.

### Contract mapping

| Product workflow                          | Deck frontend wrapper                                 | BFF/Gateway source                            | Verdict                                                          |
| ----------------------------------------- | ----------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------- |
| Installed inventory                       | `fetchSkills`                                         | `GET /skills` -> `skills.status`              | Supported                                                        |
| Installed search/filter/source            | local selectors over `DeckGoSkillEntry`               | no extra RPC                                  | Supported                                                        |
| Skill detail Overview/Setup/Bins          | `DeckGoSkillEntry` fields                             | normalized `skills.status` DTO                | Supported                                                        |
| Configure / enable / disable              | `updateSkill`                                         | `PATCH /skills/{skillKey}` -> `skills.update` | Supported, real write skipped-safe except isolated fixture reads |
| Install option                            | `installSkill`                                        | `POST /skills/install` -> `skills.install`    | Supported, real package/bin mutation skipped-safe                |
| ClawHub bins/search/detail/install/update | `fetchSkillHub*`, `installSkillHub`, `updateSkillHub` | `/skills/hub` -> `skills.*`                   | Supported; real search/detail network-sensitive                  |
| Agent matrix read/write                   | `fetchAgentSkills`, `updateAgentSkills`               | `/deck/agents` skills actions                 | Supported; matrix remains secondary                              |
| Triggers / Files / Audit                  | none yet                                              | no stable Deck DTO                            | Explicit projected/unavailable state                             |

### Production changes

- Reworked the Skills panel from the previous two-column operations workbench
  into the active prototype's catalog flow: Installed/Hub modes, KPI strip,
  table-like installed rows, Hub result rows, list-to-detail navigation, and a
  six-tab detail view.
- Kept configure, install option, disable confirmation, ClawHub preview/install,
  and agent skill matrix reachable through dialogs or secondary detail surfaces.
- Raised mock fixture density to representative installed and Hub data so visual
  tests exercise table density, setup states, disabled states, Hub results, and
  install options.
- Kept browser code on Deck BFF wrappers only; no direct Gateway, ClawHub,
  package-manager, or filesystem call was added.

### Accepted exceptions

- Trigger chips are a front-end projection from current DTO fields until Deck
  exposes stable SKILL.md trigger metadata.
- Files and audit tabs intentionally render unavailable/projection states because
  no stable `DeckGoSkillFiles` or `DeckGoSkillAudit` DTO exists.
- Real ClawHub search/detail is network-sensitive; mock E2E covers the product
  dialog/install flow, while real E2E verifies Hub mode and bins/read surfaces.
- Real install/update/package-manager paths are skipped-safe because they can
  mutate installed skills or managed bins outside a reversible UI-only fixture.

### Strengthened real E2E evidence

- Real E2E now creates a run-scoped workspace skill at
  `skills/<run-id>/SKILL.md` inside the isolated real E2E workspace. Cleanup
  refuses targets that do not include the run id.
- Real API evidence verifies `gateway.describe`, `skills.status`, `skills.bins`,
  `/api/skills`, `/api/deck/agents` skills read, and `/api/skills/hub` bins.
- Real UI evidence starts from Chat, navigates through the Deck shell to Skills,
  covers dark English and light Chinese variants, searches for the run-scoped
  skill, opens detail, clicks all six tabs, opens Configure and Files dialogs,
  expands the matrix secondary surface, enters Hub mode, and verifies no browser
  direct Gateway requests or websockets.

### Verification

- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/skills/SkillsPanel.test.tsx` passed, 6 tests.
- `cd deck-go && pnpm exec playwright test test/e2e/skills-visual.spec.ts --config playwright.config.ts --output .local/skills-remediation-mock-visual --reporter=line --timeout=60000` passed.
- `cd deck-go && node scripts/generate-prototype-parity-report.mjs --prototype-dir .local/prototype-gap-audit --mock-dir .local/skills-remediation-mock-visual --out-dir .local/skills-prototype-remediation-parity-report --sheet-size 1` generated the Skills parity report.
- `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/skills-real-gateway.spec.ts --config playwright.config.ts --output .local/skills-remediation-real-e2e-strengthened --reporter=line` passed, 2 tests.

## Product control-plane closeout — 2026-05-07

OpenSpec change: `deck-go-skills-product-control-plane`

### Product boundary

- Skills is now a product control plane for installed-skill identity, source/activation, secret posture, env config, eligibility health, read-only agent usage, owning-plugin relationship, ClawHub install/update, and unsupported-capability handoffs.
- The previous Skills-owned agent matrix write path was intentionally removed. `updateAgentSkills` remains in `frontend-new/src/api.ts` for Agents, but no file under `frontend-new/src/components/panels/skills/` imports or invokes it.
- The active UI rhythm is `list workbench + detail hero + section nav`; the old `SkillHubTab`, `SkillMatrixTab`, `SkillInfoTab`, and `InstallSkillDialog` components are deleted.

### Safety model

- L0: enable/disable is inline and shows agent-usage impact.
- L1: env edits and global ClawHub update-all use guarded drawers.
- L2: apiKey update/clear uses a secret dialog; saved plaintext and last-4 hints are not displayed.
- L3: ClawHub install uses a five-step wizard. Because Gateway install does not accept `apiKey` or `env`, the UI runs `installSkillHub(slug)` first and then chains `updateSkill(skillKey, {apiKey?, env?})`; chain failure is recoverable, not transactional.

### Gateway truth and handoffs

- No `skills.uninstall` or rotate RPC exists today; the Danger zone renders a `gateway-rpc-missing` handoff banner and no destructive button.
- No safe ClawHub installed-version/tracking-status read exists today; the UI exposes only guarded global update-all, not per-skill upgrade or version selection.
- `owningPlugin` is best-effort through `deck.plugins.list`; unresolved joins render `unknown plugin`.

### Verification tier

- Component: `cd deck-go/frontend-new && pnpm test:deck-ui src/components/panels/skills/SkillsPanel.test.tsx` passed, 8 tests.
- Mock visual: `cd deck-go && pnpm exec playwright test test/e2e/skills-visual.spec.ts --config playwright.config.ts --reporter=line --timeout=90000` passed.
- Build: `cd deck-go && make frontend-build` passed.
- Contracts/backend: `cd deck-go && make protocol-check`, `cd deck-go && make contract-gate`, and `cd deck-go && make backend-test` passed.
- Real Gateway tier: L2 read/UI passed. `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 DECK_GO_REAL_GATEWAY_READY_TIMEOUT_MS=180000 pnpm exec playwright test test/e2e/skills-real-gateway.spec.ts --config playwright.config.ts --reporter=line --timeout=300000` passed, 2 tests. The real E2E launcher now uses direct `node dist/entry.js gateway run ...` startup instead of `pnpm openclaw`, so it no longer enters dirty-tree `runtime-postbuild` during isolated verification. ClawHub/package-manager mutations remain skipped-safe unless a staging slug is configured.
