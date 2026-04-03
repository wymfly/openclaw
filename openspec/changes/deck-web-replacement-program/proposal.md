## Why

Deck 已经不再是单一面板或单一提案的问题，而是一个要长期替代官方 Web UI 的产品线问题。当前仓内已经存在大量 `deck-*` proposals 与 plans，但它们仍然主要围绕局部模块展开，缺少一层统一的产品与平台总纲，导致后续工作容易继续沿着“发现一个缺口、修一个缺口”的方式前进。

如果目标是做出一个可持续演进、可覆盖 Gateway 核心能力、并且交互质量不低于官方 UI 的 OpenClaw 二次开发产品，Deck 后续工作必须从“离散改造”切换到“program-driven replacement”：

- 以 **Gateway 能力覆盖** 为硬目标，而不是页面外观对齐
- 以 **优秀交互与稳定闭环** 为质量约束，而不是简单把页面补齐
- 以 **平台内核优先** 为实施策略，而不是让每个模块各自发明 transport / state / recovery 逻辑
- 以 **模块闭环达标** 为验收标准，而不是“页面可以打开、功能可以点”

这个总纲 change 的作用不是替代现有 `deck-*` changes，而是给它们提供统一轨道、优先级、边界规则和验收标准。

## What Changes

- 新增一个 **Deck Web Replacement Program** 总纲 change，定义 Deck 作为官方 Web UI 替代产品的总体目标、约束、阶段与治理规则
- 新增 **deck-core-platform-governance** 能力，统一后续 Deck 模块在 Gateway 契约、Deck route 封装、projection/replay/state recovery 上的边界规则
- 新增 **deck-module-closure** 能力，要求每个模块在被视为“可替代”之前满足统一的闭环标准
- 新增 **deck-replacement-validation** 能力，要求以 capability matrix、workflow validation、phase gate 的方式推进，而不是以页面数量或提案数量衡量进展
- 新增 program 计划文档与 capability / closure matrix，用于把现有 `deck-*` proposals 和 plans 归类到统一轨道中

## Capabilities

### New Capabilities

- `deck-core-platform-governance`: Deck 平台内核治理规则，包括 contract-first、typed transport、snapshot/stream/replay/projection 模型、Gateway vs Deck route 的职责划分
- `deck-module-closure`: Deck 模块闭环标准，包括真源定义、恢复路径、历史态/实时态一致性、共享交互模式、测试与验收要求
- `deck-replacement-validation`: Deck 替代计划的验证与阶段门，包括 capability matrix、workflow validation、phase sequencing、worktree 策略

### Modified Capabilities

- `openclaw-deck`: 从“Web Dashboard 初始建设”提升为“长期替代官方 Web UI 的产品计划入口”

## Impact

- **OpenSpec**：新增一个 master change，作为后续所有 Deck 子 change 的总入口和治理参照
- **文档**：新增 Deck replacement program plan 与 capability / closure matrix
- **实施策略**：后续 `deck-*` changes 需要映射到统一轨道、阶段和闭环标准，不再孤立推进
- **当前代码**：本 change 不直接引入运行时代码变更；它约束的是后续变更如何展开与验收
