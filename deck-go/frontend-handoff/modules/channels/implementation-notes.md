# channels implementation notes

## Prototype parity remediation

OpenSpec change: `deck-go-frontend-channels-prototype-parity-remediation`

### Status

- Active visual target remains `frontend-handoff/modules/channels/prototype.html`.
  `prototype-v1-codex.html` is reference-only.
- Production Channels now has a stronger mock parity pass against the active v2
  list-to-detail prototype. The list view uses five representative channels,
  exposes row-level throughput, preserves disabled/probe semantics, and includes
  an interactive probe-result dialog plus logout confirmation dialog.
- Accepted visual exception: the active prototype is standalone while production
  renders inside the Deck shell. Shell chrome, nav width, and top-right runtime
  badges are product-shell context rather than module drift.
- Accepted contract exceptions: first-class channel creation, real throughput
  history, server-normalized `accountDiagnostics`, server-normalized
  `wecomAccess`, probe history, routing add drawer, and destructive provider
  mutations remain unsupported, degraded, mock-only, or skipped-safe.

### Mock evidence

- Focused TypeScript check:
  `cd deck-go/frontend-new && npx tsc -b --pretty false`
- Focused unit/API tests:
  `cd deck-go/frontend-new && npm run test:deck-ui -- src/api.chat-helpers.test.ts src/components/panels/channels/ChannelsPanel.test.tsx`
  -> 2 files passed, 64 tests passed.
- Mock visual E2E:
  `cd deck-go && pnpm exec playwright test test/e2e/channels-visual.spec.ts --config playwright.config.ts --output .local/channels-remediation-mock-visual --reporter=line`
  -> 1 passed.
- Prototype-current report:
  `cd deck-go && node scripts/generate-prototype-parity-report.mjs --prototype-dir .local/prototype-gap-audit --mock-dir .local/channels-remediation-mock-visual --out-dir .local/channels-prototype-remediation-parity-report --sheet-size 1`
  -> `sheet-7.png` contains the Channels contact sheet.

### Real Gateway evidence

- Real E2E:
  `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/channels-real-gateway.spec.ts --config playwright.config.ts --output .local/channels-remediation-real-e2e --reporter=line`
  -> 2 passed.
- API evidence verified bundled runtime readiness, `gateway.describe`,
  `GET /api/channels`, typed `channels.status` RPC, and
  `GET /api/channels/telegram/throughput`.
- UI evidence verified Chat -> Channels shell navigation, dark/en and light/zh
  variants, search/filter interaction, empty-state refresh, BFF-only browser
  transport, and no unexpected console/page/BFF API errors.
- Fixture evidence is `skipped-safe`: the real E2E harness removed external
  channels from the isolated config (`openclaw-weixin`, `wecom`) and no
  disposable provider-backed channel fixture exists. Config-only rows would not
  surface through `channels.status` without a provider plugin, so probe/logout
  and config patch mutations remain skipped-safe.

## Real contract verification pass

OpenSpec change: `frontend-channels-real-contract-verification`

### Baseline

- Active handoff target: `README.md` marks the v2 multi-file package as `revised v2 — pending implementation`; `prototype.html` is the active visual target and `prototype-v1-codex.html` is reference-only.
- Prototype smoke evidence: served `deck-go/frontend-handoff/modules` locally and opened `/channels/prototype.html` with Playwright. The page title was `deck-go channels — interactive prototype`, first viewport rendered the Channels workbench, and no console errors, page errors, or 4xx/5xx responses were observed.
- Current production implementation: `frontend-new/src/components/panels/channels/ChannelsPanel.tsx` already calls the Deck BFF through `frontend-new/src/api.ts` wrappers for channel inventory, probe, throughput, logout, and patch behavior.
- Current production visual state: the panel is still an older two-column workbench with nested surfaces. It is contract-connected but not yet aligned to the v2 full-width list-to-detail handoff pattern.
- Current backend surface: Go BFF routes exist for `/channels`, `/channels/{id}/test`, `/channels/{id}/throughput`, `/channels/{id}/logout`, and `/channels/{id}` patch. Throughput currently returns an explicit empty payload.

### Initial product-contract findings

