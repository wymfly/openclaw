# Implementation Report

Change: `deck-go-agents-product-control-plane`

This report is implementation evidence for the OpenSpec tasks. Code, generated
contracts, and verified command output remain the final truth; this file records
the decisions and evidence used while applying the change.

## 1.x Preflight Evidence

### Source Truth Audit

| Domain | Source truth | Evidence |
| --- | --- | --- |
| Protected fallback id | OpenClaw normalizes empty agent ids to `main`; `main` is the reserved default agent id. | `src/routing/session-key.ts:20`, `src/routing/session-key.ts:91` |
| Session main key | `session.mainKey` normalizes independently from agent id and defaults to `main`. | `src/routing/session-key.ts:21`, `src/routing/session-key.ts:41` |
| Agent list fallback | If `openclaw.json` has no configured agents, OpenClaw still exposes `main`. | `src/agents/agent-scope-config.ts:57` |
| Configured default | Default agent resolution is config-driven: explicit `default: true`, otherwise first listed agent, otherwise `main`. | `src/agents/agent-scope-config.ts:75` |
| Agent config fields | `AgentConfig` owns id/default/name/workspace/agentDir/system prompt/model/reasoning/fast mode/skills/memory/heartbeat/identity/group chat/subagents/sandbox/tools/channels. | `src/config/types.agents.ts:67`, `src/config/types.agents.ts:93`, `src/config/types.agents.ts:114` |
| Gateway create/update/delete | Gateway supports `agents.create`, `agents.update`, `agents.delete`, and file operations. | `src/gateway/server-methods/agents.ts:461`, `src/gateway/server-methods/agents.ts:553`, `src/gateway/server-methods/agents.ts:641`, `src/gateway/server-methods/agents.ts:680` |
| Create model seed | Gateway create params include optional `model`; deck-go backend already forwards non-empty `model`. | `src/gateway/protocol/schema/agents-models-skills.ts:58`, `deck-go/backend/internal/server/inventory.go:62` |
| Delete file risk | Gateway defaults omitted `deleteFiles` to `true`; deck-go delete currently passes only `agentId`. This must be normalized before exposing normal product delete. | `src/gateway/server-methods/agents.ts:662`, `deck-go/backend/internal/server/inventory.go:86` |
| Deck-facing DTO gap | Current Deck summary/list/detail DTOs do not expose product semantics for protected main, configured default, main key, action availability, or impact metadata. | `deck-go/contracts/source/deck-api.contract.ts:1127`, `deck-go/contracts/source/deck-api.contract.ts:1141`, `deck-go/contracts/source/deck-api.contract.ts:1146` |
| Create contract drift | Current source contract omits `model` from `DeckGoAgentCreateRequest` even though Gateway and BFF support it. | `deck-go/contracts/source/deck-api.contract.ts:2405` |
| Frontend create drift | `CreateAgentDraft` contains `model`, but the request builder currently omits it. | `deck-go/frontend-new/src/components/panels/agents/agents-panel-state.ts:28`, `deck-go/frontend-new/src/components/panels/agents/agents-panel-state.ts:125` |
| Frontend wildcard drift | Current subagent option normalization builds concrete row booleans from `allowAgents`; wildcard `*` is not enough to mark concrete rows correctly. | `deck-go/frontend-new/src/api.ts:2378` |
| Current UI section gap | Current Agents sections are overview, skills, subagents, tool policy, system prompt, files, event streams; runtime/workspace/routing impact/activity/danger-zone are not first-class product sections. | `deck-go/frontend-new/src/components/panels/agents/agents-panel-state.ts:7` |

### `openclaw.json` Mutation And Ownership Ledger

