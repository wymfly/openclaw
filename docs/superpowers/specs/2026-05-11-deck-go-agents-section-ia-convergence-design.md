# deck-go Agents Section IA Convergence — Design

- **Date**: 2026-05-11
- **Topic**: deck-go agents 模块详情页 10 子标签 → 任务驱动 11 section 收敛
- **Scope**: deck-go（`deck-go/contracts/`、`deck-go/backend/`、`deck-go/frontend-new/src/components/panels/agents/`、`src/gateway/server-methods/deck/` 中 agents 相关文件）
- **Authority**: 本文是 brainstorming 阶段产出的设计基线，下一步落成 OpenSpec change `deck-go-agents-section-ia-convergence`
- **Owner**: agents 模块
- **Related, not superseded**: `openspec/changes/deck-go-agents-product-control-plane/`、`openspec/changes/deck-go-frontend-agents-rebuild/`、`openspec/changes/archive/2026-05-11-deck-go-agents-model-policy-convergence/`、`openspec/changes/deck-go-chat-agents-contract-typing/`

## 0. 阅读指引

本设计的可动范围与不可动边界：

- **可动**：`agents-panel-state.ts` 的 `AGENT_SECTIONS` 列表与 i18n key、`AgentsPanel.tsx` 的 section switch 与组件结构、`agents-panel.css` 中按 section 划分的样式、Deck-facing 契约的 additive 扩展（impact / inheritance / unresolvedReferences / product write DTO）、deck-go BFF 产品动作，以及必要时的 Gateway `deck.*` 专用适配 RPC。
- **不可动**：design system tokens、design system atoms、Vite/Vitest/TS config、原 `frontend/` legacy、OpenClaw core truth（不改 `src/config/types.agents*.ts` 类型真相、不改 agent runtime / execution / config merge 语义）、OpenClaw 通用 handler 与通用 protocol schema（不改 `src/gateway/server-methods/` 中非 `deck/` namespace 的 handler、不改非 deck namespace schema）、UI 风格（与原型保持一致）。
- **允许扩**：`src/gateway/server-methods/deck/` 这个 deck 客户端 namespace 可以在必要时新增或扩展 `deck.*` RPC；`src/gateway/protocol/schema/deck.ts` 中已有 deck namespace 的 schema 可以 additive 扩字段。新增 RPC 只用于 deck 适配层，不改变 OpenClaw core truth。是否新增 Gateway deck RPC 必须由 §7 的写入策略矩阵证明，不能因为字段属于 agents 模块就默认新增。

任何与上面"不可动"边界冲突的实施建议属于范围外，需先单独立项。

### 0.1 deck-go 适配 OpenClaw Gateway 的总纲

Deck 的前端契约是 **产品契约**，不是 `openclaw.json` 字段的机械搬运。OpenClaw Gateway / OpenClaw runtime 拥有配置解释权：字段如何继承、何时生效、缺省值来自哪里、unknown 值如何保留、某个写入是否伴随 workspace / identity / runtime 副作用，都以 OpenClaw 代码真相为准。

Gateway 的 `config.patch` / `config.apply` / `config.set` 是配置写入原语，可以覆盖多数 `openclaw.json` 写入，但它们本身不表达产品语义。Deck 正常前端功能不得直接暴露 raw config patch；前端只能消费 Deck 产品 DTO / typed hooks / BFF product actions。

写入实现按下列优先级选择：

1. **上游专用 RPC**：当 OpenClaw 已有专用 RPC 且包含必要副作用时必须复用，例如 `agents.update` 写 `workspace` 会同步 workspace 与 identity 文件。
2. **BFF 产品动作 + `config.patch` / `config.apply`**：当动作只是安全地修改 `openclaw.json` 子树，且产品校验、impact、错误映射可在 deck-go BFF 完成时优先采用。
3. **Gateway `deck.*` 专用 RPC**：当功能需要 OpenClaw-side 解释权、Gateway 内部 service、运行时派生、workspace/skill/model/tool 真相、专用 side effect，或 BFF 实现会复制 OpenClaw 语义并产生漂移时采用。

若实施阶段发现某项必须改 OpenClaw core / 非 deck namespace 才能正确实现，则该项退出本 change，记录为 upstream/core follow-up，不在本轮 agents IA 收敛中顺手修改。

## 1. 模块定位与整体 IA

### 1.1 agents 模块在 deck-go 中的定位

agents 模块是 **per-agent control plane**，承担三件事：

1. **配置审查**：让运维一眼看清某个 agent 的完整生效配置（含继承与覆盖来源）
2. **配置变更**：per-agent override 在这里安全地写
3. **影响审查**：让运维在改动 / 删除前看出该 agent 被哪些 bindings 引用、有多少 sessions 依赖

明确**排除**（推到 owning module）：

- 运行时实时状态、最近 activity、session 内容 → 推到 Sessions / Activity / Chat
- model provider / catalog 编辑 → 推到 Models
- skill 安装 / 卸载 → 推到 Skills
- 全局 tools 策略 / 审批配置 → 推到 Tools / Approvals
- channel 连接事实 → 推到 Channels
- bindings 路由规则编辑 → 推到 Routing

### 1.2 三个一级入口

模块顶层结构保持 list + detail 现状，加一个 defaults 顶层入口；section nav + scroll 骨架与原型一致，不引入 drawer / dashboard hero 卡片 / 顶部水平 tabs 等结构性 UI 改动：

```
agents 模块
├─ 入口 A: agents 列表页（默认入口）
│   ├─ 顶部 toolbar: 搜索 / filter / 创建 / 「Defaults」按钮
│   ├─ 左侧 list: 各 agent 行（含 main 保护 badge / configured-default badge）
│   └─ 右侧空态: 提示「选择一个 agent 查看详情」
│
├─ 入口 B: per-agent 详情页（点列表行进入，URL 带 ?agent=<id>）
│   └─ 11 个 section nav + scroll content（§2 详述）
│
└─ 入口 C: Agents Defaults 编辑器（toolbar 「Defaults」按钮，URL ?panel=agents&view=defaults）
    └─ 与 per-agent 详情页同构的 section nav + scroll，但实际只出现 7 个 section
```

### 1.3 defaults editor 与 per-agent 详情页的同构原则

- 同一套 section、同一套 UI atom、同一套 inheritance 行为；只是真相源不同（`agents.defaults` vs `agents.list[id]`）
- defaults editor 实际出现 7 section：保留一个 defaults overview summary；排除 tools / files / routing / danger，并在 workspace / conversation 内裁掉 defaults schema 不存在的字段
- 入口轻量：列表页 toolbar 文字按钮，不是新建顶层 panel、不是 modal、不是 drawer

## 2. 详情页 11 section 与字段决策矩阵

### 2.1 11 section 清单（任务驱动）

| #   | section id     | 用户问题                                           | 在 defaults editor 出现？                                                                                                    |
| --- | -------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | `overview`     | 这个 agent / defaults scope 是谁、配置作用域是什么 | ✓ defaults summary only                                                                                                      |
| 2   | `model`        | 这个 agent 怎么思考                                | ✓ 完整                                                                                                                       |
| 3   | `workspace`    | 这个 agent 在哪里干活、跑什么 runtime              | △ 部分（含 workspace / sandbox / embeddedHarness / embeddedPi / params；defaults 不含 `agentDir` / `runtime` 字段，详 §2.4） |
| 4   | `skills`       | 装了哪些技能                                       | ✓ 完整                                                                                                                       |
| 5   | `subagents`    | 能调度哪些子 agent                                 | ✓ 完整                                                                                                                       |
| 6   | `tools`        | 工具策略和审批                                     | ✗ defaults schema 不存在顶层 `tools`（tool policy 由 per-agent + 根级 `cfg.tools` 决定，非 `agents.defaults.tools`）         |
| 7   | `conversation` | 怎么对话、什么人设、回复节奏                       | △ 部分（含 systemPromptOverride / humanDelay；不含 `groupChat`，per-agent only，详 §2.4）                                    |
| 8   | `delivery`     | 把消息送到哪、心跳节奏                             | ✓ 完整（含 eventStreams / heartbeat）                                                                                        |
| 9   | `files`        | 工作区里的具体文件                                 | ✗ per-agent only                                                                                                             |
| 10  | `routing`      | 谁依赖我（只读）                                   | ✗ per-agent only                                                                                                             |
| 11  | `danger`       | 删除等高危操作                                     | ✗ per-agent only                                                                                                             |

**defaults editor 内实际出现 7 section**：overview / model / workspace / skills / subagents / conversation / delivery。它移除 3 个 per-agent only section（files/routing/danger）和 1 个 schema 不存在 section（tools）；overview 在 defaults editor 中降级为只读 summary，不渲染 per-agent identity 字段。详 §2.4。

### 2.2 字段决策矩阵（按 section）

各 section 字段来源于 `src/config/types.agents.ts` 中 `AgentConfig` 与 `AgentDefaultsConfig`。"写路径"列指前端可调用的 Deck 产品动作；该动作在实现层可能复用上游 RPC、调用 Gateway 通用 `config.patch/apply`，或必要时调用 Gateway `deck.*` 专用 RPC。具体取舍以 §7 的写入策略矩阵为准。

#### overview

| 字段                                | per-agent UI                        | defaults UI                                                                                   | 写路径          |
| ----------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- | --------------- |
| `id`                                | 只读 monospace                      | —                                                                                             | —               |
| `default` (configured-default flag) | 只读 badge "Configured Default"     | —                                                                                             | —               |
| reserved id `main`                  | 只读 badge "Protected System Agent" | —                                                                                             | —               |
| `session.mainKey`                   | 只读 footnote                       | —                                                                                             | —               |
| `name`                              | inline 编辑                         | —                                                                                             | `agents.update` |
| `identity.emoji`                    | inline 编辑                         | —                                                                                             | `agents.update` |
| `identity.avatar`                   | inline 编辑                         | —                                                                                             | `agents.update` |
| defaults summary                    | —                                   | 只读：config hash / defaults scope / affected inheriting agents count / last loaded timestamp | —               |

#### model

model section 含两组字段：role-based model 策略（9 个 global key + 2 个 per-agent target form）+ cognition 行为（思考 / 详略 / 推理可见性 / fast mode / 记忆搜索策略）。

**Role-based model policy**（per-agent 与 defaults 都通过已实施 `deck.agents.modelPolicy.set` 写，target 由 `{ kind, key, agentId? }` 决定；不要把 configPath 当作 key）：

| target                                                        | configPath                             | 说明                    |
| ------------------------------------------------------------- | -------------------------------------- | ----------------------- |
| `{ kind: "global-default", key: "text" }`                     | `agents.defaults.model`                | 全局文本默认模型        |
| `{ kind: "global-default", key: "image" }`                    | `agents.defaults.imageModel`           | 图像理解模型            |
| `{ kind: "global-default", key: "imageGeneration" }`          | `agents.defaults.imageGenerationModel` | 图像生成模型            |
| `{ kind: "global-default", key: "videoGeneration" }`          | `agents.defaults.videoGenerationModel` | 视频生成模型            |
| `{ kind: "global-default", key: "musicGeneration" }`          | `agents.defaults.musicGenerationModel` | 音乐生成模型            |
| `{ kind: "global-default", key: "pdf" }`                      | `agents.defaults.pdfModel`             | PDF 理解模型            |
| `{ kind: "global-default", key: "compaction" }`               | `agents.defaults.compaction.model`     | 上下文压缩模型          |
| `{ kind: "global-default", key: "memorySearch" }`             | `agents.defaults.memorySearch.model`   | 记忆搜索模型            |
| `{ kind: "global-default", key: "subagents" }`                | `agents.defaults.subagents.model`      | 默认子 agent 模型       |
| `{ kind: "agent-model", key: "agent", agentId }`              | `agents.list[].model`                  | per-agent 主模型        |
| `{ kind: "agent-subagents", key: "agentSubagents", agentId }` | `agents.list[].subagents.model`        | per-agent 子 agent 模型 |

