# Codex 重构后系统性审查报告

| 字段         | 值                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **审查日期** | 2026-05-06                                                                                                                                                                       |
| **审查者**   | 设计 agent (Claude)                                                                                                                                                              |
| **审查触发** | 用户报告 codex 已经针对 23 个高保真原型完成第二轮 `frontend-new/` 重构，要求设计侧做系统性审查                                                                                   |
| **审查范围** | `deck-go/frontend-new/src/components/panels/*` (26 panel) + `frontend-new/src/design-system/*` + `frontend-new/src/components/shared/*` + `frontend-handoff/modules/*/README.md` |
| **协议版本** | `protocol-v1`（含 2026-05-06 "Prototype parity evidence rule" 增强）                                                                                                             |
| **最终判定** | **REVISE** — 21/26 panel 不符合 protocol-v1 闭环要求；6 项明文协议条款未通过                                                                                                     |

---

## TL;DR

第二轮 codex 重构在 i18n 抽取、测试存在性、design-system atom 复用、共享 store 接入这些方面比第一轮显著改善 ✅。但 protocol-v1 的 **6 项明文要求** 未通过，距离闭环还有 **3 个 wave 工作量（约 7-9 周）**，最关键的 blocker 是：

1. **反向签收覆盖率 5/26**（21 个 panel 完全缺失）
2. **README Status 行规范缺失或写法漂移**（15/26 缺，11/26 写法 4 种变体）
3. **三层 Prototype parity evidence 完全缺失**（0/26 提供 mock prototype parity 截图对照）
4. **Token 漂移**（chat / threads / usage 整套 legacy 命名空间，8 panel 单点漂移）
5. **a11y 测试 0/26**（违反 §2 第 7 步明文要求）
6. **12/26 panel 单文件全 inline**（违反 §"Translation rules"，丢失原型 multi-file 设计意图）

## Codex 交叉审查校正（2026-05-06）

本报告是有效的审查输入，但不是代码真相。Codex 在 OpenSpec change
`deck-go-frontend-verification-discipline` 中对本报告做了交叉审查，事实基线见
`frontend-handoff/audit/2026-05-06-codex-cross-review-fact-baseline.md`。

需要校正的结论：

