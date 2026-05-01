## 1. 前置确认

- [x] 1.1 确认 change `deck-go-frontend-protocol-v1` 与 `deck-go-frontend-new-scaffold` 都已 archive — 均已 archive (`2026-05-01-deck-go-frontend-protocol-v1` / `2026-05-01-deck-go-frontend-new-scaffold`)
- [x] 1.2 `cd frontend-new && npm run dev` 验证骨架仍可启动（baseline）— 启动成功端口 5175，Gallery + 占位 App 正常

## 2. 阅读现状（反向倒推 6 件套的输入）

- [x] 2.1 读 `frontend/src/components/panels/chat/` 全部源文件，记录组件树 — 111 文件，组件树完整记录在 components.md
- [x] 2.2 读 `frontend/src/stores/chat*.ts`（chat-store、chat-types、chat-hooks、chat-preferences），记录状态模型 — 状态机记录在 states.md（sessions Map / activeSessionKey / messages / streaming / approval / sse 全覆盖）
- [x] 2.3 grep `frontend/src/components/panels/chat/` 全部 import 表面，列依赖文件清单（stores/hooks/api/lib/i18n/generated）— 38 个 unique `@/` 路径
- [x] 2.4 读 chat-api 相关文件，列后端 endpoint — 13 个 endpoint 列在 api-usage.md（含 SSE 协议 14 种事件类型）
- [x] 2.5 确认 chat 当前 i18n 库（应为 next-intl，需读代码确认）— 确认：用 `useTranslations` from `next-intl`，通过 `src/compat/next-intl.tsx` shim 在 Vite 下跑

## 3. 反向倒推 6 件套

- [x] 3.1 平移 prototype.html：cp `docs/design-bundles/2026-04-29-claude-design-chat-pilot/...prototype.html`（找正确路径）→ `frontend-handoff/modules/chat/prototype.html` — 含全部 12 个 sibling 资产（tokens.css / styles.css / data.js + 8 .jsx）确保自包含
- [x] 3.2 写 `frontend-handoff/modules/chat/components.md`：组件树（ChatPanel → SessionSidebar / ChatContextBar / MessageList / MessageInput / RightPanel / etc.）+ 每个组件的 props 接口
- [x] 3.3 写 `frontend-handoff/modules/chat/states.md`：state shape（sessions Map / activeSessionKey / messages / streaming）+ 转换规则 + edge case（streaming → done / failed / killed / timeout / abort）
- [x] 3.4 写 `frontend-handoff/modules/chat/interactions.md`：Cmd+F 搜索 / steer 快捷 / artifact 打开关闭 / canvas 自动展开 / SSE 状态显示 / empty state / error state / streaming dots
- [x] 3.5 写 `frontend-handoff/modules/chat/api-usage.md`：fetchChatSnapshot / fetchSessionList / persistChatProjection / setSessionMessageSubscription + SSE protocol
- [x] 3.6 写 `frontend-handoff/modules/chat/README.md`：Status 行（暂留 sha 占位）+ Depends on atoms 列表 + Backend endpoints + What this module does
- [x] 3.7 在 6 件套头部统一加"⚠️ 倒推产物"提示，避免后续模块照抄认为是完整 design 流程 — 5 个 markdown 顶部均含 "Reverse-derived artifact" banner；README 单独说明 sister modules 必须走 forward 流程

## 4. 物理迁移工程代码

> 用户实施期决策：i18n 走方案 B（cp 整套 i18n + compat shim，不做 t() 内联手术），api.ts/stream-contract.ts cp 工作树（按"基于 frontend 资产收敛"思路），视觉验证按"还原到原 frontend 视觉效果"门槛——浏览器对比通过即可。

- [x] 4.1 cp `frontend/src/components/panels/chat/`（整目录）→ `frontend-new/src/components/panels/chat/` — 111 文件
- [x] 4.2 cp 链式依赖：`frontend/src/stores/chat*.ts` 等 → `frontend-new/src/stores/` — 整 stores 目录 cp（11 文件，含跨模块共享 store）
- [x] 4.3 cp 链式依赖：`frontend/src/hooks/use-command-discovery.ts` 等 → `frontend-new/src/hooks/` — 整 hooks 目录 cp（5 文件）
- [x] 4.4 cp 链式依赖：`frontend/src/lib/transcript-cache.ts` 等 → `frontend-new/src/lib/` — 整 lib 目录 cp（20 文件含 deck-client / 传输层 / 工具）
- [x] 4.5 cp 链式依赖：`frontend/src/api/`（如有 chat 相关）→ `frontend-new/src/api/` — frontend 没有 src/api/ 目录，api 是单文件 `api.ts`（cp）+ `api-types.ts`（cp）+ `stream-contract.ts`（cp）+ `api.chat-helpers.test.ts`（cp）
- [x] 4.6 cp 必要的 generated/types：`frontend/src/types/` 或 `generated/` 中 chat 用到的部分 — 整 types 目录 cp（1 文件 gateway-protocol.generated.ts）
- 增补：cp `frontend/src/i18n/` 整套（5 文件，i18n provider/config/messages/en/zh）+ `frontend/src/compat/` 整套（next-intl shim）+ `frontend/src/theme.css` legacy 主题 + `frontend/src/theme.ts` + `frontend/src/theme.test.ts` + `frontend/src/deck-ui/icons.tsx`（chat 唯一引用的 deck-ui 文件）+ `frontend/src/vite-env.d.ts`（vite/client 类型引用，缺失时 `import.meta.env` 类型不全）

