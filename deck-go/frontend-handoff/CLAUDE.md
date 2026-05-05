# frontend-handoff/ — Design ↔ Engineering Bridge

> **Protocol version:** `protocol-v1` (2026-05-01)
> **Role of this file:** 双 agent 协作协议（设计 agent ↔ Claude Code）
> **Sibling protocol entries:** [`../docs/CLAUDE.md`](../docs/CLAUDE.md)（项目导航）· [`../frontend-new/CLAUDE.md`](../frontend-new/CLAUDE.md)（真实工程协议）
>
> 如果你是 **Claude Code**，先读这份。它告诉你怎么把设计 agent 产出的交付包翻译进 `../frontend-new/`。
> 如果你是 **设计 agent**，这个目录是你的交付面。所有要给工程的产出都放这里。
> 如果你是 **人类**，你是仲裁者。

---

## 协议 v1 关键事实

- 这套协议**不绑定具体技术栈**。具体用什么库（state / async / routing / i18n）见 [`../docs/project/stack-decisions.md`](../docs/project/stack-decisions.md)。协议只描述**契约**（"server state 与 UI state 分桶"），不描述**实现库**。
- 状态发现**只靠目录树和 README Status 行**。本协议**不引入** STATE.md / INVENTORY.md / CHANGELOG.md 等 journal 文件。代码就是真相，目录树就是状态。
- 一份 token 的真相在 `../frontend-new/src/design-system/tokens/index.css`（在 change 2 落定前临时位于 `../frontend/src/design-system/tokens/index.css`）。`design-system/tokens.css` 是 mirror，drift 由 `../scripts/check-tokens-drift.sh` 检测。
- 36 atoms 已 canonical（扁平结构 `Badge.tsx + badge.css`，不是 `<Atom>/<Atom>.tsx + .module.css + index.ts` 三件套）。
- 协议条款之外的具体技术栈版本看 `../docs/project/stack-decisions.md`；项目代码当下长什么样看 `../docs/project/current-state.md`。

---

## What lives here

```
frontend-handoff/
├── CLAUDE.md                        ← this file (协议)
├── design-system/                   ← DS source-of-design (proposals + previews)
│   ├── README.md
│   ├── tokens.css                   ← mirror of ../frontend-new/src/design-system/tokens/index.css
│   ├── preview.html                 ← single-page review canvas（all tokens + all atoms）
│   ├── atoms/                       ← atom prototypes (.html or .jsx) — 设计意图
│   │   └── <atom>/
│   │       ├── prototype.html
│   │       └── notes.md
│   └── proposals/                   ← pending changes 等 Claude Code 评审
│       └── 2026-MM-DD-<change>.md
│
├── modules/                         ← FINISHED handoff packages (one per module)
│   └── <module-name>/
│       ├── README.md                ← entry point: 含 Status 行（status 真相在这里）
│       ├── prototype.html           ← high-fidelity 单文件原型
│       ├── components.md            ← 组件树 + props 接口
│       ├── states.md                ← 状态机 + edge cases
│       ├── interactions.md          ← keyboard / hover / focus / empty / error / loading
│       ├── api-usage.md             ← 模块用到的 endpoints + payload + WS/SSE 协议
│       └── tokens-proposal.md       ← (optional) 模块需要的新 tokens
│
└── explorations/                    ← 未完成的设计探索（Claude Code: 不读）
    └── YYYY-MM-<topic>/
```

**The line is:** `modules/` 内全部是 ready-to-implement。`explorations/` 是设计 agent 的草稿盒，Claude Code 不要碰。

---

## Roles

| Role | What they do here |
|---|---|
| **设计 agent**（这个 Anthropic 项目里的 Claude） | 维护本目录全部内容。产出原型、写 handoff 文档、提议 token / atom / pattern 变更。**不**编辑 `../frontend-new/`。 |
| **Claude Code**（在 deck-go 仓库） | 读本目录，落到 `../frontend-new/src/`。可以拒绝/修订提案——`../frontend-new/` 的最终决策权在 Claude Code。实施完成后在模块 `README.md` 写一行 Status update。 |
| **人类** | 仲裁者。批准 token 变更、设计变体、解决双方分歧。 |

---

## 协作互惠原则（reciprocity）

双方**互为对方下一轮的输入**——这是双 agent 协议的根本。

