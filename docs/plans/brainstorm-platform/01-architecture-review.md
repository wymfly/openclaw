# 架构可行性审查报告 — 平台与 OpenClaw 集成边界

> Date: 2026-03-10
> Author: System Architect (AI)
> Status: Complete
> Base: 设计文档 `docs/plans/2026-03-10-enterprise-agent-platform-design.md`

## 摘要

本报告通过深入阅读 OpenClaw 源码，逐项验证设计文档中的技术假设。总体结论：**设计文档的核心架构可行，但存在若干需要修正的细节假设**。

---

## 1. GatewayClient 连接模式验证

### 1.1 GatewayClient 实现

**源码位置**: `src/gateway/client.ts:85-526`

GatewayClient 是成熟的 WebSocket RPC 客户端，支持：

- 自动重连（指数退避，`backoffMs` 从 1000ms 起）
- 幂等性去重（基于 `idempotencyKey`，30s 窗口）
- 心跳检测（`tickIntervalMs = 30_000`）
- 序列号追踪（`lastSeq` 用于检测消息丢失）

**连接参数** (`GatewayClientOptions`，`src/gateway/client.ts:43-72`):

```typescript
{
  url: string;              // ws://127.0.0.1:18789
  token?: string;           // 共享令牌
  password?: string;        // 密码认证
  role?: string;            // "operator" | "node"（默认 "operator"）
  scopes?: string[];        // 默认 ["operator.admin"]
  mode?: string;            // "backend" | "webchat" | "probe" | "app"
  onEvent?: (evt) => void;  // 事件回调
  onHelloOk?: (hello) => void;
  // ... 更多选项
}
```

### 1.2 设计文档验证

**设计文档假设**:

```typescript
const client = new GatewayClient({
  url: endpoint,
  role: "operator",
  scopes: ["admin", "read", "write"],
  auth: { token: authToken },
});
```

**与实际代码的差异**:

| 项目        | 设计文档                     | 实际代码                          | 影响                       |
| ----------- | ---------------------------- | --------------------------------- | -------------------------- |
| scopes 格式 | `["admin", "read", "write"]` | `["operator.admin"]` 等带前缀格式 | ⚠️ 需要确认实际的 scope 值 |
| auth 传递   | `auth: { token }` 嵌套对象   | `token` 直接作为顶级参数          | ⚠️ 需要修正初始化代码      |
| role 参数   | ✅ `"operator"`              | ✅ 支持                           | 正确                       |

**修正后的正确初始化**:

```typescript
const client = new GatewayClient({
  url: "ws://127.0.0.1:18789",
  token: "your-auth-token",
  role: "operator",
  scopes: ["operator.admin"],
  mode: "backend",
  clientName: "claw-platform",
  onEvent: (evt) => {
    /* 处理事件 */
  },
});
client.start();
```

### 1.3 远程发消息给指定 agent

**RPC 方法**: `agent`（`src/gateway/server-methods/agent.ts:169`）

```typescript
const result = await client.request("agent", {
  message: "Hello",
  agentId: "test-agent",
  sessionKey: "agent:test-agent:platform:user123",
  idempotencyKey: crypto.randomUUID(),
});
```

**关键行为**:

- 异步两阶段响应：立即返回 `{ status: "accepted", runId }`, 完成后推送最终帧
- 如果需要同步等待，可调用 `agent.wait`（`src/gateway/server-methods/agent.ts:750`）
- `idempotencyKey` 必填，30s 去重窗口

### 1.4 接收 agent 回复

**Event 帧格式**（`src/gateway/protocol/schema/frames.ts`）:

```typescript
{
  type: "event",
  event: "agent",
  payload: {
    runId: string,
    sessionKey: string,
    seq: number,
    stream: "lifecycle" | "assistant" | "tool" | ...,
    data: { ... }
  },
  seq?: number
}
```

回复通过 `onEvent` 回调接收，`stream: "assistant"` 包含文本块，`stream: "lifecycle"` 包含状态变更。

### 1.5 同时管理多个 agent 会话

✅ **完全支持**。GatewayClient 通过 `pending` Map 追踪并发请求，每个请求有唯一 `id`。平台网关可以：

- 对同一实例同时发多个消息（不同 agent、不同 session）
- 通过 `onEvent` 中的 `sessionKey` / `runId` 区分回复归属

### 1.6 结论

> **设计文档核心假设成立**：operator 角色可远程发消息、接收回复、管理多会话。
> **需修正**：scopes 格式和 auth 参数传递方式。

---

## 2. Agent 远程管理 API 验证

### 2.1 agents.create

**源码**: `src/gateway/server-methods/agents.ts`

**必填参数**:

- `name: string` — 代理显示名称（非空）
- `workspace: string` — 工作区路径（非空）

