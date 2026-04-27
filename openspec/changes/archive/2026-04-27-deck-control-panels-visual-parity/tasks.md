## 0. Parallel Worktree Readiness

- [x] 0.1 Confirm this worktree starts from `0f17c40ca7` or a documented descendant shared-baseline commit.
- [x] 0.2 Create and maintain `backend-gaps.md` before changing Go backend/API adapter files.
- [x] 0.3 Keep shared frontend edits panel-local, namespaced, and recorded in the task evidence.
- [x] 0.4 Split Control implementation evidence internally by Channels, Config/Settings, Routing/Subagents, and smaller remaining panels.
- [x] 0.5 Do not run Playwright E2E, browser traversal, or screenshot gates in this worktree; record those checks as integration-branch follow-up evidence.
- [x] 0.6 Assign serial ownership for `deck-go/frontend/src/api.ts` and `deck-go/frontend/src/i18n/{en,zh}.json` edits; do not let multiple internal slices modify them without coordination.
- [x] 0.7 For every old workflow that Gateway/source does not support, render an explicit unavailable state and add a `backend-gaps.md` row.

## 1. Channels

- [x] 1.1 Map old `dashboard/src/components/panels/channels` files to Vite targets, including wizards, onboarding pages, access descriptors, diagnostics, analytics, and provider-specific pages.
- [x] 1.2 Restore channel list/detail, settings/access/bindings tabs, health/probe status, schema settings, retry strategy editor, DM policy selector, account config dialog, analytics, and test tool surfaces.
- [x] 1.3 Restore WeCom/OpenClaw Weixin onboarding, wizard runner, access guidance, overview/access pages, page shell navigation, and routing summary where Gateway metadata supports them.
- [x] 1.4 Fix or classify Go backend/API gaps for channel schema, capabilities, diagnostics, health, bindings, settings, access descriptors, onboarding metadata, wizard specs, analytics, and handoff/login actions.
- [x] 1.5 Validate Channels with old authority mapping, targeted component tests, EN/ZH copy coverage, light/dark-safe class/state assertions where practical, and deferred integration screenshot notes.

## 2. Config

- [x] 2.1 Map old `dashboard/src/components/panels/config-editor` files to Vite `config` targets.
- [x] 2.2 Restore section navigation, schema form, typed fields, field help popovers, search highlights, tag filters, conflict dialog, and diff preview dialog.
- [x] 2.3 Fix or classify Go backend/API gaps for config schema, current config, validation, conflicts, diff preview, save/reload, and field metadata.
- [x] 2.4 Validate Config with old authority mapping, targeted component tests, EN/ZH copy coverage, section navigation/edit/conflict/diff assertions, and deferred integration screenshot notes.

## 3. Settings

- [x] 3.1 Map old `dashboard/src/components/panels/settings` files to Vite targets.
- [x] 3.2 Restore about, appearance, connection, devices, notification, pending request, token rotation, confirm action, and device row surfaces.
- [x] 3.3 Fix or classify Go backend/API gaps for settings bootstrap, connection state, device list/actions, pending requests, token rotation, and notification preferences.
- [x] 3.4 Validate Settings with old authority mapping, targeted component tests, EN/ZH copy coverage, section/device/token/confirm assertions, and deferred integration screenshot notes.

## 4. Routing

- [x] 4.1 Map old `dashboard/src/components/panels/routing` files to Vite targets.
- [x] 4.2 Restore activity feed, binding table, condition builder, conflict badge, route simulator, and action feedback.
- [x] 4.3 Fix or classify Go backend/API gaps for routing bindings, conflict detection, simulation, activity, and handoff behavior.
- [x] 4.4 Validate Routing with old authority mapping, targeted component tests, EN/ZH copy coverage, table/builder/simulator/conflict assertions, and deferred integration screenshot notes.

## 5. Budget And Alerts

- [x] 5.1 Restore Budget status, rule list, and rule form surfaces.
- [x] 5.2 Restore Alerts rule list, fired alerts list, and rule form surfaces.
- [x] 5.3 Fix or classify Go backend/API gaps for budget rules/status and alert rules/fired alerts.
- [x] 5.4 Validate Budget and Alerts with old authority mapping, targeted component tests, EN/ZH copy coverage, status/list/form assertions, and deferred integration screenshot notes.

## 6. Remaining Control Panels

- [x] 6.1 Restore Plugins old visual/i18n parity and metadata/action states.
- [x] 6.2 Restore Subagents active runs, config, history, and steer dialog tabs.
- [x] 6.3 Restore Identity list/link dialog workflows.
- [x] 6.4 Restore Nodes cards, pairing requests, lifecycle state, and node actions.
- [x] 6.5 Restore Docs category filter, document list, and document viewer.
- [x] 6.6 Fix or classify Go backend/API gaps for plugin metadata, subagent runs/config/history, identity links, node pairing/lifecycle, and docs content.
- [x] 6.7 Validate Plugins, Subagents, Identity, Nodes, and Docs with old authority mapping, targeted component tests, EN/ZH copy coverage, detail/dialog/viewer assertions, and deferred integration screenshot notes.

## 7. Cross-Control Validation

- [x] 7.1 Run targeted Control panel tests.
- [x] 7.2 Run frontend build/typecheck for the changed Control surfaces.
- [x] 7.3 Run targeted Go tests if Go backend/API files changed; no Go backend/API files changed in this worktree slice.
- [x] 7.4 Confirm every Control panel has old authority files, current target files, backend gap classification, targeted non-E2E evidence, and an integration-branch screenshot/browser follow-up note.

## 8. Integration-Branch E2E Closure

- [x] 8.1 Run Playwright MCP desktop browser validation for Budget, Alerts, Channels, Plugins, Routing, Subagents, Identity, Config, Nodes, Docs, and Settings across dark/light plus EN/ZH modes after all visual parity worktrees are merged.
- [x] 8.2 Record runtime stack status, route/screenshot evidence, console/error review, and any accepted unavailable-state rationale in `e2e-evidence.md` before archive.
