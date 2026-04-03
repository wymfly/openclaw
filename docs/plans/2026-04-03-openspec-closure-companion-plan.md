# OpenSpec Closure Companion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 OpenSpec + superpowers 工作流建立一个 portable-first 的 closure companion，让 change 能在 archive 前通过 `spec -> plan -> verification -> readiness` 的 scenario 级闭环检查，而不依赖修改 upstream workflow 文件。

**Architecture:** 分两段推进。第一段实现独立的 closure companion 核心：scenario inventory、plan coverage 解析、verification artifact、gap taxonomy、`init/check/report` 命令。第二段只做当前仓库的薄适配与试点：增加 `.openspec-closure.yaml`、package script、文档，并选一个 active change 作为 pilot，验证这套协议在真实 change 上能得到稳定的 closure report。

**Tech Stack:** TypeScript, commander, YAML, Vitest, OpenSpec change artifacts

**OpenSpec:** `openspec/changes/openspec-closure-companion/` — 3 specs, 6 requirements, 12 scenarios

---

## File Structure

### New Files

| File                                                            | Responsibility                                                                                           |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `scripts/openspec-closure.ts`                                   | Standalone companion CLI entrypoint with `init`, `check`, and `report` subcommands                       |
| `scripts/lib/openspec-closure/types.ts`                         | Shared types for `scenario_id`, verification entries, gap taxonomy, and check results                    |
| `scripts/lib/openspec-closure/config.ts`                        | Project adapter config loader for `.openspec-closure.yaml`                                               |
| `scripts/lib/openspec-closure/spec-inventory.ts`                | Parse OpenSpec spec files into active scenario inventory keyed by `scenario_id`                          |
| `scripts/lib/openspec-closure/plan-coverage.ts`                 | Parse plan files for machine-checkable scenario ownership mappings (`covers.id` or equivalent)           |
| `scripts/lib/openspec-closure/verification-artifact.ts`         | Read/write/validate `verification.yaml` entries                                                          |
| `scripts/lib/openspec-closure/checker.ts`                       | Join spec inventory, plan coverage, and verification state into gap reports and `archiveReady`           |
| `scripts/lib/openspec-closure/report.ts`                        | Render human-readable and machine-readable closure output                                                |
| `test/scripts/openspec-closure.test.ts`                         | Fixture-driven tests for inventory parsing, coverage mapping, verification state, and zero-gap readiness |
| `test/fixtures/openspec-closure/valid-change/**`                | Happy-path fixture corpus with scenario IDs, coverage mappings, and closed verification entries          |
| `test/fixtures/openspec-closure/gap-change/**`                  | Negative fixtures for missing mapping, missing verification, and `spec-fix-required` states              |
| `.openspec-closure.yaml`                                        | Current repo’s thin adapter config for plan discovery, verification path defaults, and readiness policy  |
| `openspec/changes/deck-chat-message-contract/verification.yaml` | Pilot verification artifact generated from the active scenario inventory                                 |
| `docs/reference/openspec-closure-companion.md`                  | Portable protocol and installation guide for other OpenSpec + superpowers projects                       |

### Modified Files

| File                                                                                      | Change                                                                                              |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `package.json`                                                                            | Add `openspec:closure:init`, `openspec:closure:check`, and `openspec:closure:report` scripts        |
| `openspec/changes/deck-chat-message-contract/specs/chat-message-contract/spec.md`         | Add stable `scenario_id` entries for the pilot change                                               |
| `openspec/changes/deck-chat-message-contract/specs/chat-session-sync/spec.md`             | Add stable `scenario_id` entries for the pilot change                                               |
| `openspec/changes/deck-chat-message-contract/specs/transcript-rendering-contract/spec.md` | Add stable `scenario_id` entries for the pilot change                                               |
| `docs/plans/2026-04-03-deck-chat-message-contract-plan.md`                                | Add machine-checkable scenario ownership mappings alongside existing human-readable `covers:` lines |

---

## Chunk 1: Companion Core

### Task 1: Implement scenario inventory and verification artifact primitives

**Files:**

- Create: `scripts/lib/openspec-closure/types.ts`
- Create: `scripts/lib/openspec-closure/spec-inventory.ts`
- Create: `scripts/lib/openspec-closure/verification-artifact.ts`
- Create: `test/scripts/openspec-closure.test.ts`
- Create: `test/fixtures/openspec-closure/valid-change/**`
- Create: `test/fixtures/openspec-closure/gap-change/**`

