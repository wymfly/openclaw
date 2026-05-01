## Why

deck-go 即将以双 agent 协作模式（设计 agent 在 `frontend-handoff/` 出原型；Claude Code 在 `frontend/` 落工程）重构所有前端模块，但当前的三份 CLAUDE.md 协议是基于 legacy `dashboard/`（Next.js）想象写成的——硬编码了 next-intl / TanStack Query / Zustand / React Router 等真实仓库未采用的栈，目录结构与真实 `tokens/index.css` + 36 atoms canonical 不一致，且缺乏状态可观测性、漂移防护、复用 gate 等结构性约束。在第一个新模块开工前，必须把协议层修正到"和真实工程对齐 + 双方读完就能上手"的水平。

## What Changes

- 改写 `deck-go/frontend/CLAUDE.md`（不动现有 `frontend/`，先以 `frontend-new/CLAUDE.md` 形态新增；切换日才覆盖旧的）：去掉硬编码栈段落、改用扁平 atom 目录风格、Status 段写真实、加 orientation 路径
- 改写 `deck-go/frontend-handoff/CLAUDE.md`：去掉 next-intl/TanStack Query 等假设、加 8 条结构性增强（lite handoff / 反向签收 / atom 复用 gate / pattern 层 / 后端契约协商 / 冲突分级 / token drift CI / version lock）、加协作互惠原则、加 orientation 路径
- 改写 `deck-go/docs/CLAUDE.md`：Status 段更新、指向 `frontend-new` 与新增支撑文档
- 新增 `deck-go/docs/project/stack-decisions.md`：把 server-state / shared-state / routing / i18n 四项栈选择从协议解耦
- 新增 `deck-go/docs/project/current-state.md`：真实代码现状快照（chat pilot done、36 atoms canonical、tokens 实际内容、24 legacy panel 名单）
- 反向同步 `deck-go/frontend-handoff/design-system/tokens.css`：以真实 `frontend/src/design-system/tokens/index.css` 为 source 整段覆盖（修正之前 placeholder 草稿）
- 新增 `deck-go/scripts/check-tokens-drift.sh`：CI 用 token 漂移检测脚本（写脚本但暂不接入 CI 流水线）

## Capabilities

### New Capabilities

- `frontend-handoff-protocol`: deck-go 双 agent 协作（设计 agent ↔ Claude Code）的契约层——三份 CLAUDE.md + 支撑文档 + drift 防护 + orientation 规则的总和。规定双方目录所有权、交付包格式、翻译规则、token/atom 协同模式、状态发现路径、冲突处理流程

### Modified Capabilities

（无）

## Impact

- 文件：`deck-go/frontend/CLAUDE.md`（改）、`deck-go/frontend-handoff/CLAUDE.md`（改）、`deck-go/docs/CLAUDE.md`（改）、`deck-go/docs/project/{stack-decisions.md, current-state.md}`（新增）、`deck-go/frontend-handoff/design-system/tokens.css`（覆盖）、`deck-go/scripts/check-tokens-drift.sh`（新增）
- 协议消费者：所有未来对 deck-go 前端做改动的 agent 实例（设计 agent、Claude Code），落地点为这套 CLAUDE.md trio
- 不动：`deck-go/frontend/src/`（任何工程代码本 change 不修改）
- 依赖：本 change 是后续 `deck-go-frontend-new-scaffold` + `deck-go-chat-protocol-pilot` 的前置；archive 完成才能开下一个
