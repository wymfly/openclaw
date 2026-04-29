## Context

deck-go 前端目前每个 panel 各自维护视觉细节：`deck-ui-*` 命名分散在 panels/chat、panels/settings 等多个目录，颜色/间距通过 `theme.css` 统一但 className 调用规则不统一，复合组件（如 `MessageInput.tsx` 693 行、`SettingsPanel.tsx` 1072 行）耦合多个关注点，单元测试覆盖样式但不覆盖 a11y。

并行进行的 deck-go ↔ OpenClaw 后端协议适配工作在另一分支推进，尚未完成。当前 go 服务转发的 chat-typed 字段不全（缺 `cacheHit/cost` 等运行时观测字段，subagent lineage 是 flat 列表而非递归 tree）。

Claude Design pilot（详见 `docs/superpowers/specs/2026-04-29-claude-design-evaluation.md`）证明：在没有源码 attach 上下文的前提下，AI 设计工具的输出无法直接落地——但其输出反向揭示了 UI 想要、当前 deckapi 没有的字段，可作为后端待补清单。

本提案在不阻塞后端分支、不引入新 npm 依赖的前提下，把"全模块 UI 重设计 program"反转为"先建设计系统 + 用 chat 验证"，以 OpenClaw Gateway 协议（而非 deck-go go 服务当前实现）为前端类型 source of truth。

**Stakeholders:** wangym（owner）、deck-go go 服务分支负责人（异步收敛）、未来需要重做 UI 的所有 panel 维护者

## Goals / Non-Goals

**Goals:**

- 建立可被全 panel 复用的共享设计系统：tokens（颜色/间距/字号/密度/圆角）+ 18 个原子组件 + utility hooks，全部满足 a11y / i18n / dual-theme / dual-density 纪律
- 把"UI 想要的字段"在前端类型上一次性表达（optional + 优雅降级），不依赖后端先做
- 通过 chat 重构验证设计系统的可用性（chat 是覆盖 80% 通用 UI 模式的最复杂 panel，过 chat = 过 N 个其它 panel）
- 沉淀 Claude Design pilot 的可保留资产（3 个 UX 决定 + token 命名空间初稿 + State Matrix 交付方式），但不照搬 jsx/css
- 为后续 P3 阶段（其它 panel 的 Claude Design + attach codebase）打地基

**Non-Goals:**

- 不重设计 settings / models / channels / sessions / gateway-panel 等其它面板（待 chat 完成后单独提案）
- 不修改后端 Gateway 协议或 go 服务字段——前端以 Gateway 为终态参考，后端字段补齐由另一分支推进
- 不引入新 npm 依赖（包括 framer-motion / radix / shadcn 等）
- 不重写 zustand store 或 SSE / a2ui-bridge 通信层
- 不在本提案落实"流式 8 帧时间线动画"——动画系统留待后续提案
- 不实施"右抽屉浮窗化"以外的响应式断点革新——chat 当前断点策略沿用

## Decisions

### Decision 1: 全新 `ds-*` className 渐进替换 `deck-ui-*`

新建命名空间 `ds-*`（`ds-button` / `ds-block` / `ds-popover` 等）；chat panel 重构时所有引用切换到新前缀；旧 `deck-ui-*` 在 chat 范围内逐步删除；其它 panel 不动。

**Alternatives considered:**

- 保留 `deck-ui-*` 前缀但内部按设计系统重写：包袱缠身，无法清晰区分新旧
- CSS Modules / Tailwind 重起炉灶：改动量过大，超出本提案范围
- 完全不改类名只换 token：无法获得设计系统结构化收益

**Rationale:** 新前缀让 PR diff 清晰可见迁移进度；旧前缀仅保留在未迁移 panel，互不冲突。

### Decision 2: 直接扩展 `chat-types.ts`，Gateway-truth 字段 optional + UI 优雅降级

在 `deck-go/frontend/src/stores/chat-types.ts` 直接加 optional 字段（如 `RunMetadata.cacheHit?`、`RunMetadata.cost?`、`SubagentLineageNode` 视图层 `children?`），UI 在数据缺失时**隐藏对应 chip**（不显示 0、"—" 或 placeholder）。

