## Context

deck-go 前端协议 v1 已落定（`deck-go-frontend-protocol-v1`），chat pilot 已迁移到 `frontend-new/`（`deck-go-chat-protocol-pilot`），物理工程区已 scaffolded（`deck-go-frontend-new-scaffold`）。agents 模块作为协议下的第一个 forward-flow 高保真原型已完成（`frontend-handoff/modules/agents/`，单文件 778 LOC Codex 版 → 多文件 ~3074 LOC Claude 版）。

agents pilot 暴露 3 处缺口：

1. **patterns/ 完全空缺** — `frontend-new/src/design-system/patterns/` 目录不存在。agents 原型自行实现了 `list-header / list-empty / detail-back / detail-header / kbd-pair` 等 4-5 个跨模块共用形态。继续做下去 24 个 panel × N 个本地 shell 结果就是反哺日批量重做。
2. **icons/ 不存在** — 没有 canonical icon 集合，agents 手写了 17 个 SVG。下个原型会再造，bundle 内重复。
3. **原型字符串规则没写** — chat 工程代码用 `useTranslations from "next-intl"`（实际是 Vite shim），但 prototype 用 babel-standalone 不能 import shim。约定缺失导致 prototype 作者纠结要不要假装写 `t()`。

24 个 panel 的高保真原型即将量产（已有 24 个 `frontend-*-hifi-redesign` spec 占位），需要先把 foundation 补齐。

## Goals / Non-Goals

**Goals:**

- 落地 `patterns/` 6 个跨模块 shell，让 24 个 panel 原型与工程实施都从同一组 shell 词汇出发
- 落地 `icons/` canonical 集合 + 选型决议进 stack-decisions Locked 段
- 在协议侧约定原型字符串规则，消除"原型要不要假调 `t()`"的反复纠结
- 把 agents pilot 已暴露的反哺候选写进 `design-system/proposals/` 等季度反哺日批量决议

**Non-Goals:**

- 不引入 routing / state / async / form / chart / code-editor 库（按 stack-decisions 规则等到第一个真实需要的 panel 进场再决议）
- 不重做 chat pilot 工程代码（chat 已落地稳定，本 change 不改它）
- 不动其余 12 个已迁移 panel 的工程代码（原始 cp 自 legacy frontend，重做由后续每个 panel 自己的 OpenSpec change 驱动）
- 不立即把 agents pilot 反哺候选促升为 atom / molecule（仅记录到 proposals 等批量评审）
- 不替换现有 36 个 atoms 的任何一个

## Decisions

### D1: patterns/ 平铺结构与 atoms/ 同构

`design-system/patterns/` 沿用 atoms/ 的扁平结构：`PageShell.tsx + page-shell.css` 同目录，barrel `index.ts` 导出。**不**用 `<Pattern>/<Pattern>.tsx + .module.css` 三件套。

**理由：** atoms 已经平铺并经过 chat pilot 验证；patterns 同构降低跨结构理解成本、保持工具链（drift / barrel / Gallery）一致。

**替代方案：** patterns 用 `<Pattern>/index.tsx + Pattern.module.css` —— 拒绝，因为引入第二种结构没有理由。

### D2: 6 个初始 pattern 的具体清单与最小职责

| Pattern         | 职责                                                           | 来源                      |
| --------------- | -------------------------------------------------------------- | ------------------------- |
| `PageShell`     | view 容器（max-width、padding、进场动画 200ms cubic-bezier）   | agents `.view`            |
| `NavRail`       | 左侧 module rail（64px 宽，brand + module list）               | 跨 panel 共享导航         |
| `TopBar`        | 顶部 brand + global actions + ⌘K 命令面板入口                  | 全局 chrome               |
| `EmptyState`    | icon + title + body + CTA（list / detail / search-empty 通用） | agents `.list-empty`      |
| `KbdHint`       | ⌘K / ⌘N 等键盘提示 chip                                        | agents `.kbd / .kbd-pair` |
| `SectionHeader` | h2 + hint + actions（detail section 通用）                     | agents `.section-title`   |

