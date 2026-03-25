# Deck Canvas Virtual Node — Design Spec

## Goal

让 Deck Web Dashboard 独立支持 Canvas 功能，不依赖物理设备（Mac/iOS/Android）。Deck Server 注册为具有 canvas capability 的虚拟 node，接收 Gateway 的 `node.invoke` canvas 命令，通过 SSE 推送到浏览器 iframe 渲染。

## Architecture

### 核心方案：双连接分离

Deck Server 维护两条独立连接到 Gateway：

- **Operator 连接（现有）** — `OpenClawGatewayAdapter`，管理 RPC、SSE 事件订阅、device identity 认证
- **Node 连接（新增）** — 复用 `src/gateway/client.ts` 的 `GatewayClient` 类，注册为 canvas node，接收 `node.invoke.request` 事件

两条连接生命周期绑定：operator 连接成功后自动建立 node 连接，operator 断开时 node 同步断开。

### 为什么复用 GatewayClient 而非手写 WebSocket

`src/gateway/client.ts` 的 `GatewayClient` 已封装完整的 node 连接能力：

- connect challenge 握手 + device identity 签名
- device-token 缓存与自动重试
- 自动重连（指数退避）
- event 帧监听（`onEvent` 回调）
- `request()` 方法用于发送 `node.invoke.result`

`src/node-host/runner.ts` 就是直接用 `GatewayClient` 连接 Gateway 的。Deck 的 node 连接复用同一模式，协议兼容性有保证。

### 数据流

Agent 调用 canvas 工具（`action: "a2ui_push"`, `node: "<deck-deviceId>"`）为例：

1. Agent canvas tool → Gateway `node.invoke("canvas.a2ui.pushJSONL", {...})`
2. Gateway `nodeRegistry.invoke()` → 向 Deck 的 node 连接发送 **event** `node.invoke.request`
3. Deck Server `node-connection.ts` 的 `onEvent` 回调接收
4. 通过 EventBus 推送 SSE 事件 `{ type: "canvas", action: "a2ui_push", data: {...} }`
5. Deck Server 通过 `GatewayClient.request("node.invoke.result", {...})` 回传执行结果
6. 浏览器常驻 canvas 事件监听器（在 ChatPanel 或 useChatSSE 中）接收 → 控制 CanvasPanel 显隐 + iframe 渲染

### 多设备选择

不改 Gateway 路由逻辑。`pickDefaultNode()` 有 `preferLocalMac: true` 偏好，当 Mac + Deck 同时在线时默认选择 Mac。因此：

- 用户必须显式指定 `node: "<deck-deviceId>"` 才能将 canvas 定向到 Deck
- Agent 可通过 `nodes status` 查看在线设备列表
- 优化 canvas 工具描述，引导 Agent 在有多个 canvas 设备时询问用户"在哪个设备上显示？"
- 仅 Deck 一个 canvas node 在线时，`pickDefaultNode()` 自动选中，无需显式指定

## Node Connection Protocol

### 连接实现

使用 `GatewayClient`（`src/gateway/client.ts`），与 node-host 使用完全相同的类：

```typescript
import { GatewayClient } from "openclaw/gateway/client"; // 或相对路径

const client = new GatewayClient({
  url: gatewayUrl,
  token: gatewayToken,
  clientName: "node-host", // GATEWAY_CLIENT_IDS 枚举值
  clientDisplayName: "Deck Dashboard",
  mode: "node", // GATEWAY_CLIENT_MODES.NODE
  role: "node",
  platform: "web",
  caps: ["canvas"],
  commands: [
    "canvas.present",
    "canvas.hide",
    "canvas.navigate",
    "canvas.eval",
    "canvas.a2ui.pushJSONL",
    "canvas.a2ui.reset",
  ],
  deviceIdentity: deckDeviceIdentity, // 复用 operator 连接的 Ed25519 identity
  onEvent: (evt) => {
    if (evt.event === "node.invoke.request") {
      handleCanvasInvoke(evt.payload, client);
    }
  },
});
client.start();
```

### nodeId 来源

Gateway 的 `nodeRegistry.register()` 从 `connect.device?.id ?? connect.client.id` 推导 nodeId。`GatewayClient` 将 `device.id` 设为 `deviceIdentity.deviceId`（从公钥 hash 推导的唯一 ID）。因此 **nodeId = Deck 的 deviceIdentity.deviceId**，不可自定义。

