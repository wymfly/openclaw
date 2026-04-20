# deck-go Chat / Session Control-Plane Contract + Luminous Volume UI 设计

**日期**: 2026-04-19  
**状态**: 设计完成，待实施

## 1. 概述

本设计定义 `deck-go` 下一阶段的核心目标：

1. 重新定义 `chat/session` 的 **deck-go-owned control-plane contract**
2. 在 **不丢页面功能、不丢核心 UI 元素、不破坏产品体验** 的前提下，
   将前端视觉与交互升级到 `Luminous Volume` 风格

这不是旧 Next/Node Deck chat API 的兼容迁移，也不是一次单纯的视觉换皮。

它是一次**产品体验保持 + 合同边界重建 + 风格重设计**的联合设计。

## 2. 已知前提

以下前提已明确，不再重复访谈：

- `deck-go` 是 `OpenClaw runtime` 之上的 Go control plane
- `OpenClaw runtime` 继续是 runtime / protocol / config truth
- `deck-go` 已经完成：
  - GatewaySupervisor
  - managed Gateway lifecycle
  - real runtime stabilization
- 前端目标是：
  - **兼容产品体验**
  - **页面功能不能缺少**
  - **UI 元素不能丢失**
  - 但允许：
    - 重新设计交互
    - 重新设计视觉风格
    - 按 Go control-plane 特性重构前后端 API，而不是生搬硬套旧 Next 接口

## 3. 本设计要解决的问题

当前 `deck-go/frontend` 仍然只是一个控制面工作台原型，不是完整 Deck chat/session 产品。

而 legacy Deck 的 chat/session 系统已经具备完整的产品结构，包括：

- SessionSidebar
- AgentTabs
- ChatPanel
- MessageList / MessageInput
- ChatContextBar
- SessionConfigBar
- ToolProgressBar
- RunStatusBar
- TranscriptSearch
- BlockFilterBar
- SSEStatusBanner
- ApprovalDialog
- CanvasPanel / CanvasDebugPanel
- ArtifactPanel
- MessageActions
- SlashCommandPalette
- RightPanel
- SubagentTree / SubagentCard

这些组成的是**产品体验基线**，不是“可选参考”。

但与此同时，legacy Deck 也存在明显历史包袱：

- chat/session contract 夹杂了旧 Next route 形状
- session/chat store 与流式投影存在迁移历史
- 很多页面行为是围绕旧 runtime/api 形状长出来的

下一阶段的目标不是照抄这些旧实现，而是：

- 保留产品能力和用户心智
- 重建更适合 `deck-go` control plane 的 contract
- 用新的统一设计语言重做 UI 表达

## 4. 范围

### In scope

- `chat/session` 的 deck-go-owned backend contract 设计
- chat/session 页面和面板的信息架构设计
- 基于已吸收进本 spec 的深/浅 Luminous Volume 视觉语言
- 深色 / 浅色双主题策略
- 与 `deck-go` 当前 Go control-plane 能力对齐的交互 redesign
- 明确哪些旧 chat/session API 是历史兼容，哪些应该被新 contract 替代

### Out of scope

- Gateway / OpenClaw runtime 协议重写
- 企业平台范围扩张
- channels/plugins/models 全面 redesign
- 桌面端壳层
- 对 chat/session 之外页面的一次性全面重做

## 5. 产品体验基线

### 5.1 必须保留的不是旧 API，而是旧产品体验

本设计明确区分两种“兼容”：

#### 需要保留

- 页面存在性
- 页面职责
- 用户完成关键任务的主路径
- 关键 UI 元素和操作能力
- session/chat 的连续性语义

#### 不需要保留

- 旧 `dashboard/src/app/api/**` 路由外形
- 旧 Node/Next handler 组织方式
- 旧 façade 的 DTO 形状
- 为了历史实现而存在的冗余后端接口

### 5.2 必须保留的关键工作流

下列工作流是本设计的产品体验红线：

