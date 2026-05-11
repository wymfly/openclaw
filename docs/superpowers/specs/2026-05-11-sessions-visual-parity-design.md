# Sessions 面板视觉对齐 prototype 设计

- **日期**：2026-05-11
- **范围**：`deck-go/frontend-new/src/components/panels/sessions/`
- **目标**：让 sessions 实际页面在 dark / 1440px / Overview tab + selected-session 默认状态下，跟 `deck-go/frontend-handoff/modules/sessions/prototype.html` 视觉一致度 ≥ 90%
- **不在范围**：canonical tokens、canonical atoms、其他 panel、契约链、API、后端、mutation 行为

## 背景

用户实际打开 sessions 页面 vs 打开 `prototype.html`，感受到字体、间距、卡片 chrome、整体舒适度有明显差距，并怀疑是 design system 出了问题。

代码事实核查后真相是：

- **canonical tokens（`frontend-new/src/design-system/tokens/index.css` 与 `frontend-handoff/design-system/tokens.css`）是 chat-pilot 视觉基线**：`--ds-sp-3: 8px / sp-4: 12px / radius-md: 6px / shadow-md: 0 4px 16px rgba(0,0,0,0.4) / text-1: #e6e8ec / fs-body: 13.5px / line: 1.5`。
- **24 个 prototype 中 23 个走 canonical**（chat、channels、agents、threads、usage、logs、activity、approvals、alerts、…），只 `models/prototype.html` 单独覆写 `--ds-radius-md: 8px`。
- **`sessions/prototype.html` 是唯一系统性自定义了基线的 prototype**：`--ds-sp-3: 12px / sp-4: 16px / sp-5: 24px / radius-md: 8px / shadow-md: 0 14px 36px rgb(0 0 0 / 0.28) / text-1: #f3f6fb / fs-body: 13px / line: 1.45`。

结论：sessions prototype 是 design system 层的"异类"，但它体感"更舒服"是事实。本次以"sessions 单点对齐 prototype 视觉"为目标，达成后再回头总结视觉差异根因，不在本 spec 推断要不要把 canonical 改向 sessions prototype 那套。

## 目标 / Non-goals

### 目标

1. sessions 实际页面在 dark theme / 1440px viewport / Overview tab active / 有 selected session 状态下，与 `sessions/prototype.html` 视觉一致度 ≥ 90%。
2. 改动只动以下文件/目录：
   - `deck-go/frontend-new/src/components/panels/sessions/`（CSS / TSX / 测试更新）
   - 新增 `deck-go/test/e2e/sessions-visual-parity.spec.ts`（prototype parity E2E，仅本 spec 使用）
   - `deck-go/frontend-handoff/modules/sessions/implementation-notes.md` 追加 visual parity 证据段落
     不动其他文件；i18n 文件因复用既有 key 不动（见 2.4）。
3. atoms 在 sessions 上下文里通过 CSS 变量级联自然继承"宽松基线"，不修改 atom 源码。

### Non-goals

- 不修改 canonical tokens / atoms / patterns。
- 不修改其他 panel。
- 不动 sessions 模块的契约、API、mutation、confirmation gate。
- 不重写 helper 组件（`SessionUsageDetails` / `SessionCompactionHistory` / `SessionSubagentDetails`）的内部结构（它们渲染在 Usage / Compaction / Lineage tab，prototype 没截这些 tab 状态）。
- 不重新校准 light theme 视觉（sessions light 沿用 canonical 配色 / 阴影）；本 spec 要求 light theme 在 sessions 页面**不回归**（文字仍可读、无 layout overflow、无 console error），但不追求 prototype 视觉对齐——sessions/prototype.html 仅展示 dark 状态。

## 方法概览

采用 **B 路径：Token scoped override + 结构对齐 prototype**。

替代方案及拒绝原因：

| 方案                                                          | 拒绝原因                                                                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A：纯 token override，不动 JSX                                | token 撑开后 Hero+Runtime metadata 双显、transcript 5 层、inventory 5 行 meta 仍在，结构上和 prototype 差距大，最多 60-70% 对齐 |
| C：pixel-perfect 重建（局部用 `sessions-*` class 替换 atoms） | 违反 `frontend-handoff/CLAUDE.md` "panel 必须用 canonical atoms" 原则；后续 atom 改动不会反映；module-convergence 需重走        |

## 设计

### Section 1: Scoped Token Override

在 `sessions-panel.css` 顶部，`.sessions-panel { ... }` 选择器内覆写以下 token。CSS 变量在该容器内级联，atoms（Button / Card / Badge / Input / Select / SegmentedControl / Toggle / Code）通过 `var(--ds-*)` 读到的就是 sessions-scoped 值；scope 外渲染的 atom 不受影响。

