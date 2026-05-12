# Openclaw / deck-go Realignment Plan

> **v2 — rewritten 2026-05-12**. Pivots from generic "Matt-template phases"
> to **two concrete goals** the next session must execute. Phase 1 (CONTEXT.md
> bootstrap) is done — see `./CONTEXT.md`. The rest of this plan is the
> handoff package for a fresh session.
>
> **Owner**: wangym (solo dev) | **Status**: Phase 1 ✅ done; Phase 2 ready

---

## TL;DR for the next session

1. **Read** `./CONTEXT.md` (348 lines) and this whole file before doing
   anything.
2. **Execute Goal 1** (Phase 2): backup → audit → rewrite `AGENTS.md` to
   ≤ 200 lines + add the Skill Routing section from Appendix A.
3. **Execute Goal 2** (Phases 3–7): use the 4 Matt skills + superpowers
   - openspec to systematically realign each core module of the project,
     starting with `chat`.
4. **Update the Progress Tracker** at the bottom of this file at every
   phase boundary.
5. **Add Lessons Learned** to Appendix C whenever you discover a new
   failure mode.

---

## Why this exists（精简版诊断）

deck-go 反复对齐对不齐，`deck-go/.local/` 累积 100+ remediation 目录。根因：

1. **缺 CONTEXT.md** — 项目核心术语没有 single source of truth；agent 每次
   从 553 行 AGENTS.md 拼凑理解，每次拼凑略偏差 → 100+ remediation
2. **横向切片** — 每个模块单独跑 prototype → mock-visual → parity-report →
   real-e2e；模块间契约从未在最小端到端 vertical slice 里先验证
3. **brainstorming 被绑死成 OpenSpec 仪式** — 用户不是设计专家，一次性答不出
   17 个维度 → "形式上 done，没真对齐" → implementation 阶段才发现，又跑
   remediation

完整诊断和教训：见 Appendix C.

---

## What's done — Phase 1 完成产物

✅ `./CONTEXT.md` (348 行)

- 4 个 Core entities: OpenClaw / Gateway / deck-go / runtime（狭义+广义）
- 2 个 Design Rules:
  - **R1**: 新增 deck.\* RPC 的 mini-grill 协作 protocol
  - **R2**: control 端 mode-agnostic + remote-only 前向兼容
- 3 个 Flagged ambiguities:
  - A1 ✅ Resolved (4 层扩展边界规则)
  - A2 ⏸ Pending Phase 3 (chat 全控制 surface)
  - A3 ⏸ Pending Phase 4/Goal 2 (bundled 模式存废)
- 9 核心模块 + 17 边缘模块 优先级
- Phase 5 vertical slice 强候选 = chat 端到端

✅ `./.claude/skills/{grill-with-docs,prototype,diagnose,improve-codebase-architecture}/`
— 4 个 Matt skill 已 symlink 到项目级 skill 目录

---

## 🎯 Goal 1 — AGENTS.md 改造（= Phase 2）

**目的**: 把当前 553 行 AGENTS.md 真正梳理清楚 + 融合 Skill 运用方案，让
agent 以后能正确触发 skill。

### Concrete Steps

#### Step 1.1 — Backup

```bash
cd /Users/wangym/workspace/agents/openclaw
cp AGENTS.md AGENTS-backup-2026-05-12.md
git add AGENTS-backup-2026-05-12.md
git commit -m "[realignment] backup AGENTS.md before rewrite"
```

#### Step 1.2 — Audit existing AGENTS.md by category

按 Appendix B 的判断准则把现有 553 行内容分到三桶:

| 桶              | 含义                                                 | 处理                                   |
| --------------- | ---------------------------------------------------- | -------------------------------------- |
| **Keep**        | Build/Test commands, 操作 SOP, 机器可校验规则        | 原样保留，可能精简措辞                 |
| **Externalize** | 长流程规则 (OpenSpec 闭环, 验收矩阵, 反思规则)       | 移到独立 `.md`，AGENTS.md 只 link      |
| **Replace**     | "OpenClaw / Gateway / runtime / deck.\* / mode" 散文 | 替换为 `> 见 ./CONTEXT.md "<节>"` 引用 |

