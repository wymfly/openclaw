# Deck Web Replacement Capability / Closure Matrix

> Date: 2026-04-03 (revised)
> Note: Program baseline. Closure status is conservatively assigned unless a structured review has been completed.

## Status Legend

- `unassessed`: No structured review performed
- `partial`: Proposal or implementation exists, but does not yet meet the unified closure standard
- `platform-first`: Assessed, but blocked on platform-track dependencies stabilizing first
- `replacement-ready`: Meets the unified closure standard and passes representative workflow validation

## Track Legend

Five top-level tracks. Domain Modules has three sub-waves.

- **A — Core Platform**: typed transport, auth, stream, replay, projection, error model
- **B — Session Runtime**: session-scoped state, snapshot, hydrate, history/live merge, recovery
- **C — UI Framework**: shell, shared list, schema-driven form/table, command surface, patterns
- **D — Domain Modules**: business module replacement
  - **D.rc — Runtime Core**: chat, approval, canvas, sessions, logs, execution
  - **D.cc — Config & Control**: agents, config, channels, routing, commands
  - **D.oa — Observe & Automate**: usage, activity, cron, webhooks, skills, budget, alerts
- **E — Replacement Validation**: capability matrix, workflow validation, phase gate, browser tests

## Matrix

| Area                                    | Track | Phase | Priority | Dependency              | Existing Inputs                                                                                    | Current Closure     | Notes                                                                                                                                                                                    |
| --------------------------------------- | ----- | ----- | -------- | ----------------------- | -------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platform Infrastructure**             |       |       |          |                         |                                                                                                    |                     |                                                                                                                                                                                          |
| Gateway Transport / Typed Client        | A     | 1     | P0       | none                    | `gateway-protocol-sdk` design+plan                                                                 | `partial`           | 25/25 deck.\* typed client complete; 6 upstream methods (sessions.usage/steer/get, tools.effective) need result schemas                                                                  |
| Deck Transport / Auth / Stream          | A     | 1     | P0       | none                    | `openclaw-deck`                                                                                    | `replacement-ready` | HTTP gwRequest + Ed25519 device auth + SSE with Last-Event-ID replay + EventBus (26 event types) + deckFetch/deckStream client                                                           |
| Replay / Projection Model               | A + B | 1     | P0       | Gateway Transport       | `deck-chat-flow-closure`, `session-scoped-state`, `deck-projection-platform` (archived)            | `replacement-ready` | Phase 1 complete: generic domain-keyed API, approval extraction, gap detection. Phase 2 deferred: HTTP endpoints, domain catch-up, transport-layer lastEventId                           |
| Deck Server Persistence                 | A     | 1     | P1       | Gateway Transport       | `openclaw-deck`                                                                                    | `replacement-ready` | sql.js WASM SQLite + 8 migrations + ProjectionStore (outbox + settings + chat projection) + EventBus integration + run-event-store                                                       |
| Shared Error / Mutation Model           | A     | 1     | P1       | Gateway Transport       | none                                                                                               | `partial`           | ErrorBody + gwRequest exception handling + optimistic update patterns; missing unified error codes, rollback API                                                                         |
| **Session Runtime**                     |       |       |          |                         |                                                                                                    |                     |                                                                                                                                                                                          |
| Session-Scoped State                    | B     | 1     | P0       | Replay/Projection       | `session-scoped-state`                                                                             | `replacement-ready` | Phase 1 complete: Map store + SSE dispatcher + lifecycle + projection.gap recovery + visibilitychange eviction. Phase 2 deferred: multi-pane UI                                          |
| **UI Framework**                        |       |       |          |                         |                                                                                                    |                     |                                                                                                                                                                                          |
| Shared Shell / Panel Layout             | C     | 1     | P1       | none                    | `openclaw-deck`, `schema-driven-ui-architecture`                                                   | `partial`           | Shell + NavRail + 25 panels functional; registration hardcoded (5 touch points); PanelRegistry refactor deferred                                                                         |
| Shared Lists                            | C     | 1     | P0       | none                    | `deck-shared-list-infra`                                                                           | `replacement-ready` | G3 passed; 4 panels adopted (Usage×2, Sessions×2); 36/36 tasks complete                                                                                                                  |
| Schema-Driven UI                        | C     | 1     | P1       | Shared Lists            | `schema-driven-ui-architecture`                                                                    | `platform-first`    | Proposal complete (0/45 tasks); Config Editor self-built SchemaForm covers current needs; RJSF/TanStack not installed                                                                    |
| **Domain Modules — Runtime Core**       |       |       |          |                         |                                                                                                    |                     |                                                                                                                                                                                          |
| Chat                                    | D.rc  | 2     | P0       | A, B, C                 | `deck-chat-flow-closure`, `session-scoped-state`, `deck-chat-ux-enhancement`, `deck-chat-whitebox` | `replacement-ready` | Phase 2 P0+P1 complete: status badge, SSE banner, config toggles, session rename/search, stream failure indicator, nested tool results                                                   |
| Approval                                | D.rc  | 2     | P0       | A, B                    | `deck-chat-flow-closure`, `openclaw-deck`                                                          | `replacement-ready` | Phase 2 P0+P1 complete: SLC-3 fix, countdown timer, security metadata, loading state, client-side expiry cleanup                                                                         |
| Canvas / A2UI                           | D.rc  | 2     | P1       | A, B                    | `deck-chat-flow-closure`, `deck-canvas-virtual-node` plan                                          | `replacement-ready` | Full A2UI bridge + SSE pipeline + block filters + debug tree tab + integration tests                                                                                                     |
| Sessions / Logs                         | D.rc  | 2     | P1       | A, B, C                 | `deck-sessions-logs-hardening`                                                                     | `replacement-ready` | G3 passed (18/18); shared-list-infra adopted; 4 capabilities: advanced search, session patch, incremental logs, ring buffer                                                              |
| Execution Monitor                       | D.rc  | 2     | P2       | A, B                    | `deck-execution-monitor`                                                                           | `replacement-ready` | Timeline + Waterfall + FileChanges + ModelStats + SubagentTree; 7-day retention; no CLI equivalent (first-of-kind UI)                                                                    |
| **Domain Modules — Config & Control**   |       |       |          |                         |                                                                                                    |                     |                                                                                                                                                                                          |
| Agents                                  | D.cc  | 3     | P0       | C                       | `deck-agent-config-enhancement`, `deck-agent-routing-observability`, `deck-agent-workspace`        | `replacement-ready` | config-enhancement G3 + workspace complete; 7-tab detail (Overview/Config/Routing/Skills/Context/Subagent/Sessions); 100% typed client; routing-observability advanced features deferred |
| Config Editor                           | D.cc  | 3     | P1       | C                       | `deck-config-editor-enhancement`, `deck-config-enhancement`, `schema-driven-ui-architecture`       | `replacement-ready` | Schema-driven form (Union/Record/Array), conflict detection, diff preview, advanced search, i18n complete; all tasks done                                                                |
| Channels                                | D.cc  | 3     | P1       | C                       | `deck-channel-config-framework`                                                                    | `replacement-ready` | Schema-driven config, probe, account mgmt (enable/disable/logout), DM policy, retry strategy; 90% CLI coverage; OAuth + plugin install deferred                                          |
| Routing / Session Channel               | D.cc  | 3     | P2       | B                       | `deck-routing-session-channel`                                                                     | `partial`           | Condition editor + drag-sort + conflict detection + scope strategy complete; missing session cleanup, rule validation                                                                    |
| Dynamic Commands                        | D.cc  | 3     | P1       | A                       | `deck-dynamic-commands`, `deck-slash-command-coherence`                                            | `replacement-ready` | CommandRegistry + discover RPC + SSE sync + 13 local cmds + remote exec + SessionConfigBar; dual-branch experiment complete                                                              |
| **Domain Modules — Observe & Automate** |       |       |          |                         |                                                                                                    |                     |                                                                                                                                                                                          |
| Usage                                   | D.oa  | 4     | P1       | C                       | `deck-usage-panel-rebuild`                                                                         | `replacement-ready` | 7/7 OpenSpec tasks done; multi-dim aggregation (model/provider/agent/channel), session drill-down, latency monitoring                                                                    |
| Activity                                | D.oa  | 4     | P2       | C                       | `openclaw-deck`                                                                                    | `platform-first`    | Basic event timeline exists; missing multiple event types; Gateway activity event spec not frozen                                                                                        |
| Cron                                    | D.oa  | 4     | P2       | C                       | `openclaw-deck`                                                                                    | `partial`           | Job CRUD + run history + immediate run complete; heartbeat config is stub (Gateway RPC pending)                                                                                          |
| Webhooks                                | D.oa  | 4     | P2       | C                       | `openclaw-deck`                                                                                    | `partial`           | UI 100% complete (CRUD + delivery history + test); Gateway trigger mechanism unconfirmed                                                                                                 |
| Skills                                  | D.oa  | 4     | P2       | D.cc                    | `deck-subagent-scheduler-skills`, `openclaw-deck`                                                  | `replacement-ready` | Standalone SkillsPanel + install/uninstall/update + config editor + compatibility matrix; Gateway RPC integrated                                                                         |
| Budget                                  | D.oa  | 4     | P2       | C                       | `openclaw-deck`                                                                                    | `replacement-ready` | Full CRUD + multi-scope (global/agent/task) + period (daily/weekly/monthly) + threshold evaluation; SQLite backend                                                                       |
| Alerts                                  | D.oa  | 4     | P2       | D.oa (Activity, Budget) | `openclaw-deck`                                                                                    | `replacement-ready` | Rule CRUD + fired history + enable/disable + cooldown + multi-action (toast/activity/webhook); SQLite backend                                                                            |
| **Additional Modules**                  |       |       |          |                         |                                                                                                    |                     |                                                                                                                                                                                          |
| Models Hub                              | D.cc  | 3     | P2       | A                       | `openclaw-deck`                                                                                    | `partial`           | Catalog/Fallback/Usage complete; missing OAuth interactive login, model scan/discovery, aliases management                                                                               |
| Onboarding                              | D.rc  | 2     | P2       | C                       | none                                                                                               | `replacement-ready` | 3-step wizard (Connection → Provider → FirstChat); status detection API; conditional rendering                                                                                           |
| Settings                                | D.cc  | 3     | P2       | C                       | none                                                                                               | `replacement-ready` | Appearance + Connection + Notification + About sections; theme/language switch; connection test; full API                                                                                |
| **Replacement Validation**              |       |       |          |                         |                                                                                                    |                     |                                                                                                                                                                                          |
| Capability Coverage Gate                | E     | 1-5   | P0       | all tracks              | `deck-web-replacement-program`                                                                     | `partial`           | Matrix established (30 areas tracked); missing automated coverage validation script                                                                                                      |
| Workflow Validation                     | E     | 2-5   | P1       | D.rc, D.cc              | `deck-web-replacement-program`                                                                     | `partial`           | Playwright configured + 5 E2E specs (navigation, onboarding, settings, doc-hub, models); P0 module workflow specs needed                                                                 |
| Browser Functional Tests                | E     | 5     | P2       | all D.\*                | none                                                                                               | `unassessed`        | Phase 5 deliverable; Playwright infra ready; final acceptance suite not yet planned                                                                                                      |