- 设计 agent 不光在出第一版交付包：它的下一轮设计 **基于 Claude Code 实际落进 `../frontend-new/` 的代码 + Claude Code 留下的 `implementation-notes.md`**。"工程不能还原我设计"是错的提问，正确的提问是"工程为什么不能，设计要怎么改才能让它能"。
- Claude Code 不是单向消费者：它在实施过程中遇到 framework constraint / a11y / perf / API 现实差，要写 `implementation-notes.md`，**这就是设计 agent 下一轮的输入**。
- 因此本目录的 `modules/<x>/README.md` 不是"交付完就归档"——它是模块状态真相所在地，每一轮设计/实施都更新它。

具体落地见下方"协议增强 #2 反向签收"。

---

## How an agent should orient on landing here

> 协议规定：状态发现**只读真实目录和文件**，不读 journal。

**Claude Code，你刚打开这个目录，按这个顺序：**

1. 读这份 `CLAUDE.md`（你正在做）
2. `cat ../docs/project/stack-decisions.md` — 知道当前什么库 locked、什么 pending
3. `ls modules/` — 哪些模块已交付？挨个 `head modules/<x>/README.md` 看 `Status:` 行
4. `cat ../frontend-new/src/design-system/atoms/index.ts`（barrel） — 知道有哪些 atoms 可复用
5. `ls design-system/proposals/` — 有没有等审 token / atom 提案
6. 决定 next ticket：
   - 模块 README 写 `Status: ready-for-implementation` 或 `revised vN — pending implementation` → 下一个实施目标
   - `proposals/` 有未审提案 → 评审/合并

**不要读：** `explorations/`（设计 agent scratchpad）、任何 STATE.md / INVENTORY.md / CHANGELOG.md（**协议禁止它们存在**）。

**设计 agent，你回到这个目录，按这个顺序：**

1. 读这份 `CLAUDE.md`
2. 读 `../docs/CLAUDE.md` 看项目导航
3. `cat ../docs/project/current-state.md` — 知道项目代码当前长什么样（5 分钟入门）
4. `ls modules/` + 读 `Status:` 行 — 哪些模块已实施、上次实施 commit 是哪个、有没有 implementation-notes.md
5. 如果某模块有新的 implementation-notes：那是你**下一轮设计**的输入
6. 决定下一步：新模块 (`modules/<new>/`) 还是 DS 变更 (`design-system/proposals/`) 还是探索 (`explorations/YYYY-MM-<topic>/`)

---

## The handoff protocol (per module)

### 1. 设计 agent 完成模块

模块 ready-for-implementation 时，设计 agent 在 `modules/<name>/` 创建**全部 6 件套**。模块 `README.md` 是入口：

```markdown
# <Module Name>

**Status**: ready-for-implementation
**Design completed**: YYYY-MM-DD
**Designer**: design agent
**Depends on atoms**: Button, Input, Tag, ...
**New atoms needed**: (none | <list> — 必须先走 design-system/proposals/)
**New tokens needed**: (none | see tokens-proposal.md)
**Backend endpoints used**: (none | see api-usage.md)

## What this module does
<1-2 段中文/英文描述>

## How to implement
1. 浏览器打开 prototype.html，感受交互
2. 读 components.md（组件树 + props）
3. 读 states.md（状态机）
4. 读 interactions.md（keyboard / a11y / edge cases）
5. 读 api-usage.md（endpoints）
6. （如果有）合并 tokens-proposal.md

## Open questions for Claude Code
- ...
```

**Status 行的可能值（machine-readable，drift 防护工具会读）：**

- `ready-for-implementation` — 6 件套交付完整，等 Claude Code 实施
- `revised vN — pending implementation` — 设计 agent 修订过，N 是版本号
- `implemented (sha <commit-sha>)` — Claude Code 已落地，commit 是落地点
- `migrated (sha <commit-sha>)` — 工程代码物理迁移完成（在协议化迁移 pilot 时使用，例如 chat）
- `lite-handoff` — 走 Lite 通道（见增强 #1），跳过完整 6 件套

### 2. Claude Code 接手

读 README → 按顺序：
1. **浏览器开 prototype.html** — 感受交互、hover、动画。HTML 是视觉真相。
2. **读 components.md** — 组件树 + props。翻译进 `../frontend-new/src/components/panels/<module>/`。
3. **读 states.md** — 翻译状态机；具体 store 库**不在协议规定**，见 [`../docs/project/stack-decisions.md`](../docs/project/stack-decisions.md)。
4. **读 interactions.md** — keyboard handler / focus / empty / error / loading。
5. **读 api-usage.md** — 接 `../frontend-new/src/api/<module>.ts`。如果 endpoint 假设和后端真相不符，**走"协议增强 #5 后端契约协商"raise 流程**，禁止静默扭曲。
6. **如果有 tokens-proposal.md** — 先合并 token 到 canonical 文件再开始；用 `../scripts/check-tokens-drift.sh` 验证 0 漂移。
7. **写测试**（atom 单测含 vitest-axe；module 单测/e2e 按 stack-decisions 决议的框架）。
8. **更新模块 `README.md`** Status 行：`Status: implemented (sha <commit-sha>)`。

