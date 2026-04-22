# Contract-Readiness Ledger

This ledger was the original tranche-planning artifact for deciding which legacy
panel families could move first.

It is no longer the live source of truth for Stage 3 host status.

Current authority now lives in:

- `deck-go/frontend/src/restoration/contract-readiness.ts`
- `deck-go/frontend/scripts/check-restored-host.mjs`

Current fact:

- `frontend-blocked` family count is now `0`
- every panel id from `panel-registry.tsx` has a concrete `ActivePanelHost`
  implementation in the Vite host
- the remaining gap is no longer "missing panel ownership", but "how much
  deeper each restored panel must go before final cutover"

## Status model

- `ready`: current deck-go contracts appear sufficient for restoration without new backend façade work
- `ready-with-adapter`: current deck-go contracts are partially sufficient, but frontend restoration will need adapter-side normalization or selective façade completion
- `frontend-blocked`: current deck-go contracts are not yet sufficient; frontend restoration should not start on that family without additional backend support

## Current interpretation

Every panel family has now crossed from "should frontend restoration start?" to
"how much adapter depth is still acceptable before final cutover?".

Use rule:

- treat `frontend/src/restoration/contract-readiness.ts` as the current
  implementation verdict
- treat this document as historical planning context only
