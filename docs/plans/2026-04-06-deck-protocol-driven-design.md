# Deck Protocol-Driven Architecture Design

> Date: 2026-04-06  
> Status: Draft  
> Branch: enhanced  
> Role: 本文档是 Deck 协议驱动改造的**唯一设计基线**。它同时承担原 plan 中 Session 2 的架构冻结职责，以及原 Session 3 的迁移拓扑职责。

## 文档定位

原 `docs/plans/2026-04-04-upstream-sync-plan.md` 将这项工作拆成：

- Session 2：Architecture Brainstorming
- Session 3：OpenSpec 实施

这个拆分在方法论上是合理的，但对当前任务来说切得过硬。原因是：

1. 这不是从零设计系统，而是在一个刚完成大规模 upstream sync 的真实代码库上重构协议边界。
2. 架构决策本身依赖当前代码接缝，无法脱离实施轮廓单独完成。
3. 如果 Session 2 只停留在原则层，Session 3 会重新发明一次架构。

因此，后续不再把 Session 2 和 Session 3 视为两件完全独立的事情，而是统一理解为：

> **Architecture Freeze + Migration Topology + Implementation Lanes**

本文档的职责是：

- 冻结核心原则
- 明确模块职责
- 明确迁移顺序
- 定义后续实施节奏

但**不**深入到逐文件改动清单或具体 patch 级设计；那部分留给后续 lane 计划。

---

## 背景与问题根源

每次上游同步痛苦的本质，不是“类型多了几处报错”，而是 Deck 在本地复制了 Gateway 的知识，每次上游更新都要手动追着改这些复制品。

| 痛点                     | 根因                                       |
| ------------------------ | ------------------------------------------ |
| Allowlist 手动维护       | Deck 硬编码了“我知道有哪些 RPC 方法”       |
| 手写类型不同步           | Deck 侧保留了对 Gateway 协议的本地镜像认知 |
| `chat.*` 桥接层          | Deck 绕过了上游原生 `sessions.*` 语义      |
| Config schema 客户端解析 | Deck 重新解释了 Gateway 已有的 schema 能力 |
| SSE 事件硬编码           | 新增事件类型必须改前端分发逻辑             |

### 当前代码基线（必须正视的现实）

当前 Dashboard 真实状态不是“已经协议驱动完成”，而是处在**半硬编码 / 半协议驱动**状态：

- Gateway 方法门控仍依赖静态 allowlist：`dashboard/server/gateway-allowlist.ts`
- Gateway session 事件仍依赖本地映射：`dashboard/server/gateway-adapter.ts`
- Config UI 仍通过前端本地解析 schema：`dashboard/src/components/panels/config-editor/ConfigPanel.tsx`, `dashboard/src/lib/schema-parser.ts`
- `config.schema.lookup` 已存在，但目前主要是增量 lookup / hint 能力，不是 Config UI 的正式唯一权威来源
- Chat 主链已部分使用 `sessions.steer` / `sessions.abort`，但整体语义仍未完全回到 `sessions.*`

所以本设计不是对现状的“润色”，而是要完成一次**权威来源回收**：

> 把 Deck 中复制出去的 Gateway 知识，逐步还给 Gateway 自己。

---

## 设计目标

1. 让 Gateway 成为协议能力、session 语义、config schema 的唯一事实来源。
2. 从 Deck 中移除长期存在的 Gateway 知识复制品。
3. 降低 future upstream sync 的冲突面和适配成本。
4. 让 Deck 在替代 Control UI 的同时，重点投入 Control UI 不擅长的能力。

---

## 决策总览

| 维度            | 决策                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 主从关系        | **Gateway 是基准，Deck 跟随 Gateway**                                                                                                                                    |
| Session 主链    | Deck 聊天主链正式切到 `sessions.*`；不再长期依赖 `chat.send` / `chat.abort` 桥接                                                                                         |
| Transcript 读取 | `sessions.preview` 仅用于预览，不等价替代 `chat.history`；在 Gateway 暂无原生 full transcript RPC 的前提下，`chat.history` 可作为**受限的读取兼容 seam**，但不是发送主链 |
| 方法发现        | `gateway.describe` 是核心能力发现入口，采用 **fail-fast**；不把本地静态 allowlist 当正式 runtime 权威                                                                    |
| 类型策略        | Deck 依赖的 RPC params/result/event payload **100% codegen**；不保留并行手写协议镜像作为正式契约                                                                         |
| Raw 通道        | **不采用**长期 `raw` 逃生舱作为正式架构组成部分；新能力通过 codegen + capability gating 接入                                                                             |
| Config UI       | `config.schema.lookup` 是正式目标权威来源；当前 `config.schema + 前端 parse` 只是一种过渡状态，不是“已完成方案”                                                          |
| 事件系统        | 采用**注册表级接入**，但不强行把 EventBus 立即改成任意字符串事件总线；保留 Deck 自有 typed event，Gateway 事件通过统一 intake + normalization 接入                       |
| 产品边界        | Deck 替代 Control UI，但差异化投入聚焦在 Monitor、Canvas、Routing Simulator、企业治理等上游不擅长的能力                                                                  |
| 同步策略        | 默认双周同步；若上游出现严重 bug 修复或明显有吸引力的新功能，则即时同步                                                                                                  |