1. 选择 Agent 与切换 Session
2. 浏览 Session 列表并进入 Session 详情
3. 输入消息、发送消息、查看流式返回
4. 中止运行 / abort
5. 审批流呈现与操作
6. Tool progress / run status 观察
7. 重连 / reload 后恢复会话连续性
8. 浏览 transcript / search / filter / artifacts / canvas
9. 修改 session 级配置
10. 查看状态提示和异常信息

这些工作流可以被重设计，但不能被削弱或删除。

## 6. 视觉系统输入：Luminous Volume

本设计已吸收你提供的两份外部视觉规范，并将它们内化为本仓库内的统一设计依据。

后续 planning / execution / visual review 都应以**本 spec**作为设计真源，而不是再回到下载目录的外部文件。

### 6.1 共同的风格基因

两套设计语言共享以下原则：

- No-Line Rule：禁止依赖 1px 实线做分区
- 通过 tonal shifts / shadow / negative space 定义层级
- 强烈圆角和“体积感”
- Glassmorphism 仅用于真正浮层
- Editorial typography
- 强节奏、非模板化的留白
- Primary CTA 使用 gradient，而不是纯色填充

### 6.2 深色模式（Design 1）

适用于：

- 沉浸式 chat
- transcript 深阅读
- artifact / canvas / tool result 的高密度展示

关键词：

- nocturnal
- tactile digitalism
- soft glow
- deep tonal layers
- no-line containment

### 6.3 浅色模式（Design 2）

适用于：

- 日常管理台
- session 列表、侧栏、设置面板、状态总览
- 强调编辑性与可读性

关键词：

- luminous gallery
- inflated surfaces
- editorial scale
- layered paper
- clean tonal hierarchy

### 6.4 主题策略

本设计不要求一次只选一个主题。

建议策略：

- **默认提供深浅两种主题**
- 深色和浅色共用同一套结构语义与组件 contract
- 通过 token 层切换，不做两套独立页面

但允许阶段化交付：

- 第一阶段先把**一种主题**做成主视图
- 第二阶段补齐另一主题 token

## 7. UI 设计约束

### 7.1 页面功能和元素约束

在任何 redesign 中：

- 不能丢失页面
- 不能丢失关键 UI 元素
- 不能把原本一屏能完成的核心操作拆得更碎

允许的变化：

- 重新组织布局层次
- 重做组件视觉外形
- 改变按钮、面板、浮层、列表、气泡的风格
- 优化操作顺序
- 用更适合 control-plane contract 的数据组织重做交互

### 7.2 UI 元素保留清单

下列元素必须被视为“能力元素”，不是“样式元素”：

- Session sidebar / session list
- Agent tabs
- Message input
- Message list / transcript blocks
- Tool progress / run status
- Approval UI
- Session config bar
- Context bar
- Search / filter
- Artifact panel
- Canvas / A2UI 面板
- Error / SSE / status banners

允许换外形，不允许删除能力。

## 8. Chat / Session Contract 设计方向

### 8.1 目标

`deck-go` 应拥有一套 **面向 React 产品层** 的 chat/session contract，而不是继续把旧 `dashboard` 路由形状当成稳定接口。

### 8.2 Contract 设计原则

#### Runtime-facing

由 `deck-go` 消费 `OpenClaw runtime`：

- sessions.\*
- chat.history
- config.\*
- stream / runtime events

#### Deck-facing

由 React 消费 `deck-go`：

- session list / detail
- transcript projection
- run status / tool progress
- approval state
- canvas / artifact state
- bootstrap / runtime health

换句话说：

- React 不应该直接拼 runtime truth
- `deck-go` 应负责聚合、投影、归一化、连续性语义

### 8.3 必须保留的语义

以下语义仍然是核心：

- `Last-Event-ID`
- replay
- reconnect continuity
- `projection.gap`
- session-scoped state
- transcript ordering
- tool/result rendering continuity
- approval / canvas / artifact 并行存在