| Token            | Canonical（chat 基线）       | Sessions override 值                | 视觉作用                                 |
| ---------------- | ---------------------------- | ----------------------------------- | ---------------------------------------- |
| `--ds-sp-2`      | 6px                          | **8px**                             | 紧凑列 / icon-gap 撑开                   |
| `--ds-sp-3`      | 8px                          | **12px**                            | 卡片内主 gap、行间距                     |
| `--ds-sp-4`      | 12px                         | **16px**                            | section 间 gap、卡片 padding             |
| `--ds-sp-5`      | 16px                         | **24px**                            | header 与 metrics 行外间距               |
| `--ds-radius-md` | 6px                          | **8px**                             | 卡片 / 按钮 / 输入圆角                   |
| `--ds-shadow-md` | `0 4px 16px rgba(0,0,0,0.4)` | **`0 14px 36px rgb(0 0 0 / 0.28)`** | 卡片阴影变大柔，制造漂浮感               |
| `--ds-text-1`    | `#e6e8ec`                    | **`#f3f6fb`**                       | 标题 / 数字 / strong 文字更亮            |
| `--ds-text-2`    | `#a8aeba`                    | **`#c7d0dd`**                       | 二级文字对比上调                         |
| `--ds-fs-body`   | 13.5px                       | **13px**                            | 正文略缩                                 |
| `--ds-fs-meta`   | 11.5px                       | **11px**                            | meta 文字略缩                            |
| `--ds-line`      | 1.5                          | **1.45**                            | 行距略紧（与宽间距搭配制造"舒展不松散"） |

`--ds-sp-1`（4px）和 `--ds-row-h`（32px）保持 canonical 不动，避免按钮高度漂移。

**关键认知**：prototype 比实际更舒服**不是因为字号更大**——字号实际更小（13 vs 13.5）、行距更紧（1.45 vs 1.5）；舒服来自"间距和 padding 显著撑开 + 阴影大柔 + 文字对比上调"。三者共同营造透气感。

#### 实施要点

- **CSS 分两组写**（避免 dark-only 色值污染 light theme）：
  - 跨主题适用：`spacing / radius / fs / line` 写在 `.sessions-panel { ... }` 内（间距与圆角与主题无关，dark / light 都生效）。
  - dark-only 适用：`text-1 / text-2 / shadow-md` 写在 `[data-theme="dark"] .sessions-panel { ... }` 内。如果不加 dark guard，sessions 在 light 会把 `--ds-text-1` 从 canonical `#15171a`（深色文字给白底用）改成 `#f3f6fb`（亮色文字），导致 light 白底白字不可读。
  - light theme：sessions 不写 light-specific override，自然继承 canonical light tokens（text 仍是深色 `#15171a`，shadow 仍是 canonical 柔阴影）。
- 不另起 `:where(...)` / `data-attr` 这类 wrapper，单纯靠 selector specificity 即可生效。
- 测试在 `dark` 和 `light` 两个 theme 各跑一次 `getComputedStyle(.sessions-panel).getPropertyValue('--ds-sp-3')` / `--ds-text-1` 断言，分别验证：dark 下 spacing + colors 都为 sessions override 值；light 下 spacing 为 sessions override 值、colors 保持 canonical light 值。

### Section 2: 结构对齐 prototype

实际代码相比 prototype 多塞了内容；token 撑开后这些冗余更显眼。下面按 `sessions/prototype.html` 截图严格对照逐项回退。

#### 2.1 中央列 SelectedWorkbench

