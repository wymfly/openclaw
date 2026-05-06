# settings implementation notes

**Implementation status:** implemented — prototype parity remediated / real-contract verified
**Engineering surface:** `frontend-new/src/components/panels/settings/`,
`frontend-new/src/components/runtime/EndpointSection.tsx`, `frontend-new/src/components/runtime/ReadOnlyField.tsx`,
`frontend-new/src/api.ts`, `contracts/source/deck-ui.contract.json`, and `test/e2e/settings-*.spec.ts`

## Production decisions

- Production now follows the active v2 section-rail prototype: topbar,
  searchable left settings nav, and right-side group renderer for identity,
  runtime, appearance, notifications, paired devices, and version.
- Browser code stays BFF-only. Settings reads/writes go to deck-go settings
  storage; runtime endpoint state comes from the runtime facade/supervisor;
  device pairing/token actions go through BFF wrappers to Gateway adapter
  methods.
- Settings save is intentionally constrained to `appearance`,
  `notifications`, and `pairedDevices`. It does not send access-token values,
  runtime endpoint values, or supervisor-owned fields.
- Bundled runtime endpoint controls remain read-only in the UI. The BFF also
  rejects endpoint mutation when `endpointMutable=false`.
- The paired-device section now shows both local `settings.pairedDevices`
  entries and route-backed `/api/devices` inventory. This is intentional:
  `settings.pairedDevices` is the safe run-scoped real E2E fixture surface,
  while `/api/devices` remains the runtime/device facade surface.

## Prototype parity remediation — 2026-05-05

**OpenSpec child proposal:**
`openspec/changes/deck-go-frontend-settings-prototype-parity-remediation`

### Active target

- Active prototype:
  `deck-go/frontend-handoff/modules/settings/prototype.html`
- Reference-only prototype:
  `deck-go/frontend-handoff/modules/settings/prototype-v1-codex.html`
- Accepted product-shell exception: the prototype is standalone; production
  runs inside the Deck shell, so mock parity includes shell chrome.

### Contract mapping

| Prototype workflow        | Production / contract truth                                                                    | Status                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Section rail + search     | `SettingsPanel` local UI state                                                                 | supported                                  |
| Identity/access           | `GET /api/settings`; token status only, no raw token                                           | read-only supported                        |
| Access-token rotation     | no current route                                                                               | unsupported / dialog explains gap          |
| Runtime endpoint          | `GET/PUT /api/runtime/endpoint`, `POST /api/runtime/endpoint:test`, gated by `endpointMutable` | supported                                  |
| Bundled runtime ownership | `.env` + supervisor, backend rejects mutation with `endpoint_not_mutable`                      | supported safety boundary                  |
| Appearance/language       | local shell state plus `PUT /api/settings` safe payload                                        | supported                                  |
| Notifications             | open `notifications?: Record<string, unknown>` shape; no delivery route                        | supported local prefs / delivery gap       |
| Local paired devices      | `settings.pairedDevices` via `PUT /api/settings`                                               | supported safe fixture                     |
| Runtime device inventory  | `/api/devices*` wrappers                                                                       | supported/degraded depending Gateway state |
| Version                   | `GET /api/settings/version`                                                                    | supported                                  |
| Recent saves              | no current route                                                                               | unsupported / documented                   |

### Real fixture strategy

- Real E2E creates a run-scoped local paired-device fixture through isolated
  `PUT /api/settings` with a name/id containing the run id.
- Cleanup restores the original safe `pairedDevices` snapshot and asserts any
  run-scoped cleanup target contains the current run id.
- Real E2E intentionally skips destructive access-token rotation and device
  token rotate/revoke/remove mutations.

## Contract corrections applied

- Corrected stale handoff route truth:
  - settings save is `PUT /api/settings`, not `POST /api/settings`.
  - runtime endpoint test is `POST /api/runtime/endpoint:test`, not
    `/api/runtime/endpoint/test`.
- Corrected stale backend-chain wording: settings read/save is deck-go settings
  store behavior, not a direct `gateway.settings.*` RPC proxy.
- Added Settings-owned device DTOs/endpoints/actions to UI metadata source:
  `DeckGoDevicesResponse`, `DeckGoPairedDevice`,
  `DeckGoPendingDeviceRequest`, `DeckGoSelfDeviceResponse`, and
  `DeckGoDeviceTokenRotateResponse`, plus `/api/devices*` actions.
- Tightened the Settings unit-test fixture so it no longer returns raw
  `accessToken` or `managedGateway` fields.

## Contract-chain matrix

