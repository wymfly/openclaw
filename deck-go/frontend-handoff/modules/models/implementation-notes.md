# Models implementation notes

Status: implemented — real-contract verified
(`frontend-models-real-contract-verification`)

Follow-up closure: `deck-go-models-providers-contract-completion` archived the
head-matrix gap by adding Models config save and provider probe actions to the
shared mutation evidence contract while preserving config-write safety as the
base-hash/conflict authority.

## Prototype parity remediation - 2026-05-05

Child proposal:
`deck-go-frontend-models-prototype-parity-remediation`.

Audit result:

- Active visual target is `frontend-handoff/modules/models/prototype.html`.
- `prototype-v1-codex.html` is retained as historical reference only.
- Production must preserve the current contract chain and translate it into the
  active list-to-detail product flow: provider-grouped model list, model detail
  hero, Overview/Limits/Pricing/Usage/Auth/Audit tabs, catalog dialog, auth
  configuration dialog, and probe result dialog.
- Supported contract surfaces remain `GET/PATCH /models/config`,
  `models.configured`, `deck.auth.overview`, `models.catalog.providers`,
  `deck.auth.probe`, `/usage/cost`, and `/usage/providers`.
- Pricing snapshots, PATCH audit history, and force probe cache refresh remain
  handoff projections. Production may show unavailable/projected states, but
  must not claim those as current Gateway-backed truth.

Real E2E fixture strategy:

- Models is safe to seed in the isolated real E2E state because
  `openclaw.json` is copied into a temporary state directory.
- The real test should fetch `/models/config`, add a provider/model/default
  reference whose id/name include the current run id, save through
  `PATCH /models/config`, verify the run-scoped model through shell navigation
  and the user-visible Models UI, and clean up by removing only run-scoped
  provider/model/default/fallback/allowlist values.
- Cleanup must call the shared run-scope guard and refuse targets that do not
  include the current run id.

Implementation result:

- `ModelsPanel` now follows the active list-to-detail prototype: grouped model
  registry, model detail hero, Overview/Limits/Pricing/Usage/Auth/Audit tabs,
  catalog/auth/probe dialogs, and advanced raw config authority.
- The deterministic Gateway schema drift found during real E2E was fixed:
  Models auth save now writes `apiKey` or an env SecretRef object instead of the
  unsupported `apiKeyEnv` field, provider fixtures include required `baseUrl`,
  and the panel reads `raw`, `config`, `parsed`, or `sourceConfig` from
  `/models/config`.
- The mock Gateway Models fixture was moved closer to the real schema with
  explicit provider `baseUrl`, `apiKey` SecretRefs, object model definitions,
  and representative OpenAI/Anthropic/Ollama model density.
- Real E2E now creates run-scoped model entries through the isolated
  `/models/config` route, retries documented `config.patch` rate limits, refuses
  non-run-scoped cleanup targets, and verifies BFF-only browser transport.

Prototype parity verdict:

- Status: `pass-with-exceptions`.
- Evidence: `.local/models-prototype-remediation-parity-report/`,
  `.local/models-remediation-mock-visual/`, and
  `.local/models-remediation-real-e2e-strengthened/`.
- Accepted exceptions: Deck shell chrome is present around the module; pricing
  snapshot and PATCH audit history remain unavailable/projected because current
  Deck-facing DTOs do not guarantee them; `deck.auth.probe` is not invoked in L2
  to avoid real provider/network side effects before the dedicated live-LLM pass.

Verification evidence:

- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/models/ModelsPanel.test.tsx`
  -> 6 passed.
- `cd deck-go && pnpm exec playwright test test/e2e/models-visual.spec.ts --config playwright.config.ts --output .local/models-remediation-mock-visual --reporter=line`
  -> 1 passed.
- `cd deck-go && node scripts/generate-prototype-parity-report.mjs --prototype-dir .local/prototype-gap-audit --mock-dir .local/models-remediation-mock-visual --out-dir .local/models-prototype-remediation-parity-report --sheet-size 1`
  -> Models ready for review in the generated report.
- `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/models-real-gateway.spec.ts --config playwright.config.ts --output .local/models-remediation-real-e2e-strengthened --reporter=line`
  -> 2 passed. API evidence records `models.configured` as degraded with a
  502 timeout, while config/auth/catalog/usage and UI variant checks passed.
- `cd deck-go && make frontend-build` -> passed.
- `openspec validate deck-go-frontend-models-prototype-parity-remediation --strict`
  -> passed.
- `openspec validate deck-go-frontend-prototype-parity-remediation --strict`
  -> passed.
- `git diff --check` -> passed.

Residual risks:

- Real `models.configured` timed out in L2 and is recorded as bounded runtime
  RPC degradation. The UI remains functional through `/models/config` and other
  supported surfaces.
- Probe semantics remain environment-dependent and should be covered in the
  later live-provider pass.

## Source Truth

- Visual/product target: `frontend-handoff/modules/models/prototype.html`.
- Contract authority: `contracts/source/deck-api.contract.ts`,
  `contracts/source/deck-endpoints.contract.json`, and
  `contracts/source/deck-ui.contract.json`.
- Production frontend: `frontend-new/src/components/panels/models/`.
- Browser boundary: frontend code calls deck-go BFF routes and generated
  runtime Gateway transport only; it does not call the OpenClaw Gateway
  origin directly.

## Contract Matrix

| Workflow                  | Frontend wrapper                               | Deck endpoint / transport                                       | Go / Gateway source                            | Status                | Notes                                                                                            |
| ------------------------- | ---------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| Config read               | `fetchModelsConfig`                            | `GET /api/models/config`                                        | Go models config BFF -> `config.get` adapter   | supported             | Returns raw Models config plus hash when available.                                              |
| Config save               | `saveModelsConfig`                             | `PATCH /api/models/config`                                      | Go models config BFF -> `config.patch` adapter | supported             | Raw JSON remains save authority; base hash is submitted when present.                            |
| Schema lookup             | `lookupConfigPath`                             | `POST /api/config/schema-lookup`                                | Config schema BFF                              | supported             | Used for sidecar schema hints, not required to render inventory.                                 |
| Runtime inventory         | `fetchRuntimeConfiguredModels`                 | `POST /api/v1/runtimes/{runtimeId}/gateway/rpc`                 | `models.configured`                            | supported             | DTO accepts `payload.models` and `payload.items`; production normalizes both.                    |
| Auth overview             | `fetchRuntimeModelAuthOverview`                | `POST /api/v1/runtimes/{runtimeId}/gateway/rpc`                 | `deck.auth.overview`                           | supported             | Provider auth, OAuth, cooldown, usage windows are optional.                                      |
| Catalog providers         | `fetchRuntimeModelCatalogProviders`            | `POST /api/v1/runtimes/{runtimeId}/gateway/rpc`                 | `models.catalog.providers`                     | supported             | Empty catalog providers are empty-valid.                                                         |
| Auth probe                | `probeRuntimeModelAuth`                        | `POST /api/v1/runtimes/{runtimeId}/gateway/rpc`                 | `deck.auth.probe`                              | environment-dependent | Wrapper passes `{ provider }`; no current force flag. L2 avoids real provider calls unless safe. |
| Usage cost                | `fetchModelUsageCost`                          | `GET /api/usage/cost`                                           | Usage BFF                                      | supported             | Canonical frontend route.                                                                        |
| Usage providers           | `fetchModelUsageProviders`                     | `GET /api/usage/providers`                                      | Usage BFF                                      | supported             | Canonical frontend route.                                                                        |
| Models usage aliases      | none in current frontend wrappers              | `GET /api/models/usage/cost`, `GET /api/models/usage/providers` | Models BFF aliases                             | supported alias       | Verified as compatibility aliases; not the canonical frontend route.                             |
| Provider config edits     | local structured editors -> `saveModelsConfig` | `PATCH /api/models/config`                                      | Go models config BFF                           | supported             | Mutates raw draft and saves with base hash.                                                      |
| Catalog apply             | local catalog action -> `saveModelsConfig`     | `PATCH /api/models/config`                                      | Go models config BFF                           | supported             | Adds provider/model refs to raw draft.                                                           |
| Fallback chain edits      | local fallback controls -> `saveModelsConfig`  | `PATCH /api/models/config`                                      | Go models config BFF                           | supported             | Preserves unavailable refs instead of silently deleting them.                                    |
| Allowlist edits           | local allowlist controls -> `saveModelsConfig` | `PATCH /api/models/config`                                      | Go models config BFF                           | supported             | Stored under agent defaults in raw config.                                                       |
| Bedrock discovery edits   | local provider controls -> `saveModelsConfig`  | `PATCH /api/models/config`                                      | Go models config BFF                           | supported             | Numeric/array parsing is local before raw save.                                                  |
| Pricing snapshot          | none                                           | none                                                            | handoff projection only                        | unsupported           | Prototype data is not a guaranteed DTO.                                                          |
| PATCH audit history       | none                                           | none                                                            | handoff projection only                        | unsupported           | Not guaranteed by current BFF.                                                                   |
| Force probe cache refresh | none                                           | none                                                            | handoff projection only                        | unsupported           | Current wrapper has no force parameter.                                                          |
| BFF-only browser access   | panel + real E2E request monitors              | deck-go backend origin only                                     | frontend boundary                              | supported             | Real E2E records direct Gateway request/socket arrays.                                           |

## Deterministic Fixes

- Added a `models-control` UI metadata domain that covers config,
  schema lookup, typed runtime RPC, canonical usage routes, compatibility
  usage aliases, and Models actions.
- Added mutation evidence rows for `models.config.save` and
  `models.auth.probe`; `saveModelsConfig()` and `probeRuntimeModelAuth()` now
  acknowledge those action contracts without changing their response DTOs.
- Regenerated `contracts/generated/ts/deck-ui-metadata.generated.ts`
  and `docs/deck-ui-contract-metadata.md` from
  `contracts/source/deck-ui.contract.json`.
- Added `test/e2e/models-real-gateway.spec.ts` for bounded L2
  route/RPC shape and UI boundary verification.
- Corrected `api-usage.md` route and wrapper truth:
  `saveModelsConfig`, canonical `/usage/*` wrappers, compatibility
  `/models/usage/*` aliases, typed runtime RPC transport, and projected
  pricing/audit/probe-cache behavior.

## Verification Evidence

- Handoff prototype smoke: `prototype.html` loaded over local
  `http.server` with HTTP 200, title `deck-go models — interactive
prototype`, H1 `Models`, body showing the 9-model workbench, and no
  console errors/page errors. Only React DevTools info and Babel
  standalone warning were observed.
- `cd deck-go && make ui-metadata-sync` passed after registering Models
  UI metadata actions.
- `cd deck-go && pnpm exec playwright test test/e2e/models-real-gateway.spec.ts --config playwright.config.ts`
  passed as a compile/skip smoke with 2 skipped tests when
  `DECK_GO_REAL_GATEWAY_E2E` is unset.

- `cd deck-go/frontend-new && npm run test:deck-ui -- src/api.chat-helpers.test.ts src/components/panels/models/ModelsPanel.test.tsx`
  passed: 2 files, 66 tests.
- `cd deck-go/backend && GOCACHE=/tmp/deck-go-buildcache go test ./internal/server ./internal/api/http ./internal/runtime/openclaw -run 'TestGatewayFacade_ModelsConfigRoute|TestGatewayFacade_UsageCostProviderRoutes|TestMountAdminRoutes|TestGatewayQueriesLowRiskWrappersUseTypedClient|TestGatewayQueriesRepresentativeWrappersSmoke'`
  passed.
- `cd deck-go && pnpm exec playwright test test/e2e/models-visual.spec.ts --config playwright.config.ts`
  passed: L1 mock/local visual coverage for ready workbench,
  provider config, fallback, usage, and runtime inventory interaction
  states.
- First L2 run of `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/models-real-gateway.spec.ts --config playwright.config.ts`
  started the real stack and passed the UI BFF boundary test, but the
  route/RPC test failed because `models.configured` returned 502 from the
  real Gateway path. This was classified as degraded runtime RPC
  evidence rather than an implementation crash.
- After updating the L2 test to record 400/404/501/502/503 runtime RPC
  responses as degraded and to keep usage/config/UI checks strict,
  `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/models-real-gateway.spec.ts --config playwright.config.ts`
  passed: 2 tests. Probe was skipped-safe to avoid real provider calls.
- `cd deck-go && make ui-metadata-check` passed.
- `cd deck-go && make frontend-build` passed.
- `cd deck-go && make contract-gate` passed.
- `openspec change validate frontend-models-real-contract-verification --strict`
  passed.
- `git diff --check` passed.
- Follow-up mutation closure:
  `cd deck-go && make mutation-evidence-contract-test && make mutation-evidence-contract-check` -> passed;
  `cd deck-go/frontend-new && npm run test:deck-ui -- src/lib/mutation-evidence.test.ts src/api.chat-helpers.test.ts src/components/panels/models/ModelsPanel.test.tsx` -> 78 passed.

## Residual Risks

- Real Gateway startup may be blocked by local OpenClaw dependency
  staging or provider environment, as seen in other module L2 attempts.
- Real provider auth/probe semantics are environment-dependent; L2 should
  avoid real provider calls unless the test can prove safe scope.
- Real `PATCH /models/config` automation remains deferred unless a reversible
  config fixture and base-hash conflict cleanup are proven.
- Pricing snapshots and PATCH audit history remain product projections
  until Deck-facing DTOs or BFF routes formalize them.
- `/models/usage/*` aliases are kept for compatibility, while frontend
  wrappers currently consume canonical `/usage/*`.