**Prototype parity evidence rule**：

模块实现完成不能只用 mock 页面截图或 Playwright 用例通过来证明"高保真对齐"。证据必须分三层记录：

- **Mock functional**：mock-backed `frontend-new` 页面能打开，关键文案/交互/错误检查通过，并保存截图。
- **Mock prototype parity**：active `prototype.html` 与 mock-current 页面在同一 viewport / locale / theme / nav 状态下截图，生成 side-by-side 对照和结构化 verdict。只有这一层能证明原型视觉对齐。
- **Real Gateway evidence**：真实 Gateway/BFF 链路的功能或视觉验证；环境、凭据、seed 数据问题可以熔断，但确定性的本地代码缺陷必须在当前模块修复。

如果 mock-current 和 prototype 有 material mismatch，Claude Code 要么修复，要么在 `implementation-notes.md` 或模块纠偏提案里记录 accepted exception（原型位置、生产文件位置、差异、原因、owner、分类）。单独的 `page.screenshot()` 只能算截图证据，不能算视觉签收。

### 3. Claude Code 不同意设计

`../frontend-new/` 最终决策权在 Claude Code。设计选择不实际（perf / a11y / framework / security）：
- 落一个工作版本 + 在 `modules/<name>/implementation-notes.md` 写为什么改
- 通知人类
- 可选：要求重设计——设计 agent 更新模块包

**禁止**：静默改写原型行为不留痕迹。要么照做，要么写下原因。

### 4. 设计 agent 修订

实施后修订（视觉调整 / 新变体 / 新状态）：
- 新版本进 `modules/<name>/`，README Status 行升版（`revised v2 — pending implementation`）
- 老 prototype 重命名为 `prototype-v1.html`
- Claude Code 重新对齐 → 落地后再次更新 Status

---

## Translation rules（HTML/JSX → TS/CSS）

设计 agent 写单文件 HTML（inline JSX via Babel standalone）。Claude Code 翻译。**具体库选择不在协议层**——下表只描述**契约**，具体当前用什么见 [`../docs/project/stack-decisions.md`](../docs/project/stack-decisions.md)。

| Prototype 写法 | 真实工程对应 | 库选择 |
|---|---|---|
| `<script type="text/babel">` inline JSX | `.tsx` 文件 | — |
| Inline `<style>` with `--ds-*` | 同名 kebab-case `.css`（如 `chat-panel.css`），与组件同目录 | 不强制 CSS Module（atoms 是平铺）；module 级看模块自己决定 |
| Hardcoded literal text | i18n 调用 | 见 **Prototype string rule** 子段；缩短时一次性抽到 `i18n/{en,zh}.json` |
| `useState` 全包大揽 | 本地组件状态 vs 跨组件状态分桶 | 本地 `useState` / 跨组件 see stack-decisions |
| Mock `setTimeout` async | 真实 server-state 库（fetch + cache + invalidation） | see stack-decisions |
| `fetch('/api/...')` mock | `src/api/<module>.ts` real client + 上层钩子 | see stack-decisions |
| 跨模块 shell（`PageShell` / `EmptyState` 等） | `@/design-system/patterns` 引用 | 见 **Sourcing patterns and icons** 子段；不在 panel 内重新发明 |
| Icon | `@/design-system/icons` 引用（按域语义命名，背后是 lucide-react） | 见 **Sourcing patterns and icons** 子段 |
| `localStorage` 直接访问 | typed `lib/storage.ts` helper | — |

**翻译时不能丢的事（设计决策，不是实现细节）：**
- **类名**：保留 prototype 的 kebab-case 类名，方便对照
- **Token 引用**：每个 `var(--ds-*)` 必须在 canonical tokens 文件存在；不存在先走 tokens-proposal
- **交互细节**：动画时长 / 缓动 / hover 延迟 / 快捷键
- **视觉层级**：12px 配 14px 不能擅自换成 16px 配 16px

### Prototype string rule

**一句话：原型 hardcode 显示字符串；工程实施时一次性抽 i18n。**