| 子块                          | prototype                                                                   | 当前代码                                                                                              | 改动                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero 标题区                   | eyebrow + h2 + meta line + 3 个 status pill（status / runtime / context %） | 同 + history badge + lineage badge                                                                    | 中央 Hero **删除** history badge 和 lineage badge；这两个信息搬到 Inspector Overview tab 新增的 Tab summaries row（见 2.3）                                                                                                                                                                                                                                                                                                                           |
| Hero 下 stat-grid             | **4 个**：Input / Output / Model / Policy                                   | **6 个**：Input / Output / Total / ContextWindow / ContextPressure / Cost                             | 砍到 4 个。Policy 字段为合成显示：`thinking ${level} \| fast mode ${on/off}`                                                                                                                                                                                                                                                                                                                                                                          |
| Runtime metadata 独立 section | **不存在**（stat-grid 直接在 Hero 内）                                      | 独立 surface 再次列 6 个 StatTile + status badge + thinking/fastmode note                             | **整段删除**（`SessionsPanel.tsx:827-870`）                                                                                                                                                                                                                                                                                                                                                                                                           |
| Transcript search/export      | input + 4 button + 1 个 `<pre>` 拼接 transcript code + 2 行 transcript list | input + 4 button + note + selected match Code + `<details open>` ExportPreview + 8 行 transcript list | (1) selected match Code 块：保留 DOM，但加 `transcriptSearchQuery.trim() !== ""` 条件渲染——默认状态隐藏（对齐 prototype 截图状态），用户搜索后才出现。(2) ExportPreview `<details>`：去掉默认 `open`，改为用户点导出后才展开。(3) transcript list：**DOM 仍 `slice(0, 8)` 保留功能**，CSS 给 `.sessions-transcript-list` 加 `max-height` 限制（约两行高，例如 88-104px）+ `overflow-y: auto`，首屏视觉 ≈ 2 行，用户可滚动看更多——不删功能、纯视觉对齐 |

#### 2.2 左侧 Inventory row

| 行  | prototype                         | 当前代码                                                              | 改动           |
| --- | --------------------------------- | --------------------------------------------------------------------- | -------------- |
| 1   | strong（title）+ status pill      | 同                                                                    | 不动           |
| 2   | `agent \| provider/model \| kind` | 同                                                                    | 不动           |
| 3   | preview 文本                      | `session.lastMessagePreview`                                          | 不动           |
| 4   | timestamp                         | `previewText(preview, session)` ← 不是 timestamp，是 preview 二次显示 | 改回 timestamp |
| 5   | —                                 | `formatTimestamp(session.updatedAt)` ← 多一行                         | **整行删除**   |

删除 `previewText` meta 行；行 4 改为 `formatTimestamp(session.updatedAt)`；最终 4 行字段。

#### 2.3 右侧 Inspector

- 5 tab 切分（Overview / Usage / Compaction / Lineage / Actions）**保留**——module-convergence 已确认的 product 决定。
- **Overview tab 新增 Tab summaries row**（对齐 `prototype.html` 第 590-600 行 active=Overview 状态显示的"Tab summaries"surface）：在现有 metadata section 下新增一个 `<div class="sessions-status-row">`，含 4 个 badge pill：
  - `history ${count}` —— 承接 2.1 中央 Hero 移走的 history count badge
  - `lineage ${state}` —— 承接 2.1 中央 Hero 移走的 lineage 状态 badge（state 为 `idle` / `loading` / `ready` 中之一，复用既有 `lineageState`）
  - `usage ${totalTokens} tokens` —— 已有 `selectedTotalTokens` 数据，无新增 fetch
  - `${compactionCount} checkpoint(s)` —— 已有 `selectedSession.compactionCount` 数据，无新增 fetch
- Usage / Compaction / Lineage / Actions tab 内部结构**不动**；spacing / 圆角 / chrome 由 Section 1 token override 自然撑开。
- Actions tab 表单 dense 是 prototype 范围外的真实表单需求，保留现状。

#### 2.4 Top Metrics

- 5 个 metric tile 视觉对齐由 Section 1 token override 自然达成。
- 例外修复：`Compactions` metric tile 在 `compactionCount === 0` 时的 hint fallback 当前是 `t("runtimeMetadata")`（语义错位），改为**复用既有** `t("compaction.noCheckpoints")`（已存在于 `frontend-new/src/i18n/en.json:2263` 和 `zh.json` 同位的 `sessions.compaction` namespace，文案 "No compaction checkpoints found"）。**不新增 i18n key、不动 i18n 文件**。

#### 2.5 Header

- 文案 / 结构不动。
- 视觉对齐由 token override 自然达成。

#### 2.6 测试同步

`SessionsPanel.test.tsx` 当前 13 个测试中受结构改动影响的部分：

- Hero stat 渲染断言：从 6 stat 改为 4 stat。
- Hero badges 断言：history 与 lineage 两个 badge 不再出现在 Hero status row；它们改为出现在 Inspector Overview tab 的 Tab summaries row。
- Runtime metadata 独立 section 相关断言：删除或标记为 absent。
- Transcript 区域：
  - ExportPreview default open 断言：改为 default closed（或默认不存在）。
  - selected match Code 块：默认（`transcriptSearchQuery` 空）时不可见的断言。
  - transcript list `<li>` 数量：DOM 上保留 ≤ 8（不再改成 ≤ 2 的硬断言）；新增 `.sessions-transcript-list` 有 `max-height` 计算样式的断言（约束 ≤ 110px）。