## Gateway Capability Coverage Baseline

> Established: 2026-04-04

覆盖口径定义：Gateway 方法族按 `src/gateway/server-methods/` 下的文件分组（逻辑相关的文件合并为一个族）。

覆盖等级：

- **Covered**: Deck 通过 typed `gwRequest` 调用了该方法族中所有用户可见的方法，且有对应的 UI 入口
- **Functional**: Deck 通过 untyped `gatewayRequest` 提供了完整 UI 功能，但尚未迁移到 typed client
- **Partial**: 部分方法已覆盖，但有缺口（见 Notes）
- **N/A**: 不适用于 Web Dashboard（CLI-only / 语音 / 基础设施）

覆盖率统计（仅计 Deck-relevant 方法族，排除 N/A）：

| 等级                 |  数量  | 占比 |
| -------------------- | :----: | :--: |
| Covered (typed)      |   7    | 32%  |
| Functional (untyped) |   11   | 50%  |
| Partial              |   4    | 18%  |
| **合计**             | **22** |      |

Phase 5 门槛：所有 P0 方法族 ≥ Functional，P1 ≥ Partial。**当前状态：P0 11/11 ✅，P1 8/8 ✅**。

### P0 — Core（必须 Covered 或 Functional）

| #   | Method Family  | Source File(s)                                | Methods | Coverage   | Via                  | Notes                                                                                                                                              |
| --- | -------------- | --------------------------------------------- | :-----: | ---------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | deck.agents    | `deck/agents.ts` `deck/agents-preview.ts`     |    9    | Covered    | typed gwRequest      | detail, skills.get/set, subagents.get/set, eventStreams.get/set, toolPolicy.preview, systemPrompt.preview                                          |
| 2   | deck.subagents | `deck/subagents.ts` `deck/subagents-steer.ts` |    4    | Covered    | typed gwRequest      | list, kill, lineage, steer                                                                                                                         |
| 3   | deck.routing   | `deck/routing.ts`                             |    5    | Covered    | typed gwRequest      | list, add, remove, validate, simulate                                                                                                              |
| 4   | deck.commands  | `deck/commands.ts`                            |    1    | Covered    | typed gwRequest      | discover                                                                                                                                           |
| 5   | deck.identity  | `deck/identity.ts`                            |    3    | Covered    | typed gwRequest      | list, link, unlink                                                                                                                                 |
| 6   | deck.threads   | `deck/threads.ts`                             |    1    | Covered    | typed gwRequest      | list                                                                                                                                               |
| 7   | deck.auth      | `deck-auth.ts`                                |    2    | Covered    | typed gwRequest      | overview, probe                                                                                                                                    |
| 8   | chat           | `chat.ts`                                     |    3    | Functional | gatewayRequest       | history, send, abort — typed client 已定义但 API routes 仍走 untyped                                                                               |
| 9   | sessions       | `sessions.ts`                                 |   15    | Functional | gatewayRequest + SSE | list/create/delete/patch/reset/clear/compact/abort/steer via gatewayRequest; subscribe/unsubscribe via SSE EventBus; send/preview 由 chat 路径代替 |
| 10  | config         | `config.ts`                                   |    6    | Functional | gatewayRequest       | get, patch, apply, schema, schema.lookup — 全部通过 API routes 调用                                                                                |
| 11  | agents (core)  | `agents.ts`                                   |    7    | Functional | gatewayRequest       | list, create, update, delete, files.list/get/set + agent.identity.get                                                                              |

