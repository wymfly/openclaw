---
name: dev-workflow
description: Use when starting any development task, resuming work from a previous session, or when unsure which step comes next in the development pipeline. Triggers on feature requests, bug fixes, architecture changes, implementation tasks, and code review stages.
---

# Dev Workflow

开发流程编排器。定义完整管线、自动检测当前阶段、选择工作流模式、协调三模型协作。

**每次会话开始时，先运行状态检测，再进入对应阶段。**

---

## 状态检测

新会话开始或不确定当前阶段时，运行以下检测命令推断当前位置：

```bash
ls openspec/changes/*/proposal.md 2>/dev/null   # 是否有进行中的 OpenSpec change
ls docs/plans/*-design.md 2>/dev/null            # 是否有设计文档
grep -l "^### Task\|^## [0-9]" docs/plans/*.md 2>/dev/null  # 是否有任务列表
git log --oneline | head -10                     # 阶段标记
```

同时检查 Agent Team 状态（跨会话恢复时最易丢失的上下文）：

```
TaskList  # 查看是否有未完成的 team tasks（in_progress / not_started）
```

| 检测结果                                                      | 推断阶段                                     |
| ------------------------------------------------------------- | -------------------------------------------- |
| TaskList 有 in_progress 的 team tasks                         | → Agent Team 执行中，恢复 Leader 监控角色    |
| `openspec/changes/*/proposal.md` 存在，`tasks.md` 未完成      | → `/opsx:propose` 进行中，继续生成 artifacts |
| `openspec/changes/*/tasks.md` 完成，无 `docs/plans/*-plan.md` | → writing-plans（增强 tasks.md）             |
| `docs/plans/*-design.md` 存在，无任务列表                     | → writing-plans                              |
| 任务列表存在，无实现文件                                      | → G2 关卡                                    |
| 有实现代码，git log 无 `[review]`                             | → 实现后审查                                 |
| git log 有 `[review]`，无 PR                                  | → finishing-branch                           |

---

## 入口分流：四步决策树

收到任务后，**按顺序执行以下四步判断**，每步 YES 立即跳转，不继续往下判断。

### Step 1：Trivial 检查

**满足以下全部条件** → 进入 **Mode 0（直接执行）**：

- 仅修改单个文件或配置
- 不引入新接口或 API
- 修复方案显而易见，无需设计讨论
- 预计改动 < 15 分钟

### Step 2：OpenSpec 阈值检查

检查 CLAUDE.md「OpenSpec 阈值」定义的三条条件（架构变更 / 新系统能力 / 正式验收需求），**满足任意一条** → 进入 **Mode 2（OpenSpec 主导）**。

> **条件 2 不确定时，询问用户**：
> "这个功能完成后，系统其他模块会直接依赖它的接口吗？（如果是，建议走 OpenSpec 固化设计）"

### Step 3：目标清晰度检查

**用户已提供详细需求，且是现有架构模式的延伸**（如在已有模型上加 CRUD、已有组件上加字段）→ 跳过 brainstorming，直接进入 **Mode 1 短路径**（writing-plans）。

否则 → 进入 **Mode 1 完整路径**（brainstorming 开始）。

### Step 4：Brainstorming 后复查

**见 CLAUDE.md「强制规则 1」**——brainstorming 完成后必须重新评估 OpenSpec 阈值，规则权威定义在 CLAUDE.md，不在此重复。

- **任意一条成立** → 切换到 **Mode 3（混合）**，用 `/opsx:propose` 固化设计
- **全不成立** → 继续 Mode 1，直接进入 writing-plans

---

## 工作流模式

> Mode 0 是 trivial 快速通道，不计入"三种模式"。三种正式模式为 Mode 1 / 2 / 3。

### Mode 0：直接执行（trivial 快速通道）

适用：trivial 任务（单文件 bug fix、typo、配置调整）

```
直接修改代码
    → verification（运行测试，确认无误）
    → commit
```

无需调用额外 skill。

> **与 `using-superpowers` 的关系：** Mode 0 是 dev-workflow 的决策**结果**，不是跳过 skill 检查。正确流程：`using-superpowers` 触发 → 检查所有 skill → `dev-workflow` 被触发 → Step 1 判定 trivial → Mode 0。即：经过 skill 检查后判定不需要额外 skill，而非绕过 skill 检查。