- Inventory row meta 字段数：5 → 4。
- Inspector Overview tab：新增 Tab summaries row 存在性断言（含 history / lineage / usage / checkpoint 4 个 pill）。

不动的测试：confirmation gate（reset / clear / compact / delete）、mutation 调用、Inspector tab 切换语义、transcript cache 行为。

### Section 3: 验证策略

#### 3.1 视觉验收（主路径）

新增 `deck-go/test/e2e/sessions-visual-parity.spec.ts`，固定 viewport `1440x900`、theme `dark`、locale `en`、nav `expanded`、Overview tab active、有 selected session。spec 内执行：

1. **Prototype 截图**：用 Playwright 加载本地 `file://.../frontend-handoff/modules/sessions/prototype.html`，截 → `<output>/prototype.png`。
2. **Mock-current 截图**：启动 bundled stack + 导航到 sessions 面板，等待 Inventory ready / Detail ready / Overview tab visible，截 → `<output>/mock-current.png`。
3. **Parity sheet**：在 spec 末尾拼出 `<output>/sheet.png`（左右并排 prototype + mock-current，等比缩放到同一高度），并把两张原图也作为 tracked artifact 输出。
4. **结构化 verdict**：spec 把 verdict 写到 `<output>/verdict.json`，字段：`status: "pass" | "pass-with-exceptions" | "fail"`、`score: 0-100`（基于关键区域 DOM 断言通过率）、`acceptedExceptions: Array<{ area, diff, reason, owner }>`。
5. **持久 evidence**：把 verdict + sheet 路径以 `## Visual parity — 2026-05-11` 段落形式追加到 `deck-go/frontend-handoff/modules/sessions/implementation-notes.md`，对照 frontend-handoff/CLAUDE.md 的 "Mock prototype parity" evidence level。
6. **人工 dev server 并排验证**（second check）：mock 模式（`pnpm dev` in `frontend-new/`）打开 sessions 页面 vs 浏览器另开 prototype.html，1440 浏览器 viewport、dark/en，确认 verdict 与机器截图判断一致。

现有 `sessions-visual.spec.ts` 保留不动（继续做 interaction state coverage）；本 spec 的 parity 检查是独立新 spec，关注点是 prototype↔mock-current 的视觉一致。

#### 3.2 单元 / 组件测试

- 更新 `SessionsPanel.test.tsx` 受影响断言（参考 2.6），其余测试不动。
- 跑：`cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx`。

#### 3.3 不需要的验证

- contract gate / protocol-check（不动契约）
- real Gateway E2E（不动 API 调用、不动 mutation）
- backend test（纯前端 panel 改）
- 其他 panel 视觉回归（CSS scope 已隔离）

#### 3.4 验收门槛（machine-readable）

视觉对齐：

- Token override 在 `.sessions-panel` scope 内 `getComputedStyle` 计算值，分两个 theme 验证：
  - **dark theme**：完整 12 项匹配 spec 表格（spacing / radius / fs / line / colors / shadow 全部）。
  - **light theme**：仅 `--ds-sp-2/3/4/5 / --ds-radius-md / --ds-fs-body / --ds-fs-meta / --ds-line` 匹配 sessions override 值；`--ds-text-1 / --ds-text-2 / --ds-shadow-md` 保持 canonical light 值（`#15171a` / `#555a64` / `0 4px 14px rgba(20, 20, 30, 0.08)`），不被 sessions override 覆盖。
- Hero stat-grid 渲染 4 个 `.sessions-stat` 元素（不是 6 个）。
- DOM 中不存在「独立 Runtime metadata surface」（heading 文本 `t("runtimeMetadata")` 不再出现作为 stat-grid heading）。
- Hero 上不再渲染 history badge 与 lineage badge；Inspector Overview tab 的 metadata 段下方存在 Tab summaries row，含至少 4 个 badge pill（history / lineage / usage / checkpoint）。
- Transcript 区域：默认状态（`transcriptSearchQuery` 为空）下 selected match Code 块**不可见**；ExportPreview `<details>` 默认状态下**不存在或处于 closed**（用户点导出后才出现 / open）；transcript list `<li>` 数量 DOM 上 ≤ 8；`.sessions-transcript-list` 计算 `max-height` ≤ 110px（≈2 行视觉高度）+ `overflow-y: auto`。
- Inventory row 在 `pagedSessions[0]` 下渲染恰好 4 个 meta/note span（不是 5 个）。
- `Compactions` metric tile 在 `compactionCount === 0` 时 hint 文案使用 `t("compaction.noCheckpoints")`，不再是 `t("runtimeMetadata")`。
- light theme 不回归：light 模式下 sessions 页面文字可读（`--ds-text-1` 仍是深色 `#15171a`），无 layout overflow，无 console error / page error / 4xx-5xx BFF response。