- prototype 文件 (`frontend-handoff/modules/<x>/*`) 直接写显示文本（中文 / 英文均可），**禁止** 调 `t()` / `useTranslations` / `import` 任何 `next-intl` / 自研 i18n shim
- prototype 不允许写"看起来像 i18n key 的死字符串"伪装（例如 `"agents.title"` 当文本）
- Claude Code 翻译时，从 prototype 提取所有 literal 文本，进 `frontend-new/src/i18n/{en,zh}.json`，组件代码改用 `useTranslations("...")`
- 提取在工程实施期一次性完成，**不**在原型阶段渐进抽取

举例：

```jsx
// ✅ Prototype 写法
<h1>Agents</h1>
<p>Configure agent identity and runtime policy.</p>

// ❌ 禁止 — 假装调 t()
<h1>{t("agents.title")}</h1>
const t = (k) => k;  // mock 工厂禁止

// ❌ 禁止 — 写死 i18n key 当文本
<h1>agents.title</h1>
```

完整规范见 `openspec/specs/frontend-prototype-strings-convention/spec.md`。

### Sourcing patterns and icons

跨模块共用的 shell（`PageShell` / `NavRail` / `TopBar` / `EmptyState` / `KbdHint` / `SectionHeader`）和 icon 一律从 design system 引用：

- patterns：`@/design-system/patterns`（barrel）
- icons：`@/design-system/icons`（barrel；按 deck-go 域语义命名 `IconAgent` / `IconStream` 等，背后 lucide-react）

模块 `components.md` MUST 列：
- `## Depends on canonical patterns` 段，列具体 pattern 名
- `## Depends on canonical icons` 段，列具体 icon 名

如果某模块需要新 pattern / icon：
- pattern：必须 ≥2 模块同形态 + reuse 分析（见 `design-system/patterns/README.md`），走 `design-system/proposals/` 提案，等批准后落到 design system
- icon：直接到 `design-system/icons/index.ts` 加新 lucide 重导出（README 表格同步），走 PR 评审；非 lucide 的特殊 SVG 走 `_custom/` 子目录

prototype **禁止** 在自己的 `<style>` 或 `.css` 里重新发明 PageShell 类等价的 layout 词汇——必走 `@/design-system/patterns`。

---

## Design system flow

| Source（设计 agent 编辑） | Mirrored to（Claude Code 落地） |
|---|---|
| `frontend-handoff/design-system/tokens.css` | `../frontend-new/src/design-system/tokens/index.css` |
| `frontend-handoff/design-system/atoms/<atom>/prototype.html` | `../frontend-new/src/design-system/atoms/<Atom>.tsx` + `<atom>.css`（**扁平结构**，无 `<Atom>/` 子目录）|

**Tokens 是双向同步项。** drift 由 `../scripts/check-tokens-drift.sh` 检测（exit 0 = 一致，exit 1 = 漂移）。

**Atoms 起源是 design-agent 原型；Claude Code 一旦 productionize，`../frontend-new/src/design-system/atoms/<Atom>.tsx` 就是 canonical**。

设计 agent 想改 atom：
1. 在 `frontend-handoff/design-system/atoms/<atom>/v2.html` 出 fork
2. `frontend-handoff/design-system/proposals/` 写 proposal
3. Claude Code 决定是否合并到 canonical

`frontend-handoff/design-system/preview.html` 是 review canvas，展示所有 token swatch + 所有 atom 变体——一眼看完整个 DS。

---

## 协议增强条款（v1 新增 8 条）

> 这 8 条填补主体协议主流程中没覆盖的边缘情况和结构性约束。

### #1 Lite handoff 通道

**适用：** 改动只触一个文件、纯 visual tweak（颜色 / spacing / hover state）、不改交互行为、不增 atom。

**形式：** 设计 agent 在 `design-system/proposals/YYYY-MM-DD-<change>.md` 写一段（≤ 200 字）描述 + 视觉对照（before/after 截图或一段 CSS diff），跳过完整 6 件套。Claude Code 直接评审 → 实施。

模块 README Status 行用 `lite-handoff` 标记。

### #2 反向签收（reverse sign-off）

**机制：** Claude Code 实施完毕，更新 Status 行加 commit sha。**设计 agent 接下来必须**：
1. 视觉对照 prototype.html vs 工程真实运行（截图或浏览器侧对比）
2. 在 `modules/<name>/README.md` 加一段 `## Reverse sign-off` 段落，写"匹配 / 偏离的具体点 / 是否接受"
3. 不接受的偏离 → 在同一文件写 revision request，Status 升版

**意义：** 没有反向签收的模块不算闭环。它把 Claude Code 写的 implementation-notes 与设计 agent 下一轮变更打通——这就是"协作互惠"的具体形式。

### #3 Atom 复用 gate

**规则：** 任何"新增 atom"提案 MUST 在 proposal 文件包含一段 reuse 分析：

