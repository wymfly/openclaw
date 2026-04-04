## Context

当前 Deck 的 transcript 渲染有三个根问题：

1. **Gateway 对外 surface 没有 canonical transcript contract**
   - `chat.history` 的 `content` 在协议层是 `Type.Unknown()`
   - `session.message` / `session.tool` 虽然是 Deck 关键数据源，但没有供浏览器消费的正式 block/message schema
   - Gateway 内部存在多种等价形态：`string`、单对象 block、block 数组、`toolCall`、`toolResult`、`input_text`、`output_text`、结构化 `tool result`

2. **Deck ingestion 分散**
   - `dashboard/src/components/panels/chat/history-normalize.ts`
   - `dashboard/src/stores/chat-dispatchers.ts`
   - `dashboard/src/stores/sessions.ts`
   - `reloadFullContent()` 的特殊 merge 逻辑
   - 上述入口对同一类 payload 做了不同假设

3. **Deck rendering 没有注册表**
   - `MessageList` 只显式消费少数 block type
   - `ToolResultCard` 只接受字符串
   - 未知 block 既没有编译期穷举约束，也没有统一 fallback card

结果是：**相同 transcript state 在 chat 页、reload 后、Sessions 面板中不能保证得到相同 UI**。这与 `deck-chat-flow-closure` 想要的“历史会话和实时会话一致”目标矛盾。

## Goals / Non-Goals

**Goals**

- 为 Deck-facing transcript 和 session event 定义 canonical wire contract
- 让 `chat.history`、`session.message`、`session.tool`、snapshot、reload、Sessions 面板共享一套 transcript ingestion
- 让 Deck 为每个 canonical block type 提供显式 renderer，并对未知 block 做可读 fallback
- 让“新增 Gateway block type 时 Deck 漏接”在编译期或测试期暴露，而不是运行时靠 JSON 泄漏发现
- 在不迁移现有 transcript 存储格式的前提下，完成 Gateway 输出面的规范化

**Non-Goals**

- 不重做聊天页视觉设计
- 不改 Deck access token / stream auth 模型
- 不强制重写历史 transcript 文件格式
- 不承诺未来全新 block type “无需开发即可完美呈现”；本提案的目标是“显式失败或优雅降级”，而不是隐式错误

## Options Considered

### Option A: 仅在 Deck 内统一 normalize

在 dashboard 里新增唯一 adapter，把所有入口都接过去，Gateway 继续输出宽松 payload。

**优点**

- 实现成本最低
- 不需要改 Gateway protocol

**缺点**

- Gateway 和 Deck 仍然没有共享契约
- 未来 block/event 新增时，仍可能只在运行时暴露
- 其他消费方继续面对宽松、不可穷举的 payload

### Option B: Gateway canonical output + Deck shared adapter

Gateway 在对外 surface 上统一输出 canonical transcript block/message；Deck 共享一个 adapter 和 renderer registry。

**优点**

- 契约单一真源在 Gateway
- Deck 只需要消费 canonical model
- 不要求迁移历史 transcript 存储
- 可与 typed codegen 结合，形成编译期护栏

**缺点**

- 需要改 Gateway protocol / broadcast / Deck generator
- 迁移范围比纯前端修补更大

### Option C: 直接把 transcript schema 完全内嵌到渲染组件

每个 block component 自己处理宽松 payload，靠组件级 fallback 覆盖所有形态。

**优点**

- 最快能让单个 UI 看起来“不再报错”

**缺点**

- 继续复制契约
- store / projection / test 无法共享同一真源
- 是最难维护的路径

**选择：Option B**

这是唯一能同时解决“当前 bug”“Sessions 面板不一致”“未来新增类型无护栏”三类问题的路径。

## Proposed Architecture

### 1. Gateway Canonical Transcript Contract

Gateway 不再把宽松 transcript shape 直接暴露给 Deck，而是在 **输出边界** 做 canonicalization。

新增 canonical schema：

