# Usage 面板视觉对齐与 Design System 提炼探针设计

- **日期**：2026-05-11
- **范围**：`deck-go/frontend-new/src/components/panels/usage/`
- **视觉目标**：让 usage 实际页面在 mock-current / dark / 1440px / en / 默认 overview 状态下，对齐 `deck-go/frontend-handoff/modules/usage/prototype.html`
- **决策目标**：通过 usage + sessions 两个模块的视觉修复证据，回答是否已经可以把共同修复提炼为 shared design system，从而直接改善其他模块，而不是继续逐模块修
- **不在首轮范围**：直接改 canonical tokens、直接改 design-system atoms/patterns、直接批量改其他 panel

## 背景

sessions 模块已完成一次局部视觉对齐：它没有修改 canonical design system，而是在 `.sessions-panel` 内做 scoped token override，并补了 prototype-vs-current 的 Playwright parity spec。这个做法修好了 sessions，但也留下一个必须回答的问题：

> sessions 的修复是模块特例，还是暴露了可以抽成全局 design system 的共同问题？

usage 是第二个合适样本，因为它已经有高保真 v2 handoff，且用户观察到明显相同的视觉问题。代码核查显示 usage 的问题并不只是“间距偏小”：

- `deck-go/frontend-handoff/modules/usage/README.md` 明确 active visual target 是 `prototype.html`，v1 只是 archive。
- `deck-go/frontend-handoff/modules/usage/prototype.html` 加载 `tokens.css` + `styles.css`，且默认 `data-theme="dark"` / `data-density="compact"`。
- `deck-go/frontend-handoff/modules/usage/styles.css` 使用 canonical `--ds-text-1/2/3`、`--ds-bg-*`、`--ds-line-*`、`--ds-accent-*` 风格的 design tokens。
- `deck-go/frontend-new/src/components/panels/usage/usage-panel.css` 仍混用 `--ds-text`、`--ds-text-secondary`、`--ds-text-tertiary`、`--ds-surface`、`--ds-accent-soft` 等当前 canonical tokens 中不存在或不一致的名字，并 fallback 到 legacy `--text-primary` / `--text-muted` 等历史别名。
- 现有 `deck-go/test/e2e/usage-visual.spec.ts` 是 mock functional / variants smoke：它验证页面能打开、数据和交互可用、截图存在，但没有加载 prototype，也没有做 token / DOM parity verdict。

结论：usage 需要一次和 sessions 同级的视觉 parity pass。但这次不能只停在“修 usage”。它必须产出一个 design system 判定矩阵，帮助决定下一步是继续逐模块修，还是先抽 shared primitives / tokens。

## 目标 / Non-goals

### 目标

1. usage 实际页面在 mock-current / dark / en / 1440px 默认状态下，与 `frontend-handoff/modules/usage/prototype.html` 达到可人工验收的视觉一致。
2. 新增 prototype parity 证据：prototype 截图、mock-current 截图、side-by-side sheet、结构化 verdict。
3. 保留现有 usage functional coverage：dark/light、en/zh、导航、筛选、provider selection、session drilldown 不回归。
4. 修复 usage 内部已确认的 token 命名漂移，优先迁移到 canonical `--ds-*` token 或 usage scoped token aliases，避免依赖不存在的 `--ds-text` / `--ds-surface` 伪 token。
5. 产出 `Design System Promotion Decision`：把 usage 与 sessions 的修复项分类，明确哪些可提炼，哪些必须留在模块内，哪些需要第三个模块验证。

### Non-goals

- 首轮不直接修改 `frontend-new/src/design-system/tokens/index.css`。
- 首轮不直接修改 design-system atoms / patterns。
- 首轮不改其他 panel CSS / TSX。
- 不引入 `recharts` 或任何新依赖；usage README 中的 recharts 是 dependency-gated follow-up。
- 不改 usage 契约、BFF、Data Fabric、真实 Gateway read path。
- 不把 v1 prototype 的旧 token 命名带回生产代码；active target 是 v2 `prototype.html`。

