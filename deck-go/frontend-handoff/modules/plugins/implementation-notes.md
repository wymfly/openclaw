# Plugins Implementation Notes

## Production closeout

- Implemented the production rewrite under `deck-go/frontend-new/src/components/panels/plugins/` with a read-only list-to-detail inventory flow, KPI strip, capability scope switching, search, origin/capability filters, dense rows, Overview/Capabilities/Diagnostics/Activation/Manifest/Audit tabs, diagnostic/manifest/raw dialogs, channel handoff actions, raw payload evidence, and explicit contract-gap copy.
- Preserved the existing panel registry, frontend API facade, and channel navigation helpers.
- Kept unsupported prototype behavior as degraded/follow-up evidence: no manifest route, no audit route, no install/uninstall/enable/disable/reload mutations, no marketplace/trust metadata, and no package-signature verification.
- Real Gateway inventory can be empty or populated depending on the isolated config and bundled plugin state; the UI handles empty-valid states while mock visual covers populated list/detail/dialog states.

## Contract-chain matrix

| Workflow                    | Contract path                                                                             | Classification           | Evidence                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| Inventory                   | `fetchPluginsWithCapability("channel")` -> `GET /api/deck/plugins` -> `deck.plugins.list` | supported                | focused frontend, Go route tests, L1 visual, L2 real API/UI |
| Scope switch                | `fetchPluginsWithCapability("all")` -> `GET /api/deck/plugins?capability=all`             | supported                | focused frontend, L1 visual, L2 real API/UI                 |
| Search/filter               | browser projection over `DeckGoPluginInventoryEntry[]`                                    | supported                | focused frontend test                                       |
| Selection/detail            | selected `DeckGoPluginInventoryEntry`                                                     | supported                | focused frontend test, L1 visual                            |
| Capabilities                | capability/channel/provider/tool fields                                                   | supported                | focused frontend test                                       |
| Diagnostics                 | `DeckGoPluginDiagnostic[]`                                                                | supported                | focused frontend test                                       |
| Channel handoff             | `channelIds` plus `fetchChannels()` visibility                                            | supported                | focused frontend test, L1 visual                            |
| Raw payload                 | selected plugin JSON                                                                      | supported                | focused frontend, L1 visual                                 |
| Manifest                    | synthetic projection from inventory                                                       | degraded / route-blocked | UI tab and docs                                             |
| Audit                       | activation source/reason only                                                             | degraded / route-blocked | UI tab and docs                                             |
| Browser BFF-only access     | frontend wrappers and Playwright request/socket guards                                    | supported                | L2 real UI                                                  |
| Lifecycle mutations         | no contract route                                                                         | unsupported follow-up    | UI gaps and docs                                            |
| Marketplace/trust/signature | no contract route                                                                         | unsupported follow-up    | UI gaps and docs                                            |

## Verification evidence

- Prototype smoke: `deck-go/frontend-handoff/modules/plugins/prototype.html` loaded with title `deck-go plugins - interactive prototype` and no browser console/page errors.
- Focused frontend: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/plugins/PluginsPanel.test.tsx src/api.chat-helpers.test.ts` -> 55 tests passed.
- Focused backend: `cd deck-go/backend && go test ./internal/server ./internal/runtime/openclaw ./internal/api/http -run 'TestGatewayFacade_ChannelsAndPlugins|TestGatewayQueriesTyped|TestMountRuntimeRoutes|TestNewHandlerWithDependencies_ExposesStage2RuntimeRoutes|TestManagedRuntime|TestLegacyInventorySurface'` -> passed.
- L1 mock/local visual: `cd deck-go && pnpm exec playwright test test/e2e/plugins-visual.spec.ts --config playwright.config.ts` -> 1 passed.
- L2 real stack: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/plugins-real-gateway.spec.ts --config playwright.config.ts` -> 2 passed. Real Gateway returned empty-valid inventory; route envelopes and UI render were verified.
- Frontend build: `cd deck-go && make frontend-build` -> passed.

