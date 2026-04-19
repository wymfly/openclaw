# deck-go Gateway 受管生命周期设计

**日期**: 2026-04-19  
**状态**: 设计完成，待实施

## 1. 概述

本设计定义 `deck-go` 在新 control-plane 架构下的第一条关键实现主线：

- `deck-go` 作为 `OpenClaw runtime` 之上的 Go 控制面
- `deck-go` 自己负责维护一个本地 Gateway 子进程
- React 前端继续作为完整的 Deck 界面层

这不是旧 `Next/Node` Deck runtime 的路径兼容迁移，也不是“远程 URL 客户端”的简单改写。

本设计的目标是先把 `deck-go` 的后端身份真正立住，让它成为：

- 受管 Gateway 的生命周期管理者
- Deck 的控制面 API 所有者
- Gateway runtime 与 React 前端之间的稳定适配层

## 2. 背景与问题

当前 `deck-go` 已经具备以下基础能力：

- 本地 settings 持久化
- 访问控制
- Gateway RPC façade
- 聊天与流式基础链路
- 最小 React 前端与静态托管

但当前实现仍然存在明显的旧迁移痕迹：

1. `gateway.Client` 仍然更像“直连外部 Gateway URL 的客户端”
2. backend surface 仍然保留了较多 route-by-route 兼容思维
3. `/api/bootstrap/status` 更像连通性探针，而不是控制面总览
4. `deck-go` 还没有真正承担 Gateway 生命周期管理

这会导致 `deck-go` 虽然能跑，但后端角色不够饱满，无法真正解决：

- 安装与部署复杂
- 重启与恢复链路薄弱
- Node/Next runtime 曾承担的本地控制面职责还没被 Go 后端接住
- 后续实现容易继续沿“兼容旧 API 形状”的方向滑回去

## 3. 设计目标

### 3.1 主目标

- 让 `deck-go` 成为本地 Gateway 的受管控制面
- 让 `deck-go` 后端 API 从“兼容旧路由”转为“表达新 control-plane 语义”
- 让 React 前端继续保持现有 Deck 页面和交互体验
- 为后续安装、部署、重启、升级链路打下真实基础

### 3.2 非目标

- 不重写 `OpenClaw runtime`
- 不把 `deck-go` 变成第二个 runtime
- 不在 phase 1 引入桌面壳
- 不追求旧 `dashboard/src/app/api/**` 路由的形状兼容
- 不为兼容旧 Next/Node 实现而长期保留无必要的后端路径

## 4. 核心架构定位

### 4.1 分层边界

- `OpenClaw runtime`
  - runtime truth
  - protocol truth
  - config truth
  - session effects
- `deck-go`
  - control plane
  - runtime adapter
  - API aggregation layer
  - projection / continuity / replay owner
  - bounded gateway lifecycle manager
- `React frontend`
  - 视图
  - 交互
  - transient UI state

### 4.2 本设计的核心判断

本轮实现要保留的是：

- Deck 的产品语义
- Deck 的交互体验
- chat/session/stream 的连续性语义

而不是：

- 旧 Next API 的路径外形
- 旧 runtime 的内部模块拆分方式
- 旧兼容 façade 的历史包袱

## 5. GatewaySupervisor 设计

### 5.1 模块职责

新增后端模块：

- `deck-go/backend/internal/runtime/supervisor.go`

职责限定为：

- 启动本地 Gateway 子进程
- 停止本地 Gateway 子进程
- 重启本地 Gateway 子进程
- 维护进程状态、最近错误、最近退出信息
- 提供只读状态快照给 server 层

### 5.2 明确不做的事情

GatewaySupervisor 不负责：

- 充当 Gateway 协议 authority
- 模拟 runtime truth
- 保存 Gateway 配置真相
- 改写 OpenClaw runtime 语义
- 演化为旧 `runtime.ts` 的 Go 对等翻版

### 5.3 状态模型

受管 Gateway 状态收敛为：

- `stopped`
- `starting`
- `running`
- `degraded`
- `stopping`
- `failed`

判定标准：