---

### Mode 1：Superpowers 主导

适用：功能开发，**不满足 OpenSpec 阈值**

**两条入口，按 Step 3 判断选择：**

**入口 A — 目标不清晰（完整路径）：**

```
brainstorming skill（探索方案，产出 design.md）
    ↓
    [GEMINI_REVIEW=1] → gemini-review skill（方案创意输入 + 技术调研）
    ↓  ⚠️ 此处不调 Codex 设计审查——brainstorming 产出的 design.md 是粗略笔记，
    ↓    不适合正式设计审查。Codex 审查在 writing-plans 后（计划审查）和实现后（代码审查）触发。
Pre-G2 预评估（基于设计产出，粗估任务规模 → 决定 writing-plans 模式）
    ↓
writing-plans skill（按预评估结果选择模式：常规 / 并行感知）
    ↓
    [CODEX_REVIEW=1] → codex-review skill（计划审查）
    ↓
G2 关卡（确认标签 + Skill + 文件独立性 + 执行模式）
    ↓
执行（按 G2 决策选择执行模式，见「执行模式决策」节）
    ↓
实现后审查（按维度数决策：直接并行调用 / Review Team）
    ↓
verification-before-completion skill → validate skill（执行具体检查）
    ↓
finishing-branch skill
```

**入口 B — 目标清晰，现有模式延伸（短路径，跳过 brainstorming）：**

```
Pre-G2 预评估（基于用户需求，粗估任务规模 → 决定 writing-plans 模式）
    ↓
writing-plans skill（按预评估结果选择模式：常规 / 并行感知）
    ↓
    [CODEX_REVIEW=1] → codex-review skill（计划审查）
    ↓
G2 关卡（确认标签 + Skill + 文件独立性 + 执行模式）
    ↓
执行（按 G2 决策选择执行模式，见「执行模式决策」节）
    ↓
实现后审查（按维度数决策：直接并行调用 / Review Team）
    ↓
verification-before-completion skill → validate skill（执行具体检查）
    ↓
finishing-branch skill
```

---

### Mode 2：OpenSpec 主导

适用：**满足 OpenSpec 阈值**，目标相对清晰，需要持久化规范

```
openspec-workflow skill（判断 change 名称，命名规则：字母开头 kebab-case）
    ↓
/opsx:propose "<change-name>"（生成 proposal + specs + design + tasks）
    ↓
    [GEMINI_REVIEW=1] → gemini-review skill（方案创意输入 + 技术调研）
    [CODEX_REVIEW=1] → codex-review skill（设计审查）
    ↓
Pre-G2 预评估（基于设计产出，粗估任务规模 → 决定 writing-plans 模式）
    ↓
writing-plans skill（增强 tasks.md：加域标签 + Skill 路由 + specs 需求映射；按预评估结果选择模式）
    ↓  ⚠️ OpenSpec 项目：每个任务必须标注 `covers:` 字段，映射到 specs/ 中的 requirement
    ↓    见 openspec-workflow「需求追踪格式」节
    [CODEX_REVIEW=1] → codex-review skill（计划审查）
    ↓
G2 关卡（确认标签 + Skill + 文件独立性 + 执行模式）
    ↓
执行（按 G2 决策选择执行模式，见「执行模式决策」节）
    ↓
实现后审查（按维度数决策：直接并行调用 / Review Team）
    ↓
verification-before-completion skill → validate skill（执行具体检查）
    ↓  ⚠️ OpenSpec 项目：validate 会额外执行 Step 5.5 需求覆盖检查
finishing-branch skill
    ↓
/opsx:archive（归档 change，更新 specs 库）
```

---

### Mode 3：混合

适用：brainstorming 进行中**发现满足 OpenSpec 阈值**（Step 4 触发切换）

