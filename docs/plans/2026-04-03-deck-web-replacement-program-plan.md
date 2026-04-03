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
- Deck server persistence layer (SQLite projection store, EventBus, outbox)
- auth / stream / replay
- projection / recovery primitives
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

分为三个子波次（对应 matrix 中的 D.rc / D.cc / D.oa）：

- `D.rc — Runtime Core`: chat、approval、canvas / A2UI、sessions、logs、execution monitor、onboarding
- `D.cc — Config & Control`: agents、config editor、channels、routing / session-channel、dynamic commands、models hub、settings
- `D.oa — Observe & Automate`: usage、activity、cron、webhooks、skills、budget、alerts

### Track E: Replacement Validation

目标：建立”是否可替代”的持续验证体系（不是终末 gate，而是每 phase 的增量验证）。

包含：

- capability matrix（Phase 1 建立方法族清单，后续每 phase 更新覆盖状态）
- closure checklist（每 phase gate 时验证该 phase 范围内的模块）
- representative workflow validation（Phase 2+ 每个 runtime 模块至少一条）
- browser functional test（Phase 5 最终验收）
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

Phase 1 gate 增量验证：

- Gateway 方法族清单已建立
- typed client 可被至少 2 个模块共用
- 共享 list/form infra 有使用示例

### Phase 2: Runtime Core

优先模块：

- chat
- approval
- canvas / A2UI
- sessions / logs
- execution monitor

输出标准：

- 历史态 / 实时态 / 刷新 / 重连的一致性有清晰模型与验证

Phase 2 gate 增量验证：

- 每个 runtime-core 模块至少一条 representative workflow validation
- closure checklist 9 项中至少 7 项达标

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

Phase 5 只做前几个 phase 无法覆盖的全局验证：

- 跨模块工作流验证（multi-module workflow validation）
- browser functional test（end-to-end）
- capability coverage 最终审查（所有 P0 方法族 Covered，P1 至少 Partial）
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

模块只有满足以下条件，才可视为 replacement-ready（与 design.md Section 3 对齐）：

1. **Capability coverage** — 对应 Gateway 方法族已明确覆盖边界
2. **Authoritative contract** — Deck route / typed client / result model 已明确
3. **Hydration path** — 冷启动时能获得权威快照
4. **Runtime sync** — 实时流、后台更新、跨入口修改进入同一真源
5. **History-live consistency** — 历史态和实时态在相同服务端状态下产生相同 UI
6. **Recovery** — 刷新、重连、切换历史对象后状态可恢复
7. **Shared interaction quality** — loading / error / empty / permission / mutation feedback 符合统一标准
8. **Security and accessibility baseline** — XSS/CSRF 防护、键盘可达、首屏性能 budget
9. **Validation** — 有契约验证、模块测试和至少一条工作流验证

## 6. How to Classify Existing Changes

建议从今天开始，所有现有与新增 Deck change 都带上以下 program 维度：

- `Track`: A/B/C/D.rc/D.cc/D.oa/E 之一（primary track）
- `Phase`: 0-5
- `Priority`: P0/P1/P2
- `Dependency`: 依赖哪些平台能力
- `Closure target`: 这个 change 试图闭环哪个模块或哪个共享基础设施

这几个维度不必全部回写到旧 proposal 中，但至少要出现在 program matrix 中。

## 7. Per-Session Workflow

后续工作按 `docs/plans/2026-04-03-deck-program-driven-workflow.md` 定义的 program-driven 开发流程执行。

核心路由：已有充分设计的项直接写 plan（Path A）；proposal 需升级的走 Path B；全新系统能力走完整 brainstorm → openspec → plan 流程（Path C）。

## 8. Immediate Next Steps

1. ~~固化 `deck-web-replacement-program` master change~~ (done)
2. ~~建立初版 capability / closure matrix~~ (done, revised)
3. ~~把现有 `deck-*` changes 归入上述 tracks~~ (done in matrix)
4. 从 `platform-kernel` worktree 开始推进 Track A / B / C 的前置基础设施
5. Phase 1 第一个交付物：建立 Gateway 方法族覆盖清单
