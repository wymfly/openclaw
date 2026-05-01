# First Executable Slice Recommendation

## Recommended first slice

**Slice:** `Shell + NavRail + ActivePanel runtime restoration`

This is the first executable slice because it restores the real legacy Deck
topology without immediately depending on every panel family being backend-ready.

## Legacy files to anchor from

- `dashboard/src/app/page.tsx`
- `dashboard/src/components/layout/Shell.tsx`
- `dashboard/src/components/layout/HeaderBar.tsx`
- `dashboard/src/components/layout/NavRail.tsx`
- `dashboard/src/lib/panel-registry.ts`
- `dashboard/src/lib/panel-navigation.ts`
- `dashboard/src/stores/ui.ts`

## Current deck-go assets allowed to reuse

- `deck-go/frontend/src/theme.css`
- `deck-go/frontend/src/theme.ts`
- `deck-go/frontend/src/api.ts`
- `deck-go/frontend/src/stream-contract.ts`
- selected presentation primitives from `deck-go/frontend/src/shell-components.tsx`

## Assets not allowed to define the slice

- `deck-go/frontend/src/App.tsx`

This file may donate code, but must not remain the structural source of truth.

## Acceptance criteria

1. `deck-go/frontend` has a real shell composition spine:
   - `Shell`
   - `HeaderBar`
   - `NavRail`
   - `panel-registry`
   - `panel-navigation`
   - `ui store`
   - `ActivePanelHost`
2. Top-level navigation is driven by the active panel registry, not a single monolithic page.
3. The shell/header/nav runtime truth matches the legacy Deck shape.
4. The current single-shell `App.tsx` no longer acts as the frontend topology baseline.
5. The slice does not reopen backend/control-plane architecture.

## Reject conditions

Reject this slice if:

- the implementation still uses one large `App.tsx` as the composition baseline
- the nav rail is recreated without the panel-registry source of truth
- the shell is rebuilt as a route tree instead of a shell/panel runtime
- implementation starts on panel-family restoration before the shell/nav scaffold exists

## Why this slice first

It satisfies the clarified requirement with the lowest structural regret:

- restores the real frontend topology first
- avoids more investment into the invalid current shell
- creates a safe base for later panel-family migration