#### Step 1.3 — Rewrite AGENTS.md

按下述结构重写：

```markdown
# Repository Guidelines

> 术语权威源: ./CONTEXT.md
> 当前演进路线图: ./REALIGNMENT.md
> 详细历史规则备份: ./AGENTS-backup-2026-05-12.md

## Agent Skill Routing

[复制 Appendix A 全部内容]

## Project Structure

[保留原 "Project Structure" 节，但术语用 CONTEXT.md 引用替换散文]

## Architecture Boundaries

[保留原 "Architecture Boundaries" 节，加一行 "> 详细术语见 CONTEXT.md"]

## Build, Test, and Development Commands

[原样保留]

## Drift Detection / Type Triage

[原样保留]

## TypeScript Coding Style

[原样保留]

## Commit & PR Guidelines

[原样保留]

## Security & Multi-agent Safety

[原样保留]

## OpenSpec workflow

[精简到一段，link to ./openspec/AGENTS.md or details elsewhere]

## Verification matrix

[精简到一段，link to ./deck-go/docs/verification-matrix.md or similar]

## 二次开发主目标

[保留原 "二次开发主目标" 节]

## Enhanced Fork — 上游同步流程

[保留原 "Enhanced Fork" 节 — 这是关键的操作 SOP]
```

#### Step 1.4 — Externalize the heavy process docs

把以下从 AGENTS.md 移出去（如果它们没自己的家就新建）:

- `OpenSpec 前置头脑风暴规则` (17 维度) → `./openspec/AGENTS.md` 或新建
  `./docs/process/openspec-brainstorm-checklist.md`
- `OpenSpec 完成闭环规则` → `./docs/process/openspec-closure.md`
- `通用验收标准矩阵` (11 维度) → `./deck-go/docs/verification-matrix.md`
- `流程缺陷反思规则` → `./docs/process/process-defect-reflection.md`

每个新文件的内容 = 直接从 backup 拷贝。AGENTS.md 在对应位置只放：

```markdown
## OpenSpec workflow

For OpenSpec brainstorm checklist, closure rules, and program-level
discipline, see ./docs/process/openspec-\*.md.
```

#### Step 1.5 — Verify

```bash
# 1. New AGENTS.md is short
[ "$(wc -l < AGENTS.md)" -le 200 ] && echo "✅ ≤ 200 lines" || echo "❌"

# 2. Backup exists and is the original
diff AGENTS-backup-2026-05-12.md /dev/null  # should not be empty
[ "$(wc -l < AGENTS-backup-2026-05-12.md)" -ge 500 ] && echo "✅ backup intact" || echo "❌"

# 3. Skill Routing section present
grep -q "## Agent Skill Routing" AGENTS.md && echo "✅ skill routing present" || echo "❌"

# 4. CONTEXT.md is referenced
[ "$(grep -c 'CONTEXT.md' AGENTS.md)" -ge 3 ] && echo "✅ CONTEXT.md referenced" || echo "❌"

# 5. R1/R2 are referenced
grep -E "Rule R1|Rule R2" AGENTS.md && echo "✅ R1/R2 referenced" || echo "❌"
```

### Acceptance for Goal 1

- 全部 5 个 verify check 通过
- 在 openclaw 项目开个 fresh `claude` session, 抛一个简单测试 prompt
  (例如 "我想加一个新 deck.\* RPC 显示 chat session 的最近 10 条消息"),
  观察 agent 是否：
  - 主动 read CONTEXT.md (能引用术语)
  - 主动按 R1 协作 protocol mini-grill (问类型 1/2/3)
  - 主动 invoke `superpowers:brainstorming`
  - 不会自己开始写代码

通过则 Goal 1 ✅，进入 Goal 2.

---

## 🎯 Goal 2 — 项目上下文系统性修正（= Phases 3–7）