| target / 字段路径                                                   | 用户场景                      | per-agent UI                                                                                            | defaults UI                        | 写路径                                                                                                                                                                |
| ------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agents.list[].model` / `agents.defaults.model`                     | 主文本模型 + fallback chain   | 主模型 picker + fallback chain + source badge                                                           | 同（无 per-agent override 这一态） | per-agent: `{ kind: "agent-model", key: "agent", agentId }`；defaults: `{ kind: "global-default", key: "text" }`                                                      |
| `agents.defaults.imageModel`                                        | 图像理解模型                  | 在 per-agent 详情页**只读 inherit**（OpenClaw schema 中无 per-agent imageModel；唯一可写位是 defaults） | role-based picker                  | `{ kind: "global-default", key: "image" }`                                                                                                                            |
| `agents.defaults.imageGenerationModel`                              | 图像生成模型                  | 同上                                                                                                    | role-based picker                  | `{ kind: "global-default", key: "imageGeneration" }`                                                                                                                  |
| `agents.defaults.videoGenerationModel`                              | 视频生成模型                  | 同上                                                                                                    | role-based picker                  | 同                                                                                                                                                                    |
| `agents.defaults.musicGenerationModel`                              | 音乐生成模型                  | 同上                                                                                                    | role-based picker                  | 同                                                                                                                                                                    |
| `agents.defaults.pdfModel`                                          | PDF 理解模型                  | 同上                                                                                                    | role-based picker                  | 同                                                                                                                                                                    |
| `agents.defaults.compaction.model`                                  | 上下文压缩模型                | 同上                                                                                                    | role-based picker                  | 同                                                                                                                                                                    |
| `agents.defaults.memorySearch.model`                                | 记忆搜索模型                  | 同上                                                                                                    | role-based picker                  | 同                                                                                                                                                                    |
| `agents.list[].subagents.model` / `agents.defaults.subagents.model` | 子 agent 默认模型             | role-based picker（per-agent 与 defaults 都可写）                                                       | role-based picker                  | per-agent: `{ kind: "agent-subagents", key: "agentSubagents", agentId }` 或既有 `deck.agents.subagents.set`；defaults: `{ kind: "global-default", key: "subagents" }` |
| `agents.defaults.summaryModel`                                      | 摘要模型（schema 真相不支持） | 只读 "Read-only — not in current schema"                                                                | 只读                               | —                                                                                                                                                                     |

**Cognition 行为字段**（per-agent 与 defaults 真相都有；写入是纯配置子树变更，优先走 BFF 产品动作 + Gateway `config.patch`）：

| 字段                                                                         | per-agent UI                                                            | defaults UI    | 写路径                                                                                                | inheritable |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- | ----------- |
| `thinkingDefault` (`off`/`minimal`/`low`/`medium`/`high`/`xhigh`/`adaptive`) | enum select + source badge                                              | 同（A/B 两态） | BFF `agents.cognition.set` / `agents.defaults.cognition.set` → `config.patch`                         | ✓           |
| `verboseDefault` (`off`/`on`/`full`)                                         | enum select + source badge                                              | 同             | 同上                                                                                                  | ✓           |
| `reasoningDefault` (`on`/`off`/`stream`)                                     | enum select + source badge                                              | 同             | 同上                                                                                                  | ✓           |
| `fastModeDefault` (`boolean`)                                                | toggle + source badge                                                   | 同             | 同上                                                                                                  | ✓           |
| `memorySearch` (除 `.model` 外子字段)                                        | 子表单 + source badge；`memorySearch.model` 由上面 role-based picker 写 | 同             | BFF cognition action patch memorySearch 子字段；`memorySearch.model` 走 `deck.agents.modelPolicy.set` | ✓           |

`AgentDefaultsConfig` 里还存在 defaults-only 的认知/回复控制字段（`elevatedDefault`、block streaming 系列等）。这些不在 per-agent 详情页渲染 override 控件，但 defaults editor 必须在 model/cognition advanced group 中提供产品化编辑入口，详 §2.4。

跨模块跳转："Manage providers → Models"（每个 picker 下方）。

> 实施提示：per-agent imageModel/imageGenerationModel/videoGenerationModel/musicGenerationModel/pdfModel/compaction.model 在当前 OpenClaw schema 真相中**不是 per-agent 字段**（仅 `agents.defaults.*` 存在）；详情页对这些角色显示 inherit 来源 + "Manage in defaults →" 链接，不出现 per-agent override 控件。这是 schema 真相决定的边界，不是产品选择。

#### workspace

| 字段                                 | per-agent UI                                     | defaults UI                                                                      | 写路径                                                                                          | inheritable                                                                    |
| ------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `workspace` (path)                   | guarded edit                                     | guarded edit（defaults 真相也有 `workspace`，是所有 agent 的 default workspace） | per-agent: 上游 `agents.update`；defaults: BFF `agents.defaults.workspace.set` → `config.patch` | ✓（per-agent 未设时回退到 defaults.workspace；详 `agent-scope-config.ts:132`） |
| `agentDir`                           | guarded edit                                     | — (defaults schema 无 agentDir)                                                  | BFF `agents.workspace.set` → `config.patch`                                                     | ✗                                                                              |
| `runtime` (embedded/acp + 子参数)    | guarded edit + 子表单                            | **不出现**（schema 真相不存在 `agents.defaults.runtime`）                        | BFF `agents.workspace.set` → `config.patch`                                                     | ✗（defaults 不可继承）                                                         |
| `sandbox`                            | guarded edit                                     | inline edit                                                                      | BFF `agents.workspace.set` / `agents.defaults.workspace.set` → `config.patch`                   | ✓                                                                              |
| `embeddedHarness`                    | advanced collapse 内 guarded edit                | inline edit                                                                      | 同                                                                                              | ✓                                                                              |
| `embeddedPi.executionContract`       | advanced collapse 内 guarded edit + source badge | advanced collapse 内 guarded edit                                                | BFF `agents.workspace.set` / `agents.defaults.workspace.set` → `config.patch`                   | ✓                                                                              |
| `params` (`Record<string, unknown>`) | JSON editor + schema hint                        | JSON editor                                                                      | BFF `agents.workspace.set` / `agents.defaults.workspace.set` → `config.patch`                   | ✓                                                                              |

> 实施提示：`agents.update` 上游 RPC 改 `workspace` 时会执行 workspace 初始化与 identity 文件同步副作用，所以 per-agent `workspace` path 必须走 `agents.update` 或复用同一套 Gateway helper，不能用 raw `config.patch` 代替。实施第一步必须 grep 并记录 `src/gateway/server-methods/agents.ts` 中 `agents.update` handler 的 workspace handling、`ensureAgentWorkspace`、`buildIdentityMarkdownOrRespondUnsafe` / `writeWorkspaceFileOrRespond` 证据。其余 per-agent workspace section 字段（agentDir/runtime/sandbox/embeddedHarness/embeddedPi/params）当前按纯配置写入处理，走 BFF 产品动作 + `config.patch`；若实施 explore 发现其中某项需要 Gateway-side 解释或副作用，再按 §7.2 升级为 Gateway deck RPC 并记录理由。

#### skills

| 字段                  | per-agent UI                                        | defaults UI | 写路径                                                                                                | inheritable |
| --------------------- | --------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------- | ----------- |
| `skills` (`string[]`) | mode `all`/`whitelist` + 搜索分配 UI + source badge | 同          | per-agent: 已有 `deck.agents.skills.set`；defaults: BFF `agents.defaults.skills.set` → `config.patch` | ✓           |

跨模块跳转："Manage skills → Skills"。

#### subagents

| 字段                                                                                                                                                                                                             | per-agent UI                             | defaults UI                     | 写路径                                                                                                                                                                                          | inheritable     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `subagents.allowAgents`                                                                                                                                                                                          | mode `allow any (*)` / `explicit list`   | 同                              | per-agent: 已有 `deck.agents.subagents.set`；defaults: BFF `agents.defaults.subagents.set` → `config.patch`                                                                                     | ✓               |
| `subagents.model`                                                                                                                                                                                                | 模型 picker（同 model section）          | 同                              | per-agent: `deck.agents.subagents.set` 或 `deck.agents.modelPolicy.set` `{ kind: "agent-subagents", key: "agentSubagents", agentId }`；defaults: `{ kind: "global-default", key: "subagents" }` | ✓               |
| `subagents.requireAgentId`                                                                                                                                                                                       | toggle                                   | toggle                          | per-agent: 扩 `deck.agents.subagents.set` schema；defaults: BFF `agents.defaults.subagents.set` → `config.patch`                                                                                | ✓               |
| `subagents.maxConcurrent` / `subagents.maxSpawnDepth` / `subagents.maxChildrenPerAgent` / `subagents.archiveAfterMinutes` / `subagents.thinking` / `subagents.runTimeoutSeconds` / `subagents.announceTimeoutMs` | 在 defaults 真相中存在的 advanced 子字段 | inline edit + advanced collapse | BFF `agents.defaults.subagents.set` → `config.patch`                                                                                                                                            | — defaults only |

> 实施提示：当前 `deck.agents.subagents.set` schema 真相在 `src/gateway/protocol/schema/deck.ts:116` 只接 `agentId / allowAgents / model / baseHash`；本提案明确扩它加 `requireAgentId`（属 deck namespace 自身 schema 扩，允许范围内）。advanced 子字段（maxConcurrent 等）当前 OpenClaw schema 在 `agents.defaults.subagents` 上有；defaults editor 写入由 BFF 产品动作构造安全 patch，不新增 Gateway 层 defaults 方法。

跨模块跳转："Monitor runs → Subagents"。

#### tools（**per-agent only section；defaults editor 不出现**）

| 字段                                       | per-agent UI                                                                              | 写路径                                                                                                 | inheritable |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------- |
| 生效 tools policy preview                  | 只读分组（global root `cfg.tools` / agent override `agents.list[].tools` / sandbox 影响） | `deck.agents.toolPolicy.preview`                                                                       | —           |
| `agents.list[].tools` (per-agent override) | guarded edit + allow/deny matrix                                                          | BFF `agents.toolsOverride.set` → `config.patch`；preview 仍走 Gateway `deck.agents.toolPolicy.preview` | ✗           |

> 实施事实：`AgentDefaultsConfig` schema 真相**没有**顶层 `tools` 字段；tool policy 继承链是 per-agent `agents.list[].tools` + 全局根级 `cfg.tools`（详 `src/gateway/server-methods/deck/agents-preview-tool-policy.ts:55`）。所以本 section 在 defaults editor 不出现；全局策略由 Tools / Approvals 模块写权。

跨模块跳转："Manage global tool policy → Tools / Approvals"。

#### conversation

| 字段                   | per-agent UI                                               | defaults UI                                                                                               | 写路径                                                                                                    | inheritable |
| ---------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------- |
| `systemPromptOverride` | textarea + preview from `deck.agents.systemPrompt.preview` | textarea + preview                                                                                        | BFF `agents.conversation.set` / `agents.defaults.conversation.set` → `config.patch`；preview 仍走 Gateway | ✓           |
| `humanDelay`           | 子表单 (min/max/enabled)                                   | 子表单                                                                                                    | 同上                                                                                                      | ✓           |
| `groupChat`            | 子表单                                                     | **不出现**（`AgentDefaultsConfig` 真相不含 `groupChat`；详 `src/config/types.agent-defaults.ts:150-386`） | BFF `agents.conversation.set` → `config.patch`                                                            | ✗           |

`AgentDefaultsConfig` 里存在 defaults-only 的 envelope / timeout / media / typing 字段。它们是全局对话行为默认值，不在 per-agent detail 中显示 override 控件；defaults editor 在 conversation advanced group 中集中编辑，详 §2.4。

#### delivery

| 字段                                                                                                 | per-agent UI                                              | defaults UI | 写路径                                                                                                                                             | inheritable |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `channels.eventStreams` (`string[]`)                                                                 | declared options 多选 + unknown 保留 + base-hash 冲突处理 | 同          | per-agent: 已有 `deck.agents.eventStreams.set`；defaults: BFF `agents.defaults.eventStreams.set` → `config.patch`，并复用同一 normalization helper | ✓           |
| `heartbeat` (含 enabled / intervalMs / promptOverride / sessionKey / runTimeoutSeconds 等真相子字段) | 子表单 (开关 + 子字段) + advanced collapse                | 同          | BFF `agents.delivery.set` / `agents.defaults.delivery.set` → `config.patch`                                                                        | ✓           |

跨模块跳转："Manage channels → Channels"、"View activity → Activity"。

#### files（per-agent only）

| 操作                                  | UI                        | 写路径              |
| ------------------------------------- | ------------------------- | ------------------- |
| List Gateway-allowed filenames        | 列表 + 选中               | `agents.files.list` |
| Read file content                     | readonly viewer           | `agents.files.get`  |
| Write file content（已 allowed 文件） | 编辑器 + diff + base-hash | `agents.files.set`  |
| Delete file                           | **本轮不开放**            | —                   |
| Create file（任意新文件）             | **本轮不开放**            | —                   |

#### routing（per-agent only，全只读）

| 项                                            | UI                                                                                                                        | 写路径 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------ |
| `impact.bindings.samples` filtered by agentId | 只读 samples 列表（bindingIndex / type / channel / accountId / peer / summary）；truncated 时显示 "View all in Routing →" | —      |
| sessions 引用计数                             | 只读数字 + 跳转                                                                                                           | —      |

跨模块跳转："Manage bindings → Routing"、"View in Sessions → Sessions"。

#### danger（per-agent only）

| 操作                                    | UI                                                            | 写路径          |
| --------------------------------------- | ------------------------------------------------------------- | --------------- |
| Delete agent（非 main）                 | impact dialog + 手输 id 二次确认 + BFF 强制 deleteFiles=false | `agents.delete` |
| Delete `main`                           | 不渲染按钮                                                    | —               |
| Switch configured default               | **本轮不开放**                                                | —               |
| Delete agent workspace files / sessions | **本轮不开放**                                                | —               |

### 2.3 盲区字段归位汇总

| 字段                           | 归位 section                       | 写路径 (per-agent)                             | 写路径 (defaults)                                                               |
| ------------------------------ | ---------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `embeddedHarness`              | workspace > advanced               | BFF `agents.workspace.set` → `config.patch`    | BFF `agents.defaults.workspace.set` → `config.patch`                            |
| `embeddedPi`                   | workspace > advanced               | BFF `agents.workspace.set` → `config.patch`    | BFF `agents.defaults.workspace.set` → `config.patch`                            |
| `params`                       | workspace > advanced (JSON editor) | BFF `agents.workspace.set` → `config.patch`    | BFF `agents.defaults.workspace.set` → `config.patch`                            |
| `thinkingDefault`              | model > cognition                  | BFF `agents.cognition.set` → `config.patch`    | BFF `agents.defaults.cognition.set` → `config.patch`                            |
| `verboseDefault`               | model > cognition                  | BFF `agents.cognition.set` → `config.patch`    | BFF `agents.defaults.cognition.set` → `config.patch`                            |
| `reasoningDefault`             | model > cognition                  | BFF `agents.cognition.set` → `config.patch`    | BFF `agents.defaults.cognition.set` → `config.patch`                            |
| `fastModeDefault`              | model > cognition                  | BFF `agents.cognition.set` → `config.patch`    | BFF `agents.defaults.cognition.set` → `config.patch`                            |
| `memorySearch` (不含 `.model`) | model > cognition                  | BFF `agents.cognition.set` → `config.patch`    | BFF `agents.defaults.cognition.set` → `config.patch`                            |
| `memorySearch.model`           | model > role-based                 | per-agent 不存在写位；只读 inherit             | `deck.agents.modelPolicy.set` `{ kind: "global-default", key: "memorySearch" }` |
| `humanDelay`                   | conversation                       | BFF `agents.conversation.set` → `config.patch` | BFF `agents.defaults.conversation.set` → `config.patch`                         |
| `heartbeat`                    | delivery                           | BFF `agents.delivery.set` → `config.patch`     | BFF `agents.defaults.delivery.set` → `config.patch`                             |
| `groupChat`                    | conversation                       | BFF `agents.conversation.set` → `config.patch` | — (per-agent only)                                                              |

`runtime` 这个原本歧义的 section 拆为 `workspace`（物理边界）+ `model`（认知配置）。

### 2.4 defaults editor 字段支持矩阵（基于 `AgentDefaultsConfig` schema 真相）

下表逐 section 列出 defaults editor 内**实际可见且可写**的字段，以及 schema 有但归属其他模块或不在本轮产品化的字段。判断口径 = `src/config/types.agent-defaults.ts` 中 `AgentDefaultsConfig` 真相是否含此字段（或同名子字段）；不存在的字段在 defaults editor 不渲染（不是 disabled，是不渲染），避免 UI 暗示一个不存在的写位。schema 存在但不适合 agents 模块编辑的字段必须写明 owning module 或 follow-up，不得静默遗漏。

| section            | defaults 出现？ | 出现字段（已对照 schema 真相）                                                                                                                                                                                                                                                                                                                                                                                        | defaults 不可见 / 不在本模块编辑字段（原因）                                                                                       | 写路径                                                                                                                       |
| ------------------ | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| overview           | ✓ summary only  | config hash / defaults scope / affected inheriting agents count / last loaded timestamp                                                                                                                                                                                                                                                                                                                               | id / name / identity / default badge / mainKey                                                                                     | —                                                                                                                            |
| model — role-based | ✓               | `model` / `imageModel` / `imageGenerationModel` / `videoGenerationModel` / `musicGenerationModel` / `pdfModel` / `compaction.model` / `memorySearch.model` / `subagents.model`                                                                                                                                                                                                                                        | `models` catalog 由 Models 模块 owning；`mediaGenerationAutoProviderFallback` / `pdfMaxBytesMb` / `pdfMaxPages` 归 Models advanced | `deck.agents.modelPolicy.set`（已实施 9 个 global key + 2 个 per-agent target form，详 §2.B）; Models-owned 字段不在本模块写 |
| model — cognition  | ✓               | `thinkingDefault` / `verboseDefault` / `reasoningDefault` / `fastModeDefault` / `elevatedDefault` / `blockStreamingDefault` / `blockStreamingBreak` / `blockStreamingChunk` / `blockStreamingCoalesce` / `memorySearch.{topK, minScore, mode, ...}`                                                                                                                                                                   | —                                                                                                                                  | BFF `agents.defaults.cognition.set` → `config.patch`                                                                         |
| workspace          | △ 部分          | `workspace` / `sandbox` / `embeddedHarness` / `embeddedPi.{projectSettingsPolicy,executionContract}` / `params` / advanced bootstrap/runtime defaults（`repoRoot` / `skipBootstrap` / `contextInjection` / `bootstrapMaxChars` / `bootstrapTotalMaxChars` / `localModelMode` / `bootstrapPromptTruncationWarning` / `startupContext` / `contextTokens` / `cliBackends` / `contextPruning` / `llm` / `maxConcurrent`） | `agentDir` / `runtime`                                                                                                             | BFF `agents.defaults.workspace.set` → `config.patch`                                                                         |
| skills             | ✓               | `skills` (string[])                                                                                                                                                                                                                                                                                                                                                                                                   | —                                                                                                                                  | BFF `agents.defaults.skills.set` → `config.patch`                                                                            |
| subagents          | ✓               | `subagents.allowAgents` / `subagents.model` / `subagents.requireAgentId` / `subagents.maxConcurrent` / `subagents.maxSpawnDepth` / `subagents.maxChildrenPerAgent` / `subagents.archiveAfterMinutes` / `subagents.thinking` / `subagents.runTimeoutSeconds` / `subagents.announceTimeoutMs`                                                                                                                           | —                                                                                                                                  | BFF `agents.defaults.subagents.set` → `config.patch`                                                                         |
| tools              | ✗               | —                                                                                                                                                                                                                                                                                                                                                                                                                     | 顶层 `tools` 不存在于 `AgentDefaultsConfig`；全局策略由 Tools/Approvals 写                                                         | —                                                                                                                            |
| conversation       | △ 部分          | `systemPromptOverride` / `humanDelay` / response envelope defaults（`userTimezone` / `timeFormat` / `envelopeTimezone` / `envelopeTimestamp` / `envelopeElapsed` / `timeoutSeconds` / `mediaMaxMb` / `imageMaxDimensionPx` / `typingIntervalSeconds` / `typingMode`）                                                                                                                                                 | `groupChat`（per-agent only）                                                                                                      | BFF `agents.defaults.conversation.set` → `config.patch`                                                                      |
| delivery           | ✓               | `channels.eventStreams` / `heartbeat`（含 enabled、intervalMs、lightContext、isolatedSession 等真相子字段）                                                                                                                                                                                                                                                                                                           | —                                                                                                                                  | BFF `agents.defaults.eventStreams.set` / `agents.defaults.delivery.set` → `config.patch`                                     |
| files              | ✗               | —                                                                                                                                                                                                                                                                                                                                                                                                                     | workspace files 是 per-agent 文件                                                                                                  | —                                                                                                                            |
| routing            | ✗               | —                                                                                                                                                                                                                                                                                                                                                                                                                     | bindings 是 per-agent 依赖                                                                                                         | —                                                                                                                            |
| danger             | ✗               | —                                                                                                                                                                                                                                                                                                                                                                                                                     | delete agent 是 per-agent 操作                                                                                                     | —                                                                                                                            |

> 实施提示：`agents.defaults.workspace` 是合法 schema 字段（`src/config/types.agent-defaults.ts:181`）且确实被 `resolveAgentWorkspaceDir` 用作 fallback（`src/agents/agent-scope-config.ts:139`），所以 defaults editor 内 `workspace` 字段是真实可编辑的，UI 必须明示"This path is used by any agent whose per-agent workspace is unset"。

## 3. 操作权限与风险等级矩阵

### 3.1 五级风险定义

| 等级 | 名称           | 视觉                                                     | 交互                                                     |
| ---- | -------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| L0   | read-only      | 灰底 + "Managed in `<module>`" link                      | 不可编辑；点 link 跳目标模块                             |
| L1   | inline edit    | 普通 input / select / toggle                             | blur 或回车直接 save；失败 toast；无 impact dialog       |
| L2   | guarded edit   | 折叠态只读 summary + "Edit" 按钮（中性色）               | 展开后底部 "Save / Cancel"，Save 前展示 diff 摘要        |
| L3   | high-risk edit | "Edit" 按钮 warning 描边 + 展开后顶部红条 impact preview | 必须勾选 "I understand…" 复选框 + Save destructive 色    |
| L4   | destructive    | 整 section 红底 + 危险图标                               | confirmation modal 要求手输 agent id；BFF 端 id 校验兜底 |

通用护栏：

- L2+：base-hash / config-hash 冲突时不静默 retry，提示用户 reload / overwrite，保留 dirty draft
- L2+：所有 save 失败显示具体错误原因，不能只 "Save failed"
- L3+：必须有 impact preview；如果 BFF 暂时无法提供，UI 红条提示而**不**默默隐藏
- main 保护：所有 main 的 L2/L3 编辑器顶部加保护提示条；delete 按钮整体不渲染；L3 编辑器要求先勾"I understand main is fallback"

### 3.2 全 11 section 字段风险等级矩阵

#### overview

| 字段                                                 | 等级 |
| ---------------------------------------------------- | ---- |
| `id` / `default` flag / `session.mainKey` / 保护标识 | L0   |
| `name` / `identity.emoji` / `identity.avatar`        | L1   |

#### model

| 字段                                                                                                                                 | 等级 |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 生效来源 badge / catalog link / `agents.defaults.summaryModel`                                                                       | L0   |
| `model.primary` / `model.fallbacks` / `thinkingDefault` / `verboseDefault` / `reasoningDefault` / `fastModeDefault` / `memorySearch` | L2   |

#### workspace

| 字段                                                                                                            | 等级 |
| --------------------------------------------------------------------------------------------------------------- | ---- |
| `workspace` (path) / `agentDir` / `runtime` kind 切换 / `sandbox` / `embeddedHarness` / `embeddedPi` / `params` | L3   |
| `runtime.acp.*` 子参数（不切 kind）                                                                             | L2   |

#### skills

| 项                                                   | 等级 |
| ---------------------------------------------------- | ---- |
| mode `all` / `whitelist` 切换 / whitelist add/remove | L2   |
| ineligible skill 行 / skill catalog                  | L0   |

#### subagents

| 项                                                                    | 等级 |
| --------------------------------------------------------------------- | ---- |
| `allowAgents` 从 `*` 切到 explicit                                    | L3   |
| explicit list 内增减 / `subagents.model` / `subagents.requireAgentId` | L2   |
| subagent runtime monitoring                                           | L0   |

#### tools

| 项                                         | 等级 |
| ------------------------------------------ | ---- |
| 生效 preview / 全局 policy / approval 配置 | L0   |
| `tools` per-agent override                 | L3   |

#### conversation

| 字段                                                | 等级                                                      |
| --------------------------------------------------- | --------------------------------------------------------- |
| `systemPromptOverride` / `humanDelay` / `groupChat` | L2（若 `groupChat` 真相对象含跨 agent 发言类字段则升 L3） |

#### delivery

| 字段                                  | 等级 |
| ------------------------------------- | ---- |
| `channels.eventStreams` / `heartbeat` | L2   |
| channel 连接事实 / event 流转监控     | L0   |

#### files

| 项                            | 等级       |
| ----------------------------- | ---------- |
| List / Read                   | L0         |
| Write existing file           | L2         |
| Delete file / Create new file | **不开放** |

#### routing

| 项   | 等级 |
| ---- | ---- |
| 全部 | L0   |

#### danger

| 项                                                            | 等级       |
| ------------------------------------------------------------- | ---------- |
| Delete non-main agent                                         | L4         |
| Delete main / switch default / delete files / delete sessions | **不开放** |

### 3.3 视觉语言

复用现有 atoms（Button / Banner / Modal / Card / Input / Select / Toggle / Chip / Badge）。**不新增 atom**。L1–L4 视觉差异通过现有 atom 组合 + design-system tokens 实现，避免"L2 与 L3 长得一样"造成认知漏防。

## 4. Inheritance 视觉模型

### 4.1 三层继承链

```
OpenClaw 内置默认值 (硬编码常量)
    ↓ agents.defaults.X 未设时回退到此