```
brainstorming skill（探索方案，产出 design.md）
    ↓
    [GEMINI_REVIEW=1] → gemini-review skill（方案创意输入 + 技术调研）
    ↓ Step 4 复查：发现满足 OpenSpec 阈值，切换模式
/opsx:propose "<change-name>"（将 brainstorming 结论固化为正式 artifacts）
    ↓  ⚠️ design.md 直接引用 brainstorming 的 design.md，不重新设计
    [CODEX_REVIEW=1] → codex-review skill（设计审查）
    ↓
Pre-G2 预评估（基于设计产出，粗估任务规模 → 决定 writing-plans 模式）
    ↓
writing-plans skill（增强 tasks.md：加域标签 + Skill 路由 + specs 需求映射；按预评估结果选择模式）
    ↓  ⚠️ OpenSpec 项目：同 Mode 2，每个任务标注 `covers:` + 需求覆盖矩阵
    ↓
    [CODEX_REVIEW=1] → codex-review skill（计划审查）
    ↓
G2 关卡（确认标签 + Skill + 文件独立性 + 执行模式）
    ↓
执行（按 G2 决策选择执行模式，见「执行模式决策」节）
    ↓
实现后审查（按维度数决策：直接并行调用 / Review Team）
    ↓
verification-before-completion skill → validate skill（执行具体检查）
    ↓
finishing-branch skill
    ↓
/opsx:archive（归档 change，更新 specs 库）
```

---

## 三模型协作

| 模型            | 角色                                                 | 触发条件                                              |
| --------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| **Claude Code** | 编排 + 实现 + 修复                                   | 始终                                                  |
| **Codex (GPT)** | 代码审查（竞争模式）                                 | CODEX_REVIEW=1，在 brainstorming后 / plans后 / 实现后 |
| **Gemini**      | 代码审查（竞争模式）+ 设计审查 + 技术调研 + 方案创意 | GEMINI_REVIEW=1，见下方分流规则                       |

### 竞争模式

Codex 和 Gemini 在审查时均采用**竞争模式**——告知它们代码由 Claude Code 编写，激发其以"找茬"心态进行更彻底的审查。具体 prompt 由各自 skill 定义。

### 审查结果处理原则

处理 Codex/Gemini 审查 findings 时，遵循 `superpowers:receiving-code-review` 协议：

- 每条 finding 先 **VERIFY**（对照代码验证真实性），再决定 fix/reject
- 不确定的 finding → 明确说"无法验证"而非猜测实现
- 与用户架构决策冲突的 finding → 先与用户讨论，不自行决定
- **禁止 performative agreement**（"Great point!" 等），直接说修复内容或拒绝原因
- 真问题但建议不够好 → 基于建议**思考更佳方案**，不必照搬
- Codex 和 Gemini 意见矛盾 → Claude Code 独立判断，两者都不一定对
- 具体处理规则见 `codex-review` 和 `gemini-review` skill 的「审查结果处理」节

### 分流规则

Codex 和 Gemini **都能做代码审查**，形成双重覆盖。区别在于各自的独有能力：

| 任务类型               | Codex | Gemini     | 说明                          |
| ---------------------- | ----- | ---------- | ----------------------------- |
| 代码审查（所有类型）   | ✅    | ✅ 并行    | 双重视角，findings 去重后合并 |
| UI/视觉设计审查        | ❌    | ✅（独有） | 多模态截图分析                |
| 技术选型 / 调研        | ❌    | ✅（独有） | Google Search grounding       |
| brainstorming 方案创意 | ❌    | ✅（独有） | 想象力 + 创新联想             |

命令语法由 `codex-review` skill 和 `gemini-review` skill 定义，本 skill 只负责"何时触发"。

### 两层审查体系

| 层级           | 触发时机         | Skill                                                                 | 审查者                   | 关注点                            |
| -------------- | ---------------- | --------------------------------------------------------------------- | ------------------------ | --------------------------------- |
| **L1：任务级** | 每个 task 完成后 | `superpowers:requesting-code-review`（在 subagent-driven 内自动执行） | Claude sub-agent         | spec 符合度 + 代码质量            |
| **L2：全局级** | 所有任务完成后   | `codex-review` + `gemini-review`                                      | GPT + Gemini（竞争模式） | 跨任务一致性 + 安全 + 性能 + 架构 |

- L1 由 `superpowers:subagent-driven-development` 自动管理（两阶段：spec compliance → code quality），dev-workflow 不干预
- L2 由 dev-workflow 的"实现后审查"阶段触发（本节的维度计数 + Review Team 决策）
- 两层**不可互相替代**——L1 抓单任务问题，L2 抓全局问题

---

## 执行模式决策（G2 关卡）