| Prototype expectation               | Current contract/BFF truth                                                                                                                                     | Decision for this pass                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `accountDiagnostics` BFF projection | No first-class `DeckGoChannelsStatusResponse.accountDiagnostics` field currently exists; production derives diagnostics from provider-shaped account payloads. | Keep as frontend selector unless audit proves a deterministic shared DTO is worth adding.                    |
| `dmPolicy` BFF projection           | Current non-WeCom editor reads `dmPolicy` or nested `dm.policy` from account/channel payload and writes through `PATCH /channels/{id}`.                        | Keep selector-derived and document unsupported provider-specific variants.                                   |
| `wecomAccess` BFF projection        | Current WeCom access state is read from `/config` and saved through `/config/patch`; routing evidence comes from `/routing`.                                   | Keep config/routing-backed behavior unless a scoped DTO projection is proven necessary.                      |
| Rich throughput bars                | Current BFF throughput endpoint returns empty buckets and zero totals.                                                                                         | Render honest empty state in production; use rich fixture only as L1 mock visual evidence.                   |
| Create-channel wizard               | No dedicated create-channel contract is present in current Deck-facing API.                                                                                    | Keep create affordance disabled/explained or document as follow-up unless audit finds supported config path. |

### Gateway/BFF capability audit

Audit date: 2026-05-04.

- Generated Gateway artifacts include typed `channels.status` and `channels.logout` in `contracts/generated/ts/gateway/protocol.ts`, `contracts/generated/ts/gateway/client.ts`, `backend/internal/gateway/generated/types.go`, `backend/internal/gateway/generated/methods.go`, and the generated allowlist.
- Gateway source defines `channels.status` and `channels.logout` in `src/gateway/server-methods/channels.ts`; `control-plane-method-defs.ts` registers schemas and scopes for both methods.
- `ChannelsStatusResultSchema` is intentionally schema-light. Account payloads are provider-shaped and allow additional properties; `dmPolicy`, `allowFrom`, `probe`, and `audit` can exist per account, but `accountDiagnostics` and `wecomAccess` are not Gateway result fields.
- Deck endpoint classification keeps `GET /channels`, `POST /channels/{channelId}/test`, `POST /channels/{channelId}/logout`, `GET /channels/{channelId}/throughput`, and `PATCH /channels/{channelId}` as `deck-go-bff`. There are no channels rows in `deck-exceptions.contract.json` or generated untyped-exception docs.
- Go BFF inventory routes call `channels.status` for inventory/probe, `channels.logout` for logout, `config.get` + `config.patch` for channel patch, and `deck.routing.list` for routing. Throughput currently returns `{ buckets: [], messagesIn: 0, messagesOut: 0 }`.
- Real stack API evidence using the local real-stack token:
  - `GET /api/v1/runtimes` returned a runtime envelope.
  - `GET /api/gateway/describe` returned 82 methods but did not list `channels.status` or `channels.logout`.
  - `GET /api/channels` returned a valid empty channels shape with `channelOrder` length 0 and no accounts.
  - Direct typed RPC `channels.status` through `/api/v1/runtimes/rt_local/gateway/rpc` succeeded and returned the fuller schema keys including `channelMeta`, `channelDetailLabels`, and `channelSystemImages`.
  - Direct typed RPC `channels.logout` for `telegram` returned HTTP 502 with `INVALID_REQUEST: invalid channels.logout channel`, so logout is capability/environment-dependent and must stay behind confirmation plus real-state checks.
  - `GET /api/channels/telegram/throughput` returned zero totals and zero buckets.

Describe visibility drift: real `gateway.describe` does not advertise `channels.*` even though source/generated artifacts and direct typed RPC support them. Production channels UI should not use `gateway.describe` as the capability authority for channels; it should use the Deck BFF wrappers and document the describe gap for later upstream/Gateway introspection cleanup.

### Capability matrix

