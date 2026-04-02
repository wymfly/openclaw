---
name: codex-review
description: Use when reviewing architecture, design documents, task plans, or code changes with a second-opinion perspective from OpenAI Codex CLI. Trigger on plan review, architecture review, design doc review, or when user requests cross-model validation.
---

# Codex Review

Get a second-opinion review from OpenAI Codex CLI (GPT) to complement Claude's perspective.

**前置步骤：** 用 Read 工具读取 `~/.claude/skills/review-protocol.md`，按其流程组装 Review Request 和审查 Prompt。

本 skill 定义 Codex **专有的**命令语法和执行细节。Review Request 格式、审查指令、竞争模式、多轮协议、结果处理均见 `review-protocol.md`（单一真源）。

---

## 命令选择

### 决策树

```
需要嵌入 Review Request？（几乎所有场景 = YES）
  ├─ YES → codex exec（推荐，支持自定义 prompt）
  └─ NO（极简场景，无需 Review Request）
       ├─ 工作目录干净？→ codex review --base / --commit / --uncommitted
       └─ 工作目录不干净？→ codex exec + scoped diff
```

### A. `codex exec`（主要模式）

```bash
codex exec -C <project-dir> -s read-only "<prompt>"
```

- `-s read-only` 自动设置 `approval=never`
- **禁止** `--full-auto`（静默覆盖为 `workspace-write`）

### B. `codex review`（快捷模式）

```bash
cd <project-dir> && codex review <MODE>
```

| 模式        | 命令                            |
| ----------- | ------------------------------- |
| 特定 commit | `codex review --commit <SHA>`   |
| 分支 diff   | `codex review --base <ref>`     |
| 未提交变更  | `codex review --uncommitted`    |
| 自定义指令  | `codex review "<instructions>"` |

> **互斥规则：** `--base`/`--commit`/`--uncommitted` 与 `"<instructions>"` 不可同时使用。需要结合时 → 改用 `codex exec`。

---

## Prompt 组装

按 `review-protocol.md` Step 3 的通用结构组装 prompt，通过 `codex exec` 发送。

### 代码审查

```bash
codex exec -C <project-dir> -s read-only "
你是资深软件工程师，负责代码审查。

<Review Request — Code Review（protocol 类型 A，完整 6 段）>

<代码审查指令（protocol 标准指令）>

\`\`\`diff
$(cat /tmp/review-scope.diff)
\`\`\`

<竞争上下文（protocol）>
"
```

### 设计文档审查

```bash
codex exec -C <project-dir> -s read-only "
你是资深软件架构师，负责设计审查。

<Review Request — Design Review（protocol 类型 B）>

<设计文档审查指令（protocol 标准指令）>

$(cat <design-file>)

<竞争上下文>
"
```

### 实施计划审查

```bash
codex exec -C <project-dir> -s read-only "
你是资深工程技术负责人，负责计划审查。

<Review Request — Plan Review（protocol 类型 C）>

<实施计划审查指令（protocol 标准指令）>

$(cat <plan-file>)

<竞争上下文>
"
```

### OpenSpec 审查

```bash
codex exec -C <project-dir> -s read-only "
你是资深软件架构师，负责架构提案审查。

<Review Request — OpenSpec Review（protocol 类型 D）>

<OpenSpec 审查指令（protocol 标准指令）>

$(for f in openspec/changes/<name>/{proposal.md,design.md,tasks.md,specs/*}; do echo '=== '$f' ==='; cat \"\$f\" 2>/dev/null; echo; done)

<竞争上下文>
"
```

### 大 Diff 处理

| Diff 大小 | Codex 策略                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------- |
| < 30KB    | 内联到 prompt（如上示例）                                                                           |
| ≥ 30KB    | 保存到 `/tmp/review-scope.diff`，prompt 末尾加 `请读取项目目录下的 /tmp/review-scope.diff 进行审查` |

---

## 多轮执行

按 `review-protocol.md` 多轮审查协议执行。每轮的 **Codex 命令**：

```bash
# R2/R3：将 protocol 的 R2/R3 Prompt 模板嵌入 codex exec
codex exec -C <project-dir> -s read-only "
<R2/R3 Prompt（protocol 模板，含原始 Review Request + 前轮上下文）>

\`\`\`diff
$(git diff <prev-review-commit>..HEAD -- $REVIEW_FILES)
\`\`\`

<竞争上下文>
"
```

---

## Output Handling

```bash
codex exec ... -o /tmp/codex-review.md "<prompt>"   # 保存到文件
codex exec ... "<prompt>" 2>&1 | tail -n +N         # 管道输出（跳过 header）
```

---

## 降级策略

### 触发条件（任一即降级）

- 退出码非 0
- 输出包含 `rate limit`、`quota`、`429`、`503`、`timeout`
- 命令超时（> 120s 无响应）

### 降级执行

启动 Claude Code sub-agent（`subagent_type: general-purpose`），使用 `review-protocol.md` 降级 Prompt 模板，**嵌入完整 Review Request + 对应审查指令 + Diff/文档内容**。

降级结果标记 `[degraded: codex → claude-sub-agent]`。

---

## Integration Points

| 流程节点         | 审查类型              | Review Request 类型 |
| ---------------- | --------------------- | ------------------- |
| OpenSpec 提案后  | OpenSpec 审查         | 类型 D              |
| brainstorming 后 | 设计文档审查          | 类型 B              |
| writing-plans 后 | 实施计划审查          | 类型 C              |
| 实现后           | 代码审查              | 类型 A              |
| Pre-PR           | 代码审查（分支 diff） | 类型 A              |

---

## Gotchas

- `--full-auto` **静默覆盖** `-s read-only` → 绝不使用
- `codex review` 不支持 `-C` → 必须先 `cd`
- `codex review` 的 `--base`/`--commit` 与 `"<prompt>"` **互斥** → 需要结合时改用 `codex exec`
- `codex review --base` 会包含所有 unstaged 变更 → 工作目录不干净时用 scoped diff
- Codex 自动加载项目 `AGENTS.md`（等同于 `CLAUDE.md`）
- Token 预算：小审查 5K-20K，大审查 50K-200K+