**可选参数**:

- `emoji?: string` — 表情符号
- `avatar?: string` — 头像/描述

**行为**:

1. 从 `name` 自动生成 `agentId`（小写化 + 分隔符规范化，最长 64 字符）
2. `"main"` 是预留 ID，不可创建
3. 创建工作区目录 + 引导文件（AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md 等）
4. **先创建目录，后写配置**（失败不留悬垂配置）

**返回**:

```typescript
{ ok: true, agentId: string, name: string, workspace: string }
```

### 2.2 agents.update

**可修改字段**:

- `name` — 显示名称
- `workspace` — 工作区路径
- `model` — 模型 ID（如 `"claude-3-5-sonnet"`）
- `avatar` — 头像描述

**⚠️ 不能通过 agents.update 修改的**:

- `skills` — 技能白名单
- `prompt` / `systemPrompt` — 系统提示
- `sandbox` — 沙箱配置
- `tools` — 工具策略

> **影响**: 设计文档提到"远程改 skills/prompt/model"，其中 **model 可以通过 agents.update**，但 **skills 和 prompt 需要通过 `config.patch` 或 `agents.files.set` 间接实现**。

### 2.3 agents.delete

**参数**:

- `agentId: string` — 必填
- `deleteFiles?: boolean` — 默认 true

**行为**:

- `"main"` 不可删除
- 工作区、代理目录、会话转录 → 移入回收站（非永久删除）
- 清理关联的通道绑定（bindings）
- **会话数据保留在回收站中**，不会立即丢失

**返回**:

```typescript
{ ok: true, agentId: string, removedBindings: number }
```

### 2.4 远程发消息的 RPC 方法

| 方法         | 用途                     | 适用场景               |
| ------------ | ------------------------ | ---------------------- |
| `agent`      | 发消息给 agent，异步执行 | **平台主要使用此方法** |
| `agent.wait` | 等待 agent 完成          | 需要同步结果时         |
| `chat.send`  | 聊天接口发消息           | 带流式事件的交互       |
| `send`       | 直接发消息到通道         | 平台发送通知/回复      |

### 2.5 其他有用的 API

- `agents.files.list` — 列出 agent 工作区文件
- `agents.files.get` — 读取文件内容
- `agents.files.set` — 写入文件内容（可用于远程修改 AGENTS.md/SOUL.md 等）
- `agent.identity.get` — 获取 agent 身份信息
- `agents.list` — 列出所有 agent

### 2.6 结论

> **CRUD API 完备**，但 `agents.update` 的可修改字段有限。
> **远程修改 skills/prompt 的推荐路径**: `config.patch`（修改 agents 配置树）或 `agents.files.set`（直接写 AGENTS.md/SOUL.md）。

---

## 3. Session Key 跨用户隔离

### 3.1 Session Key 格式

**源码**: `src/routing/session-key.ts`, `src/sessions/session-key-utils.ts`

标准格式: `agent:<agentId>:<rest>`

**解析规则** (`parseAgentSessionKey`):

1. 去尾空格 + 小写化
2. 按 `:` 分割
3. `parts[0]` 必须是 `"agent"`
4. `parts` 长度 ≥ 3
5. 返回 `{ agentId: parts[1], rest: parts.slice(2).join(":") }`

### 3.2 平台自定义 Session Key 验证

设计文档假设: `agent:<agentId>:platform:<userId>`

**✅ 格式合法**。`parseAgentSessionKey` 只要求：

- 前缀 `agent:`
- 有效的 agentId（`[a-z0-9_-]`，64 字符内）
- rest 部分至少有一个 token

`agent:test-agent:platform:user123` 完全符合要求：

- `agentId = "test-agent"`
- `rest = "platform:user123"`

### 3.3 不同用户的会话隔离

**天然隔离**: 不同的 `<userId>` 产生不同的 session key → 不同的 session entry → **完全独立的聊天历史和状态**。

```
agent:process-helper:platform:xiaowang  ← 小王的会话
agent:process-helper:platform:zhangjie  ← 张杰的会话
agent:process-helper:platform:lizong    ← 李总的会话
```

每个 session key 对应独立的:

- `sessionId`（UUID）
- 聊天历史（transcript）
- 配置覆盖（model、thinking level 等）
- token 用量追踪

### 3.4 Session 存储

**存储位置**: `~/.openclaw/agents/<agentId>/sessions.json`（或 `~/.openclaw/state/agents/<agentId>/sessions.json`）

**格式**: `Record<sessionKey, SessionEntry>`（JSON 文件，原子写入）

**大小限制**（`src/config/sessions/store-maintenance.ts`）:

