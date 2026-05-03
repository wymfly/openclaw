# deck-go Frontend Current State Snapshot

> 这份文件给第一次落地的 agent 一个 5 分钟看完即可上手的项目快照。**它不是状态记录系统、不是 journal、不是 changelog**——目录树才是真相。本文件按需手工更新，过期一两个版本不算 bug。

**Snapshot date:** 2026-05-04
**Authoritative state lives in:** 真实代码树本身。当本文件与代码冲突，**信代码**。
**Update cadence:** 每 1-2 月，或大变动后

---

## 一句话现状

deck-go 前端**协议层 v1 已落定**，**`frontend-new/` 物理工作区即将由 change 2 建立**，`frontend/` chat 模块 pilot 已稳定，**24 个 legacy panel 待重做**。

---

## 物理布局（现在）

```
deck-go/
├── docs/                            ← 你正在读这里的文档
│   ├── CLAUDE.md                    协议三入口之一（项目导航）
│   ├── project/
│   │   ├── stack-decisions.md       栈决策（解耦自协议）
│   │   ├── current-state.md         本文件
│   │   └── design-system-implementation-plan.md
│   ├── design-references/           视觉光谱锚点（claude.ai / linear / stripe）
│   └── skills/                      通用工作方法（不绑定 deck-go）
│
├── frontend/                        ← 真实工程（即将冻结，待 change 2 建立 frontend-new 后正式 frozen）
│   ├── CLAUDE.md                    带冻结提示，引导切换到 frontend-new
│   └── src/
│       ├── design-system/
│       │   ├── tokens/index.css     ⚓ canonical tokens（44 个 --ds-* 变量 + dark/light）
│       │   ├── atoms/               36 atoms（扁平 Badge.tsx + badge.css）+ __tests__/
│       │   ├── hooks/               5 hooks（use-click-outside / use-escape-close / use-focus-trap / use-keyboard-nav / use-popover）+ __tests__/
│       │   ├── dev/Gallery          design system 活样张（?dsGallery=1 路由）
│       │   └── index.ts             barrel
│       ├── components/panels/       25 个 panel 目录（chat 是 pilot，其余 24 个为 legacy）
│       ├── i18n/                    next-intl 配置（Vite 不兼容，protocol-v1 标记为 broken）
│       ├── deck-ui/                 早期 deck-ui App + icons.tsx
│       └── theme.css                legacy 8676 行老主题（不再扩展）
│
├── frontend-new/                    ← 协议入口存在，物理树由 change 2 建立
│   └── CLAUDE.md                    真实工程协议（本 change 创建）
│
├── frontend-handoff/                ← 设计 ↔ 工程交接区
│   ├── CLAUDE.md                    协议三入口之一（双 agent 协作协议）
│   ├── design-system/
│   │   └── tokens.css               与 frontend/.../tokens/index.css 反向同步（drift 防护）
│   ├── modules/                     已定稿模块交接包（chat 模块在 change 3 进入）
│   └── explorations/                设计探索区（Claude Code 不读）
│
├── scripts/
│   ├── check-tokens-drift.sh        ⚙ tokens 双向一致检查（本 change 创建；CI 接入推迟到 frontend-new 切换日）
│   ├── dev/                         run-bundled.sh / run-remote.sh / run-stack-real.sh
│   └── manage-local-stack.sh        E2E mock gateway 编排
│
├── backend/                         ← Go middleware (不在本文件 frontend 范围内)
└── contracts/                       ← deck-go 自有契约链路
```

## 关键事实

### Design system canonical（locked）

- **Tokens**: 44 个 `--ds-*` CSS 变量（type / spacing / radii / density / dark / light），位于 `frontend/src/design-system/tokens/index.css`
  - 命名空间 `--ds-*` 与 legacy `theme.css` 的 `--accent` / `--bg` 不冲突
  - 主题切换：`<html data-theme="dark|light">`；密度切换：`data-density="comfortable|compact"`
- **Atoms**: 36 个扁平结构（不是 `<Atom>/` 三件套）

  ```
  Badge / Banner / Block / Breadcrumb / Button / Card / Chip / Code /
  ContextMenu / DiffView / Drawer / DropdownMenu / FileInput / IconButton /
  Input / JsonTree / Markdown / Modal / Popover / ProgressBar / Radio /
  SegmentedControl / Select / SidebarRow / SkeletonLoader / Slider / Spinner /
  StreamingCursor / Tab / TableView / Tag / Textarea / Toast / Toggle /
  Tooltip / WaitingDots
  ```