## Residual risks

- Real plugin activation is not proven here; this module only verifies read-only inventory.
- Manifest and audit tabs are synthetic/degraded until BFF projection routes exist.
- Status, origin, capability kind, and diagnostic level are open strings; future Gateway values should remain searchable and visibly rendered.
- Marketplace trust and package signature verification require separate contract proposals.

## Design-system feedback

- Reused settled typography, token colors, spacing, low-radius surfaces, compact workbench density, segmented buttons, chips, evidence tiles, and raw JSON blocks.
- Kept plugin rows, detail hero, evidence tabs, contract-gap list, and synthetic manifest block as module-local molecules.
- Promotion candidates remain `MetricTile`, `WorkbenchHeader`, `SelectableInventoryRow`, `DetailHero`, and `RawJsonBlock`; promotion should happen in a separate design-system proposal.

## Contract-chain completion closeout — 2026-05-05

### Contract evidence update

- Reconfirmed Plugins inventory uses `DeckGoPluginsListResponse` through `/api/deck/plugins` and `deck.plugins.list`.
- Reconfirmed `deck-api-dynamic-surfaces` has no `DeckGoPlugin*` accidental dynamic leaves.
- Closed the matrix follow-up as a read-only product surface; manifest, audit, lifecycle mutations, marketplace trust, and package signature verification remain unsupported or degraded until dedicated contracts exist.

### Current truth

- Plugin inventory, capability filtering, diagnostics, channel handoff evidence, and raw payload inspection are contract-known read surfaces.
- Plugin lifecycle actions are not implemented in Deck Go; do not surface enable/disable/reload/install/uninstall controls without a Gateway or Deck-local contract.
- Code truth remains authoritative over this note; update contract sources and regenerate artifacts before changing UI claims.

### Additional verification

- `node -e "..."` check confirmed no `DeckGoPlugin` dynamic-surface entries remain in `deck-go/docs/deck-api-dynamic-surfaces.md`.
- `cd deck-go/backend && go test ./internal/server ./internal/runtime/openclaw ./internal/api/http -run 'TestGatewayFacade_SkillsRoutes|TestGatewayFacade_ChannelsAndPlugins|TestGatewayQueriesRepresentativeWrappersSmoke|TestGatewayQueriesLowRiskWrappersUseTypedClient|TestMountRuntimeRoutes|TestManagedRuntime|TestLegacyInventorySurface'` passed.
- `cd deck-go/frontend-new && npm run test:deck-ui -- src/api.chat-helpers.test.ts src/lib/mutation-evidence.test.ts src/components/panels/skills/SkillsPanel.test.tsx src/components/panels/plugins/PluginsPanel.test.tsx` passed, 82 tests.

## Prototype parity remediation — 2026-05-05

OpenSpec change: `deck-go-frontend-plugins-prototype-parity-remediation`

### Active target

- Active prototype: `frontend-handoff/modules/plugins/prototype.html`.
- Reference-only prototype: `frontend-handoff/modules/plugins/prototype-v1-codex.html`.
- Production target: `frontend-new/src/components/panels/plugins/PluginsPanel.tsx`.

### Contract mapping

| Product workflow                      | Deck frontend wrapper                               | BFF/Gateway source                                            | Verdict                                            |
| ------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------- |
| Channel-scope inventory               | `fetchPluginsWithCapability("channel")`             | `GET /api/deck/plugins` -> `deck.plugins.list`                | Supported                                          |
| All-scope inventory                   | `fetchPluginsWithCapability("all")`                 | `GET /api/deck/plugins?capability=all` -> `deck.plugins.list` | Supported                                          |
| Search/filter/detail                  | local selectors over `DeckGoPluginInventoryEntry[]` | no extra RPC                                                  | Supported                                          |
| Detail tabs                           | selected `DeckGoPluginInventoryEntry` fields        | inventory DTO only                                            | Supported with degraded Manifest/Audit projections |
| Diagnostic dialog                     | `DeckGoPluginDiagnostic[]`                          | inventory DTO diagnostics                                     | Supported                                          |
| Manifest/raw dialogs                  | selected plugin JSON                                | synthetic projection from inventory DTO                       | Degraded, no dedicated route                       |
| Channel/routing/access handoff        | `channelIds` plus `fetchChannels()` visibility      | Channels BFF + Deck navigation                                | Supported where channel is visible                 |
| Lifecycle/marketplace/trust/signature | none                                                | no current Deck-facing route                                  | Unsupported follow-up                              |

