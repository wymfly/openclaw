# Claw Platform Design — 商业交付平台

> Date: 2026-02-28
> Status: Draft
> Base: wymfly/openclaw `enhanced` branch (OpenClaw fork)

## 决策背景

对比 5 个 Claw 系列项目（OpenClaw 238K★、Clawlet 670★、AssistClaw、Clawkido、Clawzero）后，选定 **OpenClaw** 作为基座，原因：

1. 50+ 通道生态和成熟的 Skill 分发机制是不可替代的护城河
2. `enhanced` 分支已移植安全加固（SSRF 双阶段防护、Fetch Guard、环境变量安全）、渠道稳定性（统一重试、Discord/Telegram/Signal 修复）、Windows 全平台适配
3. 238K stars 上游社区持续输入 agent 能力，通过定期 rebase 获取

## 核心原则

**Agent 层跟上游，Platform 层自己做。**

- OpenClaw 作为个人助手项目，永远不会做 Fleet 管控、多租户、私有 SkillHub
- Agent 能力（MCP、记忆、路由、安全）由上游迭代，`enhanced` 分支定期 rebase `upstream/main`
- 所有 Platform 层代码集中在 `src/fleet/`、`src/skillhub/` 新目录
- 与上游的唯一交互方式是 Gateway RPC 接口和 Plugin 扩展点，不碰 agent/gateway/channel 核心模块
- 最大化上游 rebase 的顺滑度

### 与上游的隔离边界

```
上游代码（rebase 更新，不修改）:
  src/gateway/          — 网关核心
  src/agents/           — Pi Agent 运行时
  src/channels/         — 通道适配器
  src/plugins/          — 插件框架
  src/config/           — 配置系统

[enhanced] 安全/稳定性增量（已移植，最小侵入）:
  src/infra/net/ssrf.ts, fetch-guard.ts   — SSRF 防护
  src/security/                            — 安全模块
  src/infra/retry.ts, retry-policy.ts     — 统一重试

[enhanced] Platform 层（纯新增，零上游冲突）:
  src/fleet/            — Fleet 管控面（NEW）
  src/skillhub/         — 私有 SkillHub（NEW）
```

## 架构分层

```
+--------------------------------------------------+
|  Claw Platform (管控面)                           |
|  +----------+---------+----------+-----------+   |
|  | Fleet API| Tenant  | Skill    | Health    |   |
|  | 主机注册 | 租户管理 | 包管理   | 监控告警  |   |
|  +----------+---------+----------+-----------+   |
|              | Gateway RPC (fleet.* 方法族)        |
+--------------------------------------------------+
|  Claw Host x N (执行面 = OpenClaw 实例)            |
|  +----------+---------+----------+-----------+   |
|  | Gateway  | Channels| Agent    | Skills    |   |
|  | 网关核心 | 50+ 通道| Pi Agent | 领域技能包 |   |
|  +----------+---------+----------+-----------+   |
+--------------------------------------------------+
|  Skill Registry (交付层)                          |
|  +----------------------------------------------+|
|  | 私有 SkillHub: 客户专属领域技能包分发          ||
|  | 版本管理 / 依赖声明 / 灰度发布                ||
|  +----------------------------------------------+|
+--------------------------------------------------+
```

## 集成点（基于 OpenClaw 实际架构）

Platform 层通过以下已有接口与执行面集成，不修改上游代码：

| 集成点           | 上游接口                                             | Platform 用法                    |
| ---------------- | ---------------------------------------------------- | -------------------------------- |
| **RPC 方法扩展** | `OpenClawPluginGatewayMethod` 注册机制               | Fleet 注册 `fleet.*` 方法族      |
| **技能管理**     | `skills.status / skills.install / skills.update` RPC | 远程安装/升级 Tenant Skill Pack  |
| **通道健康**     | `ChannelHealthMonitor` + `ChannelRuntimeSnapshot`    | 聚合各 Host 通道状态             |
| **心跳事件**     | `emitHeartbeatEvent()` + `last-heartbeat` RPC        | Host 活跃度检测                  |
| **配置热重载**   | `GatewayConfigReloader` (hybrid 模式)                | 远程下发配置变更                 |
| **插件发现**     | `PluginRegistry` 查询                                | 库存盘点已安装技能/工具          |
| **认证体系**     | `operator / node / admin` 角色模型                   | Fleet 使用 `admin` 角色管理 Host |

### RPC 方法扩展示例

Fleet 通过 Plugin 机制注册管控方法，零侵入上游代码：

```typescript
// src/fleet/gateway-methods.ts — Platform 层注册的 RPC 方法
import type { OpenClawPluginGatewayMethod } from "openclaw/plugin-sdk";

export const fleetGatewayMethods: OpenClawPluginGatewayMethod[] = [
  { method: "fleet.register", handler: handleHostRegister },
  { method: "fleet.heartbeat", handler: handleFleetHeartbeat },
  { method: "fleet.deploy", handler: handleSkillDeploy },
  { method: "fleet.config", handler: handleConfigSync },
  { method: "fleet.status", handler: handleFleetStatus },
];
```

## 模块设计

### 1. Tenant Skill Pack

Skill 包是商业交付的核心载体。扩展 OpenClaw 已有的三级 Skill 体系：