Agent 在 `nodes status` 中会看到 displayName "Deck Dashboard"，可以据此识别。

### 认证与配对

`GatewayClient` 内置完整的认证流程：

1. 首次连接：使用 gateway token + device identity 签名
2. Gateway 返回 `auth.deviceToken` → `GatewayClient` 自动缓存
3. 后续连接：自动使用 deviceToken（如果有效）
4. 配对确认：首次可能需要 operator 侧确认（与 Mac/iOS 一致），后续自动

**不需要修改 Gateway 认证逻辑**——复用 `GatewayClient` 意味着走与 node-host 完全一致的认证路径。

### node.invoke 协议（事件模式）

**与之前理解不同**：node.invoke 不是 req/res 模式，而是 event + request 模式：

```
Gateway → Node: event "node.invoke.request" { id, nodeId, command, paramsJSON, ... }
Node → Gateway: request "node.invoke.result" { id, nodeId, ok, payload/error }
```

Deck 在 `onEvent` 回调中监听 `node.invoke.request`，处理后通过 `client.request("node.invoke.result", ...)` 回传结果。

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
onEvent "node.invoke.request" (command ≠ "canvas.eval")
    → 通过 EventBus broadcast("canvas", { action, params })
    → client.request("node.invoke.result", { id, nodeId, ok: true, payload: { ok: true } })
```

不检查 SSE 消费者数量——与 Mac App 行为一致，不管用户是否在看屏幕。

### canvas.eval 异步回调

eval 需要返回 JS 执行结果，涉及 Server ↔ Browser 往返：

```
onEvent "node.invoke.request" (command = "canvas.eval")
    → 检查 canvasSessionActive 标志（由前端 canvas 事件监听器维护）
    → 不活跃：立即 client.request("node.invoke.result", { ok: false, error: "no active browser" })
    → 活跃：
        → 生成 evalId（crypto.randomUUID，单次使用 nonce）
        → EventBus broadcast("canvas", { action: "eval", evalId, javaScript })
        → 等待 Promise（10s timeout）

Browser 常驻监听器收到 eval 事件
    → 通过 A2UIBridge 的 eval 方法发到 iframe
    → iframe 执行 → postMessage 返回结果
    → 前端调用 POST /api/deck/canvas { evalId, result }

Deck Server 收到 eval-result
    → 验证 evalId 存在于 pending map（单次使用，验证后删除）
    → resolve Promise
    → client.request("node.invoke.result", { id, nodeId, ok: true, payload: { result } })

超时（10s）
    → 清除 evalId → client.request("node.invoke.result", { ok: false, error: "eval timeout" })