## 核心问题

本次提案不是简单问“usage 怎么修得像 prototype”，而是问：

1. usage 的视觉差异主要来自模块实现漂移，还是来自 shared design system 缺失？
2. sessions 的 scoped token override 是否应该提升为全局 token / density preset？
3. usage 与 sessions 是否共享足够多的视觉原语，值得先提炼 design system，再用它修其他模块？
4. 如果不能全局化，下一批模块应按什么证据继续逐模块修？

## 方案比较

| 方案                                        | 描述                                                                                                                     | 优点                                                        | 风险 / 拒绝原因                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A. 直接全局改 design system                 | 先改 canonical tokens / atoms / patterns，再看 usage 和其他模块是否改善                                                  | 可能一次影响多模块                                          | 证据不足；usage 还混旧 token alias，sessions 是 scoped 特例；直接全局改会把模块漂移和系统问题混在一起，风险大 |
| B. 只修 usage，不回答全局问题               | 照 sessions 做 usage scoped 修复，完成后结束                                                                             | 最快修一个页面                                              | 无法回答用户关心的 design system 提炼问题，后续仍会陷入逐模块猜测                                             |
| C. usage 局部修复 + promotion probe（推荐） | 先用 usage parity pass 修真实页面，同时记录每个修复项是否可复用；修完后用 usage+sessions 两个样本产出 design system 判定 | 风险可控，有真实视觉证据；能区分模块特例和 shared candidate | 需要多一个判定文档 / verdict，不能立刻宣称全局可用                                                            |

推荐 **C**。首轮仍然是 usage 局部修复，因为现在不能安全地直接改全局 design system；但每个 usage 修复都必须带 promotion classification，最终给出是否可以全局化的结论。

## 设计

### Section 1: Fact Baseline

实施前先建立 usage 的事实基线，避免把历史 review 或肉眼印象直接当任务真相。

基线至少记录：

| 分类               | 内容                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| accepted           | usage 当前视觉确实与 active v2 prototype 有 material mismatch；生产 CSS 使用旧/不存在 token alias；现有 E2E 不是 prototype parity         |
| corrected          | 如果某些“全局 design system 已坏”的判断被代码事实推翻，记录更正。例如 canonical tokens 本身仍是 chat-pilot 基线，不等于 usage v2 页面目标 |
| rejected           | 不在本轮做的建议，例如直接引入 recharts、直接改所有模块、直接改 canonical tokens                                                          |
| deferred-uncertain | 需要人类视觉判断的差异，例如 chart 交互精度、light theme 是否要求 pixel parity                                                            |

落点可以是 usage `implementation-notes.md`，若该文件不存在，则新增 `deck-go/frontend-handoff/modules/usage/implementation-notes.md`。

### Section 2: Prototype Parity Spec

新增 `deck-go/test/e2e/usage-visual-parity.spec.ts`，职责与 sessions parity spec 对齐，但不替代现有 `usage-visual.spec.ts`。

固定主场景：

- viewport：`1440x900`
- theme：`dark`
- locale：`en`
- nav：expanded
- density：以当前 app 支持能力为准；prototype 默认 compact，若生产 shell 不能按模块设置 density，则作为 verdict 字段记录，不在首轮强行改全局 density
- panel state：默认 loaded cockpit，未选择 session detail；另有一个 drilldown screenshot 覆盖 selected session detail

输出 artifact：

- `prototype.png`
- `mock-current.png`
- `sheet.png`
- `verdict.json`

`verdict.json` 字段：

```ts
type UsageParityVerdict = {
  status: "pass" | "pass-with-exceptions" | "fail";
  domScore: number;
  domScoreNote: "DOM/token assertion pass rate; not pixel score";
  visualReview: {
    status: "pending-human" | "accepted" | "accepted-with-exceptions" | "needs-revision";
    screenshots: string[];
    notes?: string;
  };
  promotionCandidates: Array<{
    area: string;
    candidate: string;
    evidence: string[];
    classification: "module-only" | "shared-candidate" | "promote-later" | "reject";
  }>;
  assertions: Array<{ name: string; expected: string; actual: string; ok: boolean }>;
};
```

