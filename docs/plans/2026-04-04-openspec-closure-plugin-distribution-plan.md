# OpenSpec Closure Plugin Distribution Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有 `openspec-closure` companion 从 repo-local reference implementation 提升为可安装的 Codex / Claude bundle，使新项目和新 worktree 在安装后只需薄配置即可运行 closure lifecycle。

**Architecture:** 先把当前 repo 里的 closure core 收敛成 runtime-neutral shared package，再由两个 product bundle 包装它：Codex 使用 `.codex-plugin`，Claude 使用 `.claude-plugin` 或等效 companion bundle。项目侧仍然只保留 `.openspec-closure.yaml`、`verification.yaml` 与 plan `covers.id`，所有执行能力都来自已安装 bundle，而不是项目脚本目录。

**Tech Stack:** TypeScript, pnpm workspace package, Codex plugin manifest, Claude plugin manifest, YAML, Vitest, OpenSpec change artifacts

**OpenSpec:** `openspec/changes/openspec-closure-plugin-distribution/` — 3 specs, 5 requirements, 9 scenarios

---

## File Structure

### New Files

| File                                                                      | Responsibility                                                                 |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `packages/openspec-closure-core/package.json`                             | Shared runtime-neutral companion package metadata                              |
| `packages/openspec-closure-core/src/index.ts`                             | Shared exports for closure lifecycle helpers                                   |
| `packages/openspec-closure-core/src/config.ts`                            | Adapter config loading and default resolution                                  |
| `packages/openspec-closure-core/src/spec-inventory.ts`                    | Scenario inventory parsing                                                     |
| `packages/openspec-closure-core/src/plan-coverage.ts`                     | Plan `covers.id` parsing                                                       |
| `packages/openspec-closure-core/src/verification-artifact.ts`             | Verification artifact read/write/validation                                    |
| `packages/openspec-closure-core/src/checker.ts`                           | Gap detection and `archiveReady` join logic                                    |
| `packages/openspec-closure-core/src/report.ts`                            | Human-readable / machine-readable report rendering                             |
| `plugins/openspec-closure/.codex-plugin/plugin.json`                      | Codex plugin manifest                                                          |
| `plugins/openspec-closure/skills/openspec-closure-workflow/SKILL.md`      | Codex-side manual closure workflow entrypoint                                  |
| `plugins/openspec-closure/scripts/openspec-closure.ts`                    | Codex bundle wrapper that invokes shared core from plugin-local assets         |
| `plugins/openspec-closure-claude/.claude-plugin/plugin.json`              | Claude companion bundle manifest                                               |
| `plugins/openspec-closure-claude/skills/openspec-closure-workflow/SKILL.md` | Claude-side manual closure workflow entrypoint                               |
| `plugins/openspec-closure-claude/scripts/openspec-closure.ts`             | Claude bundle wrapper that invokes shared core from plugin-local assets        |
| `test/scripts/openspec-closure-plugin.test.ts`                            | Distribution-level tests for bundle wrapper behavior and bootstrap guidance    |
| `test/fixtures/openspec-closure-plugin/minimal-project/**`                | Fixture project with thin adapter only                                         |
| `docs/reference/openspec-closure-plugin.md`                               | Installation, activation, and bootstrap guide for pluginized closure companion |

### Modified Files

| File                                           | Change                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| `scripts/openspec-closure.ts`                  | Turn repo CLI into a thin wrapper over the shared package              |
| `package.json`                                 | Add plugin smoke / test commands and shared-core references if needed  |
| `docs/reference/openspec-closure-companion.md` | Reframe repo-local implementation as reference core, not final bundle  |
| `.openspec-closure.yaml`                       | Keep current repo adapter as a thin project-owned configuration sample |

---

## Chunk 1: Shared Core And Product Bundles

### Task 1: Extract a runtime-neutral shared core package

**Files:**

- Create: `packages/openspec-closure-core/package.json`
- Create: `packages/openspec-closure-core/src/index.ts`
- Create: `packages/openspec-closure-core/src/config.ts`
- Create: `packages/openspec-closure-core/src/spec-inventory.ts`
- Create: `packages/openspec-closure-core/src/plan-coverage.ts`
- Create: `packages/openspec-closure-core/src/verification-artifact.ts`
- Create: `packages/openspec-closure-core/src/checker.ts`
- Create: `packages/openspec-closure-core/src/report.ts`
- Modify: `scripts/openspec-closure.ts`
- Modify: `test/scripts/openspec-closure.test.ts`