### P1 — Extended（必须 ≥ Partial）

| #   | Method Family  | Source File(s)                            | Methods | Coverage   | Via            | Notes                                                                                                                   |
| --- | -------------- | ----------------------------------------- | :-----: | ---------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 12  | channels       | `channels.ts`                             |    2    | Functional | gatewayRequest | status (with/without probe), logout                                                                                     |
| 13  | models         | `models.ts` `models-catalog-providers.ts` |    3    | Functional | gatewayRequest | list, configured, catalog.providers                                                                                     |
| 14  | cron           | `cron.ts`                                 |    7    | Functional | gatewayRequest | list, add, update, remove, run, runs, status — 全部覆盖                                                                 |
| 15  | usage          | `usage.ts` + sessions.usage.\*            |    5    | Functional | gatewayRequest | usage.status, usage.cost, sessions.usage, sessions.usage.logs, sessions.usage.timeseries                                |
| 16  | tools          | `tools-catalog.ts`                        |    2    | Functional | gatewayRequest | tools.catalog, tools.effective                                                                                          |
| 17  | exec-approvals | `exec-approvals.ts` `exec-approval.ts`    |    7    | Partial    | gatewayRequest | approvals.get/set + approval.resolve 已覆盖; request/waitDecision 是 CLI session 内部方法，Deck 通过 SSE 事件处理审批流 |
| 18  | skills         | `skills.ts`                               |    4    | Partial    | gatewayRequest | status, install, update 已覆盖; bins 未调用（Deck 直接使用 skills.status 返回的数据）                                   |
| 19  | logs           | `logs.ts`                                 |    1    | Functional | gatewayRequest | logs.tail — ExecMon 使用                                                                                                |

