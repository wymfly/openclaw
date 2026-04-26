# Contract-Readiness Ledger

This ledger was the original tranche-planning artifact for deciding which legacy
panel families could move first.

It is no longer the live source of truth for Stage 3 host status.

Current authority now lives in:

- `deck-go/frontend/src/deck-ui/panel-readiness.ts`
- `deck-go/frontend/scripts/check-deck-ui-host.mjs`

Current fact:

- every active panel readiness entry is now `ready`
- every panel id from `panel-registry.tsx` is routable through `ActivePanelHost`
  / `panel-component-registry.tsx` in the Vite host
- the remaining work is refinement on top of migrated logic rather than missing
  panel ownership

## Historical status model

- `ready`: deck-go contracts appeared sufficient for restoration without new backend facade work
- `ready-with-adapter`: deck-go contracts were partially sufficient, but frontend restoration needed adapter-side normalization or selective facade completion
- blocked: deck-go contracts were not yet sufficient; frontend restoration should not start on that family without additional backend support

## Current interpretation

Every panel family has now crossed from "should frontend restoration start?" to
"how much adapter depth is still acceptable before final cutover?".

Use rule:

- treat `frontend/src/deck-ui/panel-readiness.ts` as the current
  implementation verdict
- treat this document as historical planning context only
