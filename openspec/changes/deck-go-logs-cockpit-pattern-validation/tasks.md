## 1. Baseline

- [x] 1.1 Re-read Logs implementation, Logs handoff notes, cockpit pattern API, and visual E2E selectors; record repeated structures and local-only molecules.
- [x] 1.2 Confirm no backend, BFF, generated contract, dependency, or canonical token change is needed.

## 2. TDD Guards

- [x] 2.1 Update `LogsPanel.test.tsx` to require `PanelRoot`, `PanelSectionHeader`, `KpiStrip`, `PanelMetric`, and `PanelStatusRow` on promoted structures.
- [x] 2.2 Run the focused Logs test and confirm it fails before migration.

## 3. Logs Migration

- [x] 3.1 Import cockpit patterns in `LogsPanel.tsx` through the design-system patterns barrel.
- [x] 3.2 Replace Logs header/status structure with `PanelRoot`, `PanelSectionHeader`, and `PanelStatusRow` while preserving existing buttons, badges, spinner, toggle, and i18n text.
- [x] 3.3 Replace the Logs KPI strip local `MetricTile` markup with `KpiStrip` and `PanelMetric`.
- [x] 3.4 Keep filter bar, log rows, details pane, live tape, raw payload cards, parsing, stream state, and export preview local.
- [x] 3.5 Add scoped CSS compatibility only where needed for Logs spacing; do not reintroduce stale token aliases.

## 4. Readiness Documentation

- [x] 4.1 Update Logs implementation notes with cockpit migration evidence and the local-only molecule list.
- [x] 4.2 Update cross-module readiness to mark Logs as the third cockpit pattern validation sample and record that global token values did not change.

## 5. Verification

- [x] 5.1 Run `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/logs/LogsPanel.test.tsx src/design-system/patterns/__tests__/PanelCockpit.test.tsx`.
- [x] 5.2 Run `cd deck-go && pnpm exec playwright test --config playwright.config.ts test/e2e/logs-visual.spec.ts`.
- [x] 5.3 Run `cd deck-go && make frontend-build`.
- [x] 5.4 Run `openspec validate deck-go-logs-cockpit-pattern-validation --type change --strict`.
- [x] 5.5 Run `git diff --check` for the touched Logs, readiness, and OpenSpec files.
