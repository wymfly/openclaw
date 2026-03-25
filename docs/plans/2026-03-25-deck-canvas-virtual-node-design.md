# Deck Canvas Virtual Node — Design Spec

## Goal

让 Deck Web Dashboard 独立支持 Canvas 功能，不依赖物理设备（Mac/iOS/Android）。Deck Server 注册为具有 canvas capability 的虚拟 node，接收 Gateway 的 `node.invoke` canvas 命令，通过 SSE 推送到浏览器 iframe 渲染。

## Architecture

### 核心方案：双连接分离

Deck Server 维护两条独立 WebSocket 连接到 Gateway：

- **Operator 连接（现有）** — 管理 RPC、SSE 事件订阅、device identity 认证
- **Node 连接（新增）** — 注册为 canvas node，接收 `node.invoke` canvas 命令

两条连接生命周期绑定：operator 连接成功后自动建立 node 连接，operator 断开时 node 同步断开。

### 数据流

Agent 调用 canvas 工具（`action: "a2ui_push"`, `node: "deck-a1b2c3d4"`）为例：

1. Agent canvas tool → Gateway `node.invoke("canvas.a2ui.pushJSONL", {...})`
2. Gateway 路由到 Deck 的 node WebSocket 连接
3. Deck Server `node-connection.ts` 接收命令
4. 通过 EventBus 推送 SSE 事件 `{ type: "canvas", action: "a2ui_push", data: {...} }`
5. 浏览器 CanvasPanel 接收 → iframe postMessage → A2UI 渲染引擎执行

### 多设备选择

不改 Gateway 路由逻辑。`pickDefaultNode()` 有 `preferLocalMac: true` 偏好，当 Mac + Deck 同时在线时默认选择 Mac。因此：

- 用户必须显式指定 `node: "deck-..."` 才能将 canvas 定向到 Deck
- Agent 可通过 `nodes status` 查看在线设备列表
- 优化 canvas 工具描述，引导 Agent 在有多个 canvas 设备时询问用户"在哪个设备上显示？"
- 仅 Deck 一个 canvas node 在线时，`pickDefaultNode()` 自动选中，无需显式指定

## Node Connection Protocol

### 连接参数

`ConnectParams` 的 `caps` 和 `commands` 是顶层字段（非嵌套），`nodeId` 由 Gateway 从 `device.id ?? client.id` 推导：

```json
{
  "minProtocol": 3,
  "maxProtocol": 3,
  "client": {
    "id": "deck-a1b2c3d4",
    "displayName": "Deck Dashboard",
    "version": "dev",
    "platform": "web",
    "mode": "node"
  },
  "auth": { "token": "...", "deviceToken": "..." },
  "device": { "id": "deck-a1b2c3d4", "publicKey": "...", "signature": "..." },
  "caps": ["canvas"],
  "commands": [
    "canvas.present",
    "canvas.hide",
    "canvas.navigate",
    "canvas.eval",
    "canvas.a2ui.pushJSONL",
    "canvas.a2ui.reset"
  ]
}
```

### nodeId 生成

复用 Deck Server 已有的 Ed25519 device identity，格式 `deck-{deviceId前8位}`。Gateway 的 `nodeRegistry` 从 `device.id` 提取 nodeId，因此 `device.id` 和 `client.id` 保持一致。多实例不冲突。

### 认证方式

不走传统的设备配对确认流程。使用 device-token 认证（`auth.deviceToken`）：

- Deck 的 operator 连接已通过 Ed25519 device identity 认证
- Node 连接复用同一套 device identity，在 `auth` 中提供 `deviceToken`
- Gateway 的 `usesDeviceTokenAuth()` 检查会识别有效的 device token → 跳过配对确认
- 不需要修改 `shouldSkipBackendSelfPairing()`——该函数是 backend operator 专用的纯函数，不适合扩展

如果 `usesDeviceTokenAuth` 路径不可直接复用，备选方案：在 Gateway 的 node 注册逻辑中新增检查——当 `client.id` 对应的 device identity 已有通过认证的 operator 连接时，自动接受 node 注册。

### 支持的 Canvas Actions（6/7）

| Action       | 支持 | 说明                                       |
| ------------ | :--: | ------------------------------------------ |
| `present`    | Yes  | 显示 CanvasPanel                           |
| `hide`       | Yes  | 收起 CanvasPanel                           |
| `navigate`   | Yes  | iframe 加载 URL                            |
| `eval`       | Yes  | iframe postMessage 执行 JS + 返回结果      |
| `a2ui_push`  | Yes  | A2UI Bridge 推送 JSONL                     |
| `a2ui_reset` | Yes  | A2UI Bridge 清空                           |
| `snapshot`   |  No  | 浏览器无原生截图 API，不在 commands 中声明 |

`snapshot` 不声明在 `commands` 中，Gateway 的 allowlist 校验会自动拒绝。

## Command Handling

### 通用命令处理（非 eval）

```
Deck Server 收到 node.invoke (command ≠ "canvas.eval")
    → 检查是否有活跃的 SSE 消费者（浏览器标签页）
    → 有消费者：emit canvas SSE 事件 → respond(true)
    → 无消费者：仍然 respond(true)（与 Mac App 行为一致，不报错）
```

### canvas.eval 异步回调

eval 需要返回 JS 执行结果，涉及 Server ↔ Browser 往返：