| Workflow                  | Frontend wrapper / UI path                                             | Deck endpoint / DTO                                                | Go adapter / route                                                 | Gateway or BFF authority                                   | Classification        | Product decision                                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Refresh inventory         | `fetchChannels()`                                                      | `GET /channels`, `DeckGoChannelsStatusResponse`                    | `adapter.ChannelsStatus(params)`                                   | `channels.status` typed RPC                                | supported             | Implement refresh and empty state; tolerate optional fields missing from real BFF response.                                      |
| Channel selection         | Local UI state over `channelOrder`/`channels`/`channelMeta`            | `DeckGoChannelsStatusResponse`                                     | None beyond inventory                                              | BFF-shaped inventory payload                               | supported             | Implement list/detail navigation without server-side search or pagination claims.                                                |
| Account diagnostics       | Defensive selector over `channelAccounts`                              | Provider-shaped account records                                    | `channels.status` passthrough                                      | Gateway schema-light account snapshots                     | degraded              | Keep as UI selector; do not add `accountDiagnostics` DTO in this pass.                                                           |
| Probe/test channel        | `testChannel(channelId)`                                               | `POST /channels/{id}/test`, `DeckGoChannelTestResponse`            | calls `channels.status` with `probe: true`, derives first OK/error | Gateway probe/audit hooks where configured                 | environment-dependent | Implement action and error formatting; expect failures when provider/account is absent or unconfigured.                          |
| Throughput                | `fetchChannelThroughput(channelId, window)`                            | `GET /channels/{id}/throughput`, `DeckGoChannelThroughputResponse` | returns empty placeholder                                          | Local BFF placeholder, no real Gateway metric source found | degraded              | Render an honest unavailable/empty state; do not use prototype rich bars as production data.                                     |
| Logout                    | `logoutChannel(channelId)`                                             | `POST /channels/{id}/logout`                                       | `channels.logout` typed RPC                                        | Gateway plugin `logoutAccount` support                     | environment-dependent | Keep confirmation gate; real verification requires disposable/configured channel state.                                          |
| Enable/disable            | `patchChannelConfig(channelId, { enabled })`                           | `PATCH /channels/{id}`                                             | `config.get` then `config.patch` with base hash                    | Gateway config patch                                       | environment-dependent | Expose only with cautious copy and error handling; real mutation verification is handoff-blocked unless disposable state exists. |
| Settings patch            | `patchChannelConfig(channelId, patch)`                                 | `PATCH /channels/{id}`                                             | `config.get` then `config.patch` with base hash                    | Gateway config patch                                       | environment-dependent | Preserve base-hash behavior; validate inputs locally.                                                                            |
| DM policy patch           | `patchChannelConfig(channelId, { dmPolicy })` or provider-shaped patch | `PATCH /channels/{id}`                                             | config patch                                                       | Provider-shaped config                                     | degraded              | Keep selector/editor support for known fields; document provider-specific variants.                                              |
| Routing bindings          | routing API wrappers used by existing channels code                    | `/deck/routing`                                                    | `adapter.DeckRoutingList(params)`                                  | `deck.routing.list` typed RPC                              | supported             | Render routing summary/navigation handoff without changing routing module semantics.                                             |
| Plugin navigation         | Channel `channelMeta` plugin fields                                    | inventory DTO + plugin endpoints as navigation targets             | inventory passthrough                                              | Gateway UI catalog/plugin metadata                         | degraded              | Render metadata links only when fields exist; no install flow in this pass.                                                      |
| WeCom access display/save | config/routing helpers plus `WecomAccessControls`                      | `/config`, `/config/patch`, `/deck/routing`                        | config/routing routes                                              | Gateway config + routing                                   | degraded              | Keep config/routing-backed controls; do not claim account-level `wecomAccess` DTO.                                               |
| Create-channel affordance | Prototype create dialog                                                | No dedicated endpoint                                              | No route                                                           | Not supported as a first-class contract                    | unsupported           | Show disabled/follow-up affordance or omit destructive path; do not invent create behavior.                                      |

### Contract-chain calibration decisions