**covers:** `scenario-traceability/spec.md > ADDED > Active spec scenarios SHALL expose stable scenario identities > "New scenario receives a stable identifier"`
**covers:** `scenario-traceability/spec.md > ADDED > Active spec scenarios SHALL expose stable scenario identities > "Semantically unchanged scenario keeps its identifier"`
**covers:** `verification-artifact/spec.md > ADDED > Each change SHALL maintain a machine-readable verification artifact > "Verification artifact initializes from scenario inventory"`
**covers:** `verification-artifact/spec.md > ADDED > Each change SHALL maintain a machine-readable verification artifact > "Verification entry records owner and evidence"`

- [ ] **Step 1.1: 先写 fixture-driven 失败测试**
      在 `test/scripts/openspec-closure.test.ts` 先覆盖：- spec parser 只枚举 ADDED / MODIFIED scenarios，并要求稳定 `scenario_id` - wording-only 改动不会破坏同一个 `scenario_id` 的 join 语义 - `verification.yaml` 初始化时会为每个 active scenario 建 entry - verification entry 能读写 owner、command、evidence、status

- [ ] **Step 1.2: 实现 inventory 与 verification primitive**
      在 `types.ts`、`spec-inventory.ts`、`verification-artifact.ts` 中定义最小稳定接口。参考实现约定：- spec 中用显式 `scenario_id` 字段，不靠标题字符串 - verification artifact 的 canonical 形态用 YAML - 状态枚举至少包含 `pending`、`verified`、`blocked`、`spec-fix-required`

- [ ] **Step 1.3: 跑定向测试**

```bash
pnpm test -- test/scripts/openspec-closure.test.ts
```

- [ ] **Step 1.4: Commit**

```bash
scripts/committer "[enhanced] feat(openspec): add closure scenario inventory primitives" \
  scripts/lib/openspec-closure/types.ts \
  scripts/lib/openspec-closure/spec-inventory.ts \
  scripts/lib/openspec-closure/verification-artifact.ts \
  test/scripts/openspec-closure.test.ts \
  test/fixtures/openspec-closure/valid-change \
  test/fixtures/openspec-closure/gap-change
```

### Task 2: Implement plan coverage parsing, gap taxonomy, and closure CLI

**Files:**

- Create: `scripts/openspec-closure.ts`
- Create: `scripts/lib/openspec-closure/config.ts`
- Create: `scripts/lib/openspec-closure/plan-coverage.ts`
- Create: `scripts/lib/openspec-closure/checker.ts`
- Create: `scripts/lib/openspec-closure/report.ts`
- Modify: `test/scripts/openspec-closure.test.ts`

**covers:** `scenario-traceability/spec.md > ADDED > Plans SHALL map scenario identities to implementation ownership > "Every active scenario is mapped to at least one task"`
**covers:** `scenario-traceability/spec.md > ADDED > Plans SHALL map scenario identities to implementation ownership > "Coverage matrix enumerates scenario-level ownership"`
**covers:** `closure-check/spec.md > ADDED > A closure companion SHALL detect open gaps across specs, plans, and verification state > "Missing plan mapping is reported as an open gap"`
**covers:** `closure-check/spec.md > ADDED > A closure companion SHALL detect open gaps across specs, plans, and verification state > "Non-closed verification state blocks readiness"`
**covers:** `closure-check/spec.md > ADDED > The closure companion SHALL remain project-portable through a thin adapter layer > "Zero-gap changes report archive readiness"`

- [ ] **Step 2.1: 先扩失败测试到闭环层**
      在 `test/scripts/openspec-closure.test.ts` 新增：- plan parser 能从 machine-checkable mapping 中读出 `scenario_id -> task` - `check` 会把 missing mapping、missing verification、`spec-fix-required`、`pending` 归成 open gaps - zero-gap fixture 会得到 `archiveReady: true` - `report` 能输出人类可读摘要和 JSON 结果

- [ ] **Step 2.2: 实现 closure core 与 CLI**
      用 `commander` 在 `scripts/openspec-closure.ts` 实现：- `init --change <name>` - `check --change <name> [--format json]` - `report --change <name>`
      `plan-coverage.ts` 负责解析新增的 machine-checkable 映射语法；参考实现先采用增量约定 `covers.id: <scenario_id>`，保留现有人类可读 `covers:` 不变。

- [ ] **Step 2.3: 实现 project adapter config**
      在 `config.ts` 支持 `.openspec-closure.yaml`，最小字段只包括：- plan discovery glob - verification artifact default path - readiness strictness（哪些状态阻塞 archive-ready）
      不要把 OpenClaw 的路径结构硬编码进 checker。