这些语义需要通过新的 control-plane contract 表达，而不是通过旧 route 形状遗产表达。

### 8.4 新 contract 的目标状态

新的 chat/session contract 应当：

- 明确 session list 和 session detail 的边界
- 明确 transcript snapshot 与 live stream 的边界
- 明确 action APIs（send / abort / preview / reset / clear / patch / subscribe）里哪些保留，哪些重构
- 明确 approval、tool progress、canvas、artifact 如何作为 deck-owned projection surfaces 暴露

## 9. 页面与布局设计方向

### 9.1 整体布局

建议使用三层布局语义：

1. **Navigation layer**
   - agent tabs
   - session sidebar
2. **Conversation layer**
   - context bar
   - transcript
   - message input
3. **Auxiliary intelligence layer**
   - artifact
   - canvas
   - approvals
   - run status
   - session config

这种分层比“一个聊天框 + 零散右侧工具”更适合 `deck-go` control-plane 表达。

### 9.2 Chat transcript

Transcript 不应只是平铺消息列表，而应成为：

- 信息密度可控的阅读器
- tool/result/thinking/artifact/canvas 的统一挂载面

设计方向：

- 更高的气泡体积感
- 更明确的 message origin 形状差异
- 更好的 tool/result card 分层
- 对 streaming / final / partial 的视觉节奏区分

### 9.3 Session sidebar

SessionSidebar 不应只是列表，而应承担：

- session identity
- activity cue
- preview cue
- status cue

设计方向：

- 强调层次卡片感
- 不用 divider
- 通过 tonal blocks 和 spacing 做分段
- 支持深浅主题下不同的体积表达

### 9.4 Right panel / artifact / canvas

右侧辅助面板应从“附属物”提升为明确的 secondary workspace。

建议：

- artifact / canvas 使用独立 surface 语言
- 在深色模式下更强调浮层和 glow
- 在浅色模式下更强调 layered paper 与 tonal nesting

## 10. 交互 redesign 允许范围

这是本设计最重要的授权之一：

### 允许

- 改变交互顺序
- 重新组织页面中的工具区
- 让 API 设计更贴合 Go control-plane 的天然边界
- 把多个旧兼容动作收成更清晰的新动作模型
- 让状态和错误信息更显式

### 不允许

- 因为后端 contract 改了，就把用户熟悉的能力删掉
- 让页面功能消失
- 让操作路径明显变差

## 11. 实施建议

这个大 spec 落地时，应拆成两个实现维度并行推进：

### A. Contract lane

- session list / detail
- transcript projection
- stream continuity
- action APIs
- approval / tool progress / canvas / artifact projection

### B. UI lane

- 页面布局重构
- token/theme 体系
- 深浅主题
- 组件风格重做
- 状态反馈与交互增强

但两条线要由同一份 spec 约束，避免：

- contract 先长成旧风格
- UI 再被迫迁就旧 contract

## 12. 验收标准

### Product parity

- 关键页面功能无缺失
- 关键 UI 元素无缺失
- 关键工作流不劣化

### Contract quality

- React 消费的是 deck-go-owned control-plane contract
- 不再以旧 Next route 形状为稳定接口目标
- session/chat runtime-facing 与 deck-facing 边界清楚

### Design quality

- 深/浅主题符合 `Luminous Volume`
- no-line rule 被真正执行
- 组件具备 volume / depth / editorial hierarchy
- 不呈现模板化管理后台观感

### UX quality

- 允许交互增强
- 不允许因为重构而削弱 chat/session 主链体验

## 13. 结论

这个大 spec 的核心不是：

- “把旧 Deck 页面抄到 React 里”

而是：

- **保留 Deck 产品体验**
- **重建更适合 deck-go control plane 的 chat/session contract**
- **用 Luminous Volume 的双主题视觉系统重做页面表达**

后续所有实现都应以这三个目标同时成立为验收前提。