---

## 核心原则

### 1. Gateway 是权威，不是 Deck 的数据源之一

Deck 不拥有下列语义解释权：

- 有哪些 RPC 方法
- 有哪些事件
- config 字段结构和含义是什么
- session 生命周期是什么

这些语义由 Gateway 决定；Deck 只负责消费和呈现。

### 2. 目标不是“跑绿”，而是消灭知识复制

真正需要减少的不是某一个类型错误，而是长期存在的本地复制品：

- 静态 allowlist 作为正式 runtime 权威
- 手写协议镜像类型
- `chat.*` bridge 语义
- 客户端 schema parsing 作为正式解释权
- 事件面向面板硬编码分发

### 3. 正式 cutover 优先于永久双栈

对于协议主链，优先进行正式切换，而不是长期保留双实现、双语义、双测试矩阵。

这尤其适用于：

- `chat.*` → `sessions.*`
- 本地 capability 假设 → `gateway.describe`
- 客户端 schema 解释 → `config.schema.lookup`

### 4. fail-fast 优先于静默降级

对关键协议能力：

- `gateway.describe`
- `sessions.*` 主链能力
- `config.schema.lookup` 正式依赖能力

优先选择显式不兼容，而不是静默回退到旧逻辑继续运行。

### 5. 生成物是协议契约，view-model 是前端私有组织形式

前端可以拥有自己的：

- store shape
- selector
- view-model
- UI rendering abstraction

但**不能**把这些当作 Gateway 协议契约的并行定义。

---

## 目标架构

```text
Gateway MethodRegistry / Schema / Events
        ↓
  gateway.describe + config.schema.lookup + sessions.*
        ↓
Deck protocol bootstrap
  - capability snapshot
  - generated typed client
  - event intake registry
        ↓
Deck state / normalization / view-model layer
        ↓
Panels and operator UI
```

目标不是让 Deck“更聪明地猜 Gateway 在干什么”，而是：

> **让 Deck 直接消费 Gateway 已公开的能力与语义。**

---

## 四个架构支柱

### 支柱 1：Native Session API 成为 Deck 聊天主链

Deck 聊天主链应建立在：

- `sessions.create`
- `sessions.send`
- `sessions.abort`
- `sessions.subscribe`
- `sessions.messages.subscribe`

之上。

#### 发送 / 生命周期主链

这些能力必须正式迁到 `sessions.*`，不再把 `chat.send` / `chat.abort` 当成 Deck 的主语义路径。

#### Transcript 读取主链

这里必须承认一个当前现实：

- `sessions.preview` 是**预览接口**，不是 `chat.history` 的等价替代
- 当前 Gateway 公开的 `sessions.*` 面上，还没有与 `chat.history` 完全对等的 full transcript retrieval RPC

因此，本设计明确：

- **不能**把 `chat.history → sessions.preview` 视为一对一迁移
- 在 Gateway 没有提供原生 full transcript 读取能力前，Deck 可以保留 `chat.history` 作为**受限的读取兼容 seam**
- 但这不改变主链已经切回 `sessions.*` 的方向，也不意味着重新回到 `chat.*` bridge 架构

#### `sessions.steer` 的定位

`sessions.steer` 是上游正式 API，不是 Deck 自己的桥接接口。后续应把它定位为：

- 中断式 / operator-driven send
- 专门语义场景的 send 变体

而不是默认聊天发送主路径。

---

### 支柱 2：`gateway.describe` 成为能力发现入口

Deck 启动时必须建立 capability snapshot，核心来源是 `gateway.describe`。

这个 snapshot 用于：

- 方法存在性判断
- 事件存在性判断
- 连接兼容性判断
- feature gating

#### 这里需要特别收敛的地方

本设计**不采用**下面这些作为长期正式路径：

- 静态 runtime fallback allowlist 作为主要兜底
- `raw(method, params)` 逃生舱式调用作为正式架构层
- 定时刷新 describe cache 以让“新方法立即热接入”成为主要收益点

原因很简单：

1. 这会重新让 Deck 拥有一套本地权威
2. 会稀释“Gateway 是基准”的原则
3. 会让 codegen 契约和 runtime 调用路径重新分叉

#### 更合理的收敛方式