```

### eval-result 端点安全

`POST /api/deck/canvas` 的安全设计：

- **evalId 作为单次 nonce** — crypto.randomUUID，不可预测，使用后立即删除
- **仅接受 pending 中存在的 evalId** — 伪造或重复提交返回 404
- **Same-origin** — Next.js API route 受浏览器同源策略保护
- **TTL** — 超时后 evalId 自动清除

### canvasSessionActive 标志

用于 eval 快速失败判断，替代不准确的 SSE consumer count：

- 前端 canvas 事件监听器挂载时：`POST /api/deck/canvas { action: "register" }` → 服务端 `canvasSessionActive = true`
- 监听器卸载时：`POST /api/deck/canvas { action: "unregister" }` → 服务端 `canvasSessionActive = false`
- 多标签页：引用计数（register +1, unregister -1, > 0 即活跃）

## Frontend Rendering

### Canvas 事件监听位置

**关键约束**：canvas 事件监听必须在**常驻挂载的组件**中，不能放在 CanvasPanel 内部。CanvasPanel 仅在 `rightPanelMode === "canvas"` 时挂载——如果监听在 CanvasPanel 内，`canvas.present` 命令在 panel 隐藏时无法被接收。

监听放在 `useChatSSE` hook 或 ChatPanel 中（与 chat/agent 事件同层），收到 `present` 时设置 `canvasVisible = true` 触发 CanvasPanel 挂载。

### 各 Action 前端行为

| Action       | 前端行为                                                                        |
| ------------ | ------------------------------------------------------------------------------- |
| `present`    | `canvasVisible = true`，RightPanel 切换 Canvas 模式。如有 url/path，iframe 加载 |
| `hide`       | `canvasVisible = false`，RightPanel 恢复默认                                    |
| `navigate`   | iframe src 切换到新 URL（通过 `/api/canvas/` 代理）                             |
| `eval`       | A2UI Bridge eval 方法发到 iframe，iframe 执行后回传结果，调 eval-result 端点    |
| `a2ui_push`  | A2UI Bridge postMessage 推送 JSONL 到 iframe A2UI 渲染引擎                      |
| `a2ui_reset` | A2UI Bridge postMessage 清空所有 surface                                        |

### iframe bridge eval 扩展

现有 bridge script（`dashboard/src/app/api/canvas/[...path]/route.ts` 注入）不处理 `a2ui:eval`。需要扩展：

- bridge script 新增 `a2ui:eval` message handler：接收 `{ type: "a2ui:eval", evalId, javaScript }`
- 执行 JS 后发送 `{ type: "a2ui:eval-result", evalId, result }` 回 parent

### UI 状态

`ui.ts` store 新增：

- `canvasVisible: boolean` — canvas 面板是否显示
- `canvasMode: "idle" | "active"` — 是否有活跃 canvas 会话
- `setCanvasVisible(v: boolean)` — 控制可见性

ChatPanel 布局：`canvasVisible = true` 时，右侧显示 CanvasPanel（与 RightPanel/ArtifactPanel 共用分栏位置）。

## Error Handling

### 连接断线恢复

`GatewayClient` 内置自动重连（指数退避）。Operator 断开时手动调用 `nodeClient.forceStop()`，operator 重连成功后调用 `nodeClient.start()`。

### 浏览器未打开（非 eval 命令）

canvas 事件丢弃，通过 `node.invoke.result` 返回 `ok: true`。与 Mac App 行为一致。

### 浏览器未打开（eval 命令）

`canvasSessionActive === false` → 立即返回 `ok: false, error: "no active browser session"`。

### eval 超时

10 秒后清除 pending entry → 返回 `ok: false, error: "eval timeout"`。

### 多浏览器标签页

所有标签页同步渲染。eval 结果由第一个响应消费（evalId 单次使用），后续丢弃。

## File Changes

### 新增

| 文件                                         | 职责                                              |
| -------------------------------------------- | ------------------------------------------------- |
| `dashboard/server/node-connection.ts`        | GatewayClient 封装、canvas 命令分发、eval pending |
| `dashboard/src/app/api/deck/canvas/route.ts` | eval-result 回调 + canvas session register        |

### 修改

| 文件                                                   | 改动                                   |
| ------------------------------------------------------ | -------------------------------------- |
| `dashboard/server/event-bus.ts`                        | 添加 `"canvas"` 到 DeckEventType       |
| `dashboard/server/runtime.ts`                          | 添加 `"canvas"` 到 VALID_DECK_EVENTS   |
| `dashboard/server/gateway-adapter.ts`                  | operator 连接成功后启动 node 连接      |
| `dashboard/src/components/panels/chat/useChatSSE.ts`   | 添加 canvas 事件分发                   |
| `dashboard/src/components/panels/chat/CanvasPanel.tsx` | 增加实时 canvas 渲染（在已挂载状态下） |
| `dashboard/src/components/panels/chat/a2ui-bridge.ts`  | 添加 eval 方法                         |
| `dashboard/src/app/api/canvas/[...path]/route.ts`      | 扩展 bridge script 支持 a2ui:eval      |
| `dashboard/src/stores/ui.ts`                           | 新增 canvasVisible / canvasMode 状态   |

### Gateway 侧改动

**零改动**。复用 `GatewayClient` + 标准 node 注册协议，无需修改 Gateway。

## Testing Strategy

- **协议探针**：Task 0 用真实 Gateway 验证 GatewayClient node 连接 + node.invoke.request 事件接收
- **单元测试**：node-connection.ts 的命令路由、eval 超时、evalId 幂等
- **集成测试**：Gateway ↔ Deck node 完整链路
- **E2E 测试**：Agent 调用 canvas → Deck 浏览器渲染