### P2 — Infrastructure

| #   | Method Family   | Source File(s) | Methods | Coverage | Notes                                                           |
| --- | --------------- | -------------- | :-----: | -------- | --------------------------------------------------------------- |
| 20  | health / status | `health.ts`    |    2    | Partial  | health + status 用于 Gateway 连接检测                           |
| 21  | agent (core)    | `agent.ts`     |    3    | Partial  | agent.identity.get 已覆盖; agent/agent.wait 是 CLI session 方法 |
| 22  | doctor          | `doctor.ts`    |    1    | Partial  | doctor.memory.status — Settings 面板可扩展                      |

### N/A — Not Applicable to Web Dashboard（12 族）

| Method Family     | Source File(s)            | Methods | Reason                                    |
| ----------------- | ------------------------- | :-----: | ----------------------------------------- |
| tts               | `tts.ts`                  |    6    | 语音合成，CLI/App 独有                    |
| talk              | `talk.ts`                 |    3    | 语音对话，CLI/App 独有                    |
| voicewake         | `voicewake.ts`            |    2    | 语音唤醒，CLI/App 独有                    |
| wizard            | `wizard.ts`               |    4    | CLI 初始化向导                            |
| send              | `send.ts`                 |    1    | CLI 直接发送消息                          |
| update            | `update.ts`               |    1    | CLI 自更新                                |
| browser           | `browser.ts`              |    1    | 浏览器代理                                |
| nodes             | `nodes.ts`                |   15    | 节点配对/管理; Deck 使用 Ed25519 设备认证 |
| devices           | `devices.ts`              |    6    | 设备配对; 同上                            |
| secrets           | `secrets.ts`              |    2    | 运行时密钥管理，内部基础设施              |
| connect           | `connect.ts`              |    3    | 心跳/唤醒，内部基础设施                   |
| system / describe | `system.ts` `describe.ts` |    4    | Gateway 自省，内部基础设施                |

