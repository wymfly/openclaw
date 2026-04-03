# Deck Web Replacement Program Plan

> Date: 2026-04-03
> Status: Draft baseline
> Scope: Program-level plan for turning Deck into a capability-first replacement for the official Web UI

## 1. Program Goal

Deck 的目标不是复刻官方 Web UI，而是构建一个以 **Gateway 能力覆盖** 为硬目标、以 **优秀交互与稳定闭环** 为质量目标的 OpenClaw Web 产品。

因此后续工作采用以下原则：

- **能力优先**：以 Gateway 能力族覆盖为主，不按页面数量衡量完成度
- **平台优先**：先统一 contract、transport、projection、shared UI infra，再扩展模块
- **闭环优先**：每个模块都必须具备 hydrate、runtime sync、recovery 和 validation
- **渐进替代**：允许平台重构窗口，通过多 worktree 推进，待阶段稳定后再合入 `enhanced`

## 2. Five Tracks

### Track A: Core Platform

目标：统一所有模块共享的技术底座。

包含：

- typed gateway coverage / protocol-driven SDK
- Deck route facade / browser transport
- auth / stream / replay
- projection / outbox / recovery primitives
- shared mutation / query / error model

现有输入：

- `docs/plans/2026-03-27-gateway-protocol-sdk-design.md`
- `openspec/changes/deck-chat-flow-closure/`
- `openspec/changes/openclaw-deck/`

### Track B: Session Runtime

目标：统一“历史态 + 实时态 + 刷新/重连恢复”的运行时模型。

包含：

- session-scoped state
- snapshot / hydrate / replay
- approval / canvas / runtime meta 恢复
- session / run / transcript / right-panel 一致性

现有输入：

- `openspec/changes/session-scoped-state/`
- `openspec/changes/deck-chat-flow-closure/`
- `openspec/changes/deck-sessions-logs-hardening/`

### Track C: UI Framework

目标：统一 Deck 的共享交互基础设施。

包含：

- shell / master-detail layout
- shared list infra
- schema-driven form / table
- command surfaces
- empty / loading / error / permission patterns

现有输入：

- `openspec/changes/deck-shared-list-infra/`
- `openspec/changes/schema-driven-ui-architecture/`
- `openspec/changes/deck-chat-ux-enhancement/`

### Track D: Domain Modules

目标：在统一底座上逐步完成业务模块替代。

建议分为三个子波次：

- `Runtime Core`: chat、approval、canvas / A2UI、sessions、logs、execution monitor
- `Config & Control`: agents、config editor、channels、routing / session-channel、dynamic commands
- `Observe & Automate`: usage、activity、cron、webhooks、skills、budget、alerts

### Track E: Replacement Validation

目标：建立“是否可替代”的全局 gate。

包含：

- capability matrix
- closure checklist
- browser functional test
- representative workflow validation
- 合流到 `enhanced` 的阶段门

## 3. Recommended Phase Order

### Phase 0: Baseline

- 建立 master OpenSpec
- 建立 program plan
- 建立 capability / closure matrix
- 为现有 change 完成轨道归类

### Phase 1: Platform Kernel

优先建设：

- typed gateway access
- Deck transport / auth / stream
- replay / projection / snapshot 模型
- shared list / form / panel infra

输出标准：

- 至少能支持多个模块共用同一 transport / replay / projection 模型

### Phase 2: Runtime Core

优先模块：

- chat
- approval
- canvas / A2UI
- sessions / logs
- execution monitor

输出标准：

- 历史态 / 实时态 / 刷新 / 重连的一致性有清晰模型与验证

### Phase 3: Config & Control

优先模块：

- agents
- config editor
- channels
- routing / session-channel
- dynamic commands

输出标准：

- 模块不再各自发明配置表单、命令执行、详情布局与保存逻辑

### Phase 4: Observe & Automate

优先模块：

- usage
- activity
- cron
- webhooks
- skills
- budget
- alerts

输出标准：

- 观察和自动化模块在 shared list / form / detail infra 上达到一致交互质量

### Phase 5: Replacement Gate

- workflow validation
- browser functional test
- capability coverage review
- 稳定合流到 `enhanced`

## 4. Worktree Strategy

建议按轨道切 worktree，而不是按页面切：

- `program`
  - 维护 master OpenSpec、plan、matrix
  - 不承载运行时代码实现
- `platform-kernel`
  - contract、transport、stream、projection、shared infra
- `runtime-core`
  - chat、approval、canvas、sessions、logs、execution monitor
- `config-control`
  - agents、config、channels、routing、commands
- `observe-automate`
  - usage、activity、cron、webhooks、skills、budget、alerts

并行规则：

- 共享契约未稳定前，不并行推进大范围共享文件改造
- 只有前置平台能力冻结后，相关模块 worktree 才能大规模并发

## 5. Definition of Done for Any Module

模块只有满足以下条件，才可视为 replacement-ready：

1. 明确 Gateway / Deck contract
2. 有 snapshot / hydrate
3. 有 runtime sync
4. 有 replay / reconnect 补偿
5. 历史态和实时态一致
6. 刷新后 UI 状态可恢复
7. 使用共享 loading / error / empty / mutation feedback 模式
8. 有模块测试和至少一条 workflow validation

## 6. How to Classify Existing Changes

建议从今天开始，所有现有与新增 Deck change 都带上以下 program 维度：

- `Track`: A/B/C/D/E 之一
- `Phase`: 0-5
- `Priority`: P0/P1/P2
- `Dependency`: 依赖哪些平台能力
- `Closure target`: 这个 change 试图闭环哪个模块或哪个共享基础设施

这几个维度不必全部回写到旧 proposal 中，但至少要出现在 program matrix 中。

## 7. Immediate Next Steps

1. 固化 `deck-web-replacement-program` master change
2. 建立初版 capability / closure matrix
3. 把现有 `deck-*` changes 归入上述 tracks
4. 从 `platform-kernel` worktree 开始推进 Track A / B / C 的前置基础设施
