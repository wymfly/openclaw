## 1. Evidence Baseline

- [x] 1.1 Create a component parity ledger mapping `dashboard/src/components/panels/chat/**/*` reference files to `deck-go/frontend/src/components/panels/chat/**/*` target files.
- [x] 1.2 Classify each analyzed gap as synchronize, preserve-current-with-rationale, or backend/API gap.
- [x] 1.3 Define deterministic rich Chat fixtures for transcript markdown, tool results, Canvas, Artifact, Composer, approval, and sidebar states; Subagent lineage remains a documented source-level exception because the current Chat visual seed does not mount `SubagentTree`.
- [x] 1.4 Confirm no new frontend dependency is required; if one is required for exact old Deck parity, stop and document the approval request before implementation.

## 2. Message And Markdown Rendering

- [x] 2.1 Add focused tests for old Deck markdown constructs missing from `deck-go` rendering: emphasis, nested lists, blockquotes, horizontal rules, tables, images, fenced code, and overflow behavior.
- [x] 2.2 Restore old Deck-equivalent markdown rendering for transcript assistant text and Artifact markdown surfaces.
- [x] 2.3 Synchronize message bubble alignment, width, avatar, timestamp, run metadata, empty state, loading state, and streaming placeholder with old Deck.
- [x] 2.4 Verify canonical transcript blocks still render without raw JSON leakage and without regressing `transcript-rendering-contract` scenarios.

## 3. Tool Result Rendering

- [x] 3.1 Restore old Deck-equivalent `ToolUseCard` and `ToolResultCard` chrome, including collapsible structure, error default-open behavior, summary row, status icon, raw toggle placement, and per-card raw state.
- [x] 3.2 Restore bash, diff, highlighted code, read, image preview, download, virtual long-output, and fallback result views to old Deck-equivalent visuals.
- [x] 3.3 Ensure structured tool results remain block-aware and only show opaque raw JSON when raw view is explicitly selected.
- [x] 3.4 Verify artifact detection works for string, structured, and nested tool result content that old Deck surfaced as Artifacts.

## 4. Canvas And Artifact Panels

- [x] 4.1 Synchronize `RightPanel` width, resize handle, drawer chrome, and Canvas/Artifact mode switching with old Deck.
- [x] 4.2 Restore old Deck-equivalent Canvas header actions, iframe viewport, loading spinner/text, error recovery overlay, debug panel, and A2UI bridge visible behavior.
- [x] 4.3 Restore old Deck-equivalent `ArtifactCard` and `ArtifactPanel` title, metadata, icon buttons, copy/download/fullscreen/close actions, and fullscreen layout.
- [x] 4.4 Synchronize shared renderers for html, svg, markdown, code, json, table/csv, image, text, and unsupported Artifact content.

## 5. Composer And Runtime Controls

- [x] 5.1 Synchronize `MessageInput` layout, attach affordance, textarea sizing, ghost hint alignment, active slash tag, context warning, send/abort behavior, and disabled states with old Deck.
- [x] 5.2 Synchronize `ChatContextBar`, `BlockFilterBar`, transcript search, and `ToolProgressBar` visual hierarchy and interactions with old Deck.
- [x] 5.3 Synchronize `ApprovalDialog`, `SessionSidebar`, and `AgentTabs` chrome, iconography, keyboard affordances, delete confirmation, and action placement with old Deck.
- [x] 5.4 Synchronize `SubagentCard` and `SubagentTree` card hierarchy, status badges, default expanded/collapsed states, duration display, result/error details, and lineage indentation with old Deck, with Chat visual-seed screenshot capture recorded as a source-level exception because neither old nor current `ChatPanel` mounts `SubagentTree` directly.

## 6. Browser Evidence

- [x] 6.1 Capture paired old Deck vs `deck-go` desktop screenshots for the rich transcript and markdown corpus states.
- [x] 6.2 Capture paired old Deck vs `deck-go` desktop screenshots for tool results, Canvas, and Artifact states.
- [x] 6.3 Capture paired old Deck vs `deck-go` desktop screenshots for Composer, approval, sidebar, context/filter/search, tool progress, and Subagent states, with Subagent lineage recorded as a source-level exception.
- [x] 6.4 Record screenshot verdict notes identifying no material differences or listing accepted non-parity exceptions with rationale.

## 7. Verification And Handoff

- [x] 7.1 Run focused `deck-go` frontend tests covering markdown/renderers/cards/actions.
- [x] 7.2 Run the approved `deck-go` frontend build/check path.
- [x] 7.3 Run relevant repository checks for touched shared protocol/API surfaces if backend/API gaps are fixed.
- [x] 7.4 Update the parity ledger and final implementation notes with changed files, remaining risks, and validation artifacts.