**理由：** 这 6 个都在 agents pilot 已重复实现。其他可能的 pattern（`ListShell` / `ConfirmDialog` / `StatusFooter`）暂不进 patterns，等第二个原型暴露同形态后再批量评估——避免单点过度抽象。

### D3: icon 库选型 = lucide-react

**决议：** 引入 `lucide-react` 作为 canonical icon 库。

**理由：**

- 1100+ icon、tree-shakeable（named import 即按需）、Inter 风格 stroke 与 design system 字体匹配
- 24 panel 的 icon 多样性（chart / chevron / cron-clock / file-tree / graph / network / etc.）手写 SVG 不可持续
- 社区使用最广，可维护性高
- bundle 影响：每个 named import ~300-500 bytes（vs 自研 SVG ~100 bytes），24 panel 平均用 30 个 icon ≈ +12 KB 全量 vs 30 个手写 ≈ +3 KB 全量。9 KB 差距换 1100+ icon 选择性，划算。

**替代方案：**

- 自研 SVG（agents 已有 17 个）—— 拒绝。每个原型再造 N 个、icon 风格漂移、不可持续。
- 混合：lucide 默认 + 特殊 SVG —— 拒绝。混合策略增加判断成本（哪些走 lucide、哪些自研？），不如全 lucide + 必要时 wrap。
- heroicons / phosphor / tabler / font-awesome —— 拒绝。lucide 是当前社区标杆，stroke 一致性最好。

**Wrap 约定：** 在 `design-system/icons/index.ts` 按 deck-go 域语义重命名 export（如 `IconAgent = User`、`IconStream = Radio`），让 panel 引用语义而非 lucide 原名，方便未来无痛切换。

### D4: pattern API surface = props 显式 + slot composition

每个 pattern 暴露：

- 必填 props：核心配置（title、icon、children）
- 可选 props：variant、size、tone（限定枚举）
- slot：通过 `children` / `actions` / `footer` 等 ReactNode 接收任意组合

**禁止：**

- 暴露内部 className 让外部覆盖
- 通过 props 接收原始 token 名（`bg-2`）—— 让 pattern 内部决策

**示例：**

```tsx
// EmptyState.tsx
export interface EmptyStateProps {
  icon: ReactNode; // slot
  title: string; // required text
  description?: string; // optional text
  action?: ReactNode; // slot
  tone?: "neutral" | "search" | "error"; // limited variant
}
```

### D5: 新增 pattern 的门槛 = "≥2 模块出现 + 显式 reuse 分析"

按 `design-system-feedback-loop` 的反哺判断标准，新 pattern 引入需要：

- ≥2 模块出现同形态（agents + 至少一个量产原型）
- 提案文件包含 reuse 分析（最近的现有 pattern / 为什么不能扩展 / 因此提议新增）
- 走 `frontend-handoff/design-system/proposals/` 通道

本 change 落地的 6 个 pattern 已经满足"agents 已实现 + 24 panel 原型即将复用"的双重信号，所以一次性进入 canonical。后续添加任何第 7 个 pattern 都必须重新走门槛。

### D6: 原型字符串规则 — hardcoded + 工程实施集中抽 i18n

**决议：**

- prototype 文件中**禁止**调用任何形式的 `t()` / `useTranslations`（包括 mock 实现）
- prototype 直接写显示文本（中文 / 英文，根据原型受众）
- 工程实施时由 Claude Code 一次性抽到 `frontend-new/src/i18n/{en,zh}.json`
- prototype 的 `interactions.md` / `states.md` 用同一份字符串作 source-of-truth

**理由：**

- prototype 用 babel-standalone，无法 import next-intl shim
- 假调 `t()` 会让原型作者发明 mock 语境工厂，浪费精力
- 工程实施时统一抽 i18n 比逐个翻译更便宜
- 视觉/交互保真度才是 prototype 的产出，i18n 是工程层关注

**约束：** prototype 不允许有"看起来像 i18n key 但其实是死字符串"的伪装（例如 `t("agents.title")` 写成字符串）。直接写人类可读文本。

### D7: stack-decisions 锁住 icon 库；其他 pending 项不动

本 change archive 时同步更新 `docs/project/stack-decisions.md`：