**Alternatives considered:**

- 新建 `gateway-truth-types.ts` 让现有 chat-types 引用为 superset：双源维护成本高
- 等 generated types 同步：依赖 go 分支节奏，违背独立推进目标

**Rationale:** Optional 字段不破坏现有调用链；隐藏式降级比 placeholder 更符合"信息密度按数据可用性自适应"的设计纪律。

### Decision 3: chat-types 按 P2 组件实施需要逐步扩展，不预先全扩

**Alternatives considered:**

- P0 完成后一次性扩展全部 Gateway-truth 字段：先入为主可能猜错字段名/形状

**Rationale:** 实施每个组件时基于 capability map + 该组件实际渲染需要决定加哪些字段；避免引入"声明了但永不消费"的死字段。

### Decision 4: bundle 资产消化深度 = token + UX 决定 + atom 视觉对齐参考

每个原子组件**重写**（TS + a11y + i18n），但视觉**对齐** Claude Design 的 styles.css；不直接拷贝 jsx 实现；不直接 import 其 css。

**Alternatives considered:**

- 仅取 token + UX 决定，atom 完全自由发挥：损失视觉一致性优势
- 把 bundle 的 styles.css 作为 baseline 改造：保留大量 anti-pattern 类名，不利于长期维护

**Rationale:** 视觉一致是 Claude Design pilot 的最大资产，不宜丢；但 jsx 质量不达标必须重写。

### Decision 5: 设计系统目录命名为 `design-system/`

放置于 `deck-go/frontend/src/design-system/`，子目录：`tokens/`、`atoms/`、`hooks/`、`index.ts`。

**Alternatives considered:**

- `ds/`：太短不语义
- `ui/`：与 `deck-ui/icons` 冲突
- `components/shared/`：扁平化不利于规模化

**Rationale:** 语义最清，与 `panels/`、`stores/`、`api/` 等同级目录并列，作为基础设施可见。

### Decision 6: 三个 §13 UX 决定锁定（来自 chat-ui-redesign-design.md + Claude Design pilot 实证）

- **User 消息右对齐 IM bubble**（accent-tinted 背景，max-width 720px，左对齐保留作 Tweak 切换）
- **Tool_use + tool_result 合并为 paired 单卡**（共享外边框，error 整卡红边；split 留作 Tweak）
- **tool_result viewType 用 segmented control**（`raw / bash / read / diff` tabs）替代 ShowRaw 单按钮

**Rationale:** Claude Design 在 spec 没让它选的情况下主动给出这三个决定且都合理；右对齐符合 IM 直觉、paired 减少视觉噪音、segmented 让多视图发现性更高。

### Decision 7: tokens 名称沿用 Claude Design bundle 命名（`--bg-0..3` / `--text-1..4` / `--accent` 等）

**Alternatives considered:**

- 用 deck-go 现有 token 命名：现有命名不分层，扩展不便
- 改为 Tailwind 风格（`--gray-50..900`）：粒度太细，不符合应用层语义

**Rationale:** bundle 命名已经按"语义槽 + 强度等级"分层，可直接作为 design-system 第一稿，避免重新发明轮子。

### Decision 8: 不实施动画系统革新（流式 8 帧时间线、消息进出场、抽屉滑入等）

保留现有 cursor-blink + spinner，不引入 framer-motion。

**Rationale:** 动画系统是独立基础设施工作，应有自己的 spec；强行塞进本提案会扩大范围。

## Risks / Trade-offs

