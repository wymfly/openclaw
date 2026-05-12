# Project Context — openclaw / deck-go

> Living glossary of core domain terms and their relationships. Updated
> in-place during grill sessions — **do not batch updates**, capture as
> decisions crystallize.
>
> Established 2026-05-12 during Phase 1 of `REALIGNMENT.md`. Status:
> in progress.

---

## Core entities

### OpenClaw

**Definition**: 整个仓库 `src/` 下的 Node/TypeScript core，包含 CLI、commands、
infra、media、Gateway、agents、channels、plugin runtime、sessions 等所有
子模块。

**Position**: 仓库根 `src/`。

**与本 fork 的关系**: 本仓库（`wymfly/openclaw`）是 `openclaw/openclaw` 的
增强 fork，`enhanced` 分支跟踪上游。

**Aliases to avoid**: 不要用 "openclaw" 单独指 Gateway——它指**整个 TS core**。

---

### Gateway

**Definition**: OpenClaw 内的**对外控制接口层**——把 OpenClaw 内核能力
通过 RPC（WebSocket / SSE / HTTP）暴露给外部消费者。

**Position**: `src/gateway/`。子目录：

- `protocol/` — typed wire protocol（schema authority）
- `server-methods/` — 各 RPC 方法 handler（按域分文件，如 `chat.ts`、
  `agents.ts`、`config.ts`、`sessions.ts`、`skills.ts` 等 50+ 模块）
- `server-methods/deck/` — **专门给 deck 用的 RPC 命名空间**
- `server/`、`services/` — 服务支撑

**与 OpenClaw 的关系**: Gateway **是 OpenClaw 的子模块**，不是平行实体。

**扩展机制**: `src/gateway/server-methods/_method-defs.generated.ts` 和
`_modules.generated.ts` 是**自动生成**的索引文件——意味着加一个新 RPC
模块（如 `deck.module.ts`）只需写新文件、跑 generator，dispatcher 自动注册，
**不需要手工修改核心 dispatcher 源代码**。这让 deck 扩展可以零冲突合入
OpenClaw 主线。

---

### deck-go

**Definition**: 控制端（"control 端"）。通过 Gateway 的 RPC API 控制 OpenClaw
runtime。是企业管理 / 运维平台的实现。

**Position**: 仓库根 `deck-go/`：

- `backend/` — Go BFF
- `frontend-new/` — React frontend（active workspace）
- `contracts/` — 契约源 + 生成产物

**与 OpenClaw 的关系**: 通过 Gateway 间接交互。**Browser 代码不直接调 Gateway**
——只调 deck-go BFF，BFF 再调 Gateway。

**Runtime modes**（由 `.env` 决定，运行时不切换）:

- `bundled`: deck-go 本机 spawn OpenClaw Gateway
- `remote`: deck-go 连接远程已运行的 Gateway

---

### runtime（"runtime 端"）

**Definition**: 与 control 端（deck-go）相对的 **被控制方** 概念。本项目里
有**狭义 / 广义** 两层用法，必须按上下文区分:

| 层               | 范围                                                                                                                                                         | 用在哪里                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| **狭义 runtime** | OpenClaw 内核里**真正执行** agent / session / channel / plugin 的部分（`src/agents/`、`src/channels/`、`src/plugins/`、`src/sessions/`、`src/commands/` 等） | 讨论"内核稳定性"、"Gateway 调内核能力"时 |
| **广义 runtime** | OpenClaw 整体（含 Gateway 接口层）—— deck-go control 视角下的**真实控制对象**                                                                                | 用户口语"runtime 端"主要指这一层         |

**deck-go control 的精确对象** = **一个 Gateway 对象**：

- `bundled`: deck-go 自己 spawn 的子进程 Gateway
- `remote`: 远程已运行的 Gateway
- 这两种 control 视角下统一为"一个 Gateway 对象"

**Aliases / 写代码时的精确化**:

- "Gateway runtime" → 广义 runtime
- "internal runtime" / "kernel runtime" → 狭义 runtime
- 不要单独说 "runtime"，必须带前缀

---

## Relationships

