## Why

Threads is an Observe panel with a narrow, contract-backed data path (`deck.threads.list` -> `GET /api/deck/threads` -> `fetchThreads`) but the current UI is still an old dense table/detail shell. It has useful behavior, yet it has not converged on the current high-fidelity design-system posture or a module handoff package that future frontend work can reuse.

This change applies the contract-led high-fidelity workflow to Threads so mock + frontend converge around the existing contract chain while preserving the current frontend skeleton and only fixing deterministic drift.

## What Changes

- Create a complete high-fidelity Threads handoff package under `deck-go/frontend-handoff/modules/threads/`.
- Redesign `deck-go/frontend-new/src/components/panels/threads/` into a compact thread relationship workspace:
  - filter bar for agent, channel, and active/all status
  - sorted thread inventory with stable active selection
  - relationship map from platform thread to session target to agent
  - selected-thread summary, copy/open handoff actions, and raw payload inspection
  - empty, loading, error, and first-run mock states
- Preserve the current API wrapper behavior for `fetchThreads()` and browser-only BFF access; do not call Gateway directly from browser code.
- Fix deterministic mock Gateway thread payload gaps if visual E2E cannot exercise the normal frontend API path with contract-shaped data.
- Move obsolete global `deck-ui-threads` styling into module-local CSS using design-system tokens and stable responsive constraints.
- Add focused mock visual E2E covering the ready Threads workspace and meaningful interaction states.
- Update cross-module readiness evidence with Threads-specific findings and relationship/list/detail molecule candidates.

## Capabilities

### New Capabilities

- `frontend-threads-hifi-redesign`: Covers the Threads handoff package, production UI rewrite, contract-shaped mocks, focused mock visual evidence, and local design-system feedback.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Threads implementation evidence and classifies whether thread list rows, relationship maps, handoff actions, and payload detail molecules remain local, need a dedicated atom/pattern proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/threads/`
- `deck-go/frontend-new/src/components/panels/threads/`
- `deck-go/frontend-new/src/theme.css` Threads global styling removal or narrowing
- `deck-go/frontend-new/src/i18n/en.json` and `deck-go/frontend-new/src/i18n/zh.json`
- `deck-go/test/fixtures/mock-gateway.mjs` if thread mock drift is confirmed
- `deck-go/test/e2e/` focused Threads mock visual coverage
- `docs/design-references/` and cross-module readiness documentation as design-system reference inputs
- `openspec/specs/frontend-threads-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
