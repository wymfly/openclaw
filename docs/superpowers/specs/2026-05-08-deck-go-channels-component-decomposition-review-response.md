# channels 组件拆分 design — 外部审查处理记录

| 字段     | 值                                                                                                                                 |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 主文档   | [`2026-05-08-deck-go-channels-component-decomposition-design.md`](./2026-05-08-deck-go-channels-component-decomposition-design.md) |
| 审查来源 | Codex 交叉审查（用户委托）                                                                                                         |
| 处理日期 | 2026-05-08                                                                                                                         |
| 处理依据 | `deck-go/frontend-new/CLAUDE.md` "Review-driven remediation fact rule"；根 `AGENTS.md` "外部审查输入" 与 "流程缺陷反思规则"        |
| 状态     | resolved — 用户确认采用路径 B，Codex 已将修正落入主 design v2                                                                      |

## 1. 处理流程声明

按 `frontend-new/CLAUDE.md` "Review-driven remediation fact rule"：

> 如果某次实施来自外部审查、设计复查或跨 agent 报告，Claude Code MUST 先建立 tracked fact baseline，再创建/执行修复任务。Baseline 至少把发现分成 `accepted` / `corrected` / `rejected` / `deferred-uncertain`，并为 accepted/corrected 项写入 rerunnable command 或 file reference。未经验证的 review prose 不能直接成为任务真相。

按根 `AGENTS.md` "外部审查输入"：

> 处理外部审查时必须先建立事实基线…确认成立且范围清楚的问题应直接修复；有争议或会改变设计边界的问题进入 follow-up matrix。

本文档是外部审查处理记录。用户与 Codex 已确认采用"路径 B + Codex 3 个补丁"，主 design 已在 `2026-05-08-deck-go-channels-component-decomposition-design.md` 修订为 v2。

## 2. Fact Baseline 表

每条 finding 用代码引用 / 可重跑命令支撑分类。

### Finding 1 — dashboard 命名偏离 deck-go 真实结构

**Codex 原话摘录**：

- 设计以 dashboard 旧版 6 个组件命名作为拆分核心
- 但 `deck-go/AGENTS.md:12` 明确不要默认复制 legacy `dashboard/` 实现细节
- 当前 handoff 的目标骨架其实是 `ChannelsListView / ChannelsDetailView / tabs / dialogs`（`deck-go/frontend-handoff/modules/channels/components.md:11`）
- 当前生产代码里的真实大块还包括 `MetricTile`、`ChannelThroughputChart`、`ChannelRoutingPanel`、dialogs 等

**Claude 核实**：

- `deck-go/AGENTS.md:14` 原文："Do not copy `dashboard/` implementation details for 'parity' by default. `dashboard/` is a legacy Next.js client; `deck-go/` is a separate architecture."
- `frontend-handoff/modules/channels/components.md:11-32` v2 production skeleton 列出的是：
  ```
  ChannelsPanel
    └── ChannelsListView (ChannelsToolbar / ChannelsKpiStrip / ChannelInventoryList / ChannelRow[])
    └── ChannelsDetailView (DetailHero / ChannelTabsBar / TabOverview / TabThroughput / TabProbe / TabSettings / TabRouting / TabWeComAccess)
    └── ChannelDialogs (TestResultDialog / LogoutDialog / CreateChannelDialog)
  ```
- 当前 `ChannelsPanel.tsx` 内部已存在 `MetricTile`、`ChannelProbeResultBadge`、`ChannelThroughputChart`、`ChannelRoutingPanel`、`ChannelGlyph` 等局部 component（grep 结果证实）

**分类**：`accepted`

**判定**：v2 skeleton 在 deck-go 框架内是命名权威；dashboard 6 文件名最多作为参考。

---

### Finding 2 — 测试事实错误："64 cases" 与 ChannelsPanel.test.tsx 实际不符

**Codex 原话摘录**：