- `TranscriptTextBlock`
- `TranscriptThinkingBlock`
- `TranscriptToolUseBlock`
- `TranscriptToolResultBlock`
- `TranscriptImageBlock`
- `TranscriptFileBlock`
- `TranscriptMessage`

Deck-facing surface 的要求：

- `chat.history.messages[].content` 始终是 `TranscriptBlock[]`
- `session.message.payload.message.content` 与 `chat.history` 使用相同 message/block contract
- `session.tool` 使用正式的 typed payload，区分开始、进度、完成、错误，并保留结构化 `result`

输出规范化发生在 Gateway surface，而不是要求重写底层 transcript 文件：

- 历史文件中的 `string` 用户消息在读出时转成 `{ type: "text", text }[]`
- `toolCall` / `toolResult` / `input_text` / `output_text` / `reasoning` / `analysis` 等 alias 在读出时映射成 canonical block
- 结构化 `tool result` 保留为结构化内容，而不是强行 flatten 成字符串

输入形态到 canonical block 的映射需要显式记录：

| 输入形态                              | Canonical 输出   | 说明                                                   |
| ------------------------------------- | ---------------- | ------------------------------------------------------ |
| legacy `string` message content       | `text`           | 只在 Gateway 输出边界转换，不改底层存储                |
| `input_text` / `output_text`          | `text`           | Provider-specific text alias 不外泄到 Deck             |
| `thinking` / `reasoning` / `analysis` | `thinking`       | Deck-facing contract 只保留一个 reasoning-family block |
| `toolCall`                            | `tool_use`       | 兼容历史 transcript 和不同 provider 命名               |
| `toolResult`                          | `tool_result`    | 保留结构化 `content` / `result`                        |
| canonical `image` / `file`            | `image` / `file` | 媒体类型与元数据原样保真                               |

### 2. Event Contract 进入 Deck Codegen

现有 `pnpm protocol:gen:ts` 只生成 method params/result 类型。新的 contract 需要把 Deck 会消费的 event payload 也纳入 codegen。

推荐做法：

- 在 Gateway protocol 层为 Deck transcript/session projection 实际消费的事件维护导出的 TypeBox schema：
  `chat`、`agent`、`session.message`、`session.tool`、`sessions.changed`
- 扩展 codegen，生成浏览器可直接引用的 event payload 类型
- `useChatSSE` / dispatcher 不再手写 `Record<string, unknown>` 解析逻辑

首批 codegen 范围只覆盖上述 Gateway 事件；`approval.*`、`canvas` 等 Deck 内部事件不纳入这次 transcript contract。

这样新增 block/event type 时，Deck 能在类型层先暴露缺口。

### 3. Deck Transcript Core

Deck 侧建立唯一 transcript core，职责只有两个：

- **ingestion**：把 Gateway canonical message/event 投影进 session state
- **selection**：提供统一的 transcript selectors 给 chat 和 sessions surfaces

需要收敛的入口：

- `chat.history`
- `chat.snapshot`
- `session.message`
- `session.tool`
- `reloadFullContent`
- `Sessions` 面板历史详情

迁移完成后，这些入口不得再各自实现 `normalizeContent()`。

### 4. Renderer Registry

Deck 为 canonical transcript block 引入 renderer registry，例如：

- `text` → markdown/plain text renderer
- `thinking` → reasoning renderer family
- `tool_use` → tool call card
- `tool_result` → typed tool result renderer
- `image` / `file` → media/file renderer

约束：

- registry 对 canonical block type 做穷举处理
- `tool_result.content` 支持 `string` 与 `TranscriptBlock[]`
- 未知 block 或版本漂移场景进入统一 fallback card
- fallback card 显示 block type、核心字段和结构化摘要，但不污染主文本气泡

### 5. Shared Transcript Views

chat 页和 Sessions 面板可以保留不同布局，但必须共享：

- 同一套 message/block contract
- 同一套 block renderer registry 或 renderer primitives
- 同一套 tool result 结构化展示规则

这意味着：