- No Deck-facing DTO source change is required for this pass. Current `DeckGoChannelsStatusResponse`, `DeckGoChannelTestResponse`, and `DeckGoChannelThroughputResponse` already cover the supported BFF endpoints.
- `accountDiagnostics` remains a production frontend selector over provider-shaped `channelAccounts` entries. The selector can use `enabled`, `configured`, `linked`, `connected`, `lastError`, `probe`, and related optional fields, but it must tolerate real empty payloads.
- `dmPolicy` remains selector-derived. The Gateway account snapshot can include `dmPolicy`; existing editors also read nested `dm.policy` and save provider-shaped patches through `PATCH /channels/{id}`. This is not promoted to a normalized BFF projection in this change.
- `wecomAccess` remains config/routing-backed through `/config`, `/config/patch`, and `/deck/routing`. The prototype's `wecomAccess` object is a design fixture, not a production response field.
- Throughput remains a BFF placeholder until a real Gateway metric source exists. Production may show window controls and empty/unavailable state, but it must not imply real traffic bars when buckets are empty.
- Endpoint classification and exception files are aligned with the current implementation: channels routes are Deck BFF endpoints and no channels Gateway method is part of the untyped-exception list.
- No deterministic Go adapter drift was found during calibration. Existing BFF behavior preserves config base-hash handling for channel patch and already has focused route tests for channel probe/throughput and patch sequencing.
- Unsupported or unsafe prototype expectations for this pass: first-class create-channel, rich production throughput, account-level `wecomAccess` DTO, and unconditional real logout/config mutation verification.

### Backend control-plane pass

- No backend code changes were required by the calibration pass.
- Throughput remains the explicit empty placeholder implemented by the Go BFF.
- Channel patch keeps the existing `config.get` -> `config.patch` base-hash sequence.
- Focused verification passed:
  - `cd deck-go/backend && go test ./internal/server -run 'TestGatewayFacade_Channel(TestThroughputAndProjection|PatchUsesConfigGetThenConfigPatch)'`
  - `cd deck-go/backend && go test ./internal/runtime/openclaw -run 'TestGatewayQueriesRepresentativeWrappersSmoke|TestGatewayQueriesLowRiskWrappersUseTypedClient'`
- Backend handoff gaps: `gateway.describe` omits `channels.*` despite direct typed RPC support; real logout/config mutation needs disposable channel/config state; real channel throughput needs a future Gateway/BFF metric source.

### Production UI implementation

- Production channels UI now follows the revised v2 list-to-detail pattern in `frontend-new/src/components/panels/channels/ChannelsPanel.tsx`.
- The default surface is a full-width channel inventory with KPI strip, search/filter controls, contract-shaped rows, disabled `New channel` affordance, and a real empty state for empty `channels.status` payloads.
- Channel detail is a full-width workbench with hero summary and tabs for Overview, Throughput, Probe, Settings, Routing, and WeCom access when the selected channel is WeCom-backed.
- Network calls stay behind `frontend-new/src/api.ts`: `fetchChannels`, `fetchChannelThroughput`, `testChannel`, `patchChannelConfig`, `logoutChannel`, `fetchRoutingBindings`, and existing config helpers used by `WecomAccessControls`.
- `accountDiagnostics` is implemented as a defensive frontend selector over provider-shaped account snapshots. It is not treated as a Deck BFF response field.
- `dmPolicy` remains selector/provider-shaped patch behavior through `PATCH /channels/{channelId}`; account-level variants are preserved as best-effort config patches.
- `wecomAccess` remains config/routing-backed through existing WeCom controls. The prototype's `wecomAccess` fixture is not a production response field.
- Throughput renders real buckets only when the BFF returns buckets. The current real BFF empty placeholder renders an explicit empty state rather than prototype fixture traffic.
- Create-channel remains disabled because no first-class create-channel endpoint exists. Logout, enable/disable, settings, DM policy, and WeCom save remain confirm/error-gated or config-backed mutations.
- The panel uses design-system icons/tokens and production CSS classes; no inline styles or direct `lucide-react` imports were added.

### Prototype divergences accepted

The revised v2 handoff was useful for structure and interaction intent, but these prototype assumptions were intentionally not implemented as production facts:

- Rich throughput fixture data is L1 mock visual evidence only; real production throughput remains empty until a Gateway/BFF metric source exists.
- `accountDiagnostics` and `wecomAccess` are not added as server contract fields in this pass.
- Create-channel is not implemented because current Gateway/BFF contracts do not expose a supported create workflow.
- `gateway.describe` is not used as the channels capability authority because real describe output omits `channels.*` despite typed RPC support.

