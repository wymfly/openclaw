## Why

protocol-v1 的双 agent 协议必须先用**一个真实模块自我验证**才有资格开放给其他 23 个 panel 的重做——否则下一次设计 agent 开 agents 模块时，会发现协议条款在真模块复杂度下不可执行。chat 是 deck-go 唯一经过 Claude Design pilot 的模块，工程实现已稳定，是把"协议倒推到 6 件套交付包 + 物理迁移到 frontend-new"两件事一起做的最佳样本。chat 完成后，未来开任何新模块只需要一句"读 frontend-new design-system + chat 模块示例 + 你的契约"，设计 agent 就能输出可机械翻译的原型。

## What Changes

- 在 `deck-go/frontend-handoff/modules/chat/` 创建协议规定的 6 件套（status: migrated）：
  - `README.md`：Status / 依赖 atoms / 后端 endpoints
  - `prototype.html`：从 `docs/design-bundles/2026-04-29-claude-design-chat-pilot/` 平移（自包含）
  - `components.md`：从真实 `ChatPanel.tsx` 反推组件树 + props 契约
  - `states.md`：从 `chat-store.ts` + `chat-types.ts` 反推状态机 + edge case
  - `interactions.md`：键盘 / hover / focus / empty / error / loading 行为清单（Cmd+F 搜索、steer 快捷、SSE 状态等）
  - `api-usage.md`：从 `chat-api.ts` 列后端 endpoint + payload
- 物理迁移 chat 工程代码：`frontend/src/components/panels/chat/` → `frontend-new/src/components/panels/chat/`
- 链式追溯迁移 chat 依赖：相关 `stores/`、`hooks/`、`api/`、`lib/`、`i18n/` 文件按 chat 实际 import 链平移
- 在 `frontend-new/CLAUDE.md` Status 段加一行：`chat (migrated, sha <commit>)`
- 验证：在 `frontend-new` 里 chat 路由能跑、消息能渲染、token drift CI 通过、`test:deck-ui` 全绿

## Capabilities

### New Capabilities

- `chat-handoff-package`: chat 模块在 `frontend-handoff/modules/chat/` 下的完整 6 件套交付包——既是 chat 自身的设计真相档案，也是协议下任何后续模块的"标准范例"。设计 agent 读这一包就知道完整 handoff 是什么形状

### Modified Capabilities

（无）

## Impact

- 文件：`deck-go/frontend-handoff/modules/chat/*`（新建 6 件套）；`deck-go/frontend-new/src/components/panels/chat/`（迁入工程代码）；`deck-go/frontend-new/src/{stores,hooks,api,lib,i18n}/...`（chat 依赖）；`deck-go/frontend-new/CLAUDE.md`（Status 段更新）
- 工程：`frontend-new` 第一次有真实业务模块；chat 行为应与 `frontend/` 现状视觉一致
- 协议自我验证：本 change 完成后，协议 v1 视为"经过真模块复杂度检验"，可开放给 agents/settings/models 等模块依次走流程
- 依赖：依赖 change 1（协议）+ change 2（frontend-new 骨架）archive 完成
- 不影响：`deck-go/frontend/` 不删、不动、双轨并存到未来切换日