**目的**: 用 4 个 Matt skill + superpowers + openspec 把 9 核心模块的契约 /
模块边界 / control surface 修正到 ground truth, `.local/*-remediation-*`
新增数量回到健康基线 (≤ 1 / module).

### Phase 3 — Audit chat 当前 control surface

**Why audit not prototype**: 项目代码已经存在，prototype 是重复造。先把
**现有事实**梳理出来，再决定要不要补 prototype.

**Steps**:

1. Read `src/gateway/server-methods/chat*.ts`
2. Read `src/gateway/server-methods/deck/chat*` (if exists)
3. Read `deck-go/contracts/source/deck-*.contract.json` (focus chat-related)
4. Read `deck-go/backend/internal/...` for chat path
5. Read `frontend-new/src/components/panels/chat/...`
6. Cross-reference with `deck-go/.local/chat-*` remediation history

**Output**: `./docs/realignment/chat-surface-inventory.md` containing:

- 当前 chat 暴露的 RPC 全集 (含通用 chat._ + deck.chat._)
- 每个方法的 input / output shape
- 调用链 (frontend → BFF → Gateway → kernel)
- 从 `.local/chat-*` remediation 历史推断的"已知痛点"

**Skill**: 不需要 — 是 audit 任务，直接读 + 写文档.

**Entry**: Goal 1 done.
**Exit**: chat-surface-inventory.md committed; user has reviewed and said
"这就是事实，可以进 Phase 4".

---

### Phase 4 — chat 端到端 brainstorming

**Skill**: `superpowers:brainstorming`.

**Strict scope**: "chat 端到端的目标 surface 应该是什么？哪条最小 vertical
slice 验证整套契约链？"

**Discipline**:

- ❌ 不要走原 AGENTS.md 第 65-108 行那 17 个维度（已经在 Goal 1 externalize
  到 openspec docs）
- ✅ 用 `./CONTEXT.md` 作术语权威
- ✅ 应用 R1 (deck.\* protocol) + R2 (mode-agnostic) 当 propose 任何契约改动
- ✅ 引用 chat-surface-inventory.md 作为现状基线

**Output**: `docs/superpowers/specs/YYYY-MM-DD-chat-control-design.md`
回答 3 个问题：

1. chat control surface 怎么分层（read / write / stream / action 各占哪些）
2. 模块间契约的"权威源"是谁（deck contracts / Gateway protocol / 混合）
3. 哪一个**最小** vertical slice 能锁死整个契约链

**Entry**: Phase 3 done (audit available).
**Exit**: design doc approved by user; vertical slice 候选锁定.

---

### Phase 5 — chat vertical slice 实现

**Skill chain**:

```
superpowers:using-git-worktrees
  → superpowers:writing-plans
  → superpowers:subagent-driven-development
      ↳ each task internally:
          superpowers:test-driven-development
          superpowers:verification-before-completion
  → superpowers:requesting-code-review
  → superpowers:finishing-a-development-branch
```

**Scope**: 严格只做 Phase 4 选定的那条最小 vertical slice. **禁止**顺手把
其他模块的契约对齐进来——它们留着 Phase 6.

**Entry**: Phase 4 design merged.
**Exit**:

- vertical slice merged to `enhanced` branch
- real-stack E2E (`make e2e-real-module MODULE=chat` or similar) 覆盖 the flow
- 沿途契约（前端 DTO / BFF DTO / Gateway protocol）一致

---

### Phase 6 — 8 个剩余核心模块逐个展开

**Order** (按 CONTEXT.md Module priorities):
chat (Phase 5) → agents → sessions → subagents → channels → plugins →
models → memory → skills

**Per-module skill chain**: same as Phase 5.

**For any new `deck.*` RPC**: follow R1 mini-grill protocol（写在 AGENTS.md
新版的 Hard Rule 里, 不会忘）

**Discipline**:

- 每个模块开发前必读 `./CONTEXT.md`
- 每个模块的契约必须**引用** Phase 5 锁定的契约权威源, 不得自定义
- 任何与 R2 冲突的代码（mode-aware）拒绝合入, 标 `// TODO(A3)`