**covers:** `closure-plugin-distribution/spec.md > ADDED > The closure companion SHALL be installable as a product bundle instead of only as repo-local scripts > "Codex bundle exposes closure execution without repo-local scripts"`
**covers.id:** `closure-plugin-distribution.codex-bundle-exec`
**covers:** `closure-plugin-distribution/spec.md > ADDED > The closure companion SHALL be installable as a product bundle instead of only as repo-local scripts > "Claude bundle mirrors the same closure workflow contract"`
**covers.id:** `closure-plugin-distribution.claude-bundle-parity`
**covers:** `closure-project-bootstrap/spec.md > ADDED > Projects SHALL keep closure adoption to a thin adapter surface > "Project-owned files stay limited to adapter and change artifacts"`
**covers.id:** `closure-project-bootstrap.thin-project-surface`

- [x] **Step 1.1: 先写共享 core 抽离的失败测试**
      在 `test/scripts/openspec-closure.test.ts` 先增加“repo CLI 只做 wrapper、核心逻辑从 shared package 导出”的断言，避免直接把当前 `scripts/lib/openspec-closure/*` 再复制一份到插件目录。

- [x] **Step 1.2: 创建 `packages/openspec-closure-core`**
      把当前 closure config、inventory、coverage、artifact、checker、report 逻辑收敛成一个 workspace package，对外只暴露稳定 API，不暴露 repo 路径假设。

- [x] **Step 1.3: 把 `scripts/openspec-closure.ts` 降级为 repo wrapper**
      让当前仓库 CLI 只负责参数转发和本地开发 smoke，核心逻辑全部来自 shared package。

- [x] **Step 1.4: 跑定向测试**

```bash
pnpm test -- test/scripts/openspec-closure.test.ts
```

- [x] **Step 1.5: Commit**

```bash
scripts/committer "[enhanced] refactor(openspec): extract closure shared core package" \
  packages/openspec-closure-core \
  scripts/openspec-closure.ts \
  test/scripts/openspec-closure.test.ts
```

### Task 2: Scaffold and wire the Codex plugin bundle

**Files:**

- Create: `plugins/openspec-closure/.codex-plugin/plugin.json`
- Create: `plugins/openspec-closure/skills/openspec-closure-workflow/SKILL.md`
- Create: `plugins/openspec-closure/scripts/openspec-closure.ts`
- Modify: `package.json`
- Modify: `test/scripts/openspec-closure-plugin.test.ts`

**covers:** `closure-plugin-distribution/spec.md > ADDED > The closure companion SHALL be installable as a product bundle instead of only as repo-local scripts > "Codex bundle exposes closure execution without repo-local scripts"`
**covers.id:** `closure-plugin-distribution.codex-bundle-exec`
**covers:** `closure-workflow-activation/spec.md > ADDED > Manual skill activation SHALL remain a stable cross-product entrypoint > "Manual activation runs closure lifecycle through bundled assets"`
**covers.id:** `closure-workflow-activation.manual-skill-entrypoint`

- [x] **Step 2.1: 用 Codex 插件骨架约定搭出 bundle 结构**
      按 `.codex-plugin/plugin.json`、`skills/`、`scripts/` 的结构建立 `plugins/openspec-closure/`，manifest 里只声明插件真需要的 skill 和脚本入口，不顺手堆无关 assets。

- [x] **Step 2.2: 让插件 wrapper 调用 shared core**
      `plugins/openspec-closure/scripts/openspec-closure.ts` 只从 `packages/openspec-closure-core` 调用 closure lifecycle，不再引用项目根目录的 `scripts/lib/...`。

- [x] **Step 2.3: 写 Codex bundle 的 `openspec-closure-workflow`**
      这个 skill 只描述如何在 Codex 中定位项目根、检查 `.openspec-closure.yaml`、执行 `init/report/check`，不复制 checker 规则。

- [x] **Step 2.4: 跑 Codex bundle smoke**