| Workflow                  | Frontend wrapper / behavior                                                       | BFF / DTO truth                                                                   | Classification                               |
| ------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------- |
| Settings read             | `fetchSettings()`                                                                 | `GET /api/settings` → `DeckGoSettingsResponse`; no raw token or supervisor config | supported                                    |
| Settings save             | `saveSettings(buildSettingsSavePayload(settings))`                                | `PUT /api/settings`; only `appearance`, `notifications`, `pairedDevices` accepted | supported                                    |
| Rejected secret save      | real E2E sends `accessToken` and expects 400                                      | `DeckGoRuntimeErrorResponse.code=invalid_settings_field`                          | supported safety boundary                    |
| Settings connection test  | `testSettingsConnection(url, token)` wrapper exists; not exposed in current panel | `POST /api/settings/test-connection`                                              | supported wrapper, UI-deferred               |
| Version read              | `fetchSettingsVersion()`                                                          | `GET /api/settings/version` → `DeckGoSettingsVersionResponse`                     | supported                                    |
| Bootstrap/runtime status  | shell store + `useCapabilities()` / `refreshRuntimeSummary()`                     | `GET /api/bootstrap/status`, `/runtime/gateway`, `/runtime/capabilities`          | supported                                    |
| Runtime endpoint read     | `fetchEndpoint()`                                                                 | `GET /api/runtime/endpoint` → `DeckGoRuntimeEndpointResponse`                     | supported                                    |
| Runtime endpoint save     | `updateEndpoint()` only when `endpointMutable=true`                               | `PUT /api/runtime/endpoint`; bundled rejects with `endpoint_not_mutable`          | supported / skipped-safe in bundled real E2E |
| Runtime endpoint test     | `testEndpoint(payload?)` only when endpoint mutable in UI                         | `POST /api/runtime/endpoint:test`; real stack allows degraded/rejected evidence   | supported/degraded                           |
| Runtime mutability        | `EndpointSection` hides save/test when locked                                     | `DeckGoRuntimeCapabilities.endpointMutable`                                       | supported                                    |
| Device list               | `fetchDevices()`                                                                  | `GET /api/devices` → `DeckGoDevicesResponse` when Gateway supports method         | supported/degraded                           |
| Self device               | `fetchSelfDevice()`                                                               | `GET /api/devices/self` → `DeckGoSelfDeviceResponse`                              | supported/empty-valid                        |
| Pending device actions    | approve/reject confirmation                                                       | `POST /api/devices/approve`, `/reject`; Gateway projection                        | supported, real mutation skipped-safe        |
| Device remove             | confirmation; current device disabled                                             | `POST /api/devices/remove`; Gateway projection                                    | supported, real mutation skipped-safe        |
| Device token rotate       | confirmation; one-time token modal                                                | `POST /api/devices/token/rotate` → `DeckGoDeviceTokenRotateResponse`              | supported, real mutation skipped-safe        |
| Device token revoke       | confirmation; current device revoke disabled                                      | `POST /api/devices/token/revoke`; Gateway projection                              | supported, real mutation skipped-safe        |
| Device stream updates     | `streamEvents()` refreshes on `device.pair.*` events                              | SSE event payload is open projection                                              | supported by unit test                       |
| Appearance/language       | local shell state and settings save payload                                       | `appearance?: Record<string, unknown>` remains open                               | supported/open DTO                           |
| Notifications             | rendered as unavailable placeholder                                               | `notifications?: Record<string, unknown>` remains open; no rich API yet           | degraded/documented                          |
| Recent saves              | prototype fixture only                                                            | no BFF route                                                                      | unsupported/projection                       |
| Keybindings/privacy       | prototype/product follow-up only                                                  | no DTO/route                                                                      | unsupported                                  |
| Bundled `.env` mutation   | not exposed                                                                       | runtime-mode design says operator edits `.env` and restarts                       | unsupported by design                        |
| BFF-only browser behavior | real UI E2E records direct Gateway requests/sockets                               | no direct browser Gateway calls observed                                          | supported                                    |

## Verification evidence

- Prototype parity report:
  `node scripts/generate-prototype-parity-report.mjs --prototype-dir .local/prototype-gap-audit --mock-dir .local/settings-remediation-mock-visual --out-dir .local/settings-prototype-remediation-parity-report --sheet-size 1`
  generated Settings side-by-side sheet 21.
- Frontend focused: `npm run test:deck-ui -- src/components/panels/settings/SettingsPanel.test.tsx`
  passed, 9 tests.
- Prior backend focused evidence: `go test ./internal/server ./internal/api/http ./internal/runtime/openclaw -run 'Test(...)'`
  passed for Settings, runtime endpoint, bootstrap, device, and typed Gateway
  wrappers in the earlier real-contract verification pass.
- L1 mock visual:
  `pnpm exec playwright test test/e2e/settings-visual.spec.ts --config playwright.config.ts --output .local/settings-remediation-mock-visual --reporter=line`
  passed, covering section rail, Appearance dirty state, save confirmation,
  device token dialog, and zh/light variant.
- L2 real stack:
  `DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/settings-real-gateway.spec.ts --config playwright.config.ts --output .local/settings-remediation-real-e2e --reporter=line`
  passed, 2 tests. Evidence includes run-scoped `PUT /api/settings`
  paired-device fixture, unsafe settings write rejection, bundled endpoint
  mutation rejection, Chat -> Settings shell navigation, dark/en + light/zh,
  section search, runtime section, Appearance dirty state, save dialog,
  fixture visibility, BFF-only browser transport, and skipped-safe destructive
  token/device mutations.
- Frontend build: `make frontend-build` passed.
- Prior contract evidence: `make ui-metadata-check` and `make contract-gate`
  passed in the earlier real-contract verification pass. This remediation did
  not change contract source files.

## Residual risks

- `settings.pairedDevices` remains open local settings data; runtime device
  management is typed separately through `/api/devices*`.
- Rich notification preferences, recent-save audit, keybindings, privacy, and
  access-token rotation remain future contract work.
- Real E2E intentionally avoids destructive device/token mutation; mutation
  behavior is covered by unit/mock paths and classified skipped-safe for real
  operator state.