**Entry**: Phase 5 merged.
**Exit**:

- 9 核心模块全部走完
- 新增 `.local/*-remediation-*` 数量 ≤ 1 per module（健康基线）
- A3 (bundled 模式存废) 在某个 module 期间 surface 决策点 → 用户 decide

---

### Phase 7 — 周期性 improve-codebase-architecture

**Skill**: `improve-codebase-architecture`.

**Cadence**: 每完成 5 个 Phase 6 模块跑一次.

**Output**: refactor candidate list (Files / Problem / Solution / Benefits).
用户挑 0-2 个真正深化, 走标准 vertical slice 流程实现.

---

## Appendix A — New AGENTS.md "Agent Skill Routing" Section

> **直接复制下方分隔线之间的内容到新 AGENTS.md 顶部**.

---

## Agent Skill Routing

> **必读**: `./CONTEXT.md`（术语权威 + R1/R2 设计规则）+
> `./REALIGNMENT.md`（项目演进路线图）。任何代码改动用术语前先查 CONTEXT.md.

### Hard Rules（横切，跨所有任务，不许跳）

1. **Before any "creative" work**（新功能、新组件、新 RPC 方法、架构改动）:
   先 invoke `superpowers:brainstorming`. **不要**写代码 / scaffold 项目，
   直到 user 明确 approve 一份 design doc.

2. **Before adding any new `deck.*` RPC method**: follow Rule R1
   (`./CONTEXT.md` "Design rules") 协作 protocol — mini-grill user about:
   - 类型 1（包装通用 RPC）/ 2（暴露内核未公开能力）/ 3（纯 deck 产品逻辑）
   - 类型 2: 列出碰到的内核能力 + 上游近期改动频率
   - 类型 3: 列出"放 deck-go BFF" 的替代方案

3. **Before claiming any work "done" / "fixed" / "passing"**: invoke
   `superpowers:verification-before-completion` 并跑真实命令.
   只接受 "我跑了 X 看到 Y", 不接受 "should pass" / "looks correct" /
   "I'm confident".

4. **Before writing production code** (新 behavior / bug fix): invoke
   `superpowers:test-driven-development`. Failing test first, watch it fail,
   then implement.

5. **Before executing multi-task plan**: invoke
   `superpowers:using-git-worktrees` for isolation.

6. **CONTEXT.md 是术语权威**. 用任何 "OpenClaw / Gateway / runtime /
   control / deck-go / bundled / remote" 等术语前先读. 发现矛盾立即 surface,
   不要拼凑理解.

7. **Mode-agnostic 强约束 (Rule R2)**: deck-go BFF 之上的代码 (`contracts/`
   / `frontend-new/` / control 业务逻辑) **不得**根据 `RUNTIME_MODE` 走分支.
   任何 bundled-only 行为标 `// TODO(A3)`.

### Triggers (user intent → skill chain)

Match the FIRST row that applies.

| Situation                                                    | Skill chain                                                                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 新 feature / 组件 / RPC 方法                                 | `superpowers:brainstorming` → `superpowers:writing-plans` → 执行链                                             |
| 新 `deck.*` RPC method (一定要触发上一行 + R1 协作 protocol) | brainstorming 期间执行 R1 mini-grill                                                                           |
| 架构级改动 (跨 3+ 模块, 新接口契约, 新系统模式)              | `openspec-workflow` (`/opsx:propose`) → `superpowers:writing-plans` → 执行链                                   |
| Bug, test failure, 性能回归                                  | `diagnose` (preferred) → `superpowers:test-driven-development` (回归测试) → verify                             |
| "我也不知道哪个对" / 状态机 / UI 不确定                      | `prototype` (logic 分支 / UI 分支). **注意**: 已有大量代码的模块通常先 audit existing code, 不是从零 prototype |
| 代码乱了 / 周期 architecture 检查                            | `improve-codebase-architecture`                                                                                |
| 术语不清 / 引入新概念                                        | 查 `./CONTEXT.md`. 缺/矛盾就 invoke `grill-with-docs` 当场加                                                   |
| 长 session / handoff                                         | 更新 `./REALIGNMENT.md` Progress Tracker + 写 handoff 文档                                                     |