G2 关卡完成三项工作：**确认域标签 + Skill 路由**、**评估文件独立性**、**决策执行模式**。

### 三种执行模式对比

| 维度         | Agent Team                    | subagent-driven        | executing-plans          |
| ------------ | ----------------------------- | ---------------------- | ------------------------ |
| **创建方式** | `TeamCreate` + `TaskCreate`   | `Agent` 工具           | `Agent` 工具             |
| **并行性**   | **真正并行**（独立 worktree） | 串行（同会话逐个派发） | 批量（3/批，人工检查点） |
| **通信**     | `SendMessage`（跨会话）       | Agent 返回值（会话内） | Agent 返回值（会话内）   |
| **协调**     | Leader 监控 + 冲突解决        | 无                     | 批次间人工检查           |
| **适用场景** | 多域、大规模、文件独立        | 中小规模、单域为主     | 任务多但串行耦合         |

> **⚠️ Agent Team 必须通过 `TeamCreate` 创建，不是用 `Agent` 工具派生 subagent。两者机制完全不同，不可混用。见 CLAUDE.md 规则 4。**

### Step 1：数量条件（门槛）

| 条件         | 阈值 |
| ------------ | ---- |
| 域标签数     | ≥ 3  |
| 可并行任务数 | ≥ 2  |
| 总任务数     | ≥ 5  |

**决策树：**

```
三条全满足？
├─ YES → 继续 Step 2（评估文件独立性）
└─ NO → 检查任务性质：
    ├─ 总任务数 ≥ 5，但可并行数 < 2（串行耦合）？
    │   ├─ YES → executing-plans（批量执行 + 人工检查点）
    │   └─ NO → subagent-driven-development（同会话串行）
    └─ 跳过 Step 2
```

### Step 2：文件独立性评估（核心判断）

对所有标记为"可并行"的任务，检查它们的**预期修改文件列表**（由 writing-plans 并行感知模式产出）：

```
并行任务文件集无交叉？
├─ YES → 推荐 Agent Team，继续 Step 3
├─ 有交叉但可调整边界消除？
│   ├─ YES → 回到 writing-plans 调整，然后重新评估
│   └─ NO → subagent-driven-development（串行执行耦合部分）
└─ NO（紧耦合）→ subagent-driven-development
```

> **文件独立性是 Agent Team 的必要条件**。数量条件满足但文件有交叉时，不启动 Agent Team。

### Step 3：确认启动

Agent Team **必须获得用户确认后才能启动**，调用 `team-driven-development` skill（使用 `TeamCreate` + `TaskCreate`，不是 `Agent` 工具）。

---

## Agent Team 执行结构

当 G2 关卡决定使用 Agent Team 时，按以下四阶段结构执行：

```
Phase 0（串行）：接口定义 — Task 0
    → 由 team lead 执行
    → 定义并行任务依赖的共享接口、类型、契约
    → 确保后续 agent 基于稳定接口工作
    ↓
Phase 1（并行）：模块实现
    → 各 agent 在独立 worktree 中并行实现
    → 每个 agent 只修改自己文件集内的文件
    ↓
Phase 2（串行）：集成验证 — Task N
    → 合并各 agent 产出，解决潜在冲突
    → 运行全量测试，确认模块间集成正确
    ↓
Phase 3（并行）：Review Team（见下节）
    ↓
Phase 4（串行）：修复 findings + verification
```

### Phase 0 跳过条件

如果共享接口/类型**已存在且稳定**（如在已有模块上扩展功能），Phase 0 可跳过。

判断标准：并行任务是否依赖**尚不存在**的接口或类型定义。

- 是 → 必须执行 Phase 0
- 否 → 跳过，直接进入 Phase 1

---

## 实现阶段失败处理

执行阶段遇到测试失败或 subagent 阻塞时，按以下规则自动注入 superpowers 纪律 skill：

### subagent 失败升级

| 情况                                | 处理                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------- |
| subagent 返回 BLOCKED（测试失败类） | 重新派发时追加 `superpowers:systematic-debugging`（强制四阶段根因分析） |
| 同一任务第 2 次 BLOCKED             | 升级模型 + 追加 `superpowers:systematic-debugging`                      |
| 同一任务第 3 次 BLOCKED             | 停止，上报用户（可能是架构问题）                                        |

