## Context

Deck 当前有 14 个硬编码 slash 命令（`SLASH_COMMANDS` 静态数组），执行引擎是一个 `switch` 语句。前一轮工作（`deck-slash-command-coherence`）已修复端到端反馈链路（toast + SessionConfigBar + 乐观更新 + SSE 校正），使这 14 个命令逻辑自洽。

官方 CLI/Web 有四层命令体系：Plugin Commands（运行时动态注册，优先级最高）→ Built-in Commands（70+ 静态注册）→ Skill Commands（工作区扫描发现）→ Agent 兜底。Deck 完全没有后两层。

关键约束：
- 官方命令处理在 auto-reply 层（非 Gateway RPC），但 Gateway 有 `skills.status`、`chat.send` 等可复用的 RPC
- Deck 通过 Protocol SDK typed client (`gw.*`) 调用 Gateway
- 增强 fork 的 Gateway 新代码全部放 `deck/` 目录，与上游零冲突
- Dashboard 遵循零硬编码 i18n 规则（next-intl）

## Goals / Non-Goals

**Goals:**
- G1: 命令注册表从静态数组重构为支持多来源的动态 `CommandRegistry`
- G2: 通过新增 Gateway RPC `deck.commands.discover` 发现后端可用命令
- G3: 命令面板 UI 支持混合来源命令的分类展示和参数补全
- G4: 统一 Local 执行（Zustand action）和 Remote 执行（`chat.send`）的抽象
- G5: 为 Plugin 命令预留类型和 UI 扩展点

**Non-Goals:**
- 不实现 Plugin 命令的完整注册/执行链路（仅预留扩展点）
- 不改造现有 14 个 local 命令为 remote（避免延迟退化）
- 不实现命令别名（中文别名 `/帮助` 等留待后续）
- 不实现组件化结果渲染（`/usage` 返回图表而非文本，留待后续）

## Decisions

### D1: Registry Architecture — Map + Source Tagging

采用 `Map<string, RegisteredCommand>` 实现，每个命令标记 `source`（local / builtin / skill / plugin）和 `execMode`（local / remote）。

**Alternatives considered:**
- **A: 保持静态数组 + 追加**：简单，但无法 O(1) 查找、无冲突检测、无动态注销
- **B: Zustand store 存命令列表**：响应式好，但命令注册表是纯数据结构不需要 React 响应式

选择 Map 因为：O(1) 查找、天然去重、`register()`/`unregister()` 语义清晰。Registry 实例作为模块单例导出，Zustand store 仅存 discovery 版本号触发 re-render。

**Priority 排序**（对齐官方）：plugin (0) > local (10) > builtin (20) > skill (30)。同名冲突时低 priority 值的命令胜出，被覆盖的命令存入 qualified Map 并可通过 `source:name` 限定名访问。当高优先级命令被注销时，qualified 中的最高优先级候选自动 promote 回主 Map。

### D2: Gateway RPC — `deck.commands.discover`

新增 `deck.commands.discover` RPC，接受 `agentId` 参数（默认 main agent），Gateway 侧聚合三个来源：
1. `getChatCommands()` → built-in 命令（70+，含元数据），category 统一映射为 "more"
2. `listSkillCommandsForAgents({ cfg, agentIds: [agentId] })` → 指定 agent 的 skill 命令（内置去重）
3. 已注册 plugin 命令的 invocation keys（当前可能为空）

返回 `{ commands: DiscoverableCommand[], version: string }`, `version` 是命令列表的 hash（含 name + description + args），用于客户端缓存。

**Alternatives considered:**
- **A: 复用 `gateway.describe`**：已有 introspection，但返回的是 RPC 方法列表而非 chat commands，语义不同
- **B: 纯前端硬编码 built-in 列表**：零 Gateway 改动，但无法发现 skill/plugin 命令，且 built-in 列表会与后端版本漂移

选择新增 RPC 因为：语义精确、单一数据源、skill/plugin 命令自动包含。

**SSE 事件**：Gateway handler 通过 `context.broadcast("commands.changed", { version })` 推送变更通知。Dashboard 需要在 event-bus DeckEventType 和 runtime VALID_DECK_EVENTS 中注册新事件类型。客户端 discovery hook 监听该事件后按需重新 discover。

### D3: 执行模型 — Local vs Remote 分流

| 命令类型 | 执行方式 | 反馈机制 |
|---------|---------|---------|
| Local（现有 14 个） | 前端直接执行 | toast + 乐观更新 + SSE 校正 |
| Remote（builtin/skill/plugin） | `chat.send("/{name} {args}")` | toast "已发送" + SSE streaming 返回结果 |

**Alternatives considered:**
- **A: 所有命令统一走 `chat.send`**：架构简单，但 `/new`、`/clear` 等纯 UI 操作不应走网络
- **B: 为每个远程命令实现前端 handler**：体验好（即时反馈），但需为 70+ 命令逐一实现

选择分流因为：local 命令保持已有的低延迟体验，remote 命令复用后端已有的完整 handler pipeline（权限校验、参数验证、错误处理）。

### D4: 命令面板 — 混合来源分组

面板显示策略：
- 默认视图（输入 `/`）：local 命令（4 个 category）+ 前 N 个 skill 命令 + "More..." 折叠入口
- 搜索视图（输入 `/gi`）：跨所有来源 prefix match
- 折叠展开（点击 "More..."）：显示完整 built-in 列表

**Alternatives considered:**
- **A: 全部平铺**：70+ 命令淹没面板，信噪比极低
- **B: 仅显示 local + skill，built-in 不展示**：信息损失，用户不知道还有哪些命令可用

选择折叠因为：local 命令始终可见（高频），skill 命令突出显示（增值），built-in 按需展开（长尾）。

### D5: 参数系统 — 静态 + 动态混合

- **静态 argOptions**：保持现有模式（`["off", "low", "medium", "high"]`），local 命令使用
- **动态 argSchema**：remote 命令可携带 `{ type: "model-id" }` 等 schema，前端按 type 拉取选项
- **Ghost hint**：用户输入 `/model ` 后，输入框灰色显示参数占位符

### D6: 上下文过滤 — Visibility Predicates

Local 命令可携带 `visibleIf` 谓词，面板根据当前 session 状态过滤。例如 `/stop` 仅在 streaming 时显示。

不影响手动输入执行——用户明确输入 `/stop` 时即使未 streaming 也会执行（返回错误提示）。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| Discover RPC 延迟影响面板首次展示 | Local 命令始终立即可用（Phase 1 registry），discover 结果异步追加 |
| 70+ 远程命令淹没面板 | "MORE" 折叠 + prefix search 过滤 |
| Skill/Plugin 命令名与 local 冲突 | Priority 排序（local 优先），冲突时显示 `source:name` 限定名 |
| Gateway 改动增加上游同步成本 | 新代码全部在 `src/gateway/server-methods/deck/` 目录（零上游冲突） |
| Remote 命令无即时反馈 | toast "Command sent" + SSE streaming 结果作为 assistant message |
| `chat.send` 发送命令被当作普通消息处理 | auto-reply 层已有完整的命令匹配 pipeline，`/` 前缀自然触发命令处理 |