- `running`
  - 进程存在
  - health probe 成功
- `degraded`
  - 进程存在
  - 但 health probe 或握手失败
- `failed`
  - 启动失败
  - 或进程异常退出且当前未恢复

### 5.4 生命周期边界

允许的控制面职责：

- start / stop / restart
- env / config injection
- health polling
- supervision

禁止的行为：

- 竞争 runtime truth
- 竞争 config truth
- 擅自改写 protocol semantics

## 6. 配置模型设计

### 6.1 配置拆分原则

`deck-go` 本地设置分成两类：

1. **控制面自身设置**
2. **Gateway 受管运行设置**

### 6.2 控制面自身设置

保留这类 deck-go 自己拥有的本地配置：

- `accessToken`
- 少量 deck-go 自身运行所需设置

### 6.3 Gateway 受管运行设置

新增明确的受管运行配置块，例如：

- `mode`
- `command`
- `args`
- `workingDir`
- `bindHost`
- `bindPort`
- `gatewayToken`
- `autoStart`
- `env`

第一版中：

- `mode` 固定为 `managed`
- `deck-go` 只支持自己拉起并维护一个本地 Gateway 子进程

### 6.4 关键边界

必须明确区分：

- Gateway 的运行时配置真相
  - 仍然由 Gateway / `config.*` 负责
- deck-go 的受管运行配置
  - 负责说明 deck-go 如何启动和监督 Gateway

因此，旧的扁平配置心智应逐步退场：

- `GatewayURL`
- `GatewayToken`

其中：

- `gatewayUrl` 不再作为用户手填真相长期存在
- `gatewayUrl` 应由 `bindHost` + `bindPort` 推导

## 7. 后端 API 设计

### 7.1 新的 runtime 管理 API

新增 control-plane API：

- `GET /api/runtime/gateway`
- `POST /api/runtime/gateway/start`
- `POST /api/runtime/gateway/stop`
- `POST /api/runtime/gateway/restart`

### 7.2 deck-facing 返回 DTO

前端消费固定的 deck-go 领域 DTO，而不是 Gateway 原始响应。

建议包含：

- `status`
- `pid`
- `startedAt`
- `lastExitAt`
- `lastExitCode`
- `health`
- `gatewayUrl`
- `lastError`

### 7.3 状态流

推荐状态流：

1. 前端发 `start`
2. supervisor 进入 `starting`
3. 子进程启动但 health 未通过，仍为 `starting`
4. health probe 成功，进入 `running`
5. 进程仍在但 probe 失败，进入 `degraded`
6. 启动失败或异常退出，进入 `failed`
7. 主动停止时走 `stopping -> stopped`

### 7.4 bootstrap/status 升级

`/api/bootstrap/status` 不再只是连通性探针，而应返回真正的控制面总览：

- deck-go 当前是否已完成基础配置
- Gateway 是否受管
- supervisor 当前状态
- 当前 runtime endpoint
- capability snapshot 是否可用
- 最近错误或降级原因

## 8. 流式事件设计

### 8.1 deck-go 事件职责

前端不应该靠 API 失败去“猜” Gateway 是否存活。

`deck-go` 应通过自身事件流公开控制面状态变化。

### 8.2 推荐事件

通过 `/api/stream` 广播：

- `runtime.gateway.status`
- `runtime.gateway.health`
- `runtime.gateway.exit`

### 8.3 必须保留的产品语义

应该保留的是这些 Deck 语义：

- `Last-Event-ID`
- replay / reconnect continuity
- `projection.gap`
- chat/session continuity
- 稳定错误模型
- 稳定 bootstrap 能力快照

不必保留的是：

- 旧 Next API 路径外形
- 旧 handler 分组方式

## 9. 兼容性清理原则

### 9.1 需要改写的方向

#### A. `gateway.Client`

从：

- “外部 URL 客户端”

改成：

- “受管 runtime 客户端”

依赖来源从：

- store 中用户手填的 URL / token

改成：

- supervisor 当前受管实例快照
- deck-go 自己拥有的受管 runtime 设置

#### B. 通用 RPC 转发式 API

