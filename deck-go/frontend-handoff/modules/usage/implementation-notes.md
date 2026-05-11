# usage implementation notes

**Change:** `frontend-usage-real-contract-verification`
**Status:** implemented - real-contract verified

## Contract Matrix

| Workflow                     | Frontend wrapper/state                               | BFF route                                | Gateway/runtime source                          | Status                                    |
| ---------------------------- | ---------------------------------------------------- | ---------------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| Bootstrap pill               | `useDeckUI().bootstrap`                              | `GET /api/bootstrap/status`              | Deck runtime bootstrap status                   | supported                                 |
| Usage cost                   | `fetchModelUsageCost()`                              | `GET /api/usage/cost`                    | `usage.cost`                                    | supported                                 |
| Usage cost legacy alias      | same DTO                                             | `GET /api/models/usage/cost`             | `usage.cost`                                    | supported, compatibility                  |
| Provider quotas              | `fetchModelUsageProviders()`                         | `GET /api/usage/providers`               | `usage.status`                                  | supported                                 |
| Provider quotas legacy alias | same DTO                                             | `GET /api/models/usage/providers`        | `usage.status`                                  | supported, compatibility                  |
| Sessions list                | `fetchUsageSessions()`                               | `GET /api/usage/sessions`                | `sessions.usage`                                | supported                                 |
| Session logs                 | `fetchUsageSessionLogs()`                            | `GET /api/usage/sessions/logs`           | `sessions.usage.logs`                           | supported, empty-valid                    |
| Session timeseries           | `fetchUsageTimeseries()`                             | `GET /api/usage/timeseries`              | `sessions.usage.timeseries`                     | supported, empty-valid                    |
| Context weight               | `fetchUsageSessions({ includeContextWeight: true })` | `GET /api/usage/sessions`                | `sessions.usage` projection                     | supported, empty-valid                    |
| Range refresh                | local state + cost/sessions refetch                  | `/api/usage/cost`, `/api/usage/sessions` | Gateway usage/session methods                   | supported                                 |
| Search/filter/sort           | local UI state                                       | none                                     | `DeckGoUsageSessionEntry` fields                | supported                                 |
| Session detail tabs          | local UI state + lazy fetch cache                    | logs/timeseries/sessions routes          | Gateway session usage methods                   | supported                                 |
| Cross-panel navigation       | `navigateToAgent`, `navigateToSession`               | none                                     | Deck UI state                                   | supported                                 |
| Read-only behavior           | no mutations                                         | no mutation route                        | none                                            | supported                                 |
| Recharts-grade charts        | not used                                             | none                                     | n/a                                             | handoff-blocked until dependency approval |
| Real billing accuracy        | not claimed                                          | n/a                                      | provider estimates only                         | unsupported claim                         |
| Quota policy semantics       | not claimed                                          | n/a                                      | `usage.status` exposes percent/reset/error only | degraded                                  |
| Tenant accounting            | not present                                          | n/a                                      | no contract                                     | unsupported claim                         |
| Cost forecast                | not present                                          | n/a                                      | no contract                                     | handoff-blocked                           |

## Fixes Made

- Added canonical active BFF routes `GET /api/usage/cost` and
  `GET /api/usage/providers` while preserving legacy
  `GET /api/models/usage/cost` and `GET /api/models/usage/providers`.
- Added the matching `/api/v1/usage/providers` admin route and
  `ManagedRuntime.GetUsageProviders`.
- Switched frontend Usage wrappers to canonical `/api/usage/*` paths.
- Updated endpoint classification and UI metadata contract sources, then
  regenerated generated UI metadata and docs.
- Refined the production Usage panel with bootstrap state, agent/channel
  filters, recent/cost/tokens sorting, session detail tabs, and CSS-only quota
  bars.
- Updated Usage unit tests, API wrapper tests, mock visual E2E, and added
  `usage-real-gateway.spec.ts` for L2 real-stack verification.
- Corrected the handoff docs: `recharts` is a dependency-gated recommendation,
  not an installed or silently approved production dependency.

## Verification Evidence

- Handoff prototype smoke: `prototype.html` loaded from a local static server
  with HTTP 200, title `deck-go · usage (v2)`, H1 `Cost & quota cockpit`, 4
  provider cards, 8 session rows, 9 tabs, and no browser errors.
- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/usage/UsagePanel.test.tsx src/api.chat-helpers.test.ts` passed 51 tests.
- `cd deck-go/backend && go test ./internal/server ./internal/api/http ./internal/runtime/openclaw -run 'TestGatewayFacade_UsageCostProviderRoutes|TestGatewayFacade_UsageSessionRoutes|TestMountAdminRoutes|TestGatewayQueries'` passed.
- `cd deck-go && pnpm exec playwright test test/e2e/usage-visual.spec.ts --config playwright.config.ts` passed 1 L1 mock visual test.
- `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/usage-real-gateway.spec.ts --config playwright.config.ts` passed 2 L2 real-stack tests.
- `cd deck-go && make endpoint-classification-check ui-metadata-check` passed.
- `openspec validate frontend-usage-real-contract-verification --strict` passed.
- `cd deck-go && make frontend-build` passed.
- `git diff --check` passed.

## Residual Risks

- `recharts` remains dependency-blocked until explicitly approved; current charts
  do not provide full crosshair, tooltip, brush, or axis behavior.
- Real billing accuracy is not guaranteed. Cost comes from Gateway estimates and
  provider pricing tables may drift from invoices.
- Provider quota policies are not structured beyond `usedPercent`, optional
  `resetAt`, and optional `error`; reset cadence and overage policy remain
  product follow-up.
- Real usage detail may be empty in fresh Gateway environments. L2 treats empty
  sessions/logs/timeseries/context reports as empty-valid when route shapes
  pass.
- Context weight reports can be `run` or `estimate`; the UI surfaces the source,
  but trust semantics need final product review.

## Codex contract completion closeout - 2026-05-05

- Fixed generated Gateway protocol drift for `sessions.usage.logs` and
  `sessions.usage.timeseries`: method metadata now uses the narrow
  usage-result schemas used by the runtime handlers, so generated TS/Go
  artifacts expose typed log entries and typed timeseries points.
- Preserved forwarded timeseries query parameters
  `startDate/endDate/mode/utcOffset` in the Gateway params contract because the
  Go BFF already forwards them.
- Added protocol codegen regression assertions so usage logs/timeseries do not
  collapse back to `unknown[]` / `unknown`.
- Kept dynamic Usage leaves explicit in dynamic-surface metadata:
  `DeckGoUsageTotals` extra counters, `DeckGoUsageSessionsResponse.aggregates`
  future dimensions, and `DeckGoContextWeightReport` extension fields.
- Focused checks passed:
  `pnpm exec tsx deck-go/contracts/scripts/protocol-codegen.test.ts`,
  `make protocol-check`, frontend Usage/Logs/Activity/API tests, and focused Go
  generated/runtime/server tests.

## Prototype parity remediation closeout - 2026-05-05

**Change:** `deck-go-frontend-usage-prototype-parity-remediation`
**Status:** mock parity `pass-with-exceptions`; strengthened real E2E passed

### Deterministic Fixes

- Expanded the mock Gateway Usage fixture from a sparse sample to a
  prototype-shaped read-only cockpit data set: 14 cost days, 4 provider quota
  providers, 8 session rows, richer model/provider/channel aggregates, 5 log
  entries, and 5 timeseries points.
- Preserved the existing Deck-facing BFF wrappers and production read-only
  cockpit implementation for cost, providers, sessions, logs, timeseries,
  range refresh, provider selection, session filters, sort, and detail tabs.
- Added prototype keyboard behavior in production: `Cmd/Ctrl+K` focuses the
  session search input and `Esc` closes the expanded session detail.
- Strengthened mock visual E2E to enter from Chat -> Usage, cover dark/en,
  dark/zh, light/en, light/zh, verify dense mock rows, provider selection,
  trend-by-model, search, logs, timeseries, context detail, `Esc`, no overflow,
  and unexpected-error checks.
- Strengthened real Gateway E2E to run a bounded cpa+main seed, verify runtime,
  bootstrap, canonical Usage routes, legacy read-only aliases, session detail
  routes when a real session exists, all four UI variants, BFF-only browser
  transport, and unexpected-error checks.

### Evidence

- Unit/API: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/usage/UsagePanel.test.tsx src/api.chat-helpers.test.ts src/lib/mutation-evidence.test.ts` passed 76 tests.
- Typecheck: `cd deck-go/frontend-new && npx tsc -b --pretty false` passed.
- Mock visual: `cd deck-go && pnpm exec playwright test test/e2e/usage-visual.spec.ts --config playwright.config.ts --output .local/usage-remediation-mock-visual` passed.
- Prototype parity report: `deck-go/.local/usage-prototype-remediation-parity-report/` marked `usage` ready-for-review; structured verdict remains human/visual-review gated.
- Real Gateway: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/usage-real-gateway.spec.ts --config playwright.config.ts --output .local/usage-remediation-real-e2e` passed.
- Real evidence file: `deck-go/.local/usage-remediation-real-e2e/usage-real-gateway-usage-r-74830-ants-and-BFF-only-transport/attachments/usage-real-product-surface-9037200ac94dd38c54375d65e51f5c66de540605.json`.
- Seed evidence file: `deck-go/.local/usage-remediation-real-e2e/usage-real-gateway-usage-r-74830-ants-and-BFF-only-transport/attachments/real-gateway-cpa-main-seed-a8de3a421fa4bc042b4f709309208c2c21b962ec.json`.
- Build: `cd deck-go && make frontend-build` passed with the existing Vite
  chunk-size warning.

### Accepted Exceptions

- Recharts-grade chart fidelity remains dependency-gated. Production continues
  to use existing React/CSS chart primitives.
- Real cost and provider quota data can be empty in an isolated Gateway stack.
  The real run seeded a cpa/main chat session and verified one real usage
  session row; cost and provider routes returned valid empty shapes.
- Billing-grade cost accuracy, tenant accounting, forecasts, budget
  recommendations, exports, and quota mutation remain unsupported until
  Gateway/Deck contracts exist.

## Visual parity fact baseline - 2026-05-11

| Classification     | Finding                                                                                               | Evidence                                                                                                                                                                                           | Decision                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| accepted           | Active usage visual target is the v2 multi-file prototype, not the archived v1 single-file prototype. | `deck-go/frontend-handoff/modules/usage/README.md` points `Visual target` to `./prototype.html`; `prototype-v1-codex.html` is labelled archive.                                                    | Use `frontend-handoff/modules/usage/prototype.html` for parity screenshots. |
| accepted           | Existing usage visual E2E is functional smoke, not prototype parity.                                  | `deck-go/test/e2e/usage-visual.spec.ts` opens the app, verifies text/interactions, and saves screenshots, but never opens `prototype.html`.                                                        | Add `usage-visual-parity.spec.ts`.                                          |
| accepted           | Production usage CSS uses non-canonical or stale visual token names.                                  | `usage-panel.css` contains `--ds-text`, `--ds-text-secondary`, `--ds-text-tertiary`, `--ds-surface`, `--ds-surface-muted`, `--ds-input-bg`, `--ds-accent-soft`, `--ds-danger`, and `--ds-warning`. | Replace with canonical `--ds-*` or usage-scoped aliases.                    |
| corrected          | The evidence does not prove global design-system tokens are wrong.                                    | Canonical tokens remain defined in `frontend-new/src/design-system/tokens/index.css`; usage production CSS is not consistently consuming them.                                                     | First fix usage locally; decide promotion after usage+sessions evidence.    |
| rejected           | Add `recharts` while fixing usage visual parity.                                                      | Usage README marks charts as dependency-gated and repo policy forbids new dependencies without explicit approval.                                                                                  | Keep current CSS/SVG chart primitives.                                      |
| rejected           | Directly modify all modules or global tokens in this pass.                                            | Only sessions has completed parity evidence; usage is the second sample.                                                                                                                           | Global changes require a later OpenSpec/design-system proposal.             |
| deferred-uncertain | Pixel-level chart fidelity and compact-density parity.                                                | Prototype defaults to `data-density="compact"`; current app may not expose per-module density.                                                                                                     | Record in verdict; do not force global density in this pass.                |

## Visual parity evidence - 2026-05-11

| Evidence                                                                                                     | Result                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cd deck-go && pnpm exec playwright test --config playwright.config.ts test/e2e/usage-visual-parity.spec.ts` | Passed. `verdict.json` status `pass`, `domScore` 100.                                                                                                                                                                                       |
| Screenshot artifacts                                                                                         | `test-results/usage-visual-parity-usage--bc88e--panel-token-and-DOM-intent/prototype.png`, `mock-current.png`, `usage-session-drilldown.png`, `sheet.png`.                                                                                  |
| CSS source guard                                                                                             | `usage-panel.css` no longer contains `var(--ds-text,`, `--ds-text-secondary`, `--ds-text-tertiary`, `--ds-surface`, `--ds-surface-muted`, `--ds-input-bg`, `--ds-accent-soft`, `--ds-danger`, or `--ds-warning` on the primary visual path. |
| Typography guard                                                                                             | `.usage-panel` computes to `Inter` `13px/19.5px`; key type scale computes to title `19px`, card title `14px`, and metric value `16px`.                                                                                                      |
| Component structure guard                                                                                    | `UsagePanel.test.tsx` locks the usage panel header, KPI strip, workbench, trend, provider rail, sessions list, and evidence grid.                                                                                                           |