- 设计多处写 "64 cases"
- 当前 ChannelsPanel.test.tsx 实际是约 10 个 it(...)
- "64 tests passed" 来自 `api.chat-helpers.test.ts + ChannelsPanel.test.tsx` 组合

**Claude 核实（rerunnable command）**：

```bash
grep -c "^\s*it(" deck-go/frontend-new/src/components/panels/channels/ChannelsPanel.test.tsx
# 输出: 10
```

合并测试运行的 64 数字源头：`frontend-handoff/modules/channels/implementation-notes.md` 行 28-29，但那是 2 file 合计。

**分类**：`accepted-corrected`

**判定**：主 spec §10 的 "64 cases" 全部应改写为 "ChannelsPanel.test.tsx 现有 10 个 it 场景"；"现有总测试" 不应作为 gate 数量，而应作为"覆盖范围 ≥ 抽离前"的语义描述。

---

### Finding 3 — 像素级 diff 机制不存在

**Codex 原话摘录**：

- 设计写"4 张截图、diff=0"
- 当前 `channels-visual.spec.ts` 实际产出 7 张截图
- 文件里是 `page.screenshot()` 产物记录，不是 `toHaveScreenshot()` baseline 比较

**Claude 核实（rerunnable command）**：

```bash
grep -E "toHaveScreenshot|page.screenshot|expect.*screenshot" deck-go/test/e2e/channels-visual.spec.ts
```

输出 7 处 `page.screenshot(...)`，0 处 `toHaveScreenshot(`。

**分类**：`accepted-corrected`

**判定**：

- 主 spec §9 "mock visual E2E 4 截图必须像素级不变"是事实错误——deck-go 当前**没有**视觉 baseline diff 基础设施
- 修正方向：(a) 改为 "visual smoke 通过 + screenshot artifact 产出无报错 + 人工 parity 抽审" 这种现存能验证的 gate；(b) 或者在 #1 范围**外**单独立项接入 `toHaveScreenshot()` baseline——这是 program-level follow-up，不应混入 #1
- 截图数量 4 → 7 也需要修正

---

### Finding 4 — 路由真相错误

**Codex 原话摘录**：

- 设计写 BFF routes 有 `GET /routing`、`PATCH /config`
- 真实 routing wrapper 是 `/deck/routing`
- 真实 config patch 是 `POST /config/patch`

**Claude 核实（rerunnable command）**：

```bash
grep -nE "fetchRoutingBindings|patchDeckConfig|patchChannelConfig|/deck/routing|/config/patch" deck-go/frontend-new/src/api.ts
```

关键引用：

- `api.ts:849` `patchChannelConfig(channelId, patch)` —— 不接 baseHash
- `api.ts:1877` `fetchRoutingBindings(...)` 用 `1894: /deck/routing${suffix}`
- `api.ts:2175` `patchDeckConfig(patch, baseHash?)` 用 `2177: "/config/patch"`

**分类**：`accepted`

**判定**：主 spec §4 事实基线、§7 props 契约（`onSettingsPatch` 描述）、§9 数据流相关引用必须按真实端点改写。

---

### Finding 5 — channel patch 的 baseHash 语义错误

**Codex 原话摘录**：

- 设计给 `RetryStrategyEditor` props 加了 `baseHash`
- 真实 `patchChannelConfig(channelId, patch)` 不接收 baseHash
- 后端 `PATCH /channels/{channelId}` 是先 `config.get`，再用后端派生 baseHash 调 `config.patch`
- 合同 `baseHashMode: backend-derived`

**Claude 核实**：

- `deck-go/backend/internal/server/inventory.go:1083-1099`：
  ```go
  payload, err := adapter.ConfigGet(ctx)              // 1085
  baseHash := configHashFromPayload(payload)           // 1093
  payload, err = adapter.ConfigPatch(ctx, ..., baseHash, "")  // 1095
  ```
- `deck-go/contracts/source/deck-config-write-safety.contract.json:143-159`：
  ```json
  {
    "id": "channels.config.patch",
    "baseHashMode": "backend-derived",
    "conflictBehavior": "upstream-error-preserved",
    ...
  }
  ```