当前类似 `callGateway()` 这种通用转发心智应收窄。

目标是：

- 后端对前端公开 control-plane API
- 后端内部再决定如何消费 runtime-facing contract

#### C. bootstrap/status

从：

- “设置是否存在 + describe 是否打通”

升级为：

- “控制面、受管 runtime、能力快照、错误状态”的总览

#### D. chat/session façade

现有聊天和会话接口可以暂时保留动作语义，
但不再以“旧路由兼容”为自我定义。

目标是：

- 保持现有 Deck 页面体验
- 后端内部收口为清晰的 session/chat service

### 9.2 清理总原则

保留：

- 产品语义
- 用户操作体验
- 实时性与连续性

丢掉：

- 旧 Node/Next API 外形兼容
- 纯迁移目的的后端结构包袱

## 10. 实施顺序

### 第 1 步：立住 Go 控制面的 runtime 核心

先做：

- `GatewaySupervisor`
- 新的 settings 结构
- `runtime/gateway` 状态与 start/stop/restart
- `bootstrap/status` 改成控制面总览

完成标准：

- 只启动 `deck-go` 即可由其拉起本地 Gateway
- 能稳定区分 `running/degraded/failed/stopped`
- stop/restart 行为可预测
- 旧“手填 GatewayURL 直连”路径开始退场

### 第 2 步：收口 backend contract

再做：

- 后端 API 从旧 Next route 兼容迁移为 deck-go 自己拥有的 control-plane API
- chat/session/config/inventory 内部收成清晰 service
- runtime-facing 与 deck-facing contract 明确分层

完成标准：

- 前端请求的是一套明确的 deck-go contract
- 后端不再依赖通用转发心智支撑所有能力
- 文档中的 state authority / backend surface / contract inventory 能和代码对上

### 第 3 步：前端对齐新的 control-plane contract

再做：

- React 前端逐步切到新的 backend contract
- 保持当前 Deck 主要页面与操作体验
- 增强状态展示、错误提示、运行管理入口

完成标准：

- 关键页面仍能工作
- UI 体验不降级
- 新的 Gateway 运行管理能力前端可见、可操作

### 第 4 步：去兼容化清理

最后做：

- 删除不再需要的兼容路径
- 删除以“旧路由外形兼容”为目的的代码
- 收紧 DTO、事件、状态模型

完成标准：

- `deck-go` 的代码结构表达的是 control-plane，而不是迁移临时层
- 代码层清楚体现：
  - runtime truth 在 OpenClaw
  - control plane 在 deck-go
  - UI state 在 React

## 11. 验证标准

### 11.1 后端状态机验证

必须覆盖：

- start / stop / restart 单测
- 启动失败、异常退出、health 失败的状态转换测试
- `/api/runtime/gateway*` 测试
- `/api/bootstrap/status` 测试

### 11.2 真实运行时 smoke

只启动 `deck-go`，由其拉起 Gateway，验证：

- bootstrap 正常
- config/schema lookup 正常
- chat/session 主链可用
- stop/restart 后可恢复

### 11.3 前端 parity smoke

至少覆盖这些关键 workflow：

1. 启动并进入系统
2. 查看状态 / 库存
3. 发消息
4. 中止运行
5. 重连后恢复
6. 重启后恢复工作状态

## 12. 决策总结

本设计确立的不是“继续兼容旧 Deck runtime”，而是：

- 先把 `deck-go` 作为真正的 control plane 立住
- 先让 Go 服务接住 Gateway 生命周期管理
- 再让前端围绕新的控制面 contract 收敛

本设计也明确放弃了一件事：

- **不再以旧 Next/Node API 形状兼容作为后端设计目标**

后续所有实现，应以本设计与以下文档共同作为边界依据：

- `deck-go/docs/target-architecture.md`
- `.omx/plans/prd-deck-go-parallel-migration.md`
- `deck-go/docs/contracts/deck-backend-surface.md`
- `deck-go/docs/contracts/state-authority-matrix.md`
- `deck-go/docs/contracts/gateway-contract-inventory.md`