## Accepted exceptions - 2026-05-11

| Area                | Exception                                                                                  | Reason                                                                                                                                        | Follow-up                                                                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Human visual review | `visualReview.status` remains `pending-human`.                                             | The parity E2E validates DOM, canonical tokens, screenshots, and overflow, but does not claim pixel parity.                                   | Human review should inspect `sheet.png` before treating the prototype match as visually accepted.                                                            |
| Prototype runtime   | `prototype.png` is best-effort when external UMD scripts are unavailable.                  | The active usage handoff loads React/Babel from external CDN URLs; production DOM/token/typography assertions remain local and deterministic. | Keep production typography guarded in `usage-visual-parity.spec.ts`; consider a later handoff bundling pass if prototype screenshots must be offline-stable. |
| Density             | Production shell still uses app-level density rather than a usage-specific compact preset. | Forcing compact density globally would cross the usage module boundary.                                                                       | Treat density as a design-system candidate only after the next sampled module confirms the same need.                                                        |

## Design System Promotion Decision - 2026-05-11

**Decision: B - first extract shared candidates later; do not change canonical tokens or atoms in the usage visual parity pass.**

Usage and sessions now provide enough evidence to justify a follow-up design-system proposal for shared panel primitives, but not enough evidence to directly change global tokens and assume other modules will become correct automatically.