```bash
pnpm test -- test/scripts/openspec-closure-plugin.test.ts -t "codex bundle"
```

- [x] **Step 2.5: Commit**

```bash
scripts/committer "[enhanced] feat(codex-plugin): add openspec closure bundle" \
  plugins/openspec-closure \
  package.json \
  test/scripts/openspec-closure-plugin.test.ts
```

### Task 3: Add the Claude-compatible companion bundle

**Files:**

- Create: `plugins/openspec-closure-claude/.claude-plugin/plugin.json`
- Create: `plugins/openspec-closure-claude/skills/openspec-closure-workflow/SKILL.md`
- Create: `plugins/openspec-closure-claude/scripts/openspec-closure.ts`
- Modify: `test/scripts/openspec-closure-plugin.test.ts`

**covers:** `closure-plugin-distribution/spec.md > ADDED > The closure companion SHALL be installable as a product bundle instead of only as repo-local scripts > "Claude bundle mirrors the same closure workflow contract"`
**covers.id:** `closure-plugin-distribution.claude-bundle-parity`
**covers:** `closure-workflow-activation/spec.md > ADDED > Manual skill activation SHALL remain a stable cross-product entrypoint > "Manual activation runs closure lifecycle through bundled assets"`
**covers.id:** `closure-workflow-activation.manual-skill-entrypoint`

- [x] **Step 3.1: 搭建 Claude companion bundle**
      用 Claude 支持的插件或 skill bundle 结构建立 `plugins/openspec-closure-claude/`，目标是让安装后不依赖任何单独项目里的 closure core。

- [x] **Step 3.2: 保持 skill 语义与 Codex 对齐**
      Claude 侧也暴露 `openspec-closure-workflow`，并保持相同的 lifecycle 词汇：`init`、`report`、`check`。

- [x] **Step 3.3: 跑 Claude bundle parity 测试**

```bash
pnpm test -- test/scripts/openspec-closure-plugin.test.ts -t "claude bundle"
```

- [ ] **Step 3.4: Commit**

```bash
scripts/committer "[enhanced] feat(claude-plugin): add openspec closure bundle" \
  plugins/openspec-closure-claude \
  test/scripts/openspec-closure-plugin.test.ts
```

---

## Chunk 2: Bootstrap, Workflow Routing, And Cross-Project Validation

### Task 4: Define thin project bootstrap and workflow routing behavior

**Files:**

- Create: `docs/reference/openspec-closure-plugin.md`
- Modify: `docs/reference/openspec-closure-companion.md`
- Modify: `.openspec-closure.yaml`
- Modify: `test/scripts/openspec-closure-plugin.test.ts`
- Create: `test/fixtures/openspec-closure-plugin/minimal-project/**`

**covers:** `closure-plugin-distribution/spec.md > ADDED > Installed bundles SHALL remain usable across projects and worktrees > "Same installed bundle works in a new worktree"`
**covers.id:** `closure-plugin-distribution.worktree-reuse`
**covers:** `closure-plugin-distribution/spec.md > ADDED > Installed bundles SHALL remain usable across projects and worktrees > "New projects adopt closure through thin adapter files only"`
**covers.id:** `closure-plugin-distribution.new-project-thin-adapter`
**covers:** `closure-workflow-activation/spec.md > ADDED > Wrapper workflow skills SHALL only route into closure workflow behavior > "Workflow wrappers route without redefining closure rules"`
**covers.id:** `closure-workflow-activation.wrapper-routing-only`
**covers:** `closure-workflow-activation/spec.md > ADDED > Activation failures SHALL produce bootstrap guidance > "Missing adapter produces bootstrap guidance"`
**covers.id:** `closure-workflow-activation.bootstrap-guidance`
**covers:** `closure-project-bootstrap/spec.md > ADDED > Projects SHALL keep closure adoption to a thin adapter surface > "Project-owned files stay limited to adapter and change artifacts"`
**covers.id:** `closure-project-bootstrap.thin-project-surface`
**covers:** `closure-project-bootstrap/spec.md > ADDED > Projects SHALL keep closure adoption to a thin adapter surface > "Archive gates can consume machine-readable readiness without vendored checker code"`
**covers.id:** `closure-project-bootstrap.archive-gate-machine-output`