| Affordance | Config / runtime domain | Owner | Gateway / BFF route | UI pattern | Risk | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| Create agent identity | `agents.list[]` name/identity/workspace/model | Agents | `POST /agents` -> `agents.create` | Wizard with review | Medium | create payload unit test; fixture create real check |
| Edit identity | `agents.list[].name`, identity emoji/avatar | Agents | `PATCH /agents/{id}` -> `agents.update` | Normal save | Low | focused UI test |
| Edit model seed/runtime | `agents.list[].model` | Agents + Models | `PATCH /agents/{id}` -> `agents.update` | Guarded edit with configured picker | Medium | contract test; UI guard test |
| Edit workspace | `agents.list[].workspace` | Agents | `PATCH /agents/{id}` -> `agents.update` | Guarded edit with impact copy | High | focused UI guard test |
| Default status | `agents.list[].default` / resolution | Agents + Routing | read via list/detail | Read-only badge | High if mutable | no mutation path in this pass |
| Delete non-main | `agents.list[]` removal | Agents | `DELETE /agents?agentId=` -> `agents.delete` | Confirmation with impact | High | main suppression test; fixture delete real check |
| Delete files/sessions | workspace/agent/session dirs | Deferred | Gateway `deleteFiles` param | Not exposed | Very high | BFF must default normal delete to no file deletion |
| Skills assignment | `agents.list[].skills` | Agents + Skills | `deck.agents.skills.get/set` | Search/filter assignment | Medium | ineligible and payload tests |
| Subagent permission | `agents.list[].subagents` | Agents + Subagents | `deck.agents.subagents.get/set` | Allow-any vs explicit list | Medium | wildcard test |
| Tools/sandbox | `agents.list[].tools`, `sandbox`, global tools | Tools/Approvals | `deck.agents.toolPolicy.preview` | Preview/read-only unless write exists | Medium | UI has no fake editor |
| Prompt/files | system prompt + Gateway-allowed workspace files | Agents | `deck.agents.systemPrompt.preview`, `agents.files.*` | Preview and constrained file editor | Medium | allowed-file test / smoke |
| Event streams | `agents.list[].channels.eventStreams` | Agents + Channels/Activity | `deck.agents.eventStreams.get/set` | Editable known/unknown preserved names | Medium | unknown preservation test |
| Routing impact | `bindings[]` | Routing | list/detail impact DTO | Read-only count + navigation | Medium | DTO/UI assertion |
| Sessions/activity | sessions/transcripts/runtime activity | Chat/Sessions/Activity | detail/count/read paths when available | Read-only summary + navigation | Low | mock visual and route checks |

### Target IA Reconciliation

The implementation target is the OpenSpec blueprint, not the existing production
section list. The product surface must contain:

| Target area | Current state | Implementation action |
| --- | --- | --- |
| List workbench | Existing list cards/rows with partial counters | Add protected/default badges, search/filter/sort discipline, no fabricated zeroes. |
| Detail hero | Existing selected detail header | Add protected/default/main-key distinction and impact counters. |
| Section nav | Existing nav only covers current RPC wrappers | Expand to identity, runtime/model/workspace, skills, subagents, tools/sandbox, prompt/files, event streams/activity, routing impact, danger zone. |
| Identity | Mixed into overview with model/workspace | Split safe identity from guarded runtime edits. |
| Runtime/model/workspace | Casual overview patch today | Move to guarded edit posture. |
| Skills | Raw-ish toggle list | Replace with scalable search/filter/assigned-first UI. |
| Subagents | Row booleans | Preserve allow-any wildcard and guard narrowing. |
| Tools/sandbox | Preview exists | Keep preview-only unless write contract exists. |
| Prompt/files | Existing preview/files routes | Keep constrained to Gateway-supported filenames. |
| Event streams/activity | Existing event streams section | Preserve unknown stream names and distinguish Activity ownership. |
| Routing impact | Not first-class | Add read-only impact and owning-module navigation. |
| Danger zone | Delete affordance exists | Block `main`; show non-main impact; no normal file/session deletion option. |

### Cross-Module Classification

| Surface | Classification | Decision |
| --- | --- | --- |
| Agent identity/lifecycle | Agents-owned edit | Implement in Agents. |
| Workspace/model per-agent override | Guarded per-agent quick edit | Implement only with impact copy and configured model choices. |
| Skills install/catalog | Owning-module navigation | Agents edits only per-agent assignment. |
| Model provider/catalog | Owning-module navigation | Agents uses catalog choices; Models owns provider config. |
| Subagent runtime lineage | Owning-module navigation | Agents edits permission/config only. |
| Routing rules | Read-only impact + navigation | No route editor in Agents. |
| Tools/Approvals global policy | Preview + navigation | No fake editor without write contract. |
| Channels setup | Read-only relationship | Agents edits only per-agent event streams. |
| Chat/Sessions transcripts | Read-only activity/counters | Link out; no transcript management. |
| Raw config fields lacking BFF write path | Deferred handoff | Record rather than render successful editor. |

### Current Frontend / Mock / Prototype Comparison

