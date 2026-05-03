# Webhooks Implementation Notes

## Production Migration

- Implemented the production rewrite under `deck-go/frontend-new/src/components/panels/webhooks/` with a module-local `webhooks-panel.css` workbench and no new canonical atom or token.
- Replaced the obsolete global `deck-ui-webhooks*` styling from `deck-go/frontend-new/src/theme.css`.
- Preserved the existing panel registry and frontend API facade boundary; browser code still calls the Go BFF wrappers only.
- Kept webhook inventory, selected receiver evidence, create/update/test/delete, guarded delete, delivery history, event subscription editing, and raw action evidence.

## Contract Drift Findings

- Webhooks is not a browser-to-Gateway RPC surface. It is served by the Go admin/BFF routes over localstore-backed webhook and delivery records.
- Deterministic mock/local visual coverage did not require production seed endpoints or mock Gateway schema changes; the E2E seeds through public `POST /api/webhooks` routes and uses a temporary local HTTP receiver for test-delivery evidence.
- Real external receiver availability, retry behavior, and signature validation remain outside mock/local visual coverage and should be handled by a later real-stack delivery assurance pass.

## Verification Evidence

- `npm run test:deck-ui -- src/components/panels/webhooks`
- `pnpm exec playwright test --config deck-go/playwright.config.ts deck-go/test/e2e/webhooks-visual.spec.ts`

The generated screenshots cover the ready receiver workbench, selected receiver switch, event selection/edit state, and manual test-delivery result. This is mock/local visual coverage only; it does not prove real Gateway/LLM or full external receiver delivery completeness.

## Design-System Feedback

- Reused the settled typography, color, spacing, radius, button, form, badge/pill, card, code/json, and status token posture.
- Kept webhook metric tiles, receiver catalog rows, selected-receiver hero, event subscription controls, receiver form section, delivery rows, local receiver test-result seam, and raw action evidence as module-local molecules.
- Promotion candidates remain `MetricTile`, `WorkbenchHeader`, `SelectableQueueRow`, `DetailHero`, `ActionResultSeam`, and a possible Automate-specific `DeliveryEvidenceRow`, but any promotion should happen in a separate design-system proposal.
