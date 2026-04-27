## Why

The Core group panels have major structural drift from old Deck. Agents moved from a composed list/detail/compare/tabbed workspace to a large Vite single-file panel; Models moved from a four-tab catalog/config/fallbacks/usage system to a compact Vite configuration surface; Gateway is a Vite-specific panel that does not visually restore old Monitor panel structure.

This change restores Core group visual and interaction parity after the shell baseline is stable.

## What Changes

- Restore Agents old Deck list/detail/compare/tabs/files/tools/skills/routing/sessions/subagent UI structure.
- Restore Models old Deck catalog/provider-config/fallbacks/usage tabs and subcomponents.
- Restore Gateway/Monitor visual parity using old Monitor overview/history/timeline structure while keeping Go-backed Gateway authority.
- Wire Core group visible copy through EN/ZH i18n.
- Fix or classify Go backend/API/projection gaps discovered while restoring Agents, Models, and Gateway/Monitor workflows that old Node+Next service behavior already supported.
- Validate desktop visual parity page-by-page with worktree-local structural, i18n, unit, and build evidence; defer Playwright/browser E2E screenshots until after local integration merge.

## Capabilities

### New Capabilities

- `deck-core-panel-parity`: Defines old Deck visual, i18n, and interaction parity requirements for Agents, Gateway/Monitor, and Models.

### Modified Capabilities

- None.

## Impact

- Reference files:
  - `dashboard/src/components/panels/agents/**/*`
  - `dashboard/src/components/panels/monitor/**/*`
  - `dashboard/src/components/panels/models/**/*`
- Vite target files:
  - `deck-go/frontend/src/components/panels/agents/**/*`
  - `deck-go/frontend/src/components/panels/gateway/**/*`
  - `deck-go/frontend/src/components/panels/models/**/*`
  - `deck-go/**/*` backend/API files needed to close documented Core panel parity gaps after the specific workflow row is classified in `backend-gaps.md`
- Evidence:
  - Agents: old 28 non-test UI files, current 3.
  - Models: old 31 non-test UI files, current 3.
  - Monitor/Gateway: old Monitor has 13 non-test UI files, current Gateway has 1.