**分类**：`accepted`

**判定**：

- `RetryStrategyEditor` / `AllowFromEditor` props **不应**含 `baseHash`
- 主 spec §7 props 契约要删 `baseHash` 字段
- 主 spec §9 错误处理"`Base-hash 冲突 (409)`：复用 `DataFabricBaseHashRequiredError`" 段需重写——channels.config.patch 是 backend-derived + upstream-error-preserved，前端不发起冲突解析，只显示 upstream error
- 风险表 §12 "Data Fabric 契约改动" 没问题，但 §9 错误处理需要换语义

---

### Finding 6 — RetryStrategyEditor / AllowFromEditor 边界与当前代码不一致

**Codex 原话摘录**：

- 设计的 retry 只有 `{attempts, jitter, backoff}`
- 当前 `ChannelSettingsEditor` 实际支持 `attempts/minDelayMs/maxDelayMs/jitter`、`dmPolicy`、free-form JSON patch
- 设计的 `AllowFromEditor` 写成 `PATCH /channels/{id}` 的 `{allowFrom}`
- 当前 `allowFrom` 主要在 `WecomAccessControls` 内部，走 config/routing-backed WeCom access

**Claude 核实**：

- `ChannelSettingsEditor.tsx:33-50` `readRetrySettings`:
  ```ts
  return {
    attempts: ... ?? DEFAULT_RETRY.attempts,
    minDelayMs: ... ?? DEFAULT_RETRY.minDelayMs,
    maxDelayMs: ... ?? DEFAULT_RETRY.maxDelayMs,
    jitter: ... ?? DEFAULT_RETRY.jitter,
  };
  ```
  实际字段：`attempts / minDelayMs / maxDelayMs / jitter`（**无 backoff**）
- `ChannelSettingsEditor.tsx:64-122` 同组件一体化支持 retry + dmPolicy + jsonPatchDraft 三类编辑
- `WecomAccessControls.tsx:165` `function AllowFromEditor(props: ...)` —— 是 WecomAccessControls 文件内部 function，不是顶层 export，仅服务于 WeCom access state

**分类**：`accepted`

**判定**：

- "RetryStrategyEditor 作为 channels 通用顶层 part" 这个抽象边界**不存在于现状**——retry 与 dmPolicy / json patch 在 `ChannelSettingsEditor` 内一体化
- "AllowFromEditor 作为 channels 通用顶层 part" 这个抽象边界**也不存在**——allowFrom 是 WecomAccessControls 内部函数，是 WeCom-specific 的 access control 子组件
- 把它们抽出来作为通用 part = 既没有真实代码支撑，也违反 dashboard 旧版"WeCom 多 page"的实际形态（dashboard 的 `AllowFromEditor.tsx` 是顶层 export 但**仅服务于 WeCom 访问控制**）
- 必须从 #1 范围**移除** RetryStrategyEditor / AllowFromEditor 的"通用 part"定位

---

## 3. 全部 6 条分类汇总

| #   | 分类               | 影响层级                  |
| --- | ------------------ | ------------------------- |
| 1   | accepted           | **设计边界**（命名权威）  |
| 2   | accepted-corrected | 数字事实                  |
| 3   | accepted-corrected | **验收基础设施缺失**      |
| 4   | accepted           | 端点事实                  |
| 5   | accepted           | **契约语义**              |
| 6   | accepted           | **设计边界**（part 抽象） |

无 `rejected`，无 `deferred-uncertain`。

## 4. 修复路径选项

### 路径 A — 仅修事实错误，保 dashboard 命名 + 保 6-part 拆分

修 finding 2 / 3 / 4 / 5 ；
**保留** finding 1 (dashboard 命名 vs handoff v2 skeleton) + finding 6 (RetryStrategyEditor + AllowFromEditor 作为 part) 不变。

trade-off：

