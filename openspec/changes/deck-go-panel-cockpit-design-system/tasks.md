## 1. Baseline And API Shape

- [x] 1.1 Re-read Sessions and Usage parity notes, current CSS, and current pattern exports; record the exact repeated structures to extract.
- [x] 1.2 Define typed APIs for `PanelRoot`, `PanelSurface`, `KpiStrip`, `PanelMetric`, `PanelSectionHeader`, `PanelStatusRow`, and `PanelPill` without `className` or `style` escape hatches.
- [x] 1.3 Confirm no new dependency, backend contract, generated contract, or global token value change is needed.

## 2. Pattern Implementation

- [x] 2.1 Add cockpit pattern TSX files under `deck-go/frontend-new/src/design-system/patterns/` using flat-file structure.
- [x] 2.2 Add token-only CSS for the cockpit patterns with no stale token aliases and no global token overrides.
- [x] 2.3 Export every new cockpit pattern and public type from the design-system pattern barrel.
- [x] 2.4 Add design-system Gallery examples for the cockpit patterns and their supported variants.

## 3. Pattern Tests

- [x] 3.1 Add renderer tests for required slots, typed variants, and DOM shape of each cockpit pattern.
- [x] 3.2 Add `vitest-axe` coverage for representative cockpit pattern examples.
- [x] 3.3 Add or extend a CSS source guard that rejects stale aliases such as `--ds-text`, `--ds-surface`, `--ds-danger`, and `--ds-warning` in cockpit pattern CSS.

## 4. Reference Consumer Migration

- [x] 4.1 Migrate repeated Sessions root/surface/metric/header/status structures to the cockpit patterns without changing Sessions data loading or user workflows.
- [x] 4.2 Migrate repeated Usage root/surface/metric/header/status structures to the cockpit patterns without changing Usage data loading or user workflows.
- [x] 4.3 Keep Sessions transcript/export/compaction/lineage molecules local and document why they are not promoted.
- [x] 4.4 Keep Usage provider quota rail/chart/session drilldown molecules local and document why they are not promoted.

## 5. Readiness Evidence

- [x] 5.1 Update `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` with Sessions and Usage as reference consumers for the cockpit pattern set.
- [x] 5.2 Record whether canonical token values changed; expected result is no token value change.
- [x] 5.3 Record a third-module validation candidate and classify broad rollout as deferred until that sample passes.
- [x] 5.4 Update Sessions and Usage handoff notes with the final pattern migration evidence and remaining visual exceptions.

## 6. Verification

- [x] 6.1 Run cockpit pattern unit and axe tests.
- [x] 6.2 Run `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx src/components/panels/usage/UsagePanel.test.tsx`.
- [x] 6.3 Run `cd deck-go && pnpm exec playwright test --config playwright.config.ts test/e2e/sessions-visual-parity.spec.ts test/e2e/usage-visual-parity.spec.ts`.
- [x] 6.4 Run `cd deck-go && pnpm exec playwright test --config playwright.config.ts test/e2e/sessions-visual.spec.ts test/e2e/usage-visual.spec.ts`.
- [x] 6.5 Run `cd deck-go && make frontend-build`.
- [x] 6.6 Run `openspec validate deck-go-panel-cockpit-design-system --type change --strict`.
