# Current Frontend Reuse Matrix

This matrix classifies the existing `deck-go/frontend` surface for restoration work.

## Reuse classes

- `reusable as-is`
- `reusable with adaptation`
- `rewrite-required`
- `invalid as baseline`

## Current asset matrix

| Current asset                               | Classification           | Why                                                                                                             |
| ------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `deck-go/frontend/src/theme.css`            | reusable with adaptation | useful as token/style asset, but not shell truth                                                                |
| `deck-go/frontend/src/theme.ts`             | reusable as-is           | simple theme-mode persistence utility                                                                           |
| `deck-go/frontend/src/api.ts`               | reusable with adaptation | deck-go API client is valuable, but needs panel-family-facing consumption instead of single-shell orchestration |
| `deck-go/frontend/src/stream-contract.ts`   | reusable with adaptation | current event parsing is valuable, but should be moved under restored panel/module boundaries                   |
| `deck-go/frontend/src/shell-components.tsx` | reusable with adaptation | several presentation primitives are salvageable, but must be redistributed under restored panel families        |
| `deck-go/frontend/src/main.tsx`             | rewrite-required         | app bootstrap must be rebuilt around restored shell/nav/panel scaffold                                          |
| `deck-go/frontend/src/App.tsx`              | invalid as baseline      | monolithic single-shell orchestration; cannot remain the architectural source of truth                          |
| `deck-go/frontend/src/vite-env.d.ts`        | reusable as-is           | environment typing support                                                                                      |

## Reuse interpretation

The current frontend is not a discard pile. It already contains real assets:

- theme/token work
- API client logic
- stream/continuity parsing
- selected presentation primitives
- auth/bootstrap/session hydration/session-event seams embedded in the current shell

But it is still invalid as the **structural baseline** because those assets are
currently organized under one `App.tsx` workbench shell.
