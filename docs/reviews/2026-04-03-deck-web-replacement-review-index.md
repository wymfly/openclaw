# Deck Web Replacement Review Index

> Date: 2026-04-03
> Purpose: 为 Deck Web Replacement Program 提供一份集中审查入口，帮助在开始 Phase 1 实施前对总纲文档做一次全面审查。

## 1. Review Goal

本轮审查的目标不是检查某个具体模块是否已经实现，而是确认 Deck 后续工作是否已经具备一套可持续推进的 program 级框架。

需要确认的核心问题：

- 我们是否已经把 Deck 的目标从“离散面板开发”升级为“能力优先的官方 Web UI 替代计划”
- 后续工作是否已经有统一的轨道、边界、阶段和闭环标准
- 现有 `deck-*` proposals 是否已经能被纳入统一总图，而不是继续各自演化
- 接下来的实施流程是否清晰，能够支持多 worktree 的阶段性推进

## 2. Documents to Review

### Master OpenSpec Change

1. `openspec/changes/deck-web-replacement-program/proposal.md`
   - 说明为什么需要一个 master program change
   - 定义这个总纲新增了哪些 program-level capability

2. `openspec/changes/deck-web-replacement-program/design.md`
   - 定义 Deck replacement program 的总体架构
   - 定义五条主轨、阶段顺序、边界规则、worktree 策略

3. `openspec/changes/deck-web-replacement-program/tasks.md`
   - 定义这个 master change 自己接下来要完成的治理动作
   - 不是模块实现清单，而是 program 收敛任务

### Program Specs

4. `openspec/changes/deck-web-replacement-program/specs/deck-core-platform-governance/spec.md`
   - 定义平台治理规则
   - 关注 Gateway / Deck route / projection 的职责边界

5. `openspec/changes/deck-web-replacement-program/specs/deck-module-closure/spec.md`
   - 定义模块闭环标准
   - 关注什么才算“replacement-ready”

6. `openspec/changes/deck-web-replacement-program/specs/deck-replacement-validation/spec.md`
   - 定义 program 级验证规则
   - 关注 capability matrix、workflow validation、phase gate

### Execution / Tracking Docs

7. `docs/plans/2026-04-03-deck-web-replacement-program-plan.md`
   - 把总纲翻译成工程推进顺序
   - 关注五条 track、phase、worktree 切分和下一步动作

8. `docs/plans/2026-04-03-deck-web-replacement-matrix.md`
   - 盘点当前 Deck 主要模块与现有 changes 的位置
   - 关注每个 area 当前是 `unassessed`、`partial`、`platform-first` 还是 `replacement-ready`

## 3. Recommended Reading Order

建议按以下顺序审查：

1. `openspec/changes/deck-web-replacement-program/proposal.md`
2. `openspec/changes/deck-web-replacement-program/design.md`
3. `openspec/changes/deck-web-replacement-program/specs/deck-core-platform-governance/spec.md`
4. `openspec/changes/deck-web-replacement-program/specs/deck-module-closure/spec.md`
5. `openspec/changes/deck-web-replacement-program/specs/deck-replacement-validation/spec.md`
6. `docs/plans/2026-04-03-deck-web-replacement-program-plan.md`
7. `docs/plans/2026-04-03-deck-web-replacement-matrix.md`
8. `openspec/changes/deck-web-replacement-program/tasks.md`

这个顺序的原因是：

- 先看立项理由和总设计
- 再看 program 的硬约束
- 再看工程推进方式
- 最后再看总纲自身还要补哪些治理动作

## 4. How These Documents Relate

这组文档分成两层：

### Layer A: Spec / Governance Layer

- `proposal.md`
- `design.md`
- `specs/*.md`
- `tasks.md`

这一层回答的是：

- 为什么要做这个总纲
- 总纲如何组织
- 后续必须遵守哪些规则
- 这个总纲 change 本身还有哪些治理动作要完成

### Layer B: Execution / Tracking Layer

- `docs/plans/2026-04-03-deck-web-replacement-program-plan.md`
- `docs/plans/2026-04-03-deck-web-replacement-matrix.md`

这一层回答的是：

- 后续工程上怎么推进
- 当前每个 Deck area 在 program 里处于什么位置

简化理解：

- OpenSpec 层定义规则
- Plan 层定义推进路径
- Matrix 层定义当前状态

## 5. What We Intend To Do Next

如果这轮审查通过，后续工作不再直接跳入模块实现，而是进入 program 驱动的 phase 执行循环：

1. 基于总纲写下一份可执行 phase plan
   - 首选目标是 `platform-kernel phase1`
   - 重点覆盖 `Core Platform`、`Session Runtime`、`UI Framework` 的前置能力

2. 按 phase plan 在独立 worktree 中实施
   - 不跨 phase 偷做后续模块
   - 不在共享契约未稳定前大规模并行改共享文件

3. 完成当前 phase 的验证与审查
   - 类型检查
   - 测试
   - 必要的工作流验证
   - 设计 / 代码审查

4. 回写状态
   - 更新对应 phase plan
   - 更新相关 OpenSpec tasks
   - 更新 `docs/plans/2026-04-03-deck-web-replacement-matrix.md`

5. 当前 phase 收敛后，再写下一份 phase plan
   - 不是一次性写完整个 Deck 的所有实施细节
   - 而是随着平台能力和依赖关系逐步推进

## 6. Review Focus Checklist

本轮建议重点审以下几点：

### Goal / Scope

- 是否认同“以 Gateway 能力覆盖为硬目标，而不是官方 UI parity”为总目标
- 是否认同允许交互按我们的产品逻辑重构
- 是否认同允许阶段性平台重构窗口

### Program Structure

- 五条主轨是否合理
- Phase 0 到 Phase 5 的顺序是否合理
- 当前是否遗漏了关键平台轨或关键模块轨

### Boundary Rules

- Gateway method、Deck route、projection 的职责划分是否清楚
- 是否还有容易导致后续反复返工的边界模糊点

### Closure Standard

- “模块闭环”标准是否足够严格
- 是否还缺关键验收项

### Matrix Accuracy

- 当前矩阵中的 area 划分是否合理
- 哪些 area 的状态可能需要上调或下调
- 哪些现有 `deck-*` changes 还没有正确归位

## 7. What This Review Does Not Cover

这轮文档审查不直接覆盖以下内容：

- 某个具体模块的实现细节是否正确
- 某个具体页面的 UI 细节是否已经足够好
- 某个具体 phase 的任务拆分是否已经足够细

这些内容会在后续 phase plan 和实现阶段分别审查。

## 8. Immediate Output Expected From This Review

如果这轮审查结束后没有方向性问题，下一份应创建的文档是：

- `docs/plans/2026-04-03-deck-platform-kernel-phase1-plan.md`

它将作为第一份真正进入实施阶段的 execution plan，承接本 program 总纲。
