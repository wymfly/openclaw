# Cron Implementation Notes

## Production Migration

- Implemented the production rewrite under `deck-go/frontend-new/src/components/panels/cron/` with a module-local `cron-panel.css` workbench and no new canonical atom or token.
- Replaced the obsolete global `deck-ui-cron*` styling from `deck-go/frontend-new/src/theme.css`.
- Preserved the existing panel registry and frontend API facade boundary; browser code still calls the Go BFF wrappers only.
- Kept scheduler inventory, selected job evidence, create/update/run/delete, template shortcuts, guarded delete, run-history tab, heartbeat tab, and raw action evidence.

## Contract Drift Fixed

- The generated Gateway `cron.list` payload exposes upcoming execution at `job.state.nextRunAtMs`, while the current Deck-facing DTO exposes `job.nextRunAtMs`.
- The generated Gateway `cron.status` payload exposes `enabled`, `jobs`, and `nextWakeAtMs`, while the current Deck-facing DTO exposes `running`, `jobCount`, and `nextRunAtMs`.
- `deck-go/frontend-new/src/api.ts` now normalizes those known generated fields into the existing Deck DTO shape without widening browser-side Gateway access.
- `deck-go/test/fixtures/mock-gateway.mjs` now serves contract-shaped `cron.list`, `cron.status`, `cron.runs`, `cron.add`, `cron.update`, `cron.run`, and `cron.remove` fixture methods for mock visual coverage.

## Verification Evidence

- `node --check deck-go/test/fixtures/mock-gateway.mjs`
- `npm run test:deck-ui -- src/api.chat-helpers.test.ts`
- `npm run test:deck-ui -- src/components/panels/cron`
- `pnpm exec playwright test --config deck-go/playwright.config.ts deck-go/test/e2e/cron-visual.spec.ts`

The generated screenshots cover the ready workbench, run-history tab, heartbeat tab, template selection, and manual run result. This is mock visual coverage only; it does not prove real Gateway/LLM scheduler completeness.

## Design-System Feedback

- Reused the settled typography, color, spacing, radius, button, form, badge/pill, card, code/json, and status token posture.
- Kept scheduler metric tiles, job catalog rows, selected-job hero, form section, run-history rows, heartbeat detail, and action-result seam as module-local molecules.
- Promotion candidates remain `MetricTile`, `WorkbenchHeader`, `SelectableQueueRow`, `DetailHero`, `ActionResultSeam`, and a possible scheduler-specific `RunHistoryRow`, but any promotion should happen in a separate design-system proposal.