| Area                                    | Classification         | Evidence                                                                                                                                                                              | Decision                                                                                                                       |
| --------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Stale token alias cleanup               | `module-only`          | Usage drift came from production CSS consuming non-canonical names such as `--ds-text` and `--ds-surface`; canonical `--ds-text-1/2/3`, `--ds-bg-*`, and status tokens already exist. | Keep the cleanup local to usage for this pass. Audit other modules for the same alias pattern before global migration tooling. |
| Panel surface chrome                    | `shared-candidate`     | Usage and sessions both need dense bordered surfaces, muted backgrounds, small radius, no decorative card nesting, and token-driven dark/light readability.                           | Candidate for `PanelSurface` / panel chrome pattern in a separate design-system proposal.                                      |
| KPI/stat strip                          | `shared-candidate`     | Usage has six top metrics; sessions has a top metric/stat grid. Both use the same information hierarchy: uppercase label, strong value, subdued hint.                                 | Candidate for `KpiStrip` / `PanelMetric` pattern with sessions and usage as reference consumers.                               |
| Section heading/meta hierarchy          | `shared-candidate`     | Both modules use eyebrow/meta/status rows with similar font, color, and spacing needs.                                                                                                | Candidate for a shared `PanelSectionHeader` or status/meta row pattern.                                                        |
| Provider quota rail and usage drilldown | `module-only`          | These are usage-specific data shapes and interactions.                                                                                                                                | Keep in usage.                                                                                                                 |
| Global canonical token value change     | `reject` for this pass | The failing evidence was stale consumption in usage, not incorrect canonical token definitions. Only two modules have parity evidence.                                                | Require a new design-system OpenSpec and a third-module sample before changing token values globally.                          |

### Answer to the promotion question

当前不能直接把这次修复提炼成一次全局 token 替换来“自动修好其他模块”。可以提炼的是 shared panel primitives：surface chrome、KPI/stat strip、section/meta hierarchy、density conventions。下一步应先写独立 design-system proposal，把 usage 和 sessions 作为 reference consumers，再选第三个有视觉差异的模块验证；在那之前，其他模块若存在同样的旧 token alias，仍需要局部清理或受控迁移。

## Cockpit pattern extraction - 2026-05-11

OpenSpec change: `deck-go-panel-cockpit-design-system`.

Promoted shared structures:

- Usage now consumes `PanelRoot`, `PanelSectionHeader`, `PanelStatusRow`, and
  `PanelPill` for its root cockpit header/status area.
- Usage summary KPIs now consume `KpiStrip` and `PanelMetric` instead of local
  `.usage-panel__metrics` / `.usage-panel__metric` markup.
- The promoted CSS lives in
  `frontend-new/src/design-system/patterns/panel-cockpit.css` and uses existing
  canonical `--ds-*` tokens only.

Still module-local:

- Range controls, trend charts, session usage rows/detail tabs, provider quota
  progress rows, breakdown tables, and latency/tool-signal cards remain
  Usage-owned molecules because their anatomy and data behavior are not yet
  cross-module.

Promotion answer after implementation:

- Yes, Sessions + Usage are enough to extract a cockpit pattern set.
- No, they are not enough to rewrite canonical token values globally or assume
  all other modules will be fixed automatically.
- Next readiness gate is a third module sample using the new pattern before
  adding migration lint, codemods, or broader design-system governance.