| 参数           | 默认值 | 说明                   |
| -------------- | ------ | ---------------------- |
| `pruneAfterMs` | 30 天  | 非活跃会话自动清理     |
| `maxEntries`   | 500    | 单个存储文件最大条目数 |
| `rotateBytes`  | 10 MB  | 文件达到此大小时轮转   |

**并发安全**: 文件级锁队列（`withSessionStoreLock`），10s 锁超时。

### 3.5 注意事项

**⚠️ dmScope 默认行为**: OpenClaw 内部路由使用 `buildAgentSessionKey()`, 默认 `dmScope = "main"`（所有 DM 共享一个 session key）。但平台直接通过 RPC `agent` 方法传入 `sessionKey` 参数，**绕过了内部路由逻辑**，所以平台可以自由控制隔离粒度。

### 3.6 结论

> **设计文档假设完全正确**: `agent:<agentId>:platform:<userId>` 格式合法，天然实现用户隔离。
> **平台通过显式传入 sessionKey，拥有完整的隔离控制权**。

---

## 4. 配置热重载机制

### 4.1 config.patch RPC

**源码**: `src/gateway/server-methods/config.ts:284-405`

**参数**:

```typescript
{
  raw: string;              // JSON5 格式的补丁对象
  baseHash?: string;        // 乐观锁（防并发冲突）
  sessionKey?: string;      // 完成通知
  note?: string;            // 审计日志
  restartDelayMs?: number;  // 重启延迟
}
```

**合并机制**（`src/config/merge-patch.ts`）:

- 深度对象合并（非覆盖）
- 数组按 `id` 字段合并（如 agents list）
- `null` 值删除字段
- 原型污染防护

### 4.2 热重载 vs 重启决策

**源码**: `src/gateway/config-reload-plan.ts`

**三种响应模式**:

| 配置路径     | 响应方式           | 说明                      |
| ------------ | ------------------ | ------------------------- |
| `agents.*`   | `none`（动态读取） | ✅ **无需重启，立即生效** |
| `skills.*`   | `none`（动态读取） | ✅ **无需重启，立即生效** |
| `tools.*`    | `none`（动态读取） | ✅ 无需重启               |
| `bindings.*` | `none`（动态读取） | ✅ 无需重启               |
| `secrets.*`  | `none`（动态读取） | ✅ 无需重启               |
| `hooks.*`    | `hot`（热加载）    | 重新加载 hooks 模块       |
| `models.*`   | `hot`（热加载）    | 更新 heartbeat runner     |
| `cron.*`     | `hot`（热加载）    | 重启 cron 服务            |
| `plugins.*`  | `restart`          | ⚠️ 需要完整重启           |
| `gateway.*`  | `restart`          | ⚠️ 需要完整重启           |

### 4.3 远程修改 Agent 的 Skill 列表

**可行路径**:

1. **通过 config.patch** — 修改 `agents` 配置树（推荐）:

```json5
{
  agents: {
    list: [
      {
        id: "process-helper",
        skills: ["process-analysis", "material-lookup", "new-skill"],
      },
    ],
  },
}
```

- 触发 `none` 响应 → 无需重启，动态读取

2. **通过 skills.update RPC** — 修改技能的 enabled/apiKey/env:

```typescript
await client.request("skills.update", {
  skillKey: "process-analysis",
  enabled: true,
  apiKey: "sk-xxx",
});
```

- 限制：只能修改已有 skill 的属性，不能添加/删除 skill

3. **通过 agents.files.set** — 直接写入 AGENTS.md/SOUL.md:

```typescript
await client.request("agents.files.set", {
  agentId: "process-helper",
  name: "AGENTS.md",
  content: "新的系统提示和技能配置...",
});
```

### 4.4 结论

> **设计文档中"hybrid 热重载"假设正确**: agents/skills/tools 改动动态生效，无需重启。
> **平台可以通过 `config.patch` 实现远程、无中断的 agent 配置更新**。
> **乐观锁机制（baseHash）可防止并发修改冲突**。

---

## 5. 容器化部署约束

### 5.1 Docker 镜像

**✅ 有现成的 Dockerfile**: 项目根目录 `Dockerfile`

**基础镜像**: `node:22-bookworm`（Debian Bookworm）

**官方镜像**（GitHub Container Registry）:

- `ghcr.io/openclaw/openclaw:latest` — 最新稳定版
- `ghcr.io/openclaw/openclaw:main` — 最新 main 分支
- `ghcr.io/openclaw/openclaw:<version>` — 特定版本

**构建选项**:
| 构建参数 | 说明 | 额外大小 |
|---------|------|---------|
| `OPENCLAW_INSTALL_BROWSER=1` | 安装 Chromium/Playwright | +300MB |
| `OPENCLAW_INSTALL_DOCKER_CLI=1` | 安装 Docker CLI（沙箱用） | +50MB |

