# Deck Protocol-Driven Architecture Design

> Deck (Dashboard) 从硬编码依赖转向协议驱动架构，减少上游同步成本，保持类型安全。

## 设计决策总览

| 维度          | 决策                                           | 理由                                |
| ------------- | ---------------------------------------------- | ----------------------------------- |
| Session API   | 完整迁移到 `sessions.*` + subscribe            | 消除 `chat.*` 桥接，获得实时推送    |
| Allowlist     | 运行时从 `gateway.describe` 动态发现           | 零维护，新方法自动可用              |
| SSE 事件      | 分层模型（Deck 自有硬编码 + Gateway 透传动态） | 职责清晰，透传层零维护              |
| describe 缓存 | 启动加载 + 5 分钟定期刷新                      | 简单可靠，fallback 到静态 allowlist |
| Typed client  | 双通道（typed codegen + raw 逃生舱）           | 95% typed 安全 + 5% 动态过渡        |
| 同步策略      | 按需同步，质量优先                             | 协议驱动降低成本但不妥协验证        |

## 问题根源

每次上游同步的痛苦本质：Deck 在本地复制了 Gateway 的知识，每次上游更新就需要手动同步这些复制品。

| 痛点               | 根因                                 |
| ------------------ | ------------------------------------ |
| Allowlist 手动维护 | Deck 硬编码了"我知道有哪些 RPC 方法" |
| SSE 事件硬编码     | 新增事件类型必须改代码才能处理       |
| chat.send 桥接层   | Deck 绕过了上游原生 session API      |

Config schema 已经是协议驱动的（成功样本），Session 桥接已部分完成（`sessions.steer` + `sessions.abort` 已在用）。

核心理念：**Deck 不应该"知道" Gateway 有什么，而是"问" Gateway 有什么。**

---

## Phase 1a: DescribeCache + 动态 Allowlist + Raw 通道

> 与 Phase 1b 可并行，互不依赖。

### DescribeCache

新增 `dashboard/server/describe-cache.ts`，封装 `gateway.describe` 调用和缓存。

**接口**：

```typescript
interface MethodMeta {
  name: string;
  scope: string; // "operator.read" | "operator.write" | "operator.admin"
  since?: string;
  hasParams: boolean;
  hasResult: boolean;
}

interface EventMeta {
  name: string;
  since?: string;
}

class DescribeCache {
  private methods: Map<string, MethodMeta>;
  private events: Map<string, EventMeta>;
  private schemaVersion: string;
  private refreshTimer: ReturnType<typeof setInterval> | null;

  async init(): Promise<void>; // 启动时调用 gateway.describe()（不需要 includeSchemas）
  refresh(): Promise<void>; // 定期刷新（默认 5 分钟）
  getMethods(): Map<string, MethodMeta>;
  getEvents(): Map<string, EventMeta>;
  hasMethod(name: string): boolean; // 替代 allowlist 的 has() 检查
  stop(): void; // 清理定时器
}
```

**生命周期**：

- `dashboard/server/runtime.ts` 的 `initRuntime()` 中初始化
- Gateway 连接建立后立即 `init()`
- `setInterval` 每 5 分钟 `refresh()`
- Gateway 断线重连后立即触发一次 `refresh()`

**容错**：

- `init()` 失败：fallback 到 codegen 生成的静态方法名列表（确保 Gateway 暂时不可用时 Deck 仍能启动）
- `refresh()` 失败：保留上次缓存，不中断服务
- fallback 数据源来自最近一次 `protocol:gen:ts` 的快照（codegen 时同时写入一份方法名列表）

### 动态 Allowlist

改造 `dashboard/server/gateway-allowlist.ts`：

**当前**：

```typescript
const GENERATED_METHOD_ALLOWLIST = new Set([
  /* 140+ methods */
]);
const EXTRA_METHODS = new Set([
  /* 手工补充 */
]);
export const DEFAULT_METHOD_ALLOWLIST = new Set([...GENERATED_METHOD_ALLOWLIST, ...EXTRA_METHODS]);
```

**改为**：

```typescript
import { getDescribeCache } from "./describe-cache.js";
import { STATIC_METHOD_FALLBACK } from "../types/gateway-protocol.generated.js";

export function isMethodAllowed(method: string): boolean {
  const cache = getDescribeCache();
  if (cache.isReady()) {
    return cache.hasMethod(method);
  }
  // Gateway 不可用时 fallback 到静态列表
  return STATIC_METHOD_FALLBACK.has(method);
}
```

改造 `dashboard/server/gateway-adapter.ts` 的 `request()` 方法（约 L263）：

- 当前：`methodAllowlist.has(method)` 检查静态 Set
- 改为：`isMethodAllowed(method)` 查询 DescribeCache