- [ ] **Step 4.1: 为最小项目 fixture 先写失败测试**
      在 `test/scripts/openspec-closure-plugin.test.ts` 里新增 fixture project，只保留 `.openspec-closure.yaml`、spec、plan、verification artifact，确保 bundle 可以在没有 repo-local checker 源码的情况下工作。

- [ ] **Step 4.2: 写 bootstrap guidance**
      当项目缺 `.openspec-closure.yaml`、plan `covers.id` 或 `verification.yaml` 时，bundle 输出“下一步该创建什么、运行什么命令”，不要把底层 ENOENT 暴露给终端用户当主信息。

- [ ] **Step 4.3: 约束 workflow routing**
      在文档和测试中把路由语义写死：上层 workflow 只能调用 `openspec-closure-workflow`，不能重新定义 `scenario_id`、`archiveReady` 或状态枚举。

- [ ] **Step 4.4: 写安装与接入文档**
      `docs/reference/openspec-closure-plugin.md` 要明确三件事：- 如何安装 Codex / Claude bundle - 新项目最小接入文件集合 - 新 worktree 为什么不需要重新 vendoring core

- [ ] **Step 4.5: 跑 bootstrap / routing 测试**

```bash
pnpm test -- test/scripts/openspec-closure-plugin.test.ts -t "bootstrap|routing|minimal project"
```

- [ ] **Step 4.6: Commit**

```bash
scripts/committer "[enhanced] docs(openspec): add closure plugin bootstrap guide" \
  docs/reference/openspec-closure-plugin.md \
  docs/reference/openspec-closure-companion.md \
  .openspec-closure.yaml \
  test/scripts/openspec-closure-plugin.test.ts \
  test/fixtures/openspec-closure-plugin/minimal-project
```

### Task 5: Validate cross-project and cross-worktree readiness

**Files:**

- Modify: `test/scripts/openspec-closure-plugin.test.ts`
- Modify: `docs/reference/openspec-closure-plugin.md`

**covers:** All remaining plugin-distribution and bootstrap scenarios through integrated validation

- [ ] **Step 5.1: 增加端到端 lifecycle 验证**
      在测试中覆盖：- Codex bundle `init -> report -> check` - Claude bundle `init -> report -> check` - 最小项目 fixture 的 machine-readable `archiveReady` 输出 - 缺失 adapter 时的 guidance 输出。

- [ ] **Step 5.2: 增加 worktree 复用验证**
      用 fixture 或临时目录模拟“同一项目第二个工作树”场景，确认 bundle 只依赖已安装 assets + 项目 adapter，不依赖第一次运行留下的 repo-local checker 文件。

- [ ] **Step 5.3: 跑完整验证**

```bash
openspec validate openspec-closure-plugin-distribution --strict
pnpm test -- test/scripts/openspec-closure.test.ts test/scripts/openspec-closure-plugin.test.ts
pnpm build
```

- [ ] **Step 5.4: Commit**

```bash
scripts/committer "[enhanced] test(openspec): validate closure plugin distribution" \
  docs/reference/openspec-closure-plugin.md \
  test/scripts/openspec-closure-plugin.test.ts
```

---

## Requirement Coverage Matrix

| Scenario ID                                                 | Task    |
| ----------------------------------------------------------- | ------- |
| `closure-plugin-distribution.codex-bundle-exec`            | T1, T2  |
| `closure-plugin-distribution.claude-bundle-parity`         | T1, T3  |
| `closure-plugin-distribution.worktree-reuse`               | T4, T5  |
| `closure-plugin-distribution.new-project-thin-adapter`     | T4, T5  |
| `closure-workflow-activation.manual-skill-entrypoint`      | T2, T3  |
| `closure-workflow-activation.wrapper-routing-only`         | T4      |
| `closure-workflow-activation.bootstrap-guidance`           | T4, T5  |
| `closure-project-bootstrap.thin-project-surface`           | T1, T4  |
| `closure-project-bootstrap.archive-gate-machine-output`    | T4, T5  |

---

Plan complete and saved to `docs/plans/2026-04-04-openspec-closure-plugin-distribution-plan.md`. Ready to execute.