### 全量测试多点失败

集成验证（Agent Team Phase 2）或实现后全量测试出现多点失败时：

```
失败分布情况？
├─ 集中在单一模块/文件 → 正常修复（单 subagent + systematic-debugging）
├─ 分布在 2 个独立模块 → 串行修复，各自注入 systematic-debugging
└─ 分布在 3+ 独立文件/模块 → 调用 superpowers:dispatching-parallel-agents
    → 每个失败域一个 agent 并行调查修复
    → 各 agent 携带 superpowers:systematic-debugging
    → 全部完成后运行全量测试验证
```

---

## Review Team（审查阶段 Agent Team）

审查是 Agent Team 的**高 ROI 场景**——审查 agent 只读代码不写代码，零文件冲突风险，天然适合并行。

### 触发条件

统计当前实现触发的审查维度数：

### 维度计数与决策

统计当前实现触发的审查维度数，按维度数决定是否启动 Review Team：

| 维度                    | Agent Skill                                       | 触发条件                                        |
| ----------------------- | ------------------------------------------------- | ----------------------------------------------- |
| 代码质量（GPT 视角）    | `codex-review`                                    | CODEX_REVIEW=1（始终）                          |
| 代码质量（Gemini 视角） | `gemini-review`                                   | GEMINI_REVIEW=1（始终，与 Codex 并行双重覆盖）  |
| UI/视觉设计             | `gemini-review`                                   | GEMINI_REVIEW=1 + 含前端任务（Gemini 独有能力） |
| 安全                    | `security-review`                                 | 含用户输入处理、认证、API 端点                  |
| 性能                    | `performance` / `python-performance-optimization` | 含性能敏感路径                                  |
| 测试覆盖                | `pr-review-toolkit:pr-test-analyzer`              | 新增功能且包含测试文件                          |

**常见场景速查**（CODEX_REVIEW=1, GEMINI_REVIEW=1 时）：

| 场景                 | 触发维度                                  | 维度数 | 决策         |
| -------------------- | ----------------------------------------- | ------ | ------------ |
| 纯后端，无安全/性能  | Codex代码 + Gemini代码                    | 2      | 直接并行调用 |
| 含前端               | Codex代码 + Gemini代码 + Gemini UI        | 3      | Review Team  |
| 含安全敏感代码       | Codex代码 + Gemini代码 + 安全             | 3      | Review Team  |
| 含前端 + 安全        | Codex代码 + Gemini代码 + Gemini UI + 安全 | 4      | Review Team  |
| 含前端 + 安全 + 性能 | 全部                                      | 5+     | Review Team  |

**规则**：维度 ≤ 2 → 直接并行调用，不启动 Team；维度 ≥ 3 → 启动 Review Team。

### Review Team 执行结构

```
串行（准备）：Team lead 统一生成 scoped diff
    → git diff $REVIEW_BASE..$REVIEW_HEAD -- $REVIEW_FILES > /tmp/review-scope.diff
    → 各审查 agent 共享同一份 diff，不各自重复生成
    ↓
并行（竞争模式）：
    Agent R1（codex-review：代码质量 — GPT 视角）
    Agent R2（gemini-review：代码质量 — Gemini 视角 [+ UI 审查（前端时）]）
    Agent R3（security-review：安全审查）
    Agent R4（...按需追加）
    ↓
串行：Team lead 汇总 findings
    → Codex 与 Gemini 的 findings 去重（相同问题合并，矛盾点独立判断）
    → 按严重度排序
    → 基于 findings 思考是否有更佳改进方案
    ↓
串行：逐项修复（采纳 / 改进 / 拒绝）→ verification
```

---

## 验证阶段（verification-before-completion → validate）

所有模式的流程图中 `verification-before-completion skill → validate skill` 按以下顺序执行：

1. **`superpowers:verification-before-completion`** — 纪律框架："evidence before claims"
   - 确保不会在未运行验证命令的情况下声称"完成"
   - 对每个完成声明，要求先 IDENTIFY → RUN → READ → VERIFY → CLAIM
2. **`validate` skill** — 操作清单：运行具体检查项
   - tsc --noEmit、lint、pytest/vitest、API 契约交叉检查等
   - OpenSpec 项目额外执行需求覆盖检查（见 openspec-workflow）