| Risk                                                                                            | Mitigation                                                                                           |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| chat-types 加 optional 字段与 generated types 冲突（go 分支后续也加同名字段但不同形状）         | 加字段时 grep `*.generated.{ts,go}` 确保不重名；与 go 分支负责人对齐 capability map                  |
| 新 `ds-*` className 在测试 selector 中需要批量更新                                              | P2 重构前用 explore agent 列所有 selector 引用清单；逐组件迁移                                       |
| 视觉回归：`?deckVisualState=chat-rich` 截图基线变化                                             | 接受基线重置；变更后立即更新 baseline 截图，避免 stale 审查                                          |
| design-system 18 个 atom 写完后发现某个不通用（仅 chat 用）                                     | P3 阶段第一个其它 panel 试用时 review 通用性，不通用的回流到 panel-specific                          |
| Claude Design pilot 产出的 atom 视觉与未来其它 panel 风格不匹配                                 | 第一稿 atom 视觉对齐 chat pilot；P3 需要时基于 Claude Design with attach codebase 重出 atom 视觉变体 |
| a11y 完备性：1 个 atom 漏 a11y 会污染所有 panel                                                 | 每个 atom 必须有 axe 测试；CI gate                                                                   |
| i18n key 漏：现有 i18n key 与 Claude Design bundle 文案不对齐                                   | 重构每个组件时 grep `chat.*` / `approvals.*` key 实际使用情况，必要时新增 key（不删除现有）          |
| 旧 `deck-ui-*` 在 chat 外仍被消费（如 chat panel 依赖共享样式）                                 | P2 起步前用 grep 列 chat 内引用的所有 `deck-ui-*` class 来源；如果来自共享文件，先抽到 design-system |
| 后端字段名/形状与前端 optional 字段不一致（go 分支用 `cacheHits` 复数 vs 前端 `cacheHit` 单数） | 类型扩展前查 OpenClaw Gateway protocol schema；以 Gateway 名称为准                                   |
| 渐进迁移期间，chat panel 内同时存在新旧 className 导致样式冲突                                  | P2 内每个组件迁移完成立即清理旧 className，不留半态；CI gate 通过 grep 检查                          |
| Claude Design bundle 资产（`/tmp/design-bundle/`）丢失                                          | bundle 已下载到 `/tmp`，且 download URL 可重新拉；评估文档附录 A 已记录路径                          |

## Migration Plan

本提案不涉及生产数据迁移。代码迁移按 4 个阶段：

**P0 — Gateway capability map（1 session）**

- 输出 `docs/superpowers/specs/2026-04-29-chat-gateway-capability-map.md`
- 4 路并行 explore agent：S1 OpenSpec / S2 RPC / S3 SSE / S4 数据契约
- 验收：4 路汇总后 chat 重构能引用的所有 Gateway 字段都有出处

**P1 — design-system 着陆（2 session）**

- 新建 `deck-go/frontend/src/design-system/{tokens,atoms,hooks}/` 目录
- 实施 18 个 atom（按依赖：基础态 → 容器 → overlay）
- 在 `theme.css` 顶部 `@import` design-system tokens
- 验收：design-system index.ts 导出 18 个 atom；axe + storybook-style demo 通过

**P2 — chat 重构（2-3 session）**

- chat-types 渐进扩展（按组件需要）
- 替换所有 chat panel 内 `deck-ui-*` 为 `ds-*`
- 落实 3 个 UX 决定（IM bubble + paired tool + segmented tabs）
- 重写测试 selector
- 验收：`pnpm typecheck` 绿；`pnpm test` 绿；visual seed 截图基线已重置

**P3 — out of scope（独立提案）**

- 其它 panel 用 Claude Design with attach codebase + design-system 实施

**Rollback：** 本提案以 git PR 切片合并；任意阶段失败可 revert PR 而不影响其它阶段。`design-system/` 目录自包含，删除后旧 `deck-ui-*` 仍工作。

## Open Questions

- [ ] design-system atom 是否提供 storybook 式 demo？（评估：用 visual-state-seed 模式即可，无需引入新 storybook 依赖）
- [ ] chat-types 扩展时是否同步更新 zod schema（如果有）？
- [ ] Claude Design `Tweaks panel` 是否值得在 deck-go 中保留作为 dev-only 工具？（评估：保留，但仅 `import.meta.env.DEV` 时启用，作为视觉调试工具）
- [ ] design-system 是否独立 npm package？（评估：本提案不独立，先 monorepo 内目录；P3 后视情况）
- [ ] visual seed `chat-rich` / `chat-empty` 数据是否需要扩展以覆盖 cacheHit/cost 等新字段？
- [ ] `deck-ui-*` 在其它 panel 使用情况下，theme.css 共享 token 与 design-system token 是否应对应映射？
