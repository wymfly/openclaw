## Context

protocol-v1 + frontend-new 骨架就位后，必须用一个**真实模块**自我验证整套协议——否则下次开 agents 模块时会发现协议条款在真复杂度下不可执行。chat 是 deck-go 唯一经过 Claude Design pilot 的模块，工程实现已稳定（在 `frontend/src/components/panels/chat/`），它是把"协议倒推到 6 件套交付包 + 物理迁移到 frontend-new"两件事一起做的最佳样本。

本 change 完成后，未来开任何新模块只需要一句 prompt：「读 `frontend-new/src/design-system` + `frontend-handoff/modules/chat/` + 该模块契约」，设计 agent 就能输出可机械翻译的原型——chat 6 件套是协议自我教学材料。

## Goals / Non-Goals

**Goals:**

- 在 `frontend-handoff/modules/chat/` 建立完整 6 件套，作为协议下"标准范例"
- 把 chat 工程代码及其链式依赖物理迁移到 `frontend-new/`
- 在 frontend-new 里 chat 路由能跑，与 frontend 现有 chat 行为一致
- 验证：协议在 chat 这种真实复杂度（SSE / artifact panel / steer / canvas / 搜索）下确实可执行

**Non-Goals:**

- 不重新设计 chat（视觉/交互/状态机沿用现有）
- 不迁移其他 23 个 panel（独立 changes）
- 不在 frontend 里修改 chat（双轨保持）
- 不修改后端 / chat-api endpoints

## Decisions

### Decision 1: 6 件套是"反向倒推"，不是"前向设计"

chat 的协议产物 SHALL 由真实工程代码反推得出，prototype.html 直接平移自 `docs/design-bundles/2026-04-29-claude-design-chat-pilot/`。components.md / states.md / interactions.md / api-usage.md 由阅读真代码生成——这是协议第一次"工程倒推到设计"，未来其他模块都是"设计下行到工程"，所以本流程是协议的**两个方向**都跑通了。

### Decision 2: prototype.html 平移到 modules/chat/，而非 symlink

**选项**: (A) symlink 到 `docs/design-bundles/...` / (B) cp 平移让 modules/chat/ 自包含

**选 B，理由**: 协议规定 modules/<x>/ 是自包含交付包，外部 reader 不应跨目录跳转才能读到 prototype。代价：design-bundles 和 modules/chat/ 各有一份，但 design-bundles 是历史档案（不再修改），modules/chat/prototype.html 是协议交付件，分工明确。

### Decision 3: 链式依赖追溯策略

chat 工程代码 import 的所有相对路径（`./...`）和 `@/...` alias 路径都要追溯并迁移：

1. `frontend/src/components/panels/chat/*` 全部
2. `chat/` 内部 import 的 `@/stores/chat*`、`@/hooks/use-*`、`@/lib/*`、`@/i18n/*` 等
3. 间接依赖（B 用了 A，A 也要迁）
4. messages/{en,zh}.json 中的 `chat.*` key 全部

工具：`grep -rh '^import' frontend/src/components/panels/chat/ | sort -u` 列 import 表面，递归追溯。

### Decision 4: chat 在 frontend-new 中的路由占位

`frontend-new/src/main.tsx` 的占位 App（来自 change 2）需要扩展：访问 `/chat` 或默认根路径渲染 `<ChatPanel/>`。**不引入 React Router**——用最简单的 URL 判断（chat 是当前唯一模块，无需正式 router 直到 agents 模块进入时再决议）。

### Decision 5: i18n 当前栈的处理

如果 chat 现在用 next-intl（看代码确定），frontend-new 不能装 next-intl（next-intl 是 Next.js 专用）。三种处理：

- (A) chat 改成简单 dict（自研最小 i18n）
- (B) 装 react-i18next，迁移 messages
- (C) 临时硬编码英文文案，等 stack-decisions.md 决议后再处理