3. **两者关系**：verification-before-completion 是**心态守则**（"你必须有证据"），validate 是**检查工具**（"用这些命令获取证据"）
4. **subagent 派发验证任务时**，prompt 同时携带两者：`superpowers:verification-before-completion, validate`

---

## 降级策略

Codex/Gemini 调用失败时，流程不中断，自动降级。**具体降级规则（检测条件、映射表、prompt 模板）由 `codex-review` 和 `gemini-review` 各自的「降级策略」节定义**，本 skill 不重复。

**Review Team 降级补充规则**（仅在 Review Team 模式下适用）：

- 单个审查 agent 降级 → 替换为 Claude sub-agent，Review Team 继续
- Codex + Gemini 同时降级 → 退化为多个 Claude sub-agent 并行审查，**通知用户**降级情况
- 降级结果统一标记 `[degraded]`

---

## Pre-G2 预评估

在 writing-plans **之前**执行的轻量级评估，判断最终是否可能使用 Agent Team，从而让 writing-plans 提前进入并行感知模式。

### 为什么需要 Pre-G2

G2 关卡在 writing-plans **之后**才正式决策执行模式，但 writing-plans 需要提前知道是否为 Agent Team 准备（产出文件清单、交叉矩阵等）。Pre-G2 解决这个先后矛盾：**用粗略评估前置判断，让 plan 从一开始就为并行优化。**

### 评估输入

| 阶段                                 | 可用信息                                   |
| ------------------------------------ | ------------------------------------------ |
| brainstorming 后（Mode 1A / Mode 3） | design.md 中的模块划分、技术栈、预估工作量 |
| 目标清晰时（Mode 1B）                | 用户需求描述 + 已有代码结构                |
| OpenSpec 后（Mode 2）                | proposal + specs + design + tasks 初稿     |

### 评估标准

快速回答以下三个问题：

1. **预估会产生几个域标签？**（frontend / backend / test / agent / infra ...）→ 是否 ≥ 3？
2. **任务之间是否存在天然的文件隔离？**（不同目录、不同模块、不同语言）
3. **预估总任务数是否可能 ≥ 5？**

### 评估结果

| 结果          | 条件               | 对 writing-plans 的影响                                                                   |
| ------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| **likely**    | 三个问题都倾向 YES | → writing-plans 启用**并行感知模式**                                                      |
| **unlikely**  | 任一问题明确 NO    | → writing-plans **常规模式**                                                              |
| **uncertain** | 无法确定           | → writing-plans 启用**并行感知模式**（宁可多花 5 分钟列文件清单，也不在 G2 时发现缺信息） |

### 注意

- Pre-G2 是**粗估**，不是最终决策。最终决策仍在 G2 关卡。
- "likely" 不代表一定启动 Agent Team——G2 关卡的文件独立性评估和用户确认仍必须执行。
- "unlikely" 也不阻止后续在 G2 关卡重新评估——如果 writing-plans 产出意外地大，G2 仍可做出不同判断（但此时缺少文件清单，可能需要补充）。

---

## writing-plans 并行感知

当 Pre-G2 预评估结果为 **likely** 或 **uncertain** 时，writing-plans 应在常规输出之外额外产出以下内容：

### 额外产出

1. **每个任务的预期修改文件列表** — 明确列出该任务会创建或修改的文件路径
2. **文件交叉矩阵** — 标注哪些并行任务会触碰同一文件，用于 G2 关卡的文件独立性评估
3. **Task 0（接口定义任务）** — 如果并行任务依赖尚不存在的共享接口/类型，生成前置串行任务
4. **Task N（集成验证任务）** — 在所有并行任务之后，安排集成验证任务

### 文件冲突处理

如果文件交叉矩阵显示并行任务之间有文件冲突，writing-plans 应**调整任务边界**：

- 将共享文件的修改抽取到 Task 0 或独立的串行前置任务中
- 或将有交叉的任务标记为串行依赖关系
- 目标：确保标记为"可并行"的任务之间文件集不相交

### 不触发条件

Pre-G2 预评估结果为 **unlikely** 时，无需启用并行感知，按常规模式输出即可。

### 传递给 writing-plans 的方式

