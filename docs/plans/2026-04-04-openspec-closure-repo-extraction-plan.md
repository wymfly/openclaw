# OpenSpec Closure Repo Extraction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `openspec-closure` 的工具主体迁移到 OpenClaw 同级目录下的独立 sibling repo，同时把 OpenClaw 清理为 consumer-only repo，并保留所有属于当前项目的验证证据与 adoption provenance。

**Architecture:** 迁移分两段完成。先在 sibling repo 中建立 closure tooling 的新 source-of-truth，把 shared core、双端插件、generic docs/tests/specs/plans 全量外移，并让它们能以 OpenClaw 作为外部 consumer 运行。再回到 OpenClaw 删除工具主体，仅保留 `.openspec-closure.yaml`、OpenClaw 自己的 `verification.yaml` 与历史验证证据。

**Tech Stack:** OpenSpec, pnpm workspace, TypeScript, Codex/Claude plugin bundles, sibling git repository

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `../openspec-closure/` | 新的 sibling repo 根目录，承接 closure tooling source-of-truth |
| `../openspec-closure/packages/openspec-closure-core/` | shared closure core |
| `../openspec-closure/plugins/openspec-closure/` | Codex plugin bundle |
| `../openspec-closure/plugins/openspec-closure-claude/` | Claude bundle |
| `../openspec-closure/docs/` | generic closure companion/plugin docs |
| `../openspec-closure/test/` | generic closure tests 与 fixtures |
| `../openspec-closure/openspec/` | tooling repo 的 generic OpenSpec artifacts |
| `.openspec-closure.yaml` | OpenClaw consumer config，保留 |
| `openspec/changes/**/verification.yaml` | OpenClaw 自己的 scenario closure evidence，保留 |
| `openspec/changes/archive/2026-04-03-openspec-closure-plugin-distribution/` | OpenClaw 侧真实迁移/验证 provenance，保留 |

## Chunk 1: Ownership and Bootstrap

### Task 1: Freeze ownership and retained-evidence inventory

**Files:**
- Modify: `openspec/changes/openspec-closure-repo-extraction/design.md`
- Modify: `docs/plans/2026-04-04-openspec-closure-repo-extraction-plan.md`
- Create: `../openspec-closure/README.md`

**covers:** `closure-tooling-ownership/spec.md > ADDED > Closure tooling source-of-truth SHALL live in a sibling repository > "Generic closure implementation migrates out of OpenClaw"`
**covers.id:** `closure-tooling-ownership.external-source-of-truth`
**covers:** `closure-migration-retained-evidence/spec.md > ADDED > Historical verification evidence SHALL be retained in OpenClaw > "Archived verification artifacts are preserved"`
**covers.id:** `closure-migration-retained-evidence.keep-archived-verification`

- [x] **Step 1.1: 写 inventory 校验清单**
      在 design/plan 中显式列出 must-move、must-keep、historical-evidence 三份清单，尤其写死 `.openspec-closure.yaml`、`openspec/changes/**/verification.yaml`、archive evidence 属于 OpenClaw。
- [x] **Step 1.2: 预先约定 sibling repo 根目录**
      把目标 repo 定为 OpenClaw 同级目录 `../openspec-closure`，并约定其成为 closure tooling 的 source-of-truth。
- [x] **Step 1.3: 明确 active generic change 的迁移策略**
      在 design/plan 中写明 `openspec/changes/openspec-closure-companion/` 和对应 generic plan 不继续作为 OpenClaw active change，而是迁到 sibling repo。
- [x] **Step 1.4: 记录当前仓库中必须保留的历史证据**
      把 `openspec/changes/archive/2026-04-03-deck-chat-message-contract/verification.yaml` 与 `openspec/changes/archive/2026-04-03-openspec-closure-plugin-distribution/verification.yaml` 记入 must-keep 清单。
- [ ] **Step 1.5: 提交 ownership 文档冻结**
      Run: `scripts/committer "[enhanced] spec: freeze closure repo extraction ownership" openspec/changes/openspec-closure-repo-extraction docs/plans/2026-04-04-openspec-closure-repo-extraction-plan.md`

### Task 2: Bootstrap the sibling tooling repository

**Files:**
- Create: `../openspec-closure/package.json`
- Create: `../openspec-closure/pnpm-workspace.yaml`
- Create: `../openspec-closure/packages/openspec-closure-core/**`
- Create: `../openspec-closure/plugins/openspec-closure/**`
- Create: `../openspec-closure/plugins/openspec-closure-claude/**`
- Create: `../openspec-closure/docs/**`
- Create: `../openspec-closure/test/**`
- Create: `../openspec-closure/openspec/**`

