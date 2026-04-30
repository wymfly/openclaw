## Why

`deck-go/frontend` Chat now covers the major old Deck workflows, but source-level comparison shows that the current UI is not visually or semantically synchronized with the old Next Deck Chat. The largest gaps are in message markdown rendering, tool-result card chrome, Canvas loading/error/detail states, Artifact rendering, Composer controls, status strips, sidebar behavior, and Subagent cards.

This change creates a focused follow-up to turn the recent parity analysis into an implementation-ready contract for matching old Deck Chat visuals and interactions on the Go/Vite frontend.

## What Changes

- Synchronize `deck-go` Chat shell, transcript, message bubbles, status bars, filter/search surfaces, Composer, approval dialog, session sidebar, and Subagent cards with the old Deck UI reference.
- Restore old Deck message rendering behavior where `deck-go` currently diverges, especially `Streamdown`/`.chat-prose` markdown semantics, assistant/user bubble geometry, avatars, streaming placeholders, and run metadata placement.
- Restore old Deck tool-result behavior, including collapsible card structure, error-open defaults, raw toggle placement, download/artifact affordances, bash/diff/highlight/raw/virtual views, and structured nested block handling.
- Restore old Deck Canvas and Artifact panel visual hierarchy, iconography, loading/error overlays, right-drawer behavior, shared renderer output, markdown/code/table/json/image presentation, and fullscreen/header actions.
- Add focused visual and interaction validation evidence for the analyzed Chat states, including paired old Deck vs `deck-go` screenshots and scenario-level checks.
- Keep the Go backend and Gateway API as runtime authority; fix frontend rendering first, and record backend/API gaps only when old Deck behavior cannot be reproduced from available `deck-go` data.

## Capabilities

### New Capabilities

- `deck-go-chat-ui-visual-sync`: Defines focused visual and interaction synchronization requirements for `deck-go` Chat against the old Next Deck Chat reference, covering message rendering, Canvas, Artifact, tools, Composer, sidebar, status, and validation evidence.

### Modified Capabilities

None. Existing data/semantic capabilities such as `transcript-rendering-contract`, `tool-result-views`, and `subagent-inline-cards` remain the underlying behavior contracts; this change adds a focused `deck-go` visual synchronization contract on top.

## Impact

- Reference source:
  - `dashboard/src/components/panels/chat/**/*`
  - `dashboard/src/app/globals.css`
- Target source:
  - `deck-go/frontend/src/components/panels/chat/**/*`
  - `deck-go/frontend/src/theme.css`
  - `deck-go/frontend/src/api.ts`
  - `deck-go/frontend/src/i18n/**/*`
- Validation impact:
  - Requires old Deck vs `deck-go` desktop screenshot evidence for representative rich Chat states.
  - Requires browser validation for message markdown, tool results, Canvas, Artifact, Composer, approval, sidebar, and Subagent states.
  - Does not introduce new dependencies unless an implementation task explicitly proves that an existing old Deck dependency already present in the workspace is the least-risk restoration path.