### Frontend and visual verification

- Focused Vitest passed:
  - `cd deck-go/frontend-new && npm run test:deck-ui -- src/api.chat-helpers.test.ts src/components/panels/channels/ChannelsPanel.test.tsx`
  - Result: 2 files passed, 53 tests passed.
- The focused API seam test covers channels inventory, throughput URL encoding, logout, channel patch, config read/patch, routing helper coverage, and probe 502 error preservation.
- Channels component tests cover v2 list/default/filter/detail, Chinese copy, cross-panel detail navigation, probe/settings toggle, settings/account patch, WeCom access params, routing tab BFF usage, and real empty payload rendering.
- L1 mock visual Playwright passed:
  - `cd deck-go && pnpm exec playwright test test/e2e/channels-visual.spec.ts --config playwright.config.ts`
  - Result: 1 passed.
  - Screenshot evidence produced by the test: `channels-list-ready.png`, `channels-discord-detail.png`, `channels-probe-state.png`, and `channels-wecom-access-state.png` under Playwright output.

### L2 real Gateway verification

- Real channels E2E passed:
  - `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/channels-real-gateway.spec.ts --config playwright.config.ts`
  - Result: 2 passed.
- Real API smoke verified runtime gateway readiness, `gateway.describe` availability, direct typed RPC `channels.status`, production `GET /api/channels`, and safe read `GET /api/channels/telegram/throughput`.
- Real UI smoke opened the production channels panel through the `frontend-new` shell, rendered real empty-or-configured state, exercised refresh or detail/throughput tab interaction, and observed no unexpected API 4xx/5xx, page errors, or console errors.
- Real safe mutation verification is handoff-blocked for this change: no disposable/reversible channel or config state was established, so logout, enable/disable, settings patch, DM policy patch, WeCom save, and create-channel were not run against the user's real OpenClaw configuration.

### Code review result

- No channels-scoped code findings remain after review.
- Reviewed surfaces: `frontend-new/src/components/panels/channels/**`, `frontend-new/src/api.ts`, channels-focused frontend tests, channels mock/real E2E, Go BFF channels routes/adapters, generated Gateway bindings, endpoint classification, exception docs, and this handoff note.
- Review checks found no production raw Gateway calls in channels panel components, no unsupported mock-only server fields treated as production DTOs, no inline styles, no direct `lucide-react` imports, and no unsafe real mutation in L2 tests.
- Residual risks:
  - `gateway.describe` visibility drift for `channels.*` remains a later Gateway introspection cleanup.
  - Throughput remains a BFF placeholder until a real metric source is added.
  - Real mutation coverage needs a disposable channel/config fixture before it can be safely automated.

## Contract completion follow-up

OpenSpec change: `deck-go-channels-control-contract-completion`

- Added shared mutation evidence rows for `channels.probe`, `channels.logout`, and `channels.config.patch`.
- Added `DeckGoChannelLogoutResponse` to the Deck-facing DTO source and regenerated Deck API TypeScript/Go artifacts.
- Routed `testChannel`, `logoutChannel`, and `patchChannelConfig` through shared mutation evidence helpers while preserving their response DTOs and BFF-only browser boundary.
- Kept real channel probe/logout/config mutation automation skipped-safe or deferred unless disposable provider/config state is proven.
- Preserved throughput as an honest degraded/unavailable state: the BFF endpoint exists, but empty buckets/zero totals are not treated as real metric coverage.
- Verification evidence:
  - `cd deck-go && make mutation-evidence-contract-test && make mutation-evidence-contract-check && make deck-api-check`
  - `cd deck-go/frontend-new && npm run test:deck-ui -- src/lib/mutation-evidence.test.ts src/api.chat-helpers.test.ts src/components/panels/channels/ChannelsPanel.test.tsx`

### Worktree preservation

- Agents real-contract archive and generated contract docs are already dirty from the previous completed module; do not revert them.
- `models` now has a smoke-passing v2 handoff, but it is outside this change. Its pricing/audit BFF assumptions need a separate proposal and contract calibration.