- ✅ 改动最小
- ❌ 违反 `deck-go/AGENTS.md:14`
- ❌ finding 6 重定义 part 范围会让抽象更扭曲（要么 part 内部"知道"自己 patch 哪些字段，要么给 part 加大量 prop 让它伪通用）
- ❌ finding 3 修不彻底——pixel-level 改"7 截图 artifact 产出无报错"是降级 gate

### 路径 B（推荐）— 改命名权威到 v2 skeleton + 修事实错误 + 缩小 #1 part 范围

主要变化：

1. **命名权威**改为 `frontend-handoff/modules/channels/components.md:11-32` v2 skeleton：
   - `ChannelsListView` / `ChannelsDetailView` / `Tab{Overview,Throughput,Probe,Settings,Routing,WeComAccess}` / `dialogs/{TestResult,Logout,CreateChannel}Dialog`
2. **#1 part 范围**改为：从 ChannelsPanel.tsx 抽出已经在 panel 内部存在的内联组件 `MetricTile`、`ChannelProbeResultBadge`、`ChannelThroughputChart`、`ChannelRoutingPanel`、`ChannelGlyph`，命名按 v2 skeleton（不强加 dashboard `Channel*` 前缀）
3. **RetryStrategyEditor + AllowFromEditor 移出 #1**：
   - 现有 `ChannelSettingsEditor` 一体化保留不动（内部 retry + dmPolicy + json patch）
   - 现有 `WecomAccessControls` 一体化保留不动（内部含 AllowFromEditor function）
   - 这两个顶层组件的"是否拆 sub-editor"作为 #2 (WeCom 多 page 化) 或独立 follow-up
4. **修 finding 2-5 全部事实错误**：
   - 测试 case 数：ChannelsPanel.test.tsx 现有 10 it 场景 + axe 等
   - 视觉 gate：改为"visual smoke 通过 + 7 截图 artifact 无报错 + 人审 parity"，pixel-level baseline diff 列入独立 follow-up
   - 端点：`/deck/routing`、`POST /config/patch`、`patchChannelConfig(channelId, patch)`
   - baseHash：完全从 props 移除；conflict behavior 改写为 backend-derived + upstream-error-preserved

trade-off：

- ✅ 对齐 `deck-go/AGENTS.md:14`、对齐 handoff v2 skeleton（也是 deck-go 自己产出的设计权威）
- ✅ #1 真正成为"把 1492 行 mega-panel 按 deck-go 自己的 skeleton 拆"的有意义子项目
- ✅ 不强行制造抽象，避免 finding 6 的扭曲
- ⚠️ 需要重写主 spec 大半（§4、§6、§7、§9、§10、§12、§13）
- ⚠️ #1 不再"对齐 dashboard 6 文件名"——但用户原始任务是"功能对齐"不是"文件名对齐"，命名权威切到 v2 skeleton 仍满足"功能对齐"语义

### 路径 C — 作废本 design 文档，重启 brainstorming

理由：fact baseline 显示我 brainstorming 阶段提供的方案 A/B/C 三选都把 dashboard 命名当锚点，方案框架本身就有偏差。

trade-off：

- ✅ 最干净，从 0 开始读完整代码再问问题
- ❌ 重做之前已经锁定的 brainstorming 决策（dumb props / module-local / 中等档完成定义 / `__fixtures__/`）——这些决策本身和 finding 不冲突
- ❌ 时间最长

## 5. Claude 推荐

**路径 B**。理由：

1. fact baseline 表明 #1 真实可拆分目标是 v2 skeleton 的 list/detail/tabs/dialogs，不是 dashboard 6 文件名
2. finding 6 是结构性证据：RetryStrategyEditor / AllowFromEditor 的"通用 part"抽象在现状里**不存在**，硬抽是 SLOP
3. 路径 B 保留 brainstorming 中无争议的核心决策（dumb props / module-local / 中等档 / fixture / orchestrator 单点 query）
4. 路径 B 可以在 1 次重写内修完——不需要全部重启

