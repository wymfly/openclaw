## Why

Identity is an existing Control panel backed by Deck identity list/link/unlink contracts, but it still reads as an old split-list utility instead of a high-fidelity operator workbench. The module needs to join the frontend redesign rollout so operators can inspect canonical identity coverage, peer mappings, config-hash safety, link/unlink mutation status, and explicit unsupported semantics without losing the current contract-backed behavior.

## What Changes

- Create a complete high-fidelity Identity handoff package under `deck-go/frontend-handoff/modules/identity/`.
- Redesign `deck-go/frontend-new/src/components/panels/identity/` into a compact identity relationship workbench:
  - canonical identity rail with peer coverage, channel mix, empty-peer state, and selected state
  - selected identity detail with peer mapping inventory, mutation safety state, config-hash evidence, last action, error recovery, and raw payload disclosure
  - guarded link dialog and confirmed unlink actions that preserve the current `configHash`/`baseHash` contract
  - deterministic loading, empty, error, ready, selection, link, unlink, missing-hash, failed-mutation-refresh, and localization states
- Preserve the current frontend API wrapper behavior for `fetchIdentityLinks()`, `linkIdentityPeer()`, and `unlinkIdentityPeer()`; browser code continues to call the Go BFF routes only.
- Confirm or add deterministic mock/local visual E2E data for `GET /deck/identity` and `POST /deck/identity` link/unlink outcomes; fix only deterministic mock/local drift needed for visual coverage.
- Move obsolete global `deck-ui-identity*` styling into module-local CSS using design-system tokens and stable responsive constraints.
- Add focused mock/local visual E2E covering ready identity workspace, selected canonical detail, link dialog or missing-hash guard, unlink confirmation path, and raw payload or mutation evidence where feasible.
- Update cross-module readiness evidence with Identity-specific findings and relationship-workbench molecule candidates.

## Capabilities

### New Capabilities

- `frontend-identity-hifi-redesign`: Covers the Identity handoff package, production UI rewrite, mock/local visual verification, and contract/drift findings for canonical identities, peer mappings, guarded link/unlink mutations, config-hash evidence, and mutation recovery states.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Identity implementation evidence and classifies whether canonical rails, peer mapping rows, mutation guard strips, link dialogs, hash evidence chips, raw payload disclosure, and last-action/error surfaces remain local, need a dedicated atom/pattern proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/identity/`
- `deck-go/frontend-new/src/components/panels/identity/`
- `deck-go/frontend-new/src/theme.css` Identity global styling removal or narrowing
- `deck-go/test/fixtures/mock-gateway.mjs` deterministic Identity mock data if needed
- `deck-go/test/e2e/` focused Identity mock/local visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-identity-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