`superpowers:writing-plans` 是外部插件 skill，不感知 Pre-G2 概念。当 Pre-G2 结果为 **likely** 或 **uncertain** 时，调用 writing-plans **之前**，在对话中显式追加以下要求：

> 本次 plan 需要为并行执行做准备。在常规任务分解的基础上，额外产出：
>
> 1. 每个任务的**预期修改文件列表**（创建或修改的文件路径）
> 2. **文件交叉矩阵**——标注哪些并行任务会触碰同一文件
> 3. 如果并行任务依赖尚不存在的共享接口/类型，生成 **Task 0（接口定义）** 作为串行前置
> 4. 在所有并行任务之后，安排 **Task N（集成验证）**
> 5. 如果文件交叉矩阵显示冲突，调整任务边界消除交叉，或将冲突部分标记为串行依赖

Pre-G2 结果为 **unlikely** 时，不追加上述要求，按常规模式调用即可。

### OpenSpec 项目的额外传递

当处于 Mode 2 或 Mode 3（有 OpenSpec specs/）时，调用 writing-plans **之前**，在对话中显式追加以下要求：

> 本次 plan 基于 OpenSpec 规范。在增强 tasks.md 时，额外要求：
>
> 1. 读取 `openspec/changes/<name>/specs/` 下所有 spec 文件
> 2. 每个任务必须标注 `covers:` 字段，格式为 `<spec-file> > <section> > <requirement> > "<scenario>"`
> 3. 所有 ADDED/MODIFIED requirements 的 WHEN/THEN 场景必须被至少一个任务 cover
> 4. plan 末尾输出**需求覆盖矩阵**，确认无遗漏的 requirement
> 5. 如果发现 spec 中有 requirement 无法映射到任何任务，说明遗漏并补充任务

此传递与并行感知传递**可叠加**——如果 Pre-G2=likely/uncertain 且有 OpenSpec，两套要求都追加。

---

## Skill 路由

任务分配时，按域标签调用对应 Skill：

| 标签             | Skill                                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `[frontend]`     | `frontend-design`, `ui-ux-pro-max`, `tailwind-theme-builder`, `shadcn-ui`, `gemini-review`, `superpowers:test-driven-development` |
| `[backend]`      | `superpowers:test-driven-development`, 项目级 CLAUDE.md 追加（如 `sqlalchemy-orm`, `streaming-api-patterns`）                     |
| `[agent]`        | `superpowers:test-driven-development`, `langchain-architecture`, 项目级 CLAUDE.md 追加                                            |
| `[test]`         | `qa-testing-strategy`, `test-automation-framework`                                                                                |
| `[test:e2e]`     | 上述 + `e2e-testing-automation`                                                                                                   |
| `[review]`       | `pr-review-toolkit`, `codex-review`                                                                                               |
| `[architecture]` | `openspec-workflow`, `codex-review`                                                                                               |
| `[debug]`        | `systematic-debugging`                                                                                                            |
| `[security]`     | `security-review`                                                                                                                 |
| `[a11y]`         | `accessibility-a11y`                                                                                                              |
| `[performance]`  | `performance`（Web）, `python-performance-optimization`（Python）                                                                 |

### ⚠️ Skill 路由的生效条件

**路由表仅对能看到本文件的执行上下文有效。** subagent 和 Agent Team teammate 是独立上下文，**无法自动读取本路由表**。

**强制规则：派发任务时必须携带 Skill 名称。**

不论使用哪种执行模式，派发每个任务时都必须在任务描述中**显式写明**该任务应使用的 Skill：

```
# Agent Team（TaskCreate）
TaskCreate(description="...实现用户登录页面。Use skills: frontend-design, ui-ux-pro-max")

# subagent-driven（Agent 工具）
Agent(prompt="...实现用户登录页面。开始前先调用以下 Skill：frontend-design, ui-ux-pro-max")

# executing-plans（Agent 工具）
Agent(prompt="...执行 Task 3: 编写 E2E 测试。开始前先调用以下 Skill：e2e-testing-automation, qa-testing-strategy")
```

**查表时机**：G2 关卡完成域标签确认后，立即根据本路由表为每个任务生成 Skill 清单，写入任务描述。不要依赖执行者自行查表。

---

## Git Commit 阶段标记

