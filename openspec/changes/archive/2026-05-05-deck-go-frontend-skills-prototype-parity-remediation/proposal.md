## Why

The Skills module already has broad contract wiring and previous real-contract
verification, but its production surface still reads as a two-column operations
workbench. The active handoff target at
`deck-go/frontend-handoff/modules/skills/prototype.html` defines a different
product flow: an Installed/Hub segmented catalog, KPI strip, dense rows,
list-to-detail navigation, six detail tabs, and focused install/config/disable
dialogs.

This child change remediates Skills under the governing
`deck-go-frontend-prototype-parity-remediation` head proposal. It must preserve
Gateway/deck-go contract truth, avoid unsafe real skill mutations unless safely
isolated, and strengthen mock plus real E2E evidence.

## What Changes

- Reconcile the active Skills prototype with contract truth from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `contracts/source/deck-mutations.contract.json`;
  - `frontend-handoff/modules/skills/api-usage.md`;
  - existing frontend API wrappers.
- Rework the production Skills panel toward the active prototype flow:
  - Installed/Hub segmented list view with KPI strip, search/filter/source
    controls, dense installed rows, hub result rows, and refresh/update actions;
  - skill detail view with hero, back navigation, and Overview/Setup/Triggers/
    Bins/Files/Audit tabs;
  - install, configure, disable, and files/detail dialogs where current
    contracts support them;
  - agent skill matrix retained as a secondary product surface, not the primary
    first viewport.
- Keep frontend calls behind deck-go BFF/runtime wrappers and avoid browser
  direct Gateway, ClawHub, package manager, or filesystem access.
- Update mock fixtures and visual tests so L1 mock evidence exercises the
  prototype-shaped list/detail/dialog states.
- Strengthen real Gateway E2E with shell navigation, dark/light and
  English/Chinese variants, detail tab/dialog interactions, BFF-only browser
  transport, and safe run-scoped Skills fixture attempts where isolation can be
  proven. Unsafe skill install/update paths may circuit-break with evidence.
- Record unsupported handoff projections explicitly, especially trigger/file/
  audit projections and managed-bin removal semantics when no stable DTO exists.

## Capabilities

### New Capabilities

- `frontend-skills-prototype-parity-remediation`: Defines the Skills-specific
  prototype parity remediation, real fixture standard, accepted exceptions, and
  archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Skills row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/skills/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`.
- E2E and mocks:
  - `deck-go/test/e2e/skills-visual.spec.ts`;
  - `deck-go/test/e2e/skills-real-gateway.spec.ts`;
  - `deck-go/test/fixtures/mock-gateway.mjs`;
  - shared real E2E helpers only if a deterministic fixture helper is needed.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/skills/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `5.3`.