**⚠️ enhanced 分支没有独立镜像**: 需要从 enhanced 分支自行构建 `openclaw:enhanced` 镜像。

### 5.2 Gateway 启动参数

**源码**: `src/cli/gateway-cli/run.ts`

**必须配置**:

- `--bind lan`（Docker 容器内必须绑定到 0.0.0.0，不能是 loopback）
- `--port 18789`（或自定义端口）
- 认证（`--token` 或 `--password`，非 loopback 绑定强制要求）

**启动命令**:

```bash
node dist/index.js gateway --bind lan --port 18789 --token "$TOKEN"
```

**Docker Compose 配置参考**（`docker-compose.yml`）:

```yaml
services:
  openclaw-gateway:
    image: openclaw:enhanced
    environment:
      HOME: /home/node
      OPENCLAW_GATEWAY_TOKEN: ${TOKEN}
    volumes:
      - ./config:/home/node/.openclaw
      - ./workspace:/home/node/.openclaw/workspace
    ports:
      - "${PORT:-18789}:18789"
    init: true
    restart: unless-stopped
    command: ["node", "dist/index.js", "gateway", "--bind", "lan", "--port", "18789"]
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:18789/healthz')..."]
      interval: 30s
```

### 5.3 多实例端口方案

**默认端口**:

- WebSocket/HTTP: 18789
- Bridge: 18790

**多实例方案**:

```yaml
# 实例 A：工艺空间
openclaw-process:
  ports: ["18789:18789"]
  environment:
    OPENCLAW_GATEWAY_TOKEN: ${TOKEN_A}

# 实例 B：质量空间
openclaw-quality:
  ports: ["18799:18789"] # 外部 18799 → 容器内 18789
  environment:
    OPENCLAW_GATEWAY_TOKEN: ${TOKEN_B}

# 实例 C：个人空间
openclaw-personal:
  ports: ["18809:18789"]
  environment:
    OPENCLAW_GATEWAY_TOKEN: ${TOKEN_C}
```

**关键**: 容器内部端口统一用 18789，通过 Docker 端口映射区分实例。每个实例需要独立的配置卷和工作区卷。

### 5.4 健康检查

- `GET /healthz` — 存活性检查
- `GET /readyz` — 就绪状态检查

### 5.5 结论

> **Docker 支持成熟**: Dockerfile、Docker Compose、健康检查、CI 发布流程齐全。
> **多实例部署无障碍**: 端口映射 + 独立卷即可。
> **需要注意**: enhanced 分支需自建镜像；`--bind lan` 在 Docker 中是强制要求。

---

## 6. 上游 Rebase 风险评估

### 6.1 当前状态

| 指标                                          | 数值  |
| --------------------------------------------- | ----- |
| enhanced vs main 总 commit 差异               | 1515  |
| 带 `[enhanced]` 前缀的 commit                 | 8     |
| 非 `[enhanced]` 的 commit（上游 cherry-pick） | 1507  |
| 涉及的文件总数                                | 3003  |
| 其中 `src/` 下的文件                          | 1833  |
| 增加行数                                      | ~202K |
| 删除行数                                      | ~59K  |

### 6.2 [enhanced] Commit 列表

| Commit    | 类型 | 影响范围                        |
| --------- | ---- | ------------------------------- |
| `34694d0` | docs | 设计文档（新文件）              |
| `bfdda03` | docs | 归档旧设计文档（新文件）        |
| `b85e37e` | fix  | `isRestartLoopLine` 函数 + 测试 |
| `d54a25c` | docs | 交付设计文档（新文件）          |
| `f017877` | feat | Windows schtasks 重启循环       |
| `4793356` | test | 重试日志消息断言                |
| `75d6bef` | fix  | Discord EventQueue 超时         |
| `2314c5a` | docs | 迁移设计文档（新文件）          |

### 6.3 冲突风险评估

**低风险因素**:

- 8 个 `[enhanced]` commit 中有 5 个是**新文件**（docs），不会与上游冲突
- 修改上游代码的 commit 只有 3 个（`b85e37e`, `4793356`, `75d6bef`）
- 改动范围小（每个只修改 1-2 个文件的少量行）

**中等风险因素**:

- 1507 个非 `[enhanced]` commit 表明 enhanced 分支领先上游较多
- 上游活跃开发可能在同一文件的相邻区域修改

**预估下次 rebase 冲突**:

