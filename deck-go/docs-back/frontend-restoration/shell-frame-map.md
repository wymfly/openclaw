# Shell Frame Map

This document defines the **canonical shell truth** for legacy Deck.

It is the first artifact in Tranche 0 and overrides any assumption that the
frontend should be restored from a route tree or from the current
`deck-go/frontend/src/App.tsx` shell.

## Canonical shell sources

| Source                                          | Role in legacy Deck                                                                                      | Restoration implication                                                                                      |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `dashboard/src/app/page.tsx`                    | Bootstraps the entire app inside one persistent shell and swaps the active panel                         | The restored frontend should keep one app entry that mounts a persistent shell plus active-panel composition |
| `dashboard/src/components/layout/Shell.tsx`     | Defines the persistent two-column shell frame                                                            | The restored frontend needs a real `Shell` component, not an oversized page component                        |
| `dashboard/src/components/layout/HeaderBar.tsx` | Owns active-panel labeling, gateway status affordance, locale switch, theme switch, and mobile-nav entry | The restored frontend must preserve `HeaderBar` as a distinct shell module                                   |
| `dashboard/src/components/layout/NavRail.tsx`   | Owns grouped navigation, collapsed/mobile variants, active panel switching, and bottom settings slot     | The restored frontend must restore the legacy nav-rail model rather than invent new top-level IA             |
| `dashboard/src/lib/panel-registry.ts`           | Declares the runtime panel surface, group assignment, and lazy/eager loading model                       | Panel ids and import targets are authoritative when folder names drift                                       |
| `dashboard/src/lib/panel-navigation.ts`         | Defines cross-panel handoff helpers that preserve operator context                                       | Cross-panel workflows are not optional glue; they are part of the legacy product topology                    |
| `dashboard/src/stores/ui.ts`                    | Holds `activePanel`, shell collapse/mobile-nav state, theme, and locale                                  | The restored frontend needs a dedicated UI/navigation store, not page-local shell state                      |

## Composition model

Legacy Deck is structurally:

1. one app root
2. one persistent shell
3. one nav rail
4. one header bar
5. one active panel selected by `activePanel`

It is **not** structurally:

- a route-first dashboard
- one giant screen with many simultaneously visible regions
- a shell grown organically from one page component

## Tie-breaker rule

When shell structure evidence conflicts, use this order:

1. `panel-registry` ids / groups / import targets
2. `panel-navigation` handoff functions
3. composed shell runtime (`page.tsx` + `Shell.tsx` + `HeaderBar.tsx` + `NavRail.tsx`)
4. directory names as supporting evidence only

## Restoration target modules

The initial structural scaffold in `deck-go/frontend` should include:

- `Shell`
- `HeaderBar`
- `NavRail`
- `panel-registry`
- `panel-navigation`
- `ui store`
- `ActivePanelHost`

## Explicit non-target

`deck-go/frontend/src/App.tsx` is **not** a valid shell-frame source of truth.

It may provide reusable pieces, but it must not remain the topological baseline.
