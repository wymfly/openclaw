## Context

Core panels are high-value operator workflows:

- Old `AgentsPanel.tsx` composes `AgentList`, `AgentDetail`, and `AgentComparePanel`; Vite `AgentsPanel.tsx` contains much of the behavior in one file.
- Old `ModelsPanel.tsx` is a controlled 4-tab layout: Catalog, Provider Config, Fallbacks, Usage; Vite `ModelsPanel.tsx` is a large single panel with a few helper editors.
- Old Gateway UI is named Monitor and includes Overview, History, Timeline, LiveFeed, RunTimeline, ToolWaterfall, ModelStats, SubagentTree; Vite Gateway has one panel file.

## Goals / Non-Goals

**Goals:**

- Restore old Core panel component decomposition and desktop visual structure.
- Keep Go backend APIs as the data source.
- Fix Go backend/API/projection gaps when old Core workflows depend on supported Gateway data that the Go service has not exposed yet.
- Make every Core panel EN/ZH complete.
- Preserve old tabs, sidebars, compare views, cards, charts, status badges, and action affordances.

**Non-Goals:**

- Do not reintroduce old Next server/API routes.
- Do not add new Gateway features only to satisfy old visual placeholders.
- Do not redesign Core panels beyond old Deck parity.

## Decisions

### D1: Agents is a dedicated subtrack

Agents has the largest Core interaction surface after Chat. It must be restored from old list/detail/tab/compare decomposition, not only styled.

### D2: Models restores tabs first

Models parity starts by restoring old tabs and subcomponent boundaries. Data field differences are adapted after the old visual structure exists.

### D3: Gateway maps to old Monitor

The Vite nav may keep “Gateway”, but visual authority is old `monitor` unless a Go-specific Gateway function has no old equivalent.

### D4: Backend gaps are handled per Core subtrack

Agents, Models, and Gateway/Monitor each get a small backend parity ledger. Missing projections or mutations required by old list/detail/compare/config/history/timeline workflows are fixed in Go when the Gateway supports them; otherwise the UI shows an explicit unavailable state and records the exception.

### D5: Core owns only its panel surfaces in parallel worktrees

Core may run in a separate worktree from baseline `341d965a36`.

Owned implementation surfaces:

- `deck-go/frontend/src/components/panels/agents/**`
- `deck-go/frontend/src/components/panels/gateway/**`
- `deck-go/frontend/src/components/panels/models/**`
- Core panel tests and `openspec/changes/deck-core-panels-visual-parity/**`

Shared-file rules:

- `deck-go/frontend/src/i18n/en.json` and `deck-go/frontend/src/i18n/zh.json` may be extended only with Core panel-local keys.
- `deck-go/frontend/src/api.ts` and Go backend files may be changed only after the relevant row is added to `backend-gaps.md`.
- `deck-go/frontend/src/components/shared/**`, `deck-go/frontend/src/deck-ui/**`, and `deck-go/frontend/src/theme.css` should not be broadly refactored in this worktree. If Core discovers a shared primitive need, land it as a small shared-baseline patch before other worktrees merge.

## Risks / Trade-offs

- **Risk: old Agents/Models components assume richer stores than Go currently exposes.** → Use adapters and explicit unavailable states.
- **Risk: Gateway/Monitor naming creates confusion.** → Maintain a mapping note in registry/design and visible copy.
- **Risk: large files remain large.** → Migration should split Vite panels along old component boundaries.
- **Risk: backend fixes broaden Core scope.** → Only close gaps tied to old Deck workflow parity; do not add speculative Gateway features.
