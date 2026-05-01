# frontend-new/ — Real Engineering Workspace

> **Protocol version:** `protocol-v1` (2026-05-01)
> **Role of this file:** 真实工程协议（Claude Code 在 deck-go 真实仓库内的工作约定）
> **Sibling protocol entries:** [`../docs/CLAUDE.md`](../docs/CLAUDE.md)（项目导航）· [`../frontend-handoff/CLAUDE.md`](../frontend-handoff/CLAUDE.md)（双 agent 协作协议）
>
> 这是 deck-go 前端的**新真实工程区**——按 protocol-v1 重新组织的物理工作区。Claude Code 在这里写代码、跑测试、build & ship。
> 设计 agent **不**编辑这里；它在 `../frontend-handoff/` 出交付包，Claude Code 翻译进来。

---

## 协议 v1 关键事实

- **本目录的物理工程树由 OpenSpec change `deck-go-frontend-new-scaffold` 建立**。本文件先到位，方便 change 2 落地时有协议指引。
- 老 `../frontend/` 仍存在（包含 chat pilot 的工程代码 + 36 atoms canonical + tokens），有冻结提示，**新工作不要去那里**。chat 模块按 `deck-go-chat-protocol-pilot` 物理迁移过来后，老 `frontend/` 改名为 `frontend-legacy/`（独立 change，未来某次完成）。
- 协议**不绑定**具体库选择。当前栈见 [`../docs/project/stack-decisions.md`](../docs/project/stack-decisions.md)。
- 协议**不引入** STATE.md / INVENTORY.md / CHANGELOG.md。状态发现靠目录树和 module README `Status:` 行。
- Tokens canonical 在本目录的 `src/design-system/tokens/index.css`；`../frontend-handoff/design-system/tokens.css` 是 mirror，drift 由 `../scripts/check-tokens-drift.sh` 检测。

---

## Who maintains what

| Surface | Owner | Notes |
|---|---|---|
| `src/design-system/tokens/index.css` | Claude Code | 单一真相源。设计 agent 在 `../frontend-handoff/` **提议** 改动，Claude Code 应用。 |
| `src/design-system/atoms/` | Claude Code | 36 atoms（扁平：`Badge.tsx` + `badge.css` 同目录）+ `index.ts` barrel + `__tests__/`。设计 agent 读为参考。 |
| `src/design-system/hooks/` | Claude Code | 5 hooks（`use-click-outside` / `use-escape-close` / `use-focus-trap` / `use-keyboard-nav` / `use-popover`）+ barrel + 测试 |
| `src/design-system/patterns/` | Claude Code | 跨模块布局/壳组件（`NavRail` / `TopBar` / `PageShell` 等，按需建）。见 frontend-handoff `#4 Pattern 层`。 |
| `src/design-system/dev/Gallery` | Claude Code | 设计系统活样张，运行时 `?dsGallery=1` lazy import 进入 |
| `src/components/panels/<module>/` | Claude Code | 业务模块，每个 panel 一目录。设计 agent 不写在这里。 |
| `src/{stores,api,hooks,lib,generated,i18n}/` | Claude Code | 数据 + 逻辑。**具体库**见 stack-decisions。 |
| `tests/`、`__tests__/` colocated | Claude Code | 单测（含 vitest-axe a11y 检查）+ e2e |
| `vite.config.ts` / `tsconfig.json` / `package.json` | Claude Code | 构建 + 依赖 |

---

## How an agent should orient on landing here

> 协议规定：状态发现**只靠真实目录和文件**，不靠 journal。

**任何 agent，你刚打开这个目录，按这个顺序：**

1. 读这份 `CLAUDE.md`（你正在做）
2. `cat ../docs/project/stack-decisions.md` — 当前用什么库 locked
3. `cat ../docs/project/current-state.md` — 项目代码当前长什么样（5 分钟入门）
4. `ls src/design-system/atoms/` 或 `cat src/design-system/atoms/index.ts`（barrel） — 知道有哪些 atom 可复用
5. `cat src/design-system/tokens/index.css` — 全部 token swatch 在一份文件
6. `ls src/components/panels/` — 已实施模块清单；新模块要进这里
7. `ls ../frontend-handoff/modules/` + 读各 README `Status:` 行 — 哪些模块在 ready-for-implementation 队列

**找不到 INVENTORY.md / STATE.md 是设计预期。** 协议**禁止**这些 journal 文件存在。

---

## Architecture at a glance

> ⚠️ 此目录由 `deck-go-frontend-new-scaffold` change 建立物理树；当前阶段**仅本 CLAUDE.md 文件存在**。下面的目录结构是预期形态。