| Source | Useful input | Gap / unsupported item |
| --- | --- | --- |
| Current `frontend-new` Agents | Has working list/detail, create/update/delete wrappers, skills/subagents/event-stream/file previews, tests. | Not productized around protected/default/main-key semantics; runtime fields are too casual; section IA is incomplete. |
| Current mock fixtures | Useful for fast visual states. | Need protected `main`, non-main default, many skills, ineligible skills, wildcard subagents, routing impact, unknown streams, empty/error states. |
| Latest handoff prototype | Useful density/rhythm/reference and enterprise feel. | Not a contract authority; stale API notes still say create omits model while code truth supports model. |
| Enterprise-v2 exploration | Useful product framing. | Any desired-only fields not backed by Gateway/BFF are handoff, not fake controls. |

### Visual Authority Lock

For this change, visual/product authority order is:

1. OpenSpec product blueprint and spec requirements.
2. `frontend-new` design-system tokens, atoms, and existing app shell behavior.
3. Latest Agents high-fidelity prototype as density/rhythm/local interaction reference.
4. Existing production Agents UI as migration reference only.

### Intentional Divergences From Current UI / Prototype

- Identity edit will no longer save workspace/model casually as part of a single overview save.
- `main` will not show a destructive delete path even if earlier UI/handoff showed a shared action shape.
- Delete will not expose Gateway's `deleteFiles` behavior in the normal product flow.
- Default-agent switching remains read-only in this pass.
- Tools/sandbox stays preview-first unless a concrete write contract is added.
- Routing, model provider catalog, skill installation, channel setup, and transcript management remain in their owning modules.
- Prototype-only metrics or controls without Gateway/BFF support are deferred handoff items, not mock-backed product features.

## Verification Evidence

### Changed Files

| Area | Files |
| --- | --- |
| Contract authority | `deck-go/contracts/source/deck-api.contract.ts`, `src/gateway/protocol/schema/deck.ts`, `src/gateway/server-methods/deck/agents-detail.ts` |
| Generated contracts | `deck-go/contracts/generated/ts/*`, `deck-go/backend/internal/deckapi/types.generated.go`, `deck-go/backend/internal/gateway/generated/*`, contract governance docs under `deck-go/docs/` |
| Backend runtime/BFF | `deck-go/backend/internal/runtime/openclaw/*`, `deck-go/backend/internal/server/inventory.go`, focused backend tests |
| Frontend Agents | `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/stores/agents*.ts`, `deck-go/frontend-new/src/components/panels/agents/*`, `deck-go/frontend-new/src/i18n/en.json`, `deck-go/frontend-new/src/i18n/zh.json` |
| Mock/E2E | `deck-go/test/fixtures/mock-gateway.mjs`, `deck-go/test/e2e/agents-visual.spec.ts`, `deck-go/test/e2e/agents-real-gateway.spec.ts` |

### Contract-Chain Decisions

- Deck-facing Agents DTOs now expose product semantics rather than raw
  Gateway-only shapes: protected `main`, configured default, `mainKey`,
  effective sources, available actions, impact metadata, and guarded edit
  metadata.
- `DeckGoAgentCreateRequest.model` was added because OpenClaw Gateway already
  supports create-time model seed and deck-go BFF already forwards it.
- Normal deck-go delete uses `deleteFiles: false` explicitly through the typed
  Gateway requester so omitted JSON fields cannot fall back to Gateway's
  destructive default.
- Direct BFF deletion of `main` is rejected before reaching Gateway-backed
  mutation paths.
- Wildcard subagent permission is preserved as `allowAgents: ["*"]` / allow-any
  instead of being collapsed into a misleading concrete allowlist.
- Unknown event stream names from real Gateway are preserved and rendered
  alongside declared UI options.

### Product-Design Decisions

- The Agents page is now a product control plane organized by ownership:
  identity, guarded runtime, skills, subagents, tool policy preview, system
  prompt, files, event streams, routing impact, and danger zone.
- Safe identity edits are separated from guarded runtime edits. Workspace/model
  changes require explicit review; name/emoji/avatar can save normally.
- `main` keeps normal identity edit affordances but does not expose a delete
  action, and destructive copy explains why it is protected.
- Configured-default switching remains read-only in this pass; the UI shows
  status and impact but does not introduce a partially verified default mutation.
