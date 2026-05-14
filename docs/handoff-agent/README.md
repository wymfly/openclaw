# Agent Handoff Logs

Claude ↔ Codex 交叉审查与修复协作记录.

## 用途

每个开发任务都会经历 **写 plan → 实施 → 审查 → 修复 → 再审查** 的多轮交互, 而 Claude 和 Codex 这两个 agent 经常分别承担其中不同角色 (例如 Claude 写 plan + 审查, Codex 实施 + 修复). 这个目录把每个任务的多轮交互沉淀为 markdown 章节, 让两个 agent 都能离线读懂上下文, 接力推进.

跟其他相邻概念的区分:

- `docs/handoffs/` (C3 协议) — agent 自己跨 session 的 carry-forward, 单一 agent 的连续性
- `docs/reviews/` — 单次代码 review 评估, 不一定多轮接力
- `docs/handoff-agent/` (本目录) — Claude ↔ Codex 多轮协作的事实流水, 跨 agent 接力

## 文档结构约定

**一个开发任务一个 markdown 文件**, 命名 kebab-case 反映任务名称, 比如 `gateway-launcher-rewrite-stage1.md`.

每个文件顶部用一段 frontmatter-like header 记录上下文:

```markdown
# <任务名>

**OpenSpec change**: `<path>` (如适用)
**Plan**: `<path>` (如适用)
**Scope**: <一两句>
**当前状态**: <state> — 描述当前轮次结束后的最新状态
```

文件主体按 `## Round N: <类型> by <agent> on <date>` 切章节:

- **N** 从 1 起递增, 整文档内单调
- **类型**: `审查 (review)` / `修复 (fix)` / `回应 (reply)` / `补充 (supplement)`
- **agent**: `claude` / `codex`
- **date**: `YYYY-MM-DD`

## 章节内部惯例

每轮内容是自由 markdown, 但有几条约定让另一个 agent 容易解析:

- **审查 (review)** 章节必须以 YAML block 列出 findings, 字段建议:
  ```yaml
  findings:
    - id: H1
      severity: blocker | hard | medium | nit
      file: <path>:<line>
      issue: |
        <description>
      fix: |
        <recommended fix>
  ```
- **修复 (fix)** 章节按 finding id 一一对应回应: 描述实际改动 (文件 + 行号), 引用 commit hash (如有), 或解释为什么 reject / defer.
- **回应 (reply)** 章节用来沟通分歧 / 澄清, 通常不直接改代码.
- 末尾每轮给个一句话 `**当前 verdict**`: `approve` / `approve-with-followup` / `request-changes` / `block`.

## 文档索引

按任务字母序:

- [gateway-launcher-rewrite-stage1.md](./gateway-launcher-rewrite-stage1.md) — Gateway launcher rewrite Stage 1 (in-place rewrite of `bundled/`, BFF reverse-proxy, OperationsPanel UI)
- [managed-runtime-supervisor-decoupling.md](./managed-runtime-supervisor-decoupling.md) — F1 follow-up: decouple `runtime/openclaw.ManagedRuntime` from `bundled.Supervisor` types and delete spawn-era files; unblocks `gateway-launcher-rewrite` Stage 2 rename

新增任务时把链接加到本索引, 一句话描述.

## 给 Codex 的 hint

读到本目录任意文件时, 假设上下文都在该文件内, 不要回到 Claude 主 session 找. 如果需要的上下文不在文件里, 在你的章节末尾补一节 `**需要 Claude 补充**:` 列出 — Claude 下一轮会补.
