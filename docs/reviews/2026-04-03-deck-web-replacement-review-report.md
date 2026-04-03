# Deck Web Replacement Program — 全面审查报告

> Date: 2026-04-03
> Reviewer: Claude Opus 4.6
> Scope: Review Index 列出的全部 8 份文档 + 代码库/文件系统交叉验证
> Verdict: **方向正确，主要问题在盘点完整性和量化标准**

---

## 一、Review Index 文档本身

**结构：优秀**。双层组织（Spec/Governance Layer + Execution/Tracking Layer）清晰，阅读顺序合理（立项 → 设计 → 约束 → 推进 → 状态），Review Focus Checklist 和 Not Cover 边界明确。

**问题**：Section 5 "What We Intend To Do Next" 提到审查通过后创建 `deck-platform-kernel-phase1-plan.md`，但缺少一个前置步骤——Phase 0 的 tasks（归类现有 changes、补全 matrix）是否需要先完成？还是直接并入 Phase 1 plan？建议明确。

---

## 二、Proposal.md

**评价：清晰、准确、边界正确**

- "Gateway 能力覆盖为硬目标"而不是"UI parity"——正确的战略选择
- 明确声明"不直接引入运行时代码变更"——保持了 master change 的治理定位
- 三个 new capabilities 命名精准：`platform-governance`、`module-closure`、`replacement-validation`

**F-PROP-1**：`Modified Capabilities` 说修改了 `openclaw-deck`，但这个 change 有 24 个 spec 子目录，是 Deck 最大的原始提案。proposal 没有说明"升级"意味着什么——是在 `openclaw-deck` 的 proposal/design 中加引用？还是仅概念上将其定位提升？建议明确。

---

## 三、Design.md（最核心文档）

**评价：整体质量高，有几处需要修正**

### 优点

- 5 条主轨定义清晰，依赖关系（平台轨 → 模块轨）表述正确
- 边界规则（Gateway / Deck Route / Projection）划分合理，原则"业务语义不留在组件里，恢复语义不留在 iframe 里"简洁有力
- 7 项 closure 标准全面且可执行
- Decisions D1-D5 每个都有 reason，且与 proposal 一致

### F-DESIGN-1：引用了不存在的 change

Section 6（现有 changes 归类）引用了 `deck-canvas-virtual-node`，但 `openspec/changes/` 下**不存在这个目录**。Canvas/A2UI 在 matrix 中的 Existing Inputs 也引用了它。需要修正为实际存在的输入（可能是 `openclaw-deck` 下的某个 spec）。

**验证方法**：`ls openspec/changes/deck-canvas-virtual-node` → 目录不存在

### F-DESIGN-2：漏掉了 5 个现有 OpenSpec changes

`openspec/changes/` 实际有 23 个目录（不含 archive 和 `deck-web-replacement-program` 自身），但 design.md Section 6 和 matrix 只归类了其中一部分。以下 5 个现有 changes **完全未被提及**：

| Change                             | 可能归属                                                         |
| ---------------------------------- | ---------------------------------------------------------------- |
| `deck-agent-routing-observability` | Config & Control 或 Runtime Core                                 |
| `deck-agent-workspace`             | Config & Control                                                 |
| `deck-chat-whitebox`               | Session Runtime                                                  |
| `deck-config-enhancement`          | Config & Control（与 `deck-config-editor-enhancement` 可能重叠） |
| `wecom-channel`                    | 不属于 Deck 范畴，但应明确排除                                   |

这违反了 design 自己提出的"现有 `deck-*` changes 必须纳入统一轨道"原则。

### F-DESIGN-3：Phase 划分中部分模块位置有争议

- `sessions / logs`：Design 将其放在 Phase 2（Runtime Core），但 matrix 标记为 `platform-first`，意味着它依赖 Phase 1 平台能力。这本身不矛盾，但需要确认 Phase 2 的启动条件是否包含 `shared list infra` 的稳定。
- `execution monitor`：放 Phase 2 合理吗？它的状态复杂度似乎低于 chat/approval/canvas，更像 Phase 3-4 的模块。设计说"应视为 runtime-core 而不是普通观察页"但没给充分理由。

### F-DESIGN-4：Worktree 策略缺少生命周期管理

5 个 worktree 如何创建、如何合流、谁负责合并冲突？只说了"共享契约未冻结前不并行"但没有具体 gate：谁判定"冻结"？什么标志？

---

## 四、Tasks.md

**评价：合理但颗粒度不够**

5 个 section、13 个 task，覆盖了 baseline → 治理 → 排序 → 闭环 → gate。

- **F-TASK-1**：Task 2.1"将现有 changes 归类到五条主轨"——已发现漏了 5 个 changes（见 F-DESIGN-2），说明这个 task 还没执行完就声称建立了 baseline
- **F-TASK-2**：Task 3.1-3.3 列出的 backlog 项目与 design 一致，但没有按可执行的原子任务拆分（比如"typed gateway coverage"是一个巨大的范围）
- **F-TASK-3**：缺少一个 task——审查并归档 `archive/` 中的废弃 changes（虽然当前为空，但这个机制应该明确）