### Execution chain (the standard implement-the-plan flow)

After `writing-plans` produces a plan:

```
superpowers:using-git-worktrees       # isolate
  → superpowers:subagent-driven-development  # fresh subagent per task
      ↳ each task internally:
          superpowers:test-driven-development
          superpowers:verification-before-completion
  → superpowers:requesting-code-review
  → superpowers:finishing-a-development-branch
```

**Always prefer `subagent-driven-development` over `executing-plans`** —
fresh subagent per task 避免 context 稀释 & self-rationalization.

### Skill Conflict Resolution

- **Process > Implementation**: `brainstorming` 和 `diagnose` 在任何
  implementation skill 之前
- **`superpowers:brainstorming` 是"对齐" skill 的唯一选择** —
  `grill-with-docs` 仅用于 `./CONTEXT.md` 更新，不用于一般任务对齐
- **`diagnose` (Matt) > `superpowers:systematic-debugging`** for any debugging
- **`openspec-workflow` precedes `writing-plans`** 仅在架构级改动；普通功能
  直接 brainstorming → writing-plans, 不进 openspec

### Skills NOT Used in This Project

- `to-prd`, `to-issues`, `triage`, `setup-matt-pocock-skills` — solo dev,
  GitHub Issues 直接通过 `gh` CLI 创建; specs/plans 在 repo 内
- `executing-plans` — superseded by `subagent-driven-development`
- `grill-me` — superseded by `superpowers:brainstorming` for tasks; use
  `grill-with-docs` for CONTEXT.md updates
