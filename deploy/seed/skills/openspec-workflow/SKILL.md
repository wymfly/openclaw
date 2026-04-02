---
name: openspec-workflow
description: Use when a task involves architecture-level changes, cross-module refactoring, or needs design specification persistence. Triggers on system boundary changes, new patterns, interface contract redesign, or multi-component restructuring.
---

# OpenSpec Workflow

Guides when and how to use OpenSpec for architecture-level changes within the superpowers development flow.

## 前置条件

OpenSpec 是独立 CLI 插件，需要在项目中初始化后才能使用。

**每次触发 OpenSpec 流程前，先检查：**

1. 检查项目中是否存在 `.claude/commands/opsx/propose.md`
2. 如果存在 → 项目已初始化，直接使用 `/opsx:propose` 等斜杠命令
3. 如果不存在 → 先运行 `openspec init --tools claude`，然后继续

> `openspec init --tools claude` 会在项目的 `.claude/` 下生成 4 个 slash command（`/opsx:propose`、`/opsx:apply`、`/opsx:archive`、`/opsx:explore`）和 4 个操作级 skill（`openspec-propose`、`openspec-apply-change`、`openspec-archive-change`、`openspec-explore`）。这些文件包含了逐步的 CLI 操作指南，是 Claude Code 实际执行 OpenSpec 的操作手册。

**本 skill 的定位：** 编排层（WHEN + 交接协议），不重复操作级 skill 的 HOW。

## When to Use

**Use OpenSpec when ANY of these apply:**

- Architecture-level change (module boundaries, component responsibilities)
- Cross-module refactoring (changes span 3+ modules)
- Design specification persistence needed (others must reference this decision)
- New system pattern introduced (new abstraction, new integration pattern)

**Do NOT use OpenSpec for:**

- Single-file bug fixes
- UI additions within existing patterns
- Feature additions that don't change architecture
- Standard CRUD operations

**Quick test:** Does this change alter "what the system IS" (module boundaries, interface contracts) or just "what the system DOES" (add/modify features within existing architecture)? OpenSpec is for the former.

## Three-Phase Lifecycle

```
proposal → apply → archive
```

### Phase 1: Proposal

触发 `/opsx:propose "<idea>"` 斜杠命令，Claude 将自动完成：

- 创建 `openspec/changes/<name>/`（含 `.openspec.yaml`）
- 生成以下 artifacts：

| Artifact      | 内容                           | 下游消费者                                                               |
| ------------- | ------------------------------ | ------------------------------------------------------------------------ |
| `proposal.md` | 问题陈述、目标、非目标、约束   | codex-review / gemini-review（设计审查）                                 |
| `specs/`      | 接口契约、数据模型、API schema | writing-plans（标签增强）、validate（契约验证）                          |
| `design.md`   | 架构决策、模块职责、交互流程   | writing-plans（引用不重写）、Mode 3 时被 brainstorming 的 design.md 替代 |
| `tasks.md`    | 任务分解（初稿，无域标签）     | writing-plans（增强：加标签 + Skill 路由 + 依赖图）                      |

> change 名称规则（1.2.0+）：必须以字母开头，使用 kebab-case，如 `add-dark-mode`。

**辅助 CLI（调试/查看用）：**

```bash
openspec list                        # 查看所有 active changes
openspec status --change <name>      # 查看 artifact 完成进度
openspec validate <name> --strict    # 验证 proposal
```

### Phase 2: Apply

触发 `/opsx:apply` 斜杠命令，Claude 将按 tasks.md 逐项实现并标记完成。

### Phase 3: Archive

实现完成、代码合并后，触发 `/opsx:archive` 斜杠命令归档。

## Handoff to writing-plans（交接协议）

OpenSpec's `tasks.md` feeds directly into `superpowers:writing-plans`:

```
OpenSpec proposal complete
    │
    ▼
tasks.md → writing-plans (enhance, don't rewrite)
    │  - Add domain labels ([frontend], [backend], [test]...)
    │  - Add Skill prompts per task（见 dev-workflow「Skill 路由」表）
    │  - Confirm dependency graph
    │  - Pre-G2 结果为 likely/uncertain 时：加文件清单 + 交叉矩阵
    │
    ▼
G2 gate → execution mode selection → standard flow
```

### 交接规则

| 规则                         | 说明                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| **tasks.md 不重写**          | writing-plans 在原 tasks.md 基础上增强，不重新分解任务                                  |
| **design.md 只引用**         | writing-plans 引用 design.md 的架构决策，不重新设计                                     |
| **Mode 3 的 design.md 来源** | brainstorming 产出的 design.md 优先，`/opsx:propose` 直接引用，不重新撰写               |
| **specs/ 传递**              | specs/ 中的接口契约传递给 validate（Step 5 API 契约验证的权威参照源）                   |
| **需求→任务映射**            | writing-plans 增强 tasks.md 时，每个任务必须标注它实现的 spec requirement（见下方格式） |

### 需求追踪格式

writing-plans 增强 tasks.md 时，在每个任务描述中追加 `covers:` 字段，建立 spec requirement → task 的追踪链：

```markdown
### Task 3: 实现主题切换 API [backend]

covers: dark-mode/spec.md > ADDED > dark-mode-toggle > "User toggles dark mode"

**Files:** ...
**Steps:** ...
```

- `covers:` 格式为 `<spec-file> > <section> > <requirement> > "<scenario>"`
- 一个任务可以 cover 多个 requirement（多行 `covers:`）
- 所有 ADDED/MODIFIED requirements 的场景必须被至少一个任务 cover
- writing-plans 完成后，输出一张**需求覆盖矩阵**，确认无遗漏：

```
┌─────────────────────────────┬───────────┐
│ Spec Requirement            │ Task      │
├─────────────────────────────┼───────────┤
│ dark-mode/toggle (ADDED)    │ Task 3, 5 │
│ color-system/vars (MODIFIED)│ Task 4    │
│ ...                         │ ...       │
└─────────────────────────────┴───────────┘
```

这保证了 OpenSpec 的 WHAT（specs/）完整传递到 Superpowers 的 HOW（tasks），不会有声明了但没实现的需求。

## Integration with superpowers Flow

**Entry routing:** When brainstorming reveals architecture-level scope, suggest switching to OpenSpec before continuing the standard flow.

```
brainstorming detects architecture change
    → suggest: "This looks like an architecture change. Recommend OpenSpec proposal first."
    → user confirms → /opsx:propose "<idea>" → artifacts generated
    → tasks.md → resume at writing-plans
```

## Common Mistakes

| Mistake                             | Fix                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------ |
| Using OpenSpec for simple features  | Check the "quick test" — does it change system structure?                |
| Skipping design.md                  | Required when solution spans multiple systems or introduces new patterns |
| Including pseudocode in design.md   | Focus on architecture: responsibilities, interfaces, state machines      |
| Rewriting tasks.md in writing-plans | Enhance with labels/Skills, don't duplicate                              |
| Forgetting to validate              | Always `openspec validate <id> --strict` before sharing proposal         |
| Skipping archive phase              | Archive after merge to keep specs current                                |