| 原报告结论                                      | Codex 校正                                                                                                                                                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scripts/check-tokens-drift.sh` 不存在          | 错。脚本存在于 `deck-go/scripts/check-tokens-drift.sh`；真实问题是此前 scrollbar token 没同步到 handoff mirror，现已修复且 `bash scripts/check-tokens-drift.sh` 通过。                                                         |
| Prototype parity evidence 完全缺失 / 0/26       | 表述过重。`scripts/generate-prototype-parity-report.mjs` 和 `.local/*prototype-remediation-parity-report/` 已存在；真实问题是 `.local` 被 gitignore、部分 verdict 仍是 `unreviewed`，且 README 未结构化链接 tracked manifest。 |
| atom a11y 可能 0/74                             | 错。当前 atom 是 36 个，36 个 atom test 均 import `expectNoAxeViolations`；真实缺口是 panel-level a11y，初始为 1/26 classified。                                                                                               |
| 12 个单文件 panel 是硬性 Translation rules 违规 | 证据不足。当前协议未明确要求 prototype 内部 molecule 与生产文件一一对应；应分类为 maintainability follow-up，除非后续单独 OpenSpec 提案把某模块拆分列为硬要求。                                                                |

Codex 认可并纳入提案的 blocker：

- README `Status` canonical 化缺失。
- `Reverse sign-off` 结构化签收缺失/过弱。
- 11 个 panel 存在非 `--ds-*` token 引用，需要改名或 tracked exception。
- Panel-level a11y 需要覆盖或 tracked exception，不能用 atom axe 覆盖代替。
- `components/shared/lists/*` 目前 0 panel 使用，需要 adopt/remove/keep-experimental 分类。
- `.local` evidence 需要 tracked manifest 才能作为持久审计入口。

---

## 一、审查方法

| 步骤               | 动作                                                                                               | 用到的命令/工具                                  |
| ------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------- |
| 1. 范围确认        | 列出 26 panel 在 frontend-handoff/modules/ 与 frontend-new/src/components/panels/ 的对齐           | `ls`                                             |
| 2. 协议合规扫描    | grep `**Status**:` / `Reverse sign-off` 段；用 `git log` 找 codex 重构 commit 链                   | `grep -m1`, `git log --oneline -- frontend-new/` |
| 3. DS 抽取审计     | 检查 `design-system/atoms`/`molecules`/`patterns`/`tweaks` 目录与 `components/shared` 的实际复用率 | `ls`, `grep -rl`                                 |
| 4. Token 合规扫描  | 提取所有 `var(--*)` 引用，过滤非 `--ds-*` 命名空间                                                 | `grep -rEoh "var\(--[a-zA-Z0-9_-]+\)"`           |
| 5. i18n 完整度     | 对比 en/zh 行数 + 计数 useTranslations 引用                                                        | `wc -l`, `grep -rl`                              |
| 6. 测试覆盖扫描    | 计数 \*.test.tsx / vitest-axe / a11y 引用                                                          | `find -name "*.test.*"`, `grep -rl "vitest-axe"` |
| 7. 组件分解检查    | 计数每个 panel 的 `.tsx` (排除 `.test.tsx`) + `.css` 文件数                                        | `find -name "*.tsx" -not -name "*.test.tsx"`     |
| 8. 抽样深度审      | 抽取 routing 单文件 1500+ 行进行 component decomposition 审计；对比与原型的 6 件套 + 5 分子        | `head`, `grep -nE "^(function                    | const) [A-Z]"` |
| 9. 死代码识别      | `components/shared/lists/` 6 个 list 原语在 panel 中的引用次数                                     | `grep -rl`                                       |
| 10. 协议工具完整性 | 检查 `scripts/check-tokens-drift.sh` 等协议引用脚本是否存在                                        | `ls -la`                                         |

---

## 二、整体合规状态总表

| 维度                                                   | 26 panel 现状                                         | 协议要求                           | 通过率                             |
| ------------------------------------------------------ | ----------------------------------------------------- | ---------------------------------- | ---------------------------------- |
| Status 行（`implemented (sha <commit-sha>)`）          | 11 有 / 15 缺 / 4 种写法变体                          | canonical 格式                     | **0/26**                           |
| Reverse sign-off 段（"匹配 / 偏离的具体点"）           | 5 panel 有（皆为 1-2 句简表）/ 21 panel 缺            | 详细对照                           | **0/26**                           |
| 三层 Prototype parity evidence（mock + parity + real） | 0 panel 有完整三层                                    | 强制                               | **0/26**                           |
| Token 全部 `--ds-*`                                    | 15 合规 / 11 漂移                                     | 强制                               | **15/26**                          |
| a11y 测试（vitest-axe）                                | 0 panel                                               | atom 强制 + module 应该            | **0/26 panel + 0/74 atom（待审）** |
| Multi-file 组件分解（保留原型契约）                    | 14 合规 / 12 单文件 inline                            | 翻译机械化（§"Translation rules"） | **14/26**                          |
| i18n 抽取（无 hardcode 字符串）                        | 130 panel 文件用 useTranslations / 5757 条 en/zh 一致 | 强制                               | ✅ **基本达标**                    |
| 测试存在性（任意 .test.\*）                            | 26 panel 全部有                                       | 强制                               | ✅ **26/26**                       |
| design-system atom 复用                                | 27 panel 引用 `@/design-system`                       | 强制                               | ✅ **绝大部分达标**                |

---

## 三、P0 — 协议合规 BLOCKER

### 3.1 反向签收覆盖率（违反 §2 增强 #2）

协议明文："**没反向签收的模块不算闭环**"。

**5 个有反向签收**（皆为短句）：

- `frontend-handoff/modules/alerts/README.md`
- `frontend-handoff/modules/activity/README.md`
- `frontend-handoff/modules/plugins/README.md`
- `frontend-handoff/modules/skills/README.md`
- `frontend-handoff/modules/subagents/README.md`

抽样 plugins README 反向签收原文（现状不达标的样例）：

> ## Reverse sign-off
>
> Implemented in `frontend-new/src/components/panels/plugins/` with L1 mock visual coverage and bounded L2 real-stack inventory evidence.

**问题**：缺少协议要求的 "视觉对比 + 匹配 / 偏离的具体点 / 是否接受" 三项核心内容；仅有一句声明无法构成闭环签收。

**21 个完全缺失**（按字母序）：agents, api-explorer, approvals, budget, channels, chat, config, cron, docs, gateway, identity, logs, memory, models, nodes, routing, sessions, settings, threads, usage, webhooks。

**修复要求**：21 个 panel 补齐 + 5 个升级到结构化格式。

---

### 3.2 README Status 行规范（违反 §3.1.4）

protocol-v1 §3.1.4 明文 enumerated canonical 值：

```
ready-for-implementation
revised vN — pending implementation
implemented (sha <commit-sha>)
migrated (sha <commit-sha>)
lite-handoff
```

**实际状态**：

| 写法变体                                                            | 出现 panel                                                                                                                                   |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `implemented — hifi archived; real-contract verified`               | activity, skills                                                                                                                             |
| `implemented in 'frontend-new' — L1 mock and L2 real CRUD verified` | alerts                                                                                                                                       |
| `implemented - real-contract verified`                              | api-explorer, docs, memory, nodes, routing                                                                                                   |
| `implemented — real-contract verified`                              | subagents（en-dash 而非 hyphen）                                                                                                             |
| `implemented-real-contract`                                         | plugins, webhooks                                                                                                                            |
| 缺失 Status 行                                                      | agents, approvals, budget, channels, chat, config, cron, gateway, identity, logs, models, sessions, settings, threads, usage（**15 panel**） |

**没一个**遵守 canonical `implemented (sha <commit-sha>)` 格式 — 全部缺 `<commit-sha>`。

**修复要求**：26 个 README 全部规范化为 `Status: implemented (sha <40-char-commit-sha>)`。

---

### 3.3 三层 Prototype parity evidence 完全缺失

最新协议增强 (frontend-handoff/CLAUDE.md:159-169) 强制三层证据：

1. **Mock functional** — mock-backed 页面打开 + 关键交互通过 + 截图
2. **Mock prototype parity** — `prototype.html` 与 mock-current 页面 side-by-side 对照截图 + 结构化 verdict
3. **Real Gateway evidence** — 真实 Gateway/BFF 链路功能/视觉验证 + run-scoped 测试数据 + cleanup 证据

**实际**：0/26 panel 提供完整三层证据。implementation-notes.md 看到的措辞如 "L1 mock visual coverage" / "L2 real CRUD verified" 是**简短文字声明**，不是结构化证据。缺：

- side-by-side 截图基础设施（哪个工具？输出在哪？）
- 偏离记录（accepted exception 的 5 字段：原型位置 / 生产文件位置 / 差异 / 原因 / owner / 分类）
- run-scoped 测试数据 cleanup 工具

**修复要求**：建立 mock prototype parity 截图基础设施（建议 Playwright 双截图 + 可视化 diff 工具）；26 个 panel 走完三层验证流程。

---

### 3.4 Token 漂移 — 11/26 panel 有非 `--ds-*` 引用

协议要求：所有 token 引用必须命中 `var(--ds-*)` canonical 命名空间。

#### 严重（整套 legacy 命名空间）

| Panel     | 漂移项数 | 漂移 token（节选）                                                                                                                                                                                            |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chat`    | 12       | `--accent`, `--accent-bg`, `--accent-dim`, `--bg-2`, `--bg-elev`, `--border`, `--border-subtle`, `--panel`, `--shadow-soft`, `--text-1`, `--text-2`, `--text-3`                                               |
| `threads` | 13       | `--border`, `--border-subtle`, `--danger`, `--font-mono`, `--font-sans`, `--panel`, `--primary`, `--primary-muted`, `--surface-elevated`, `--surface-inset`, `--text-faint`, `--text-muted`, `--text-primary` |
| `usage`   | 11       | `--border`, `--danger`, `--input-bg`, `--primary`, `--primary-muted`, `--success`, `--surface`, `--surface-elevated`, `--text-faint`, `--text-muted`, `--text-primary`                                        |

**根因猜测**：这 3 个 panel 的 codex 实施使用了**预 `--ds-` 标准化的 legacy token 命名空间**（猜测 chat 是 pilot 时期的代码 + threads/usage 是 codex 的某个分支/上游 stale ref）。

#### 单点漂移（轻微）

`alerts`, `approvals`, `budget`, `config`, `docs`, `identity`, `nodes`, `plugins` 各有 1 个非 ds token。

#### 协议工具缺失

`scripts/check-tokens-drift.sh`（protocol-v1 §7 提到的检测脚本）**不存在**。没有 CI 阻断 → 漂移会在每次重构悄无声息累积。

**修复要求**：

1. 落实 `scripts/check-tokens-drift.sh` 并接 CI（fail commit 上 drift）
2. chat / threads / usage 全量 rename `--accent / --primary / --surface / --text-* / --border / --panel ...` 到 `--ds-*` canonical
3. 8 个单点漂移 panel 各自修复 1 处

---

### 3.5 a11y 测试 0/26（违反 §2 第 7 步）

frontend-handoff/CLAUDE.md §2 第 7 步明文："**写测试**（atom 单测含 vitest-axe；module 单测/e2e 按 stack-decisions 决议的框架）。"

**实际扫描**：

- 整个 `frontend-new/src/` 中 `vitest-axe` / `toHaveNoViolations` 引用 = **2 处**（不在 panel 内）
- 0/26 panel 有 a11y 测试
- 74 个 atoms 的 a11y 覆盖率未审（极可能也是 0）

**修复要求**：

1. atom 层（74 个）逐个加 vitest-axe 断言（重点：可点击 / 可输入 / 可勾选 atom）
2. panel 层每个加至少 1 个 a11y test（focus 顺序 / aria-\* / role= 集成）

---

### 3.6 组件分解 — 12 panel 单文件 inline（违反 §"Translation rules"）

protocol-v1 §"Translation rules" 表格规定：原型的 `<script type="text/babel">` 多文件 jsx → 真实工程的 multi-`.tsx` 文件，**不允许把多 jsx 打包进单 .tsx**。理由：丢了"翻译机械化"的设计意图，也丢了原型 6-file 协议的 reviewer 友好性。

| Panel                       | tsx 文件数（不含 test） | 原型应有组件数                                                              | 状态 |
| --------------------------- | ----------------------- | --------------------------------------------------------------------------- | ---- |
| activity                    | 1                       | 多 view + dialogs                                                           | ❌   |
| api-explorer                | 1                       | 7（method-tree / request-builder / response-pane / history-rail）           | ❌   |
| config                      | 1                       | 8                                                                           | ❌   |
| docs                        | 1                       | 3+（docs-tree / doc-viewer / search-results）                               | ❌   |
| gateway                     | 1                       | 3（describe-explorer / batch-console / app）                                | ❌   |
| logs                        | 1                       | 8                                                                           | ❌   |
| memory                      | 1                       | 11（browse / search / health / dreams 四 tab + 9 个 molecule）              | ❌   |
| nodes                       | 1                       | 6                                                                           | ❌   |
| **routing**                 | 1                       | 6 + 5 分子（TierBadge / MatchChip / ConfirmRow / HashChip / MutationStrip） | ❌   |
| settings                    | 1                       | 6                                                                           | ❌   |
| subagents                   | 1                       | 7                                                                           | ❌   |
| docs / activity 组也 1 文件 | 1                       | 多                                                                          | ❌   |

**抽样 routing 实施核查**：

- `frontend-new/src/components/panels/routing/RoutingPanel.tsx` 单文件 1500+ 行
- 原型分子全部退化：
  - `<HashChip>` → `shortConfigHash()` 函数（routing-panel.css 中**没有任何** `.hash` class）
  - `<TierBadge>` → `simulationTierVariant()` + design-system `<Badge>` 通用组件
  - `<ConfirmRow>` → `.routing-confirm` / `.routing-confirm.is-danger` inline CSS（在 121 行附近）
  - `<MutationStrip>` → `.routing-mutation` inline CSS
  - `<MatchChipRow>` → 仍以 inline component 形式存在但藏在 1500+ 行内

后果：将来 routing 修复 / 增量 / 维护需要在 1500+ 行单文件中导航 + 分子复用难度大 + 视觉回归基线难绑。

**修复要求**：12 个 panel 按原型 multi-file 结构重新分解：

- `panels/<module>/<Module>Panel.tsx` 主 orchestrator（≤400 行）
- `panels/<module>/<view-name>.tsx` 每个 view 一文件
- `panels/<module>/<molecule>.tsx` 每个 panel-internal molecule 一文件
- `panels/<module>/state.ts` (or hooks) 状态分离
- 跨 panel molecule 抽到 design-system（见 P1 §4.1）

---

## 四、P1 — DS 收敛 + 死代码 + 协议工具

### 4.1 我之前承诺的 P0 batch 1 — **零完成**

| 推广项                                          | 优先级 | 实际状态                                                                                                       | 路径           |
| ----------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------- | -------------- |
| `tweaks-panel.jsx` 抽到 `design-system/tweaks/` | P0     | ❌ `design-system/tweaks/` 目录**不存在**                                                                      | 需创建         |
| `AgentChip` 抽到 DS molecule                    | P0     | ❌ `design-system/molecules/` 目录**不存在**；codex 用 atom `<Chip>` + 各 panel ad-hoc CSS 替代                | 需创建         |
| `ConfirmRow` 抽到 `design-system/patterns/`     | P0     | ❌ patterns 只有 6 个 layout shell；ConfirmRow 在所有 panel 全 inline CSS                                      | 需新增 pattern |
| `JsonView` 抽到 DS molecule                     | P1     | 🟡 部分抽到 `components/shared/ShellComponents.JsonDetails`（11 KB 文件）— 但不在 `@/design-system/*` 命名空间 | 升级架构地位   |

### 4.2 codex 自创的 `components/shared/lists/` 全部死代码

codex 写了一套 list 原语（`frontend-new/src/components/shared/lists/`）：

| 模块                 | LOC  | panel 复用次数 |
| -------------------- | ---- | -------------- |
| `PaginatedList.tsx`  | 未审 | **0**          |
| `ListSearchBar.tsx`  | 未审 | **0**          |
| `BatchActionBar.tsx` | 未审 | **0**          |
| `InlineEdit.tsx`     | 未审 | **0**          |
| `SortableHeader.tsx` | 未审 | **0**          |
| `useListState.ts`    | 未审 | **0**          |

**判定**：完整的"未使用基础设施"。codex 写了一套抽象但 26 个 panel 没有任何 import。

**修复要求**：二选一

- (A) 删除 `components/shared/lists/` — 释放 LOC + 维护负担
- (B) 强制 26 panel 中的列表型 panel（channels / approvals / cron / webhooks / models / threads ...）改用这套 list 原语 — 这条路相当于又一轮重构

### 4.3 6 个 protocol-v1 patterns 采用率

`frontend-new/src/design-system/patterns/` 已存在的 6 个 pattern：

| Pattern         | panel 引用次数 | 备注                                           |
| --------------- | -------------- | ---------------------------------------------- |
| `PageShell`     | 0              | 可能合理（应挂 App.tsx 顶层 — 待审 layout 层） |
| `NavRail`       | 0              | 可能合理（同上）                               |
| `TopBar`        | 0              | 可能合理（同上）                               |
| `EmptyState`    | 7              | ✅ 部分采用                                    |
| `KbdHint`       | 0              | ❌ 设计有但未用                                |
| `SectionHeader` | 0              | ❌ 设计有但未用                                |

**修复要求**：

1. 审计 App.tsx 层的 layout shell — 验证 PageShell / NavRail / TopBar 是否在更高层挂载
2. KbdHint / SectionHeader 在 panel 中按设计意图采用 — 可发起一轮 grep 替换 PR

---

## 五、P2 — 优化空间

### 5.1 测试深度未审计

- 26/26 panel 有 `.test.tsx` ✅ — 表面覆盖
- routing 测试 681 行 ≈ 270% 主代码比例 — 可能 mock 设置占大头（待 grep 确认）
- e2e（Playwright）覆盖率未审计 — 是否每 panel 至少 1 个 happy path？
- 没有 visual regression 基线（与第 3.3 §"Mock prototype parity" 关联）

### 5.2 第二个 hash-aware panel 出现 — 触发推广

`HashChip` 在 `identity` panel 也有引用（除 routing 外的第二个）。**触发条件已达成**，应抽到：

- `design-system/molecules/HashChip.tsx`（新增 molecules/ 目录）
- 或 `design-system/atoms/HashChip.tsx`（更轻巧的方案）

`MutationStrip` 仅 routing 用 — 留作 1st-use，不抽。

### 5.3 全局功能集成（已在前次反馈中列出）

- 全局 ⌘K 命令面板（很多原型暴露但需要真实全局 hub）
- 全局 toast / snack-bar 系统（mutation 完成后通知）
- 全局 keyboard shortcut registry
- 全局错误处理（5xx / 4xx / network 离线）

每一项都是独立的 OpenSpec change，不是 panel 收尾任务。

---

## 六、正面观察（不在 P 项中）

抽样 routing 实施做对的地方：

- `RoutingPanel.tsx:1` 起干净 import design-system atoms（Badge / Button / Card / Chip / Input / Select / Spinner / Textarea）
- `RoutingPanel.tsx:46` 使用 `useTranslations` ✅
- `RoutingPanel.tsx:43-49` 使用 `panel-navigation` 接 deck-ui shell（navigateToAgent / navigateToChannel / navigateToSession）✅
- `RoutingPanel.tsx:50` 使用 `useDeckUI` store ✅
- `RoutingPanel.tsx:51` 使用 `detect-conflicts` 共享 lib ✅
- `RoutingPanel.tsx:53` 使用 `GatewayNotConfiguredEmptyState` 兜底 ✅
- `RoutingPanel.tsx:56` 使用 `JsonDetails` from `components/shared/ShellComponents` ✅
- `routing-panel.css` token **完全合规** `--ds-*`（25 个唯一 token 全部 ds-namespace）✅

整体观察：**codex 第二轮重构最大的进步** 是从"自己写一切"转向"复用 design-system + 共享 lib + i18n + store"。这是结构性提升。但还差最后一公里：协议合规层（反向签收 / Status / parity evidence）+ DS 收敛（抽 molecules / 删死代码）+ 组件分解（12 panel 解 inline）。

---

## 七、修复路线图

```
Wave 1 — P0 协议合规（~2-3 周）
  │
  ├── #1.1  补 21 个 panel 的反向签收段（结构化：视觉对比 + 偏离点 + 是否接受）
  ├── #1.2  规范 26 个 README Status 行为 implemented (sha <commit-sha>)
  ├── #1.3  落实 mock prototype parity 截图对照基础设施
  │           - Playwright dual-screenshot helper（prototype.html + frontend-new mock）
  │           - side-by-side viewer + structured verdict 输出
  ├── #1.4  chat / threads / usage 严重 token 漂移修复（rename 全套 legacy → --ds-*）
  ├── #1.5  8 panel 单点 token 漂移修复
  ├── #1.6  落实 scripts/check-tokens-drift.sh + 接 CI（fail on drift）
  └── #1.7  vitest-axe 接入 74 atom 测试（每个 atom 至少 1 个 axe 断言）

Wave 2 — DS 收敛 + 组件分解（~3-4 周）
  │
  ├── #2.1  创建 design-system/molecules/ + design-system/tweaks/ 目录
  ├── #2.2  抽 AgentChip / ConfirmRow / HashChip / JsonView 到 DS（4 个分子）
  │           - JsonView 从 components/shared/ShellComponents.JsonDetails 升级架构地位
  ├── #2.3  26 panel 替换为 DS import（净删除 ~10k 重复行）
  ├── #2.4  12 panel 单文件 inline 解构 — 按原型 multi-file 结构拆
  │           routing / api-explorer / config / docs / gateway / logs / memory /
  │           nodes / settings / subagents / activity / docs
  ├── #2.5  KbdHint / SectionHeader 在 panel 中按设计意图采用（grep 替换 PR）
  └── #2.6  components/shared/lists/ 抉择（删 vs 强制采用）

Wave 3 — 测试深度 + 全局基础设施（~2 周）
  │
  ├── #3.1  panel 层 a11y test（26 panel 各加 1 个 vitest-axe + focus order test）
  ├── #3.2  e2e Playwright 覆盖率审计 + 补齐 happy path
  ├── #3.3  visual regression 基线建立（绑定到 #1.3）
  └── #3.4  全局功能集成（独立 OpenSpec change，不计入本路线图）

合计预估：7-9 周（按 1 名 codex + 1 名设计 agent 协作节奏）
```

---

## 八、Appendix

### A. 26 panel Status 行总表（截至 2026-05-06）

| Panel        | 当前 Status 行内容                                                | 合规                            |
| ------------ | ----------------------------------------------------------------- | ------------------------------- |
| activity     | implemented — hifi archived; real-contract verified               | ❌（缺 sha + 写法非 canonical） |
| agents       | (缺)                                                              | ❌                              |
| alerts       | implemented in `frontend-new` — L1 mock and L2 real CRUD verified | ❌                              |
| api-explorer | implemented - real-contract verified                              | ❌                              |
| approvals    | (缺)                                                              | ❌                              |
| budget       | (缺)                                                              | ❌                              |
| channels     | (缺)                                                              | ❌                              |
| chat         | (缺)                                                              | ❌                              |
| config       | (缺)                                                              | ❌                              |
| cron         | (缺)                                                              | ❌                              |
| docs         | implemented - real-contract verified                              | ❌                              |
| gateway      | (缺)                                                              | ❌                              |
| identity     | (缺)                                                              | ❌                              |
| logs         | (缺)                                                              | ❌                              |
| memory       | implemented - real-contract verified                              | ❌                              |
| models       | (缺)                                                              | ❌                              |
| nodes        | implemented - real-contract verified                              | ❌                              |
| plugins      | implemented-real-contract                                         | ❌                              |
| routing      | implemented - real-contract verified                              | ❌                              |
| sessions     | (缺)                                                              | ❌                              |
| settings     | (缺)                                                              | ❌                              |
| skills       | implemented — hifi archived; real-contract verified               | ❌                              |
| subagents    | implemented — real-contract verified                              | ❌                              |
| threads      | (缺)                                                              | ❌                              |
| usage        | (缺)                                                              | ❌                              |
| webhooks     | implemented-real-contract                                         | ❌                              |

合计：0/26 合规。

### B. 26 panel 反向签收覆盖

| Panel      | Reverse sign-off 段 | 内容质量       |
| ---------- | ------------------- | -------------- |
| activity   | ✓                   | 简短           |
| alerts     | ✓                   | 简短           |
| plugins    | ✓                   | 简短（一句话） |
| skills     | ✓                   | 简短           |
| subagents  | ✓                   | 简短           |
| 其余 21 个 | ✗                   | —              |

合计：5/26 有段（皆需升级到结构化）；21/26 缺。

### C. 26 panel 文件分解状态

| Panel        | tsx (excl test) | css | test | 协议合规                    |
| ------------ | --------------- | --- | ---- | --------------------------- |
| activity     | 1               | 1   | 1    | ❌                          |
| agents       | 1               | 1   | 2    | ✅（pilot, state.ts 分离）  |
| alerts       | 5               | 1   | 1    | ✅                          |
| api-explorer | 1               | 1   | 1    | ❌                          |
| approvals    | 7               | 1   | 1    | ✅                          |
| budget       | 5               | 1   | 1    | ✅                          |
| channels     | 5               | 1   | 1    | ✅                          |
| chat         | 50              | 11  | 33   | ✅（pilot, 多文件组织正常） |
| config       | 1               | 1   | 1    | ❌                          |
| cron         | 8               | 1   | 1    | ✅                          |
| docs         | 1               | 1   | 1    | ❌                          |
| gateway      | 1               | 1   | 1    | ❌                          |
| identity     | 4               | 1   | 1    | ✅                          |
| logs         | 1               | 1   | 1    | ❌                          |
| memory       | 1               | 1   | 1    | ❌                          |
| models       | 3               | 1   | 1    | ✅                          |
| nodes        | 1               | 1   | 1    | ❌                          |
| plugins      | 2               | 1   | 1    | 🟡（边界）                  |
| routing      | 1               | 1   | 1    | ❌                          |
| sessions     | 4               | 1   | 1    | ✅                          |
| settings     | 1               | 1   | 1    | ❌                          |
| skills       | 8               | 1   | 1    | ✅                          |
| subagents    | 1               | 1   | 1    | ❌                          |
| threads      | 4               | 1   | 1    | ✅                          |
| usage        | 9               | 1   | 1    | ✅                          |
| webhooks     | 5               | 1   | 1    | ✅                          |

合计：14/26 合规、12/26 单文件 inline。

### D. Token 漂移完整清单

#### 严重漂移（chat / threads / usage 全套 legacy 命名空间）

```
chat:    --accent --accent-bg --accent-dim --bg-2 --bg-elev --border
         --border-subtle --panel --shadow-soft --text-1 --text-2 --text-3

threads: --border --border-subtle --danger --font-mono --font-sans --panel
         --primary --primary-muted --surface-elevated --surface-inset
         --text-faint --text-muted --text-primary

usage:   --border --danger --input-bg --primary --primary-muted --success
         --surface --surface-elevated --text-faint --text-muted --text-primary
```

#### 轻微（单点）

| Panel     | 漂移 token                          |
| --------- | ----------------------------------- |
| alerts    | 1 处（具体待 file:line 标注）       |
| approvals | 1 处                                |
| budget    | 1 处                                |
| config    | 1 处                                |
| docs      | 1 处（疑似 `--doc-category-color`） |
| identity  | 1 处                                |
| nodes     | 1 处                                |
| plugins   | 1 处                                |

### E. 可复现的扫描命令

```bash
# 1. Status 行
for d in frontend-handoff/modules/*/; do
  name=$(basename "$d")
  line=$(grep -m1 "^\*\*Status\*\*:" "$d/README.md" 2>/dev/null | sed 's/^\*\*Status\*\*: //')
  printf "%-14s | %s\n" "$name" "${line:-<no-status-line>}"