- `gateway.describe` 用于**启动兼容检查 + feature gating**
- codegen 产物用于**正式调用契约**
- 新方法接入仍然通过 `protocol:gen:ts` 进入稳定路径
- 若核心依赖能力不存在，则直接 fail-fast，而不是回退到静态 allowlist 假装兼容

也就是说，dynamic discovery 的目标是：

> **消灭静态权威，不是绕开生成契约。**

---

### 支柱 3：Config UI 完全服务端驱动

原 plan 把 `config-server-driven` 作为独立高优 lane，这个判断是对的，不能因为当前有 `config.schema.lookup` 就把它排除出设计范围。

#### 当前真实状态

现在 Dashboard Config UI 仍然主要是：

1. 获取 `config.schema`
2. 在前端本地 parse schema
3. 用 `lookup` 做增量 hints / fallback

这不是“已经完成服务端驱动”，只是有了服务端驱动的接口基础。

#### 正式目标

Config UI 最终要做到：

- `config.schema.lookup` 成为字段级结构 / metadata / path 能力的正式权威来源
- Deck 不再把 schema-parser 当正式语义解释层
- 前端保留的是 UI rendering 能力，不是字段语义解释权

#### 过渡原则

在完全切换前，`config.schema` 可以继续承担整份 schema bootstrap 的职责，但必须明确：

- 它只是过渡期的 coarse bootstrap 数据源
- 字段级结构与 path 语义应逐步收敛到 `config.schema.lookup`
- 不能把当前 `config.schema + parseSchemaSection` 方案误判为已经完成的最终态

---

### 支柱 4：100% codegen + 注册表级事件接入

#### 类型策略

Deck 使用到的：

- RPC params
- RPC results
- event payloads

都应来自生成产物，而不是长期并行手写类型。

#### 事件策略

这里吸收 Claude 设计稿的优点，但做一个重要修正：

当前 EventBus / SSE / replay / pipeline 基础设施是**typed 且耦合的**。因此，不能把“Gateway 事件名直接透传为任意字符串 EventBus 事件”当成轻量变更。

当前代码中：

- EventBus 是封闭 union：`dashboard/server/event-bus.ts`
- SSE route 把事件当 `DeckEventType`：`dashboard/src/app/api/stream/route.ts`
- Gateway adapter 用本地映射表把 session 事件翻译成 Deck event：`dashboard/server/gateway-adapter.ts`
- `RunEventPipeline` 只认 `chat` / `agent` 等有限事件域：`dashboard/server/run-event-pipeline.ts`

#### 更合理的事件目标

目标不是“所有 Gateway 事件立刻变成任意字符串前端事件”，而是：

1. 保留 Deck 自有 typed event 作为前端内部契约
2. 通过统一的 Gateway 事件 intake 层接收 domain event
3. 在 intake 层做 capability-aware normalization / routing
4. 把稳定后的状态或 view-model 暴露给面板层
5. 对未知或暂未消费的 Gateway 事件，优先保证可观测、可忽略、不破坏系统

换句话说：

- **自动接入** 指的是先进入统一总线/归一化层
- **不是** 指自动拥有完整 UI 呈现

---

## 迁移拓扑与实施节奏

与其把原来的 Session 2 / Session 3 当成两轮完全独立的工作，更合理的节奏是四个连续阶段：

### Phase A：Design Freeze（当前文档）

产物：

- 核心原则
- 模块职责
- 迁移顺序
- 风险控制
- lane 边界

退出条件：

- 不再争论“Gateway 和 Deck 谁拥有协议解释权”
- 不再争论 `sessions.*` / `gateway.describe` / `config.schema.lookup` 的长期方向

### Phase B：Foundation Slice

这是从原 Session 3B / 3C 中抽出的**必要前置切片**，不是把 3B / 3C 整体做完。

#### 目标

- 建立 `gateway.describe` 的 capability bootstrap 边界
- 收敛 allowlist 的正式权威来源
- 定义 event intake / normalization 边界
- 明确 Config UI 当前状态与 `lookup` 目标状态之间的过渡边界
- 建立 codegen 作为 Deck 协议契约的唯一正式来源

#### 说明

Phase B 的意义不是“先把 discovery / config 全做完”，而是把会阻塞主线切换的问题先收口。

### Phase C：Mainline Cutover

这是原 Session 3A 的主价值阶段，仍然是**最高优先级**。

#### 目标

- Deck 创建、发送、中止、订阅主链正式迁到 `sessions.*`
- 移除 `chat.send` / `chat.abort` bridge 主路径
- session state 与消息流回到 Gateway-native 语义
- 明确并实现 transcript 读取的受限兼容 seam 或原生替代路径

#### 说明

优先级上，Phase C 仍然是整个程序的中心；只是工程顺序上，允许先完成少量 Phase B 的基础工作，避免主线切换被协议边界问题反复打断。

### Phase D：Convergence

这是原 Session 3B / 3C / 3D 的剩余收敛工作。