- [ ] **Step 2.4: 跑脚本测试**

```bash
pnpm test -- test/scripts/openspec-closure.test.ts
node --import tsx scripts/openspec-closure.ts check --change openspec-closure-companion --format json
```

- [ ] **Step 2.5: Commit**

```bash
scripts/committer "[enhanced] feat(openspec): add closure companion checker and cli" \
  scripts/openspec-closure.ts \
  scripts/lib/openspec-closure/config.ts \
  scripts/lib/openspec-closure/plan-coverage.ts \
  scripts/lib/openspec-closure/checker.ts \
  scripts/lib/openspec-closure/report.ts \
  test/scripts/openspec-closure.test.ts
```

---

## Chunk 2: Reference Adapter And Pilot

### Task 3: Add the current repo’s thin adapter and reusable docs

**Files:**

- Create: `.openspec-closure.yaml`
- Create: `docs/reference/openspec-closure-companion.md`
- Modify: `package.json`

**covers:** `closure-check/spec.md > ADDED > The closure companion SHALL remain project-portable through a thin adapter layer > "Project-specific paths are resolved through adapter config"`

- [ ] **Step 3.1: 先写 adapter/documentation 失败测试或 smoke expectations**
      把 `test/scripts/openspec-closure.test.ts` 扩到 repo config smoke：- 当前 repo 能通过 `.openspec-closure.yaml` 发现 `docs/plans/` 下的 plan - `package.json` script 能无 wrapper patch 地调用 companion CLI

- [ ] **Step 3.2: 写当前仓库的薄适配**
      在 `.openspec-closure.yaml` 中只声明当前 repo 的路径与策略，不复制 core 逻辑；在 `package.json` 中新增：- `openspec:closure:init` - `openspec:closure:check` - `openspec:closure:report`

- [ ] **Step 3.3: 写可移植文档**
      在 `docs/reference/openspec-closure-companion.md` 说明：- companion 的标准层输入输出 - 如何在其他 OpenSpec + superpowers 项目里只通过薄配置接入 - 推荐生命周期：`propose -> plan -> apply -> closure check -> archive`
      文档要明确“不修改 upstream workflow 文件”。

- [ ] **Step 3.4: 跑 smoke 验证**

```bash
pnpm test -- test/scripts/openspec-closure.test.ts
pnpm openspec:closure:report -- --change openspec-closure-companion
```

- [ ] **Step 3.5: Commit**

```bash
scripts/committer "[enhanced] docs(openspec): add closure companion adapter and usage" \
  .openspec-closure.yaml \
  docs/reference/openspec-closure-companion.md \
  package.json \
  test/scripts/openspec-closure.test.ts
```

### Task 4: Pilot the protocol on `deck-chat-message-contract`

**Files:**

- Modify: `openspec/changes/deck-chat-message-contract/specs/chat-message-contract/spec.md`
- Modify: `openspec/changes/deck-chat-message-contract/specs/chat-session-sync/spec.md`
- Modify: `openspec/changes/deck-chat-message-contract/specs/transcript-rendering-contract/spec.md`
- Modify: `docs/plans/2026-04-03-deck-chat-message-contract-plan.md`
- Create: `openspec/changes/deck-chat-message-contract/verification.yaml`

**covers:** `verification-artifact/spec.md > ADDED > Verification statuses SHALL distinguish implementation gaps from specification gaps > "Spec contradiction is recorded explicitly"`
**covers:** `verification-artifact/spec.md > ADDED > Verification statuses SHALL distinguish implementation gaps from specification gaps > "Deferred verification carries explicit rationale"`
**covers:** `closure-check/spec.md > ADDED > The closure companion SHALL remain project-portable through a thin adapter layer > "Zero-gap changes report archive readiness"`

- [ ] **Step 4.1: 给 pilot change 补稳定 `scenario_id`**
      在 `deck-chat-message-contract` 的 3 份 spec 中给每个 ADDED / MODIFIED scenario 加显式 `scenario_id`。格式在当前仓库里固定为易读、可解析的 markdown 字段，不要把 ID 藏在注释里。

- [ ] **Step 4.2: 给 pilot plan 补 machine-checkable ownership**
      在 `docs/plans/2026-04-03-deck-chat-message-contract-plan.md` 保留现有人类可读 `covers:`，并额外增加 `covers.id:` 行，把每个 scenario_id 绑定到至少一个 task。

