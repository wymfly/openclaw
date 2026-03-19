# 企业 Agent 平台设计 — Claw Platform

> Date: 2026-03-10
> Status: Draft v2（团队头脑风暴后修订）
> Base: wymfly/openclaw `enhanced` branch + 独立新仓库 `claw-platform`
> 研究报告: `docs/plans/brainstorm-platform/01-architecture-review.md` | `02-product-strategy.md` | `03-domain-research.md`

## 决策背景

基于 OpenClaw 的 enhanced fork，为金属 3D 打印（增材制造）企业设计 **自助式** AI Agent 平台。核心诉求：

1. **企业自助**：让 AI Agent 住在企业环境中，为每个角落服务，而非只住在个人电脑里
2. **零门槛使用**：一线工程师在企微发消息即用，不需要知道"平台"的存在
3. **渐进式治理**：从空间隔离起步，按需引入资源分级和审计
4. **上游兼容**：Agent 层跟上游迭代，Platform 层完全解耦

## 核心原则

**Platform 层与 OpenClaw 完全解耦，独立仓库。**

- OpenClaw enhanced 分支专注 Agent 运行时（安全、稳定性、上游 rebase）
- claw-platform 是 OpenClaw 实例的外部管理者，通过 WebSocket RPC 通信
- 两个仓库唯一的交互：Docker 镜像 + Gateway Protocol

## 一、核心概念模型

### 四个实体

**User（用户）**

- 企业员工，通过企微通讯录自动同步，无需手动创建
- 有部门、职位归属（来自企微 API）
- 三种角色：普通员工 → 部门负责人 → IT 管理员
- 每个用户必有一个个人空间（容器模式，自动创建）

**Space（空间）**

- 等于一个 OpenClaw 实例
- 两种类型：个人空间（单用户）、协作空间（多用户）
- **个人空间默认使用容器模式**（服务器托管，24/7 可用）
- 员工电脑模式仅作为 IT/开发人员的高级选项（不保证可用性）
- 协作空间运行在服务器 Docker 容器
- 空间内所有 Agent 互信，共享空间资源
- 跨空间 Agent 无法交互

**Agent（AI 助手）**

- 由用户在其所属空间内创建（复用 OpenClaw `agents.create` API）
- 一个 Agent 只存在于一个空间
- 只有创建者能与之对话/派任务
- 权限 ≤ 创建者的平台权限（在空间资源配置阶段已约束）
- 可从**模板库**一键创建（预配置 SOUL.md/TOOLS.md/skills）

**Resource（平台资源）**

- 文档、数据库、API、工具、知识库
- 归属于业务域
- 配置到空间时变为空间资源，空间内自由使用

### 实体关系

```
企微通讯录 ──自动同步──→ User（部门、职位、负责人身份）
User 加入部门 ──规则引擎──→ 自动加入对应 Space

IT 管理员 ──创建空间──→ Space（选模板 → 配置资源 → 30s 自动部署）
部门负责人 ──管理成员──→ Space（审批、增减成员、查看统计）
普通员工 ──在空间内创建──→ Agent（从模板库选择或自定义）
普通员工 ──在企微对话──→ Agent（零学习成本）

Space ──运行为──→ OpenClaw Instance
Space ──包含──→ Resources（空间内自由使用）
Space ──容纳──→ Agents（来自不同用户）

Agent ──属于──→ 唯一的 Space
Agent ──创建者──→ 唯一的 User
```

### 四级自助化分层

| 级别                   | 用户群     | 能力                                        | 入口                     |
| ---------------------- | ---------- | ------------------------------------------- | ------------------------ |
| **Level 0** 对话即服务 | 所有人     | 在企微给 Agent 发消息，不感知"平台"         | 企微对话窗口             |
| **Level 1** 轻度自助   | 工程师     | 查看 Agent 列表、切换 Agent、创建简单 Agent | 企微消息命令 + 工作台 H5 |
| **Level 2** 部门管理   | 部门负责人 | 查看空间成员/使用统计、审批 Agent 请求      | 企微工作台 H5 管理页     |
| **Level 3** 平台管理   | IT 管理员  | 空间创建/销毁、资源配置、系统设置           | Web 管理后台 + CLI       |