```
frontend-new/
├── CLAUDE.md                          ← this file
├── package.json                       ← Vite + React 19 + TS 5
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── index.html                         ← Vite entry
├── README.md                          ← 工作区简介（非协议）
├── scripts/                           ← 工程脚本（如 check-deck-ui-host.mjs）
└── src/
    ├── main.tsx                       ← entry（@fontsource side-effect import + dsGallery 路由）
    │
    ├── design-system/                 ★ 共享视觉层
    │   ├── tokens/
    │   │   └── index.css              ← single source: --ds-* CSS variables（dark/light/density）
    │   ├── atoms/                     ← 36 个扁平 atom（Badge.tsx + badge.css 同目录）
    │   │   ├── Badge.tsx
    │   │   ├── badge.css
    │   │   ├── ...（其余 35 个）
    │   │   ├── index.ts               ← barrel — 唯一权威 atom 清单
    │   │   └── __tests__/             ← 单测含 vitest-axe
    │   ├── hooks/                     ← 5 个 hook 平铺 + barrel + __tests__/
    │   │   ├── use-click-outside.ts
    │   │   └── ...
    │   ├── patterns/                  ← 跨模块布局/壳组件（按需建）
    │   ├── dev/Gallery                ← ?dsGallery=1 路由的活样张
    │   └── index.ts                   ← 整体 barrel
    │
    ├── components/
    │   └── panels/                    ← 业务模块
    │       └── <module>/              ← 每个 panel 一目录（陆续从 frontend-handoff 协议化迁入）
    │
    ├── stores/                        ← shared/UI state（具体库见 stack-decisions）
    ├── api/                           ← API client + 流（具体 server-state 库见 stack-decisions）
    ├── hooks/                         ← 模块外共享 hook
    ├── lib/                           ← 纯工具（无 React）
    ├── generated/                     ← codegen 输出（不手编）
    └── i18n/                          ← 文案（具体库见 stack-decisions——当前 broken/pending）
```

---

## Conventions

- **Language**：TypeScript strict mode
- **CSS**：tokens 是全局 CSS 变量（`--ds-*`）；component 样式与组件同目录、同名（kebab-case）。**禁止**生产代码用 inline style。
- **Naming**：
  - Components：`PascalCase.tsx`
  - CSS 文件：`kebab-case.css` 与组件同目录
  - CSS 变量：`--ds-<category>-<role>` (e.g. `--ds-bg-1`, `--ds-text-2`, `--ds-radius-md`)
  - Hook：`use-<kebab-case>.ts`
- **State**：本地 `useState` 用于组件内；跨组件库选择见 stack-decisions。**契约**：UI state 与 server state 分桶。
- **Routing / i18n / Form / Animation**：具体库见 stack-decisions
- **Testing**：Vitest 单测 (`*.test.ts(x)`) + vitest-axe a11y。Atom 单测 MUST 含 `axe.toHaveNoViolations()` 断言。
- **Imports**：用 `@/` alias 指向 `src/`（在 `tsconfig.json` + `vite.config.ts` 配置）
- **Atom 物理结构**：扁平（`Badge.tsx` + `badge.css` 同目录），**不是** `<Atom>/<Atom>.tsx + .module.css + index.ts` 三件套

---

## How design changes flow in

详细见 `../frontend-handoff/CLAUDE.md`。一句话流程：

```
设计 agent (in ../frontend-handoff/)
    │
    │  produces 6 件套：README / prototype.html / components.md /
    │                   states.md / interactions.md / api-usage.md
    │  (+ 可选 tokens-proposal.md)
    │
    ▼
Claude Code (here, in frontend-new/)
    │
    │  translates:
    │  - prototype HTML/JSX → real .tsx + .css
    │  - mock state → 当前栈的 store / async lib
    │  - 内联字符串 → i18n
    │  - 写测试（含 a11y）
    │  - 更新模块 README Status 行
    │
    ▼
ship
```

**反向签收（协议 #2）**：实施完毕通知设计 agent，由它视觉对照原型 vs 真实运行，签字 / 提 revision。这是闭环最后一步。

---

## Status

- **Protocol version**：`protocol-v1` (locked 2026-05-01)
- **物理工程树**：⏳ 待 OpenSpec change `deck-go-frontend-new-scaffold` 落地（cp 工程基础 + 整体迁移 design system canonical）
- **First module migration**：⏳ chat（待 OpenSpec change `deck-go-chat-protocol-pilot`）
- **Tokens canonical**：当前位于老 `../frontend/src/design-system/tokens/index.css`，change 2 期间整体迁过来；drift 防护脚本 `../scripts/check-tokens-drift.sh` 自动适配（一旦本目录的 `src/design-system/tokens/index.css` 存在，自动改用本路径）
- **24 legacy panel**：在老 `../frontend/src/components/panels/` 下；按协议化重做 pipeline 陆续迁入本目录