agents.defaults.X (顶层 defaults editor 编辑)
    ↓ agents.list[id].X 未设时回退到此
agents.list[id].X (per-agent override)
    ↓
final effective value
```

OpenClaw 内置默认值不在 deck-go 内可编辑，但 UI 必须能解释最终值的来源。

### 4.2 一个 inheritable 字段的三态

| 状态 | 触发                                        | per-agent 详情页 badge                                      | defaults editor badge     | reset 可用 |
| ---- | ------------------------------------------- | ----------------------------------------------------------- | ------------------------- | ---------- |
| A    | `agents.defaults.X` 未设 ∧ per-agent.X 未设 | "Inherited from OpenClaw default" (gray)                    | "OpenClaw default" (gray) | ✗          |
| B    | `agents.defaults.X` 已设 ∧ per-agent.X 未设 | "Inherited from Agents Defaults" (blue) + "Edit defaults →" | "Set in defaults" (blue)  | ✗          |
| C    | per-agent.X 已设                            | "Overridden for this agent" (amber) + "Reset to default"    | —                         | ✓          |

不引入"显式 unset"第四态：OpenClaw config 真相里 key 缺失 = inherit，clear override = remove key。

### 4.3 Source badge 视觉规范

复用 `Badge` atom，token：

| 来源                            | label key             | 颜色 token                   | 图标                                        |
| ------------------------------- | --------------------- | ---------------------------- | ------------------------------------------- |
| OpenClaw default                | `inherit.openclaw`    | `--ds-color-neutral-fg`      | —                                           |
| Agents Defaults                 | `inherit.defaults`    | `--ds-color-info-fg`         | link-out（跳 defaults editor 对应 section） |
| Overridden                      | `inherit.override`    | `--ds-color-warning-fg`      | — + "Reset to default" 按钮                 |
| Unsupported (如 `summaryModel`) | `inherit.unsupported` | `--ds-color-neutral-fg` 亚灰 | lock icon                                   |

### 4.4 Reset 操作语义

- L2 字段：inline confirm chip "Reset? Yes / Cancel"，确认后 PATCH 移除字段
- L3 字段：进入 L3 同款 impact dialog（reset 也算运行行为变更）
- 批量字段（如 model + cognition 一组）：section header 提供 "Reset section to defaults" 二级菜单项，弹 modal 列出该 section 内所有 overridden 字段 + effective value，用户勾选要 reset 哪些后批量 PATCH

### 4.5 Effective value 计算口径：Gateway-side 计算

理由：

- 前端 reverse-engineer inherit 链危险（OpenClaw 内置默认不在前端、嵌套对象 inherit 语义复杂）
- detail handler（OpenClaw Gateway 内）生成 DTO 时同时返回 `raw` 与 `effective`，前端用 `source` 决定 badge

契约 delta：见 §7。新建对象 DTO `DeckGoAgentEffectiveField`（**与既有 string union `DeckGoAgentEffectiveSource` 并存**，不替换）：

```ts
type DeckGoAgentEffectiveField<T = unknown> = {
  /** 实际生效值 */
  effective?: T;
  /** 来源标识，复用既有 string union DeckGoAgentEffectiveSource = "agent" | "default" | "derived" | "gateway" | "unknown" */
  source: DeckGoAgentEffectiveSource;
  /** per-agent 是否显式 override（用于 UI 决定 reset 按钮可用性） */
  hasOverride: boolean;
  /** 上一层（defaults 或 openclaw-default）的值，用于 reset 预览（可选） */
  fallback?: T;
  /** reset 操作是否可用（综合 hasOverride 与 schema 真相） */
  canReset?: boolean;
  /** unsupported 字段（如 summaryModel）的原因 */
  fallbackReason?: string;
};
```

注意 `source` 复用 `deck-go/contracts/source/deck-api.contract.ts:1555` 的 string union — 不破坏既有消费者；既有 `DeckGoAgentEffectiveSources`（line 1557）保留不变。新对象 DTO 仅在新增 inheritance map（§7）中使用。

如果对某字段 Gateway 暂无法返回 source（如 `embeddedHarness` 深嵌套），UI 用降级：badge "Source unknown"（灰），reset 按钮 disabled + tooltip。**前端不假装计算 effective**。

### 4.6 Unknown 字段保留规则

OpenClaw config 允许字段含 declared-options 之外的值（unknown stream / 已卸载 skill / 已删除 agent id / 不在 catalog 的 model 等）。处理：

- UI 显示 declared options + 已存在 unknown 值，标 "unknown" badge
- save 必须保留 unknown 值（除非用户显式 remove）
- 前端永不静默 cleanup

具体见 §6.7 unresolved references modal。

### 4.7 defaults editor 内的 inheritance（仅 A/B 两态）

defaults editor 内编辑字段，没有 per-agent override 这一层：

- A: 显示 "OpenClaw default: `<built-in>`" + "Set defaults" 按钮
- B: 显示 override value + "Reset to OpenClaw default" 按钮

### 4.8 嵌套对象 inherit 边界（实施阶段验证）

`subagents` / `memorySearch` / `heartbeat` / `sandbox` / `embeddedHarness` / `embeddedPi` / `groupChat` / `humanDelay` 这类嵌套对象的 inherit 行为以 **OpenClaw config 实际合并语义为准**：

- 实施第一步必须先 grep / 阅读 OpenClaw 中相应字段的解析与合并代码（如 `src/agents/agent-scope-config.ts` 等），确认是 replace-as-a-whole（per-agent key 缺失 = 整对象继承 defaults）还是 merge by sub-keys（per-agent 子键可选择性 override）。
- 如发现是 replace-as-a-whole：UI 必须以**整对象**为单位呈现 inherit / overridden 状态；子字段不可单独 reset 到 inherited 而保留对象其余子字段为 override（因为 OpenClaw 不支持这种状态）。source badge 挂在对象级 label 上。
- 如发现是 merge by sub-keys：UI 可以以**子字段**为单位呈现 inherit / overridden 状态；source badge 挂在每个子字段上。
- 不允许"猜"。如果 OpenClaw 代码对不同嵌套对象有不同合并语义，本设计中相应 section 内每个对象按其真相单独标注。

`§7.2.B` 中 `DeckGoAgentInheritanceMap` 的字段粒度配合此原则：当前以"对象级"列出（`sandbox` / `embeddedHarness` / `embeddedPi` 等作为一个 `DeckGoAgentEffectiveField`）。`runtime` 是 per-agent only 字段，不进入 inheritance map。实施时若发现某对象必须下钻到子字段粒度，再在 additive 扩展中下钻（保持向后兼容）。

`subagents` / `skills` / `channels.eventStreams` 已有自己的 mode 概念（allow-any/explicit、all/whitelist、declared+unknown），不重复进入 inheritance map；其内部 mode 切换即是 source 切换。

## 5. 跨模块边界与跳转矩阵

### 5.1 模块写权矩阵

每个 OpenClaw 概念**有且仅有一个**写权主（W）；其他模块 R-only 引用并跳转。

| OpenClaw 概念                                                         | Agents              | Models | Skills | Subagents | Tools/Approvals | Channels | Routing | Sessions/Activity |
| --------------------------------------------------------------------- | ------------------- | ------ | ------ | --------- | --------------- | -------- | ------- | ----------------- |
| `agents.list[]` lifecycle                                             | W                   | —      | —      | —         | —               | —        | —       | —                 |
| `agents.list[].identity.*`                                            | W                   | —      | —      | —         | —               | —        | —       | —                 |
| `agents.list[].workspace` / `agentDir`                                | W                   | —      | —      | —         | —               | —        | —       | —                 |
| `agents.list[].model` per-agent                                       | W                   | R      | —      | —         | —               | —        | —       | —                 |
| `agents.list[].thinking/verbose/reasoning/fastMode`                   | W                   | —      | —      | —         | —               | —        | —       | —                 |
| `agents.list[].skills` per-agent                                      | W                   | —      | R      | —         | —               | —        | —       | —                 |
| `agents.list[].subagents.*`                                           | W                   | —      | —      | R         | —               | —        | —       | —                 |
| `agents.list[].tools` per-agent                                       | W                   | —      | —      | —         | R               | —        | —       | —                 |
| `agents.list[].sandbox`                                               | W                   | —      | —      | —         | R               | —        | —       | —                 |
| `agents.list[].channels.eventStreams`                                 | W                   | —      | —      | —         | —               | R        | —       | —                 |
| `agents.list[].systemPromptOverride`                                  | W                   | —      | —      | —         | —               | —        | —       | —                 |
| `agents.list[].humanDelay` / `groupChat` / `heartbeat`                | W                   | —      | —      | —         | —               | —        | —       | —                 |
| `agents.list[].runtime` / `embeddedHarness` / `embeddedPi` / `params` | W                   | —      | —      | —         | —               | —        | —       | —                 |
| `agents.list[].memorySearch`                                          | W                   | —      | —      | —         | —               | —        | —       | —                 |
| workspace files per-agent                                             | W                   | —      | —      | —         | —               | —        | —       | —                 |
| `agents.defaults.*`                                                   | W (defaults editor) | R      | R      | R         | R               | R        | —       | —                 |
| `models.providers`                                                    | R                   | W      | —      | —         | —               | —        | —       | —                 |
| skill install / catalog                                               | R                   | —      | W      | —         | —               | —        | —       | —                 |
| subagent runtime monitoring                                           | R                   | —      | —      | W (read)  | —               | —        | —       | —                 |
| 全局 tools 策略 / approval / hook                                     | R                   | —      | —      | —         | W               | —        | —       | —                 |
| channel 连接 / event stream declared options                          | R                   | —      | —      | —         | —               | W        | —       | —                 |
| `bindings[]`                                                          | R                   | —      | —      | —         | —               | —        | W       | —                 |
| session 内容 / 运行时 activity                                        | R (counts)          | —      | —      | —         | —               | —        | —       | W                 |

### 5.2 跨模块跳转协议

URL 约定：`?panel=<target>&from=agents&fromAgent=<id>`（可附 `&filterAgent=<id>` 用于列表型目标模块预筛选）。目标模块顶部 breadcrumb "← Back to agent: `<name>`" 显式回链。识别 `from=*` 是各目标模块的责任；未识别**不报错**，仅不显示 breadcrumb。

具体跳转点见 §2 各 section "跨模块跳转" 行。

### 5.3 双写护栏

- BFF 路由文档化每条 RPC 的 owner module
- frontend 代码组织上 `data/modules/agents/` 是 agents 模块写路径的唯一入口；其他模块不能 import 其 mutation hook（lint 级约束，必要时用 `eslint-plugin-import` 的 zone 规则强制）
- `deck-route-governance.contract.json` 标注每条 deck.\* 路由的 owner，contract gate 检查一致性
- agents BFF product actions 必须经过 config write allowlist guard：每个 action 在 `deck-config-write-safety.contract.json` 声明允许写的 config path，BFF 在发起 `config.patch/apply` 前校验生成 patch/diff 不越界。越界示例（写 `models.providers` / `bindings` / 根级 `tools`）必须有单测覆盖并 reject。

### 5.4 owning module 不存在 / 占位

- agents 内 R 链接仍渲染，点击进入占位页（"This module is under construction"）
- agents **不代位**：不在 owning module 未实现时 inline 编辑该模块的字段

### 5.5 R-only 视觉规范

- 字段右侧 link-out icon + "Managed in `<module>`" 小字
- hover 出 tooltip "This is read here. Edit in `<module>`."
- 点击不进入 agents 内编辑器——直接跳

## 6. 影响审查与依赖拓扑

### 6.1 三个出现位置

| 位置                | 颗粒度                        | 实时度          |
| ------------------- | ----------------------------- | --------------- |
| overview hero       | 数字 + 类别                   | snapshot        |
| routing section     | 列表 + 摘要 + 跳转            | snapshot        |
| L3/L4 操作前 dialog | 列表 + 摘要 + 数字 + 风险提示 | **fresh fetch** |

三个位置都不做 polling、不做 SSE——agents 详情页非运行监控面。

### 6.2 数据来源：Gateway-side 计算，且 detail snapshot 与 fresh impact 双 RPC 分离

为避免 detail 的 Data Fabric 缓存策略与"L3/L4 操作前必须 fresh"矛盾，本设计**分离两个层次的 impact 数据**：

**A. detail 内的 impact snapshot**（缓存友好，跟随 detail 查询）

就地扩 `DeckGoAgentImpactSummary`（已存在于 `deck-go/contracts/source/deck-api.contract.ts`，本设计 additive 增字段）：

```ts
type DeckGoAgentImpactSummary = {
  // ...既有字段保留
  capturedAt?: string;
  bindings?: {
    count: number;
    samples?: Array<{
      bindingIndex: number;
      type: "route" | "acp";
      channel: string;
      accountId?: string;
      peerKindAndId?: string;
      summary: string;
    }>;
    truncated?: boolean;
  };
  sessions?: { total: number; active?: number; truncated?: boolean };
  files?: { total: number; bootstrapPresent?: boolean; truncated?: boolean };
  available?: boolean;
  unavailableReason?: "gateway-incompatible" | "permission" | "timeout" | "unknown";
};
```

字段全部 optional，向后兼容；用于 overview hero metric chip / §2.J routing section 的 samples 展示。允许 Data Fabric 缓存。

消费规则（避免三套数字歧义）：

- 既有 `DeckGoAgentDetailResponse.bindingCount/sessionCount/activeSubagentCount` 顶层字段与 `impact.bindingCount/sessionCount/activeSubagentCount/workspaceFileCount/deleteRemovesFiles` flat 字段继续保留，服务旧 UI 与兼容调用方。
- 新增嵌套结构 `impact.bindings` / `impact.sessions` / `impact.files` 是 11-section UI 的唯一权威读取面。
- detail handler 必须同时填 legacy 顶层字段、legacy impact flat 字段与新 impact nested 字段；数值不一致视为 bug。
- routing section 只消费 `impact.bindings.samples`；当 `truncated=true` 时不在 agents 模块补完整列表，直接跳 Routing 模块查看全部依赖。

**B. L3/L4 操作前的 fresh impact RPC**（不缓存）

新建专用 RPC `deck.agents.impactPreview.get`：

```ts
type DeckGoAgentImpactPreviewRequest = {
  agentId: string;
  /** 操作类型，决定 Risk specifics 文案 */
  operation:
    | "delete"
    | "change-workspace"
    | "change-runtime-kind"
    | "change-sandbox"
    | "change-tools-override"
    | "narrow-subagents"
    | "change-embedded-harness"
    | "change-embedded-pi"
    | "change-params";
  /** 操作的目标值（用于 diff 与 risk 描述） */
  proposed?: unknown;
  /** detail 当前的 baseHash，避免拿到过期 impact */
  baseHash?: string;
};