- `Icons` 从 Pending → **Locked**：`lucide-react`（版本随首次落地 commit 锁）
- 其他 Pending（routing / form / chart / code-editor）**保持不动**——按规则等到对应 panel 进场再决议

### D8: agents pilot 反哺候选记录但不立即促升

agents prototype 暴露的 molecule 候选：

- `Avatar`（含 emoji / initial / accent variant）
- `ListRow`（avatar + name + sub + meta + status pill）
- `StatusPill`（dot + label，含 busy pulse 动画）
- `FileRow`（icon + name + size，含 active variant）

**决议：** 这些 **不**在本 change 落地。它们进入 `frontend-handoff/design-system/proposals/2026-MM-DD-agents-reflowback-candidates.md`，等季度反哺日（≥2 panel 出现同形态后）批量评审。

**理由：** agents 是单点信号；过早提升会污染 atoms barrel。等第 2-3 个 panel 原型出现同形态再决议是单 atom 还是分 molecule。

## Risks / Trade-offs

| 风险                                                                        | 缓解                                                                                                             |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `lucide-react` 引入后 Vite tree-shake 失效，bundle 增量超预期               | 实施期间用 `pnpm build && bundle-analyzer` 验证；若不达标则回退到 D2 替代方案（仅引入 wrap 后的 ~30 icon 子集）  |
| 6 个 initial pattern 中某个抽象过早，第二个原型发现 API 不合身              | API 倾向 slot composition（D4），改起来加 prop 不破坏既有调用；首次破坏性 API 改动需要走 v2 atom 套路（不动 v1） |
| prototype 字符串规则与 chat 已落地代码不一致（chat 用了 `useTranslations`） | chat 已是工程代码（不是 prototype），规则只约束 prototype 阶段；chat 工程代码中的 i18n 用法不动                  |
| icon 语义重命名（`IconAgent = User`）让查找原 lucide icon 困难              | barrel 注释 `IconAgent` 旁标 `lucide:User`，并在 design-system/icons/README.md 列对照表                          |
| 6 个 pattern × a11y 测试增加测试时间                                        | atoms 测试已 240/240 全绿基线；patterns 测试 +6 不显著拖慢；如果跨过 16-worker 上限，单独 worker 调度            |

## Migration Plan

按 OpenSpec change 实施流程：

1. 落地 patterns/（6 个 + barrel + Gallery + 测试）
2. 落地 icons/（lucide 依赖 + wrap barrel + Gallery + 测试）
3. 更新 `docs/project/stack-decisions.md`（icon 库决议进 Locked）
4. 更新 `frontend-handoff/CLAUDE.md`（增加原型字符串规则段）
5. 创建 `frontend-handoff/design-system/proposals/2026-05-04-agents-reflowback-candidates.md`
6. 跑 `pnpm test:deck-ui && pnpm tsc --noEmit && bash deck-go/scripts/check-tokens-drift.sh` 全绿
7. 最后一步：archive change，spec 落进 `openspec/specs/`

**Rollback：** 如果 lucide-react 验证失败，patterns/ 可独立保留；icons 决议改成自研 SVG + 把 wrap layer 重写。stack-decisions.md 改回 Pending。

## Open Questions

- Q1：`NavRail` 和 `TopBar` 的 module 注册机制？目前 frontend-new 是 single-page 渲染（无 routing），module 切换走 `?panel=X` URL。是否在 patterns 内置注册表，还是让 panel 自己声明？
  - **倾向：** patterns 接受 `items` props（panel 注册由调用方负责），保持 patterns 无状态。等第一个真实 panel-router 进场（routing 库决议）再统一。
- Q2：`icons/` 是否需要 SVG sprite 优化？
  - **倾向：** 第一版 named import 直接用 lucide-react 默认，不做 sprite。bundle 不达标再说。
- Q3：`KbdHint` 是否要支持平台检测（macOS ⌘ vs Windows Ctrl）？
  - **倾向：** v1 接受 props 字符串，调用方自己 platform-detect；不做内置检测。等第二个原型出现 platform-detect 需求再 batch 升级。
