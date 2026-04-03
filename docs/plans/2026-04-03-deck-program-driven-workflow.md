# Deck Program-Driven Development Workflow

> Date: 2026-04-03
> Status: Approved
> Scope: Defines how the Deck Web Replacement Program framework integrates with per-session development workflows (codex-workflow / dev-workflow)

## 1. Two-Loop Model

Program 文档体系是**外层循环**（跨 session），codex-workflow / dev-workflow 是**内层循环**（单 session）。两者通过 **matrix** 和 **phase plan** 衔接。

### Outer Loop: Program Level

```
Phase gate review
    → Write next phase plan
    → Per-item routing (see Section 3)
    → Multiple sessions execute items
    → Update matrix + program tasks
    → Phase gate review (next phase)
```

Cadence: weeks to months per phase.

### Inner Loop: Session Level

```
Read matrix → Pick next work item → Route → Execute via codex-workflow/dev-workflow → Update matrix
```

Cadence: hours to days per session.

## 2. Session Entry Flow

每个 session 开始时：

1. 读取 `docs/plans/2026-04-03-deck-web-replacement-matrix.md`，确定当前 phase
2. 在当前 phase 中选择下一个工作项（按 Priority 列排序，跳过 blockedBy 未完成的项）
3. 执行路由判断（Section 3）
4. 进入 codex-workflow 或 dev-workflow

## 3. Per-Item Routing: 三条路径

### Path A: 直接写 plan

**条件**（全部满足）：
- 已有 openspec proposal，且 capabilities 描述清晰
- 已有 design.md 或架构决策已在 program design 中覆盖
- 实施范围是现有架构的延伸，不引入新的系统边界或共享契约
- closure standard 中的每一项都能映射到具体的验收动作

**流程**：codex-workflow Mode 1 短路径（直接 writing-plans）

### Path B: 升级现有 proposal 后写 plan

**条件**：
- 已有 openspec proposal
- 但 proposal 不满足当前 closure standard（缺少恢复路径定义、缺少 runtime sync 描述等）

**流程**：更新现有 proposal 对齐 closure standard → codex-workflow Mode 1 短路径

### Path C: 完整流程

**条件**：
- 无 proposal，且是新系统能力（满足 OpenSpec 阈值）

**流程**：codex-workflow 完整路径（brainstorm → openspec → plan → implement → review）

### 判断表

| matrix 中的 Closure Status | 已有 Proposal? | 路径 |
|---|---|---|
| `replacement-ready` | - | 跳过，已完成 |
| `partial` | Yes, 满足 closure standard | **Path A** |
| `partial` | Yes, 不满足 closure standard | **Path B** |
| `platform-first` | Yes | **Path B**（升级 proposal 后等平台依赖就绪） |
| `platform-first` | No | **Path C** |
| `unassessed` | Yes | **Path B** |
| `unassessed` | No | **Path C** |

## 4. Session 收尾：回写 Program State

每个 session 完成实施后，必须回写以下 program 状态：

1. **Matrix closure status**: 更新 `docs/plans/2026-04-03-deck-web-replacement-matrix.md` 中对应 area 的 `Current Closure` 列
2. **Program tasks.md**: 如果完成了 `openspec/changes/deck-web-replacement-program/tasks.md` 中的某项治理动作，勾选对应 checkbox
3. **Phase gate trigger**: 如果当前 phase 内所有 area 都已更新，记录 "phase gate review needed" 供下个 session 处理

## 5. Phase Gate Review

Phase 内所有 area 达到该 phase 的目标后，执行 phase gate review：

1. 遍历 matrix 中当前 phase 的所有 area
2. 对照 closure standard 逐项检查
3. 运行 program-level validation（type check + test + workflow validation）
4. 通过 → 写下一个 phase plan 文档
5. 未通过 → 创建补救任务，修复后重新 gate

## 6. 与 codex-workflow 的集成点

| codex-workflow 步骤 | Program 框架接入方式 |
|---|---|
| 入口路由 Step 3（OpenSpec 阈值） | matrix 中 `unassessed` 或无 proposal 的项 → 自动满足 OpenSpec 阈值 |
| Phase 1b（writing-plans） | plan 必须引用 program closure standard 作为验收标准 |
| Phase 3（实施） | `.skill-summary.md` 额外注入 program boundary rules（Gateway/Route/Projection） |
| Phase 4 Step 5（验证） | 额外执行 closure checklist 逐项检查 |
| Phase 4 Step 6（收尾） | 回写 matrix + program tasks.md |

## 7. Worktree 与 Session 的映射

- `program` worktree：只用于维护 program docs，不承载实现
- 实现 worktree（`platform-kernel` / `runtime-core` / `config-control` / `observe-automate`）：每个 session 在对应 worktree 中工作
- 一个 session 只操作一个 worktree
- 跨 worktree 的共享契约变更必须先在 `platform-kernel` 中稳定

## 8. Program Documents Quick Reference

| 文档 | 作用 | 何时读 | 何时写 |
|---|---|---|---|
| `proposal.md` | 立项理由 | 新成员 onboarding | 极少更新 |
| `design.md` | 总体架构、边界规则、决策 | 做架构决策时 | 有新的架构决策时 |
| `specs/*.md` | 治理规则（硬约束） | 写 plan / 做 review 时 | 规则需要修订时 |
| `tasks.md` | 治理动作清单 | 检查 program 进度 | 完成治理动作后勾选 |
| `program-plan.md` | 轨道、阶段、worktree 策略 | Session 开始时 | Phase 转换时 |
| `matrix.md` | 模块状态全景 | Session 开始时选工作项 | Session 结束时回写 |
| `program-driven-workflow.md` | 本文档，流程定义 | 不确定该怎么做时 | 流程需要调整时 |