type DeckGoAgentImpactPreviewResponse = DeckGoAgentImpactSummary & {
  /** 针对该 operation 的具体风险摘要文案；i18n key + 上下文变量 */
  riskSpecifics: Array<{ key: string; vars?: Record<string, unknown> }>;
  /** 是否允许在 impact 不可用时仍允许 proceed（权限分离场景） */
  canProceedWithoutImpact: boolean;
};
```

前端层规则：

- 进入详情页 / 切换 section / 显式 refresh：使用 detail 内的 `impact` snapshot（缓存 ok）
- 触发 L3 / L4 操作（点 Edit / Delete）打开 dialog 的瞬间：**强制**调用 `deck.agents.impactPreview.get`（绕过 Data Fabric 缓存），等待 response 后才允许用户勾选确认复选框
- Data Fabric query key 设计上 `impactPreview` 与 `detail` 是两条独立链路；`impactPreview` 不参与 detail 的 invalidate

### 6.3 overview hero metric chip

```
[👥 3 bindings]  [💬 12 sessions (2 active)]  [📁 5 files]  [⚠ 2 unresolved refs]
```

- 数字点击跳对应 section / 模块
- "unresolved refs" 点击展开 modal（§6.7）
- `impact.available == false` 时所有 chip 灰显 + tooltip

### 6.4 L3/L4 impact dialog

L3 / L4 操作那一刻**重拉 fresh snapshot**（不复用 hero snapshot）。dialog 结构：

```
You are about to: <operation summary>

