## Context

Deck 当前面临的是一个典型的快速生长型客户端问题：前端已经具备不少功能，但很多模块仍然缺少统一的数据真源、事件恢复、错误模型和共享 UI 基础设施。随着 `chat`、`agent config`、`dynamic commands`、`shared list infra`、`channel config`、`usage panel rebuild` 等提案并行增长，这些问题开始从局部缺陷演变为系统性风险：

- 同一类问题在多个模块重复出现：契约漂移、局部状态分叉、恢复不完整、乐观更新与权威状态脱节
- 模块之间共享依赖没有平台化：transport、auth、projection、replay、panel shell、form/list primitives 经常由各模块重复实现
- 现有提案关注点以“补某个模块”为主，但缺少一层总图来回答：先做什么、后做什么、哪些能力必须先平台化、何时才算能替代官方 UI

用户已经明确目标：

1. **以 Gateway 能力覆盖为主目标**
2. **交互允许按我们自己的产品逻辑重构**
3. **产品交互质量至少不能比官方差**
4. **允许一个平台重构窗口，并采用多 worktree 方式分轨实施**

因此，Deck 后续工作不应继续按“页面 parity”组织，而应按“平台轨道 + 模块闭环 + 替代验收”组织。

## Goals / Non-Goals

**Goals**

- 定义 Deck 作为官方 Web UI 替代产品的 program 级目标与实施轨道
- 明确哪些能力必须先平台化，哪些能力可以作为模块垂直替代推进
- 为所有 Deck 模块建立统一的闭环验收标准
- 给现有 `deck-*` proposals / plans 提供统一归类和后续排序依据
- 支持多 worktree 的重构窗口实施模式

**Non-Goals**

- 不要求 UI 与官方 Web UI 一比一对齐
- 不试图在一个 change 中完成所有模块审计与所有实现
- 不强制立即重写或废弃现有 `deck-*` changes
- 不在本 change 中直接落地新的 runtime 代码

## Proposed Architecture

### 1. Program 视角：从单提案集合升级为产品替代计划

Deck 后续工作由 5 条主轨组成：

1. **Core Platform**
   统一 typed gateway access、Deck API facade、浏览器 transport、auth、stream、replay、projection、mutation/query 模式、错误模型
2. **Session Runtime**
   统一 session-scoped state、snapshot/hydrate、history/live merge、canvas/approval/runtime meta 恢复
3. **UI Framework**
   统一 shell、master-detail、shared list infra、schema-driven form/table、commands surface、loading/error/empty patterns
4. **Domain Modules**（含三个子波次：`Runtime Core`、`Config & Control`、`Observe & Automate`）
   将具体业务模块按优先级逐步迁移到平台骨架上
5. **Replacement Validation**
   用 capability matrix、workflow validation、phase gate 和 browser functional tests 来判断“是否可替代”

这 5 条主轨之间不是平行独立关系，而是：

- `Core Platform` 和 `Session Runtime` 是高依赖平台轨
- `UI Framework` 是通用交互轨
- `Domain Modules` 是垂直功能轨
- `Replacement Validation` 是全局质量轨

### 2. 边界规则：Gateway、Deck Route、Projection 各管什么

后续所有 Deck 能力都遵循同一套边界规则：

#### Gateway Method

当某个能力具备共享业务语义，且可能被多个模块直接依赖时，应优先进入 Gateway：

- session / approval / execution / config / usage / routing 等共享业务语义
- 需要稳定 schema、result model、typed client 的 RPC

#### Deck Route

当问题是浏览器适配或同源访问问题时，保留在 Deck route：

- token/header 注入
- stream 转发
- 文件上传
- 浏览器端聚合查询入口（仅当聚合逻辑是浏览器专属的视图拼接；一旦该聚合逻辑被第二个消费方依赖，应晋升为 Gateway method）

#### Deck Server Persistence

当问题是服务端侧的 projection 持久化、事件缓存或离线恢复时，归属 Deck server 持久层：

- SQLite projection store（deck.db）
- EventBus / outbox
- approval-bridge projection
- session snapshot cache

