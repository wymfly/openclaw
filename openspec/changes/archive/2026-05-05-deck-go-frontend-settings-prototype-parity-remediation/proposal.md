## Why

The Settings module has useful contract wiring and prior real-contract checks,
but the current production UI still diverges from the active handoff prototype at
`deck-go/frontend-handoff/modules/settings/prototype.html`. The prototype defines
a left-section navigation plus right-side curated preference editor, while
production currently presents KPI cards and a two-column runtime/config summary.

This child change remediates Settings under the governing
`deck-go-frontend-prototype-parity-remediation` head proposal. It must preserve
runtime-mode safety, keep all browser data access behind the deck-go BFF, and
strengthen mock plus real Gateway evidence with safe run-scoped settings data.

## What Changes

- Reconcile the active Settings prototype with contract truth from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-endpoints.contract.json`;
  - `contracts/source/deck-ui.contract.json`;
  - `contracts/source/deck-config-write-safety.contract.json`;
  - `frontend-handoff/modules/settings/api-usage.md`;
  - existing backend settings/runtime/device routes and frontend wrappers.
- Rework the production Settings panel toward the active prototype flow:
  - topbar with status and unsaved state;
  - searchable left section rail for identity, runtime, appearance,
    notifications, paired devices, and version;
  - right-side curated group renderer with field rows, read-only runtime-mode
    semantics, draft editing, reset/save actions, and confirmation dialogs.
- Preserve runtime-mode safety:
  - bundled endpoint fields stay read-only and cannot mutate supervisor state;
  - remote endpoint editing continues to use `/api/runtime/endpoint` only when
    capabilities say it is mutable;
  - deck access tokens and device-token mutations are never fabricated as safe
    real E2E writes.
- Update mock fixtures and visual tests so L1 mock evidence exercises the
  prototype-shaped section rail, group switching, draft edits, save/reset,
  confirmation dialogs, and localized state.
- Strengthen real Gateway E2E with shell navigation, dark/light and
  English/Chinese variants, section/subpage interactions, BFF-only browser
  transport, unexpected error checks, route-shape checks, rejected unsafe writes,
  and a safe run-scoped settings fixture written through the isolated BFF/config
  surface.
- Record unsupported product gaps explicitly, including recent-save history,
  access-token rotation, keybindings/privacy settings, notification delivery
  semantics, and destructive real device-token mutations.

## Capabilities

### New Capabilities

- `frontend-settings-prototype-parity-remediation`: Defines the
  Settings-specific prototype parity remediation, runtime-mode safety rules,
  real fixture standard, accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Settings row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/settings/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/settings/SettingsPanel.test.tsx`;
  - `deck-go/test/e2e/settings-visual.spec.ts`;
  - `deck-go/test/e2e/settings-real-gateway.spec.ts`;
  - shared real E2E helpers only if deterministic fixture helpers are needed.
- Backend/contracts:
  - no intended contract expansion; deterministic BFF or write-safety defects
    found during verification may be fixed in this child.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/settings/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `5.5`.
