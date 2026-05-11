## Why

Sessions and Usage now have fresh prototype-parity evidence showing the same
panel-level visual needs: dense typography, bordered surfaces, KPI/stat strips,
section/meta hierarchy, and selected row/detail chrome. Keeping these as
module-local CSS will make later modules repeat the same fixes, but directly
changing canonical token values or global atoms is still too broad because the
evidence points to missing panel primitives more than broken base tokens.

This change promotes the shared cockpit/panel shapes behind Sessions and Usage
into a controlled design-system layer, with Sessions and Usage as reference
consumers and a gate for validating one additional module before wider rollout.

## What Changes

- Add canonical panel/cockpit primitives above atoms and below business panels:
  `PanelRoot`, `PanelSurface`, `KpiStrip` / `PanelMetric`,
  `PanelSectionHeader`, and `PanelStatusRow` / `PanelPill`.
- Migrate Sessions and Usage to consume those primitives or their CSS contracts
  as reference consumers without changing their data contracts or feature
  behavior.
- Add visual parity guards that assert panel typography, canonical token
  consumption, overflow, and key DOM structure for reference consumers.
- Record a third-module sampling gate before these primitives are treated as a
  broad replacement path for all remaining panels.
- Preserve canonical token values and existing atoms in this change. Any global
  token value adjustment remains a separate proposal.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `design-system-patterns`: Add the promoted panel/cockpit pattern contracts
  and clarify that these patterns satisfy the existing reuse-analysis gate via
  Sessions + Usage evidence.
- `design-system-cross-module-readiness`: Add Sessions + Usage as reference
  consumers for the cockpit pattern set and require third-module validation
  before broad migration claims.

## Impact

- Affected frontend code:
  - `deck-go/frontend-new/src/design-system/patterns/**`
  - `deck-go/frontend-new/src/design-system/index.ts`
  - `deck-go/frontend-new/src/components/panels/sessions/**`
  - `deck-go/frontend-new/src/components/panels/usage/**`
- Affected evidence/docs:
  - Sessions visual parity artifacts and implementation notes.
  - Usage visual parity artifacts and implementation notes.
  - `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- Tests:
  - Design-system pattern renderer/a11y tests.
  - Sessions and Usage focused unit tests.
  - Sessions and Usage prototype parity E2E.
  - Frontend build.
- No backend, Gateway, BFF, generated contract, dependency, or global token value
  changes are in scope.