- **Hooks**: 5 个（`use-click-outside` `use-escape-close` `use-focus-trap` `use-keyboard-nav` `use-popover`）
- **Patterns**: 6 个跨模块布局壳 — `PageShell` / `NavRail` / `TopBar` / `EmptyState` / `KbdHint` / `SectionHeader`（位于 `frontend-new/src/design-system/patterns/`，扁平结构 + barrel + a11y 测试）
- **Icons**: 24 个 canonical SVG，按 deck-go 域语义命名（`IconAgent` `IconStream` `IconBolt` 等），重导出自 `lucide-react ^1.14.0`（`frontend-new/src/design-system/icons/`）；面板/pattern 不许直接 import lucide
- **Gallery**: 设计系统活样张，运行时按 `?dsGallery=1` URL 参数走 lazy import；展示 36 atoms + 6 patterns + 24 icons
- **Dependency**: 字体走 `@fontsource/{inter,jetbrains-mono}` self-hosted（main.tsx 7 行 side-effect import）

### Chat 模块（pilot — 待协议化迁移）

- 实现位置：`frontend/src/components/panels/chat/`
- 状态：工程代码稳定运行，但**还没有走完整双 agent 协议**——这是 change 3（`deck-go-chat-protocol-pilot`）的目标
- 已知问题：i18n 用 `next-intl`（Next.js 专用库），在 Vite 工程下是 misconfiguration，change 3 期间临时改成内联字符串

### 24 个 Legacy panel（待重做）

```
activity / agents / alerts / api-explorer / approvals / budget /
channels / config / cron / docs / gateway / identity / logs /
memory / models / nodes / plugins / routing / sessions / settings /
skills / subagents / threads / usage / webhooks
```

每一个都需要走"双 agent 协议化重做" pipeline：设计 agent 在 `frontend-handoff/modules/<x>/` 出 6 件套 → Claude Code 翻译进 `frontend-new/src/components/panels/<x>/`。

### 工程基础（locked）

- Vite 7.1.x / React 19.2.x / TypeScript 5.9.x
- vitest-axe 0.1.x（atom 单测含 a11y）
- Path alias: `@/*` → `frontend/src/*`
- 主题/密度切换：HTML data attributes，不用 CSS-in-JS
- 详细决策见 `stack-decisions.md`

### Backend / Contracts

- 后端：Go middleware (`backend/`) — 与本文件前端范围不直接相关
- 契约：deck-go 自有链路（`contracts/source/deck-api.contract.ts` → `contracts/generated/`）
- 不与上一代 `dashboard/src/types/gateway-*.generated.ts` 共流水线

## 当前进行中的 OpenSpec change（本目录范围内）

| change                                  | 状态   | 含义                                                                                                                                           |
| --------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `deck-go-frontend-protocol-v1`          | 实施中 | 协议层 + 反向同步 tokens + drift 脚本                                                                                                          |
| `deck-go-frontend-new-scaffold`         | 待批准 | 建 `frontend-new/` 物理树（cp design system / 工程基础）                                                                                       |
| `deck-go-chat-protocol-pilot`           | 待批准 | chat 6 件套反推 + 物理迁移到 `frontend-new/`                                                                                                   |
| `deck-go-chat-agents-contract-typing`   | 实施完 | chat / agents 契约面收齐（TranscriptBlock union / activeApproval typed / 2 SSE event / 11 write DTO / codegen pointer 支持）；浏览器烟测待用户 |
| `deck-go-frontend-foundation-readiness` | 实施完 | patterns × 6 + icons (lucide-react) + 原型字符串规则 + agents pilot 反哺候选记录；24 panel 高保真原型量产前的 Phase 0                          |

可用 `openspec list` 看完整队列。

## 不再扩展的 legacy

| 路径                                                                                       | 状态                          |
| ------------------------------------------------------------------------------------------ | ----------------------------- |
| `frontend/theme.css`（8676 行）                                                            | 不再扩展；新模块走 `--ds-*`   |
| `frontend/src/i18n/` 用 `next-intl` 的部分                                                 | 待 stack-decisions 决议后替换 |
| 上一代 dashboard/ + dashboard typed client（`dashboard/src/types/gateway-*.generated.ts`） | 完全冻结，**与 deck-go 无关** |

---

## 怎么 5 分钟入门

1. 读本文件（~2 分钟）
2. `ls frontend/src/design-system/atoms/` 看实际 atom 名单（30 秒）
3. 读 `frontend/src/design-system/tokens/index.css` 顶到底（1 分钟）
4. `ls frontend-handoff/modules/`：哪些模块已交付？读其 README `Status:` 行（1 分钟）
5. 看 `openspec list`：当前哪些 change 在路上（30 秒）

不要在落地前阅读：legacy panel 源码、theme.css、`frontend/src/i18n/` 详情、上一代 dashboard。

---

## 给 agent 的 onboarding 提示

- 想做新模块 → 读 `frontend-handoff/CLAUDE.md`
- 想知道某个具体库当前用啥 → 读 `stack-decisions.md`
- 想知道某个 atom 长什么样 → 启 `frontend-new && npm run dev`，访问 `?dsGallery=1`（一旦 frontend-new scaffolded）
- 想看 chat 模块的工程参考 → 读 `frontend/src/components/panels/chat/`（也即将迁移到 frontend-new/，详见 change 3）
