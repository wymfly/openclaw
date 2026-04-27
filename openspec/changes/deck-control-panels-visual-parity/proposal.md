## Why

The Control group contains the largest remaining visual migration gap. Old Deck had detailed management surfaces for channels, configuration, settings, routing, alerts, budgets, nodes, docs, identity, plugins, and subagents. The current Vite frontend generally keeps one compact panel per area, with Channels as the clearest example of structural loss.

These pages are also where Go backend parity is most likely to matter: old Node+Next service behavior normalized config schemas, channel diagnostics, onboarding, settings, routing simulation, and device/session state. The full migration must close those service gaps when the Gateway supports the capability.

## What Changes

- Restore old Deck desktop visual and interaction structure for Budget, Alerts, Channels, Plugins, Routing, Subagents, Identity, Config, Nodes, Docs, and Settings.
- Restore old shared management patterns: list/detail workspaces, section navigation, schema forms, conflict/diff dialogs, wizards, onboarding pages, access controls, diagnostics, analytics, route simulator, device rows, token rotation, settings sections, and docs viewer.
- Wire all Control group visible copy through EN/ZH i18n.
- Fix or classify Go backend/API/projection gaps discovered while restoring old Node+Next control workflows.
- Validate each Control panel in this worktree with old authority files, current target files, targeted tests, interaction checks that do not require Playwright, and backend gap notes.
- Defer Playwright/browser traversal, screenshots, and full theme/locale browser evidence until this worktree is merged into the local integration branch.
- Render explicit unavailable states for old Deck workflows that lack Gateway/source support; do not silently omit unsupported controls.

## Capabilities

### New Capabilities

- `deck-control-panel-parity`: Defines old Deck visual, interaction, i18n, and backend-gap parity requirements for Budget, Alerts, Channels, Plugins, Routing, Subagents, Identity, Config, Nodes, Docs, and Settings.

### Modified Capabilities

- None.

## Impact

- Reference files:
  - `dashboard/src/components/panels/budget/**/*`
  - `dashboard/src/components/panels/alerts/**/*`
  - `dashboard/src/components/panels/channels/**/*`
  - `dashboard/src/components/panels/plugins/**/*`
  - `dashboard/src/components/panels/routing/**/*`
  - `dashboard/src/components/panels/subagents/**/*`
  - `dashboard/src/components/panels/identity/**/*`
  - `dashboard/src/components/panels/config-editor/**/*`
  - `dashboard/src/components/panels/nodes/**/*`
  - `dashboard/src/components/panels/docs/**/*`
  - `dashboard/src/components/panels/settings/**/*`
- Vite target files:
  - `deck-go/frontend/src/components/panels/budget/**/*`
  - `deck-go/frontend/src/components/panels/alerts/**/*`
  - `deck-go/frontend/src/components/panels/channels/**/*`
  - `deck-go/frontend/src/components/panels/plugins/**/*`
  - `deck-go/frontend/src/components/panels/routing/**/*`
  - `deck-go/frontend/src/components/panels/subagents/**/*`
  - `deck-go/frontend/src/components/panels/identity/**/*`
  - `deck-go/frontend/src/components/panels/config/**/*`
  - `deck-go/frontend/src/components/panels/nodes/**/*`
  - `deck-go/frontend/src/components/panels/docs/**/*`
  - `deck-go/frontend/src/components/panels/settings/**/*`
  - `deck-go/**/*` backend/API files needed to close documented Control panel parity gaps
- Evidence:
  - Channels old tree includes wizards, onboarding pages, detail/access/settings/bindings/analytics, health/probe, schema settings, access descriptors, and many channel-specific tests; Vite Channels has five component files.
  - Config old tree includes section navigation, schema form, field helpers, conflict/diff dialogs, tag filters, and typed fields; Vite Config has one panel file.
  - Settings old tree includes about, appearance, connection, devices, notifications, token rotation, confirmation, and pending request components; Vite Settings has one panel file.
  - Routing old tree includes activity feed, binding table, condition builder, conflict badge, and route simulator; Vite Routing has one panel file.
  - Alerts, Budget, Nodes, Docs, Identity, Subagents, and Plugins each need old component-level comparison and i18n validation rather than single-panel styling.
