## Why

The Plugins module already has useful contract wiring and previous read-only
real-contract verification, but the current production UI still diverges from
the active handoff prototype at
`deck-go/frontend-handoff/modules/plugins/prototype.html`. The prototype defines
a dense list-to-detail inventory product with tabbed evidence and dialogs, while
production currently renders a two-column workbench and the real E2E only proves
a narrow English/dark direct-page read path.

This child change remediates Plugins under the governing
`deck-go-frontend-prototype-parity-remediation` head proposal. It must preserve
Gateway/deck-go contract truth, keep plugin lifecycle mutations out of scope
until supported, and strengthen mock plus real E2E evidence.

## What Changes

- Reconcile the active Plugins prototype with contract truth from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - Gateway `deck.plugins.list`;
  - `frontend-handoff/modules/plugins/api-usage.md`;
  - existing frontend API wrappers.
- Rework the production Plugins panel toward the active prototype flow:
  - list view with KPI strip, search, capability/origin/scope controls, dense
    inventory rows, loading/error/empty states, and refresh action;
  - detail view with back navigation, hero, Overview/Capabilities/Diagnostics/
    Activation/Manifest/Audit tabs, and read-only evidence surfaces;
  - diagnostic, manifest, and raw inventory dialogs where current contract data
    supports them or where the prototype uses an explicit degraded projection.
- Keep frontend calls behind deck-go BFF wrappers and avoid browser direct
  Gateway or plugin-runtime access.
- Update mock fixtures and visual tests so L1 mock evidence exercises the
  prototype-shaped list/detail/tab/dialog states.
- Strengthen real Gateway E2E with shell navigation, dark/light and
  English/Chinese variants, detail tab/dialog interactions when inventory is
  non-empty, BFF-only browser transport, and a bounded attempt to create
  representative run-scoped plugin inventory data through isolated
  `openclaw.json` or workspace setup where safe.
- Record unsupported handoff projections explicitly, especially manifest route,
  activation audit route, lifecycle mutations, marketplace trust, and package
  signature verification.

## Capabilities

### New Capabilities

- `frontend-plugins-prototype-parity-remediation`: Defines the Plugins-specific
  prototype parity remediation, real fixture standard, accepted exceptions, and
  archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Plugins row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/plugins/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`.
- E2E and mocks:
  - `deck-go/test/e2e/plugins-visual.spec.ts`;
  - `deck-go/test/e2e/plugins-real-gateway.spec.ts`;
  - `deck-go/test/fixtures/mock-gateway.mjs`;
  - shared real E2E helpers only if deterministic fixture helpers are needed.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/plugins/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `5.4`.
