# 企业 Agent 平台设计 — Claw Platform

> Date: 2026-03-10
> Status: Draft
> Base: wymfly/openclaw `enhanced` branch + 独立新仓库 `claw-platform`

## 决策背景

基于 OpenClaw 的 enhanced fork，为金属 3D 打印（增材制造）企业设计 AI Agent 平台。核心诉求：

1. **企业治理**：工具、文档不可被个人助手随意获取，一切操作在统一平台上白盒进行
2. **协作能力**：不同角色的 Agent 在共享工作空间中协作
3. **上游兼容**：Agent 层跟上游迭代，Platform 层完全解耦

## 核心原则

**Platform 层与 OpenClaw 完全解耦，独立仓库。**

- OpenClaw enhanced 分支专注 Agent 运行时（安全、稳定性、上游 rebase）
- claw-platform 是 OpenClaw 实例的外部管理者，通过 WebSocket RPC 通信
- 两个仓库唯一的交互：Docker 镜像 + Gateway Protocol

## 一、核心概念模型

### 四个实体

**User（用户）**

- 企业员工，有部门、角色归属
- 由平台管理员创建和管理
- 拥有对平台资源的访问权限（由管理员分配）
- 每个用户必有一个个人空间

**Space（空间）**

- 等于一个 OpenClaw 实例
- 两种类型：个人空间（单用户）、协作空间（多用户）
- 个人空间可运行在员工电脑或 Docker 容器
- 协作空间运行在服务器 Docker 容器
- 空间内所有 Agent 互信，共享空间资源
- 跨空间 Agent 无法交互

**Agent（AI 助手）**

- 由用户在其所属空间内创建（复用 OpenClaw `agents.create` API）
- 一个 Agent 只存在于一个空间
- 只有创建者能与之对话/派任务
- 权限 ≤ 创建者的平台权限（在空间资源配置阶段已约束）

**Resource（平台资源）**

- 文档、数据库、API、工具、知识库
- 归属于业务域
- 配置到空间时变为空间资源，空间内自由使用

### 实体关系

```
Platform Admin ──分配权限──→ User
Platform Admin ──创建空间──→ Space
Platform Admin ──配置资源──→ Space
Platform Admin ──添加成员──→ Space

User ──加入──→ Space（可加入多个）
User ──在空间内创建──→ Agent
User ──通过平台网关对话──→ Agent

Space ──运行为──→ OpenClaw Instance
Space ──包含──→ Resources（空间内自由使用）
Space ──容纳──→ Agents（来自不同用户）

Agent ──属于──→ 唯一的 Space
Agent ──创建者──→ 唯一的 User
```

## 二、平台网关与路由架构

### 整体消息流

```
企业微信 ──webhook──→ 平台网关
                        │
                   ①识别用户（corpId + userId → platform userId）
                        │
                   ②查路由表（activeAgent? explicit command? default?）
                        │
                   ③转发到目标 OpenClaw 实例
                        │
                   ④收到回复，返回企业微信
```

### 平台网关职责

| 职责     | 说明                                            |
| -------- | ----------------------------------------------- |
| 用户认证 | 企业微信 userId → 平台用户身份                  |
| 路由决策 | 按优先级匹配，决定转发到哪个实例的哪个 agent    |
| 路由状态 | 维护每个用户的 activeAgent（粘性路由）          |
| 指令解析 | 识别 `/switch`、`/agents`、`/spaces` 等平台指令 |
| 消息转发 | 用 WebSocket RPC 将消息发送到目标 OpenClaw 实例 |
| 回复回收 | 接收 OpenClaw 实例的回复，转发回企业微信        |

### 路由优先级（借鉴 OpenClaw 的 AgentBinding 模式）

```
1. active_conversation → 当前粘性绑定的 Agent（最近对话的 Agent）
2. explicit_command    → /switch <agent名> 或菜单选择
3. agent_mention       → @工艺助手 显式指定
4. default             → 个人空间的默认 Agent（兜底）
```

### 平台指令（在网关层拦截，不转发给 OpenClaw）

```
/agents              → 列出我的所有 Agent（跨空间汇总）
/switch <agent名>    → 切换当前对话目标
/spaces              → 列出我加入的所有空间
/current             → 显示当前对话的 Agent 和所在空间
```

### 网关与 OpenClaw 实例的通信