```markdown
## Reuse analysis
- 当前 atoms 中**最近**的可扩展项：<Existing Atom>（路径：../frontend-new/src/design-system/atoms/<Existing>.tsx）
- 为什么扩展不行：<具体技术原因，例如"props 已经 4 个，再加变体超出单 atom 责任界"或"behavior 完全不同"等>
- 因此提议新增：<New Atom>
```

无 reuse 分析的提案 Claude Code 直接退回。

### #4 Pattern 层

**约定：** 跨模块复用的 layout / shell 类组件（`NavRail` / `TopBar` / `PageShell` / `ListShell` / `EmptyState` / `ConfirmDialog` 等）住 `../frontend-new/src/design-system/patterns/`，**不**住 `atoms/`（不是单元素），**不**住 `panels/`（不属于单模块）。

设计 agent 在 `design-system/patterns/` 子目录提议（与 `atoms/` 同一层级）；Claude Code 落到 `../frontend-new/src/design-system/patterns/<Pattern>.tsx`。

### #5 后端契约协商（不静默扭曲）

设计 agent 在 `api-usage.md` 假设的 endpoint / payload **不一定**和后端真相一致。如 Claude Code 实施时发现真相和假设差：

1. **不**静默改写设计原型的字段名 / 流程，**不**伪造前端 mock 让 UI 看起来对得上
2. 在模块下创建 `modules/<name>/api-discrepancy.md`，写明：
   - 设计假设（来自 api-usage.md）
   - 后端真相（contract / route handler 引证）
   - 对设计原型的影响（哪个交互不能照原样实现）
3. 通知人类决策：改设计 / 改后端 / 折中
4. 设计 agent 据此出 v2 — Status 升版

### #6 冲突分级

设计 agent 与 Claude Code 不同意时分三档：

| 档级 | 形式 | 处理 |
|---|---|---|
| **Framework blocker** | 设计选择被 React / Vite / a11y / 浏览器 API 阻断 | Claude Code MUST raise；走人类仲裁；不能强行 ship |
| **工程代价** | 实施成本远高于价值（perf / 包体 / 复杂度） | Claude Code 在 implementation-notes 写代价分析；设计 agent 决定是否调整 |
| **个人偏好** | "我觉得这样更好" | **不算 disagreement**；按设计原型执行 |

### #7 Token drift CI

`../scripts/check-tokens-drift.sh` 现在写好但**暂不接入** CI 流水线（双轨期间会误报）。`frontend-new/` 切换日完成后，由 `deck-go-frontend-new-scaffold` 后续 change 接入主 CI 强制阻断 drift commit。

### #8 Version lock

本协议顶部的 `protocol-vN` 号（当前 v1）写入 frontmatter 风格元数据行。

**约束：**
- 协议正在 revise（写新 version）期间，**不允许**新模块切入 handoff——避免设计 agent 按旧协议出包、Claude Code 按新协议接收，互不相认
- 协议升级走独立 OpenSpec change（如 `deck-go-frontend-protocol-v2`）；该 change archive 后才能开新模块的 handoff 流程

---

## Reference: Vite + React + TS specifics

设计 agent 不跑 vite——它只交单文件 HTML 原型。但原型应该**像**真实栈，让翻译机械化：

- **CSS 变量**：`var(--ds-bg-1)` —— 与生产同名
- **类名**：kebab-case，按模块 scope（如 `chat-shell__sidebar`）
- **组件形态**：function components，TS 风格 props 注释（`/** @param {string} variant */`）
- **State**：`useState` / `useReducer`——具体跨组件提升的库由 stack-decisions 决议
- **Async data**：用 `setTimeout` + Promise mock；具体真实库见 stack-decisions

**禁止假设：** 不要在 prototype 里硬编码 next-intl / TanStack Query / Zustand / React Router 等具体库的 API 形态——这些**不一定是当前栈**。Prototype 体现交互和视觉**契约**，不体现库 API。

---

## Status

- **Protocol version**: `protocol-v1` (locked 2026-05-01)
- **First pilot module**: `chat`（工程代码已稳定运行；6 件套反向倒推 + 物理迁移到 `frontend-new/` 是 OpenSpec change `deck-go-chat-protocol-pilot` 的范围）
- **Modules waiting in queue**: 24 legacy panel（agents / models / channels / sessions / logs / settings / 等）—— 等 chat pilot 验证协议在真实复杂度下可执行后开放
- **DS preview canvas**: 待落（`design-system/preview.html`）
- **Tokens canonical mirror**: ✅ 与 `../frontend/src/design-system/tokens/index.css` 反向同步（drift 脚本通过）
