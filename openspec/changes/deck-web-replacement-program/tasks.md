## 1. 建立 Program 级基线

- [ ] 1.1 新增 Deck Web Replacement Program 的 master OpenSpec artifacts（proposal / design / specs / tasks）
- [ ] 1.2 新增 program 计划文档，定义轨道、阶段、优先级和 worktree 策略
- [ ] 1.3 新增 capability / closure matrix 基线，明确当前已知模块、现有 change 入口与闭环状态

## 2. 统一后续 Deck changes 的治理入口

- [ ] 2.1 将现有 `deck-*` proposals / plans 归类到 `Core Platform`、`Session Runtime`、`UI Framework`、`Domain Modules`、`Replacement Validation` 五条主轨
- [ ] 2.2 为每个后续 Deck change 明确 `track`、`phase`、`dependency`、`closure target`
- [ ] 2.3 将“模块完成”的定义统一为 closure checklist，不再以页面存在或局部交互作为完成标准

## 3. 建立平台优先的实施顺序

- [ ] 3.1 明确 `Core Platform` 的前置 backlog：typed gateway coverage、Deck route facade、transport/auth、snapshot/stream/replay/projection、shared mutation/error model
- [ ] 3.2 明确 `Session Runtime` 的前置 backlog：session-scoped state、hydrate/reconnect/recovery、history/live merge、right-panel state
- [ ] 3.3 明确 `UI Framework` 的前置 backlog：shared list infra、schema-driven form/table、panel shell、empty/error/loading patterns

## 4. 以模块闭环而不是页面数量驱动推进

- [ ] 4.1 为 `chat`、`approval`、`canvas / A2UI`、`sessions / logs`、`execution monitor` 建立高优先级 runtime-core 目标
- [ ] 4.2 为 `agents`、`config editor`、`channels`、`routing / session-channel`、`dynamic commands` 建立 config-control 目标
- [ ] 4.3 为 `usage`、`activity`、`cron`、`webhooks`、`skills`、`budget`、`alerts` 建立 observe-automate 目标

## 5. 建立替代验收门

- [ ] 5.1 建立 capability coverage review，明确“Gateway 方法族覆盖”如何判定
- [ ] 5.2 建立 workflow validation，要求关键真实工作流在历史态、实时态、刷新、重连下保持一致
- [ ] 5.3 建立 `enhanced` 合流门：只有模块通过 closure checklist 与 workflow validation 后才进入稳定集成
