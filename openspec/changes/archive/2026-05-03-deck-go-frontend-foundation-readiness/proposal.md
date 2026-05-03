# deck-go-frontend-foundation-readiness Proposal

## Why

24 个 legacy panel 的高保真原型即将量产。agents pilot（已完成）验证了协议可执行，但暴露 3 处骨架缺口：

1. **`design-system/patterns/` 完全空缺** — 跨模块共享的 shell（PageShell / NavRail / TopBar / EmptyState / KbdHint / SectionHeader）一个都没有。每个原型都在自己发明 shell 词汇，agents 已经造了 4 个本地等价物。继续做下去，24 个原型 × N 个 shell molecule 的反哺成本会爆炸。
2. **`design-system/icons/` 完全不存在** — agents 原型现写了 17 个 SVG icon。下个原型会再造 N 个。需要 canonical icon 集合 + icon 库选型决议。
3. **原型字符串规则未约定** — 原型用 babel-standalone 无法 import next-intl shim；hardcoded 字符串和工程实施时的 i18n 翻译规则没有写下来。

这是量产前最后一公里的 foundation 工作。先补齐再开始 24 个 panel 原型，否则要么前 5 个原型反复发明 shell 词汇并在反哺日批量重做，要么强行推进让 design system 在不一致中沉淀。

## What Changes

- **NEW** `frontend-new/src/design-system/patterns/`：6 个跨模块布局壳（PageShell、NavRail、TopBar、EmptyState、KbdHint、SectionHeader）+ 平铺结构 + barrel + a11y 测试 + Gallery 接入
- **NEW** `frontend-new/src/design-system/icons/`：canonical SVG icon 集合 + 选型决议（lucide-react vs 自研 vs 混合）+ barrel + Gallery 接入
- **NEW** 原型字符串规则约定：prototype 中 hardcoded 字符串 / 工程实施时一次性抽到 `i18n/{en,zh}.json` / 不在 prototype 假装调用 `t()`
- **MODIFIED** `frontend-handoff/CLAUDE.md`：增加"原型字符串规则"段（属于翻译规则的一部分）
- **MODIFIED** `docs/project/stack-decisions.md`：icon 库决议从 pending → locked
- **NEW** `frontend-handoff/design-system/proposals/`：记录 agents prototype 反哺候选（avatar / list-row / status-pill / file-row）等待季度反哺日批量决议

## Capabilities

### New Capabilities

- `design-system-patterns`：定义 `frontend-new/src/design-system/patterns/` 目录的存在边界、6 个初始 pattern 的契约、与 atoms/ 的职责分工，以及向 panels 暴露的公共 props 形态。
- `design-system-icons`：定义 `frontend-new/src/design-system/icons/` 目录的存在边界、canonical icon 集合的覆盖范围、选型决议绑定到 stack-decisions、以及向 patterns/atoms/panels 的导出契约。
- `frontend-prototype-strings-convention`：定义双 agent 协议下原型与工程实施之间字符串的责任划分——原型直接 hardcoded 不调 `t()`，工程实施一次性抽到 i18n catalog；并约定 prototype.html 自检不引入 next-intl 任何形态。

### Modified Capabilities

- `frontend-handoff-protocol`：协议正文增加"原型字符串规则"小节作为 Translation rules 的一条，引用 `frontend-prototype-strings-convention` 详细约定；同时澄清 patterns/icons 也走 design system 反哺通道（不在 panels 内部就地实现）。
- `design-system-cross-module-readiness`：matrix 增加 `patterns` 和 `icons` 两列；agents prototype 已暴露的反哺候选作为新 entry 进入 readiness 记录（不立即促升为 atom，等季度反哺日决议）。

## Impact

- **影响代码**
  - `deck-go/frontend-new/src/design-system/patterns/`（新建）
  - `deck-go/frontend-new/src/design-system/icons/`（新建）
  - `deck-go/frontend-new/src/design-system/index.ts`（导出）
  - `deck-go/frontend-new/src/design-system/dev/Gallery`（接入新 pattern + icon 展示）
- **影响协议**
  - `deck-go/frontend-handoff/CLAUDE.md`（增加 prototype 字符串规则段）
  - `deck-go/docs/project/stack-decisions.md`（icon 库 pending → locked）
- **影响依赖**
  - 视决议结果可能新增 `lucide-react` ≥ 0.x 依赖；Vite tree-shake 验证为绿
- **影响测试**
  - 6 个 pattern 各自 vitest-axe + 渲染单测
  - icons barrel 单测确保所有 export 可 import
- **不影响**
  - 已迁移 panel 工程代码（chat、agents、usage 等 12 个）继续运行不变
  - tokens.css canonical 不动
  - 36 atoms 不动
  - 已存在的 24 个 `frontend-*-hifi-redesign` spec 与本 change 解耦——它们消费本 change 产出
- **后续闭环**
  - 本 change archive 后，量产 24 个高保真原型时所有 panel 必须从 patterns/icons 引用 shell 与 icon
  - 反哺候选清单在季度反哺日批量评审；本 change 不立即决议升级为 atom/molecule
