## Context

Deck Chat 面板的 15 个 slash 命令在提案 4（deck-chat-ux-enhancement）中实现，后端链路（executor → API route → Gateway RPC）完整。但前端反馈链路存在三类断裂：

1. **配置命令无视觉反馈** — `/fast`、`/think`、`/verbose`、`/model` 修改成功后，聊天面板无任何变化。当前状态仅在 Sessions 侧边栏的 SessionDetail 中可见，用户需切换面板确认。
2. **SessionMeta 字段缺失** — `chat-types.ts` 的 `SessionMeta` 不含 `thinkingLevel`/`fastMode`/`verboseLevel`，聊天面板组件无法读取这些状态。
3. **状态同步机制不健壮** — `patchSession` 成功后返回 `action: "refresh"` 但 handler 是 no-op，完全依赖 SSE 推送；`/stop` 在 abort 失败时仍乐观清除 streaming。

已有基础设施：

- `useNotificationsStore` + `ToastContainer` 已实现但未被 slash 命令使用
- `sessions.changed` SSE 事件已包含配置字段
- `sessions.patch` Gateway RPC 已支持所有配置参数

## Goals / Non-Goals

**Goals:**

- 每个 slash 命令执行后，用户在聊天面板内即可感知结果（成功/失败/状态变化）
- 配置类命令的结果通过两个通道反馈：即时 toast + 持久化状态条
- 状态同步采用乐观更新 + SSE 校正的双保险机制
- 修复所有已知的链路断裂问题（focus no-op、stop 乐观清除、refresh no-op）

**Non-Goals:**

- 不新增 slash 命令（skill/plugin 扩展属于路径 3，不在此范围）
- 不修改 Gateway RPC 或 API route（纯前端修复）
- 不重构 slash 命令注册表架构（保持现有静态数组模式）
- 不实现 focusMode 功能（仅移除空壳命令）

## Decisions

### D1: 乐观更新 + SSE 校正（而非纯 SSE 依赖）

**选择**: `patchSession` 成功后，executor 返回更新后的配置值，caller 立即写入 store；SSE `sessions.changed` 事件到达后以 SSE 值为准覆盖。

**替代方案**: 仅依赖 SSE 推送（当前设计）。
**否决原因**: SSE 存在延迟（网络/重连场景），用户操作后 200ms+ 无反馈是不可接受的。乐观更新使 UI 即时响应，SSE 作为最终一致性校正。

### D2: 复用 useNotificationsStore 而非 system message

**选择**: 命令反馈通过 `addToast()` 展示，不再作为聊天系统消息。

**替代方案**: 继续用 `addSystemMsg()` 在聊天流中插入反馈消息。
**否决原因**: 配置确认（"Fast mode: on"）不是对话内容，插入聊天流污染消息历史。Toast 是瞬态 UI 反馈的正确载体。查询类命令（`/help`、`/usage`、`/agents`）的输出仍保留为 system message。

### D3: SessionConfigBar 放在输入框上方

**选择**: 新增 `SessionConfigBar` 组件，渲染在 MessageInput 上方（消息列表和输入框之间）。

**替代方案 A**: 放在聊天面板顶部标题栏。否决——标题栏空间有限，且距离输入框远，命令执行后视觉关联弱。
**替代方案 B**: 放在 RunStatusBar 中。否决——RunStatusBar 是每条消息级别的元数据，session 配置是 session 级别状态。

### D4: executor 返回 toastMessage 而非 caller 硬编码

**选择**: 扩展 `SlashCommandResult` 增加 `toastMessage` 和 `toastType` 字段，executor 负责生成反馈文本，caller 只负责调用 `addToast()`。

**理由**: 反馈文本与命令逻辑耦合（如 "Fast mode: on" 需要知道设置值），放在 executor 中更内聚。Caller（MessageInput）保持薄层转发。

### D5: SessionMeta 扩展字段来源

**选择**: 从两个数据源填充 SessionMeta 的配置字段：

1. `sessions.list` API 响应（初始加载）
2. `sessions.changed` SSE 事件（运行时同步）

**理由**: 与已有的 `model`、`totalTokens` 字段采用相同模式，无需新增数据通道。

## Risks / Trade-offs

**[乐观更新与 SSE 不一致]** → 极低概率。patchSession 成功意味着 Gateway 已接受变更，SSE 事件只是确认。若 SSE 到达的值与乐观值不同（理论上不应发生），以 SSE 为准自动修正。

**[Toast 与 system message 混用]** → 配置命令用 toast，查询命令用 system message，两种反馈通道并存可能让用户困惑。缓解：toast 用于瞬态确认（3s 消失），system message 用于需要阅读的内容输出，职责清晰。

**[移除 /focus 的向后兼容]** → 用户肌肉记忆可能输入 /focus。缓解：执行后 executor 返回 "Unknown command: /focus" 已是现有兜底行为，无额外处理。
