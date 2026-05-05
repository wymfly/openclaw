# agents - implementation notes

## Baseline decision

`deck-go-frontend-agents-rebuild` remains the engineering baseline. This change does not repeat the contract migration or recreate the shared agents store. It reuses:

- `frontend-new/src/components/panels/agents/AgentsPanel.tsx`
- `frontend-new/src/components/panels/agents/agents-panel-state.ts`
- `frontend-new/src/stores/agents.ts`
- `frontend-new/src/stores/agents-metrics.ts`
- agents wrappers in `frontend-new/src/api.ts`
- agents DTO aliases in `frontend-new/src/api-types.ts`
- existing focused agents tests

## Current baseline UI record

Before this pass, the production agents panel rendered as a padded list card plus a separate detail grid. It had usable list/detail/create/delete flows, but no mock visual E2E, no fresh Codex-owned high-fidelity target, no metrics/workbench visual treatment, and stale handoff docs that still described unsupported ideal v2 fields.

## Design-system adaptation map

| Handoff concept              | Production mapping                             |
| ---------------------------- | ---------------------------------------------- |
| `Switch`                     | canonical `Toggle`                             |
| avatar / initials            | local molecule                                 |
| metric tile                  | local molecule                                 |
| row summary                  | local molecule                                 |
| detail hero                  | local molecule                                 |
| section header               | local molecule                                 |
| preview/file/permission rows | local molecules                                |
| status dot                   | local CSS element using existing status tokens |

## Deterministic drift to fix

- Handoff docs no longer treat server-side `agents.list` query, composite hashes, and v2 skill mode semantics as available.
- Mock gateway now returns multiple contract-shaped agents with optional counters/status values; missing optional values still render as unavailable.
- Production visual rhythm now uses the revised workbench structure: metrics strip, left list card, right selected-detail card, and compact section rows.

## Mock visual evidence

`pnpm exec playwright test --config deck-go/playwright.config.ts deck-go/test/e2e/agents-visual.spec.ts` passed after rerun outside the macOS sandbox. The first sandboxed run failed before assertions because Chromium could not register its macOS Mach port rendezvous service.

Screenshots:

- `test-results/agents-visual-agents-mock--15cf7-h-contract-shaped-mock-data/agents-workbench-ready.png`
- `test-results/agents-visual-agents-mock--15cf7-h-contract-shaped-mock-data/agents-create-dialog.png`

This is mock visual coverage only. It does not prove real Gateway or real LLM behavior.

## Design-system feedback

No canonical token, atom, or pattern was added in this pass.

Local molecules to watch during routing/subagents:

- `agent-metric`
- selected agent detail/nav card
- section header with helper/action
- preview/file/permission row rhythm
- status dot vocabulary

## Follow-up watch items

- Promote metric tile / section header / preview row only after routing or subagents repeats the pattern.
- Consider real Gateway agents E2E separately after mock visual quality converges.
- Consider server-side `agents.list` query only if scale requires it.

## Prototype parity remediation

OpenSpec change: `deck-go-frontend-agents-prototype-parity-remediation`
Date: 2026-05-05

### Active prototype decision

- Active visual target: `deck-go/frontend-handoff/modules/agents/prototype.html`.
- Superseded context: `deck-go/frontend-handoff/modules/agents/prototype-v2-codex.html`.
  The README explicitly names `prototype.html`, so the older standalone v2 file
  is not implementation authority.

### Structured visual verdict

Verdict: `pass-with-exceptions` for the ready list state.

Evidence:

- Prototype screenshot:
  `deck-go/.local/prototype-gap-audit/agents--prototype.png`
- Mock-current screenshot:
  `deck-go/.local/agents-prototype-remediation-mock-visual/agents-visual-agents-mock--15cf7-h-contract-shaped-mock-data/agents-workbench-ready.png`
- Contact sheet:
  `deck-go/.local/agents-prototype-remediation-parity-report/sheet-1.png`
- Structured verdict:
  `deck-go/.local/agents-prototype-remediation-parity-report/verdict.json`

Fixed material gaps:

- Production no longer captures a selected split-pane workbench as the primary
  visual state. The primary mock screenshot now captures the ready list state,
  matching the active prototype's default state.
- Production navigation now follows the prototype's full-width list/detail model
  instead of showing list and detail side-by-side by default.
- The list filter set now uses `All / Busy / Idle` like the prototype instead
  of the previous `Default` filter.
- Header copy, screenshot state, horizontal rhythm, and list row hierarchy were
  tightened toward the active prototype.

Accepted exception:

| Prototype reference                              | Production reference                                                               | Difference                                                     | Reason                                                                                                                                                           | Owner            | Classification |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------- |
| `frontend-handoff/modules/agents/prototype.html` | `frontend-new/src/components/panels/agents/AgentsPanel.tsx` and `agents-panel.css` | Prototype is standalone; production renders inside Deck shell. | Shell chrome is outside module prototype authority. The parity screenshot captures the module panel element to compare the product surface without shell chrome. | deck-go frontend | product-shell  |