---

## 五、Spec: deck-core-platform-governance

**评价：良好，场景准确**

三个 Requirement 分别覆盖轨道组织、边界分离、共享模型复用。Scenario 都是 WHEN/THEN 格式，可验证。

**F-SPEC-GOV-1**：没有定义"谁来判定某个 capability 是 shared business semantics 还是 browser-specific concern"的裁定机制。边界规则写了，但灰区的决策流程没写。

---

## 六、Spec: deck-module-closure

**评价：良好，但缺少量化标准**

"history and live consistency"和"shared interaction quality"很好，但：

- **F-SPEC-CLS-1**：没有定义"最低测试覆盖率"或"必须有哪些类型的测试"
- **F-SPEC-CLS-2**："shared interaction quality"引用了"program's shared loading, error, empty, permission patterns"——但这些 patterns 还不存在（是 Phase 1 要建的），这意味着在 Phase 1 完成前没有模块可以达到 closure。这是设计意图还是遗漏？

---

## 七、Spec: deck-replacement-validation

**评价：良好**

"validated by workflows, not only by page availability"和"shared contracts stabilize before parallel module work"都是正确的约束。

**F-SPEC-VAL-1**：Scenario "Enhanced integration waits for replacement gates"——这是否意味着每个模块都必须等到整个 track 的 closure 才能合入 enhanced？还是可以按模块粒度逐步合入？如果是前者，会导致 enhanced 分支长时间得不到更新。

---

## 八、Program Plan

**评价：与 design 高度一致，结构清晰**

- 5 Tracks x 6 Phases 的矩阵和 design 完全对齐
- "Definition of Done for Any Module"的 8 条标准是 closure spec 的实操版本
- Section 6 "How to Classify Existing Changes"提出 5 维度标注（Track/Phase/Priority/Dependency/Closure target）

**F-PLAN-1**：Plan 要求 5 维度分类，但实际 matrix 只有 3+2 维度（Track/Phase/Existing Inputs/Current Closure/Notes），缺少 **Priority** 和 **Dependency** 列。

**F-PLAN-2**：Phase 输出标准过于模糊：

- Phase 1："至少能支持多个模块共用同一 transport / replay / projection 模型"——几个算"多个"？
- Phase 2："历史态 / 实时态 / 刷新 / 重连的一致性有清晰模型与验证"——"清晰"不可度量

---

## 九、Matrix（最关键的执行层文档）

**评价：baseline 框架合理，但有多处事实性问题**

### F-MATRIX-1：幽灵引用

Canvas / A2UI 行引用 `deck-canvas-virtual-node`——**该目录不存在**。应删除或替换为实际存在的输入。

### F-MATRIX-2：漏掉的代码面板

以下现有面板（`dashboard/src/components/panels/`）在 matrix 中**完全没有出现**：

| Panel     | 代码路径                                                         | 建议归类                                |
| --------- | ---------------------------------------------------------------- | --------------------------------------- |
| Memory    | `panels/memory/`                                                 | Runtime Core 或 Observe                 |
| Models    | `panels/models/`（含 catalog/config/fallbacks/usage 4 个子目录） | Config & Control                        |
| Threads   | `panels/threads/`                                                | Session Runtime                         |
| Subagents | `panels/subagents/`                                              | Config & Control                        |
| Identity  | `panels/identity/`                                               | Core Platform                           |
| Docs      | `panels/docs/`                                                   | 可能不需要替代，但应标注                |
| Settings  | `panels/settings/`                                               | Config & Control                        |
| Monitor   | `panels/monitor/`（含 overview/history/timeline）                | 与 Execution Monitor 是什么关系？需澄清 |
| Gateway   | `panels/gateway/`                                                | Core Platform                           |
| Scheduler | `panels/scheduler/`                                              | Observe & Automate                      |

共计 10 个面板未出现在 matrix 中。

### F-MATRIX-3：现有代码成熟度与 matrix 状态可能不匹配

根据代码库探查：

- **Gateway Transport / Typed Client** 标记为 `partial`——但实际上 `gateway-client.generated.ts`（16KB）和 `gateway-protocol.generated.ts`（21KB）已存在，包含 100+ 方法的 typed client 和 allowlist。Protocol SDK 已经落地了（虽然可能不完整），状态可能应该比 `partial` 更高，或者备注需要说明具体缺什么。
- **Shared Shell / Panel Layout** 标记为 `partial`——需要具体说明缺什么才能升到 platform-first 或更高。
- **Chat** 标记为 `partial`——但 `chat/` 是最大的模块（30 文件），有独立的 SSE pipeline（`useChatSSE.ts`）、projection persistence（`chat-api.ts:persistChatProjection`）、session-scoped state（`Map<string, SessionState>`）、6 个 Zustand store。备注只说"已完成一轮数据流闭环修正"过于笼统。

### F-MATRIX-4：缺少版本/日期粒度

每个 area 的 closure 状态是截止什么时间的判断？如果后续更新 matrix，如何知道哪些行被重新评估过？建议加 `Last Assessed` 列。

---

## 十、文档间一致性检查

