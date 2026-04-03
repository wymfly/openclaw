# Deck Web Replacement Capability / Closure Matrix

> Date: 2026-04-03
> Note: 这是 program baseline，不是完整实现审计。除明确做过审查的区域外，其余状态以保守标记为主。

## Status Legend

- `unassessed`: 尚未做结构化审查
- `partial`: 已有 proposal 或实现，但未达到统一闭环标准
- `platform-first`: 必须先等平台轨能力稳定
- `replacement-ready`: 满足统一闭环标准并通过代表性 workflow validation

## Matrix

| Area                             | Track                           | Phase | Existing Inputs                                                              | Current Closure  | Notes                                                                     |
| -------------------------------- | ------------------------------- | ----- | ---------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------- |
| Chat                             | Session Runtime / Runtime Core  | 2     | `deck-chat-flow-closure`, `session-scoped-state`, `deck-chat-ux-enhancement` | `partial`        | 已完成一轮数据流闭环修正，但仍应纳入 program 级统一平台模型               |
| Approval                         | Session Runtime / Runtime Core  | 2     | `deck-chat-flow-closure`, `openclaw-deck`                                    | `partial`        | 已与 chat 建立闭环方向，但仍需要纳入统一 workflow validation              |
| Canvas / A2UI                    | Session Runtime / Runtime Core  | 2     | `deck-chat-flow-closure`, `deck-canvas-virtual-node`                         | `partial`        | 恢复模型已形成样板，但仍属于高风险 runtime area                           |
| Sessions / Logs                  | Session Runtime / Runtime Core  | 2     | `deck-sessions-logs-hardening`                                               | `platform-first` | 依赖 shared replay / projection / list infra                              |
| Execution Monitor                | Runtime Core                    | 2     | `deck-execution-monitor`                                                     | `unassessed`     | 应视为 runtime-core，而不是普通观察页                                     |
| Agents                           | Config & Control                | 3     | `deck-agent-config-enhancement`                                              | `partial`        | 已有功能提案，但应重新映射到 shared layout / contract / closure checklist |
| Config Editor                    | Config & Control                | 3     | `deck-config-editor-enhancement`, `schema-driven-ui-architecture`            | `partial`        | 强依赖 schema-driven UI 与 typed contract                                 |
| Channels                         | Config & Control                | 3     | `deck-channel-config-framework`                                              | `partial`        | 需要统一 form / validation / status patterns                              |
| Routing / Session Channel        | Config & Control                | 3     | `deck-routing-session-channel`                                               | `unassessed`     | 需要与 session runtime 一起定义权威状态                                   |
| Dynamic Commands                 | Config & Control                | 3     | `deck-dynamic-commands`, `deck-slash-command-coherence`                      | `partial`        | 需要共享 command surface 与执行反馈模型                                   |
| Shared Lists                     | UI Framework                    | 1     | `deck-shared-list-infra`                                                     | `platform-first` | 是多个观察/管理模块的前置依赖                                             |
| Schema-Driven UI                 | UI Framework                    | 1     | `schema-driven-ui-architecture`                                              | `platform-first` | 是 config / channels / plugins 类模块的前置依赖                           |
| Usage                            | Observe & Automate              | 4     | `deck-usage-panel-rebuild`                                                   | `platform-first` | 依赖 shared list / table / typed data contract                            |
| Activity                         | Observe & Automate              | 4     | `openclaw-deck`                                                              | `unassessed`     | 依赖 shared stream / replay / list infra                                  |
| Cron                             | Observe & Automate              | 4     | `openclaw-deck`                                                              | `unassessed`     | 需要 shared list/detail/form infra                                        |
| Webhooks                         | Observe & Automate              | 4     | `openclaw-deck`                                                              | `unassessed`     | 同上                                                                      |
| Skills                           | Observe & Automate              | 4     | `deck-subagent-scheduler-skills`, `openclaw-deck`                            | `unassessed`     | 需要和 commands / config 一起统一交互模型                                 |
| Budget                           | Observe & Automate              | 4     | `openclaw-deck`                                                              | `unassessed`     | 依赖 shared policy / list / detail infra                                  |
| Alerts                           | Observe & Automate              | 4     | `openclaw-deck`                                                              | `unassessed`     | 与 activity / budget 有交叉，需统一验证                                   |
| Gateway Transport / Typed Client | Core Platform                   | 1     | `gateway-protocol-sdk`, `deck-chat-flow-closure`                             | `partial`        | 必须扩展为 program 级共享 transport / contract stack                      |
| Replay / Projection Model        | Core Platform / Session Runtime | 1     | `deck-chat-flow-closure`, `session-scoped-state`                             | `partial`        | 当前主要在 chat 侧形成样板，需平台化推广                                  |
| Shared Shell / Panel Layout      | UI Framework                    | 1     | `openclaw-deck`, `schema-driven-ui-architecture`                             | `partial`        | 需成为所有新模块的统一入口                                                |

## Program Reading

- 当前最成熟的样板在 `chat / approval / canvas` 这一组，但它们仍然只是局部样板，不是 program 级平台能力。
- Track A / B / C 的前置能力如果不先收敛，Track D 中的大量模块会继续重复局部状态、局部 transport、局部 UI 逻辑。
- 后续优先级不应由“哪个 proposal 先写”决定，而应由“哪个模块依赖哪些平台能力”决定。