平台网关作为 OpenClaw 的 operator 客户端连接各实例：

```
平台网关 ──WebSocket──→ OpenClaw 实例 A（工艺空间）
         ──WebSocket──→ OpenClaw 实例 B（质量空间）
         ──WebSocket──→ OpenClaw 实例 C（个人空间）
```

通信协议直接复用 OpenClaw 已有的 WebSocket RPC：

- 连接时携带 `role: "operator"`, `scopes: ["admin", "read", "write"]`
- 用 `agent` RPC 方法发送消息给指定 agent
- 接收 `event` 帧获取 agent 回复

### 企业微信接入

企业微信作为外部通道，由平台网关直接对接，不做成 OpenClaw 的 channel plugin：

```
企业微信 API ←→ 平台网关（HTTP webhook + 回调）
                    ↕
              OpenClaw 实例们（WebSocket RPC）
```

原因：企业微信消息需要先经过平台路由决策，不能直接送到某个 OpenClaw 实例。

## 三、空间生命周期与资源管理

### 空间类型

|          | 个人空间                           | 协作空间                  |
| -------- | ---------------------------------- | ------------------------- |
| 成员     | 仅本人                             | 多用户（管理员添加）      |
| 创建者   | 平台自动创建（用户注册时）         | 平台管理员手动创建        |
| 运行环境 | 员工电脑（配置连接）或 Docker 容器 | 服务器 Docker 容器        |
| 资源     | 个人文件、个人工具                 | 管理员配置的业务数据/工具 |
| 生命周期 | 随用户存在                         | 管理员管理                |

### 空间生命周期

**协作空间：**

```
管理员创建空间
  → 配置资源（挂载数据卷、开通 API 访问、预装工具）
  → 启动 OpenClaw 实例（Docker 容器）
  → 添加成员（用户加入后可在空间内创建 Agent）
  → 运行中...
  → 管理员可动态：调整资源 / 增减成员 / 更新配置
  → 管理员销毁空间（清理容器 + 数据归档）
```

**个人空间（容器模式）：**

```
用户注册
  → 平台自动创建个人空间容器
  → 预装默认配置和个人助手 Agent
  → 用户使用
```

**个人空间（员工电脑模式）：**

```
用户在电脑上安装 OpenClaw
  → 运行 openclaw gateway run
  → 通过平台注册命令将实例注册到平台网关
  → 平台网关记录连接信息
  → 用户的个人空间 = 自己的电脑
```

### 资源配置示例

```yaml
space:
  id: "process-workspace"
  name: "工艺协作空间"
  type: collaboration

  volumes:
    - host: /data/process-params
      mount: /data/process-params
      mode: rw
    - host: /data/equipment-logs
      mount: /data/equipment-logs
      mode: ro
    - host: /data/material-db
      mount: /data/material-db
      mode: ro

  apis:
    - name: mes-system
      endpoint: http://internal-mes:8080
    - name: erp-query
      endpoint: http://internal-erp:8080/readonly

  skills:
    - process-analysis
    - material-lookup

  members:
    - userId: xiaowang
    - userId: zhangjie
    - userId: lizong
```

### 平台管控面存储

```
users           → 用户信息、部门、角色、资源权限
spaces          → 空间配置、类型、运行状态
space_members   → 用户-空间映射
agents          → Agent 注册信息（agentId, creatorUserId, spaceId）
routing_state   → 每个用户的 activeAgent、对话状态
instances       → OpenClaw 实例连接信息、心跳状态
```

## 四、平台服务架构

### 系统组件

```
┌──────────────────────────────────────────────────────┐
│                    平台服务                            │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ 企业微信  │  │ 路由引擎  │  │ 空间/实例管理器    │  │
│  │ 接入层   │  │          │  │                   │  │
│  │ webhook  │→│ 路由决策  │→│ WS 连接池管理      │  │
│  │ 回调发送  │←│ 指令解析  │←│ 实例健康检查       │  │
│  └──────────┘  │ 状态管理  │  │ 容器编排(Docker)   │  │
│                └──────────┘  └───────────────────┘  │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ 用户管理  │  │ Agent    │  │ 数据存储           │  │
│  │ 注册/认证 │  │ 注册表   │  │ SQLite/PostgreSQL  │  │
│  │ 权限分配  │  │ 跨空间索引│  │                   │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │              管理后台 (Web UI)                 │    │
│  │  用户管理 / 空间管理 / Agent 概览 / 系统监控   │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
         │               │               │
    WebSocket        WebSocket       WebSocket
         ↓               ↓               ↓
   ┌──────────┐   ┌──────────┐   ┌──────────┐
   │ OpenClaw │   │ OpenClaw │   │ OpenClaw │
   │ 工艺空间  │   │ 质量空间  │   │ 个人空间  │
   └──────────┘   └──────────┘   └──────────┘
```