This will affect:
  • N bindings (route, acp)
  • N sessions (M active)
  • N workspace files
  • channels: <list>

Risk specifics for this operation:
  – per-operation 固定文案（按 operation 分桶 i18n 模板）

☐ I understand and want to proceed

[Cancel]  [Proceed (destructive)]
```

复选框默认未勾，必须显式勾才能解锁 Proceed。

### 6.5 impact 不可用时的降级

| reason                 | 行为                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `gateway-incompatible` | hero chip 灰；L3/L4 dialog 红条 + 仍允许 proceed（护栏不降）                               |
| `timeout`              | hero chip 灰 + "Retry"；L3/L4 dialog 同 + Retry                                            |
| `permission`           | hero chip 灰；L3/L4 dialog 不允许 proceed（除非 BFF 明确 `canProceedWithoutImpact: true`） |
| `unknown`              | hero chip 灰 + Retry；L3/L4 仍允许 proceed                                                 |

核心：impact 不可用**不**降低操作护栏等级。

### 6.6 defaults editor 内的扩散影响

```ts
type DeckGoAgentsDefaultsImpact = {
  inheritingAgents: {
    field: string;
    count: number;
    samples: Array<{ agentId: string; agentName?: string }>;
    truncated: boolean;
  };
};
```

defaults editor 每个可写字段编辑前 badge 旁显示 "applies to N agents currently inheriting"；L3 操作时 dialog 列 sample agent。

### 6.7 Unresolved references modal

集中入口（从 overview hero chip 点开）：

- 列出 4 类 unknown：skills（not-installed）/ subagents（agent-not-found）/ event-streams（not-in-declared-options）/ models（not-in-catalog）
- 每条提供清晰行动：Install / Remove / Keep / 跨模块跳转
- "Keep" = "已知"，不删但标 acknowledged，下次不再 highlight
- "Remove" = 该字段 L2 save，需 confirm

### 6.8 Freshness 指示

hero 旁有细小 timestamp "Impact captured 12s ago [refresh]"。默认每次进入页面 / section 切换拉一次；不 polling；用户显式 refresh；L3/L4 操作强制 fresh fetch。

## 7. 契约对齐与盲区字段真相收口

### 7.1 复用既有契约（作为 additive 扩展基线）

| 既有                                                                                                                                         | 用途                                                    | 文件                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| `DeckGoAgentSummary` / `DeckGoAgentDetailResponse`                                                                                           | list/detail DTO；detail 将按 §7.2.C additive 扩字段     | `deck-go/contracts/source/deck-api.contract.ts` |
| `DeckGoAgentImpactSummary`                                                                                                                   | impact 摘要；将按 §6.2 / §7.2.A additive 扩 nested 字段 | 同上                                            |
| `DeckGoAgentEffectiveSource`                                                                                                                 | inherit 来源标识                                        | 同上                                            |
| `DeckGoAgentModelPolicy*`                                                                                                                    | model policy 完整 DTO                                   | 同上                                            |
| `agents.create / update / delete`                                                                                                            | 顶层 CRUD                                               | `src/gateway/server-methods/agents.ts`          |
| `deck.agents.detail` / `.modelPolicy.*` / `.skills.*` / `.subagents.*` / `.eventStreams.*` / `.systemPrompt.preview` / `.toolPolicy.preview` | per-agent RPC                                           | `src/gateway/server-methods/deck/agents-*.ts`   |
| `agents.files.list/get/set`                                                                                                                  | workspace 文件                                          | Gateway 原生                                    |

### 7.2 契约 delta（additive）

#### 7.2.A 扩 `DeckGoAgentImpactSummary` 字段

按 §6.2 shape 就地扩 `DeckGoAgentImpactSummary`（已存在于 `deck-api.contract.ts`），新增字段全部 optional，向后兼容。不引入并存 DTO。用于 overview hero / routing section 的缓存友好 snapshot。

#### 7.2.B 新建 `DeckGoAgentEffectiveField` 对象 DTO 与 `DeckGoAgentInheritanceMap`

**关键修订**（外部审查 F2）：现有 `DeckGoAgentEffectiveSource = "agent" | "default" | "derived" | "gateway" | "unknown"` (`deck-api.contract.ts:1555`) 是 **string union**，不是对象。本设计**不复用**它做对象引用，而是新建对象 DTO 并复用 union 作为其 `source` 字段：

```ts
// 新增对象 DTO，与既有 string union 并存
type DeckGoAgentEffectiveField<T = unknown> = {
  effective?: T;
  source: DeckGoAgentEffectiveSource; // 复用 line 1555 既有 string union
  hasOverride: boolean;
  fallback?: T;
  canReset?: boolean;
  fallbackReason?: string;
};

type DeckGoAgentInheritanceMap = {
  workspace?: DeckGoAgentEffectiveField<string>;
  sandbox?: DeckGoAgentEffectiveField;
  embeddedHarness?: DeckGoAgentEffectiveField;
  embeddedPi?: DeckGoAgentEffectiveField;
  params?: DeckGoAgentEffectiveField<Record<string, unknown>>;
  thinkingDefault?: DeckGoAgentEffectiveField<string>;
  verboseDefault?: DeckGoAgentEffectiveField<string>;
  reasoningDefault?: DeckGoAgentEffectiveField<string>;
  fastModeDefault?: DeckGoAgentEffectiveField<boolean>;
  memorySearch?: DeckGoAgentEffectiveField;
  heartbeat?: DeckGoAgentEffectiveField;
  humanDelay?: DeckGoAgentEffectiveField;
  groupChat?: DeckGoAgentEffectiveField; // per-agent only，defaults 不出现
  systemPromptOverride?: DeckGoAgentEffectiveField<string>;
  // 注意：runtime / tools 不在此 map：runtime 是 per-agent only（无 inherit）；
  // tools 写权与 inherit 链不在 agents 模块（在 Tools/Approvals 模块）。
  // skills / subagents.allowAgents / channels.eventStreams 有自己的 mode 语义，
  // 不进入此 map。
};