测试与命令：

- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx` 全部通过。
- `cd deck-go && pnpm exec playwright test test/e2e/sessions-visual.spec.ts --config playwright.config.ts` 通过（既有 interaction state coverage 不回归）。
- `cd deck-go && pnpm exec playwright test test/e2e/sessions-visual-parity.spec.ts --config playwright.config.ts` 通过（新增 prototype parity spec：固定 1440x900 / dark / en / Overview tab；输出 prototype.png / mock-current.png / sheet.png / verdict.json）。
- light theme smoke：在 `sessions-visual-parity.spec.ts` 内增加 `@light` 用例，切换 theme 到 light，断言（a）token computed values（见验收门槛）；（b）无 console / pageerror / BFF 4xx-5xx；（c）`page.screenshot()` 输出作为 light theme baseline artifact。
- 机器化 verdict（`<output>/verdict.json`）`status` 字段 ≥ `pass-with-exceptions`；`acceptedExceptions` 限于 shell chrome / live fixture 时间戳与具体数值差异，不能包含 spacing / chrome / typography / hero-stat-count / runtime-metadata-duplication / transcript-layer-overflow 类条目。
- `deck-go/frontend-handoff/modules/sessions/implementation-notes.md` 含 `## Visual parity — 2026-05-11` 段落，链接 sheet.png 与 verdict.json 的产生路径，并按 frontend-handoff/CLAUDE.md 的 tracked evidence manifest 形式列字段。

## 风险

| 风险                                                                                                                                   | 缓解                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| atoms 内 hardcoded `var(--ds-sp-4)` 撑开后按钮在 sessions 里看着比 chat 大一圈                                                         | 这是 prototype 的预期效果；不修复                                                                                                                                                     |
| 删 Runtime metadata 后用户失去 Cost / ContextWindow / ContextPressure 数据可视入口                                                     | Cost / Context % 仍在 top metrics + Hero badges 显示；ContextWindow 数值在 Inspector → Usage tab 内可查；这是 prototype 视觉的真实取舍                                                |
| transcript list CSS 限高让用户**看不出还有更多**消息                                                                                   | 容器加 `overflow-y: auto` + 滚动条样式，且 transcriptMessages.length > 2 时在容器下方加一行轻提示（"scroll for more" 或等价 i18n key）；保留 DOM 8 条数据，搜索、导出仍能访问全部内容 |
| Inspector Overview 新增 Tab summaries row 后 Overview tab 不再"只显示 metadata"，可能跟 module-convergence 的轻 Overview 期望偏离      | 这是为了承接中央 Hero 移走的两个 badge；Tab summaries row 本身就是 prototype.html active=Overview 状态显示的内容，是"对齐 prototype"的一部分                                          |
| dark-only color override 写成 `[data-theme="dark"] .sessions-panel`，跟 canonical light theme tokens 优先级关系出错时 light 仍可能漂移 | 验收门槛在 light theme 显式断言 `--ds-text-1` 计算值为 canonical `#15171a` 而不是 `#f3f6fb`；若断言失败说明 specificity 出错，必须修 CSS 选择器                                       |

## 后续 / Follow-ups

1. **视觉差异根因总结**：本 spec 落地、用户验收满意后，回头写一份独立短文档总结 design system 层的 chat-pilot 视觉基线 vs sessions prototype 宽松基线的差异、产生原因、是否应该把"宽松基线"提升为 canonical（或 dashboard 类 panel 引入 density 分档）。
2. **light theme 同步**：本次只覆 dark；light theme 同步要在并排人工验收 light + 看清 sessions prototype light 截图（如果存在）后再做。
3. **其他 panel 是否也有"实际比 prototype 挤"的体感**：用户当前只感知 sessions；其他 panel 实际页面 vs prototype 是否也偏挤待并排验证，不在本 spec 范围。
4. ~~Compactions hint 文案 i18n key~~ — 本 spec 直接复用既有 `sessions.compaction.noCheckpoints`，不新增 key，此 follow-up 取消。

## OpenSpec 关联

本次属于 panel 内视觉对齐，**不**触达契约、不触达 accepted spec、不创建新 OpenSpec change。如实施过程中发现需要触达共享 atom 或 token 的逻辑改动，应当中止本 spec 并升级为 OpenSpec proposal。