### 技术选型

| 组件             | 选型                                 | 理由                                             |
| ---------------- | ------------------------------------ | ------------------------------------------------ |
| 平台服务         | TypeScript + Node.js                 | 与 OpenClaw 同技术栈，可复用类型定义和 WS 客户端 |
| Web 框架         | Hono 或 Fastify                      | 轻量，处理企业微信 webhook + 管理 API            |
| 数据库           | SQLite（阶段1）→ PostgreSQL（阶段2） | 起步简单，扩展时迁移                             |
| 容器编排         | Docker API（直接调用）               | 阶段1 不引入 K8s，单机 Docker 足够               |
| 与 OpenClaw 通信 | 复用 OpenClaw GatewayClient          | 已有成熟的 WebSocket RPC 客户端                  |
| 企业微信 SDK     | `@wecom/bot` 或直接 HTTP API         | 接收消息 + 发送回复                              |
| 管理后台         | 阶段1 CLI，阶段2 Web UI（React）     | 渐进式                                           |

### 代码仓库

```
claw-platform/                 ← 独立新仓库
  src/
    server.ts                  ← 平台服务入口
    wecom/                     ← 企业微信接入
    router/                    ← 路由引擎
    spaces/                    ← 空间管理（Docker 容器编排）
    users/                     ← 用户管理
    agents/                    ← Agent 跨空间注册表
    store/                     ← 数据持久化
    admin/                     ← 管理后台
```

### 连接管理

平台网关维护到每个 OpenClaw 实例的 WebSocket 长连接：

```typescript
class InstancePool {
  private connections: Map<string, GatewayClient>; // spaceId → client

  async register(spaceId: string, endpoint: string, authToken: string) {
    const client = new GatewayClient({
      url: endpoint,
      role: "operator",
      scopes: ["admin", "read", "write"],
      auth: { token: authToken },
    });
    await client.connect();
    this.connections.set(spaceId, client);
  }

  async sendToAgent(spaceId: string, agentId: string, message: string, userId: string) {
    const client = this.connections.get(spaceId);
    return client.rpc("agent", {
      agentId,
      message,
      sessionKey: `agent:${agentId}:platform:${userId}`,
    });
  }
}
```

## 五、安全与隔离模型

### 三层安全边界

```
┌─────────────────────────────────────────────────┐
│ 第1层：平台层                                     │
│   用户认证、空间准入、资源配置                      │
│   "谁能进哪个空间，空间里有什么"                    │
├─────────────────────────────────────────────────┤
│ 第2层：空间层（OpenClaw 实例边界）                  │
│   容器隔离、卷挂载、网络策略                        │
│   "空间之间物理隔离，互不可见"                      │
├─────────────────────────────────────────────────┤
│ 第3层：Agent 层（OpenClaw 内部安全机制）            │
│   沙箱、执行审批、边界路径防护、SSRF 防护           │
│   "Agent 执行操作时的安全防线"                     │
└─────────────────────────────────────────────────┘
```

### 第1层：平台层安全

- 用户认证：企业微信 OAuth → 平台用户身份，平台内部 JWT
- 空间准入：用户只能在已加入的空间内创建 Agent，路由时校验成员关系
- 资源配置：管理员创建空间时决定挂载哪些数据/API，空间内自由使用

### 第2层：空间层隔离

每个协作空间是独立的 Docker 容器：

```yaml
services:
  space-process:
    image: openclaw:enhanced
    read_only: true
    cap_drop: [ALL]
    security_opt:
      - no-new-privileges:true
    volumes:
      - process-data:/data:rw
    networks:
      - space-process-net # 独立网络命名空间
    mem_limit: 2g
    cpus: 1.0
```

跨空间隔离保证：

- 不同空间的容器在不同 Docker network，无法互通
- 数据卷按空间隔离挂载
- 平台网关是唯一的跨空间通信者

