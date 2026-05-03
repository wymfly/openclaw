## Why

Memory is an Observe panel with meaningful contract coverage but an old visual shell. It already reaches Deck BFF file browse/read/search behavior and Gateway `doctor.memory.*` diagnostics/dream-diary actions, yet the UI presents those lanes as dense legacy cards instead of a coherent memory operations workspace.

This change applies the contract-led high-fidelity workflow to Memory so mock + frontend converge against the existing contract chain and design-system posture. Deterministic mock/API drift may be fixed; uncertain real Gateway memory/search/dream semantics should be recorded as handoff follow-up.

## What Changes

- Create a complete high-fidelity Memory handoff package under `deck-go/frontend-handoff/modules/memory/`.
- Redesign `deck-go/frontend-new/src/components/panels/memory/` into a compact memory operations workspace:
  - agent-scoped browse/read navigation
  - search scope and LanceDB unavailable evidence
  - graph/path relationship overview
  - health diagnostics
  - dream-diary maintenance actions with destructive confirmation guards
  - selected file/search/graph/health/dream detail sidecar
- Preserve current API wrapper behavior for:
  - `fetchAgentsList`
  - `browseMemory`
  - `readMemoryFile`
  - `searchMemory`
  - `fetchMemoryHealth`
  - `runMemoryDreams`
- Fix deterministic mock Gateway memory payload gaps if visual E2E cannot exercise the normal frontend API path with contract-shaped data.
- Move or narrow obsolete global `deck-ui-memory` styling into module-local CSS using design-system tokens and stable responsive constraints.
- Add focused mock visual E2E covering the ready memory workspace and meaningful interaction states such as file read, search, health, dreams, or graph.
- Update cross-module readiness evidence with Memory-specific findings and repeated file-tree/search/diagnostics/detail molecules.

## Capabilities

### New Capabilities

- `frontend-memory-hifi-redesign`: Covers the Memory handoff package, production UI rewrite, contract-shaped mocks, focused mock visual evidence, and local design-system feedback.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Memory implementation evidence and classifies whether file tree, search result, graph row, diagnostics, dream action, and detail sidecar molecules remain local, need a dedicated atom proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/memory/`
- `deck-go/frontend-new/src/components/panels/memory/`
- `deck-go/frontend-new/src/theme.css` Memory global styling removal or narrowing
- `deck-go/frontend-new/src/i18n/en.json` and `deck-go/frontend-new/src/i18n/zh.json`
- `deck-go/test/fixtures/mock-gateway.mjs` if memory mock drift is confirmed
- `deck-go/test/e2e/` focused Memory mock visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-memory-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
