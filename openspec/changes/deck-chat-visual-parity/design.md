## Context

Old Chat and Vite Chat share many business concepts, but not the full visual component stack:

| Old Chat file/class                                     | Current Vite status | Migration meaning                                              |
| ------------------------------------------------------- | ------------------- | -------------------------------------------------------------- |
| `SubagentCard.tsx`                                      | missing             | Subagent visual cards and lineage presentation are incomplete. |
| `blocks/BashResultView.tsx`                             | missing             | Bash output parity is incomplete.                              |
| `blocks/DiffPreview.tsx`                                | missing             | File operation diff parity is incomplete.                      |
| `blocks/HighlightedCodeView.tsx`                        | missing             | Syntax-highlighted file/read rendering is incomplete.          |
| `blocks/ShowRawToggle.tsx`                              | missing             | Raw/formatted tool result toggle parity is incomplete.         |
| `shared-renderer/*`                                     | missing             | Markdown/table/json/code shared renderers are incomplete.      |
| `MessageInput`, `SlashCommandPalette`, `MentionPopover` | present             | Needs visual/interaction comparison, not full invention.       |
| `CanvasPanel`, `RightPanel`, `ApprovalDialog`           | present             | Needs behavior and icon parity verification.                   |

The surrounding shell baseline is no longer part of this change. `deck-shell-i18n-parity` has closed the global nav/header/theme/locale path and established the Playwright MCP foreground-stack validation route. Chat planning should consume that baseline and focus on Chat-local layout, renderer, interaction, i18n, and backend/API gaps.

## Goals / Non-Goals

**Goals:**

- Make Vite Chat visually recognizable as old Deck Chat.
- Preserve migrated business logic and Go-backed stream recovery.
- Fix Go backend/API/projection gaps when old Chat workflows depend on supported Gateway data that the Go service has not exposed yet.
- Restore missing renderer and action components where old Deck had concrete UI.
- Make Chat EN/ZH complete for visible local copy.

**Non-Goals:**

- Do not change Gateway protocol semantics unless a separate Gateway capability change is explicitly approved.
- Do not redesign Chat beyond old Deck parity.
- Do not make mobile Chat parity blocking.
- Do not use deprecated CLI smoke, shell-launched Chromium/Chrome smoke, or CDP fallback as completion evidence.
- Do not reopen shell/nav/header/theme infrastructure unless a Chat-specific regression proves the shared baseline is insufficient.

## Decisions

### D1: Preserve Vite data path, migrate old visual components

The Go/Vite Chat API facade remains the runtime authority. Old Deck components are used as visual/interaction authorities and adapted to current stores/hooks where needed.

### D2: Renderer parity is part of Chat parity

Chat is not complete if message bubbles render but specialized tool/canvas/code/diff/bash views are missing.

### D3: Compare interactions before rewriting

Each Chat subcomponent must be classified as direct-port, adapt-port, or obsolete-by-Gateway before implementation.

### D4: Treat missing Go stream/projection behavior as migration work

If old Chat needs session snapshots, transcript block metadata, tool-result payload fields, subagent lineage, approval state, or SSE event semantics that the Go backend lacks, the implementation must fix the Go service/API adapter or record a Gateway-unsupported exception before removing or disabling the UI.

### D5: Separate deterministic visual states from live-send proof

Old/current screenshot parity should use deterministic Chat states for empty transcript, active transcript, tool result, approval, right panel, streaming/status, and subagent lineage. A live Chat send through the Go backend plus managed Gateway is valuable final evidence when local model credentials/configuration allow it, but missing third-party model credentials must not block renderer and interaction parity; it must be recorded as a runtime credential gap instead.

## Risks / Trade-offs

- **Risk: old renderer code assumes old store shape.** → Adapt at component boundary instead of changing store authority.
- **Risk: renderer migration causes regressions in transcript recovery.** → Preserve existing transcript and SSE tests; add visual renderer tests.
- **Risk: Chat becomes too large.** → Keep shared renderers under focused folders and avoid panel-level monolith growth.
- **Risk: Go stream shape differs from old Node+Next service.** → Add adapter-level tests and avoid frontend fake states for missing backend data.
- **Risk: live Chat send becomes a credential problem instead of a migration signal.** → Keep deterministic renderer/interaction states blocking, and classify live-send credential absence separately from product parity.