### Coverage Improvement Path

将 Functional → Covered 的路径（非 P0 阻塞项，可渐进推进）：

1. **补齐 result schema**：6 个上游方法（sessions.usage/steer/get, tools.effective 等）需要 result schema 才能进入 typed client
2. **迁移 API routes**：将 Functional 级别的 11 个方法族从 `gatewayRequest` 迁移到 typed `gwRequest`，逐族执行
3. **优先级**：chat → sessions → config → agents(core) → 其余 P1 族

## Retrospective Phase Gate Reviews

> Established: 2026-04-04
> All phases reviewed retrospectively in a single pass. Prior phases had no formal gate review executed.

Definition of Done checklist (from program-plan.md Section 5):

1. **Cap** — Capability coverage: Gateway 方法族覆盖边界已明确
2. **Contract** — Authoritative contract: Deck route / typed client / result model 已明确
3. **Hydrate** — Hydration path: 冷启动获得权威快照
4. **Sync** — Runtime sync: SSE/EventBus 实时更新进入同一真源
5. **H-L** — History-live consistency: 历史态与实时态一致
6. **Recovery** — 刷新、重连后状态可恢复
7. **Quality** — Shared interaction quality: loading/error/empty/mutation feedback
8. **Security** — XSS/CSRF 防护、键盘可达
9. **Valid** — 有契约验证、模块测试、至少一条工作流验证

Legend: ✅ = met, ⚠️ = met with known gap (noted), ➖ = not applicable to this module type

### Phase 1 Gate: Platform Kernel

