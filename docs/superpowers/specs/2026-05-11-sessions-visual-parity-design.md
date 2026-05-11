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
2. 改动只动 `deck-go/frontend-new/src/components/panels/sessions/` 内文件，不动其他文件。
3. atoms 在 sessions 上下文里通过 CSS 变量级联自然继承"宽松基线"，不修改 atom 源码。

### Non-goals

- 不修改 canonical tokens / atoms / patterns。
- 不修改其他 panel。
- 不动 sessions 模块的契约、API、mutation、confirmation gate。
- 不重写 helper 组件（`SessionUsageDetails` / `SessionCompactionHistory` / `SessionSubagentDetails`）的内部结构（它们渲染在 Usage / Compaction / Lineage tab，prototype 没截这些 tab 状态）。
- 不调 light theme（dark theme 优先，light 留作 follow-up）。

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

- 直接在 `.sessions-panel` 顶部块写覆写，**不**通过 `[data-theme=dark]` 或 media query 区分，dark 优先。
- 不另起 `:where(...)` / `data-attr` 这类 wrapper，单纯靠 selector specificity 即可生效。
- 测试用 `getComputedStyle(.sessions-panel).getPropertyValue('--ds-sp-3')` 断言。

### Section 2: 结构对齐 prototype

实际代码相比 prototype 多塞了内容；token 撑开后这些冗余更显眼。下面按 `sessions/prototype.html` 截图严格对照逐项回退。

#### 2.1 中央列 SelectedWorkbench

| 子块                          | prototype                                                                   | 当前代码                                                                                              | 改动                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero 标题区                   | eyebrow + h2 + meta line + 3 个 status pill（status / runtime / context %） | 同 + history badge + lineage badge                                                                    | 保留 prototype 三个 pill；`history` 数量 badge 和 `lineage` 状态 badge 移到 Inspector Overview tab，不再在中央 Hero 显示                              |
| Hero 下 stat-grid             | **4 个**：Input / Output / Model / Policy                                   | **6 个**：Input / Output / Total / ContextWindow / ContextPressure / Cost                             | 砍到 4 个。Policy 字段为合成显示：`thinking ${level} \| fast mode ${on/off}`                                                                          |
| Runtime metadata 独立 section | **不存在**（stat-grid 直接在 Hero 内）                                      | 独立 surface 再次列 6 个 StatTile + status badge + thinking/fastmode note                             | **整段删除**（`SessionsPanel.tsx:827-870`）                                                                                                           |
| Transcript search/export      | input + 4 button + 1 个 `<pre>` 拼接 transcript code + 2 行 transcript list | input + 4 button + note + selected match Code + `<details open>` ExportPreview + 8 行 transcript list | 删 selected match Code 块；ExportPreview details 改为默认折叠（仅用户点导出后才显示，且不 `open`）；transcript list 从 `slice(0, 8)` 改 `slice(0, 2)` |

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

- 5 tab 切分（Overview / Usage / Compaction / Lineage / Actions）**保留**——prototype 没截 tab 切换状态，5 tab 是 module-convergence 已确认的 product 决定。
- Tab 内部结构**不动**；spacing / 圆角 / chrome 由 Section 1 token override 自然撑开。
- Actions tab 表单 dense 是 prototype 范围外的真实表单需求，保留现状。

#### 2.4 Top Metrics

- 5 个 metric tile 视觉对齐由 Section 1 token override 自然达成。
- 例外修复：`Compactions` metric tile 在 `compactionCount === 0` 时的 hint fallback 当前是 `t("runtimeMetadata")`（语义错位），改为 `t("noCheckpoints")` 或等价空态文案。新增对应 i18n key。

#### 2.5 Header

- 文案 / 结构不动。
- 视觉对齐由 token override 自然达成。

#### 2.6 测试同步

`SessionsPanel.test.tsx` 当前 13 个测试中受结构改动影响的部分：

- Hero stat 渲染断言：从 6 stat 改为 4 stat。
- Runtime metadata 独立 section 相关断言：删除或标记为 absent。
- Transcript ExportPreview default open 断言：改为 default closed。
- Inventory row meta 字段数：5 → 4。

不动的测试：confirmation gate（reset / clear / compact / delete）、mutation 调用、Inspector tab 切换语义、transcript cache 行为。