```
┌──────────────────────────────────┐
│ Browser (React / frontend-new)   │
└──────────────┬───────────────────┘
               │ HTTP / SSE
┌──────────────▼───────────────────┐
│ deck-go BFF (Go, backend/)       │  ← "control 端"
└──────────────┬───────────────────┘
               │ Gateway RPC (WS / HTTP / SSE)
┌──────────────▼───────────────────┐
│ Gateway (src/gateway/)           │  ← OpenClaw 的对外接口层
│   含通用方法 + deck-* 命名空间   │
└──────────────┬───────────────────┘
               │ in-process
┌──────────────▼───────────────────┐
│ OpenClaw 内核                    │  ← "runtime 端"
│   src/agents/                    │
│   src/channels/                  │
│   src/plugins/                   │
│   src/commands/                  │
│   src/sessions/                  │
│   ...                            │
└──────────────────────────────────┘
```

---

## Flagged ambiguities

### A1. "避免大幅改动 OpenClaw" 的边界 — ✅ Resolved 2026-05-12

**用户表达**: "为了避免大幅改动 openclaw，所以通过这种接口层来做控制端"

**代码事实**: `src/gateway/server-methods/deck/` 已存在专门的 deck-\* RPC
命名空间（`deck.module.ts` / `deck-auth.module.ts` / `deck-post-agents.module.ts`

- deck/ 子目录）。

**用户澄清的动机（A + C + D 三层叠加）**:

- **A. Rebase 痛** — OpenClaw 是 fork，需要经常 fetch upstream 修缺陷和拉
  新功能。控制端代码冲突要尽可能少
- **C. 内核稳定** — 不希望 deck-go 这个新需求反向逼 OpenClaw 内核改设计
- **D. 实施可控** — 增量都尽量做在 deck-go 一侧，避免在 OpenClaw 这边引入
  bug
- 但前提是：deck-go 要做产品化设计，原生 Gateway RPC 不一定全部满足，所以
  允许在 Gateway 层的 deck.\* 命名空间内增量

**实际允许的扩展边界（4 层规则）**:

| 层                                                                                                 | 是否允许改                    | 理由                                              |
| -------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------- |
| 1. OpenClaw 核心模块（agents / channels / plugin runtime / sessions / commands 等）                | ❌ 不动                       | C + D — 内核稳定，不感知 deck                     |
| 2. Gateway 通用 RPC handler（chat.ts / agents.ts / config.ts / sessions.ts 等既有文件）            | ❌ 不修改既有方法签名和行为   | A + C — 上游可能改这些文件                        |
| 3. Gateway 的 deck._ 命名空间（src/gateway/server-methods/deck/ 子目录 + 散在的 deck-_.module.ts） | ✅ **允许写新文件、加新方法** | 纯增量文件，上游不会有，rebase 零冲突             |
| 4. 核心 dispatcher 文件（如 server-methods.ts）                                                    | ❌ 不手工改                   | 靠 `_modules.generated.ts` 生成机制自动注册新模块 |

> ⚠️ **次级 ambiguity（待 Q3 解决）**:
> deck.\* 命名空间内允许写**什么类型**的方法还没说清——纯包装通用 RPC？
> 暴露内核未公开的能力？纯 deck-go 产品逻辑？三类风险不同，需要 Q3 划线。

---

### A3. bundled 模式存废 — Pending Phase 3 decision

**用户表达（Q5 后续）**:

- 当初设计 bundled 模式的目的是"让 deck-go（将来做原生 app）可以包含
  整个 OpenClaw runtime"
- 前端 UI 已经做了一部分 mode-aware 代码
- 现在的演进方向: 把两种模式都用环境变量决定如何启动；**甚至想去掉
  bundled 本地子进程模式**，单独运维 Gateway

**待 Phase 3 决策的选项**:

- a. 立即废掉 bundled，强制 remote-only —— 简化最大
- b. 保留 bundled 但只用于"原生 app 单进程打包"场景；正常 dev/prod
  都走 remote
- c. 暂时保留两种模式，但 control 业务层完全不感知（R2 严格执行）

**当前 Phase 5+ 行动指引（在 A3 决策前）**:

- 任何依赖 bundled-only 行为的代码都标 `// TODO(A3): bundled-only`
- frontend 已有的 mode-aware 代码视为技术债，列入清理 follow-up
- 新写代码默认走 R2 严格 mode-agnostic（即假设最终走 remote-only）

---

### A2. "全面控制" 未定义 surface area

**用户表达**: "通过 gateway 的 rpc api 来全面控制它"

**待澄清**: "全面"的具体范围——哪些操作类别 / 粒度 / 时机 / 形态。

**deck-go 当前契约分层（事实，未由用户确认是否充分）**:

- `deck-mutations.contract.json` — 写操作
- `deck-list-queries.contract.json` — 读列表
- `deck-live-projections.contract.json` — 实时投影
- `deck-streams.contract.json` — 事件流
- `deck-config-write-safety.contract.json` — 配置写入安全策略
- `deck-route-governance.contract.json` — 路由治理
- `deck-dynamic-surfaces.contract.json` — 动态表面
- `deck-endpoints.contract.json` — 端点
- `deck-exceptions.contract.json` — 例外
- `deck-ui.contract.json` — UI 元数据

→ 这种分层暗示 control 不是单一形态。**A2 留待 Phase 2 prototype 阶段
通过手动玩 surface 完整答案**；Phase 1 只把分层维度记下来，不强行定义。

---

## Design rules（grill 沉淀的可执行规则）

### Rule R1 — 新增 deck.\* RPC 方法的协作 protocol（来自 Q3）

**默认做法**: 优先做**类型 1（包装/转换）**——deck.\* 方法只重组通用 RPC
输出为产品友好的 shape，不暴露 OpenClaw 内核没有的新能力。这类不需要
事先询问用户。

**类型 2（暴露内核未公开能力）的允许条件**——必须同时满足:

- 不影响内核稳定性（不依赖内核的 mutable state / private invariants /
  内部实现细节）
- 不是上游高频改动区（触碰的内核区域近期 commit 密度低，rebase 风险小）

**类型 3（纯 deck-go 产品逻辑）的额外考量**:

- 在加 deck.\* 方法前，先 surface "是否应该放 deck-go BFF 而不是 Gateway"
  这个选择题
- 如果产品逻辑不需要内核数据 / 内核流，**默认放 deck-go BFF**

**协作 protocol — 每次新增 deck.\* RPC 之前必须执行**:

1. 标明类型（1 / 2 / 3）
2. 类型 2：列出碰到的内核能力 + 上游该区近期是否改动
3. 类型 3：列出"放 deck-go BFF 的方案"作为替代
4. 召集一次 mini-grill 让用户决策

> ⚠️ **理由**: 用户不读底层 RPC、产品设计由 agent 主导，所以 agent 必须
> **主动**在每次具体新增时把决策点抛给用户，而不是凭判断直接加。这是
> Phase 5 模块展开期反复要执行的 protocol。

### Rule R2 — Control mode-agnostic（来自 Q4）

deck-go control 视角下，"控制对象" 就是**一个 Gateway 对象**，不区分模式。

**强约束**:

- 任何 deck-go BFF 之上的代码（`contracts/` / `frontend-new/` / control 业务
  逻辑）必须 **mode-agnostic** —— 不能根据 `RUNTIME_MODE` 走不同分支
- 模式差别由 `deck-go/backend/internal/runtime/{bundled,remote,facade}/`
  这一层吸收
- 上层只通过 facade interface 调用 Gateway

**含义**:

- frontend 不应该有"bundled-only"或"remote-only"按钮 / 页面 / 字段
- contracts 不应该有 mode-specific 字段
- testing fixtures 应该用同一组契约跑两种模式
- "Gateway 是被 deck-go spawn 的还是远程的" 在 control 业务逻辑层完全不可见

**Q5 Resolution（2026-05-12）**: 进程管理 = **BFF 内部细节，不算 control
surface**。frontend 完全不感知 Gateway 是 spawn 的还是 remote 的；bundled
模式的 spawn/supervise/kill 由 BFF 静默处理；如要"重启 Gateway"必须走
命令行/脚本，不进 UI。

**Forward compatibility note（重要）**:
用户表达的演进方向 = 把模式选择**全部收敛到环境变量**，甚至**去掉 bundled
本地子进程模式**，朝 remote-only / single-binary 方向收敛。R2 mode-agnostic
不仅是当前规则，也是对未来可能的 remote-only 演进的**前向兼容保障**。任何
依赖 bundled-only 行为的代码都是技术债。

> ⚠️ **新 ambiguity A3**: bundled 模式存废 — 见下方 A3。

---

## Module priorities（来自 Q6）

### 核心模块（Phase 5 优先）— 9 个

按用户表述的优先级:

| 模块          | 角色                                      |
| ------------- | ----------------------------------------- |
| **chat** ⭐   | **核心中的核心** — product differentiator |
| **agents**    | chat 的对话主体                           |
| **sessions**  | chat 的容器                               |
| **subagents** | agent 之间的协作                          |
| **channels**  | agent 接入通道                            |
| **plugins**   | agent 能力扩展                            |
| **models**    | agent 用的模型                            |
| **memory**    | agent 的记忆                              |
| **skills**    | agent 的技能                              |

