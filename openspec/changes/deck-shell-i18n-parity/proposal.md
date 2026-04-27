## Why

The Vite Deck shell currently opens panels, but it does not fully restore the old Next Deck app frame: onboarding, toast notifications, keyboard shortcut dialog, panel error boundary, suspense fallback, Tailwind/shadcn visual primitives, and full panel-local i18n behavior are incomplete or replaced by simplified Vite-specific surfaces.

This change establishes the shared foundation required before page-by-page visual parity can converge.

## What Changes

- Restore old Deck shell behavior and perceptual layout for desktop Web: sidebar, header, main content padding, active states, status controls, theme/locale controls, shortcut behavior, and loading/error surfaces.
- Restore shared UI primitives used by panels: list/table controls, tabs, dialogs, skeleton/error/empty states, cards, badges, inline edit, batch action bars, and section navigation where old Deck used them.
- Audit and wire all shell and panel-local copy through EN/ZH i18n before page-specific changes claim parity.
- Preserve Go backend auth/bootstrap behavior while making its visual/auth screens fit the old Deck app frame.
- Keep mobile parity deferred.

## Capabilities

### New Capabilities

- `deck-shell-parity`: Defines old Deck desktop shell, header, nav, app frame, shortcut, toast, error, and shared primitive parity requirements.
- `deck-global-i18n-parity`: Defines cross-panel i18n audit and locale-switch requirements used by all visual parity child changes.

### Modified Capabilities

- `panel-registry`: Align Vite registry identity, iconography, grouping, shortcut behavior, and lazy/eager loading with old Deck.

## Impact

- Affected Vite files:
  - `deck-go/frontend/src/deck-ui/*`
  - `deck-go/frontend/src/components/shared/*`
  - `deck-go/frontend/src/i18n/*`
  - `deck-go/frontend/src/theme.css`
  - `deck-go/frontend/src/theme.ts`
- Reference files:
  - `dashboard/src/app/page.tsx`
  - `dashboard/src/app/globals.css`
  - `dashboard/src/components/layout/*`
  - `dashboard/src/components/lists/*`
  - `dashboard/src/components/shared/*`
  - `dashboard/src/i18n/*`