**选 C 作为本 change 临时方案**，因为 i18n 决议本属 stack-decisions.md，本 change 不应包含栈选型。落地时在 chat handoff 包的 `interactions.md` 标注"i18n 待 stack-decisions 决议"，工程上把 `t('chat.foo')` 改成内联英文字符串（最小修改）；后续 i18n 决议下来时单独 change 接入。

### Decision 6: STATE 在 README 而不是元数据系统

`frontend-handoff/modules/chat/README.md` 顶部按协议格式写 `Status: migrated (sha <commit>)`。这一行就是协议规定的状态发现入口，不需要任何 dashboard。

## Risks / Trade-offs

- **风险**: chat 链式依赖庞大（store / hooks / api / lib / i18n / generated），可能漏迁  
  **缓解**: 用 `tsc --noEmit` 全量编译验证；漏迁会导致 import 失败，编译期发现
- **风险**: chat 的 store 用 zustand（猜测），但 stack-decisions.md 还没决议  
  **缓解**: 现有 zustand 直接迁移；stack-decisions.md 同步在本 change 期间补充"shared state: zustand（chat 沿用）"
- **风险**: chat 用了 next-intl，去 i18n 改成内联字符串可能丢失部分 key  
  **缓解**: 先 grep 列出全部 `t('chat.*')` 调用，逐项替换为对应英文文案；视觉对照 `frontend/` 已有 chat 页面
- **风险**: 6 件套反向倒推质量参差，未来 agents 模块的设计 agent 拿来当模板会带偏  
  **缓解**: 写完后 Claude Code 自审 + 标注"⚠️ 倒推产物，非完整 design 流程产出"
- **风险**: 迁移过程发现协议 v1 有缺陷  
  **缓解**: 协议 v1 在本 change 期间允许 minor revision；major 缺陷则停止本 change，回到 protocol-v1 修协议（按协议 v1 自身规定的 version lock 条款）

## Migration Plan

### Phase A: 反向倒推 6 件套

1. 平移 prototype.html 到 `frontend-handoff/modules/chat/prototype.html`
2. 阅读 `ChatPanel.tsx` 写 `components.md`（组件树 + props）
3. 阅读 `chat-store.ts` + `chat-types.ts` 写 `states.md`
4. 阅读交互相关文件写 `interactions.md`
5. 阅读 `chat-api.ts` 写 `api-usage.md`
6. 写 README.md（Status / 依赖 atoms / endpoints）

### Phase B: 链式依赖追溯

7. grep imports，列依赖文件清单
8. 同时检查 messages/ 和 i18n 配置

### Phase C: 工程代码迁移

9. cp `frontend/src/components/panels/chat/` → `frontend-new/src/components/panels/chat/`
10. cp 依赖的 stores/hooks/api/lib 文件
11. （临时）将 `t('chat.*')` 替换为内联英文（按 Decision 5）
12. 修改 `frontend-new/src/main.tsx`：渲染 `<ChatPanel/>`
13. `cd frontend-new && npm run dev` 验证 chat 页面渲染、消息流、artifact panel、SSE
14. `npm run test:deck-ui` 验证测试通过
15. 跑 `scripts/check-tokens-drift.sh`（应返回 0）

### Phase D: 状态记录

16. `frontend-handoff/modules/chat/README.md` 写 `Status: migrated (sha <commit>)`
17. 在 `frontend-new/CLAUDE.md` 项目状态段加 `chat: migrated`

**回滚**: 单 commit `git revert`，老 frontend/ 完全未动。

## Open Questions

- chat 用 next-intl 还是别的 i18n？需读代码确认
- chat 用 zustand 还是别的 store？需读代码确认（虽然 ChatPanel.tsx 显示了 `useChatStore`，看起来是 zustand）
- generated/ 目录是否要迁移？取决于 chat 是否依赖 generated 类型
- chat-api.ts 调的后端 endpoint 列表完整吗？需扫一遍全部 fetch 调用
