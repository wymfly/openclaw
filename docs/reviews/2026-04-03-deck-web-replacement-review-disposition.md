# Deck Web Replacement Review Disposition

> Date: 2026-04-03
> Source Review: `docs/reviews/2026-04-03-deck-web-replacement-review-report.md`
> Purpose: 记录对审查报告各项意见的处理决定，区分采纳、部分采纳和不采纳，作为后续文档修订与 Phase 1 启动前的依据。

## 1. Overall Decision

本次审查报告的主结论成立：

- program 方向正确
- 当前最主要的问题是 program baseline 还不够完整
- matrix 与部分治理文档还需要补强后，才适合启动 Phase 1

最值得立即处理的内容集中在两类：

1. **盘点完整性**
   - 幽灵引用
   - 缺失的 changes
   - 缺失的 panel area
   - 计划与矩阵维度不一致

2. **治理表述清晰度**
   - `openclaw-deck` 被“升级”的含义
   - Phase 0 与 Phase 1 的衔接关系

## 2. Accepted Findings

### A1. Matrix 存在幽灵引用

- **Finding**: `deck-canvas-virtual-node` 被写入 matrix，但该 change 不存在
- **Disposition**: Accepted
- **Affected File**: `docs/plans/2026-04-03-deck-web-replacement-matrix.md`
- **Action**: 删除该引用，并替换为真实存在的输入或更准确的来源说明

### A2. Matrix 漏了 5 个现有 OpenSpec changes

- **Finding**: 以下 5 个 change 未出现在当前 matrix 中
  - `deck-agent-routing-observability`
  - `deck-agent-workspace`
  - `deck-chat-whitebox`
  - `deck-config-enhancement`
  - `wecom-channel`
- **Disposition**: Accepted
- **Affected Files**:
  - `docs/plans/2026-04-03-deck-web-replacement-matrix.md`
  - `openspec/changes/deck-web-replacement-program/design.md`
  - `openspec/changes/deck-web-replacement-program/tasks.md`
- **Action**: 为这些 change 补充归类，或对 `wecom-channel` 明确标记为 Deck program 之外

### A3. Program plan 与 matrix 维度不一致

- **Finding**: plan 要求后续分类包含 `Priority` 与 `Dependency`，但 matrix 未提供这两列
- **Disposition**: Accepted
- **Affected Files**:
  - `docs/plans/2026-04-03-deck-web-replacement-program-plan.md`
  - `docs/plans/2026-04-03-deck-web-replacement-matrix.md`
- **Action**: 给 matrix 增加至少 `Priority` 与 `Dependency` 列，并让 plan / matrix 维度一致

### A4. Review index 未说明清楚 Phase 0 与 Phase 1 的关系

- **Finding**: 当前文档直接引导到 `platform-kernel phase1`，但没有明确说明剩余 Phase 0 基线任务如何处理
- **Disposition**: Accepted
- **Affected File**: `docs/reviews/2026-04-03-deck-web-replacement-review-index.md`
- **Action**: 明确 Phase 0 收尾项是先完成，还是并入 Phase 1 plan 的前置 section

### A5. Proposal 中 `openclaw-deck` 的“升级”含义不清晰

- **Finding**: `Modified Capabilities` 将 `openclaw-deck` 标为被修改，但没有解释这意味着什么
- **Disposition**: Accepted
- **Affected File**: `openspec/changes/deck-web-replacement-program/proposal.md`
- **Action**: 明确这是 program-level 重新定位，不是直接修改 `openclaw-deck` 的 runtime specs

## 3. Partially Accepted Findings

### P1. Matrix 漏了很多已有 panel

- **Finding**: 当前 matrix 没有覆盖足够多的现有 panel
- **Disposition**: Partially accepted
- **Reason**: 方向正确，但报告给出的数量和口径不完全准确
- **Verified Missing Areas**:
  - `approvals`
  - `docs`
  - `identity`
  - `memory`
  - `models`
  - `settings`
  - `subagents`
  - `threads`
- **Notes**:
  - `monitor` 已被抽象为 `Execution Monitor`
  - `routing` 已在 matrix 中出现
  - `scheduler` 是否应单独列为 area，需要进一步决定