- [ ] **Step 4.3: 初始化 pilot verification artifact**
      用 `openspec:closure:init` 或等效路径生成 `openspec/changes/deck-chat-message-contract/verification.yaml` 初稿。初始状态允许是 `pending`，但要包含 owner task、默认验证命令位置和显式状态字段。

- [ ] **Step 4.4: 运行 closure pilot**
      运行 `check` / `report`，确认 pilot 的 gap report 与人工预期一致；如果因为 change 尚未实现而得到 open gaps，这是预期结果，但输出必须稳定、可读、可机读。

```bash
pnpm openspec:closure:init -- --change deck-chat-message-contract
pnpm openspec:closure:check -- --change deck-chat-message-contract --format json
pnpm openspec:closure:report -- --change deck-chat-message-contract
```

- [ ] **Step 4.5: Commit**

```bash
scripts/committer "[enhanced] chore(openspec): pilot closure protocol on deck chat message contract" \
  openspec/changes/deck-chat-message-contract/specs/chat-message-contract/spec.md \
  openspec/changes/deck-chat-message-contract/specs/chat-session-sync/spec.md \
  openspec/changes/deck-chat-message-contract/specs/transcript-rendering-contract/spec.md \
  docs/plans/2026-04-03-deck-chat-message-contract-plan.md \
  openspec/changes/deck-chat-message-contract/verification.yaml
```

### Task 5: Validate the full closure workflow and document adoption boundaries

**Files:**

- Modify: `docs/reference/openspec-closure-companion.md`
- Modify: `test/scripts/openspec-closure.test.ts`

**covers:** All remaining scenarios that require integrated closure lifecycle validation

- [ ] **Step 5.1: 补全 lifecycle 验证用例**
      在 `test/scripts/openspec-closure.test.ts` 增加端到端 fixture：- `init -> check -> report` 正常流 - open gap 时 `archiveReady: false` - zero-gap fixture 时 `archiveReady: true` - adapter config 改路径后 companion 仍正常工作

- [ ] **Step 5.2: 补文档边界**
      在 `docs/reference/openspec-closure-companion.md` 明确：- companion 解决的是 traceability / readiness，不替代测试质量审查 - current repo 只是 reference adapter - 其他项目只需 companion + config，不需要 patch OpenSpec / superpowers 本体

- [ ] **Step 5.3: 跑完整验证**

```bash
openspec validate openspec-closure-companion --strict
pnpm test -- test/scripts/openspec-closure.test.ts
pnpm openspec:closure:check -- --change deck-chat-message-contract --format json
pnpm check
```

- [ ] **Step 5.4: Commit**

```bash
scripts/committer "[enhanced] test(openspec): validate closure companion lifecycle" \
  docs/reference/openspec-closure-companion.md \
  test/scripts/openspec-closure.test.ts
```

---

## Requirement Coverage Matrix

| Spec Requirement                                                                                            | Scenario                                                   | Task       |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------- |
| scenario-traceability > Active spec scenarios SHALL expose stable scenario identities                       | New scenario receives a stable identifier                  | T1, T4     |
| scenario-traceability > Active spec scenarios SHALL expose stable scenario identities                       | Semantically unchanged scenario keeps its identifier       | T1         |
| scenario-traceability > Plans SHALL map scenario identities to implementation ownership                     | Every active scenario is mapped to at least one task       | T2, T4     |
| scenario-traceability > Plans SHALL map scenario identities to implementation ownership                     | Coverage matrix enumerates scenario-level ownership        | T2, T4     |
| verification-artifact > Each change SHALL maintain a machine-readable verification artifact                 | Verification artifact initializes from scenario inventory  | T1, T4     |
| verification-artifact > Each change SHALL maintain a machine-readable verification artifact                 | Verification entry records owner and evidence              | T1, T4     |
| verification-artifact > Verification statuses SHALL distinguish implementation gaps from specification gaps | Spec contradiction is recorded explicitly                  | T4         |
| verification-artifact > Verification statuses SHALL distinguish implementation gaps from specification gaps | Deferred verification carries explicit rationale           | T4         |
| closure-check > A closure companion SHALL detect open gaps across specs, plans, and verification state      | Missing plan mapping is reported as an open gap            | T2, T5     |
| closure-check > A closure companion SHALL detect open gaps across specs, plans, and verification state      | Non-closed verification state blocks readiness             | T2, T5     |
| closure-check > The closure companion SHALL remain project-portable through a thin adapter layer            | Project-specific paths are resolved through adapter config | T2, T3, T5 |
| closure-check > The closure companion SHALL remain project-portable through a thin adapter layer            | Zero-gap changes report archive readiness                  | T2, T4, T5 |