### Production changes

- Replaced the older inventory workbench with the active prototype's list-first
  flow: page header, KPI strip, toolbar controls, dense rows, and row-to-detail
  navigation.
- Added detail tabs for Overview, Capabilities, Diagnostics, Activation,
  Manifest, and Audit. Route-blocked Manifest/Audit data is labelled as
  synthetic or projection-only.
- Added diagnostic detail, Manifest preview, and raw inventory dialogs.
- Preserved channel/routing/access handoffs and kept all data loads behind Deck
  BFF wrappers. Browser code still does not call Gateway or plugin runtime
  endpoints directly.
- Fixed deterministic UI drift found during verification: unknown future
  capability kinds now render as their raw value instead of a missing i18n key,
  and the Activation chain has an explicit Imported label in both locales.

### Accepted exceptions

- Deck shell chrome remains outside the standalone prototype frame.
- Manifest and raw dialogs use inventory-derived JSON; no per-plugin manifest
  route exists today.
- Audit is an activation projection from `activationSource` and
  `activationReason`; no activation-history route exists today.
- Lifecycle mutations, marketplace metadata, trust source, and package
  signature verification remain unsupported until dedicated Gateway/Deck
  contracts exist.
- The real E2E safely wrote a run-scoped plugin manifest and patched the
  isolated `openclaw.json`, but the running Gateway did not surface that new
  post-start `plugins.load.paths` entry in `deck.plugins.list`. The scenario is
  recorded as degraded rather than failed because the real stack already exposed
  populated Gateway-backed plugin inventory and the UI exercised those real
  rows. A future fixture proposal should seed plugin load paths before Gateway
  startup or use a supported config reload/restart contract.

### Strengthened real E2E evidence

- Real API evidence verifies `/api/deck/plugins` and
  `/api/deck/plugins?capability=all` route envelopes against a real Gateway.
  The run reported 24 channel-scope plugins and 103 all-scope plugins.
- Fixture evidence writes a run-scoped plugin under the isolated workspace and
  patches only the isolated `openclaw.json`; cleanup refuses non-run-id plugin
  paths and plugin ids.
- Real UI evidence starts from Chat, navigates through the Deck shell to
  Plugins, covers dark English and light Chinese variants, switches
  `scope=all` and `scope=channel`, opens a real plugin detail row, clicks all
  six tabs, opens Manifest and raw dialogs, and verifies no browser direct
  Gateway requests or websockets.

### Verification

- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/plugins/PluginsPanel.test.tsx` passed, 7 tests.
- `cd deck-go && pnpm exec playwright test test/e2e/plugins-visual.spec.ts --config playwright.config.ts --output .local/plugins-remediation-mock-visual --reporter=line` passed, 1 test.
- `cd deck-go && node scripts/generate-prototype-parity-report.mjs --prototype-dir .local/prototype-gap-audit --mock-dir .local/plugins-remediation-mock-visual --out-dir .local/plugins-prototype-remediation-parity-report --sheet-size 1` generated the Plugins parity report; Plugins is ready for structured review with accepted exceptions above.
- `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/plugins-real-gateway.spec.ts --config playwright.config.ts --output .local/plugins-remediation-real-e2e-strengthened --reporter=line` passed, 2 tests, with fixture visibility recorded as degraded.