- **docs/** → 无冲突（全是新文件）
- **Discord EventQueue** → 低-中风险（上游可能也在调整 Discord 通道代码）
- **isRestartLoopLine** → 低风险（比较独立的工具函数）
- **重试日志断言** → 低风险（测试文件独立性高）

### 6.4 建议

1. **定期 rebase**（每 1-2 周），减少单次冲突量
2. **新功能优先以新文件形式添加**，最小化对上游文件的修改
3. **保持 `[enhanced]` 前缀规范**，方便冲突排查

---

## 7. 跨角色影响评估（Phase C）

### 7.1 对 Product Strategist（产品策略师）的影响

**API 限制对用户体验的影响**:

1. **agents.update 字段限制**: 用户在 Web UI 上修改 agent 的 skills/prompt 时，后端不能用 `agents.update`，需要走 `config.patch` 或 `agents.files.set`。这意味着:
   - 前端需要分两条路径：基础属性（name/model）→ `agents.update`；高级配置（skills/prompt）→ `config.patch`
   - 或者统一走 `config.patch`，但需要处理乐观锁（baseHash）

2. **异步两阶段响应**: `agent` RPC 立即返回 "accepted"，完成结果异步推送。用户在企业微信看到的是：
   - 发消息 → 即时确认（平台回复"已收到"） → 等待 agent 处理 → 收到最终回复
   - 需要设计合理的加载/等待状态 UX

3. **Session 30 天自动清理**: 不活跃 30 天的会话自动清除。如果用户期望长期保留历史，平台需要实现自己的历史归档。

4. **Session 500 条目上限**: 如果一个实例内有多个用户频繁创建新会话，可能触及上限。建议平台监控 session 数量。

### 7.2 对 Domain Expert（领域专家/企微集成）的影响

**容器部署约束**:

1. **Docker 内必须 `--bind lan`**: 企微 webhook 回调路径上不能假设 loopback 可用。平台网关 → OpenClaw 实例的 WebSocket 连接必须通过 Docker 网络。

2. **认证是强制的**: 非 loopback 绑定时，OpenClaw 强制要求 token 或 password。平台需要:
   - 为每个空间实例生成唯一的 gateway token
   - 安全存储和轮转这些 token

3. **企微消息延迟**: 消息链路为 企微 → 平台网关 → OpenClaw → agent 处理 → OpenClaw → 平台网关 → 企微。至少 4 次网络跳转，agent 思考时间可能较长（10s-60s）。企微端需要:
   - 设置合理的超时（企微被动回复 5s 限制）
   - 使用异步回复模式（先回复"正在处理"，agent 完成后主动推送）

4. **MAX_PAYLOAD_BYTES = 64MB**: WebSocket 单帧上限 64MB，对文件传输有限制。大文件建议通过卷挂载共享，而非 WebSocket 传输。

### 7.3 设计文档遗漏的技术风险

1. **⚠️ GatewayClient 单连接限制**: 每个 GatewayClient 实例是一个 WebSocket 连接。如果一个实例内有大量并发 agent 会话，所有消息共享同一连接。需要评估:
   - 单连接的吞吐瓶颈（60+ 并发用户对话时）
   - 是否需要连接池（多个 GatewayClient 到同一实例）

2. **⚠️ 幂等性窗口仅 30 秒**: 如果平台网关在 30s 后重试相同请求，OpenClaw 不会去重。需要在平台层实现自己的幂等性逻辑。

3. **⚠️ agent RPC 无 "发送方身份" 概念**: `agent` RPC 没有内置的 "who sent this message" 字段。平台需要通过以下方式注入用户身份:
   - `sessionKey` 中的 userId 部分（用于会话隔离）
   - `extraSystemPrompt` 参数（告诉 agent "当前用户是小王"）
   - 或在消息前缀加入用户信息

4. **⚠️ 配置文件为 JSON 格式**: OpenClaw 配置文件是单个 JSON 文件，多个 agent 共享。`config.patch` 有乐观锁，但如果平台和 OpenClaw 内部同时修改配置，需要处理冲突重试。

5. **⚠️ 员工电脑模式的连接稳定性**: 员工电脑上的 OpenClaw 实例可能因笔记本合盖、网络切换等原因断连。平台需要:
   - 健壮的重连机制
   - 连接状态展示（在线/离线）
   - 消息队列（离线时缓存，上线后投递）

6. **⚠️ 无内置审计日志**: OpenClaw 的 `config.patch` 有审计日志（`actor`, `changedPaths`），但 agent 消息交互没有集中的审计机制。企业合规需要平台自建审计日志。

---

## 8. 自助化流程技术可行性（补充研究）

> 补充背景：平台定位为"企业级自助平台"，部门负责人能自己创建空间、选资源、邀人，降低门槛优先于加强管控。

### 8.1 自助创建实例 + 自动配置的完整流程

**✅ OpenClaw 完全支持非交互式自动化部署**。以下是经源码验证的端到端自动化流程：

#### 阶段一：容器创建（平台侧）

```python
# 平台服务：部门负责人点击"创建工艺空间"
async def create_space(space_config):
    token = generate_token()  # openssl rand -hex 32
    port = allocate_port()     # 从端口池分配

    # Docker API 创建容器
    container = docker.create_container(
        image="openclaw:enhanced",
        environment={
            "HOME": "/home/node",
            "OPENCLAW_GATEWAY_TOKEN": token,
            "OPENCLAW_GATEWAY_BIND": "lan",
        },
        volumes={
            f"/data/spaces/{space_config.id}/config": "/home/node/.openclaw",
            f"/data/spaces/{space_config.id}/workspace": "/home/node/.openclaw/workspace",
            # 业务数据卷（按空间配置挂载）
            **space_config.data_volumes,
        },
        ports={f"{port}/tcp": 18789},
        command=["node", "dist/index.js", "gateway", "--bind", "lan", "--port", "18789"],
        healthcheck={"test": ["CMD", "node", "-e", "fetch('http://127.0.0.1:18789/healthz')..."]},
    )
    container.start()
    await wait_for_healthy(container)  # 轮询 /healthz
    return SpaceInstance(id=space_config.id, port=port, token=token)
```

#### 阶段二：非交互式初始化（容器内）

**源码验证**: `src/cli/program/register.onboard.ts:64`

```bash
# 容器启动后，通过 docker exec 执行非交互式 onboarding
docker exec <container> node dist/index.js onboard \
  --non-interactive \
  --accept-risk \
  --mode local \
  --anthropic-api-key "sk-..." \
  --gateway-bind lan \
  --gateway-port 18789
```

**支持的 provider flag**（`src/cli/program/register.onboard.ts:73-102`）:

- `--anthropic-api-key`、`--openai-api-key`、`--gemini-api-key` 等
- `--custom-base-url`、`--custom-api-key`、`--custom-model-id`（自定义 provider）

**或者**：跳过 onboarding，直接通过 CLI 设置配置：

```bash
docker exec <container> node dist/index.js config set gateway.bind "lan"
docker exec <container> node dist/index.js config set models.providers.anthropic.apiKey "sk-..."
docker exec <container> node dist/index.js config set gateway.mode "local"
```

#### 阶段三：通过 RPC 创建模板 Agent

```typescript
// 平台连接到新实例
const client = new GatewayClient({
  url: `ws://localhost:${port}`,
  token: token,
  mode: "backend",
});
client.start();

// 1. 创建 agent
const result = await client.request("agents.create", {
  name: "工艺分析助手",
  workspace: "/home/node/.openclaw/workspace/process-helper",
  emoji: "🔧",
});

// 2. 写入预配置的 SOUL.md（agent 人格 + 行为边界）
await client.request("agents.files.set", {
  agentId: result.agentId,
  name: "SOUL.md",
  content: PROCESS_HELPER_SOUL_TEMPLATE, // 从平台模板库加载
});

// 3. 写入预配置的 TOOLS.md（工具使用指南）
await client.request("agents.files.set", {
  agentId: result.agentId,
  name: "TOOLS.md",
  content: PROCESS_HELPER_TOOLS_TEMPLATE,
});

// 4. 写入 AGENTS.md（工作空间说明）
await client.request("agents.files.set", {
  agentId: result.agentId,
  name: "AGENTS.md",
  content: PROCESS_HELPER_AGENTS_TEMPLATE,
});

// 5. 设置模型
await client.request("agents.update", {
  agentId: result.agentId,
  model: "anthropic/claude-sonnet-4-20250514",
});

// 6. 通过 config.patch 设置 skills 白名单
await client.request("config.patch", {
  raw: JSON.stringify({
    agents: {
      list: [
        {
          id: result.agentId,
          skills: ["process-analysis", "material-lookup"],
        },
      ],
    },
  }),
});
```

### 8.2 配置模板化机制

OpenClaw 提供三层模板化能力：

#### 层1：$include 配置继承

**源码**: `src/config/includes.ts:1-347`

```json5
// /data/templates/base-space.json5 — 空间基础配置模板
{
  "gateway": { "bind": "lan", "mode": "local" },
  "agents": {
    "defaults": {
      "model": "anthropic/claude-sonnet-4-20250514",
      "skipBootstrap": true,
      "timeoutSeconds": 120
    }
  }
}

// 实际空间配置 — 继承 + 覆盖
{
  "$include": "/data/templates/base-space.json5",
  "agents": {
    "list": [
      { "id": "process-helper", "name": "工艺助手", "workspace": "/workspace/process" }
    ]
  }
}
```

**特性**:

- 支持多文件 include：`"$include": ["./base.json5", "./skills.json5"]`
- 深度合并（数组按 `id` 字段合并）
- 最大 10 级嵌套，2MB/文件，循环检测
- 路径遍历防护（CWE-22）

**⚠️ 自助化建议**: 平台维护一组模板配置文件（base、process、quality、personal），创建空间时通过 `$include` 继承，仅覆盖差异部分。

#### 层2：agents.defaults 全局默认值

**源码**: `src/config/types.agent-defaults.ts:120-326`

```json5
{
  agents: {
    defaults: {
      model: "anthropic/claude-sonnet-4-20250514",
      skipBootstrap: true, // 预配置部署跳过引导文件
      timeoutSeconds: 120,
      humanDelay: { min: 0, max: 0 }, // 企业场景不需要模拟打字延迟
      memorySearch: { enabled: true },
    },
  },
}
```

所有新建 agent 自动继承这些默认值，单个 agent 可覆盖。

#### 层3：Workspace 引导文件模板

**源码**: `src/agents/workspace.ts:321-459`

7 个引导文件自动创建（除非 `skipBootstrap: true`）：

| 文件           | 用途            | 自助化策略                                  |
| -------------- | --------------- | ------------------------------------------- |
| `AGENTS.md`    | 工作空间说明    | 平台通过 `agents.files.set` 写入定制版本    |
| `SOUL.md`      | Agent 人格/边界 | **核心模板** — 按角色预置（工艺/质量/通用） |
| `TOOLS.md`     | 工具使用指南    | 按空间资源配置自动生成                      |
| `IDENTITY.md`  | 名称/头像       | `agents.create` 时自动生成                  |
| `USER.md`      | 用户偏好        | 可选，平台注入用户画像                      |
| `HEARTBEAT.md` | 定时任务        | 按场景预置（巡检/报告/监控）                |
| `BOOTSTRAP.md` | 初始化仪式      | 预配置部署可跳过                            |

### 8.3 Docker API 批量管理可行性

**结论: ✅ 完全可行**

#### 批量操作接口设计

```typescript
class SpaceManager {
  // 批量创建空间（并行启动容器）
  async batchCreate(configs: SpaceConfig[]): Promise<SpaceInstance[]> {
    return Promise.all(configs.map(c => this.createSpace(c)));
  }

  // 单个空间创建：Docker API + 非交互初始化 + 模板 Agent
  async createSpace(config: SpaceConfig): Promise<SpaceInstance> {
    // 1. 预写配置文件（含 $include 模板引用）
    await this.writeSpaceConfig(config);

    // 2. Docker API 创建容器
    const container = await this.docker.createContainer({...});
    await container.start();

    // 3. 等待健康检查通过
    await this.waitForHealthy(container, { timeout: 30_000 });

    // 4. 连接 GatewayClient
    const client = await this.connectToInstance(config);

    // 5. 按模板创建预置 Agent
    for (const template of config.agentTemplates) {
      await this.createAgentFromTemplate(client, template);
    }

    return new SpaceInstance(config, container, client);
  }

  // 批量更新（如升级镜像版本）
  async batchUpgrade(spaceIds: string[], newImage: string) {
    for (const id of spaceIds) {
      await this.upgradeSpace(id, newImage);  // 逐个滚动升级
    }
  }
}
```

#### 容器生命周期 API

| 操作     | Docker API                      | 平台动作                     |
| -------- | ------------------------------- | ---------------------------- |
| 创建空间 | `docker.createContainer()`      | 预写配置 + 启动 + 初始化     |
| 启动空间 | `container.start()`             | 等待 /healthz + 建立 WS 连接 |
| 停止空间 | `container.stop()`              | 断开 WS + 保留数据卷         |
| 销毁空间 | `container.remove()`            | 归档数据卷 + 清理连接池      |
| 升级空间 | stop + create(newImage) + start | 滚动升级，复用数据卷         |
| 健康检查 | GET /healthz, /readyz           | 30s 间隔轮询                 |

### 8.4 "一键启用"模板 Agent 方案

**平台模板库设计**:

```typescript
// 平台维护的 Agent 模板
const AGENT_TEMPLATES = {
  "process-analyst": {
    name: "工艺分析助手",
    emoji: "🔧",
    soul: `你是金属3D打印工艺分析专家...`,
    tools: `## 可用工具\n- 查询工艺参数数据库\n- 分析打印缺陷图片...`,
    skills: ["process-analysis", "image-analysis"],
    model: "anthropic/claude-sonnet-4-20250514",
  },
  "quality-inspector": {
    name: "质量检测助手",
    emoji: "🔍",
    soul: `你是增材制造质量检测专家...`,
    tools: `## 可用工具\n- 查询质检记录\n- 对比标准规范...`,
    skills: ["quality-check", "standard-lookup"],
    model: "anthropic/claude-sonnet-4-20250514",
  },
  "personal-assistant": {
    name: "个人助手",
    emoji: "💡",
    soul: `你是一个通用的工作助手...`,
    tools: `## 可用工具\n- 文档搜索\n- 日程管理...`,
    skills: ["web-search", "calendar"],
    model: "anthropic/claude-sonnet-4-20250514",
  },
};
```

**自助化用户流程**:

```
部门负责人 → 平台 Web UI
  → 选择"创建协作空间"
  → 选择空间模板（工艺/质量/通用）
  → 自动完成：
    1. Docker 容器创建（20s）
    2. 非交互式初始化（5s）
    3. 模板 Agent 创建（3s/agent）
    4. 资源卷挂载配置
  → 邀请成员加入
  → 成员进入后即可对话
```

### 8.5 自助化的技术约束与建议

| 约束                               | 影响                      | 建议                                       |
| ---------------------------------- | ------------------------- | ------------------------------------------ |
| 每个容器需独立配置文件             | 不能多实例共享一个 config | 用 `$include` 共享基础模板，每实例覆盖差异 |
| onboarding 需 `--accept-risk`      | 自动化时需显式确认        | 平台自动传入此 flag                        |
| `agents.defaults.skipBootstrap`    | 跳过默认引导文件          | **推荐开启**，由平台通过 API 写入定制文件  |
| 配置文件路径固定（`~/.openclaw/`） | Docker 内必须挂载到此路径 | 通过 `OPENCLAW_CONFIG_PATH` 可覆盖         |
| Skill 安装需要联网                 | 容器内可能无法访问公网    | 预装到镜像或通过卷挂载                     |
| 无内置"空间模板"概念               | OpenClaw 不知道"空间"     | 模板逻辑在平台层实现                       |

### 8.6 结论

> **自助化完全可行**，OpenClaw 的 API 表面足够支撑"部门负责人自助创建空间 + 一键启用模板 Agent"的完整流程。
>
> **核心路径**: Docker API 创建容器 → 非交互式 onboarding → GatewayClient 连接 → `agents.create` + `agents.files.set` 写入模板 → `config.patch` 设置 skills/tools → 就绪。
>
> **平台需要自建**：模板库管理、端口池分配、token 生命周期管理、容器健康监控。OpenClaw 侧不需要任何改动。

---

## 附录：关键源码文件索引

| 组件                 | 文件路径                                   | 关键行号 |
| -------------------- | ------------------------------------------ | -------- |
| GatewayClient 类     | `src/gateway/client.ts`                    | 85-526   |
| 连接选项类型         | `src/gateway/client.ts`                    | 43-72    |
| 协议帧定义           | `src/gateway/protocol/schema/frames.ts`    | —        |
| agent RPC 处理器     | `src/gateway/server-methods/agent.ts`      | 169-838  |
| agents CRUD 处理器   | `src/gateway/server-methods/agents.ts`     | —        |
| chat RPC 处理器      | `src/gateway/server-methods/chat.ts`       | —        |
| send RPC 处理器      | `src/gateway/server-methods/send.ts`       | 89-360   |
| config RPC 处理器    | `src/gateway/server-methods/config.ts`     | 284-405  |
| skills RPC 处理器    | `src/gateway/server-methods/skills.ts`     | 146-204  |
| 热重载规则           | `src/gateway/config-reload-plan.ts`        | —        |
| 热重载执行器         | `src/gateway/server-reload-handlers.ts`    | 34-145   |
| Session key 格式     | `src/routing/session-key.ts`               | —        |
| Session key 解析     | `src/sessions/session-key-utils.ts`        | —        |
| 路由决策             | `src/routing/resolve-route.ts`             | —        |
| Session 存储         | `src/config/sessions/store.ts`             | —        |
| Session 维护         | `src/config/sessions/store-maintenance.ts` | —        |
| 网络绑定             | `src/gateway/net.ts`                       | 212-270  |
| 广播机制             | `src/gateway/server-broadcast.ts`          | 57-131   |
| RPC 方法注册         | `src/gateway/server-methods.ts`            | 66-95    |
| Dockerfile           | `Dockerfile`                               | 1-134    |
| Docker Compose       | `docker-compose.yml`                       | —        |
| Gateway CLI          | `src/cli/gateway-cli/run.ts`               | —        |
| $include 配置继承    | `src/config/includes.ts`                   | 1-347    |
| Agent 默认值类型     | `src/config/types.agent-defaults.ts`       | 120-326  |
| Workspace 引导初始化 | `src/agents/workspace.ts`                  | 321-459  |
| 引导文件模板         | `docs/reference/templates/*.md`            | —        |
| 非交互式 onboarding  | `src/cli/program/register.onboard.ts`      | 64-166   |
| 配置 CLI             | `src/cli/config-cli.ts`                    | 417-475  |
| 配置路径解析         | `src/config/paths.ts`                      | 133-152  |
| Skill 发现与加载     | `src/agents/skills/workspace.ts`           | —        |
| Docker 设置脚本      | `docker-setup.sh`                          | —        |