| Module                         | Cap | Contract | Hydrate | Sync | H-L | Recovery | Quality | Security | Valid | Gate |
| ------------------------------ | :-: | :------: | :-----: | :--: | :-: | :------: | :-----: | :------: | :---: | :--: |
| Deck Transport / Auth / Stream | ✅  |    ✅    |   ➖    |  ✅  | ➖  |    ✅    |   ➖    |    ✅    |  ⚠️   | PASS |
| Replay / Projection Model      | ✅  |    ✅    |   ✅    |  ✅  | ✅  |    ✅    |   ➖    |    ✅    |  ⚠️   | PASS |
| Deck Server Persistence        | ✅  |    ✅    |   ✅    |  ✅  | ➖  |    ✅    |   ➖    |    ✅    |  ⚠️   | PASS |
| Session-Scoped State           | ✅  |    ✅    |   ✅    |  ✅  | ✅  |    ✅    |   ➖    |    ✅    |  ⚠️   | PASS |
| Shared Lists                   | ✅  |    ✅    |   ➖    |  ➖  | ➖  |    ➖    |   ✅    |    ✅    |  ✅   | PASS |

Phase 1 notes:

- Platform modules (Transport/Projection/Persistence/Session-Scoped) mark UI-specific criteria (Quality/H-L) as ➖ because they are consumed by domain modules, not end-user UI
- ⚠️ Valid: Platform modules have unit tests but lack dedicated E2E workflow specs (covered indirectly through domain module workflows)
- Shared Lists passed G3 with 36/36 tasks and 4 adopters — full validation

**Phase 1 Gate: PASS (5/5 modules, with Valid gap noted)**

### Phase 2 Gate: Runtime Core

| Module            | Cap | Contract | Hydrate | Sync | H-L | Recovery | Quality | Security | Valid | Gate |
| ----------------- | :-: | :------: | :-----: | :--: | :-: | :------: | :-----: | :------: | :---: | :--: |
| Chat              | ✅  |    ✅    |   ✅    |  ✅  | ✅  |    ✅    |   ✅    |    ✅    |  ⚠️   | PASS |
| Approval          | ✅  |    ✅    |   ✅    |  ✅  | ✅  |    ✅    |   ✅    |    ✅    |  ⚠️   | PASS |
| Canvas / A2UI     | ✅  |    ✅    |   ✅    |  ✅  | ✅  |    ✅    |   ✅    |    ✅    |  ✅   | PASS |
| Sessions / Logs   | ✅  |    ✅    |   ✅    |  ✅  | ✅  |    ✅    |   ✅    |    ✅    |  ✅   | PASS |
| Execution Monitor | ✅  |    ✅    |   ✅    |  ✅  | ✅  |    ✅    |   ✅    |    ✅    |  ⚠️   | PASS |
| Onboarding        | ✅  |    ✅    |   ✅    |  ➖  | ➖  |    ✅    |   ✅    |    ✅    |  ⚠️   | PASS |

Phase 2 notes:

- Chat/Approval went through deck-chat-flow-closure G3 + deck-chat-ux-enhancement G3 — comprehensive review
- Canvas passed 23/23 plan tasks with integration tests
- Sessions/Logs passed G3 18/18 with shared-list-infra adoption
- ⚠️ Valid (Chat/Approval/ExecMon/Onboarding): Module tests exist; dedicated Playwright workflow specs pending (task 5.2)
- Onboarding: Sync/H-L marked ➖ — one-time wizard with no persistent state to sync

**Phase 2 Gate: PASS (6/6 modules, workflow validation gaps in 5.2 backlog)**

### Phase 3 Gate: Config & Control

| Module           | Cap | Contract | Hydrate | Sync | H-L | Recovery | Quality | Security | Valid | Gate |
| ---------------- | :-: | :------: | :-----: | :--: | :-: | :------: | :-----: | :------: | :---: | :--: |
| Agents           | ✅  |    ✅    |   ✅    |  ✅  | ✅  |    ✅    |   ✅    |    ✅    |  ✅   | PASS |
| Config Editor    | ✅  |    ✅    |   ✅    |  ✅  | ✅  |    ✅    |   ✅    |    ✅    |  ✅   | PASS |
| Channels         | ✅  |    ✅    |   ✅    |  ✅  | ✅  |    ✅    |   ✅    |    ✅    |  ⚠️   | PASS |
| Dynamic Commands | ✅  |    ✅    |   ✅    |  ✅  | ✅  |    ✅    |   ✅    |    ✅    |  ⚠️   | PASS |
| Settings         | ✅  |    ✅    |   ✅    |  ➖  | ➖  |    ✅    |   ✅    |    ✅    |  ⚠️   | PASS |