- Skills assignment is search/filter based, assigned-first, and disables
  ineligible rows while keeping exact Gateway `all`/`whitelist` semantics.
- Subagents distinguish allow-any wildcard from explicit allowlists and warn
  before narrowing a wildcard grant.
- Routing, model catalog, skill catalog, channels, activity, and session details
  remain owning-module surfaces. Agents shows impact and navigation, not
  duplicate editors.

### Command Evidence

| Gate | Command | Result |
| --- | --- | --- |
| OpenSpec strict validation | `openspec validate deck-go-agents-product-control-plane --strict` | Passed: change is valid. |
| Contract governance | `cd deck-go && make contract-gate` | Passed: generated artifacts up to date; `gateway-typecheck ok: 0 go exception(s), 0 fe violation(s)`; `gateway-describe-completeness: ok (173 methods, 24 events)`; `contract-chain-audit: ok (26 rows)`. |
| Backend focused tests | `cd deck-go/backend && GOCACHE=/tmp/deck-go-buildcache GOSUMDB=off go test ./internal/runtime/openclaw ./internal/server` | Passed for runtime adapter and server packages. |
| Frontend focused tests | `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/agents/__tests__/agents-panel-state.test.ts src/components/panels/agents/__tests__/AgentsPanel.test.tsx src/api.agents.test.ts` | Passed: 3 files, 15 tests. Benign jsdom canvas warning remains. |
| Frontend build | `cd deck-go && make frontend-build` | Passed: host check, `tsc -b`, and Vite build. Existing chunk-size warning only. |
| Mock visual E2E | `cd deck-go && pnpm exec playwright test --config playwright.config.ts test/e2e/agents-visual.spec.ts` | Passed: 1 test, productized Agents states captured. |
| Real Gateway E2E | `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test --config playwright.config.ts test/e2e/agents-real-gateway.spec.ts` | API scenario passed; browser UI scenarios hit environment circuit breaker described below. |

### Focused Test Coverage

- Frontend component/state tests cover: ready/empty/error states, protected
  `main` delete suppression, safe identity save, guarded runtime save, create
  payload including model, ineligible skills, wildcard subagents, unknown event
  stream preservation, non-main delete, and Routing ownership navigation.
- Backend tests cover: product DTO normalization, explicit `deleteFiles: false`,
  protected `main` delete rejection, and route-level delete behavior.
- Mock visual E2E covers: ready workbench, protected main detail, guarded
  runtime, many skills, wildcard subagents, unknown event streams, delete
  confirmation, create review, light/Chinese state, empty state, and error state.
- Real Gateway API E2E attached
  `test-results/agents-real-gateway-agents-60ef9-gh-deck-go-and-real-Gateway/attachments/agents-api-fixture-4f5d687d7e1208b7da62bec77fae4635163eceac.json`
  with status `passed`, run-scoped fixture create/update/delete, `deck.agents.*`
  reads, and protected `main` delete returning HTTP 400.

## Deferred Handoffs

- Real browser UI E2E against the isolated Gateway environment is blocked by a
  local Chromium launch failure, not by an app assertion. Two browser launches
  in the real Gateway spec failed before page interaction with
  `browserType.launch: Target page, context or browser has been closed` and
  Chromium `MachPortRendezvousServer ... Permission denied (1100)`. Evidence:
  `test-results/agents-real-gateway-agents-5d451-ts-through-shell-navigation/error-context.md`
  and
  `test-results/agents-real-gateway-agents-d9068--and-stable-back-navigation/error-context.md`.
- Per-agent tool/sandbox editing remains preview-only until Deck has a concrete,
  tested write contract for those fields.
- Configured-default switching remains read-only until a product decision and
  safe mutation contract are added.
- Advanced agent config fields such as heartbeat, memory search, runtime posture,
  and per-agent directory policy are not exposed as successful editors in this
  pass. They need field-specific write semantics and risk copy before becoming
  editable controls.
- Pixel parity with the handoff prototype is not claimed. This implementation
  follows the OpenSpec product blueprint and `frontend-new` design system while
  using the prototype for density/rhythm only.

## Archive Readiness

Archive-ready. All 41 tasks are checked complete. The change has passing
OpenSpec strict validation, contract governance, backend focused tests, frontend
focused tests, frontend build, mock visual E2E, and bounded real Gateway API
verification. The remaining real browser UI blocker is explicitly recorded
under the approved task 5.6 circuit breaker.