// 既有 DeckGoAgentEffectiveSources（line 1557）保留不变，本 map 是新增层
type DeckGoAgentDetailResponse = {
  // ...existing
  inherited?: DeckGoAgentInheritanceMap;
};
```

不破坏 `deck-api.contract.ts:1557` 既有 `DeckGoAgentEffectiveSources` map，也不破坏既有 detail 消费者（仅在 inherited 这个新 optional 字段上 opt-in）。

#### 7.2.C 扩 detail handler + `DeckAgentsDetailResultSchema` 返回字段清单

`ResolvedAgentConfig` (`src/agents/agent-scope-config.ts:13`)、detail handler (`src/gateway/server-methods/deck/agents-detail.ts`) 与 `DeckAgentsDetailResultSchema` (`src/gateway/protocol/schema/deck.ts`) 当前只返回少量 agents 字段。11-section UI 不能依赖 mock 假数据；必须扩 Gateway detail handler 与 schema，一次返回本模块需要的 raw / effective / source 信息。

- 优先在 `src/gateway/server-methods/deck/agents-detail.ts` 内从 raw `agents.list[]` 与 `agents.defaults` 提取字段，避免为了 Deck UI 污染 OpenClaw 通用 `ResolvedAgentConfig`。
- 只有当多个 Gateway deck RPC 需要同一读取逻辑时，才抽一个 deck-local helper；不改 OpenClaw core 解析语义。
- 扩 `DeckGoAgentDetailResponse` contract 与 `DeckAgentsDetailResultSchema`，字段全部 optional / additive，旧消费者不破坏。

detail 必须新增或补齐的 raw 字段：

- overview：`name` / `identity` / `mainKey` / `protectedReasons`（已有字段保留，缺项 additive 补）
- model/cognition：`thinkingDefault` / `verboseDefault` / `reasoningDefault` / `fastModeDefault` / `memorySearch`
- workspace：`agentDir` / `runtime` / `sandbox` / `embeddedHarness` / `embeddedPi` / `params`
- skills/subagents/delivery：`skills` / `skillMode` / `subagents.allowAgents` / `subagents.model` / `subagents.requireAgentId` / `channels.eventStreams`
- tools/conversation：`tools` / `systemPromptOverride` / `humanDelay` / `groupChat`
- impact/routing：legacy counts + `impact.bindings/sessions/files` nested fields（详 §6.2 消费规则）

detail 必须新增的解释字段：

- `inherited?: DeckGoAgentInheritanceMap`，用于 source badge / reset-to-default。
- `unresolvedReferences?: DeckGoAgentUnresolvedReferences`，用于 unresolved refs modal。
- `effectiveSources` 既有固定 map 保留；不要把新 `inherited` 对象塞进旧 `DeckGoAgentEffectiveSources` shape。

如果实施阶段确认 `ResolvedAgentConfig` 本身已经是 OpenClaw 公开给 deck namespace 的稳定读取 seam，才允许最小 additive 扩字段；否则保持 deck-local。

#### 7.2.D 写入策略矩阵（产品动作与 Gateway 写入原语分离）

本矩阵是本设计的关键实现边界：前端看到的是 Deck 产品动作；实现层按是否需要 OpenClaw 解释权选择 Gateway 写入原语。除非矩阵明确为 Gateway deck RPC，否则不新增 `src/gateway/server-methods/deck/*` 写 RPC。

| 产品动作                                                                         | 覆盖字段                                                                                                                                                                         | 实现策略                                                               | 原因                                                                                               |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| agent lifecycle / identity / workspace path                                      | `agents.create` / `agents.update` / `agents.delete` 支持的字段                                                                                                                   | 复用上游专用 RPC                                                       | `agents.update` 写 workspace 会初始化 workspace 并同步 identity 文件，不能用 raw config patch 代替 |
| role-based model policy                                                          | 9 个 global key（text/image/imageGeneration/videoGeneration/musicGeneration/pdf/compaction/memorySearch/subagents）+ 2 个 per-agent target form（agent-model / agent-subagents） | 复用已有 Gateway `deck.agents.modelPolicy.get/set`                     | 已有 Gateway-side target/shape/catalog 解释，避免 BFF 复制                                         |
| per-agent skills                                                                 | `agents.list[].skills` all/whitelist                                                                                                                                             | 复用已有 Gateway `deck.agents.skills.get/set`                          | `mode=all` 对应删除 per-agent key；Gateway 已有 skill resolver 与 workspace skill truth            |
| per-agent subagents                                                              | `allowAgents` / `model` / `requireAgentId`                                                                                                                                       | 扩已有 Gateway `deck.agents.subagents.get/set`                         | 已有 allow-any/explicit 语义；本轮只 additive 加 `requireAgentId`                                  |
| per-agent event streams                                                          | `agents.list[].channels.eventStreams`                                                                                                                                            | 复用已有 Gateway `deck.agents.eventStreams.get/set`                    | 已有 normalization / configHash / declared+unknown 语义                                            |
| per-agent cognition                                                              | `thinkingDefault` / `verboseDefault` / `reasoningDefault` / `fastModeDefault` / `memorySearch` 非 model 子字段                                                                   | BFF product action `agents.cognition.set` → Gateway `config.patch`     | 纯配置字段；effective/source 解释由 detail 返回，不要求写 RPC 自己解释                             |
| per-agent workspace advanced                                                     | `agentDir` / `runtime` / `sandbox` / `embeddedHarness` / `embeddedPi.executionContract` / `params`                                                                               | BFF product action `agents.workspace.set` → Gateway `config.patch`     | 纯配置写入；L3 风险由 impactPreview 解释；若 explore 发现副作用需求，再升级 Gateway deck RPC       |
| per-agent conversation                                                           | `systemPromptOverride` / `humanDelay` / `groupChat`                                                                                                                              | BFF product action `agents.conversation.set` → Gateway `config.patch`  | 写入是纯配置；prompt preview 继续走 Gateway `deck.agents.systemPrompt.preview`                     |
| per-agent delivery heartbeat                                                     | `heartbeat` 子树                                                                                                                                                                 | BFF product action `agents.delivery.set` → Gateway `config.patch`      | 写入是纯配置；运行效果由 OpenClaw runtime 后续解释                                                 |
| per-agent tools override                                                         | `agents.list[].tools`                                                                                                                                                            | BFF product action `agents.toolsOverride.set` → Gateway `config.patch` | 写入是纯配置；effective preview 继续走 Gateway `deck.agents.toolPolicy.preview`                    |
| defaults workspace/cognition/skills/subagents/conversation/eventStreams/delivery | `agents.defaults.*` 中 §2.4 支持矩阵字段                                                                                                                                         | BFF defaults product actions → Gateway `config.patch`                  | defaults 写入多数为纯配置；扩散影响与继承解释由 Gateway detail/impactPreview 提供                  |
| fresh impact                                                                     | L3/L4 操作前风险、bindings/sessions/files/affected inheriting agents                                                                                                             | 新增 Gateway `deck.agents.impactPreview.get`                           | 需要 Gateway-side 配置解释、bindings/session/workspace 真相与 fresh snapshot                       |
| inheritance / unresolved refs                                                    | effective/source/fallback/unresolved references                                                                                                                                  | 扩 Gateway `deck.agents.detail`                                        | 解释权在 Gateway；前端/BFF 不反推                                                                  |

BFF product action 的共同要求：

- 输入/输出使用 `DeckGoAgent*` 产品 DTO，不暴露 raw patch。
- 必须接收 client baseHash；BFF 在调用 `config.patch` 前不自行覆盖用户冲突。
- `reset` 语义通过 `null` 删除 key，或在 `config.patch` 无法表达删除时改用 `config.apply`，并在 write-safety contract 标明。
- 所有 unknown 值必须从当前 config 读取后保留，除非用户显式 remove。
- 每个 agents BFF product action 必须声明可写 path allowlist，并通过 `deck-config-write-safety.contract.json` 进入 contract gate。guard 至少验证生成 patch / apply diff 不越过 owning module：per-agent action 只能写 `agents.list[{id}]` 下本 action 拥有的字段；defaults action 只能写 `agents.defaults.*` 中 §2.4 允许的字段；不得写 `models.providers` / `bindings` / 根级 `tools` 等其他模块字段。
- `config.patch` 当前通过 `applyMergePatch(..., { mergeObjectArraysById: true })` 支持 `agents.list[]` object-array 按 `id` 合并；实施第一步必须保留 grep evidence（`src/gateway/server-methods/config.ts` 与 `src/config/merge-patch.test.ts`）。若某路径无法用 by-id patch 安全表达，fallback 是 BFF 构造完整 config 后走 `config.apply`，并在 apply 前用同一 allowlist diff guard 拦截越界变更。
- 如果某动作在实现 explore 中发现 BFF 会复制 OpenClaw 解释逻辑，立即停止该动作的 BFF 实现，改为 Gateway deck RPC 或记录 upstream/core follow-up。

#### 7.2.E 扩 `deck.agents.subagents.set` schema 加 `requireAgentId`

现有 `deck.agents.subagents.set` schema (`src/gateway/protocol/schema/deck.ts:116`) 只接 `agentId / allowAgents / model / baseHash`，handler (`agents-subagents-config.ts`) 也只写 `allowAgents` 与 `model`。本设计在 deck namespace schema 上 additive 扩：

- schema 加 `requireAgentId?: boolean`
- handler 写 `cfg.agents.list[i].subagents.requireAgentId`
- Deck-facing DTO `DeckGoAgentSubagentsRequest` 加 `requireAgentId?: boolean`
- 上游 OpenClaw 通用 protocol 不动

#### 7.2.F BFF product actions 与 contract DTO

新增/扩展 Deck-facing request/response DTO，而不是新增同名 Gateway RPC：

| BFF action              | Route                        | Backing Gateway method                                                | DTO shape                                              |
| ----------------------- | ---------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------ |
| `cognition.get/set`     | `POST /deck/agents`          | `config.get` / `config.patch`                                         | agentId + cognition fields + baseHash                  |
| `workspace.get/set`     | `POST /deck/agents`          | `config.get` / `config.patch` plus `agents.update` for workspace path | agentId + workspace advanced fields + baseHash         |
| `conversation.get/set`  | `POST /deck/agents`          | `config.get` / `config.patch`                                         | agentId + conversation fields + baseHash               |
| `delivery.get/set`      | `POST /deck/agents`          | `config.get` / `config.patch`                                         | agentId + heartbeat fields + baseHash                  |
| `toolsOverride.get/set` | `POST /deck/agents`          | `config.get` / `config.patch`                                         | agentId + tools override + baseHash                    |
| `defaults.*.get/set`    | `POST /deck/agents/defaults` | `config.get` / `config.patch`                                         | bucket + fields + baseHash + affected inheriting count |

注：role-based model 写已被 `deck.agents.modelPolicy.set` 覆盖（已实施）；defaults editor 内 model 角色编辑**直接复用** modelPolicy RPC，target 形状为 `{ kind: "global-default", key: <§2.B 映射表 key> }`，不新建 `deck.agents.defaults.model.set`。

#### 7.2.G 新建 Gateway fresh impact RPC `deck.agents.impactPreview.get`

按 §6.2 B 部分定义，独立于 detail 的 query 路径，不被 Data Fabric 的 detail invalidate 触动。响应 = 扩展后的 `DeckGoAgentImpactSummary` + `riskSpecifics` + `canProceedWithoutImpact`。实现位置：`src/gateway/server-methods/deck/agents-impact-preview.ts`。

协议层必须同步新增：

- `src/gateway/protocol/schema/deck.ts`：`DeckAgentsImpactPreviewParamsSchema` / `DeckAgentsImpactPreviewResultSchema`
- `src/gateway/protocol/index.ts` 或对应导出面：`validateDeckAgentsImpactPreviewParams`
- `src/gateway/server-methods/deck/agents.ts` / method-def modules：注册 `deck.agents.impactPreview.get`
- `src/gateway/method-scopes.ts` / generated method registry inventory：按只读 control-plane 方法纳入 scope / discovery

#### 7.2.H 新建 `DeckGoAgentUnresolvedReferences`

```ts
type DeckGoAgentUnresolvedReferences = {
  skills: Array<{ name: string; reason: "not-installed" | "disabled" | "unknown" }>;
  subagents: Array<{ id: string; reason: "agent-not-found" | "agent-deleted" | "unknown" }>;
  eventStreams: Array<{ name: string; reason: "not-in-declared-options" | "unknown" }>;
  models: Array<{ ref: string; reason: "not-in-catalog" | "provider-disabled" | "unknown" }>;
  // 注意：tools 引用不进入 unresolved（因为 tools 写权不在 agents 模块；
  // 全局 tool 名校验由 Tools/Approvals 模块负责）
};

type DeckGoAgentDetailResponse = {
  // ...existing
  unresolvedReferences?: DeckGoAgentUnresolvedReferences;
};
```

detail handler 内聚合，不走单独 RPC。

### 7.3 契约文件影响清单（基于 §7.2 delta）

| 契约 / 代码位置                                                                                          | 改动                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 类别                                |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `deck-go/contracts/source/deck-api.contract.ts`                                                          | 扩 `DeckGoAgentImpactSummary`；扩 `DeckGoAgentDetailResponse` 加 §7.2.C 全量 detail 字段（thinkingDefault / verboseDefault / memorySearch / humanDelay / heartbeat / groupChat / embeddedHarness / embeddedPi / systemPromptOverride / params / runtime / tools / inherited / unresolvedReferences 等）；新增 `DeckGoAgentEffectiveField<T>`、`DeckGoAgentInheritanceMap`、`DeckGoAgentUnresolvedReferences`、`AgentRuntimeConfigDTO`，以及 BFF product actions 的 request/response DTO（cognition/workspace/conversation/delivery/toolsOverride/defaults buckets/impactPreview） | additive                            |
| `deck-go/contracts/source/deck-ui.contract.json`                                                         | 注册新 DTO 引用 + 11 section id + defaults 7 section id                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | additive                            |
| `deck-go/contracts/source/deck-mutations.contract.json`                                                  | 注册所有 BFF product set actions + Gateway `impactPreview.get` + 扩展后的 subagents set                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | additive                            |
| `deck-go/contracts/source/deck-config-write-safety.contract.json`                                        | 标注每个 product action 的 backing Gateway method、baseHash 模式、patch/apply/delete-key 语义、可写 path allowlist、越界 patch/apply guard 场景                                                                                                                                                                                                                                                                                                                                                                                                                                   | additive                            |
| `deck-go/contracts/source/deck-route-governance.contract.json`                                           | 标注 `/api/deck/agents` 与 `/api/deck/agents/defaults` owner = `agents`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | additive                            |
| `deck-go/contracts/source/deck-endpoints.contract.json`                                                  | 注册 BFF 路由：复用 `/deck/agents` 聚合路由 + action `cognition.get/set` / `workspace.get/set` / 等等；defaults 用 `/deck/agents/defaults` 子路径 + 同 action namespace                                                                                                                                                                                                                                                                                                                                                                                                           | additive                            |
| `src/gateway/protocol/schema/deck.ts`                                                                    | 扩 `DeckAgentsDetailResultSchema` 加 §7.2.C 全量 detail 字段；扩 `deck.agents.subagents.set` schema 加 `requireAgentId`；新增 `DeckAgentsImpactPreviewParamsSchema` / `DeckAgentsImpactPreviewResultSchema` 与 validator 导出（deck namespace 内 schema，不在通用 protocol）                                                                                                                                                                                                                                                                                                      | additive                            |
| `src/gateway/method-registry-data.ts` / deck method-def module chain                                     | 注册 `deck.agents.impactPreview.get` method id，并确保 discovery / method metadata / scope 表可见                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | additive / generated as appropriate |
| `src/gateway/server-methods/deck/agents-impact-preview.ts` 新建                                          | fresh impact / riskSpecifics / canProceedWithoutImpact，Gateway-side 解释                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | new file                            |
| `src/gateway/server-methods/deck/agents-subagents-config.ts`                                             | 扩 handler 写 `requireAgentId`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | additive                            |
| `src/gateway/server-methods/deck/agents-detail.ts`                                                       | 扩 handler 返回 §7.2.C 全量 raw/effective/detail 字段，并同时填 legacy impact flat 字段与 nested impact 字段                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | additive                            |
| `src/agents/agent-scope-config.ts`                                                                       | 默认不改；只有确认该 helper 是合适 seam 时才最小 additive 扩 `params` / `runtime`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | conditional                         |
| `deck-go/backend/internal/server/inventory.go` + 新建 `agents_product_actions.go` / `agents_defaults.go` | BFF 产品动作：构造 typed DTO、取 configHash、调用 `config.patch/apply` 或上游/Gateway deck RPC、映射产品错误                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | additive                            |
| 生成产物                                                                                                 | `make contracts-sync` + `make protocol-update` 重生成                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 自动                                |

### 7.4 已实施 model-policy convergence 的兼容

- 100% 复用 `deck.agents.modelPolicy.*` 的 9 个 global key + 2 个 per-agent target form + summaryModel 只读边界
- inheritance 视觉规范覆盖 model policy；现有 `DeckGoAgentEffectiveSource` string union 与新 `DeckGoAgentEffectiveField` 对象 DTO 并存
- 不引入与 model policy 平行的 v2；defaults editor 内 model role 编辑直接调用既有 `deck.agents.modelPolicy.set`，target 形状为 `{ kind: "global-default", key: <§2.B 映射表 key> }`，不新建专属 defaults model RPC

### 7.5 上游 OpenClaw 边界（与 §0 一致）

| 不动                                                                                                | 允许扩                                                                                                                        |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/gateway/protocol/schema/*` 通用 schema 与 protocol 模块                                        | `src/gateway/protocol/schema/deck.ts` 中已属于 deck namespace 的 schema（如 `deck.agents.subagents.set`），可 additive 加字段 |
| `src/gateway/server-methods/` 中非 `deck/` 的 handler（`agents.ts` / `models.ts` / `config.ts` 等） | `src/gateway/server-methods/deck/*.ts`（已实施 model-policy/skills/subagents/eventStreams 同 namespace），可新建文件          |
| `src/config/types.agents*.ts` 类型真相                                                              | —                                                                                                                             |
| 上游 `agents.update` (line 80-90 of `agents-models-skills.ts`) 通用 RPC 的 6 字段 schema            | per-agent `workspace` path 字段仍通过此 RPC 写（它支持）                                                                      |

**调研结论**：`config.patch` / `config.apply` 已经是 Gateway 暴露的通用配置写入原语；本设计默认由 deck-go BFF 产品动作调用这些原语完成纯配置写入。只有需要 Gateway-side 解释、运行态真相、影响预览或既有 deck namespace 行为一致性的场景，才新增或扩展 `deck.*` RPC。当前新增 Gateway RPC 仅限 fresh impact preview；若实施阶段发现某个写入动作必须进入 Gateway deck namespace，必须先更新写入策略矩阵与 OpenSpec，而不是临场扩 scope。

## 8. 验收策略

### 8.1 验收维度

按 CLAUDE.md 通用矩阵选取本设计相关维度，证据形式：契约 / 数据状态 / 用户路径 / 写入一致性 / 安全 / UI/UX / a11y / 错误观测 / mock-real 分层 / 兼容迁移 / 性能 / 工程质量。

### 8.2 Mock 验收矩阵

mock fixture 必须覆盖：

- list ready / empty / loading / error / search-filtered-empty / 1-agent / many-agents
- list 内特殊 agent：main 保护 / configured-default / 双 badge (main + default) / 没有 default
- detail 进入态：切换 agent / URL 直进 / 不存在的 agentId
- overview hero 各 metric 状态（含 impact unavailable / 各 unresolved 类型）
- 11 section 每个的 inherit A/B、overridden、unsupported 四态
- L1 save success / fail / base-hash conflict
- L2 edit / cancel / save / save 失败 / conflict reload
- L3 impact preview 加载 / unavailable / 未勾不能 save / save 成功
- L4 delete impact preview / 手输 id 错误 / 正确 / cancel / success
- main agent 全保护表现
- inheritance reset L2 / L3 / section 级批量
- unresolved refs modal（4 类：skills / subagents / eventStreams / models + Keep/Remove/跨模块跳转）
- defaults editor 入口（toolbar 按钮 + URL 直进）
- defaults editor 内 A/B 两态、扩散影响、字段级 reset
- 跨模块跳转 URL 协议
- dark/light × zh/en 完整组合

mock fixture 建议含的样本 agent：1 个 main（含 unresolved refs）/ 1 个 non-main configured-default / 1 个普通 / 1 个全 inherit / 1 个 wildcard subagent / 1 个多 unresolved。

### 8.3 Focused frontend tests

新增 / 扩展：

- `agents-panel-state.test.ts`（扩）：11 section enum、AgentSectionId guard、state machine、legacy hash alias
- `agents-inheritance.test.ts`（新）：source badge label 解析、reset payload 构造、A/B/C 切换
- `agents-impact.test.ts`（新）：snapshot 解析、legacy flat 与 nested 字段一致性、各 reason 降级、freshness、routing samples truncated 提示
- `agents-unresolved-refs.test.ts`（新）：4 类解析、Keep/Remove/跨模块 URL 构造
- `agents-defaults-editor.test.ts`（新）：A/B 两态、扩散影响、字段级 reset、入口路由、`AgentDefaultsConfig` 支持矩阵（可见字段 / owning-module 字段 / 不存在字段）
- `agents-risk-dialogs.test.ts`（新）：L3 dialog 严格性、L4 手输 id 大小写敏感、wrong id 不 enable
- `agents-main-protection.test.ts`（新）：main delete 不渲染、保护提示、L3 解锁、跨模块跳转
- `AgentsPanel.test.tsx`（扩）：11 section render / 键盘 / dark+light / zh+en / vitest-axe
- `agents-defaults-editor.test.tsx`（新）：7 section 渲染边界 / a11y

a11y 强约束：

- section nav keyboard 可达（Tab + arrow + Home/End）
- L2/L3/L4 dialog focus trap + ESC close
- source badge aria-label "inherited from `<source>`" / "overridden, click reset to revert"
- impact dialog 复选框 label 关联
- L4 手输 id input aria-describedby 指向精确匹配提示

### 8.4 后端 / 契约测试

- `src/gateway/server-methods/deck/agents-impact-preview.test.ts`（新）：schema validator / method registration / fresh impact / riskSpecifics / canProceedWithoutImpact / Gateway 不可达
- `src/gateway/server-methods/deck/agents-detail.test.ts`（扩）：detail snapshot impact / legacy flat 与 nested 字段一致性 / inheritance map / unresolvedReferences / §7.2.C 全量 detail 字段 / Gateway 不可达
- `src/gateway/server-methods/deck/agents-subagents-config.test.ts`（扩）：`requireAgentId` schema + handler 落盘
- `deck-go/backend/internal/server/agents_product_actions_test.go`（新）：BFF product actions 走 `config.patch/apply` 或既有 upstream/deck RPC；base-hash header 透传；reset/delete-key 语义；workspace path 必须走 `agents.update`；path allowlist guard 拦截越界写 `models.providers` / `bindings` / 根级 `tools`
- `deck-go/backend/internal/server/agents_defaults_test.go`（新）：defaults GET/PATCH 路由 / 错误 mapping / affected inheriting count / base-hash conflict
- `cd deck-go && make contracts-sync` clean
- `cd deck-go && make contracts-check` pass
- `cd deck-go && make protocol-check` pass（如触及 Gateway protocol 生成）
- `cd deck-go && make contract-gate` 全绿

### 8.5 Real Gateway E2E

隔离环境：复用 `deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state/openclaw.json`。**禁止**接触用户全局 openclaw.json。

Run-scoped fixture：`e2e-agents-conv-<runId>-<slot>`；cleanup 严格匹配本 run。

新增 spec：

- `deck-go/test/e2e/agents-defaults-real-gateway.spec.ts`：进入 defaults / 改 thinkingDefault / 验证 PATCH 落到隔离 openclaw.json / reset / base-hash 冲突
- `deck-go/test/e2e/agents-inheritance-real-gateway.spec.ts`：创建 fixture / 详情页 source badge / inherit↔override 切换 / reset / unresolved refs
- `deck-go/test/e2e/agents-risk-real-gateway.spec.ts`：L3 workspace path edit / L4 delete fixture / main 保护 negative check
- 已有 `agents-real-gateway.spec.ts` 扩：11 section nav smoke、跨模块跳转协议、impact 实际填充

熔断规则（CLAUDE.md "OpenSpec 完成闭环规则"）：两次有 evidence 的尝试失败后记录熔断 handoff；代码级 + mock 仍必须 pass；熔断必须明确 list 在 implementation-report 与 verification.yaml。

### 8.6 分层不可替代

- mock functional 证明 UI 视觉/交互/键盘/i18n/dark-light 完整，不能证明契约链
- real Gateway 证明契约链与隔离 openclaw.json 落盘，不能证明视觉细节
- 本设计**明确放弃 mock prototype parity**（IA 增到 11 section 与原型 10 section 不对齐）；设计 agent 那边需要新一轮 11 section 原型作为 follow-up

### 8.7 Closure 检查

宣称完成前必须满足：

- `openspec validate <change> --type change --strict` clean
- tasks 全部勾选都有本轮 fresh evidence
- 必要时 `verification.yaml` archiveReady=true 且 gaps=[]
- `cd deck-go && make contract-gate` 全绿
- `cd deck-go && make backend-test` 或 narrow + inventory
- `cd deck-go && make frontend-build` 绿
- mock E2E 全 pass + 截图采集
- real E2E pass 或熔断 handoff 完整
- accepted spec deltas 同步到 `openspec/specs/**`
- implementation-report 列 changed files / contract decisions / verification evidence / deferred handoffs

### 8.8 验收阶段允许的范围扩展

允许：类型 / lint / fixture 卡住验证 gate 时的小修复，标 "verification unblocker"，最小 diff，不动产品 / 契约边界。

严禁：UI 风格改动、follow-up 项混入本 change、修上游 OpenClaw 文件（除非 unblock 必需且极小范围）。

## 9. 迁移路径与历史 change 差异

### 9.1 与既有 change 的关系

| change                                                      | 状态     | 本设计的关系                                                                                       |
| ----------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `deck-go-frontend-agents-rebuild`                           | 完成     | 复用 panel shell / API/store / typed hooks / tests / fixtures                                      |
| `deck-go-agents-product-control-plane`                      | 完成     | 继承产品控制面框架；修正 10 section IA → 11 section、重命名 `runtime → workspace`、拆 `model` 独立 |
| `deck-go-agents-model-policy-convergence` (archived)        | 归档     | 100% 复用 `deck.agents.modelPolicy.*`                                                              |
| `deck-go-chat-agents-contract-typing`                       | 完成     | 复用 `DeckGoAgentCreateRequest` / `DeckGoAgentPatchRequest` 等                                     |
| follow-up `2026-05-09-agents-model-policy-redesign-handoff` | resolved | 不再衍生新 follow-up                                                                               |

### 9.2 Section ID 迁移映射

| 旧 ID           | 新 ID                 | 处理                                                                    |
| --------------- | --------------------- | ----------------------------------------------------------------------- |
| `overview`      | `overview`            | 保留；内容裁剪聚焦 identity                                             |
| `runtime`       | `workspace`           | 重命名 + 扩内容（吸收 sandbox / embeddedHarness / embeddedPi / params） |
| —               | `model`               | 新增（model + cognition）                                               |
| `skills`        | `skills`              | 保留                                                                    |
| `subagents`     | `subagents`           | 保留                                                                    |
| `tool-policy`   | `tools`               | 重命名                                                                  |
| `system-prompt` | 吸收入 `conversation` | 删除独立                                                                |
| `files`         | `files`               | 保留                                                                    |
| `event-streams` | `delivery`            | 重命名 + 扩内容（吸收 heartbeat）                                       |
| `routing`       | `routing`             | 保留                                                                    |
| `danger`        | `danger`              | 保留                                                                    |
| —               | `conversation`        | 新增                                                                    |

最终：`overview / model / workspace / skills / subagents / tools / conversation / delivery / files / routing / danger`（11 个）。

URL hash 兼容：`readSectionFromHash` 加 legacy alias `runtime→workspace`、`tool-policy→tools`、`event-streams→delivery`、`system-prompt→conversation`，收到旧 hash 自动重定向 + replaceState（不破链）。新代码不再生成旧 hash。

### 9.3 数据迁移：openclaw.json 不变

所有契约 delta 都是新增产品 DTO 层。`agents.list[]` / `agents.defaults.*` schema 真相不动。用户已有 openclaw.json 无需迁移。

### 9.4 代码复用 / 重组织 / 新建分桶

| 类别                                    | 文件示例                                                                                                                                                                                                                  | 处理                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 直接复用                                | `frontend-new/src/data/modules/agents/`、既有 DTO、已实施 `deck.agents.modelPolicy.*` / `.skills.*` / `.subagents.*` / `.eventStreams.*` / `.systemPrompt.preview` / `.toolPolicy.preview`                                | 不动                                                                    |
| 重组织                                  | `AgentsPanel.tsx` section switch、`agents-panel-state.ts` `AGENT_SECTIONS`、i18n key、`agents-panel.css` 按 section 划分                                                                                                  | 按 §9.2 改                                                              |
| 新建组件（molecule 级，复用现有 atoms） | Source Badge / Impact Dialog / Reset Confirm Chip / Unresolved Refs Modal / defaults editor panel / Role-based Model Picker（9 个 global key + 2 个 per-agent target form）/ Risk-Specifics List                          | 不新增 atom                                                             |
| 新建契约                                | §7.2 delta（impact 扩 / `DeckGoAgentEffectiveField` 对象 DTO / inheritance map / detail params+runtime 扩 / BFF product action DTO / requireAgentId 扩 schema / fresh impact RPC DTO / unresolved refs）                  | additive                                                                |
| 新建 Gateway RPC                        | `src/gateway/server-methods/deck/agents-impact-preview.ts` + `src/gateway/protocol/schema/deck.ts` schema/validator + deck agents method-def/module registration + method scope/discovery inventory                       | new file；只处理 fresh impact / riskSpecifics / canProceedWithoutImpact |
| 扩既有 Gateway deck RPC                 | `src/gateway/protocol/schema/deck.ts` 中 `deck.agents.subagents.set` 加 `requireAgentId`；`agents-subagents-config.ts` handler 写它；`agents-detail.ts` handler 加 params/runtime/inherited/unresolvedReferences 字段返回 | additive                                                                |
| 新建 / 扩 BFF 产品动作                  | `deck-go/backend/internal/server/` 复用 `/deck/agents` action multiplexer 加 per-agent action；defaults 走 `/deck/agents/defaults` 子路径；按 §7.2.D 选择 `config.patch/apply`、`agents.update` 或既有 `deck.*` RPC       | additive                                                                |

严禁：新增 design-system atom、修改 tokens、破坏 `agents-panel.css` 整体结构、修上游通用 protocol、修非 `deck/` namespace 的 handler。

### 9.5 上线策略：一次性切换、无 feature flag

- additive 契约 + section 重组，无破坏性变更
- URL legacy alias 处理旧链接
- 默认期望一次性 PR
- 例外：若 real E2E 熔断且 unblock 不可控，可分两 PR（PR1：契约+BFF+Gateway+mock；PR2：前端 IA 消费）

### 9.6 回滚策略

回滚单位 = 本 change 全部 commit 一起 revert。每个 commit 必须 self-contained（contract + 生成产物同 commit、BFF 与前端 import 同 commit）。

### 9.7 风险与缓解

| 风险                                                       | 缓解                                                                                                                                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DeckGoAgentEffectiveSource` 当前 shape 不含本设计需要字段 | 实施第一步 grep 验证；不够则在 7.2.B 一并 additive 扩                                                                                                                      |
| `agents.defaults` 写入失败（base-hash race / 文件权限）    | 标准 reload/overwrite；权限错误清晰 toast；不重试                                                                                                                          |
| 11 section nav 窄屏 / 中文长 label 溢出                    | scrollable container；测试覆盖窄屏 + zh long label                                                                                                                         |
| Impact 填充耗时影响 detail 响应                            | 异步填充（detail 先返回，impact 独立 query）；UI 接受 `impact == null` 初始态                                                                                              |
| BFF product action 复制了 OpenClaw 的配置解释逻辑          | 实施阶段一旦发现需要 Gateway-side 解释或运行态真相，停止该 BFF action 写入实现，改为 deck namespace RPC 或记录 upstream/core follow-up；不得在前端/BFF 内复刻 runtime 规则 |
| 已有 main 保护测试因 section 重组跑红                      | 重组时同步迁移；列入 8.3 测试矩阵                                                                                                                                          |
| handoff 原型仍是 10 section                                | OpenSpec proposal 明确放弃 prototype parity；handoff 那边新 11 section 原型作为 follow-up                                                                                  |
| enhanced 分支可能有未提交 agents 改动                      | 实施前 git status 检查；冲突先和用户对齐                                                                                                                                   |

### 9.8 OpenSpec change 文件清单

```
openspec/changes/deck-go-agents-section-ia-convergence/
├─ proposal.md       Why / What / Capabilities / Impact
├─ design.md         继承本设计 §1-§9
├─ tasks.md          按依赖顺序拆分，每条带验证证据要求
├─ specs/
│  └─ deck-go-agents-section-ia-convergence/
│     └─ spec.md     可验证 requirements + scenarios
└─ verification.yaml （closure-workflow 介入时的场景级闭环）
```

change name：`deck-go-agents-section-ia-convergence`。

## 10. 决策摘要（D1–D14）

- **D1 收敛颗粒度**：IA 全面重审 + 各 section 内部，不绑定历史 change 结论
- **D2 核心用户问题**：配置审查 + 配置变更 + 影响审查（排除运行状态）
- **D3 写权边界**：per-agent override 在 agents；global catalog 在 owning module；agents 是 per-agent control plane
- **D4 defaults 归属**：agents 模块顶层 defaults editor，与 per-agent 详情页共享 section 语言但只渲染 7 个 section；`overview` 降级为只读 defaults summary，`tools/files/routing/danger` 不出现，workspace/conversation 内裁剪 schema 缺失字段
- **D5 IA 骨架**：保持原型一致的 section nav + scroll content；不引入 drawer / dashboard hero / tabs；不动 UI 风格
- **D6 section 清单**：任务驱动 11 section（overview / model / workspace / skills / subagents / tools / conversation / delivery / files / routing / danger）
- **D7 风险分级**：L0 read-only / L1 inline / L2 guarded / L3 high-risk with impact dialog & checkbox / L4 destructive with id confirmation
- **D8 inheritance 视觉**：source badge + reset-to-default 按钮三态（A/B/C，不引入显式 unset 第四态）
- **D9 契约策略**：Deck-facing 契约暴露产品动作，不暴露 raw config patch；纯配置写入由 BFF product action 调 Gateway `config.patch/apply`，但每个 action 必须有 path allowlist guard；已有语义动作复用 `agents.update` 或既有 `deck.agents.modelPolicy/skills/subagents/eventStreams.*`，新增 Gateway RPC 仅限 `deck.agents.impactPreview.get`，并扩既有 `subagents.set` schema 加 `requireAgentId`
- **D10 上游边界**：OpenClaw 通用 protocol、非 deck namespace handler、runtime/execution 逻辑与 `src/config/types.agents*.ts` 不动；允许在 `src/gateway/server-methods/deck/` 与 `src/gateway/protocol/schema/deck.ts` 做 additive deck 适配；若需要 core truth 改动，记录 upstream/core follow-up 而不是在本 change 中修改
- **D11 真相对齐边界**：所有"defaults editor 出现 X 字段"必须基于 `AgentDefaultsConfig` schema 真相（详 §2.4 支持矩阵）；`tools` / `groupChat` / `runtime` / `identity` 等 per-agent only 字段在 defaults editor 不渲染（不是 disabled，是不出现），避免 UI 暗示一个不存在的写位
- **D12 inheritance DTO 边界**：复用既有 `DeckGoAgentEffectiveSource` string union 作为新 `DeckGoAgentEffectiveField<T>` 对象 DTO 的 `source` 字段；既有 `DeckGoAgentEffectiveSources` map 不破坏；新对象 DTO 仅用于新增 inheritance map
- **D13 impact 分层**：detail 内的 `DeckGoAgentImpactSummary` 是缓存友好 snapshot；L3/L4 操作前必须调用专用 `deck.agents.impactPreview.get`（Data Fabric 不缓存，绕过 detail invalidate）
- **D14 detail 真相边界**：11-section UI 的 real 数据只能来自扩展后的 `deck.agents.detail` handler + `DeckAgentsDetailResultSchema`；mock fixture 不得伪造 Gateway detail schema 尚未返回的字段，所有新增 raw/effective/detail 字段必须在 protocol schema、contract DTO、handler 和 real E2E 中闭环