## 二、平台网关与路由架构

### 整体消息流

```
平台网关 ──WebSocket──→ wss://openws.work.weixin.qq.com（企微长连接）
  │
  │ aibot_msg_callback 接收用户消息
  │
  ①识别用户（corpId + userId → platform userId）
  │
  ②查路由表（activeAgent? menu_selection? default?）
  │
  ③转发到目标 OpenClaw 实例（WebSocket RPC）
  │
  ④收到回复 → aibot_respond_msg（支持 stream 流式输出）
```

**为什么用 WebSocket 而非 Webhook**：

- 无需公网 IP（企微 WebSocket 是出站连接）
- 无 5 秒超时限制（Webhook 必须 5s 内响应）
- 支持 `msgtype=stream` 流式输出
- 保留 HTTP webhook 作为降级方案

### 平台网关职责

| 职责     | 说明                                                  |
| -------- | ----------------------------------------------------- |
| 用户认证 | 企微 corpId + userId → 平台用户身份                   |
| 路由决策 | 按优先级匹配，决定转发到哪个实例的哪个 agent          |
| 路由状态 | 维护每个用户的 activeAgent（粘性路由）                |
| 指令解析 | 识别平台指令（菜单操作、/switch 等）                  |
| 消息转发 | 用 WebSocket RPC 将消息发送到目标 OpenClaw 实例       |
| 回复回收 | 接收 OpenClaw 实例的回复，通过企微 WebSocket 流式回复 |

### 路由优先级

```
1. active_conversation → 当前粘性绑定的 Agent（最近对话的 Agent）
2. menu_selection      → 企微应用菜单 / Agent 目录页点击选择
3. agent_mention       → @工艺助手 显式指定
4. default             → 个人空间的默认 Agent（兜底）

阶段2 新增：
0. intelligent_route   → 智能路由（按问题内容自动匹配 Agent）
```

### Agent 发现与切换机制

**/switch 降为次要交互**，非 IT 用户不友好。主推以下方式：

| 方式              | 描述                                                | 优先级 |
| ----------------- | --------------------------------------------------- | ------ |
| **企微应用菜单**  | 底部菜单栏列出常用 Agent，点击即切换                | P0     |
| **Agent 目录页**  | 企微工作台 H5 页面，分类展示可用 Agent + 一句话描述 | P1     |
| **首次使用引导**  | 注册后推送欢迎卡片 + 3 个推荐 Agent + 示例问题      | P1     |
| 保留 /switch      | 高级用户快捷方式                                    | P2     |
| 智能路由（阶段2） | 用户直接提问，网关按内容自动路由到最合适的 Agent    | P2     |

### 平台指令（在网关层拦截，不转发给 OpenClaw）