#### 包括

- dynamic discovery 完整化
- config-server-driven 完整化
- agent-config-fields 补齐
- 移除遗留的硬编码协议知识

### 映射回原 Session 2 / 3

| 原 plan                         | 新理解              |
| ------------------------------- | ------------------- |
| Session 2                       | Phase A（架构冻结） |
| Session 3A                      | Phase C（主线切换） |
| Session 3B / 3C 的必要前置      | Phase B（基础切片） |
| Session 3B / 3C / 3D 的剩余部分 | Phase D（收敛阶段） |

这个调整不是推翻原 plan，而是承认：

> **Session 2 和 Session 3 本来就是同一个连续设计-实施程序，只是之前为了上下文容量才被拆开。**

---

## 后续 lane 边界

### Lane 1：Capability Bootstrap & Protocol Ownership

范围：

- `gateway.describe` 启动期 capability snapshot
- allowlist 权威来源收敛
- codegen 契约边界收敛

不负责：

- 完整聊天主链切换
- Config UI 全量改造

### Lane 2：Event Intake Refactor

范围：

- Gateway event intake
- normalization / routing boundary
- session 事件与 Deck typed event 的关系重构

不负责：

- 完整 UI 自动适配
- 非事件相关的协议调用改造

### Lane 3：Session Mainline Cutover

范围：

- `sessions.create/send/abort/subscribe/messages.subscribe`
- session state/store 改造
- `chat.send` bridge 清理
- transcript 读取策略落地

这是最高优先级 lane。

### Lane 4：Config Server-Driven

范围：

- `config.schema.lookup` 驱动字段级结构 / metadata
- 客户端 schema parsing 从正式权威位置退出

### Lane 5：Agent / Config Field Completion

范围：

- 上游新增字段的展示与消费收口
- 不重新定义协议，只补齐消费层

---

## 非目标

1. **Deck 不重新定义 Gateway 语义。**
2. **未知事件不会自动拥有完整 UI。** 自动接入和自动可视化不是一回事。
3. **本文档不是逐文件实施清单。** 它定义的是架构边界和迁移拓扑。
4. **Deck 不需要镜像 Control UI 的每一个交互。** 通用管理能力跟随上游，差异化能力聚焦自身优势。
5. **不把 `raw` 通道或静态 fallback 当长期正式路径。**

---

## 约束与护栏

1. Gateway 是基准，Deck 跟随 Gateway。
2. 协议主链优先正式 cutover，而不是长期双栈。
3. Deck 依赖的协议契约必须由 codegen 提供。
4. `sessions.preview` 不是 `chat.history` 的替代品。
5. 任何保留的兼容 seam 都必须：
   - 明确说明为什么保留
   - 边界清晰
   - 有可收敛的退出条件

---

## 风险与控制

### 风险 1：`sessions.*` 主线切换爆炸半径大

控制方式：

- 把主线切换聚焦在 create/send/abort/subscription 语义
- 把 transcript 读取问题单独识别，不混成错误替换关系
- 先解决协议边界，再优化 UI 细节

### 风险 2：`gateway.describe` 强依赖会提高兼容门槛

控制方式：

- 把 capability bootstrap 变成显式连接阶段
- 定义 Deck 启动所需的最小能力面
- 不满足时清晰报不兼容，而不是静默退回旧逻辑

### 风险 3：Config UI 迁移容易半途停留在“半驱动”状态

控制方式：

- 文档明确当前状态不是完成态
- 把 `config-server-driven` 保留为正式 lane
- 避免把 lookup 仅作为 hints 功能长期化

### 风险 4：事件层重构被低估

控制方式：

- 把 EventBus / SSE / replay / pipeline 视为一组基础设施而不是 adapter 小改
- 优先定义 intake 边界，再改具体消费点

### 风险 5：未来边缘面板重新复制协议知识

控制方式：

- 新功能接入时先问：
  - 能否 discovery 获取？
  - 能否 lookup 获取？
  - 能否 codegen 获取？
- 只有在这三者都不能满足时，才允许前端补充静态定义

---

## 最终结论

Deck 需要从“硬编码理解 Gateway 的客户端”，转向“由 Gateway 协议驱动的控制台”。

这意味着：

- 聊天主链回到 `sessions.*`
- capability 认知回到 `gateway.describe`
- Config 语义回到 `config.schema.lookup`
- 协议契约回到 codegen
- 事件接入回到统一 intake / normalization 层
- Deck 的差异化投入聚焦在 Control UI 不擅长的能力
- 上游同步回到更短、更可控的节奏

从执行节奏上说，接下来不应再把 Session 2 和 Session 3 当成两件分离的任务，而应按：

> **Design Freeze → Foundation Slice → Mainline Cutover → Convergence**

这个连续程序推进。

本文档就是这套连续程序的唯一设计依据。