- `tdd` (Matt's) — superseded by `superpowers:test-driven-development`
  (stricter Iron Law)

### Project Context — paths

- Domain glossary (term authority): `./CONTEXT.md`
- Realignment plan (current phase + handoff): `./REALIGNMENT.md`
- Detailed AGENTS backup (pre-rewrite): `./AGENTS-backup-2026-05-12.md`
- ADRs: `./docs/adr/NNNN-*.md`
- OpenSpec changes: `./openspec/changes/<change-name>/`
- Specs (from brainstorming): `./docs/superpowers/specs/YYYY-MM-DD-*.md`
- Plans (from writing-plans): `./docs/superpowers/plans/YYYY-MM-DD-*.md`
- deck-go-specific guidance: `./deck-go/AGENTS.md`
- Externalized process docs: `./docs/process/*.md` and
  `./deck-go/docs/verification-matrix.md`

### Anti-Patterns (you'll be tempted — don't)

- 跳过 `brainstorming` 因为请求"看起来简单" — every project goes through alignment
- 声明 done 后才跑测试 — `verification-before-completion` 非协商
- 横向切片 (先所有 test, 再所有 impl) — 用 vertical slice
- 把 CONTEXT.md 当"用户维护"的文档 — 引入新概念时 inline 更新
- "Quick fix" without diagnosis — `diagnose` Phase 1 (建反馈环) 是真正的 debug
- 在 deck-go BFF 之上的代码引入 mode-aware 分支 — 违反 R2
- 加新 `deck.*` RPC 不走 R1 协作 protocol
- 忽略 `./REALIGNMENT.md` 的 phase 顺序 — 前 phase exit 不满足下一个不开
- 看到 `.local/<module>-remediation-*` 累积就再加一轮 — 应该回到 CONTEXT.md
  / R1/R2 找根因, 不是再 remediate

---

## Appendix B — AGENTS.md 改造判断准则

### 哪些保留（操作 SOP / 机器可校验）

- `Build, Test, and Development Commands`
- `Architecture Boundaries`（核心 import 边界规则）
- `二次开发主目标` (deck-go 是 mainline)
- `Enhanced Fork — 上游同步流程` (操作 SOP)
- `TypeScript Coding Style` (机器规则 + lint 配套)
- `Drift detection`, `Type error triage` (操作步骤)
- `Commit & PR Guidelines` (action-oriented)
- `Security & Multi-agent Safety`
- `Prompt Cache Stability`

### 哪些精简（移到独立 docs，AGENTS.md 只 link）

| 原 AGENTS.md 节                       | 移到哪里                                          |
| ------------------------------------- | ------------------------------------------------- |
| `OpenSpec 前置头脑风暴规则` (17 维度) | `./docs/process/openspec-brainstorm-checklist.md` |
| `OpenSpec 完成闭环规则`               | `./docs/process/openspec-closure.md`              |
| `通用验收标准矩阵` (11 维度)          | `./deck-go/docs/verification-matrix.md`           |
| `流程缺陷反思规则`                    | `./docs/process/process-defect-reflection.md`     |

每个 link 在 AGENTS.md 写成:

```markdown
## OpenSpec workflow

See ./docs/process/openspec-brainstorm-checklist.md and
./docs/process/openspec-closure.md.
```

### 哪些替换（用 CONTEXT.md 引用）

- 任何描述 OpenClaw / Gateway / deck-go / runtime / control 的散文 →
  `> 见 ./CONTEXT.md "Core entities"`
- 任何描述 `deck.*` 命名空间使用规则的散文 →
  `> 见 ./CONTEXT.md "Rule R1"`
- 任何描述 bundled vs remote 行为约束的散文 →
  `> 见 ./CONTEXT.md "Rule R2"`

### 哪些新增

- `Agent Skill Routing` 节 (Appendix A 全部内容)
- 顶部 "术语权威 / 路线图 / backup" 三行引用提示

### 哪些可能删除

- `Collaboration Notes` 中过细的 GitHub workflow 提示 (移到 PR 模板里更合适)
- 重复的 "Read only the guides directly relevant" 类的 meta-提示 (Skill
  Routing 节已经覆盖)

---

## Appendix C — Lessons Learned

### Lesson 1 — 项目级长寿命领域语言比短任务级 design doc 重要 10 倍

你已经装了 superpowers + OpenSpec + 自定义 skill, AGENTS.md 553 行, 但
缺最底层的 CONTEXT.md. 这是 100+ remediation 的**根因**.

**任何 skill / flow 都解决不了"术语没共识"的问题**. CONTEXT.md 是其他
所有规则的前提.

### Lesson 2 — 反 cargo-cult: 不要机械套用 phase 模板

原 REALIGNMENT.md v1 的 Phase 2 = "prototype 摸 control surface" 是机械
套用 Matt 工作流——但你项目反过来 (已有大量代码, 应该 audit).

**任何 phase 决策前先问**: "这个项目当前状态适合什么动作？"

- 还没代码 → prototype
- 已有大量代码 → audit
- 模块边界乱 → improve-codebase-architecture
- 术语不清 → grill-with-docs

### Lesson 3 — Skill 路由必须项目化

通用 skill 装好 ≠ agent 会用. AGENTS.md 必须含项目特化的"何时调何 skill"
routing 表 (即 Appendix A). 这就是 Goal 1 加 Skill Routing 节的原因.

### Lesson 4 — Audit 比 prototype 适合"已有代码"的项目

Matt 的 prototype 默认假设"还没代码". 已有代码的场景, prototype 是重复
造代码 + 偏离已有事实 + 制造新一轮契约不一致.

### Lesson 5 — 流程文档过载会让 agent 注意力分散

553 行 AGENTS.md, 11 维度验收, 17 维度 brainstorm checklist —— agent 每次
要"考虑"这么多, 容易变成"过程合规者"而不是"问题解决者". 这是大量
`*-remediation-final` / `*-remediation-real-e2e-diagnostic` 出现的次因.

**对策**: 流程文档分层 — `AGENTS.md` 顶层路由, 详细规则放独立文档按需 link.

### Lesson 6 — `.local/<module>-remediation-*` 累积是健康指标

任何模块的 remediation 数 > 2 应该触发反思: 是不是契约 / 术语 / 模块边界
有问题, 而不是再加一轮 remediation.

---

## Resume Protocol — for the next session

任何 future Claude/Codex session 接手 realignment 工作:

### 启动姿势

```bash
cd /Users/wangym/workspace/agents/openclaw
claude  # or codex
```

第一句对话:

```
请按 ./REALIGNMENT.md 推进 realignment 工作.
开始前必读: ./REALIGNMENT.md 全部 + ./CONTEXT.md 全部.
当前 status 见 Progress Tracker 节.
```

### 接手者必读

1. **本文件全部** — 理解 6 phase 的 entry/exit + Goal 1/2 的动作
2. **`./CONTEXT.md`** — 理解 4 entities + R1/R2 + 9 核心模块
3. **Progress Tracker 节** — 看停在哪
4. **不要自作主张跳 phase** — 前 phase exit criteria 没满足, 下一个 phase
   不开

### 接手者必做

- 在每次完成 phase exit 时**更新 Progress Tracker 表格**
- 在每次发现新 lesson 时 **append 到 Appendix C**
- 在每次执行 R1 协作 protocol 时**记录到 CONTEXT.md grill log**
- 在每次 phase 之间**git commit** with `[realignment] phase N: <summary>`
  prefix

### 接手者不做

- ❌ 不要修改 ./CONTEXT.md 的已 resolved entries (A1, R1, R2, 4 entities)
  除非用户明确说"那个错了"
- ❌ 不要重启已 done 的 phase (Phase 1)
- ❌ 不要在 Phase 2 没完成时进 Phase 3+
- ❌ 不要把 `to-prd / to-issues / triage` 等已禁用的 skill 拉回来
- ❌ 不要在 Audit (Phase 3) 阶段写代码

---

## Current Progress Tracker

| Phase | Goal                            | Status             | Owner                            | Next action                                                                                                                  |
| ----- | ------------------------------- | ------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1     | (Phase 1) CONTEXT.md bootstrap  | ✅ Done 2026-05-12 | Claude (proxied grill-with-docs) | CONTEXT.md committed                                                                                                         |
| 2     | **Goal 1**: AGENTS.md rewrite   | ✅ Done 2026-05-12 | Codex                            | Rewritten as long-lived project context + skill-routing standard; 旧 OpenSpec/验收矩阵/反思长规则只保留在 backup             |
| 3     | **Goal 2**: chat surface audit  | ✅ Done 2026-05-12 | Codex                            | `docs/realignment/chat-surface-inventory.md` written; awaiting user review before Phase 4                                    |
| 4     | **Goal 2**: chat brainstorming  | ✅ Done 2026-05-12 | Codex                            | `docs/superpowers/specs/2026-05-12-chat-control-reference-design.md` approved; chat is reference module, not presumed broken |
| 5     | **Goal 2**: chat vertical slice | ✅ Done 2026-05-12 | Codex                            | C1/C2/C3 fixed and verified with contract-gate + chat real Gateway E2E                                                       |
| 6     | **Goal 2**: 8 个剩余核心模块    | ⏸ Pending          | next session                     | Start Phase 6 with agents as the first module after user review                                                              |
| 7     | **Goal 2**: architecture review | ⏸ Pending          | next session                     | After Phase 6 ≥ 5 modules                                                                                                    |

### Cancelled phases (from v1)

- Old Phase 0 "减负 AGENTS.md as conditional" — **升格为 Goal 1 / Phase 2 必做**
- Old Phase 2 "prototype 摸 control surface" — **替换为 Phase 3 Audit** (理由见 Lesson 4)

### A2 / A3 expected resolution

- A2 ("全面控制" surface area): Phase 3 audit 给客观事实, Phase 4 brainstorm
  给目标 surface
- A3 (bundled 模式存废): Phase 6 某个模块期间 surface, 用户 decide