done

# 2. 反向签收
grep -l "Reverse sign-off" frontend-handoff/modules/*/README.md

# 3. 非 ds token 扫描
for d in frontend-new/src/components/panels/*/; do
  name=$(basename "$d")
  bad=$(grep -rEoh "var\(--[a-zA-Z0-9_-]+\)" "$d" 2>/dev/null \
        | grep -vE "var\(--ds-" | sort -u | wc -l | tr -d ' ')
  if [ "$bad" -gt 0 ]; then printf "%-15s  %s non-ds tokens\n" "$name" "$bad"; fi
done

# 4. 文件分解
for d in frontend-new/src/components/panels/*/; do
  name=$(basename "$d")
  ts=$(find "$d" -name "*.tsx" -not -name "*.test.tsx" 2>/dev/null | wc -l | tr -d ' ')
  css=$(find "$d" -name "*.css" 2>/dev/null | wc -l | tr -d ' ')
  test=$(find "$d" -name "*.test.tsx" -o -name "*.test.ts" 2>/dev/null | wc -l | tr -d ' ')
  printf "%-15s tsx=%-3s css=%-3s test=%-2s\n" "$name" "$ts" "$css" "$test"
done

# 5. a11y 测试
grep -rl "vitest-axe\|toHaveNoViolations" frontend-new/src/

# 6. DS 抽取检查
ls frontend-new/src/design-system/
ls frontend-new/src/components/shared/

# 7. components/shared/lists 死代码
for term in PaginatedList ListSearchBar BatchActionBar InlineEdit SortableHeader useListState; do
  c=$(grep -rl "$term" frontend-new/src/components/panels/ 2>/dev/null | wc -l | tr -d ' ')
  printf "%-15s used in %s panel files\n" "$term" "$c"
done
```

### F. 引用文件（关键 file:line）

- `frontend-handoff/CLAUDE.md:159-169` — Prototype parity evidence rule（最新增强）
- `frontend-handoff/CLAUDE.md:91-120` — Status 行 canonical 值表（§3.1.4）
- `frontend-handoff/CLAUDE.md:255-269` — §"Translation rules" 表
- `frontend-new/src/components/panels/routing/RoutingPanel.tsx:1` — 抽样审：单文件 1500+ 行起点
- `frontend-new/src/components/panels/routing/routing-panel.css:117-220` — TierBadge / ConfirmRow / MutationStrip 退化为 inline CSS 的证据
- `frontend-new/src/components/shared/lists/` — codex 死代码所在地
- `frontend-new/src/design-system/patterns/` — 6 个 pattern + tests + index.ts

---

## 九、给 codex / 工程方的明确接收清单

按 Wave 1 优先级精确到 PR 级：

| PR ID      | 范围                                                                                | 验收                                              |
| ---------- | ----------------------------------------------------------------------------------- | ------------------------------------------------- |
| `PR-1.1.a` | 落实 reverse sign-off 模板（`frontend-handoff/audit/templates/reverse-signoff.md`） | 设计 agent 起草模板                               |
| `PR-1.1.b` | 21 panel × reverse sign-off 段补齐                                                  | 每段含视觉对比截图引用 + 偏离表                   |
| `PR-1.2`   | 26 panel README Status 行规范化                                                     | `grep -c "implemented (sha [a-f0-9]\{40\})"` = 26 |
| `PR-1.3.a` | mock prototype parity 截图基础设施                                                  | Playwright helper + 一份样例输出                  |
| `PR-1.3.b` | 26 panel × parity 报告产出                                                          | 每 panel 一份 side-by-side + verdict              |
| `PR-1.4`   | chat / threads / usage token rename                                                 | grep 非 `--ds-*` 在这 3 panel 为 0                |
| `PR-1.5`   | 8 单点 panel token 修复                                                             | grep 非 `--ds-*` 全 26 panel 为 0                 |
| `PR-1.6`   | check-tokens-drift.sh + CI 接入                                                     | CI 上 fail demo                                   |
| `PR-1.7`   | 74 atom × vitest-axe                                                                | grep `toHaveNoViolations` count ≥ 74              |

Wave 2 / Wave 3 PR 列表见 §七 路线图。

---

## 十、本审查报告自身的元约束

- 报告位置：`deck-go/frontend-handoff/audit/2026-05-06-codex-refactor-systematic-review.md`
- 后续审计建议：每次 codex 大重构后做一次完整审；累计漂移可参照本报告 baseline
- 本次审查**未做**的事项：
  - 浏览器侧实测（Playwright MCP 服务在审查期间断开）
  - 真实 Gateway 链路测试（属于 Wave 1 #1.3.b 而非审查范围）
  - 70+ atom 内部 a11y 实施情况扫描
  - bundle size / 性能基线
  - 26 panel 的 implementation-notes.md 内容质量逐篇审

— END —
