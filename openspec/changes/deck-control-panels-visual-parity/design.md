## Context

Control panels are the broadest and riskiest visual migration group because they include both dense configuration workflows and provider-specific channel onboarding.

| Panel               | Old Deck evidence                                                                                                        | Current Vite evidence                                                                                           | Meaning                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Channels            | 44+ non-test UI files plus access descriptors, wizard framework, WeCom pages, diagnostics, analytics, settings, bindings | `ChannelsPanel`, `AccountDmPolicyEditor`, `ChannelSettingsEditor`, `WecomAccessControls`, `WecomRoutingSummary` | The old channel management product surface is mostly absent. |
| Config              | `ConfigPanel`, schema form, section nav, conflict/diff dialogs, helpers, typed fields                                    | `ConfigPanel`                                                                                                   | Old schema-driven editor structure is collapsed.             |
| Settings            | about/appearance/connection/devices/notifications/token rotation/confirm components                                      | `SettingsPanel`                                                                                                 | Old sectioned settings UI is collapsed.                      |
| Routing             | activity feed, binding table, condition builder, conflict badge, route simulator                                         | `RoutingPanel`                                                                                                  | Old routing simulation and conflict UI is not restored.      |
| Subagents           | active runs/config/history/steer dialog                                                                                  | `SubagentsPanel`                                                                                                | Old tabbed subagent management needs parity.                 |
| Budget/Alerts       | status/rules/forms/lists                                                                                                 | one panel each                                                                                                  | Rule-management decomposition is collapsed.                  |
| Nodes/Docs/Identity | list/detail/dialog/viewer components                                                                                     | one panel each                                                                                                  | Detail and dialog structures need restoration.               |
| Plugins             | old and current both have one panel file                                                                                 | Needs visual/i18n parity verification, not assumed completion.                                                  |

## Goals / Non-Goals

**Goals:**

- Restore old Control panel desktop layouts, wizards, dialogs, section navigation, tabs, details, forms, diagnostics, and charts.
- Close Go backend/API/projection gaps when old Control workflows require supported Gateway data.
- Make all Control panel visible copy EN/ZH-complete.
- Keep migration reviewable by processing Channels, Config, Settings, Routing, and smaller panels as separate subtracks inside this change.

**Non-Goals:**

- Do not redesign Control panels before old Deck parity.
- Do not hardcode channel/provider behavior that Gateway metadata cannot support.
- Do not make mobile parity blocking.

## Decisions

### D1: Channels is the highest-risk Control subtrack

Channels must be treated almost like a nested migration because old Deck includes channel list/detail, settings, access, bindings, analytics, health/probe, onboarding, wizard runner, access descriptors, and provider-specific WeCom/OpenClaw Weixin flows.

### D2: Config restores schema editor mechanics

Config parity is not a JSON textarea or compact form. It requires old section navigation, typed fields, schema help, search/highlight, conflict handling, and diff preview.

### D3: Settings restores section composition

Settings must restore about, appearance, connection, devices, notifications, pending requests, token rotation, and confirmation flows as separate surfaces.

### D4: Routing restores simulation and conflict views

Routing parity requires old binding table, condition builder, route simulator, conflict badge, and activity feed patterns.

### D5: Backend gaps are fixed per Control workflow

If old Node+Next service behavior supplied channel diagnostics, onboarding metadata, schema forms, config conflicts, route simulation, device/session settings, identity links, node pairing, docs content, budget/alert rules, plugin metadata, or subagent runs that Go does not expose, the owning subtrack must fix the Go backend/API adapter or record a Gateway-unsupported exception.

### D6: Control can run in parallel but must split internal risk

Control may run in a separate worktree from baseline `341d965a36`, but it is the largest remaining child change and should use internal staged commits for Channels, Config/Settings, Routing/Subagents, and the smaller panels.

Owned implementation surfaces:

- `deck-go/frontend/src/components/panels/budget/**`
- `deck-go/frontend/src/components/panels/alerts/**`
- `deck-go/frontend/src/components/panels/channels/**`
- `deck-go/frontend/src/components/panels/plugins/**`
- `deck-go/frontend/src/components/panels/routing/**`
- `deck-go/frontend/src/components/panels/subagents/**`
- `deck-go/frontend/src/components/panels/identity/**`
- `deck-go/frontend/src/components/panels/config/**`
- `deck-go/frontend/src/components/panels/nodes/**`
- `deck-go/frontend/src/components/panels/docs/**`
- `deck-go/frontend/src/components/panels/settings/**`
- Control panel tests and `openspec/changes/deck-control-panels-visual-parity/**`

Shared-file rules:

- `deck-go/frontend/src/i18n/en.json` and `deck-go/frontend/src/i18n/zh.json` may be extended only with Control panel-local keys.
- `deck-go/frontend/src/api.ts` and Go backend files may be changed only after the relevant row is added to `backend-gaps.md`.
- Channel/provider UI must stay behind Gateway metadata, access descriptors, or existing extension contracts.
- Shell, nav registry, shared lists, and theme changes should be avoided unless a separate shared-baseline patch is created.

## Risks / Trade-offs

- **Risk: Channels is too large for one implementation pass.** → Split implementation tasks internally by list/detail, settings/access/bindings, onboarding/wizard, analytics/diagnostics, and provider-specific pages.
- **Risk: Go config schema differs from old Node service.** → Validate against Gateway/openclaw config source of truth and do not restore stale fields.
- **Risk: provider-specific channel UI violates extension boundaries.** → Use Gateway metadata/access descriptors and existing extension contracts; do not hardcode core provider ids without an existing boundary.
- **Risk: Settings includes auth/device side effects.** → Add targeted tests around token rotation and pending device actions.

## Migration Plan

1. Restore shared management primitives from shell work.
2. Restore Channels in internal subtracks: list/detail, settings/access/bindings, wizard/onboarding, analytics/diagnostics, provider pages.
3. Restore Config schema editor.
4. Restore Settings sectioned UI.
5. Restore Routing simulation/conflict/activity UI.
6. Restore Budget, Alerts, Subagents, Identity, Nodes, Docs, and Plugins visual parity.
7. Run group-level i18n, light/dark, browser traversal, action tests, and backend gap validation.