### Raw 通道

扩展 `GatewayClient` 接口（codegen 生成）：

```typescript
interface GatewayClient {
  // ... 现有 typed 方法（codegen 生成，编译时类型安全）

  /** 动态发现的新方法，无类型但经过 allowlist 门控 */
  raw: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
}
```

`createGatewayClient()` 中 `raw` 实现直接调用 `requestFn(method, params)`，绕过类型检查但仍经过 `isMethodAllowed()` 门控。

消费示例：

```typescript
// typed（编译时安全，日常开发）
const sessions = await gw.sessions.list({ agentId: "main" });

// raw（动态发现的新方法，过渡期使用）
const result = await gw.raw("some.new.method", { key: "value" });
```

### Codegen 产出调整

`pnpm protocol:gen:ts` 产出从"allowlist + types"收窄为：

- **保留**：`gateway-protocol.generated.ts`（类型定义）、`gateway-client.generated.ts`（typed client 接口 + raw 通道）
- **新增**：`STATIC_METHOD_FALLBACK` — 方法名 Set，仅用于 DescribeCache 不可用时的 fallback
- **移除**：`GENERATED_METHOD_ALLOWLIST` 的运行时门控角色（被 DescribeCache 替代）
- `protocol:gen:check` CI 检查保留

---

## Phase 1b: SSE 事件分层架构

> 与 Phase 1a 可并行，互不依赖。

### 事件类型分层

改造 `dashboard/server/event-bus.ts`，将单一 `DeckEventType` union 拆为两层：

**Deck 自有事件（硬编码，生命周期由 Deck 控制）**：

```typescript
type DeckOwnedEvent =
  | "approval.pending"
  | "approval.resolved"
  | "budget.warn"
  | "budget.exceeded"
  | "runtime.status"
  | "command.result";
// ... 其他 Deck 内部生产的事件
```

**Gateway 透传事件（动态，从 DescribeCache.getEvents() 获取）**：

```typescript
// 不硬编码，运行时为 string
// 包括 "session.message" | "session.tool" | "sessions.changed" | ...
```

### EventBus 改造

```typescript
class EventBus {
  // Deck 自有事件（类型安全）
  broadcast(type: DeckOwnedEvent, data: DeckEventData): void;

  // Gateway 透传事件（动态，data 为 unknown）
  broadcastPassthrough(type: string, data: unknown): void;

  // 订阅统一接口，handler 接收 { type: string, data: unknown }
  subscribe(handler: (event: ServerEvent) => void): () => void;
}
```

两层事件在 `subscribe` 侧统一为 `ServerEvent`，前端不感知分层。

### Gateway 事件透传管道

改造 `dashboard/server/gateway-adapter.ts` 中的 WebSocket 事件处理：

**当前**：

```typescript
const SESSION_EVENT_MAP = {
  /* 3 个硬编码映射 */
};
// 收到事件 → 查 map → broadcast(mappedType, data)
```

**改为**：

```typescript
// 收到 Gateway WebSocket 事件
function onGatewayEvent(eventName: string, data: unknown) {
  const cache = getDescribeCache();
  if (cache.isReady() && cache.getEvents().has(eventName)) {
    getEventBus().broadcastPassthrough(eventName, data);
  }
  // 未知事件静默忽略
}
```

不再需要 `SESSION_EVENT_MAP`。Gateway 事件名直接透传。

如果 DescribeCache 尚未就绪（启动早期），使用 codegen 生成的 `STATIC_EVENT_FALLBACK` 作为 fallback（与 Phase 1a 的 `STATIC_METHOD_FALLBACK` 机制一致，均由 `protocol:gen:ts` 生成快照）。

### 前端 SSE 消费

`dashboard/src/app/api/stream/route.ts` 的 SSE 帧直接使用事件名字符串：

```
event: session.message
data: {"sessionKey":"abc","message":{...}}

event: approval.pending
data: {"id":"xyz","tool":"bash",...}
```

前端通过 `EventSource.addEventListener(eventName, handler)` 按需监听。未注册 handler 的事件由 `EventSource` 原生静默忽略。

---

## Phase 2: Session API 完整迁移

> 依赖 Phase 1a（DescribeCache 为新方法提供 allowlist）和 Phase 1b（事件分层为消息推送提供管道）。

### 迁移范围

| 当前调用                | 迁移目标             | 位置                          |
| ----------------------- | -------------------- | ----------------------------- |
| `chat.history`          | `sessions.preview`   | `/api/chat/snapshot/route.ts` |
| `chat.send`（如有残留） | `sessions.send`      | 已迁移到 `sessions.steer`     |
| `sessions.steer`        | 保留（上游正式 API） | `/api/stream/route.ts`        |
| `sessions.abort`        | 保留                 | `/api/chat/abort`             |