```
Deck Server 收到 node.invoke (command = "canvas.eval")
    → 检查是否有活跃的 SSE 消费者
    → 无消费者：立即 respond(false, { error: "no active browser session" })
    → 有消费者：
        → 生成 evalId（crypto.randomUUID，单次使用 nonce）
        → SSE 推送 { type: "canvas", action: "eval", evalId, javaScript }
        → 等待 Promise（10s timeout）

Browser CanvasPanel 收到
    → iframe.postMessage({ type: "eval", js })
    → iframe 执行 → postMessage 返回结果
    → CanvasPanel 调用 POST /api/deck/canvas/eval-result { evalId, result }

Deck Server 收到 eval-result
    → 验证 evalId 存在于 pending map 中（单次使用，验证后删除）
    → resolve 对应 Promise
    → respond 给 Gateway

超时（10s 无响应）
    → 从 pending map 删除 evalId
    → respond(false, { error: "eval timeout" })
```

### eval-result 端点认证

`POST /api/deck/canvas/eval-result` 的安全设计：

- **evalId 作为单次使用 nonce** — 由 Deck Server 生成的 crypto.randomUUID，不可预测，使用后立即从 pending map 删除
- **仅接受 pending 中存在的 evalId** — 重复提交或伪造 evalId 被拒绝（返回 404）
- **Same-origin 保护** — Next.js API route 天然受浏览器同源策略保护
- **TTL 限制** — eval 超时后 evalId 自动清除，不会无限期有效

## Frontend Rendering

### CanvasPanel 改造

现有 CanvasPanel 已有 iframe + A2UI Bridge 基础设施（用于回放历史 A2UI 事件），增加实时接收模式：

- 监听 SSE canvas 事件流
- 实时执行 present/hide/navigate/eval/a2ui_push/a2ui_reset
- 管理 CanvasPanel 可见性

### 各 Action 前端行为

| Action       | 前端行为                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------- |
| `present`    | `canvasVisible = true`，RightPanel 切换 Canvas 模式。如有 url/path，iframe 加载             |
| `hide`       | `canvasVisible = false`，RightPanel 恢复默认                                                |
| `navigate`   | iframe src 切换到新 URL（通过 `/api/canvas/` 代理）                                         |
| `eval`       | A2UI Bridge postMessage 发到 iframe，iframe 执行后回传结果，CanvasPanel 调 eval-result 端点 |
| `a2ui_push`  | A2UI Bridge postMessage 推送 JSONL 到 iframe A2UI 渲染引擎                                  |
| `a2ui_reset` | A2UI Bridge postMessage 清空所有 surface                                                    |

### UI 状态

`ui.ts` store 新增：

- `canvasVisible: boolean` — canvas 面板是否显示
- `canvasMode: "idle" | "active"` — 是否有活跃 canvas 会话
- `setCanvasVisible(v: boolean)` — 控制可见性

ChatPanel 布局：`canvasVisible = true` 时，右侧显示 CanvasPanel（与 RightPanel/ArtifactPanel 共用分栏位置）。

## Error Handling

### 连接断线恢复

Operator 断开 → node 同步断开 → Gateway 移除 Deck node。Operator 重连 → 自动重建 node 连接。不需要独立重连逻辑。

### 浏览器未打开（非 eval 命令）

Node 连接在线但无浏览器消费 SSE：canvas 事件丢弃，Deck Server 仍 respond(true)。与 Mac App 行为一致——不管用户是否在看屏幕。

### 浏览器未打开（eval 命令）

无活跃 SSE 消费者时，eval 命令立即返回错误 respond(false, { error: "no active browser session" })。不等待超时，因为不可能有响应。Agent 会收到明确的失败信号。

### eval 超时

浏览器在线但 iframe 执行 JS 无响应：10 秒超时后 respond(false, { error: "eval timeout" })。

### 多浏览器标签页

所有标签页同步渲染 canvas 事件。eval 结果由第一个响应的标签页决定——evalId 在 pending map 中被第一个响应消费后删除，后续响应被丢弃（幂等）。

## File Changes

### 新增

| 文件                                         | 职责                                     |
| -------------------------------------------- | ---------------------------------------- |
| `dashboard/server/node-connection.ts`        | Node WebSocket 连接管理、canvas 命令分发 |
| `dashboard/src/app/api/deck/canvas/route.ts` | canvas eval-result 回调端点              |

### 修改

| 文件                                                   | 改动                                  |
| ------------------------------------------------------ | ------------------------------------- |
| `dashboard/server/gateway-adapter.ts`                  | operator 连接成功后触发 node 连接建立 |
| `dashboard/src/components/panels/chat/CanvasPanel.tsx` | 增加实时 canvas 事件监听              |
| `dashboard/src/stores/ui.ts`                           | 新增 canvasVisible / canvasMode 状态  |

### Gateway 侧改动（最小侵入）

Gateway 侧可能需要的调整取决于 device-token auth 路径是否直接可用：

- **理想情况**：Deck 的 node 连接使用 deviceToken 认证，Gateway 现有的 `usesDeviceTokenAuth()` 自动处理，零改动
- **备选方案**：在 node 注册逻辑中新增一个检查函数，识别已有 operator 连接的 device → 自动接受 node 注册

具体路径在实现阶段确认，设计目标是 Gateway 零改动或最小改动。

## Testing Strategy

- **单元测试**：node-connection.ts 的命令路由、eval 超时、evalId 幂等检查、无浏览器 eval 快速失败
- **集成测试**：Gateway ↔ Deck node 连接建立、device-token 认证、canvas 命令往返
- **E2E 测试**：Agent 调用 canvas → Deck 浏览器渲染验证
