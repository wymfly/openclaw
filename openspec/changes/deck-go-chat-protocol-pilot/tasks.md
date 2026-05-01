## 1. 前置确认

- [ ] 1.1 确认 change `deck-go-frontend-protocol-v1` 与 `deck-go-frontend-new-scaffold` 都已 archive
- [ ] 1.2 `cd frontend-new && npm run dev` 验证骨架仍可启动（baseline）

## 2. 阅读现状（反向倒推 6 件套的输入）

- [ ] 2.1 读 `frontend/src/components/panels/chat/` 全部源文件，记录组件树
- [ ] 2.2 读 `frontend/src/stores/chat*.ts`（chat-store、chat-types、chat-hooks、chat-preferences），记录状态模型
- [ ] 2.3 grep `frontend/src/components/panels/chat/` 全部 import 表面，列依赖文件清单（stores/hooks/api/lib/i18n/generated）
- [ ] 2.4 读 chat-api 相关文件，列后端 endpoint
- [ ] 2.5 确认 chat 当前 i18n 库（应为 next-intl，需读代码确认）

## 3. 反向倒推 6 件套

- [ ] 3.1 平移 prototype.html：cp `docs/design-bundles/2026-04-29-claude-design-chat-pilot/...prototype.html`（找正确路径）→ `frontend-handoff/modules/chat/prototype.html`
- [ ] 3.2 写 `frontend-handoff/modules/chat/components.md`：组件树（ChatPanel → SessionSidebar / ChatContextBar / MessageList / MessageInput / RightPanel / etc.）+ 每个组件的 props 接口
- [ ] 3.3 写 `frontend-handoff/modules/chat/states.md`：state shape（sessions Map / activeSessionKey / messages / streaming）+ 转换规则 + edge case（streaming → done / failed / killed / timeout / abort）
- [ ] 3.4 写 `frontend-handoff/modules/chat/interactions.md`：Cmd+F 搜索 / steer 快捷 / artifact 打开关闭 / canvas 自动展开 / SSE 状态显示 / empty state / error state / streaming dots
- [ ] 3.5 写 `frontend-handoff/modules/chat/api-usage.md`：fetchChatSnapshot / fetchSessionList / persistChatProjection / setSessionMessageSubscription + SSE protocol
- [ ] 3.6 写 `frontend-handoff/modules/chat/README.md`：Status 行（暂留 sha 占位）+ Depends on atoms 列表 + Backend endpoints + What this module does
- [ ] 3.7 在 6 件套头部统一加"⚠️ 倒推产物"提示，避免后续模块照抄认为是完整 design 流程

## 4. 物理迁移工程代码

- [ ] 4.1 cp `frontend/src/components/panels/chat/`（整目录）→ `frontend-new/src/components/panels/chat/`
- [ ] 4.2 cp 链式依赖：`frontend/src/stores/chat*.ts` 等 → `frontend-new/src/stores/`
- [ ] 4.3 cp 链式依赖：`frontend/src/hooks/use-command-discovery.ts` 等 → `frontend-new/src/hooks/`
- [ ] 4.4 cp 链式依赖：`frontend/src/lib/transcript-cache.ts` 等 → `frontend-new/src/lib/`
- [ ] 4.5 cp 链式依赖：`frontend/src/api/`（如有 chat 相关）→ `frontend-new/src/api/`
- [ ] 4.6 cp 必要的 generated/types：`frontend/src/types/` 或 `generated/` 中 chat 用到的部分

## 5. i18n 临时方案处理

- [ ] 5.1 grep chat 目录全部 `t('chat.*')` 调用，列待替换清单
- [ ] 5.2 读 `frontend/messages/{en,zh}.json` 中 `chat.*` key + 文案
- [ ] 5.3 把 chat 内所有 `t('chat.foo')` 替换为内联英文字符串（与 en.json 一致）
- [ ] 5.4 删除 chat 模块 next-intl 依赖（如 import 行）
- [ ] 5.5 在 `frontend-handoff/modules/chat/interactions.md` 加"i18n 临时内联，待 stack-decisions.md 决议后接入"段
- [ ] 5.6 在 `docs/project/stack-decisions.md` i18n 段标注当前临时方案 + 待决议状态

## 6. 接入 frontend-new 路由

- [ ] 6.1 修改 `frontend-new/src/main.tsx`：默认（非 dsGallery）渲染 `<ChatPanel/>`（替换 placeholder）
- [ ] 6.2 如必要，调整路由判断（保持极简，无 React Router）

## 7. 验证

- [ ] 7.1 `cd frontend-new && npx tsc --noEmit` 编译通过、无 missing import
- [ ] 7.2 `cd frontend-new && npm run dev` 启动；浏览器访问 `http://localhost:5175/` 看到 chat 三栏布局
- [ ] 7.3 mock 一条消息（或连真后端）验证 MessageList 渲染、消息样式 var(--ds-\*) 正确
- [ ] 7.4 验证 SSE 状态横幅、artifact 面板触发、search Cmd+F、steer 区域可访问
- [ ] 7.5 `cd frontend-new && npm run test:deck-ui` 全绿（含迁过来的 chat 测试）
- [ ] 7.6 `bash scripts/check-tokens-drift.sh` exit 0
- [ ] 7.7 视觉对照：在 `frontend/` (端口 5174) 和 `frontend-new/` (端口 5175) 同时打开 chat，肉眼对照核心视觉一致

## 8. 状态记录

- [ ] 8.1 `frontend-handoff/modules/chat/README.md` Status 行写入实际 commit sha
- [ ] 8.2 `frontend-new/CLAUDE.md` Status 段加 `chat: migrated (sha <commit>)`
- [ ] 8.3 `docs/CLAUDE.md` Status 段加 `protocol-v1 经过 chat 模块自我验证，可开放给其他模块`

## 9. 验证 + 提交

- [ ] 9.1 `openspec validate deck-go-chat-protocol-pilot` 通过
- [ ] 9.2 用 `scripts/committer` 单 commit："chat-protocol-pilot — migrate chat to frontend-new + 6-pack handoff package"