| 检查项                                       | 结果 | 说明                                                                                                                                |
| -------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Proposal <> Design: capabilities 定义一致    | PASS |                                                                                                                                     |
| Design <> Plan: 5 tracks 一致                | PASS |                                                                                                                                     |
| Design <> Plan: 6 phases 一致                | PASS |                                                                                                                                     |
| Design <> Specs: 边界规则一致                | PASS |                                                                                                                                     |
| Design <> Matrix: change 归类一致            | WARN | design 归了 `deck-usage-panel-rebuild` 到 Runtime Core / Observe & Automate，matrix 归到 Observe & Automate Phase 4——不矛盾但需明确 |
| Plan Section 6 <> Matrix: 维度一致           | FAIL | Plan 要求 5 维度，Matrix 只有 3+2 维度（缺 Priority 和 Dependency）                                                                 |
| Specs <> Closure list (Plan Section 5): 一致 | PASS | 7 项 closure 在 spec 和 plan 中对齐                                                                                                 |
| Design 引用 <> 文件系统: 存在性              | FAIL | `deck-canvas-virtual-node` 不存在                                                                                                   |
| Matrix areas <> 代码面板: 完整性             | FAIL | 10 个面板未出现在 matrix                                                                                                            |
| Matrix areas <> OpenSpec changes: 完整性     | FAIL | 5 个 changes 未被归类                                                                                                               |

---

## 十一、按 Review Checklist 维度回答

### Goal / Scope

- PASS: "Gateway 能力覆盖为硬目标"定义清晰
- PASS: 允许交互重构、允许平台重构窗口
- WARN: 需要明确 Deck 是否需要覆盖 `openclaw-deck` 原始提案中的 24 个 spec 全部范围，还是 master program 重新划定了范围

### Program Structure

- PASS: 五轨合理，依赖关系正确
- PASS: Phase 0-5 逻辑连贯
- FAIL: 漏了至少 10 个现有代码面板和 5 个现有 OpenSpec changes
- WARN: Phase 输出标准不够量化

### Boundary Rules

- PASS: Gateway / Deck Route / Projection 三层划分清楚
- WARN: 缺少灰区裁定机制

### Closure Standard

- PASS: 7 项标准全面
- WARN: 部分标准引用了尚不存在的共享 patterns（Phase 1 产物）
- WARN: 缺少测试类型/覆盖率的量化要求

### Matrix Accuracy

- FAIL: `deck-canvas-virtual-node` 幽灵引用
- FAIL: 10+ 个已有代码面板未出现在 matrix
- WARN: Gateway Typed Client 状态可能偏低
- WARN: 缺少 Priority、Dependency、Last Assessed 列

---

## 十二、建议的修正动作

### P0（阻塞 Phase 1 启动）

| #   | 动作                                                           | 涉及文档                       |
| --- | -------------------------------------------------------------- | ------------------------------ |
| 1   | 删除对 `deck-canvas-virtual-node` 的引用，替换为实际存在的输入 | design.md, matrix.md           |
| 2   | 补全 matrix 遗漏的 10 个代码面板（即使标记为 `unassessed`）    | matrix.md                      |
| 3   | 将 5 个遗漏的 OpenSpec changes 归入轨道或明确排除              | design.md, matrix.md, tasks.md |

### P1（Phase 1 期间完成）

| #   | 动作                                                                             | 涉及文档    |
| --- | -------------------------------------------------------------------------------- | ----------- |
| 4   | Matrix 增加 Priority、Dependency、Last Assessed 列（与 Plan Section 6 要求对齐） | matrix.md   |
| 5   | 为每个 Phase 定义至少一个可机器验证的 gate（如"typed client 覆盖率 >= X%"）      | plan.md     |
| 6   | 补充 Worktree"冻结"判定标准和合流流程                                            | design.md   |
| 7   | 明确 `openclaw-deck` 的"升级"含义（F-PROP-1）                                    | proposal.md |

### P2（后续迭代）

| #   | 动作                                                                 | 涉及文档                            |
| --- | -------------------------------------------------------------------- | ----------------------------------- |
| 8   | Closure spec 补充：Phase 1 共享 patterns 未就绪时的临时 closure 策略 | spec: deck-module-closure           |
| 9   | Governance spec 加 scenario 处理 Gateway vs Deck Route 灰区裁定      | spec: deck-core-platform-governance |
| 10  | Validation spec 明确合流粒度（track 级还是 module 级）               | spec: deck-replacement-validation   |
| 11  | 明确 Phase 0 tasks 与 Phase 1 plan 的先后关系                        | review-index.md                     |

---

## 十三、结论

这套文档成功地将 Deck 从"离散面板开发"升级为"program-driven replacement"，方向正确、架构清晰、治理规则合理。主要问题集中在两个维度：

1. **盘点完整性**：matrix 和 change 归类漏掉了大量已有代码面板和 OpenSpec changes，需要补全后才能作为可靠的 program baseline
2. **量化标准**：Phase gate 和 closure 标准需要从定性描述升级为可验证的条件

完成 P0 修正后，这套文档即可支撑 Phase 1（Platform Kernel）的实施启动。
