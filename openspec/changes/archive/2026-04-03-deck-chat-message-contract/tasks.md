## 1. Gateway Canonical Transcript Contract

- [x] 1.1 定义 canonical transcript block / message schema，覆盖 Deck-facing `chat.history` 输出，并将 reasoning-family 输出收敛到单一 `thinking` block
- [x] 1.2 为 `chat`、`agent`、`session.message`、`session.tool`、`sessions.changed` 补齐正式 payload schema，并与 transcript contract 对齐
- [x] 1.3 在 Gateway 输出边界做 canonicalization，兼容旧 transcript 存储但不再把宽松 shape 直接暴露给 Deck

## 2. Gateway → Deck 类型生成

- [x] 2.1 扩展 protocol/codegen，使 Deck 能消费 transcript contract 与 `chat`、`agent`、`session.message`、`session.tool`、`sessions.changed` 的 typed event payload definitions
- [x] 2.2 为 protocol drift 增加校验，防止 Gateway 新增/修改 transcript block 后 Deck 无感漂移

## 3. Deck Transcript Core

- [x] 3.1 引入唯一 transcript adapter / selector core，替代聊天页、dispatcher、Sessions 面板各自的 normalize 逻辑
- [x] 3.2 让 `chat.history`、snapshot、`session.message`、`session.tool`、`reloadFullContent` 全部通过同一 transcript ingestion 路径
- [x] 3.3 迁移 Sessions 面板历史详情，移除当前只接受纯字符串的 transcript 处理

## 4. Renderer Registry

- [x] 4.1 为每个 canonical transcript block type 注册显式 renderer
- [x] 4.2 重构 `tool_result` 渲染，保留结构化结果而不是直接 `JSON.stringify`
- [x] 4.3 为未知 block / 版本漂移场景增加统一 fallback card，禁止 JSON 混入主文本气泡

## 5. Guardrails And Cleanup

- [x] 5.1 删除重复的 local normalize / stringify 主路径逻辑，只保留过渡期 fallback
- [x] 5.2 增加 renderer coverage / exhaustiveness guardrail，保证 canonical block type 与 renderer 清单一致
- [x] 5.3 收紧 dispatcher 和 store 输入类型，移除 `Record<string, unknown>` 主路径解析

## 6. Verification

- [x] 6.1 补 `chat.history` / `session.message` / `session.tool` / `chat` / `agent` / `sessions.changed` 的 contract tests，覆盖文本、reasoning-family alias、tool、image、file、结构化 tool result
- [x] 6.2 补 chat 页、reload、Sessions 面板的一致性测试，保证相同 transcript state 产生一致语义 UI
- [x] 6.3 运行 `pnpm protocol:gen:ts`、`pnpm build`、`cd dashboard && pnpm lint` 与相关测试，确认协议、类型和渲染链路无漂移