- chat 页不再单独“更聪明”
- Sessions 面板不再只会把 transcript 压成纯字符串
- 相同消息在两个视图里表达的语义一致，只是外层布局不同

### 6. Transitional Compatibility

为降低风险，迁移分两阶段：

**Phase 1: Gateway canonical output + Deck dual-read**

- Gateway surface 开始输出 canonical payload
- Deck transcript core 仍保留小范围 legacy fallback，用于兼容旧 payload 或回滚窗口

**Phase 2: Remove legacy inference**

- 删除 chat / sessions 中重复的 local normalize
- 收紧 dispatcher 输入类型
- 将“未知对象直接 stringify”“只认字符串”的逻辑下沉为 fallback card，而不是主路径

## Decisions

### D1: 在 Gateway 输出边界做 canonicalization，而不是迁移存储格式

**选择**：读取 / 广播时规范化，底层 transcript 文件保持兼容。

**原因**：根治 surface 契约问题，同时避免高风险历史数据迁移。

### D2: Canonical block set 面向 transcript 语义，而不是 provider 私有形态

**选择**：Gateway 对外暴露 provider-agnostic transcript block，alias 在 Gateway 内部消化。

**原因**：Deck 不应该理解 `toolCall` 和 `tool_use` 两种同义词，也不应该把 provider 私有类型泄漏进 UI 逻辑。

### D3: Event payload 进入 codegen，而不是继续前端手写类型

**选择**：扩展 protocol/codegen，让 Deck 直接消费 typed event payload。

**原因**：只有这样，新增 event 字段或 block type 才能形成编译期护栏。

### D4: 未知 block 使用显式 fallback card，而不是主文本 stringify

**选择**：保留运行时降级，但降级位置必须是独立 block renderer。

**原因**：这样既不会静默丢内容，也不会把 JSON 混入用户正文。

### D5: Sessions 面板纳入同一 transcript contract

**选择**：本 change 不只修 chat 页，也覆盖 Sessions 历史详情。

**原因**：如果只修 chat，另一个活跃 transcript surface 仍然会继续漂移。

### D6: Deck-facing canonical reasoning-family block 收敛为单一 `thinking`

**选择**：Gateway 对 Deck 只导出一个 `TranscriptThinkingBlock`；上游 `reasoning`、`analysis` 等 reasoning-family 形态在输出边界统一映射为 `thinking`。

**原因**：当前 Deck block model、selector 和 UI 只有一个 reasoning surface；本 change 的目标是收紧契约，而不是先引入第二套同义语义并把歧义扩散到 renderer、tests 和 codegen。

## Risks / Trade-offs

**[协议与生成链路范围扩大]**
需要改 Gateway schema、Deck codegen、前端事件消费代码。
缓解：先引入 canonical output 和 typed types，再渐进删除 legacy fallback。

**[reasoning-family alias 归一化需要保持一致]**
`thinking`、`reasoning`、`analysis` 等输入形态如果在不同 Gateway 出口做了不同映射，会重新引入前后端语义漂移。
缓解：在 Gateway 输出边界集中做 alias normalization，并为 reasoning-family alias 增加 contract tests。

**[chat 与 sessions 复用可能引起组件重构]**
现在两个 surface 结构差异较大。
缓解：共享 renderer primitives 与 adapter，不强迫两者共用同一个页面组件。

**[未知版本漂移]**
Dashboard 版本可能落后于 Gateway。
缓解：保留 runtime fallback card，同时增加 contract drift test 与 renderer coverage test。

**[长会话 canonicalization 的读取开销]**
`chat.history` 和事件出站前的规范化会为长会话增加一次 block-level 遍历。
缓解：保持实现为线性、轻量映射，不在 Gateway 出口做不必要的深拷贝或昂贵重组。

**[event codegen 体积增长]**
把事件 payload 纳入生成后，Deck 侧生成类型文件会变大。
缓解：优先按 transcript/session projection 的最小必要事件集生成；如体积继续增长，再拆分 method/event 生成物。
