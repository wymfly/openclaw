# config — implementation notes

## Status

Implemented in `frontend-new` with real-contract verification. The production
panel keeps the existing BFF-only API boundary and uses the v2 handoff as the
visual/product target, but it does not promote prototype-only history,
scaffold, import/export, rollback, or schema-batch assumptions to real
capabilities.

## Deterministic fixes made

- Corrected handoff method drift from non-existent `gateway.config.*` names to
  Gateway `config.get`, `config.apply`, and `config.schema.lookup`.
- Corrected the frontend API path from a non-existent
  `frontend-new/src/api/config.ts` to the real `frontend-new/src/api.ts`.
- Typed `postConfigSchemaLookup()` as `DeckGoConfigLookupResponse` and made
  `lookupConfigPath()` use that low-level wrapper.
- Changed production apply gating to prefer `baseHash` over `hash` when both
  are present.
- Removed the hard-coded initial `agents.defaults` lookup. Production now loads
  root schema, prefers the `agents` section when available, and otherwise uses
  the first returned section/fallback key.
- Added support for `hint.secret: true` in the sensitive-field mask path, in
  addition to existing `hint.sensitive` and password hints.
- Real L2 showed `GET /api/config` can return `raw: null`. Production now keeps
  synthesized JSON read-only, disables raw apply and structured writes, and
  records noop apply as handoff-blocked when writable raw text is unavailable.
- Updated the mock Gateway so `config.schema.lookup` supports both `agents` and
  `agents.defaults`, matching the root-section navigation path.

## Contract-chain matrix

| Workflow                 | Chain                                                                                                                                                                                 | Classification                     | Notes                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| Snapshot load            | `fetchDeckConfig()` -> `GET /api/config` -> Go `/config` -> Gateway `config.get` -> `DeckGoConfigSnapshotResponse`                                                                    | Supported                          | Handles `raw`, `config`, `hash`, `baseHash`, `exists`, and `valid` as optional fields.           |
| Schema lookup            | `lookupConfigPath()` / `postConfigSchemaLookup()` -> `POST /api/config/schema-lookup` -> Go `/config/schema-lookup` -> Gateway `config.schema.lookup` -> `DeckGoConfigLookupResponse` | Supported                          | Root path `""` and section paths are verified.                                                   |
| Section navigation       | Root lookup children + snapshot top-level key fallback                                                                                                                                | Supported                          | Prefers `agents` when present to avoid mock/real first-key drift.                                |
| Structured editing       | Local path write -> raw draft -> `applyDeckConfig()` on confirm                                                                                                                       | Degraded                           | Active only when Gateway returns writable `raw`; blocked when `raw: null`.                       |
| Raw JSON editing         | Textarea draft -> object validation -> diff preview                                                                                                                                   | Supported / degraded               | Supported when `raw` is a string; read-only when only synthesized config JSON is available.      |
| Diff preview             | `computeConfigDiff(lastLoadedRawConfig, rawConfig)`                                                                                                                                   | Supported                          | Local preview before write; no Gateway call until confirm.                                       |
| Apply confirmation       | `applyDeckConfig(raw, baseHash)` -> `POST /api/config/apply` -> Gateway `config.apply`                                                                                                | Supported when writable raw exists | Base-hash gated. Real noop apply was not attempted because raw was unavailable.                  |
| Successful apply         | Apply result -> refresh snapshot -> reset local diff/action state                                                                                                                     | Supported in L1/mock               | L2 real write path is handoff-blocked until writable raw is exposed.                             |
| Conflict recovery        | BFF error message -> `fetchDeckConfig()` -> remote/local diff -> reload or retry latest hash                                                                                          | Supported by code/tests            | Current Go BFF wraps Gateway write errors as 502, so conflict detection uses error message text. |
| Reset                    | Restore last loaded raw snapshot                                                                                                                                                      | Supported local                    | No server-side undo or restore contract.                                                         |
| Sensitive reveal         | `hint.sensitive`, `hint.secret`, or `hint.inputType=password` -> masked input + reveal toggle                                                                                         | Supported                          | Reveal is local display only.                                                                    |
| Lookup payload           | `JsonDetails` over `DeckGoConfigLookupResponse`                                                                                                                                       | Supported                          | Useful for contract debugging and frontend design calibration.                                   |
| Raw payload              | Textarea over Gateway `raw`                                                                                                                                                           | Degraded                           | Read-only synthesized JSON when `raw` is unavailable.                                            |
| Apply history            | Prototype `recentApplies` only                                                                                                                                                        | Unsupported                        | No Deck-facing audit/history endpoint exists.                                                    |
| Scaffold/create defaults | Prototype CTA idea only                                                                                                                                                               | Unsupported                        | No `POST /api/config/scaffold` contract exists.                                                  |
| Import/export            | Prototype/product idea only                                                                                                                                                           | Unsupported                        | No Deck-facing import/export contract exists.                                                    |
| Rollback/version restore | Prototype/product idea only                                                                                                                                                           | Unsupported                        | No durable config-version contract exists.                                                       |
| Schema batching          | Prototype precomputed tree only                                                                                                                                                       | Unsupported follow-up              | Production uses one lookup per path; no batch endpoint exists.                                   |

