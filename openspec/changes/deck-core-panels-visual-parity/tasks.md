## 1. Agents

- [ ] 1.1 Map old `dashboard/src/components/panels/agents` files to current Vite targets.
- [ ] 1.2 Restore `AgentList`, `AgentDetail`, and `AgentComparePanel` boundaries.
- [ ] 1.3 Restore old tabs: Overview, Config, Context, Routing, Sessions, Skills, Tools, Subagent, Prompt/Files where applicable.
- [ ] 1.4 Restore old dialogs/editors: template dialog, skill install/config, bootstrap file editor, fallback chain editor, tool policy/profile/catalog, prompt preview/variables.
- [ ] 1.5 Adapt old interactions to Go APIs and document unsupported fields.
- [ ] 1.6 Fix or classify Go backend/API gaps for old Agents list/detail/compare/config/files/tools/skills/routing/sessions/subagent workflows.
- [ ] 1.7 Validate Agents EN/ZH, light/dark, list/detail/compare screenshots.

## 2. Gateway / Monitor

- [ ] 2.1 Map old `dashboard/src/components/panels/monitor` files to Vite Gateway target.
- [ ] 2.2 Restore overview cards: connection, health, heartbeat, live feed.
- [ ] 2.3 Restore history/timeline tabs and timeline subviews where Go APIs provide data.
- [ ] 2.4 Add unavailable/empty states for old Monitor surfaces not yet exposed by Go backend.
- [ ] 2.5 Fix or classify Go backend/API gaps for old Monitor health, heartbeat, live feed, history, timeline, run timeline, tool waterfall, model stats, and subagent tree projections.
- [ ] 2.6 Validate Gateway/Monitor EN/ZH, light/dark, overview/timeline screenshots.

## 3. Models

- [ ] 3.1 Restore old Models 4-tab layout.
- [ ] 3.2 Restore Catalog tab: provider list, provider overview, model detail, params editor.
- [ ] 3.3 Restore Provider Config tab: provider sidebar, config form, add provider wizard, auth health, Bedrock discovery, probe button, advanced fields.
- [ ] 3.4 Restore Fallbacks tab: primary model card, fallback chain, add model select, model badges.
- [ ] 3.5 Restore Usage tab: summary cards, cost trend chart, provider quota grid.
- [ ] 3.6 Fix or classify Go backend/API gaps for provider catalog, provider config, auth health, Bedrock discovery, probe, fallback chain, and usage/quota projections.
- [ ] 3.7 Validate Models EN/ZH, light/dark, all tab screenshots.

## 4. Cross-Core Validation

- [ ] 4.1 Run targeted Core panel tests.
- [ ] 4.2 Run browser plugin traversal for Agents, Gateway, and Models.
- [ ] 4.3 Ensure old authority files, current target files, and intentional differences are documented.