```
[brainstorming] Add feature design doc
[openspec]      Add OpenSpec change artifacts
[writing-plans] Add implementation plan
[impl]          Implement <feature>
[review]        Address Codex/Gemini findings
[finish]        Final cleanup before PR
```

状态检测以文件 artifact 为主要依据，commit 标记为辅助参考。

---

## 防跳步规则

| 想跳过的步骤                                   | 为什么不能跳                                                                                                                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "设计很简单，跳过 brainstorming"               | 简单任务最容易因未审视的假设浪费时间；brainstorming 对简单任务也只需几句话                                                                                            |
| "不需要 Codex 审查"                            | CODEX_REVIEW=1 是全局开关，非你能决定                                                                                                                                 |
| "后端不需要 Gemini 审查"                       | 不正确：Gemini 现在和 Codex 一样做代码审查（双重覆盖），所有类型代码都应触发                                                                                          |
| "brainstorming 后也要 Codex 设计审查"          | 不正确：brainstorming 产出的 design.md 是粗略笔记，不适合正式设计审查。Codex 在 writing-plans 后（计划审查）和实现后（代码审查）触发                                  |
| "不满足 OpenSpec 阈值，不用走 OpenSpec"        | 正确判断，这是正确的                                                                                                                                                  |
| "满足阈值但目标清晰，跳过 OpenSpec"            | 不可跳：OpenSpec 的价值在于持久化规范，而非探索设计                                                                                                                   |
| "任务太少不用 Agent Team"                      | 如果不满足数量条件，本就不该启动；这是正确判断                                                                                                                        |
| "G2 关卡是形式主义"                            | G2 确保每个任务有标签和 Skill、评估文件独立性，跳过会导致执行混乱或并行冲突                                                                                           |
| "Mode 3 中 brainstorming 和 OpenSpec 重复"     | 不重复：brainstorming 探索，OpenSpec 固化；/opsx:propose 引用 design.md，不重新设计                                                                                   |
| "数量够了，不用评估文件独立性"                 | 数量条件是门槛，文件独立性才是 Agent Team 能否成功的核心判断；跳过会导致并行冲突                                                                                      |
| "Phase 0 太慢，直接并行"                       | 没有稳定接口的并行实现会导致各 agent 做出不兼容的假设，集成时返工成本更高                                                                                             |
| "审查不需要 Review Team"                       | 维度 ≤ 2 时确实不需要，这是正确判断；但维度 ≥ 3 时 Review Team 零风险且节省时间                                                                                       |
| "并行感知增加了 planning 时间"                 | 多花 5 分钟列文件清单，避免并行执行时 30 分钟的冲突解决；这是值得的投资                                                                                               |
| "Pre-G2 多此一举，G2 关卡会判断"               | G2 在 writing-plans 之后，没有 Pre-G2 就无法让 plan 提前为并行优化；事后补文件清单成本更高                                                                            |
| "Codex/Gemini 说了就应该改"                    | 审查结果不可盲从：独立判断每条 finding，可以改进、拒绝、或基于建议思考更佳方案                                                                                        |
| "brainstorming 不需要 Gemini 参与"             | Gemini 的创意发散和实时搜索能力在方案设计阶段有独特价值，GEMINI_REVIEW=1 时应触发                                                                                     |
| "用 Agent 工具派几个 subagent 也算 Agent Team" | **错误**。Agent Team = `TeamCreate` + `TaskCreate`（真并行、独立 worktree、SendMessage 通信）；Agent 工具 = subagent（同会话串行）。两者不可混用，见 CLAUDE.md 规则 4 |
| "测试失败了，直接猜原因修"                     | 必须走 `systematic-debugging` 四阶段；猜测式修复浪费时间且引入新 bug                                                                                                  |
| "subagent 报 BLOCKED，换个 subagent 再试"      | 不可盲目重试：第 1 次追加 systematic-debugging，第 2 次升级模型，第 3 次上报用户                                                                                      |
| "L1 任务级审查过了，L2 全局审查多余"           | L1 抓单任务问题，L2 抓跨任务一致性 + 安全 + 架构，两层不可互相替代                                                                                                    |
| "Codex/Gemini 说的有道理，直接改"              | 先 VERIFY（对照代码验证），再决定 fix/reject，见 `receiving-code-review` 协议                                                                                         |