### 消息推送：从轮询到订阅

**当前**：前端轮询 `/api/chat/snapshot` 获取消息历史。

**迁移到订阅模式**：

```
Deck Server 启动时：
  gateway-adapter 对活跃会话调用 sessions.messages.subscribe({ key })
  Gateway 通过 WebSocket 推送 session.message / session.tool 事件
  事件经 Phase 1b 透传管道 → EventBus → SSE → 前端

会话生命周期管理：
  用户打开会话 → subscribe
  用户切换会话 → unsubscribe 旧 + subscribe 新
  用户关闭页面 → SSE 断开 → 检测无活跃订阅者 → unsubscribe
```

全局会话列表通过 `sessions.subscribe` 订阅 `sessions.changed` 事件，替代轮询刷新。

### 会话创建流程

**当前**：前端调用 `/api/chat/send`，由 `sessions.steer` 隐式创建/复用会话。

**迁移到显式流程**：

```
用户点击"新会话"
  → POST /api/chat/sessions/create → sessions.create({ agentId, label?, model? })
  → 返回 { key, sessionId }
  → 自动 subscribe 该会话
  → 前端进入会话视图

用户发送消息
  → POST /api/stream → sessions.send({ key, message, thinking? })
  → 响应通过已订阅的 session.message 事件实时推送到前端
```

### chat.\* 桥接清理

迁移完成后删除：

- `dashboard/server/approval-bridge.ts` 中的 chat.\* 相关逻辑（如有）
- `/api/chat/snapshot/route.ts` 中的 `chat.history` 调用
- `gateway-allowlist.ts` 中 `EXTRA_METHODS` 里的 chat.\* 条目
- projection-store 中与 chat.history 轮询相关的缓存逻辑（如有）

保留 `sessions.steer` — 这是上游正式 API（"带中断的 send"语义），不是桥接。

---

## 同步工程化

### 协议驱动后的同步流程变化

**自动化步骤（不再需要手动）**：

| 步骤              | 之前（每次同步）                | 之后                     |
| ----------------- | ------------------------------- | ------------------------ |
| Allowlist 更新    | 手动 codegen + 补 EXTRA_METHODS | 自动（runtime discover） |
| 新 SSE 事件处理   | 手动加 union type + mapper      | 自动（Gateway 透传层）   |
| 新 RPC 方法可调用 | 必须 codegen 后才能用           | 立即可用（raw 通道）     |

**仍需手动的步骤（质量不妥协）**：

| 步骤                    | 原因                                               |
| ----------------------- | -------------------------------------------------- |
| `pnpm protocol:gen:ts`  | typed client 类型安全仍需 codegen 更新             |
| Session schema 字段适配 | sessions.\* 新增字段需要 UI 展示                   |
| Deck 自有事件变更       | Deck 自有层硬编码，按需维护                        |
| 全量验证                | `pnpm check` + `pnpm test` + `pnpm build` 不可省略 |

### 同步触发策略

按需同步，质量优先：

- 上游有 Deck 需要的新能力（新 Session 字段、新 RPC 方法等）
- 上游有安全修复或 breaking change
- 累积时间超过 4 周（兜底，避免 drift 过大）

每次同步的验证清单不变：rebase → protocol:gen:ts → tsc → check → test → build → 冒烟。协议驱动架构减少"修复适配"的工作量，不减少验证步骤。

---

## 实施排序

```
Phase 1a: DescribeCache + 动态 Allowlist + Raw 通道
Phase 1b: SSE 事件分层架构
  ↕ 1a 和 1b 可并行，互不依赖
Phase 2: Session API 完整迁移
  → 依赖 Phase 1a + 1b
Phase 3: 清理旧桥接 + chat.* 残留
```

与原 upstream-sync-plan 的对应关系：

| 本设计 Phase | 原计划 Session                  | OpenSpec change 名称（建议）   |
| ------------ | ------------------------------- | ------------------------------ |
| Phase 1a     | Session 3B (dynamic-discovery)  | `deck-protocol-discovery`      |
| Phase 1b     | Session 3B (dynamic-discovery)  | `deck-event-layering`          |
| Phase 2      | Session 3A (session-api-native) | `deck-session-api-native`      |
| Phase 3      | Session 3A (清理阶段)           | 合入 `deck-session-api-native` |

> Session 3C (config-server-driven) 不在本设计范围——Config schema 已是协议驱动的，`config.schema.lookup` 的增量查询能力可在后续按需引入。
>
> Session 3D (agent-config-fields) 是纯 UI 展示扩展，不涉及协议架构变更，后续独立实施。