### Section 3: 验证策略

#### 3.1 视觉验收（主路径）

1. 浏览器打开 `frontend-handoff/modules/sessions/prototype.html`（dark / 1440px），作为对照基线。
2. 运行 `cd deck-go && pnpm exec playwright test test/e2e/sessions-visual.spec.ts` 捕获 mock-current 新截图。
3. 把 prototype 截图与 mock-current 新截图并排，生成 side-by-side parity sheet（沿用 module-convergence 阶段的 `.local/sessions-*-parity-report/` 流程）。
4. 人工 dev server 并排验证：mock 模式（`pnpm dev` in `frontend-new/`）打开 sessions 页面 vs 浏览器另开 prototype.html。

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

- 12 项 token override 在 `.sessions-panel` scope 内 `getComputedStyle` 计算值匹配 spec 表格。
- Hero stat-grid 渲染 4 个 `.sessions-stat` 元素（不是 6 个）。
- DOM 中不存在「独立 Runtime metadata surface」（heading 文本 `t("runtimeMetadata")` 不再出现作为 stat-grid heading）。
- Transcript 区域不存在 default-open `<details>` ExportPreview；selected match 单独 Code 块不存在；transcript list 最多渲染 2 个 `<li>`。
- Inventory row 在 `pagedSessions[0]` 下渲染恰好 4 个 meta/note span（不是 5 个）。
- `Compactions` metric tile 在 `compactionCount === 0` 时 hint 文案不再是 `t("runtimeMetadata")`。

测试与命令：

- `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/sessions/SessionsPanel.test.tsx` 全部通过。
- `cd deck-go && pnpm exec playwright test test/e2e/sessions-visual.spec.ts --config playwright.config.ts` 通过。
- 人工 side-by-side 视觉 verdict ≥ `pass-with-exceptions`，accepted exceptions 限于 shell chrome / live fixture 时间戳与具体数值差异，不能包含 spacing / chrome / typography / hero-stat-count / runtime-metadata-duplication / transcript-layer-overflow 类条目。

## 风险

| 风险                                                                               | 缓解                                                                                                                                   |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| atoms 内 hardcoded `var(--ds-sp-4)` 撑开后按钮在 sessions 里看着比 chat 大一圈     | 这是 prototype 的预期效果；不修复                                                                                                      |
| 删 Runtime metadata 后用户失去 Cost / ContextWindow / ContextPressure 数据可视入口 | Cost / Context % 仍在 top metrics + Hero badges 显示；ContextWindow 数值在 Inspector → Usage tab 内可查；这是 prototype 视觉的真实取舍 |
| transcript list 从 8 行降到 2 行后用户感觉看不到全文                               | full transcript 通过 Export / 滚动 selected match 访问；prototype 本身就是 2 行                                                        |
| light theme 不动可能引入与 dark 不一致的体感                                       | 列为 follow-up；本 spec dark 优先                                                                                                      |

## 后续 / Follow-ups

1. **视觉差异根因总结**：本 spec 落地、用户验收满意后，回头写一份独立短文档总结 design system 层的 chat-pilot 视觉基线 vs sessions prototype 宽松基线的差异、产生原因、是否应该把"宽松基线"提升为 canonical（或 dashboard 类 panel 引入 density 分档）。
2. **light theme 同步**：本次只覆 dark；light theme 同步要在并排人工验收 light + 看清 sessions prototype light 截图（如果存在）后再做。
3. **其他 panel 是否也有"实际比 prototype 挤"的体感**：用户当前只感知 sessions；其他 panel 实际页面 vs prototype 是否也偏挤待并排验证，不在本 spec 范围。
4. **Compactions hint 文案 i18n key**：本 spec 新增 `sessions.noCheckpoints`（或语义等价、保持 `sessions.*` 命名空间一致）；如果其他 panel 也有类似空态需求，考虑提到共用 i18n 命名空间。

## OpenSpec 关联

本次属于 panel 内视觉对齐，**不**触达契约、不触达 accepted spec、不创建新 OpenSpec change。如实施过程中发现需要触达共享 atom 或 token 的逻辑改动，应当中止本 spec 并升级为 OpenSpec proposal。
