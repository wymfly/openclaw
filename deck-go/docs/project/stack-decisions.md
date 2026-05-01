# deck-go Frontend Stack Decisions

> 这份文件解耦"协议"和"具体技术栈"。`frontend-handoff/CLAUDE.md` 和 `frontend-new/CLAUDE.md` 协议条款只描述契约（"server state 与 UI state 分桶"等），不绑定具体库。具体当前用什么库、哪些项还没决议——全部记在这里。

**Last reviewed:** 2026-05-01
**Owner:** Claude Code（在 deck-go 仓库内的实施者）
**Linked from:** `docs/CLAUDE.md` · `frontend-new/CLAUDE.md` · `frontend-handoff/CLAUDE.md`

---

## 状态约定

| 状态         | 含义                                           |
| ------------ | ---------------------------------------------- |
| `locked`     | 已落进真实工程并被多模块依赖；不轻易换         |
| `defaulting` | 暂时使用、未正式锁定，未来某模块进场可能换     |
| `pending`    | 尚未决议；遇到第一个真实需要时按"决议方法"决议 |

---

## Locked（已锁定，协议落定即生效）

| 决策                | 选择                                                | 来源/版本                                    | 备注                                                                                                     |
| ------------------- | --------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 构建器              | Vite                                                | 7.1.x                                        | `frontend/package.json`                                                                                  |
| UI 框架             | React                                               | 19.2.x                                       | 使用 `<StrictMode>`                                                                                      |
| 类型系统            | TypeScript strict                                   | 5.9.x                                        | `tsconfig.json` 已配 `strict: true`                                                                      |
| 单测框架            | Vitest                                              | （由 `scripts/run-vitest.mjs` wrapper 调起） |                                                                                                          |
| a11y 测试           | vitest-axe                                          | 0.1.x                                        | atoms 单测 + module 覆盖                                                                                 |
| 字体                | `@fontsource/inter` + `@fontsource/jetbrains-mono`  | 5.2.x（self-hosted woff2）                   | `main.tsx` side-effect import；离线/受限网络可用                                                         |
| 设计 token 命名空间 | `--ds-*`                                            | —                                            | 与遗留 `theme.css` 共存而不撞名                                                                          |
| 主题选择器          | `data-theme="dark"\|"light"` on `<html>`            | —                                            | 默认 dark                                                                                                |
| 密度选择器          | `data-density="comfortable"\|"compact"` on `<html>` | —                                            | 默认 comfortable                                                                                         |
| Token 单一来源      | `frontend/src/design-system/tokens/index.css`       | —                                            | `frontend-handoff/design-system/tokens.css` 是 mirror，drift 检测见 `scripts/check-tokens-drift.sh`      |
| Atom 物理结构       | 扁平 — `Badge.tsx` + `badge.css` 同目录             | —                                            | 而非三件套 `<Atom>/<Atom>.tsx + .module.css + index.ts`                                                  |
| Hook 物理结构       | `use-*.ts` 平铺 + `index.ts` barrel                 | —                                            | 当前 5 个 hook：`use-click-outside` `use-escape-close` `use-focus-trap` `use-keyboard-nav` `use-popover` |
| 路径别名            | `@/` → `frontend/src/`                              | tsconfig + vite.config                       |                                                                                                          |

## Defaulting（暂用，可能换）

| 维度                     | 当前事实                                                                                                                          | 评估状态             | 触发换的条件                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Shared/UI state          | （chat pilot 用 zustand —— 待 chat-pilot 迁移完毕从代码确认）                                                                     | 没有正式锁定         | 出现需要 atomic-level 选择器或 store-of-stores 的复杂模块时 reassess                                                |
| Side-effect / async data | （chat pilot 当前实现待确认）                                                                                                     | 没有正式锁定         | 出现 SWR / RPC 多端点编排需求时 reassess                                                                            |
| Routing                  | 当前 chat pilot 是 single-page 渲染（`?dsGallery=1` 用 URLSearchParams），没有正式 router                                         | 没有锁定             | 第二个 panel（agents 或 settings）进场时立即决议                                                                    |
| i18n                     | chat pilot 当前用 `i18n/provider` 和 `next-intl` 引用——但 `next-intl` 是 Next.js 专用库，**Vite 工程不能用**，是 misconfiguration | **broken**，需要决议 | chat 协议化迁移（change 3）期间，临时用内联英文字符串绕开；**stack-decisions 必须在该 change 完成前给出最终库选择** |

## Pending（尚未决议）

| 维度                                   | 何时需要决议                                      | 默认决议方法                                                     |
| -------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| Form 库（react-hook-form vs 自研）     | 第一个有复杂 form 的 panel（settings / channels） | 走 brainstorming skill；产出小 spec                              |
| Data table 库                          | 出现需要排序/虚拟滚动/列拖拽的 panel              | 同上                                                             |
| Animation 库（framer-motion / motion） | 出现 motion 决策不能用 CSS transition 表达的需求  | 默认尽量 CSS-only；framer 仅在必要时引入                         |
| Code editor（Monaco / CodeMirror）     | api-explorer / config-editor panel 进场           | brainstorming                                                    |
| 图标库（lucide / heroicon / 自研 SVG） | 第二个 panel 需要图标超过当前 icons.tsx 范围      | 默认沿用现有 `frontend/src/deck-ui/icons.tsx`；外部库引入需 spec |

---

## 决议方法

何时一个 `pending` / `defaulting` 项需要变成 `locked`？

1. **某 OpenSpec change 实施期间发现"此处必须有具体库决策才能继续"**——pause 实施，开 brainstorming
2. **brainstorming 产出 design.md（在 `docs/superpowers/specs/` 或本目录）** + 决议条目并入此文件 Locked 段
3. **首次落进代码的同一个 commit / PR 把本文件状态从 `pending` / `defaulting` 改为 `locked`**

不允许：在 panel 实施代码里直接装新库而不经过此文件。

---

## 修订历史

| 日期       | 变更                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------- |
| 2026-05-01 | 协议 v1 落定（OpenSpec change `deck-go-frontend-protocol-v1`）：建立此文件，把栈决策从协议解耦 |