**covers:** `closure-tooling-ownership/spec.md > ADDED > Closure tooling source-of-truth SHALL live in a sibling repository > "Generic closure implementation migrates out of OpenClaw"`
**covers.id:** `closure-tooling-ownership.external-source-of-truth`
**covers:** `closure-tooling-ownership/spec.md > ADDED > Closure tooling source-of-truth SHALL live in a sibling repository > "Generic closure development history moves with the tooling source"`
**covers.id:** `closure-tooling-ownership.move-active-generic-change`

- [x] **Step 2.1: 创建 sibling repo 基础文件**
      建立 `../openspec-closure/`，写入 workspace 配置、README 和最小 package metadata。
- [x] **Step 2.2: 迁入 shared core**
      把 `packages/openspec-closure-core/` 迁入 sibling repo，并修复包内路径。
- [x] **Step 2.3: 迁入 Codex / Claude bundles**
      把 `plugins/openspec-closure/` 与 `plugins/openspec-closure-claude/` 迁入 sibling repo，保留同名 skill 和 launcher。
- [x] **Step 2.4: 迁入 generic docs/tests/specs/plans**
      把 `docs/reference/openspec-closure-*.md`、`test/scripts/openspec-closure*.test.ts`、fixtures、generic OpenSpec artifacts 一并迁入 sibling repo。
- [x] **Step 2.5: 让 sibling repo 能独立运行**
      确保 sibling repo 内的 commands/tests/docs 不再依赖 OpenClaw 内部实现路径。
- [ ] **Step 2.6: 提交 sibling repo bootstrap**
      在 sibling repo 内单独提交一组 bootstrap commits。

## Chunk 2: Consumer Validation and OpenClaw Cleanup

### Task 3: Validate OpenClaw as an external consumer

**Files:**
- Modify: `../openspec-closure/test/**`
- Modify: `../openspec-closure/docs/**`
- Modify: `.openspec-closure.yaml`
- Modify: `openspec/changes/openspec-closure-repo-extraction/verification.yaml`

**covers:** `closure-openclaw-consumer-boundary/spec.md > ADDED > OpenClaw SHALL retain only consumer-facing closure assets > "OpenClaw remains a valid external consumer"`
**covers.id:** `closure-openclaw-consumer-boundary.external-consumer-validation`

- [x] **Step 3.1: 让 sibling repo 的 closure tooling 对准当前 OpenClaw 根目录**
      用外部 repo 的 CLI / bundle 对 OpenClaw 仓库执行 `init/report/check`，证明 OpenClaw 现在可以仅靠 consumer adapter 运转。
- [x] **Step 3.2: 验证 Codex / Claude bundle 对 OpenClaw 的实际可用性**
      从 sibling repo 的 bundle 出发，对当前 OpenClaw 作为目标项目做一次 bundle-level smoke。
- [x] **Step 3.3: 更新 verification evidence**
      把本次 consumer validation 的命令与证据写回当前 change 的 `verification.yaml`。
- [ ] **Step 3.4: 提交 external-consumer validation**
      在 sibling repo 和 OpenClaw repo 分别提交对应验证结果。

### Task 4: Clean OpenClaw to a consumer-only boundary

**Files:**
- Delete: `packages/openspec-closure-core/**`
- Delete: `plugins/openspec-closure/**`
- Delete: `plugins/openspec-closure-claude/**`
- Delete: `scripts/openspec-closure.ts`
- Delete: `scripts/lib/openspec-closure/**`
- Delete: `test/scripts/openspec-closure.test.ts`
- Delete: `test/scripts/openspec-closure-plugin.test.ts`
- Delete: `test/fixtures/openspec-closure/**`
- Delete: `test/fixtures/openspec-closure-plugin/**`
- Delete: `docs/reference/openspec-closure-companion.md`
- Delete: `docs/reference/openspec-closure-plugin.md`
- Delete: `openspec/specs/closure-plugin-distribution/spec.md`
- Delete: `openspec/specs/closure-project-bootstrap/spec.md`
- Delete: `openspec/specs/closure-workflow-activation/spec.md`
- Delete: `openspec/changes/openspec-closure-companion/**`
- Delete: `docs/plans/2026-04-03-openspec-closure-companion-plan.md`
- Modify: `package.json`
- Modify: `docs/docs.json`
- Keep: `.openspec-closure.yaml`
- Keep: `openspec/changes/**/verification.yaml`
- Keep: `openspec/changes/archive/2026-04-03-openspec-closure-plugin-distribution/**`