Detail and create states remain covered by the focused mock visual E2E and
component tests. They are not the primary `agents-workbench-ready.png` comparison
state because the active prototype screenshot used by the shared gate is the
ready list state.

## Real contract verification pilot

OpenSpec change: `frontend-agents-real-contract-verification`
Date: 2026-05-04

### Baseline and scope

- Revised v2 handoff remains the active product input. `prototype.html` is the active visual target and loads the multi-file React/Babel package (`data.js`, `list-view.jsx`, `detail-view.jsx`, `dialogs.jsx`, `tweaks-panel.jsx`, `icons.jsx`, `app.jsx`) without browser errors in the local smoke.
- Production baseline is reused rather than rewritten from scratch: `frontend-new/src/components/panels/agents/AgentsPanel.tsx`, `agents-panel-state.ts`, `frontend-new/src/stores/agents.ts`, `frontend-new/src/stores/agents-metrics.ts`, and the agents wrappers in `frontend-new/src/api.ts`.
- Unrelated worktree changes under `frontend-handoff/modules/channels/` were present during this pass and intentionally left untouched.
- The prototype is product input, not API authority. When prototype assumptions exceed Gateway/Deck truth, implementation follows the contract chain and records the difference here.

### Capability and contract-chain matrix

| Product workflow          | Classification                        | Product decision                                                                                            | Frontend wrapper                                                       | Deck endpoint / DTO                                                                          | Go adapter / Gateway method                                                                                                             | Evidence                                                              |
| ------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------- |
| Refresh / list agents     | Supported with degraded list metadata | Use client-side search/filter/sort only; render missing optional counters as `-`                            | `fetchAgentsList()`                                                    | typed Gateway client result normalized to `DeckGoAgentsListResponse`                         | `GatewayQueries.AgentsList()` -> `agents.list`; `normalizeAgentsList()` sets neutral `idle` because upstream list has no runtime status | generated TS/Go bindings include `agents.list`; L2 real API/UI passed |
| Detail load               | Supported                             | Load selected detail through Deck aggregate route                                                           | `fetchAgentDetail(agentId)`                                            | `GET /deck/agents?agentId=...` / `DeckGoAgentDetailResponse`                                 | `DeckAgentsDetail()` -> `deck.agents.detail`                                                                                            | L2 real API/UI passed                                                 |
| Overview update           | Supported, mutation not real-run      | Keep patch limited to backend-supported `name`, `workspace`, `model`, `emoji`, `avatar`                     | `updateAgent()`                                                        | `PATCH /agents/{agentId}` / `DeckGoAgentPatchRequest`                                        | `AgentsUpdate()` -> `agents.update`                                                                                                     | focused component tests; safe real mutation deferred                  |
| Create agent              | Supported, mutation not real-run      | Create identity first; model and sections are configured after backend id/hash exists                       | `createAgent()`                                                        | `POST /agents` / `DeckGoAgentCreateRequest`                                                  | `AgentsCreate()` -> `agents.create`                                                                                                     | focused component tests; safe real mutation deferred                  |
| Delete agent              | Supported, destructive not real-run   | Keep explicit confirmation and do not auto-run against user config                                          | `deleteAgent()`                                                        | `DELETE /agents?agentId=...` / `DeckGoAgentMutationResponse`                                 | `AgentsDelete()` -> `agents.delete`                                                                                                     | focused component tests; safe real mutation deferred                  |
| Skills read/save          | Supported, save not real-run          | Current semantics are `"all"                                                                                | "whitelist"`; do not expose unsupported inherit/explicit/none literals | `fetchAgentSkills()`, `updateAgentSkills()`                                                  | `POST /deck/agents` action `skills.*` / `DeckGoAgentSkills*`                                                                            | `DeckAgentsSkillsGet/Set()` -> `deck.agents.skills.*`                 | focused API/component tests; L2 read passed |
| Subagent policy read/save | Supported, save not real-run          | Normalize `allowAgents`, `allowedAgents`, and `allAgents` through the API helper                            | `fetchAgentSubagentConfig()`, `updateAgentSubagentConfig()`            | `POST /deck/agents` action `subagents.*` / `DeckGoAgentSubagentConfig*`                      | `DeckAgentsSubagentsGet/Set()` -> `deck.agents.subagents.*`                                                                             | L2 read passed; save deferred                                         |
| Event stream read/save    | Supported, save not real-run          | Preserve real Gateway stream names such as `lifecycle` and `assistant` alongside declared UI options        | `fetchAgentEventStreams()`, `updateAgentEventStreams()`                | `POST /deck/agents` action `eventStreams.*` / `DeckGoAgentEventStreams*`                     | `DeckAgentsEventStreamsGet/Set()` -> `deck.agents.eventStreams.*`                                                                       | focused API/component tests; L2 read/UI passed                        |
| Files list/read/save      | Supported, save not real-run          | Read/list are safe; saving requires explicit file target and no real mutation in this pilot                 | `fetchAgentFiles()`, `fetchAgentFile()`, `saveAgentFile()`             | `/agents/{agentId}/files*` / `DeckGoAgentFile*`                                              | `AgentFilesList/Get/Set()` -> `agents.files.*`                                                                                          | L2 list passed; save deferred                                         |
| Tool policy preview       | Supported read-only                   | Render resolved preview only; no editing implied                                                            | `fetchAgentToolPolicyPreview()`                                        | `POST /deck/agents` action `toolPolicy.preview` / `DeckGoAgentToolPolicyPreviewResponse`     | `DeckAgentsToolPolicyPreview()` -> `deck.agents.toolPolicy.preview`                                                                     | L2 API/UI passed                                                      |
| System prompt preview     | Supported read-only                   | Render resolved layers/bootstrap files only; no editing implied                                             | `fetchAgentSystemPromptPreview()`                                      | `POST /deck/agents` action `systemPrompt.preview` / `DeckGoAgentSystemPromptPreviewResponse` | `DeckAgentsSystemPromptPreview()` -> `deck.agents.systemPrompt.preview`                                                                 | L2 API passed                                                         |
| Runtime/status streams    | Degraded                              | Do not invent live status when `agents.list` omits it; neutral status and unavailable counts are acceptable | `streamEvents()` plus list/detail wrappers                             | `GET /api/stream` plus Deck DTO optional fields                                              | SSE stream contracts plus Gateway list/detail                                                                                           | static review; status enrichment remains follow-up                    |

