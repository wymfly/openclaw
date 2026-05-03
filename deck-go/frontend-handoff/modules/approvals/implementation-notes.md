# Approvals Implementation Notes

## Production Migration

- Implemented the production rewrite under `deck-go/frontend-new/src/components/panels/approvals/` with a module-local `approvals-panel.css` workbench and no new canonical atom or token.
- Replaced the obsolete global `deck-ui-approvals*` styling from `deck-go/frontend-new/src/theme.css`.
- Preserved the existing panel registry, frontend API facade boundary, shared deck navigation helpers, and approval SSE handling.
- Kept pending exec approvals, plugin approvals, policy defaults, per-agent overrides, allowlist paths, policy JSON editing, decision actions, stream updates, and raw action/policy evidence.

## Contract Drift Fixed

- The mock Gateway previously covered `exec.approvals.get` and `exec.approval.list`, but Approvals visual coverage also needs deterministic `exec.approval.resolve`, `exec.approvals.set`, `plugin.approval.list`, and `plugin.approval.resolve` methods.
- `deck-go/test/fixtures/mock-gateway.mjs` now serves contract-shaped fixture responses for those methods so the real frontend can exercise decision and policy-save states through the normal Deck BFF route.
- `exec.approval.list` and `plugin.approval.list` remain upstream-schema-missing exceptions in the Gateway contract chain; this pass documents the gap but does not change upstream protocol authority.

## Verification Evidence

- `node --check deck-go/test/fixtures/mock-gateway.mjs`
- `npm run test:deck-ui -- src/components/panels/approvals`
- `pnpm exec playwright test --config deck-go/playwright.config.ts deck-go/test/e2e/approvals-visual.spec.ts`
- `make frontend-build`

The generated screenshots cover the ready approval workbench, plugin approval surface, exec decision result, and policy save state. This is mock/local visual coverage only; it does not prove real Gateway/LLM or full approval security assurance.

## Design-System Feedback

- Reused the settled typography, color, spacing, radius, button, form, badge/pill, card, code/json, and status token posture.
- Kept approval metric tiles, exec approval rows, plugin approval rows, decision action groups, policy default controls, agent override rows, allowlist rows, stream evidence, and raw action/policy disclosure as module-local molecules.
- Promotion candidates remain `MetricTile`, `WorkbenchHeader`, `SelectableQueueRow`, `DetailHero`, `ActionResultSeam`, and possible security-specific `DecisionActionGroup` and `PolicyDefaultControls`, but any promotion should happen in a separate design-system proposal.