```
Skill 层级:
  Bundled Skills    — 随 OpenClaw 发行的内置技能
  ClawHub Skills    — 公共市场（已有 5700+ 技能）
  Workspace Skills  — 本地开发（已有）
  Tenant Skills     — 客户专属领域包（新增）
```

Tenant Skill Pack 遵循 OpenClaw 的 `SkillEntry` + `OpenClawSkillMetadata` 类型规范：

```
tenant-skill-pack/
  manifest.json          # 扩展 OpenClawSkillMetadata：名称、版本、依赖、兼容性
  skills/
    industry-qa/SKILL.md
    doc-analysis/SKILL.md
    workflow-auto/SKILL.md
  config/
    channels.json        # 预配置的通道模板
    routing.json         # 路由规则模板
    agent-profile.json   # Agent 人设与行为配置
  assets/                # 静态资源（提示词模板、知识库索引等）
```

### 2. 私有 SkillHub

类似 npm private registry，HTTP API 提供 publish / install / update。

```
src/skillhub/
  server.ts              # HTTP API 服务
  storage.ts             # 包存储（本地文件系统 / S3）
  registry.ts            # 版本索引和兼容性矩阵
  publish.ts             # 打包发布流程
  install.ts             # 客户端拉取安装
```

- 语义版本 + 兼容性矩阵（skill pack 版本 <-> OpenClaw 版本）
- 灰度发布：可按客户分组推送新版本
- 交付流程：打包 Skill Pack → 发布到私有 SkillHub → Claw Host 通过 `skills.install` RPC 拉取 → 热加载生效

### 3. Fleet 管控面

```
src/fleet/
  api.ts                 # Fleet RPC 方法实现
  tenant.ts              # 租户管理（客户→主机映射、密钥）
  deployer.ts            # 远程 Skill Pack 安装/升级/回滚
  health.ts              # 聚合健康指标（复用 ChannelHealthMonitor 事件）
  config-sync.ts         # 集中配置管理（通过 GatewayConfigReloader）
  store.ts               # SQLite 存储租户元数据
  gateway-methods.ts     # 注册 fleet.* RPC 方法族
```

| 模块           | 职责                              | 实现策略                                              |
| -------------- | --------------------------------- | ----------------------------------------------------- |
| Fleet API      | 主机注册、心跳、在线状态          | 通过 Plugin 机制注册 `fleet.*` RPC 方法               |
| Tenant Manager | 客户→主机映射、配置模板、密钥管理 | SQLite 存储，`admin` 角色认证                         |
| Skill Deployer | 远程安装/升级/回滚 Skill Pack     | 通过 `skills.install` RPC 下发，Host 从 SkillHub 拉取 |
| Health Monitor | 聚合各 Host 的健康指标、告警      | 订阅 `heartbeat` 事件 + `ChannelRuntimeSnapshot`      |
| Config Sync    | 集中管理配置，下发到各 Host       | 通过 `GatewayConfigReloader` hybrid 模式热更新        |

### 4. 部署模型

```
阶段 1（<10 客户）:
  一台 OpenClaw 实例既当管控面又当执行面
  启用 fleet 插件即可

阶段 2（10-100 客户）:
  独立的 Platform Server + N 台 Claw Host
  Platform Server 是精简版 OpenClaw（只启用 fleet + skillhub 模块 + Web UI）
```

## 路线图

| 优先级 | 自研（Platform 层）                 | 跟上游（Agent 层）                     |
| ------ | ----------------------------------- | -------------------------------------- |
| P0     | Fleet API + Tenant Manager          | 定期 rebase `upstream/main`            |
| P0     | Skill Pack 打包规范 + 私有 SkillHub | 合并上游 MCP (mcporter)                |
| P1     | Health Monitor + Config Sync        | 合并上游 memory 增强                   |
| P1     | 客户 Onboarding 自动化              | 合并上游 agent 能力演进                |
| P2     | Web Dashboard (Fleet 视图)          | 合并上游性能优化                       |
| 持续   | —                                   | 定期 rebase（参见 AGENTS.md 同步流程） |

## 上游合并策略

已在 `enhanced` 分支建立标准流程（详见 AGENTS.md "Enhanced Fork — 上游同步流程"）：

- Platform 层代码集中在 `src/fleet/`、`src/skillhub/`（纯新增目录，rebase 零冲突）
- 安全/稳定性增量已移植为独立 `[enhanced]` commit，对上游文件修改控制在 20 行/文件以内
- 仅通过 Gateway RPC 接口和 Plugin 扩展点与执行面交互
- 同步频率：周级或双周级 rebase

### Commit 规范

```
[enhanced] feat: ...   — 安全/稳定性增量（已有）
[enhanced] feat: ...   — Platform 层功能
[enhanced] fix: ...    — Platform 层修复
```

## 竞品特性参考（仅观察，不主动实现）

| 特性                 | 来源             | 状态                             |
| -------------------- | ---------------- | -------------------------------- |
| MCP 双向集成         | AssistClaw       | 上游已有 mcporter，等合并        |
| 智能模型路由         | AssistClaw Plano | 观察上游是否跟进                 |
| 三层记忆架构         | AssistClaw       | 上游 memory 模块在演进           |
| Skill 懒加载         | AssistClaw       | 可在 SkillHub 层实现，不碰 agent |
| Actor 群体编排       | Clawkido         | P2 长期方向                      |
| Plan-Execute-Reflect | AssistClaw       | 观察上游 Pi Agent 演进           |
