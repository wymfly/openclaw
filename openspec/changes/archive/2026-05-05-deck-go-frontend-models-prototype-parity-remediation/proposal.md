## Why

The Models module has useful contract wiring, config mutation controls, unit
coverage, and bounded real-stack smoke tests, but its production UI still reads
as a configuration workbench rather than the active high-fidelity handoff target.
The handoff target at `deck-go/frontend-handoff/modules/models/prototype.html`
defines a model registry product flow: provider-grouped list, model detail page,
six detail tabs, catalog/auth/probe dialogs, and clear runtime/provider/usage
evidence on the first viewport.

This child change remediates Models under the governing
`deck-go-frontend-prototype-parity-remediation` head proposal. It must preserve
current Gateway/deck-go contract truth while strengthening mock parity and real
Gateway E2E evidence.

## What Changes

- Reconcile the active Models prototype with contract truth from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `frontend-handoff/modules/models/api-usage.md`;
  - existing frontend API wrappers.
- Rewrite the production Models panel toward the handoff product flow:
  - provider-grouped model list with KPI strip, search/filter, and catalog CTA;
  - model detail view with Overview, Limits, Pricing, Usage, Auth, and Audit tabs;
  - catalog, auth config, and probe result dialogs;
  - raw `openclaw.json` config editing kept as an advanced save authority, not
    the primary product surface.
- Keep frontend calls behind the deck-go BFF/runtime Gateway transport.
- Update mock fixtures and visual tests so L1 mock evidence exercises the
  prototype-shaped list/detail/dialog states.
- Strengthen real Gateway E2E by creating run-scoped Models fixture data in the
  isolated real E2E config through `/models/config` when safe, then validating
  shell navigation, dark/light, English/Chinese, list/detail/tab/dialog
  interaction, cleanup, and BFF-only browser transport.
- Record any unsupported handoff projections explicitly, especially pricing
  snapshots, PATCH audit history, and force probe cache refresh.

## Capabilities

### New Capabilities

- `frontend-models-prototype-parity-remediation`: Defines the Models-specific
  prototype parity remediation, real fixture standard, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Models row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/models/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`.
- E2E and mocks:
  - `deck-go/test/e2e/models-visual.spec.ts`;
  - `deck-go/test/e2e/models-real-gateway.spec.ts`;
  - `deck-go/test/fixtures/mock-gateway.mjs`;
  - shared real E2E helpers only if a deterministic fixture helper is needed.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/models/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `5.2`.
