## ADDED Requirements

### Requirement: chat 模块必须在 modules/chat/ 下产出完整 6 件套

`deck-go/frontend-handoff/modules/chat/` SHALL 包含协议规定的全部 6 个文件，每个 MUST 满足以下内容标准：

- `README.md`：含 `Status:` 行 + `Depends on atoms:` 列表 + `Backend endpoints used:` 列表 + `What this module does` 段
- `prototype.html`：自包含可在浏览器打开的单文件原型（含 inline JSX + style + 模拟交互）
- `components.md`：组件树 + 每个组件的 props 接口（TypeScript 风格签名）
- `states.md`：状态机定义 + 状态转换规则 + edge case 列表
- `interactions.md`：键盘 / hover / focus / empty / error / loading / streaming 全行为规格
- `api-usage.md`：所有后端 endpoint + request/response payload + WebSocket/SSE 协议

#### Scenario: 6 件套清单完整

- **WHEN** `ls frontend-handoff/modules/chat/`
- **THEN** 输出 MUST 至少包含 README.md / prototype.html / components.md / states.md / interactions.md / api-usage.md 六个文件

#### Scenario: README Status 行格式

- **WHEN** 读 `frontend-handoff/modules/chat/README.md` 顶部
- **THEN** 第一段 MUST 包含一行 `Status: migrated (sha <commit-sha>)` 或 `Status: implemented (sha <commit-sha>)`

#### Scenario: prototype 自包含

- **WHEN** 把 `prototype.html` 拷贝到任意目录用浏览器打开
- **THEN** 页面 MUST 能完整渲染，无外部资源加载错误（除 CDN 字体外）

### Requirement: chat 工程代码必须完整迁移到 frontend-new

`frontend/src/components/panels/chat/` 中所有源文件 MUST 复制到 `frontend-new/src/components/panels/chat/`。所有间接依赖（stores/hooks/api/lib/types）SHALL 链式追溯并一并迁移。迁移后 `frontend-new` 的 TypeScript 编译 MUST 通过，无 missing import 错误。

#### Scenario: 链式依赖完整

- **WHEN** `cd frontend-new && npx tsc --noEmit`
- **THEN** 编译 MUST 成功无 error，无 `Cannot find module` 错误

#### Scenario: chat 文件计数一致

- **WHEN** 比较 `frontend/src/components/panels/chat/` 与 `frontend-new/src/components/panels/chat/` 文件数
- **THEN** 两者数字 MUST 相等

### Requirement: chat 在 frontend-new 中可渲染可交互

`frontend-new` dev server 启动后，chat 模块 MUST 能渲染并保持与原 frontend 相同的核心行为：消息列表、消息输入、SSE 状态、artifact panel、空状态。

#### Scenario: chat 路由渲染

- **WHEN** 浏览器访问 `http://localhost:5175/`（或约定的 chat 路径）
- **THEN** chat 三栏布局（sidebar | main | optional right-panel）MUST 渲染

#### Scenario: 消息列表渲染

- **WHEN** mock 一条消息进入 store
- **THEN** MessageList 组件 MUST 渲染该消息，样式 var(--ds-\*) tokens 生效

#### Scenario: 测试套件含 chat

- **WHEN** `npm run test:deck-ui`
- **THEN** 迁移过来的 chat 单元测试 MUST 全部通过

### Requirement: i18n 临时方案有明确跟进项

如果原 chat 使用 `next-intl` 等 Next.js 专用 i18n 库，本 change 期间 SHALL 临时把 `t('chat.*')` 调用替换为对应英文/中文内联字符串（保持视觉一致），并在以下文件标注待跟进：

- `frontend-handoff/modules/chat/interactions.md`：标注"i18n 临时内联，待 stack-decisions.md 决议后接入"
- `docs/project/stack-decisions.md`：i18n 选型作为待定项列出

#### Scenario: chat 文案显示

- **WHEN** 浏览器渲染 chat 页面
- **THEN** 所有用户可见文本 MUST 显示为可读字符串（非 `chat.foo` 这样的 i18n key）

#### Scenario: 跟进项有记录

- **WHEN** 读 `docs/project/stack-decisions.md`
- **THEN** "i18n" 段 MUST 标注当前临时方案 + 待决议状态

### Requirement: tokens drift 必须保持 0

本 change 完成后，`scripts/check-tokens-drift.sh` SHALL 在 commit 前后均返回 0（chat 迁移不会触发 tokens 漂移，因为 tokens 在 change 2 已经一并迁好且不应被本 change 改动）。

#### Scenario: drift 检查通过

- **WHEN** 在 chat 迁移完成的 commit 上跑 `scripts/check-tokens-drift.sh`
- **THEN** exit code MUST 为 0

### Requirement: 协议必须经过 chat 复杂度验证后才允许开放给其他模块

本 change archive 后，`docs/CLAUDE.md` 的 Status 段 MUST 标注"protocol-v1 经过 chat 模块自我验证，可开放给其他模块"。在此之前不允许开任何 agents/settings/models 等模块的协议化重做 change。

#### Scenario: docs 状态更新

- **WHEN** 读 `docs/CLAUDE.md` archive 后版本
- **THEN** Status 段 MUST 含一行确认 protocol-v1 已被 chat 验证

#### Scenario: 后续模块的 change 准入

- **WHEN** 任何 agent 想为非 chat 模块（如 agents）创建 OpenSpec change
- **THEN** 该 change 的 proposal MUST 在 Why 段引用 chat-protocol-pilot 完成事实，证明协议已 ready