## 5. i18n 临时方案处理

> 用户实施期决策：方案 B —— **不做** 154 处 t() 内联替换；改为整套 cp i18n + compat shim 进 frontend-new；恢复 vite.config / tsconfig / vitest.config 三处 `next-intl` alias。

- [x] 5.1 grep chat 目录全部 `t('chat.*')` 调用，列待替换清单 — 154 处
- [x] 5.2 读 `frontend/messages/{en,zh}.json` 中 `chat.*` key + 文案 — 实际位于 `frontend/src/i18n/{en,zh}.json`；整文件 cp 到 frontend-new
- [~] 5.3 把 chat 内所有 `t('chat.foo')` 替换为内联英文字符串（与 en.json 一致）— **方案 B 取消**：t() 调用保留不动，i18n 机器整套 cp
- [~] 5.4 删除 chat 模块 next-intl 依赖（如 import 行）— **方案 B 取消**：`next-intl` 通过 compat shim 继续工作；vite.config / tsconfig / vitest.config 恢复 alias 指向 `src/compat/next-intl.tsx`
- [x] 5.5 在 `frontend-handoff/modules/chat/interactions.md` 加"i18n 临时内联，待 stack-decisions.md 决议后接入"段 — 实际写为"i18n 临时沿用 next-intl-via-compat-shim，待 stack-decisions 决议后单独 change 替换"
- [x] 5.6 在 `docs/project/stack-decisions.md` i18n 段标注当前临时方案 + 待决议状态 — 已更新 Defaulting 段：`next-intl-via-compat-shim`

## 6. 接入 frontend-new 路由

- [x] 6.1 修改 `frontend-new/src/main.tsx`：默认（非 dsGallery）渲染 `<ChatPanel/>`（替换 placeholder）— 含 `<DeckRoot>` 包装；占位 App.tsx 保留待删（不再渲染）
- [x] 6.2 如必要，调整路由判断（保持极简，无 React Router）— 保持原有 `?dsGallery=1` URL-param 路由判断，无需改动

## 7. 验证

> 用户实施期决策：验证门槛对应放宽——"还原到原 frontend 的视觉效果"为最高门槛；功能性 e2e（消息发送、SSE 实时回包）在没有真后端的情况下不强求，列入后续 reverse sign-off 任务。

- [x] 7.1 `cd frontend-new && npx tsc --noEmit` 编译通过、无 missing import — exit 0
- [x] 7.2 `cd frontend-new && npm run dev` 启动；浏览器访问 `http://localhost:5175/` 看到 chat 三栏布局 — Vite v7.3.2 ready；playwright snapshot 渲染了 region "Chat workspace" + complementary sidebar + main toolbar + transcript region + dialog "Side drawer"
- [x] 7.3 mock 一条消息（或连真后端）验证 MessageList 渲染、消息样式 var(--ds-\*) 正确 — `?deckVisualState=chat-rich` 注入种子数据；snapshot 显示用户消息 "Open the canvas..." + assistant 消息 "I have the transcript..." + run metadata（gpt-5.4 / 12,440 输入 / 840 输出 / 3,200 缓存 / 流式中 7120m）
- [x] 7.4 验证 SSE 状态横幅、artifact 面板触发、search Cmd+F、steer 区域可访问 — DOM 含: BlockFilterBar (推理/工具/结果) · steer "跳转到引导" + 引导 textbox · 搜索 ⌘F button · 画布 drawer 含 a2ui-bridge surface · 需要审批 region 含 shell_command + 批准/始终批准/拒绝
- [x] 7.5 `cd frontend-new && npm run test:deck-ui` 全绿（含迁过来的 chat 测试）— `Test Files 91 passed (91) · Tests 641 passed (641)`（chat **tests** 全部通过；previous baseline 240 + 401 chat-related = 641）
- [x] 7.6 `bash scripts/check-tokens-drift.sh` exit 0 — 通过
- [x] 7.7 视觉对照：在 `frontend/` (端口 5174) 和 `frontend-new/` (端口 5175) 同时打开 chat，肉眼对照核心视觉一致 — playwright 双截图对比：chat panel 内部完全一致（同三栏 / 同 token bar / 同 transcript / 同 filter / 同 approval / 同 canvas）；唯一差异是 frontend 外层有 deck-ui shell（NavRail + HeaderBar），frontend-new 直接 fullscreen 渲染 chat——这是协议预期（deck-ui shell 是 frontend-only legacy host，故意不迁）

## 8. 状态记录

- [x] 8.1 `frontend-handoff/modules/chat/README.md` Status 行写入实际 commit sha — 写为 "migrated (sha pending)"，commit 后 follow-up 微调写实际 sha
- [x] 8.2 `frontend-new/CLAUDE.md` Status 段加 `chat: migrated (sha <commit>)` — 已更新："chat migrated"
- [x] 8.3 `docs/CLAUDE.md` Status 段加 `protocol-v1 经过 chat 模块自我验证，可开放给其他模块` — 已更新

## 9. 验证 + 提交

- [x] 9.1 `openspec validate deck-go-chat-protocol-pilot` 通过 — `Change 'deck-go-chat-protocol-pilot' is valid`
- [x] 9.2 用 `scripts/committer` 单 commit："chat-protocol-pilot — migrate chat to frontend-new + 6-pack handoff package"