原则：Deck server 持久层是 projection 的存储后端，不存储 Gateway 的权威业务数据。Gateway 是唯一的业务数据真源。

#### Projection / Client State

当问题是 UI 恢复与展示状态组合时，进入 Deck projection：

- snapshot / stream / replay 合流
- session-scoped right panel state
- canvas / A2UI UI state
- workflow-oriented derived state

原则是：**业务语义不留在组件里，恢复语义不留在 iframe 里，浏览器适配问题不反向污染 Gateway，projection store 不存储权威业务数据。**

### 3. 模块不是按页面完成，而是按闭环完成

每个 Deck 模块都必须满足同一套 closure 标准，才可视为“可替代”：

1. **Capability coverage**
   对应 Gateway 方法族已经明确覆盖边界，不再依赖未知旁路
2. **Authoritative contract**
   Deck route / typed client / result model 已明确，字段不再靠手写镜像猜测
3. **Hydration path**
   冷启动或打开模块时能够获得权威快照
4. **Runtime sync**
   实时流、后台更新、跨入口修改都能进入同一真源
5. **History-live consistency**
   历史态和实时态在相同服务端状态下产生相同 UI 状态
6. **Recovery**
   刷新、重连、切换历史对象后，状态能够恢复且与实时态一致
7. **Shared interaction quality**
   loading / error / empty / permission / action feedback 符合 Deck 统一交互标准
8. **Security and accessibility baseline**
   XSS/CSRF 防护、键盘可达性、首屏性能 budget 符合项目基线
9. **Validation**
   有契约验证、模块测试和至少一条工作流验证

这意味着”页面能打开””功能能点”都不再等于”模块完成”。

### 4. 轨道与阶段

推荐按 6 个阶段推进：

#### Phase 0: Program Baseline

- 梳理现有 `deck-*` proposals / plans
- 建立 capability / closure matrix
- 明确每个模块归属的 track、priority、dependency

#### Phase 1: Platform Kernel

- typed gateway client 全覆盖策略
- Deck route facade 策略
- stream / replay / projection / error model
- shared list/form/panel infra

#### Phase 2: Runtime Core

优先做高状态复杂度、高可信度要求的模块：

- chat
- approval
- canvas / A2UI
- sessions / logs
- execution monitor

#### Phase 3: Config & Control

- agents
- config editor
- channels
- routing / session-channel
- dynamic commands

#### Phase 4: Observe & Automate

- usage
- activity
- cron
- webhooks
- skills
- budget
- alerts

#### Phase 5: Replacement Gate

- browser functional tests
- cross-module workflow validation
- capability coverage review
- release-quality acceptance for `enhanced`

### 5. Worktree Strategy

由于用户明确允许平台重构窗口，推荐将 worktree 按轨道切分，而不是按页面切分：

- `program`: 维护 master OpenSpec、program plan、capability matrix
- `platform-kernel`: contract / transport / stream / projection / shared infra
- `runtime-core`: chat / approval / canvas / session runtime
- `config-control`: agents / config / channels / routing / commands
- `observe-automate`: usage / activity / cron / webhooks / skills / budget / alerts

规则：

- 共享契约未冻结前，不并行推进共享文件交叉严重的模块
- `program` worktree 不直接承载实现，只维护总图和阶段门
- 只有在 track 前置依赖稳定后，相应模块 worktree 才能大规模推进

### 6. 现有 changes 的归类方式

现有 `deck-*` changes 不需要全部重写，但必须纳入统一轨道：

- `deck-chat-flow-closure`、`session-scoped-state` → `Session Runtime`
- `deck-shared-list-infra`、`schema-driven-ui-architecture` → `UI Framework`
- `gateway-protocol-sdk`、相关 typed client 工作 → `Core Platform`
- `deck-agent-config-enhancement`、`deck-channel-config-framework`、`deck-config-editor-enhancement`、`deck-dynamic-commands` → `Domain Modules > Config & Control`
- `deck-usage-panel-rebuild` → `Domain Modules > Observe & Automate`
- `deck-sessions-logs-hardening`、`deck-execution-monitor` → `Domain Modules > Runtime Core`
- `deck-chat-ux-enhancement` → `Domain Modules > Runtime Core`
- `deck-agent-routing-observability`、`deck-agent-workspace` → `Domain Modules > Config & Control`
- `deck-chat-whitebox` → `Domain Modules > Runtime Core`
- `deck-config-enhancement` → `Domain Modules > Config & Control`
- `deck-slash-command-coherence` → `Domain Modules > Config & Control`