**covers:** `closure-openclaw-consumer-boundary/spec.md > ADDED > OpenClaw SHALL retain only consumer-facing closure assets > "Consumer adapter stays in OpenClaw"`
**covers.id:** `closure-openclaw-consumer-boundary.keep-consumer-adapter`
**covers:** `closure-openclaw-consumer-boundary/spec.md > ADDED > OpenClaw SHALL retain only consumer-facing closure assets > "Tooling-only repo surfaces are removed from OpenClaw"`
**covers.id:** `closure-openclaw-consumer-boundary.remove-tooling-surfaces`
**covers:** `closure-tooling-ownership/spec.md > ADDED > Closure tooling source-of-truth SHALL live in a sibling repository > "Generic closure capabilities stop living in OpenClaw main specs"`
**covers.id:** `closure-tooling-ownership.remove-generic-main-specs`

- [x] **Step 4.1: 删除 repo-local closure tooling 主体**
      从 OpenClaw 删除 shared core、repo CLI、plugin bundles、generic tests/fixtures/docs。
- [x] **Step 4.2: 删除 generic closure main specs**
      把 `openspec/specs/closure-*` 从 OpenClaw 主 spec 集合中移除。
- [x] **Step 4.3: 删除 current repo 中仍然活跃的 generic closure change**
      清理 `openspec/changes/openspec-closure-companion/` 与其对应 generic plan，不再让它继续留在 OpenClaw active changes。
- [x] **Step 4.4: 清理 package scripts 与 docs nav**
      从 `package.json` 和 docs 索引中移除只为 repo-local closure tooling 服务的入口。
- [x] **Step 4.5: 复核 must-keep 清单**
      确认 `.openspec-closure.yaml`、OpenClaw 自己的 `verification.yaml` 和 archive evidence 仍在。
- [ ] **Step 4.6: 提交 OpenClaw consumer-only cleanup**
      Run: `scripts/committer "[enhanced] chore: externalize openspec closure tooling" ...`

### Task 5: Final cross-repo verification and handoff

**Files:**
- Modify: `openspec/changes/openspec-closure-repo-extraction/verification.yaml`
- Modify: `openspec/changes/openspec-closure-repo-extraction/tasks.md`
- Modify: `docs/plans/2026-04-04-openspec-closure-repo-extraction-plan.md`

**covers:** `closure-migration-retained-evidence/spec.md > ADDED > Historical verification evidence SHALL be retained in OpenClaw > "Archived verification artifacts are preserved"`
**covers.id:** `closure-migration-retained-evidence.keep-archived-verification`
**covers:** `closure-migration-retained-evidence/spec.md > ADDED > Historical verification evidence SHALL be retained in OpenClaw > "Retained records are treated as provenance, not active tooling ownership"`
**covers.id:** `closure-migration-retained-evidence.provenance-not-product-capability`

- [x] **Step 5.1: 验证 sibling repo 自身通过测试与构建**
      Run sibling repo 的测试、build、plugin launcher smoke。
- [x] **Step 5.2: 再次验证 OpenClaw 作为 consumer 可被 closure tooling 处理**
      对清理后的 OpenClaw 再跑一次 `report/check`。
- [x] **Step 5.3: 复核 archive evidence 完整性**
      确认 historical evidence 仍可读、仍可指向真实验证命令与结论。
- [ ] **Step 5.4: 更新 verification.yaml 并跑 closure check**
      在当前 change 下更新所有 scenario 状态，然后从 sibling repo 运行 `pnpm openspec:closure:report -- --change openspec-closure-repo-extraction --root ../openclaw` 和 `pnpm openspec:closure:check -- --change openspec-closure-repo-extraction --root ../openclaw --format json`。
- [ ] **Step 5.5: 提交验证与收尾**
      Run: `scripts/committer "[enhanced] test: verify closure repo extraction migration" openspec/changes/openspec-closure-repo-extraction docs/plans/2026-04-04-openspec-closure-repo-extraction-plan.md`

## Requirement Coverage Matrix

| Scenario ID | Task |
| --- | --- |
| `closure-tooling-ownership.external-source-of-truth` | T1, T2 |
| `closure-tooling-ownership.remove-generic-main-specs` | T4 |
| `closure-tooling-ownership.move-active-generic-change` | T2, T4 |
| `closure-openclaw-consumer-boundary.keep-consumer-adapter` | T4 |
| `closure-openclaw-consumer-boundary.remove-tooling-surfaces` | T4 |
| `closure-openclaw-consumer-boundary.external-consumer-validation` | T3, T5 |
| `closure-migration-retained-evidence.keep-archived-verification` | T1, T5 |
| `closure-migration-retained-evidence.provenance-not-product-capability` | T5 |

Plan complete and saved to `docs/plans/2026-04-04-openspec-closure-repo-extraction-plan.md`. Ready to execute?