机器断言关注：

- production usage 不再读取不存在的 primary visual tokens（如 `--ds-text`、`--ds-surface`）作为主路径。
- computed colors / surface / border / gap 与 active prototype 的 token intent 对齐。
- topbar / KPI strip / range controls / main rows / provider rail / sessions table / detail drawer 的关键 DOM 区域存在。
- 默认截图不出现 horizontal overflow。
- dark / light / en / zh functional smoke 继续由现有 `usage-visual.spec.ts` 覆盖。

### Section 3: Usage 局部修复边界

首轮允许在 usage 内做以下局部修复：

1. **Token alias cleanup**
   - 把 `--ds-text` 改为 canonical `--ds-text-1`。
   - 把 `--ds-text-secondary` 改为 `--ds-text-2`。
   - 把 `--ds-text-tertiary` 改为 `--ds-text-3`。
   - 把 `--ds-surface` / `--ds-surface-muted` 映射到 usage scope 内明确别名，或直接改为 canonical `--ds-bg-1/2/3`。
   - 把 `--ds-input-bg` 改为 canonical `--ds-bg-1` 或 usage scoped alias。
   - 把 `--ds-accent-soft` 改为 canonical `--ds-accent-bg`。

2. **Usage scoped aliases**
   如果 prototype v2 用到 canonical tokens 没有覆盖的语义（例如 `--ds-line-1/2`、`--ds-accent-1/2`、`--ds-success-1/2`），优先在 `.usage-panel` 内定义 usage-scoped alias：

   ```css
   .usage-panel {
     --usage-line-1: var(--ds-border-subtle);
     --usage-line-2: var(--ds-border);
     --usage-accent-1: var(--ds-accent);
     --usage-accent-2: var(--ds-accent-dim);
   }
   ```

   不在首轮把这些写入 global tokens。promotion 需要通过 Section 5 的判定门槛。

3. **Layout parity**
   对齐 active v2 prototype 的 topbar / KPI strip / three stacked rows / provider + aggregate / sessions + detail 布局。允许调整 usage 内 class 和 JSX 结构，但不改变数据读取和用户功能。

4. **Chart parity**
   保持现有 hand-rolled SVG / CSS chart primitives，不引入 recharts。只修颜色、尺寸、legend、空态、容器 chrome。

5. **Evidence notes**
   所有无法完全对齐的差异必须落到 usage implementation notes 的 accepted exceptions，不能只留在聊天里。

### Section 4: Design System Promotion Classification

每个 usage 修复项都必须归类，不允许“修完再说”。

| 分类               | 定义                                                                                 | 示例                                                                                  | 处理                                             |
| ------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `module-only`      | 只服务 usage 信息架构或 usage 数据形态                                               | cost trend row、provider quota rail、session usage drilldown                          | 留在 usage                                       |
| `shared-candidate` | usage + sessions 都需要，或明显会被多个 cockpit 类模块复用，但还缺第三样本           | surface chrome、KPI/stat tile、section row gap、status/meta text hierarchy            | 记录为 candidate，不立刻全局化                   |
| `promote-later`    | 已有两个以上模块证据，且可通过一个 shared token/pattern 改善，不会造成已实现模块回归 | `PanelSurface`、`KpiStrip`、`DensityPreset`（如果 usage+sessions+另一个模块证据一致） | 进入 follow-up OpenSpec / design system proposal |
| `reject`           | 原型特有、或全局化会损害其他模块                                                     | usage chart-specific labels、provider-specific icon treatment                         | 不提炼                                           |

判定输出建议落到：

- `deck-go/frontend-handoff/modules/usage/implementation-notes.md`
- 或新增 `docs/superpowers/specs/2026-05-11-usage-design-system-promotion-findings.md`（如果结论较长）

### Section 5: Design System Promotion Gate

usage 修复结束后，必须给出下面三种结论之一：

#### 结论 A：继续逐模块修

适用条件：