**chat 为什么是 differentiator（用户原话）**:

> "chat 是这个控制端最区别于原生 openclaw 的地方。其他配置可以直接通过
> openclaw 的 cli 或者直接修改 openclaw.json 来实现，但是 chat 不能。"

→ **含义**: 其他模块 deck-go 只是"做得更好用"（替代品存在），**chat 是
"做了原生 OpenClaw 没有的东西"** —— 不可替代的产品价值。

### 边缘模块（不在 Phase 5 主线）— 17 个

| 类别               | 模块                                           | 备注                                     |
| ------------------ | ---------------------------------------------- | ---------------------------------------- |
| 配置（CLI 可替代） | `config` `settings`                            | 走 OpenClaw CLI 或直接编辑 openclaw.json |
| 审批               | `approvals` `exec-approvals` `plugin-approval` | 不是 deck 独有价值                       |
| 运维节点           | `nodes` `cron` `webhooks` `routing`            | 偏部署/调度                              |
| 观察类             | `logs` `usage` `activity` `alerts` `budget`    | 监控向                                   |
| 工具/元            | `api-explorer` `docs` `identity` `gateway`     | 辅助                                     |
| 未明确分类         | `threads`                                      | 倾向 sessions 子概念，Phase 3 厘清       |

**原则**:

- 不是"永远不做"，是 Phase 5 优先级低于 9 个核心
- 如果某个边缘模块 block 核心模块（如 sessions 依赖 identity），按需带做
- 用户未明确"砍掉"任何模块 — 仅优先级排序

### Phase 4 vertical slice 候选 — chat 端到端

基于 chat 是核心 + `.local/` 显示 chat 已反复 remediation
（`chat-prototype-remediation-*`、`chat-sse-bridge-verification`、
`chat-remediation-real-e2e` 等），**Phase 4 强候选 = chat 端到端**:

```
用户在 deck-go 输入消息
  → deck-go BFF 接收（HTTP / SSE）
  → Gateway RPC（chat.send 或 deck.chat.*）
  → agent runtime 执行（含 model / skill / memory / plugin 调用）
  → 流式响应（SSE / WebSocket）回流
  → deck-go BFF 中继
  → frontend 渲染
```

**但这是个大 vertical slice**——锁死它就锁死了整个 deck-go 核心契约链。
Phase 3 决定:

- 直接挑 chat 端到端（高价值高难度）
- 还是先拆出更小子片段（如 sessions 列表 → 起新对话 → 收一条响应）

---

## Grill log（追踪 Phase 1 对话进度）

| Q#  | Topic                                   | Status      | Resolution                                                           |
| --- | --------------------------------------- | ----------- | -------------------------------------------------------------------- |
| 1   | "openclaw" 在用户心里指什么             | ✅ Resolved | 整个 TS core；Gateway 是它的对外接口层                               |
| 2   | "避免大幅改动 openclaw" 的动机          | ✅ Resolved | A+C+D 叠加；产出 4 层扩展边界规则                                    |
| 3   | deck.\* 命名空间内允许的方法**类型**    | ✅ Resolved | 默认类型 1；类型 2/3 走协作 protocol，写进 Rule R1                   |
| 4   | "runtime 端" 的精确指代                 | ✅ Resolved | 狭义=内核 / 广义=含 Gateway；control 对象 = "一个 Gateway 对象"；R2  |
| 5   | bundled 进程管理是否算 control surface  | ✅ Resolved | B - 不算；R2 加 forward compat note；A3 surface bundled 存废         |
| 6   | "全面控制" 模块清单的核心 / 边缘 / 缺失 | ✅ Resolved | 9 核心 + 17 边缘；chat 是 differentiator；Phase 4 候选 = chat 端到端 |

**Phase 1 status**: ✅ **Completed 2026-05-12**

Phase 1 产出汇总:

- 4 个 Core entities 定义（OpenClaw / Gateway / deck-go / runtime）
- 关系图 + control 对象 = "一个 Gateway 对象"的统一抽象
- 3 个 Flagged ambiguities（A1 ✅ / A2 留 Phase 2 / A3 留 Phase 3）
- 2 个 Design rules（R1 deck.\* RPC 协作 / R2 mode-agnostic + 前向兼容）
- 9 核心 + 17 边缘的 Module priorities
- Phase 4 vertical slice 强候选 = chat 端到端

下一步: Phase 2 — `prototype` 摸 chat 控制 surface area（A2 解决）。