### Backend and contract findings

- Agents-related Gateway methods are typed in generated TS and Go artifacts: `agents.create`, `agents.delete`, `agents.list`, `agents.update`, `agents.files.*`, `agent.identity.get`, and `deck.agents.*` section methods.
- `deck-exceptions.contract.json` and `docs/gateway-untyped-exceptions.md` contain no agents/deck.agents exception rows. Current untyped exceptions are tools, approval, logs, commands, and node dynamic surfaces.
- No agents-scoped Go backend source change was required in this pass. Existing BFF routes and typed query wrappers already map the production UI workflows to Gateway methods.
- The only deterministic frontend/API drift fixed by this pass is test coverage around section action wrappers and dynamic event-stream names. Current `api.ts` already has a single `agentId` in `updateAgentSkills`.

### Verification evidence

- Focused frontend: `npm run test:deck-ui -- src/components/panels/agents/__tests__/agents-panel-state.test.ts src/components/panels/agents/__tests__/AgentsPanel.test.tsx src/api.chat-helpers.test.ts` passed, 53 tests.
- Focused backend: `GOCACHE=/tmp/deck-go-buildcache-clean GOMODCACHE=/tmp/deck-go-gomodcache-clean GOPATH=/tmp/deck-go-gopath-clean GOSUMDB=off go test ./internal/runtime/openclaw ./internal/server -run 'TestContractAdapters|TestGatewayQueriesLowRiskWrappersUseTypedClient|TestAdapter_ExposesCapabilityStatusAndSessionQueries|TestGatewayFacade_DeckAgents|TestGatewayFacade_AgentsAndToolsCatalog'` passed. The first run with the stale `/tmp/deck-go-gomodcache` failed on dependency resolution, then passed with a clean cache.
- L1 mock visual: `pnpm exec playwright test --config deck-go/playwright.config.ts deck-go/test/e2e/agents-visual.spec.ts` passed, 1 test.
- L2 real Gateway: `DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test --config deck-go/playwright.config.ts deck-go/test/e2e/agents-real-gateway.spec.ts` passed, 2 tests. Coverage includes runtime health, `gateway.describe`, `agents.list`, Deck detail, safe section reads, files, identity, production UI render, agent selection, event-stream section navigation, and tool-policy preview navigation.
- Frontend build: `make frontend-build` passed.

### Handoff-blocked scenarios

- Real create/update/delete/save mutation is intentionally not automated yet. It needs disposable or reversible agent state before running against a user's OpenClaw config.
- Server-side list query/pagination, richer live status, and always-present list counters are not supported by current Gateway list capability. They stay client-side/degraded until Gateway adds source support.

## Agents control contract completion

OpenSpec change: `deck-go-agents-control-contract-completion`
Date: 2026-05-04

- Agents/subagents write actions are now action-level rows in `deck-go/contracts/source/deck-mutations.contract.json`: `agents.create`, `agents.update`, `agents.delete`, `agents.skills.save`, `agents.subagents.save`, `agents.eventStreams.save`, `agents.files.save`, `subagents.kill`, and `subagents.steer`.
- Generated mutation metadata is available in `deck-go/contracts/generated/ts/deck-mutations.generated.ts` and `deck-go/docs/deck-mutation-evidence-contract.md`.
- `frontend-new/src/api.ts` routes those write wrappers through `acknowledgeMutationResponse()` while preserving existing response DTOs and BFF request shapes.
- Fixture safety for agents/subagents writes remains `deferred`. This is intentional: the actions are contract-known, but automated L2 real mutation still needs disposable or reversible agent/subagent state.
- Focused evidence: mutation contract test/check passed; frontend tests for mutation evidence, agents API routing, AgentsPanel, and SubagentsPanel passed. The Vitest run emitted the existing jsdom canvas `getContext()` warning, but all tests passed.