Phase 3 notes:

- Agents: G3 + workspace + 7-tab detail + 100% typed client — strongest in this phase
- Config Editor: G3 + schema-driven form + conflict detection + diff preview
- ⚠️ Valid (Channels/DynCmds/Settings): Module tests exist; dedicated Playwright specs pending
- Settings: Sync/H-L marked ➖ — user preferences with simple CRUD, no streaming state

**Phase 3 Gate: PASS (5/5 modules)**

### Phase 4 Gate: Observe & Automate

| Module | Cap | Contract | Hydrate | Sync | H-L | Recovery | Quality | Security | Valid | Gate |
| ------ | :-: | :------: | :-----: | :--: | :-: | :------: | :-----: | :------: | :---: | :--: |
| Usage  | ✅  |    ✅    |   ✅    |  ➖  | ➖  |    ✅    |   ✅    |    ✅    |  ✅   | PASS |
| Skills | ✅  |    ✅    |   ✅    |  ✅  | ➖  |    ✅    |   ✅    |    ✅    |  ⚠️   | PASS |
| Budget | ✅  |    ✅    |   ✅    |  ➖  | ➖  |    ✅    |   ✅    |    ✅    |  ⚠️   | PASS |
| Alerts | ✅  |    ✅    |   ✅    |  ➖  | ➖  |    ✅    |   ✅    |    ✅    |  ⚠️   | PASS |

Phase 4 notes:

- Usage: 7/7 OpenSpec tasks + shared-list-infra adoption — full validation
- Sync/H-L marked ➖ for Usage/Budget/Alerts — query-based reporting modules with no streaming state to sync
- Skills: SSE sync for install status → Sync ✅; historical skill state not meaningful → H-L ➖
- ⚠️ Valid (Skills/Budget/Alerts): Basic tests via store/component tests; dedicated Playwright specs pending

**Phase 4 Gate: PASS (4/4 modules)**

### Gate Review Summary

| Phase                       | Modules | Result   | Key Gap                                                                    |
| --------------------------- | :-----: | -------- | -------------------------------------------------------------------------- |
| Phase 1: Platform Kernel    |   5/5   | **PASS** | Platform modules lack dedicated E2E specs (covered via domain modules)     |
| Phase 2: Runtime Core       |   6/6   | **PASS** | Chat/Approval/ExecMon/Onboarding need Playwright workflow specs (task 5.2) |
| Phase 3: Config & Control   |   5/5   | **PASS** | Channels/DynCmds/Settings need Playwright workflow specs                   |
| Phase 4: Observe & Automate |   4/4   | **PASS** | Skills/Budget/Alerts need Playwright workflow specs                        |

**共性缺口**：20 个 replacement-ready 模块中，12 个在 criterion 9 (Validation) 标记 ⚠️，原因统一：有模块测试但缺少 Playwright 端到端工作流验证。此缺口已追踪在 tasks.md 5.2 中，是 Phase 5 (Replacement Gate) 的核心交付物。

## Change Multi-Track Classification Rule

一个 change 的 **primary track** 只有一个，用于 matrix 排序和依赖管理。但一个 change 可以作为 **input** 出现在多个 area 的 Existing Inputs 列中，表示该 change 为多个 area 提供了设计样板或部分实现。

示例：`deck-chat-flow-closure` 的 primary track 是 `B — Session Runtime`，但它同时作为 input 出现在 Chat（D.rc）和 Replay/Projection（A+B）中。

## Program Reading

- 当前最成熟的样板在 Chat / Approval / Canvas 这一组，但它们仍然只是局部样板，不是 program 级平台能力。
- Track A / B / C 的前置能力如果不先收敛，Track D 中的大量模块会继续重复局部状态、局部 transport、局部 UI 逻辑。
- 后续优先级不应由"哪个 proposal 先写"决定，而应由"哪个模块依赖哪些平台能力"决定。