注意：一个 change 可以跨多个 track 提供输入（如 `deck-chat-flow-closure` 同时为 `Session Runtime` 和 `Domain Modules > Runtime Core` 提供样板），但其主归属（primary track）只有一个。

总纲不会替代这些子 change，但会约束它们如何排序与如何验收。

## Decisions

### D1: 以 Gateway 能力覆盖为主目标，而不是官方 UI parity

**选择**：Deck 的替代目标按 Gateway 能力覆盖和闭环质量定义，而不是按官方 Web UI 的页面一一对应定义。

**原因**：用户明确允许交互重构；官方 UI 是参考，不是设计边界。

### D2: 平台先行，不走持续局部补洞路线

**选择**：后续工作优先建设平台骨架，再做模块替代。

**原因**：同类问题已经在多个模块重复出现；继续局部修补只会增加后续重构成本。

### D3: 允许阶段性重构窗口

**选择**：允许一段时间的重构窗口，期间部分模块可以暂不稳定，最终通过 worktree 合流到 `enhanced`。

**原因**：用户已接受；这比为了保持每一步“看起来可用”而长期保留错误架构更合理。

### D4: 模块完成标准使用 closure checklist，而不是页面存在性

**选择**：只有通过统一 closure checklist 的模块才算“替代完成”。

**原因**：这能避免“功能看起来有了，但逻辑不自洽”的假完成。

### D5: 总纲 change 不直接承担实现

**选择**：master change 负责路线、边界、依赖、矩阵与 gate，不直接承载模块实现。master change 的 openspec artifacts 中不得包含 runtime code。

**原因**：否则总纲很快会退化成另一个巨型实现提案，失去治理作用。

### D6: Replacement Validation 是持续门，不是终末门

**选择**：每个 phase 结束时执行该 phase 范围内的增量验证，而不是把所有验证推迟到 Phase 5。

**原因**：如果验证只在最后做，前期积累的问题会在 Phase 5 集中爆发，导致大规模返工。Phase 5 只做跨模块工作流验证和最终覆盖率审查。

### D7: 用户迁移最低护栏

**选择**：允许交互重构，但必须保持以下最低迁移兼容性：

- 核心功能的 URL path 保持可发现（不要求完全相同，但不能让用户找不到）
- 术语和概念模型的变更需要在 release notes 中说明
- 不要求渐进切换（Deck 作为独立产品，不需要与官方 UI 共存）

**原因**：完全不考虑迁移会导致用户在切换时迷失；但过度追求 URL parity 又会约束交互重构的自由度。

## Risks / Trade-offs

**[多轨推进的管理成本上升]**
需要维护总纲、阶段门和矩阵。
缓解：把 program worktree 作为唯一入口，避免在多个实现 change 中重复定义目标。

**[短期交付速度可能变慢]**
前几周看起来会更多在整理平台，而不是直接增加页面。
缓解：优先选择能被多个模块复用的平台能力，后续收益会放大。

**[某些现有提案会被重新排序]**
并不是 proposal 早写就先做。
缓解：使用 capability / closure matrix 说明依赖关系与优先级，而不是按直觉排。

**[替代目标容易被”差不多能用”稀释]**
如果没有统一 gate，模块仍会以半闭环状态被标记完成。
缓解：将 closure checklist 和 workflow validation 写入 spec，作为明确要求。

**[重构窗口期间用户可见退化]**
平台重构可能导致部分已有功能暂时不可用。
缓解：重构在独立 worktree 中进行，只有通过 phase gate 后才合入 `enhanced`；`enhanced` 上的已有功能不因重构而退化。
