## 0. Parallel Worktree Readiness

- [ ] 0.1 Confirm this worktree starts from `341d965a36` or a documented descendant shared-baseline commit.
- [ ] 0.2 Create and maintain `backend-gaps.md` before changing Go backend/API adapter files.
- [ ] 0.3 Keep shared frontend edits panel-local, namespaced, and recorded in the task evidence.
- [ ] 0.4 Split Control implementation evidence internally by Channels, Config/Settings, Routing/Subagents, and smaller remaining panels.

## 1. Channels

- [ ] 1.1 Map old `dashboard/src/components/panels/channels` files to Vite targets, including wizards, onboarding pages, access descriptors, diagnostics, analytics, and provider-specific pages.
- [ ] 1.2 Restore channel list/detail, settings/access/bindings tabs, health/probe status, schema settings, retry strategy editor, DM policy selector, account config dialog, analytics, and test tool surfaces.
- [ ] 1.3 Restore WeCom/OpenClaw Weixin onboarding, wizard runner, access guidance, overview/access pages, page shell navigation, and routing summary where Gateway metadata supports them.
- [ ] 1.4 Fix or classify Go backend/API gaps for channel schema, capabilities, diagnostics, health, bindings, settings, access descriptors, onboarding metadata, wizard specs, analytics, and handoff/login actions.
- [ ] 1.5 Validate Channels EN/ZH, light/dark, list/detail/settings/access/bindings/wizard/onboarding screenshots.

## 2. Config

- [ ] 2.1 Map old `dashboard/src/components/panels/config-editor` files to Vite `config` targets.
- [ ] 2.2 Restore section navigation, schema form, typed fields, field help popovers, search highlights, tag filters, conflict dialog, and diff preview dialog.
- [ ] 2.3 Fix or classify Go backend/API gaps for config schema, current config, validation, conflicts, diff preview, save/reload, and field metadata.
- [ ] 2.4 Validate Config EN/ZH, light/dark, section navigation, edit, conflict, and diff screenshots.

## 3. Settings

- [ ] 3.1 Map old `dashboard/src/components/panels/settings` files to Vite targets.
- [ ] 3.2 Restore about, appearance, connection, devices, notification, pending request, token rotation, confirm action, and device row surfaces.
- [ ] 3.3 Fix or classify Go backend/API gaps for settings bootstrap, connection state, device list/actions, pending requests, token rotation, and notification preferences.
- [ ] 3.4 Validate Settings EN/ZH, light/dark, section/device/token/confirm screenshots.

## 4. Routing

- [ ] 4.1 Map old `dashboard/src/components/panels/routing` files to Vite targets.
- [ ] 4.2 Restore activity feed, binding table, condition builder, conflict badge, route simulator, and action feedback.
- [ ] 4.3 Fix or classify Go backend/API gaps for routing bindings, conflict detection, simulation, activity, and handoff behavior.
- [ ] 4.4 Validate Routing EN/ZH, light/dark, table/builder/simulator/conflict screenshots.

## 5. Budget And Alerts

- [ ] 5.1 Restore Budget status, rule list, and rule form surfaces.
- [ ] 5.2 Restore Alerts rule list, fired alerts list, and rule form surfaces.
- [ ] 5.3 Fix or classify Go backend/API gaps for budget rules/status and alert rules/fired alerts.
- [ ] 5.4 Validate Budget and Alerts EN/ZH, light/dark, status/list/form screenshots.

## 6. Remaining Control Panels

- [ ] 6.1 Restore Plugins old visual/i18n parity and metadata/action states.
- [ ] 6.2 Restore Subagents active runs, config, history, and steer dialog tabs.
- [ ] 6.3 Restore Identity list/link dialog workflows.
- [ ] 6.4 Restore Nodes cards, pairing requests, lifecycle state, and node actions.
- [ ] 6.5 Restore Docs category filter, document list, and document viewer.
- [ ] 6.6 Fix or classify Go backend/API gaps for plugin metadata, subagent runs/config/history, identity links, node pairing/lifecycle, and docs content.
- [ ] 6.7 Validate Plugins, Subagents, Identity, Nodes, and Docs EN/ZH, light/dark, detail/dialog/viewer screenshots.

## 7. Cross-Control Validation

- [ ] 7.1 Run targeted Control panel tests.
- [ ] 7.2 Run browser plugin traversal for all Control panels.
- [ ] 7.3 Confirm every Control panel has old authority files, current target files, backend gap classification, and screenshot evidence.