## Verification evidence

- Prototype smoke: `prototype.html` loaded from a local static server with HTTP
  200, title `Configuration`, six sections, six fields, and no browser errors.
- Frontend focused: `cd deck-go/frontend-new && npm run test:deck-ui -- src/api.chat-helpers.test.ts src/components/panels/config/ConfigPanel.test.tsx` passed, 56 tests.
- Backend focused: `cd deck-go/backend && go test ./internal/server ./internal/runtime/openclaw -run 'TestGatewayFacade_ConfigSchemaLookup|TestGatewayFacade_ConfigSchemaLookupAllowsRootPath|TestGatewayFacade_ChannelPatchUsesConfigGetThenConfigPatch|TestGatewayFacade_ModelsConfigRoute|TestManagedRuntime|TestGatewayQueries'` passed.
- L1 mock visual: `cd deck-go && pnpm exec playwright test test/e2e/config-visual.spec.ts --config playwright.config.ts` passed, 1 test.
- L2 real Gateway: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/config-real-gateway.spec.ts --config playwright.config.ts` passed, 2 tests.
- L2 direct evidence: real `GET /api/config` returned HTTP 200 with a
  64-character base hash, but no writable raw text; noop apply was therefore
  handoff-blocked by the raw-unavailable guard.

## Prototype parity remediation

Governing child change:
`openspec/changes/deck-go-frontend-config-prototype-parity-remediation`.

### Deterministic fixes made

- Reworked `frontend-new/src/components/panels/config/ConfigPanel.tsx` from the
  prior two-card layout into the v2 prototype workbench: topbar, section rail,
  structured form pane, and Diff / Raw / History preview pane.
- Preserved the BFF-only contract chain and existing write safety gates while
  moving raw editing into the preview pane.
- Fixed section filtering so localized section labels such as Chinese `模型` /
  `运行` participate in search, not only raw config keys.
- Expanded the mock Gateway config fixture to six prototype-shaped top-level
  sections: `agents`, `models`, `channels`, `plugins`, `hooks`, and `runtime`.
- Kept History as an accepted contract exception: production can show local
  apply result and payload inspection, but durable apply history still has no
  Deck-facing endpoint.

### Evidence

- Focused frontend: `cd deck-go/frontend-new && npm run test:deck-ui -- src/api.chat-helpers.test.ts src/components/panels/config/ConfigPanel.test.tsx` passed, 66 tests.
- Mock visual: `cd deck-go && pnpm exec playwright test test/e2e/config-visual.spec.ts --config playwright.config.ts --output .local/config-remediation-mock-visual --reporter=line` passed.
- Prototype parity report: `cd deck-go && node scripts/generate-prototype-parity-report.mjs --prototype-dir .local/prototype-gap-audit --mock-dir .local/config-remediation-mock-visual --out-dir .local/config-prototype-remediation-parity-report --sheet-size 1`.
- Real E2E: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/config-real-gateway.spec.ts --config playwright.config.ts --output .local/config-remediation-real-e2e --reporter=line` passed, 2 tests.
- Build: `cd deck-go && make frontend-build` passed with the existing Vite
  large-chunk warning.

### Real E2E result

- API route-shape evidence passed for runtime readiness, `GET /api/config`,
  root `POST /api/config/schema-lookup`, and a section lookup.
- Fixture creation attempted one safe `POST /api/config/apply` path in isolated
  real E2E state, but the real snapshot did not expose writable raw text;
  mutation was recorded as `skipped-safe` / degraded instead of forcing a write.
- UI evidence covered Chat -> Config shell navigation, dark/en, dark/zh,
  light/en, light/zh, section search, Raw preview pane, History contract
  fallback, no unexpected browser/BFF errors, and no direct browser Gateway
  requests or websockets.

### Accepted exceptions

- Deck shell chrome remains outside the standalone prototype.
- Field labels and section inventory in real mode come from live
  `config.schema.lookup` and can differ from the static prototype fixture.
- Durable apply history, scaffold/create defaults, import/export, rollback, and
  schema batching remain follow-up contracts.

## Residual risks / follow-up

- Real safe/noop apply is not yet verified because the current real Gateway
  response exposed `raw: null`. This is intentionally blocked in production
  UI until a writable raw payload or safer write DTO is available.
- Field-level validation errors are not first-class in the Deck DTO. The Go
  BFF currently wraps Gateway apply validation/conflict failures as HTTP 502
  with an error string.
- Apply history, scaffold defaults, import/export, rollback/version restore,
  and schema lookup batching need explicit Deck-facing contracts before they
  can become production commitments.
- A form library decision remains deferred. Current implementation uses
  focused local state and path-writing helpers without adding a dependency.
