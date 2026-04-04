## Context

openclaw-deck 的 chat 状态管理使用扁平 Zustand store，所有 session 共用 `messages[]`、`isStreaming`、`error` 等字段。多模态对话功能上线后，session 切换场景暴露出数据竞态、SSE 连接断裂、异步操作跨 session 污染等问题。已通过 4 个 hotfix 缓解症状，但根因（缺少 session 级状态隔离）未解决。

完整设计分析见 `docs/superpowers/specs/2026-03-21-session-scoped-state-design.md`，本文聚焦架构决策和风险。

## Goals / Non-Goals

**Goals:**

- 每个 session 拥有独立的状态容器，消除跨 session 数据污染
- SSE 连接不受 session 切换影响，后台 session 的流式进度持续跟踪
- 所有异步操作可取消，session 淘汰时自动清理
- 为 Tool Progress、Approval、A2UI Canvas、多窗格 UI 预留状态槽位
- 现有 chat 功能零回归

**Non-Goals:**

- 不修改 Gateway 或 API routes
- 不实现 Tool Progress、Approval、A2UI Canvas 的具体 UI（后续提案）
- 不实现多窗格 UI（提案 5）
- 不引入新的外部依赖

## Decisions

### D1: Zustand Map Store（而非独立 Store per Session 或 Event Bus）

**选择**：单一 Zustand store，内部用 `Map<string, SessionState>` 管理所有 session。

**备选方案**：

- 独立 Store per Session + Context 注入：完全隔离但 SSE dispatcher 需持有所有 store 实例引用，打破了 React 树内使用 store 的模式
- Event Bus + Reducer：解耦彻底但引入项目中没有的新范式（event bus + reducer + useSyncExternalStore），维护成本高

**理由**：与现有 Zustand 模式一致，迁移路径清晰；SSE dispatcher 通过 `getState()` 直接访问最新状态；消费方改动最小。

### D2: 单 EventSource + 客户端路由（而非多连接隔离）

**选择**：维持单个 EventSource 连接，所有 session 的事件通过同一连接，客户端按 `payload.sessionKey` 路由到对应 SessionState。

**备选方案**：每个活跃 session 维护独立的 EventSource 连接（或 WebSocket），完全隔离。放弃原因：连接数随 session 数线性增长，Gateway 需支持 session-scoped 订阅（违反"Gateway 零改动"约束），且单连接已满足需求。

**理由**：Gateway 的 SSE 端点已在所有事件中携带 sessionKey，零 Gateway 改动；单连接避免了多连接的管理复杂性和资源开销。

### D3: AbortController 外置于模块级 Map（而非存入 SessionState）

**选择**：`AbortController` 不存储在 Zustand store 中，使用模块级 `Map<string, AbortController>` 独立管理。

**备选方案**：存入 SessionState 并通过 Zustand `partialize` 配置排除序列化。放弃原因：增加了 devtools/persist 配置复杂度，且模块级 Map 更简单直接。

**理由**：AbortController 不可 JSON 序列化，存入 store 会破坏 devtools/persist 中间件。模块级 Map 与 store 生命周期解耦，通过 `getSessionAbort(key)` / `abortSession(key)` 函数访问。

### D4: toolProgress 使用 Record 而非 Map

**选择**：`Record<string, ToolProgress>` 而非 `Map<string, ToolProgress>`。

**理由**：Zustand 默认浅比较使用 `Object.is`，嵌套 Map 的 mutation 不改变引用，不触发 re-render。Record 与 Zustand 不可变性模型和 JSON 序列化天然兼容。

### D5: 附件保留为组件本地状态（而非纳入 SessionState）

**选择**：`PendingAttachment`（文件选择、预览、base64 编码）保留为 `MessageInput` 组件的 local state。

**理由**：不存在跨 session 附件场景；`File` 对象不可序列化；组件级状态更简单。

### D6: setMessages "history-then-append" 策略（而非 ID 去重合并）

**选择**：rehydrate 加载历史时，用历史消息替换全部消息，然后将 SSE 到达的消息（ID 为 runId 格式）追加到末尾。不依赖跨通道 ID 去重，因为 SSE 消息用 `runId` 作 ID，历史消息用 `${sessionKey}:${timestamp}:${index}`，两者格式不同无法去重。

**理由**：防止 rehydrate 与 SSE 事件的竞态丢消息——加载历史的 fetch 是异步的，期间 SSE 事件可能已添加新消息到该 session。按格式区分比按 ID 去重更可靠。

### D7: 渐进式迁移（兼容层过渡）

**选择**：6 步渐进迁移，Step 2 引入兼容层 `getActiveSession()` 桥接旧 API，Step 5 移除。

**理由**：允许逐个组件迁移，每步可独立验证，降低回归风险。

## Risks / Trade-offs

- **[Map 嵌套更新复杂度]** → 所有 store action 必须通过 `set()` 创建新 Map 引用触发 re-render；直接 mutation 静默失败。mitigate: 可选引入 immer middleware。
- **[兼容层遗留风险]** → 如果 Step 5 未及时执行，兼容层可能长期存在。mitigate: Step 5 作为独立任务，完成后删除所有 `getActiveSession()` 调用。
- **[内存增长]** → 缓存过多 session 可能导致内存膨胀。mitigate: LRU 淘汰（5 分钟空闲阈值 + MAX_CACHED_SESSIONS=20 硬上限），估算 10 个 session ≈ 2MB，可接受。淘汰触发点包括：session 切换、新 session 创建超阈值、页面隐藏、流完成（active→idle 转换）。
- **[幽灵 session]** → SSE 事件为未知 session 创建状态但不在侧栏显示。mitigate: 下次 `refreshSessionMeta()` 时出现；不产生用户可见异常。
