## Why

OpenSpec + superpowers 目前已经能把 `proposal -> design -> tasks -> plan -> implementation` 串起来，但“任务做完”不等于“spec 已收敛”。现有流程缺少一个可移植的、scenario 级别的闭环协议，无法机械判断某个 change 是否已经做到 `spec -> plan -> code -> evidence` 全部对齐。

这个缺口已经开始影响多个项目：计划里虽然有 `covers:` 和 coverage matrix，但它们主要提供人工可读的追踪，不提供 archive 前的收敛门禁。现在需要一套独立于具体仓库、独立于 OpenSpec / superpowers 插件更新周期的 companion protocol，让任何采用这两套工作流的项目都能复用同一套 closure check。

## What Changes

- 新增一套 portable-first 的 closure companion protocol，定义 OpenSpec change 在实施后如何进行 scenario 级收敛检查
- 新增 scenario traceability 规范，要求 ADDED / MODIFIED scenarios 能被稳定枚举并映射到计划任务
- 新增 verification artifact 规范，要求每个 change 维护独立的 scenario 级验证状态，而不是只依赖任务 checkbox
- 新增 closure check / archive readiness 规范，要求在 archive 或等效收尾动作前先完成 `spec -> plan -> code -> evidence` 对账
- 明确标准层与项目适配层的边界：标准层保持跨项目通用，项目只通过薄配置或轻量 wrapper 接入
- 明确非目标：不直接修改 upstream OpenSpec CLI、不直接修改 superpowers 本体、不把任何单一仓库的路径结构写进协议真源

## Capabilities

### New Capabilities

- `scenario-traceability`: 定义 OpenSpec spec 场景的稳定标识、plan `covers` 映射，以及 scenario-level 覆盖清单
- `verification-artifact`: 定义每个 change 的 verification artifact 结构，用于记录 scenario owner、验证命令、证据与闭合状态
- `closure-check`: 定义 companion checker 如何对账 spec、plan、verification artifact 和实现证据，并据此判断 change 是否达到 archive-ready

### Modified Capabilities

- None

## Impact

- Affected systems:
  - OpenSpec change artifacts (`specs/`, `tasks.md`, optional verification artifact)
  - superpowers `writing-plans` 产物约定（继续使用 `covers:`，但收敛检查不再只依赖 plan 本身）
  - 各项目的收尾 / archive 工作流（将增加一个 closure check gate）
- Expected implementation shape:
  - 一个独立的 closure companion tool / plugin / skill bundle
  - 一个项目级薄配置层，用来适配 plan 路径、verification artifact 路径和 archive 策略
- Explicitly out of scope:
  - 修改 `.claude/commands/opsx/*` 或全局 superpowers skill 本体
  - 把 OpenClaw 的 `docs/plans/`、`package.json`、`AGENTS.md` 等仓库细节提升为协议的一部分
