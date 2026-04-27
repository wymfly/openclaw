## Why

The current `deck-go/frontend` migration is functionally broad, but it is not a full visual or interaction migration of the old Next.js Deck client. The evidence shows that most Vite panels are collapsed into simplified single-file implementations while the old Deck used richer per-panel component trees, shared list/form/dialog primitives, and deeper i18n-driven interaction surfaces.

This matters now because continuing to polish the current Vite UI in place would preserve the wrong target. The migration target must be reset to old Deck perceptual and workflow parity first, with `design.md`-style redesign deferred until after the old client can be recognized and operated as the same product on the Go backend.

## What Changes

- Define the old Next.js Deck client under `dashboard/` as the visual and interaction authority for this phase.
- Require `deck-go/frontend` to migrate old Deck shell, nav, header, panel layouts, shared UI primitives, dialogs, tabs, wizards, lists, charts, and Chat rendering surfaces before claiming full visual migration.
- Require every desktop panel to support English and Chinese for panel-local visible copy, not only nav labels.
- Require Chat to migrate old Deck UI details beyond the data path: message rendering blocks, shared renderer, tool result views, subagent cards, right panel behavior, input affordances, icons, status surfaces, and action menus.
- Require page-by-page migration planning and acceptance gates for all active Deck panels.
- Require visual validation to compare against old Deck reference behavior and screenshots, using desktop Web as the blocking target.
- Keep Gateway API as the product capability authority, but require Go backend/API/projection gaps discovered during frontend migration to be fixed in the owning child change rather than hidden by frontend-only workarounds.
- Explicitly defer mobile parity and post-parity redesign to follow-on changes.

## Capabilities

### New Capabilities

- `deck-visual-parity`: Defines full desktop visual parity requirements for the Vite Deck shell, shared primitives, and all active panels against the old Next.js Deck client.
- `deck-i18n-parity`: Defines English/Chinese completeness requirements for all visible Vite Deck UI copy, including panel-local text, dialogs, empty states, errors, buttons, placeholders, and tooltips.
- `deck-interaction-parity`: Defines old Deck interaction parity requirements for navigation, panel state, Chat workflows, dialogs, keyboard affordances, lists, forms, wizards, tabs, and feedback states.
- `deck-visual-validation`: Defines evidence gates for page-by-page visual comparison, browser traversal, screenshots, and regression checks before visual migration can be called complete.
- `deck-backend-parity-gaps`: Defines how frontend-discovered Go backend/API/projection gaps are recorded, fixed, classified, and validated during old Deck parity migration.

### Modified Capabilities

- `panel-registry`: Tighten panel registry expectations so the Vite Deck panel inventory maps to old Deck panel identity, iconography, grouping, lazy/eager loading behavior, shortcut behavior, and bottom-panel placement.
- `transcript-rendering-contract`: Extend existing transcript rendering expectations to include old Deck visual renderer parity for message blocks, code/diff/bash/tool result views, markdown/table/json renderers, and nested block rendering.
- `tool-result-views`: Extend existing tool result requirements to include old Deck specialized view parity, including raw toggle behavior, highlighted code, diff preview, bash output rendering, and virtual result handling.

## Impact

- Affected frontend source:
  - `deck-go/frontend/src/deck-ui/*`
  - `deck-go/frontend/src/components/shared/*`
  - `deck-go/frontend/src/components/panels/**/*`
  - `deck-go/frontend/src/i18n/*`
  - `deck-go/frontend/src/theme.css`
  - `deck-go/frontend/src/theme.ts`
- Reference source:
  - `dashboard/src/components/layout/*`
  - `dashboard/src/components/shared/*`
  - `dashboard/src/components/lists/*`
  - `dashboard/src/components/panels/**/*`
  - `dashboard/src/i18n/*`
  - `dashboard/src/app/globals.css`
- Validation impact:
  - Browser evidence must use the Codex Playwright/browser plugin path already established for `deck-go`.
  - Desktop Web visual parity is blocking; mobile parity is not part of this change.
  - Functional Gateway/API behavior must remain aligned with the Go backend and managed local Gateway stack.
  - Go backend changes are in scope when old Node+Next service behavior is required to preserve a migrated Deck workflow and the Gateway source of truth supports the capability.