## 6. 待用户与 Codex 交叉确认事项

用户与 Codex 已拍板：

1. **修复路径**：采用路径 B。
2. **视觉 gate**：采用 "(a) visual smoke 通过 + 7 张截图 artifact 无报错 + 人审 parity"；`toHaveScreenshot()` baseline diff 留作独立 follow-up。
3. **命名组织**：采用 v2 skeleton 的 `views/` + `tabs/Tab{...}` + `parts/` + `dialogs/` 组织。
4. **RetryStrategyEditor + AllowFromEditor**：移出 #1；保留现有 smart components，不在本子项目中硬抽。
5. **64 cases 错误追溯**：主 design v2 已显式记录 "ChannelsPanel.test.tsx 当前 10 个 it 场景"，并要求后续引用历史测试数字先核单文件事实。

## 7. 流程缺陷反思（按根 AGENTS.md "流程缺陷反思规则"）

按根 `AGENTS.md`，识别本次为 **流程/规范缺陷**，不是普通实现缺陷：

### 缺陷类型

`brainstorming` + `proposal` 双重根因：

- **brainstorming 探索深度不足**：读了 `ChannelsPanel.tsx` 前 200 行 + handoff `README.md` + handoff `api-usage.md`，但**没读** `ChannelSettingsEditor.tsx` / `WecomAccessControls.tsx` 内部、handoff `components.md` v2 skeleton、`frontend-new/src/api.ts` 真实端点签名、`deck-config-write-safety.contract.json` baseHash 契约
- **proposal 写作时事实漂移**：把"实施 notes 中 2 file 合计 64 测试" 误读成"ChannelsPanel.test.tsx 单文件 64 cases"；把 handoff `api-usage.md` 中前端语义路径（`/channels` / `/routing` / `/config`）当成 BFF 真实路径
- **方案选项框架偏差**：brainstorming 第 5 题"物理结构"三方案 A/B/C 都把 dashboard 命名当锚点，没把 handoff v2 skeleton 作为命名权威呈现给用户——剥夺了用户的真实选择

### 复发防护建议（待用户讨论后才落规范）

**不直接修改 `frontend-new/CLAUDE.md` 或根 `AGENTS.md`**，按"讨论前置"原则提出以下规范调整候选：

1. brainstorming 阶段在涉及"前端模块拆分 / 重构"任务时，必读清单加入：
   - 现有专用组件**内部实现**（不只是文件名）
   - handoff `components.md`（如果存在）作为 v2 skeleton 命名权威
   - `frontend-new/src/api.ts` 中相关 wrapper 的端点字符串
   - 涉及 mutation 的契约（`deck-go/contracts/source/deck-*write-safety*.json`）的 baseHash 与 conflict 语义

2. brainstorming 提供的"方案对比"必须显式给出 **3 个独立锚点**（如果存在）的选项：
   - dashboard 旧版（参考）
   - handoff v2 skeleton（deck-go 设计权威）
   - 现状代码自然边界（deck-go 真实结构）
     不允许 3 个方案都用同一个锚点。

3. brainstorming 引用历史 `implementation-notes.md` 的数字（测试 case 数 / 截图数等）必须做单文件核实（`grep -c "^\s*it(" file`）后才能写进 spec。

4. 视觉 gate 在写入 spec 前必须核实底层基础设施是否存在（`grep -E "toHaveScreenshot|page.screenshot" e2e/*.spec.ts`），不能假设 pixel-level 比较存在。

5. 任何"前端组件拆分"spec 必须引用 `deck-go/AGENTS.md:14` "Do not copy `dashboard/` implementation details for 'parity' by default" 作为命名/结构选择的强制对比项。

请用户与 Codex 评估上述规范候选是否值得讨论；如同意讨论，作为 `openspec/follow-ups/` 条目记录并在后续单独讨论。

---

**本文档版本**：v2（resolved after Codex cross-review）
**主文档状态**：已重写为 design v2。
