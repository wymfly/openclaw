## 0. Parallel Worktree Readiness

- [x] 0.1 Confirm this worktree starts from `0f17c40ca7` or a documented descendant shared-baseline commit.
- [x] 0.2 Create and maintain `backend-gaps.md` before changing Go backend/API adapter files.
- [x] 0.3 Keep shared frontend edits panel-local, namespaced, and recorded in the task evidence.
- [x] 0.4 For each subtrack, classify old workflows in `backend-gaps.md` as `supported`, `adapter-only`, or `unavailable` before deep component restoration; ledger rows must stay fine-grained enough that one row can honestly carry one support state.
- [x] 0.5 Record Playwright/browser screenshots and traversal as deferred integration evidence, not a worktree-local gate.

## 1. Agents

- [x] 1.1 Map old `dashboard/src/components/panels/agents` files to current Vite targets.
- [x] 1.2 Restore `AgentList`, `AgentDetail`, and `AgentComparePanel` boundaries.
- [x] 1.3 Restore old tabs: Overview, Config, Context, Routing, Sessions, Skills, Tools, Subagent, Prompt/Files where applicable.
- [x] 1.4 Restore old dialogs/editors: template dialog, skill install/config, bootstrap file editor, fallback chain editor, tool policy/profile/catalog, prompt preview/variables.
- [x] 1.5 Adapt old interactions to Go APIs and document unsupported fields.
- [x] 1.6 Fix or classify Go backend/API gaps for old Agents list/detail/compare/config/files/tools/skills/routing/sessions/subagent workflows.
- [x] 1.7 Validate Agents EN/ZH, light/dark class coverage, list/detail/compare structure, and tests; defer screenshot evidence to post-merge integration.

## 2. Gateway / Monitor

- [x] 2.1 Map old `dashboard/src/components/panels/monitor` files to Vite Gateway target.
- [x] 2.2 Restore overview cards: connection, health, heartbeat, live feed.
- [x] 2.3 Restore history/timeline tabs and timeline subviews where Go APIs provide data.
- [x] 2.4 Add unavailable/empty states for old Monitor surfaces not yet exposed by Go backend.
- [x] 2.5 Fix or classify Go backend/API gaps for old Monitor health, heartbeat, live feed, history, timeline, run timeline, tool waterfall, model stats, and subagent tree projections.
- [x] 2.6 Keep managed Gateway runtime controls in a fourth Runtime tab by default; Overview may include only a compact read-only runtime status card.
- [x] 2.7 Validate Gateway/Monitor EN/ZH, light/dark class coverage, overview/timeline/runtime structure, and tests; defer screenshot evidence to post-merge integration.

## 3. Models

- [x] 3.1 Restore old Models 4-tab layout.
- [x] 3.2 Restore Catalog tab: provider list, provider overview, model detail, params editor.
- [x] 3.3 Restore Provider Config tab: provider sidebar, config form, add provider wizard, auth health, Bedrock discovery, probe button, advanced fields.
- [x] 3.4 Restore Fallbacks tab: primary model card, fallback chain, add model select, model badges.
- [x] 3.5 Restore Usage tab: summary cards, cost trend chart, provider quota grid.
- [x] 3.6 Fix or classify Go backend/API gaps for provider catalog, provider config, auth health, Bedrock discovery, probe, fallback chain, and usage/quota projections.
- [x] 3.7 Validate Models EN/ZH, light/dark class coverage, all tab structure, and tests; defer screenshot evidence to post-merge integration.

## 4. Cross-Core Validation

- [x] 4.1 Run targeted Core panel tests.
- [x] 4.2 Run frontend build and any targeted backend tests for changed Go packages.
- [x] 4.3 Ensure old authority files, current target files, intentional differences, and deferred browser evidence are documented.

## 5. Integration-Branch E2E Closure

- [x] 5.1 Run Playwright MCP desktop browser validation for Agents, Gateway, and Models across dark/light plus EN/ZH modes after all visual parity worktrees are merged.
- [x] 5.2 Record runtime stack status, route/screenshot evidence, console/error review, and any accepted unavailable-state rationale in `e2e-evidence.md` before archive.