- **Action**: 补全缺失 area，但不直接沿用报告中“10 个面板”的表述

### P2. `Gateway Transport / Typed Client` 状态可能偏低

- **Finding**: 当前 matrix 将 `Gateway Transport / Typed Client` 标为 `partial`
- **Disposition**: Partially accepted
- **Reason**:
  - 生成物已经存在：
    - `dashboard/src/types/gateway-client.generated.ts`
    - `dashboard/src/types/gateway-protocol.generated.ts`
  - 但“有生成物”不等于“已经形成 program 级统一 transport / contract stack”
- **Action**: 保留 `partial` 可能是合理的，但应把备注改得更具体，说明“已具备 typed 生成与部分覆盖，尚未形成 program 级统一接入层”

### P3. Phase 输出标准不够量化

- **Finding**: 当前 phase gate 更偏定性表达
- **Disposition**: Partially accepted
- **Reason**: 问题成立，但不应阻塞当前 baseline 修正
- **Action**: 放入下一轮 program 文档增强，在 Phase 1 启动前补至少一部分可验证 gate

### P4. Worktree 冻结 / 合流规则不够具体

- **Finding**: design 中的 worktree 策略还缺生命周期细节
- **Disposition**: Partially accepted
- **Reason**: 这是有效问题，但属于下一层执行治理，不影响当前总纲成立
- **Action**: 在后续 `platform-kernel phase1` plan 或总纲第二轮修订中补充

### P5. Closure / validation 规则还不够量化

- **Finding**: 当前 closure 与 validation 更偏原则性
- **Disposition**: Partially accepted
- **Reason**: 值得补充，但适合在 baseline 修正完成后进入第二轮精化
- **Action**: 后续在这几份 spec 中增强：
  - `openspec/changes/deck-web-replacement-program/specs/deck-module-closure/spec.md`
  - `openspec/changes/deck-web-replacement-program/specs/deck-replacement-validation/spec.md`

## 4. Rejected Findings

### R1. `design.md` 也引用了 `deck-canvas-virtual-node`

- **Finding**: 报告称 `design.md` 也包含该幽灵引用
- **Disposition**: Rejected
- **Reason**: 本地核对后，该引用只出现在：
  - `docs/plans/2026-04-03-deck-web-replacement-matrix.md`
    `openspec/changes/deck-web-replacement-program/design.md` 中并不存在该引用

### R2. `openclaw-deck` 有 24 个 spec 子目录

- **Finding**: 报告称 `openclaw-deck` 是 24 个 spec 子目录
- **Disposition**: Rejected
- **Reason**: 本地核对结果为 22 个子目录，不是 24 个
- **Notes**: 这不影响它“规模很大”的总体判断，但数字不准确

### R3. `execution monitor` 放在 Phase 2 是错误

- **Finding**: 报告质疑 `execution monitor` 的阶段归类
- **Disposition**: Rejected as defect
- **Reason**: 这属于设计取舍，不是事实错误，也不构成当前总纲失效
- **Notes**: 可以继续讨论是否需要调整优先级，但不作为当前文档缺陷处理

## 5. Resolution Order

### P0: 立即修正，作为 Phase 1 前置基线

1. 修复 matrix 幽灵引用
2. 补全缺失的 5 个 changes
3. 补全缺失的 panel areas
4. 对齐 Plan 与 Matrix 维度，补上 `Priority` 与 `Dependency`
5. 澄清 `openclaw-deck` 的“升级”含义
6. 澄清 Phase 0 与 Phase 1 的衔接关系

### P1: 基线修正后继续增强

1. 最好顺手增加 `Last Assessed`
2. 把关键 area 的状态备注改得更具体
3. 为各 phase 补至少一个可验证 gate

### P2: 第二轮治理细化

1. 增强 closure spec 的量化要求
2. 增强 validation spec 的合流粒度定义
3. 增加 Gateway vs Deck route 灰区裁定机制
4. 增加 worktree 冻结 / 合流规则

## 6. Immediate Next Action

在开始 `platform-kernel phase1` 之前，应先完成本 disposition 中的 P0 修正，使 program baseline 成为一个可靠的治理入口。
