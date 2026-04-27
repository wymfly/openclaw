## Why

Chat is the closest migrated page, but it is still not a full old Deck UI migration. The old Chat tree contains renderer and interaction files that are absent in Vite, including `SubagentCard.tsx`, bash/diff/highlight/raw result views, and the shared renderer stack.

This change restores Chat as the reference-quality panel before broader page migration continues.

`deck-shell-i18n-parity` is now the completed baseline for the surrounding shell, nav, header, theme, locale, shared primitives, and Playwright MCP evidence path. This Chat change should plan and implement only Chat-local parity plus backend/API gaps discovered by Chat workflows.

## What Changes

- Restore old Deck Chat layout, visual hierarchy, icons, action surfaces, right panel behavior, status bars, and empty/loading/error states on desktop.
- Restore missing message renderer components and specialized tool result views from old Deck.
- Restore old Deck Chat interactions: agent tabs, session sidebar behavior, message actions, input history, slash command/mention UI, approvals, steering, transcript search, filters, A2UI/canvas panel, subagent lineage, and streaming status.
- Wire Chat-visible copy through EN/ZH i18n.
- Keep Gateway capability as the runtime authority, while fixing Go Chat backend/API/projection gaps discovered during migration when old Node+Next service behavior is required for a supported workflow.
- Use the established foreground Go backend + managed Gateway + Vite preview stack with the Codex Playwright MCP for browser evidence. Deprecated CLI smoke, shell-launched Chrome/Chromium smoke, and CDP fallback are not completion evidence for this change.

## Capabilities

### New Capabilities

- `deck-chat-ui-parity`: Defines old Deck Chat visual and interaction parity requirements for the Vite Chat panel.

### Modified Capabilities

- `transcript-rendering-contract`: Chat must render old Deck transcript blocks and shared renderer surfaces.
- `tool-result-views`: Chat must restore old Deck bash/diff/highlight/raw/virtual result views.

## Impact

- Reference files:
  - `dashboard/src/components/panels/chat/**/*`
- Vite target files:
  - `deck-go/frontend/src/components/panels/chat/**/*`
  - `deck-go/frontend/src/stores/chat*`
  - `deck-go/frontend/src/lib/transcript-*`
  - `deck-go/**/*` backend/API files needed to close documented Chat parity gaps
- Current evidence:
  - Old Chat has 60 non-test UI files; Vite Chat has 51.
  - Missing old files include `SubagentCard.tsx`, `blocks/BashResultView.tsx`, `blocks/DiffPreview.tsx`, `blocks/HighlightedCodeView.tsx`, `blocks/ShowRawToggle.tsx`, and `shared-renderer/*`.
  - Shell-level Playwright evidence exists at `.omx/artifacts/deck-shell-i18n-playwright-20260427/` and should be reused as baseline proof, not repeated as Chat scope.