```
/agents              → 列出我的所有 Agent（跨空间汇总）
/switch <agent名>    → 切换当前对话目标（高级用户快捷方式）
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

- 连接时携带 `role: "operator"`, `scopes: ["operator.admin"]`, `mode: "backend"`
- 用 `agent` RPC 方法发送消息给指定 agent
- 接收 `event` 帧获取 agent 回复（`stream: "assistant"` 为文本，`stream: "lifecycle"` 为状态）
- `idempotencyKey` 必填，30s 去重窗口

### 企业微信接入

企业微信通过平台网关的 WebSocket 长连接对接，不做成 OpenClaw 的 channel plugin：

```
企微 WebSocket Gateway (wss://openws.work.weixin.qq.com)
        ↕ aibot_subscribe / aibot_msg_callback / aibot_respond_msg
  平台网关
        ↕ WebSocket RPC (Gateway Protocol)
  OpenClaw 实例们
```

原因：企微消息需要先经过平台路由决策，不能直接送到某个 OpenClaw 实例。

**Markdown 降级策略**：企微 markdown 无代码块、无表格、无内嵌图片。

| AI 输出  | 降级方式                                                    |
| -------- | ----------------------------------------------------------- |
| 代码块   | text 消息 + 等宽格式，或上传为文件                          |
| 表格     | template_card 或转换为图片                                  |
| 复杂报告 | 生成 HTML/PDF 文件后通过 file 消息发送 + "在网页中查看"链接 |

## 三、空间生命周期与资源管理

### 空间类型

|          | 个人空间                       | 协作空间                  |
| -------- | ------------------------------ | ------------------------- |
| 成员     | 仅本人                         | 多用户                    |
| 创建者   | 平台自动创建（用户注册时）     | IT 管理员 / 部门负责人    |
| 运行环境 | **默认容器模式**（服务器托管） | 服务器 Docker 容器        |
| 资源     | 个人文件、个人工具             | 管理员配置的业务数据/工具 |
| 生命周期 | 随用户存在                     | 管理员管理                |
| 员工电脑 | 仅 IT/开发人员可选（高级选项） | 不支持                    |

### 空间模板与一键部署

**模板库**：预定义常用空间配置，降低创建门槛。

```yaml
templates:
  - id: process-workspace
    name: "工艺协作空间"
    description: "适用于工艺开发团队"
    config_include: "templates/process-base.json5" # $include 配置继承
    agents_defaults:
      model: "deepseek-chat"
      skipBootstrap: true # 由平台模板控制 Agent 人格
    preset_agents:
      - name: "工艺助手"
        soul: "templates/souls/process-engineer.md"
        tools: "templates/tools/process-tools.md"
        skills: ["process-analysis", "material-lookup"]
      - name: "文档助手"
        soul: "templates/souls/doc-helper.md"
        skills: ["doc-search"]
    volumes_template:
      - mount: /data/process-params
        mode: rw
        label: "工艺参数库（管理员填写实际路径）"
```

**一键部署流程**（~30 秒）：

```
选择模板 → Docker API 创建容器（~20s）
  → openclaw onboard --non-interactive --accept-risk（~5s）
  → GatewayClient 连接
  → agents.create + agents.files.set 写入模板文件（~3s/agent）
  → config.patch 设置 skills 白名单
  → 就绪，通知创建者
```

关键技术点：

- OpenClaw 支持 `--non-interactive` 全自动初始化
- `$include`（`src/config/includes.ts`）支持配置继承，多实例共享基础模板
- `agents.defaults` 提供全局 Agent 模板值
- `agents.defaults.skipBootstrap: true` 跳过默认引导，由平台模板控制

### 空间生命周期

**协作空间：**

```
管理员/负责人从模板创建空间
  → 一键部署（30s 自动完成容器+onboard+模板Agent）
  → 配置资源路径（挂载数据卷、开通 API 访问）
  → 添加成员（或通过企微部门自动同步）
  → 运行中...
  → 管理员可动态：调整资源 / 增减成员 / 更新配置（config.patch 热重载）
  → 管理员销毁空间（清理容器 + 数据归档）
```

**个人空间（默认容器模式）：**

```
员工加入企微 → 通讯录同步触发
  → 平台自动创建个人空间容器
  → 预装默认个人助手 Agent（从模板创建）
  → 用户在企微发消息即可使用
```

**个人空间（员工电脑模式，高级选项）：**

```
IT/开发人员在电脑上安装 OpenClaw
  → 运行 openclaw gateway run --bind lan --token <token>
  → 通过平台注册命令将实例注册到平台网关
  → 平台网关记录连接信息
  ⚠️ 不保证可用性：电脑关机/休眠/网络切换时 Agent 不可用
```

### 企微通讯录自动同步

```
组织架构变更（通讯录回调）
    ↓
平台接收变更事件（需通讯录管理 secret 权限）
    ↓
规则引擎匹配
  ├── 员工加入"工艺部" → 自动加入"工艺协作空间"
  ├── 员工离开"工艺部" → 自动移出空间
  ├── 新员工入职 → 自动创建个人空间
  ├── 员工离职 → 归档个人空间数据 + 清理
  └── is_leader_in_dept=1 → 赋予"部门负责人"角色
    ↓
更新空间成员表 + 通知相关方
```

### 资源配置示例

```yaml
space:
  id: "process-workspace"
  name: "工艺协作空间"
  type: collaboration
  template: "process-workspace" # 引用模板

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
users           → 用户信息（企微同步）、部门、角色
spaces          → 空间配置、类型、模板、运行状态
space_members   → 用户-空间映射（企微部门自动同步 + 手动管理）
agents          → Agent 注册信息（agentId, creatorUserId, spaceId）
routing_state   → 每个用户的 activeAgent、对话状态
instances       → OpenClaw 实例连接信息、心跳状态
templates       → 空间模板库、Agent 模板库
```

## 四、平台服务架构

### 系统组件

```
┌──────────────────────────────────────────────────────────────┐
│                    平台服务                                     │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │ 企业微信接入  │  │ 路由引擎      │  │ 空间/实例管理器    │    │
│  │ WebSocket    │  │              │  │                   │    │
│  │ 长连接客户端  │→│ 路由决策      │→│ WS 连接池管理      │    │
│  │ stream 流式  │←│ 指令解析      │←│ 实例健康检查       │    │
│  │ Markdown降级 │  │ 状态管理      │  │ 容器编排(Docker)   │    │
│  └──────────────┘  └──────────────┘  │ 模板部署(30s)     │    │
│                                       └───────────────────┘    │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │ 用户管理      │  │ Agent        │  │ 数据存储           │    │
│  │ 企微同步      │  │ 注册表       │  │ SQLite/PostgreSQL  │    │
│  │ 三级角色      │  │ 模板库       │  │                   │    │
│  │ 部门→空间映射 │  │ 跨空间索引   │  │                   │    │
│  └──────────────┘  └──────────────┘  └───────────────────┘    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐      │
│  │              管理界面                                  │      │
│  │  企微工作台 H5（L0-L2）/ Web 管理后台（L3）/ CLI     │      │
│  └──────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────┘
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
| Web 框架         | Hono 或 Fastify                      | 轻量，处理企微 WebSocket + 管理 API              |
| 数据库           | SQLite（阶段1）→ PostgreSQL（阶段2） | 起步简单，扩展时迁移                             |
| 容器编排         | Docker API（直接调用）               | 阶段1 不引入 K8s，单机 Docker 足够               |
| 与 OpenClaw 通信 | 复用 OpenClaw GatewayClient          | 已有成熟的 WebSocket RPC 客户端                  |
| 企微接入         | WebSocket 长连接（aibot 协议）       | 无需公网 IP、无 5s 超时、支持流式输出            |
| 企微消息加解密   | WXBizMsgCrypt TS 库（HTTP 降级用）   | 社区 TS 实现，企微官方无 Node.js SDK             |
| 管理界面         | 企微工作台 H5 + Web UI（React）      | 员工在企微内操作，管理员用 Web/CLI               |

### 代码仓库

```
claw-platform/                 ← 独立新仓库
  src/
    server.ts                  ← 平台服务入口
    wecom/                     ← 企业微信接入（WebSocket + HTTP 降级）
    router/                    ← 路由引擎（优先级匹配 + 粘性路由）
    spaces/                    ← 空间管理（Docker 编排 + 模板部署）
    users/                     ← 用户管理（企微同步 + 三级角色）
    agents/                    ← Agent 跨空间注册表 + 模板库
    store/                     ← 数据持久化（SQLite）
    admin/                     ← 管理后台（Web UI + CLI）
    h5/                        ← 企微工作台 H5 页面
  templates/                   ← 空间模板 + Agent 模板
    spaces/                    ← 空间配置模板（$include 格式）
    souls/                     ← Agent SOUL.md 模板
    tools/                     ← Agent TOOLS.md 模板
```

### 连接管理

平台网关维护到每个 OpenClaw 实例的 WebSocket 长连接：

```typescript
class InstancePool {
  private connections: Map<string, GatewayClient>; // spaceId → client

  async register(spaceId: string, endpoint: string, authToken: string) {
    const client = new GatewayClient({
      url: endpoint,
      token: authToken, // 直接顶级参数
      role: "operator",
      scopes: ["operator.admin"], // 带前缀格式
      mode: "backend",
      clientName: "claw-platform",
      onEvent: (evt) => this.handleEvent(spaceId, evt),
    });
    client.start();
    this.connections.set(spaceId, client);
  }

  async sendToAgent(spaceId: string, agentId: string, message: string, userId: string) {
    const client = this.connections.get(spaceId);
    return client.request("agent", {
      agentId,
      message,
      sessionKey: `agent:${agentId}:platform:${userId}`,
      idempotencyKey: crypto.randomUUID(),
    });
  }
}
```

**Agent 配置远程修改路径**（`agents.update` 仅支持 name/workspace/model/avatar）：

| 修改内容      | 推荐 API                                   | 热重载                  |
| ------------- | ------------------------------------------ | ----------------------- |
| 名称、模型    | `agents.update`                            | 动态生效                |
| Skills 白名单 | `config.patch`（修改 agents 配置树）       | 动态生效（`none` 响应） |
| 系统提示/人格 | `agents.files.set`（写 AGENTS.md/SOUL.md） | 下次对话生效            |
| 工具配置      | `agents.files.set`（写 TOOLS.md）          | 下次对话生效            |

## 五、安全与隔离模型

### 三层安全边界

```
┌─────────────────────────────────────────────────┐
│ 第1层：平台层                                     │
│   用户认证（企微自动）、空间准入、资源配置          │
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

- 用户认证：企微 corpId + userId → 平台用户身份（消息回调直接包含 FromUserName）
- OAuth 认证：仅用于 Web 管理后台登录（`snsapi_base` 静默授权）
- 空间准入：用户只能在已加入的空间内创建 Agent，路由时校验成员关系
- 资源配置：管理员创建空间时决定挂载哪些数据/API，空间内自由使用
- 三级角色：普通员工（使用）→ 部门负责人（空间管理）→ IT 管理员（全局管理）

### 权限模型演进

| 阶段  | 模型                    | 适用场景                           |
| ----- | ----------------------- | ---------------------------------- |
| MVP   | 纯空间隔离              | 空间按部门/项目划分，覆盖 80% 场景 |
| 阶段2 | 空间隔离 + 资源密级标签 | 应对客户专有数据、核心工艺参数     |
| 阶段3 | + 审计日志 + 合规报告   | 应对 ITAR/NDA 等合规要求           |

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
      - process-config:/home/node/.openclaw # 独立配置卷
    networks:
      - space-process-net # 独立网络命名空间
    mem_limit: 2g
    cpus: 1.0
    environment:
      HOME: /home/node
      OPENCLAW_GATEWAY_TOKEN: ${TOKEN_PROCESS}
    command: ["node", "dist/index.js", "gateway", "--bind", "lan", "--port", "18789"]
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:18789/healthz')"]
      interval: 30s
    init: true
    restart: unless-stopped
```

跨空间隔离保证：

- 不同空间的容器在不同 Docker network，无法互通
- 数据卷按空间隔离挂载
- 每个实例独立的 gateway token
- 平台网关是唯一的跨空间通信者

### 第3层：Agent 层安全

完全复用 OpenClaw 已有机制，无需平台额外干预：

- `SandboxConfig` (scope: agent) — Agent 执行沙箱
- `ExecApprovals` (deny/allowlist/full) — 命令执行审批
- `BoundaryPath` — 路径逃逸防护
- SSRF 双阶段防护 + Fetch Guard（enhanced 已有）
- `ExternalContent` — 提示注入防护

### 员工电脑模式（高级选项）

⚠️ 仅对 IT/开发人员开放，不保证可用性。

- 电脑关机/休眠时 Agent 不可用
- 平台通过注册时生成的 token 验证连接身份
- 安全由 OpenClaw 自身机制约束
- 平台需监控连接状态，离线时提示用户

## 六、技术风险与缓解

| #   | 风险                                                                                                             | 严重度 | 缓解方案                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------- |
| 1   | **单 WebSocket 连接瓶颈**：一个 GatewayClient 到一个实例共享一个连接，60+ 并发用户时可能成为瓶颈                 | 中     | 支持连接池（多个 GatewayClient 到同一实例），阶段1 单连接足够（< 10 用户） |
| 2   | **幂等性窗口仅 30 秒**：OpenClaw 的 `idempotencyKey` 去重窗口仅 30s，超过后重试不去重                            | 中     | 平台层维护自己的幂等逻辑（消息 ID → 处理状态映射）                         |
| 3   | **agent RPC 无发送方身份**：`agent` RPC 没有内置 "who sent this" 字段                                            | 低     | 通过 sessionKey 中的 userId 隔离 + extraSystemPrompt 注入"当前用户是 XXX"  |
| 4   | **Session 500 条目上限 + 30 天清理**：不活跃 30 天的会话自动清除，单存储文件最大 500 条目                        | 低     | 平台自建历史归档（定期快照 session 数据），监控 session 数量               |
| 5   | **无内置审计日志**：agent 消息交互没有集中审计，仅 `config.patch` 有审计日志                                     | 中     | 平台层自建审计日志（阶段2），记录所有消息流转                              |
| 6   | **Docker Hub 国内访问困难**：镜像拉取不稳定                                                                      | 中     | 提供 `docker save/load` 离线镜像包 + 内网镜像仓库方案                      |
| 7   | **企微 WebSocket 可用性**：`aibot_subscribe` 是否面向所有自建应用开放需确认                                      | 中     | 保留 HTTP webhook 作为降级方案，两种模式并存                               |
| 8   | **配置文件并发修改**：OpenClaw 配置是单个 JSON 文件，`config.patch` 有乐观锁（baseHash）但平台和内部可能同时修改 | 低     | 统一通过平台的 `config.patch` 修改，利用 baseHash 检测冲突并重试           |

## 七、部署模型与演进路径

### 阶段1：最小可用（< 10 用户）

```
一台服务器（8C16G 起）
├── claw-platform 服务
├── Docker 容器 × 2-3（协作空间，从模板创建）
├── Docker 容器 × N（容器模式个人空间）
├── SQLite 数据库
├── 模板目录
└── 数据卷目录

部署方式：docker-compose 一键启动
镜像来源：离线镜像包（docker save/load）
LLM：默认配置国内 API（DeepSeek/通义千问）
```

### 阶段2：团队规模（10-50 用户）

```
服务器 A（平台服务 + PostgreSQL + Web UI）
服务器 B（空间容器 + 共享数据卷）
企微通讯录自动同步
资源密级标签
审计日志
智能路由
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
- `claw-platform`：用户管理、空间编排、路由网关、企微接入、自助化、管理界面

### 初期开发顺序

| 优先级 | 模块                | 说明                                       |
| ------ | ------------------- | ------------------------------------------ |
| P0     | 平台骨架            | 服务启动、SQLite、配置                     |
| P0     | 企微 WebSocket 接入 | 长连接收消息、stream 流式回复、HTTP 降级   |
| P0     | 路由引擎            | 路由表、activeAgent、菜单选择              |
| P0     | 空间管理            | Docker API 创建/启停、模板部署（30s 流程） |
| P0     | 实例连接            | WebSocket 连接池、消息转发、回复回收       |
| P1     | 用户管理            | 企微通讯录同步、三级角色、部门→空间映射    |
| P1     | Agent 注册表        | 跨空间索引、模板库                         |
| P1     | 个人空间            | 容器自动创建 + 模板 Agent 预装             |
| P1     | Agent 发现          | 企微应用菜单 + 工作台 H5 Agent 目录        |
| P1     | 首次使用引导        | 欢迎卡片 + 推荐 Agent + 示例问题           |
| P2     | 管理后台            | Web UI + 部门负责人管理页                  |
| P2     | 监控告警            | 健康检查、连接状态、自动恢复               |
| P2     | 审计日志            | 消息流转记录、操作审计                     |
| P2     | Markdown 降级       | RichMessage 中间格式 + 按通道适配渲染      |
| P2     | 员工电脑注册        | 高级选项，仅 IT/开发人员                   |

## 附录：OpenClaw 代码 Review 关键发现

基于对 OpenClaw 源码的深入 review（详见 `docs/plans/brainstorm-platform/01-architecture-review.md`）：

### Agent 系统

- Agent 是一级配置对象，有独立 workspace/sessions/skills
- Session key 格式 `agent:<agentId>:<rest>` 天然按 agent 隔离
- 完整 CRUD API：`agents.create/update/delete/list` + `agents.files.*`
- 每个 agent 有独立工作目录：`~/.openclaw/state/agents/<agentId>/`
- 技能白名单：`agents[].skills: string[]`
- **`agents.update` 可修改**：name, workspace, model, avatar
- **`agents.update` 不可修改**：skills, prompt, sandbox, tools → 需用 `config.patch` 或 `agents.files.set`

### Gateway 与认证

- WebSocket RPC，2 种角色（operator/node），scope 格式带前缀（如 `operator.admin`）
- Plugin 可注册新 RPC 方法：`registerGatewayMethod(method, handler)`
- 认证模式：none/token/password/trusted-proxy
- 非 loopback 绑定强制要求 token 或 password
- `agent` RPC 异步两阶段：立即返回 `{status: "accepted", runId}`，完成后推送最终帧

### 配置与热重载

- hybrid 热重载模式：agents/skills/tools/bindings → `none`（动态读取）；hooks/models/cron → `hot`；plugins/gateway → `restart`
- `$include` 支持配置继承，10 级嵌套，深度合并
- `config.patch` 支持乐观锁（baseHash 防并发冲突）
- `agents.defaults` 提供全局模板值（model, timeout, skipBootstrap 等）

### 自动化部署

- `openclaw onboard --non-interactive --accept-risk` 支持全自动初始化
- Docker 支持成熟：Dockerfile、Docker Compose、健康检查（`/healthz`、`/readyz`）
- 容器内必须 `--bind lan`（0.0.0.0，不能 loopback）

### 沙箱与安全

- Docker sandbox：`scope: session|agent|shared`，`workspaceAccess: none|ro|rw`
- 默认安全配置：`readOnlyRoot: true`，`capDrop: ALL`，`network: none`
- `ExecApprovals` 框架支持 per-agent 配置
- enhanced 分支已有 SSRF 双阶段防护、Fetch Guard、外部内容安全

### 竞品验证

- Coze（扣子）的"扣子空间"概念验证了空间模型可行性
- Copilot Studio 的 Environment + Agent 级角色（Owner/Editor/Viewer）可借鉴
- 百度千帆 AppBuilder 私有化版的细粒度权限和混合云模式可参考
- 行业最佳实践（ISACA/KPMG）：唯一身份、最小权限、零信任、审计可追溯

### 三平台统一抽象（企微/钉钉/飞书）

三者都支持 WebSocket 长连接，可定义统一 `ChannelAdapter` 接口：

```typescript
interface ChannelAdapter {
  connect(): Promise<void>;
  onMessage(handler: (msg: IncomingMessage) => void): void;
  sendText(userId: string, content: string): Promise<void>;
  sendMarkdown(userId: string, content: string): Promise<void>;
  sendFile(userId: string, fileUrl: string): Promise<void>;
  resolveUser(channelUserId: string): Promise<PlatformUser>;
}
```

差异点通过适配层处理：Markdown 降级渲染、卡片格式转换、文件上传方式、认证流程。
企微 markdown 能力最弱（无代码块/表格），需以其为"最低公分母"或分层渲染。