- usage 的大部分差异来自旧实现、旧 token alias、模块结构漂移。
- sessions 的 scoped token override 与 usage 修复没有稳定重叠。
- 抽成 shared layer 会引入大量例外。

后续动作：继续选第三个有明显问题的模块做 parity pass；暂不动 global design system。

#### 结论 B：先抽 shared candidates，不改 canonical tokens

适用条件：

- usage + sessions 共享了明确的结构 primitive，例如 stat/KPI strip、surface chrome、section header、status row。
- 但 token 数值是否全局化仍不确定。

后续动作：创建单独 design-system proposal，先加 patterns / local utility classes，例如 `PanelSurface`、`KpiStrip`、`StatusMetaRow`；用 usage/sessions 作为 reference consumers，再评估其他模块。

#### 结论 C：可以启动全局 design system 调整

适用条件必须全部满足：

- usage + sessions + 至少一个第三模块的 prototype parity 证据显示同一 token / primitive 问题。
- 修改 canonical token 或 shared atom 后，reference modules 的截图更接近 prototype。
- sampled modules 的 light/dark smoke 没有可读性和 overflow 回归。
- 变更可以用一个 OpenSpec change 表达，不需要混入各模块产品结构重写。

后续动作：创建新的 OpenSpec proposal，范围是 design system，不混在 usage 修复内。

## 验收标准

### Usage 视觉修复验收

- `usage-visual-parity.spec.ts` 通过，输出 prototype / mock-current / sheet / verdict。
- `usage-visual.spec.ts` 继续通过，证明现有 functional variants 不回归。
- usage 默认 dark/en 视图无 horizontal overflow，无 unexpected console / pageerror / API 4xx-5xx。
- usage CSS 主视觉路径不再依赖 `--ds-text`、`--ds-text-secondary`、`--ds-surface` 这类非 canonical token 名称。
- implementation notes 记录 accepted exceptions 和 evidence artifact。

### Design system 判定验收

- 每个视觉修复项都有 promotion classification。
- 最终明确输出 A / B / C 三选一，不用“以后再看”作为结论。
- 如果结论是 B 或 C，必须列出候选 shared primitives / tokens、受益模块、风险和需要的新 OpenSpec / plan。
- 如果结论是 A，必须说明为什么 usage 不能作为全局化证据，以及下一个最适合抽样的模块。

## 风险

| 风险                                                         | 缓解                                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| usage 修复过程中顺手改 global tokens，导致其他模块不可控漂移 | 首轮禁止修改 `design-system/tokens/index.css`；任何 global change 都作为后续 OpenSpec       |
| 把 usage v1 prototype 的旧 token 命名误当 active target      | 明确 active visual target 是 `prototype.html` v2；v1 只用于历史参考                         |
| chart 视觉和交互牵出 recharts 依赖                           | 本轮不引入依赖；只修当前 CSS/SVG primitive 视觉，recharts 继续 dependency-gated             |
| parity spec 只证明 DOM，不证明视觉                           | verdict 区分 `domScore` 与 `visualReview`，并输出 side-by-side sheet 供人工验收             |
| promotion classification 流于形式                            | 把 classification 写入 verdict / implementation notes，作为完成门槛，而不是最终报告口头总结 |

## 建议实施顺序（非详细计划）

1. 建 usage fact baseline 和 parity spec。
2. 跑 parity spec，得到 RED：记录 prototype vs current 的 token / DOM / screenshot 差异。
3. 修 usage token alias 和局部 chrome/layout。
4. 修 usage 结构差异，但不改变契约和 Data Fabric。
5. 跑 parity + existing usage visual + focused unit tests。
6. 写 implementation notes：evidence、accepted exceptions、promotion classification。
7. 输出 Design System Promotion Decision：A / B / C。

## OpenSpec 关联

本提案本身是 module visual parity + design-system probe，不直接创建 global design-system OpenSpec。若最终结论是 B 或 C，必须单独创建 OpenSpec proposal，不能在 usage 修复 PR 里顺手全局化。