### 第3层：Agent 层安全

完全复用 OpenClaw 已有机制，无需平台额外干预：

- `SandboxConfig` (scope: agent) — Agent 执行沙箱
- `ExecApprovals` (deny/allowlist/full) — 命令执行审批
- `BoundaryPath` — 路径逃逸防护
- SSRF 双阶段防护 + Fetch Guard（enhanced 已有）
- `ExternalContent` — 提示注入防护

### 员工电脑模式

员工电脑模式下，平台只能信任连接，安全由 OpenClaw 自身机制约束。平台通过注册时生成的 token 验证连接身份。

## 六、部署模型与演进路径

### 阶段1：最小可用（< 10 用户）

```
一台服务器（8C16G 起）
├── claw-platform 服务
├── Docker 容器 × 2-3（协作空间）
├── Docker 容器 × N（容器模式个人空间）
├── SQLite 数据库
└── 数据卷目录

员工电脑（可选）
└── OpenClaw 实例（个人空间）
```

### 阶段2：团队规模（10-50 用户）

```
服务器 A（平台服务 + PostgreSQL + Web UI）
服务器 B（空间容器 + 共享数据卷）
员工电脑 × N（个人空间）
```

### 阶段3：规模化（50+ 用户，远期按需设计）

### 与 OpenClaw enhanced 分支的关系

```
openclaw (wymfly/openclaw)
├── main           ← 跟踪上游
└── enhanced       ← Agent 层增强，不包含 Platform 层代码

claw-platform (新仓库)
├── 依赖 openclaw enhanced 的 Docker 镜像
└── 通过 WebSocket RPC（Gateway Protocol）通信
```

职责分离：

- `openclaw enhanced`：Agent 能力、安全加固、通道稳定性、上游 rebase
- `claw-platform`：用户管理、空间编排、路由网关、企业微信接入、管理后台

### 初期开发顺序

| 优先级 | 模块         | 说明                         |
| ------ | ------------ | ---------------------------- |
| P0     | 平台骨架     | 服务启动、数据库、配置       |
| P0     | 企业微信接入 | webhook 收消息、发回复       |
| P0     | 路由引擎     | 路由表、activeAgent、/switch |
| P0     | 空间管理     | Docker API 创建/启停容器     |
| P0     | 实例连接     | WebSocket 连接池、消息转发   |
| P1     | 用户管理     | 注册、权限、空间成员         |
| P1     | Agent 注册表 | 跨空间索引                   |
| P1     | 个人空间     | 容器自动创建 + 电脑注册      |
| P1     | 平台指令     | /agents, /spaces, /current   |
| P2     | 管理后台     | Web UI                       |
| P2     | 监控告警     | 健康检查、自动恢复           |
| P2     | 审计日志     | 操作记录                     |

## 附录：OpenClaw 代码 Review 关键发现

基于对 OpenClaw 源码的深入 review，以下是与企业平台直接相关的架构要点：

### Agent 系统

- Agent 是一级配置对象，有独立 workspace/sessions/skills
- Session key 格式 `agent:<agentId>:<rest>` 天然按 agent 隔离
- 完整 CRUD API：`agents.create/update/delete/list` + `agents.files.*`
- 每个 agent 有独立工作目录：`~/.openclaw/state/agents/<agentId>/`
- 技能白名单：`agents[].skills: string[]`

### Gateway 与认证

- WebSocket RPC，2 种角色（operator/node），5 层 scope
- Plugin 可注册新 RPC 方法：`registerGatewayMethod(method, handler)`
- 认证模式：none/token/password/trusted-proxy
- 无内置多实例管理，每个实例独立

### 路由系统

- `AgentBinding` 7 层优先级匹配（peer → guild+roles → guild → team → account → channel → default）
- 路由在实例内部完成，跨实例路由需平台层实现

### 沙箱与安全

- Docker sandbox：`scope: session|agent|shared`，`workspaceAccess: none|ro|rw`
- 默认安全配置：`readOnlyRoot: true`，`capDrop: ALL`，`network: none`
- `ExecApprovals` 框架支持 per-agent 配置
- enhanced 分支已有 SSRF 双阶段防护、Fetch Guard、外部内容安全

### 配置系统

- hybrid 热重载模式，支持 hot/restart/none 三种响应
- `$include` 支持配置拆分
- Secret 管理支持 1Password 等外部存储
