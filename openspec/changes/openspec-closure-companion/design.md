## Context

OpenSpec + superpowers 已经形成了一条稳定的工作流主干：

`proposal -> design -> specs -> tasks -> writing-plans -> implementation -> archive`

但现状里“收敛”的最小单位仍然是 task，而不是 spec scenario。`tasks.md` checkbox、plan 里的 `covers:`、以及 `Requirement Coverage Matrix` 能提供人工可读的追踪，却不能机械证明某个 change 已经达到 `spec -> plan -> code -> evidence` 的固定点。

这个问题在单一仓库里还能靠人工 review 兜住，但一旦多个项目都采用 OpenSpec + superpowers，靠修改每个项目的本地 workflow 文件既不稳定，也不可移植。尤其是 `.claude/commands/opsx/*` 和全局 superpowers skill 会随着 upstream 更新而漂移，不能作为 closure protocol 的真源。

因此，这个 change 要解决的不是某个仓库的临时 gate，而是一个 portable-first 的 closure companion protocol：

- 标准层定义 scenario、plan、verification、closure-check 之间的契约
- 项目适配层只声明路径、默认值和 gate 策略
- companion 本体保持独立，不直接修改 upstream OpenSpec / superpowers

## Goals / Non-Goals

**Goals:**

- 定义一个跨项目通用的 scenario-level closure protocol，适用于任何采用 OpenSpec + superpowers 的项目
- 让 closure check 的输入和输出稳定：spec scenario inventory、plan coverage、verification artifact、gap report、archive readiness
- 把“任务做完”与“spec 收敛完成”区分开来，避免 archive 只依赖 task checkbox
- 保持与现有 OpenSpec / superpowers 工作流兼容，不要求重写 `writing-plans` 或 `/opsx:*` 的核心语义
- 允许每个项目通过薄配置接入，而不是复制或 patch companion 本体

**Non-Goals:**

- 不修改 upstream OpenSpec CLI 的 schema 或生命周期
- 不修改 `.claude/commands/opsx/*` 或全局 superpowers skill 本体
- 不强制所有项目采用相同的 plan 路径、包管理器、CI 平台或归档命令
- 不让 closure check 自动判断业务正确性；它只负责对账已声明的 scenarios、计划映射和验证证据

## Decisions

### D1: Scenario ID 成为 closure protocol 的稳定主键

**选择**：每个 ADDED / MODIFIED scenario 都必须有稳定的 `scenario_id`，closure protocol 一律以 `scenario_id` 为主键，而不是以自然语言标题或 spec 行号为主键。

**原因**：

- scenario 标题经常会被润色，但语义不一定变化
- 行号天然不稳定
- 没有稳定 ID，就无法做多轮 closure pass，也无法跨 plan / verification / report 对账

**替代方案**：

- 直接用 scenario 标题：对人友好，但一改文案就失联
- 直接用 spec path + line number：机器可用，但对重排和文档编辑极其脆弱

### D2: 保留现有 `covers:` 语义，但为机器闭环单独增加 scenario-level 映射

**选择**：superpowers plan 继续保留当前人类可读的 `covers:` 约定，但 closure protocol 额外要求提供 machine-checkable 的 scenario 映射。推荐做法是让计划同时保留：

- 人类可读的 requirement / scenario 描述
- 机器可读的 `scenario_id` 映射

**原因**：

- 不能为了 machine check 破坏现有 `writing-plans` 的可读性
- 也不能继续依赖纯自然语言 `covers:` 做 archive gate

**替代方案**：

- 直接把 `covers:` 改成只写 `scenario_id`：机器友好，但会让 plan 可读性显著下降
- 继续只用自然语言 `covers:`：对当前人工流程足够，但无法做稳定的机械对账

### D3: Verification artifact 采用独立、机器可读的真源

**选择**：每个 change 维护独立的 verification artifact，作为 scenario-level status 的真源。该 artifact 的 canonical 形式应为机器可读格式，例如 `verification.yaml`；人类可读渲染（如 `verification.md`）可以作为附属产物，但不是协议真源。

**原因**：

- task checkbox 只表达“任务是否完成”，不表达“哪个 scenario 已验证、证据是什么、是否需要修 spec”
- 机器可读格式更适合做 closure check、CI gate 和报告生成

**替代方案**：

- 直接把验证状态塞进 `tasks.md`：会把 task 维度与 scenario 维度混在一起
- 用 markdown 表格做唯一真源：人类可读，但解析和演进都更脆弱

### D4: Closure checker 是独立 companion，而不是 workflow patch

**选择**：closure checker 作为独立 companion command / tool 存在，例如 `closure init`、`closure check`、`closure report`。它消费 OpenSpec artifacts、plan 和 verification artifact，但不直接 patch `/opsx:apply` 或 `/opsx:archive`。

**原因**：

- upstream workflow 文件会更新，直接修改不可持续
- companion 模型更适合跨项目复用
- 项目可以自由把 `closure check` 接到 CI、pre-archive hook、PR gate 或手工流程里

**替代方案**：

- 直接修改 `/opsx:archive`：对单仓库方便，但不可移植
- 把 closure 逻辑塞进 `/opsx:apply`：会把实现和验收耦合在一起，降低可组合性

### D5: 项目接入通过薄配置完成

**选择**：closure companion 通过项目级配置文件接入，推荐默认名 `.openspec-closure.yaml`。配置内容只描述：

- plan 文件发现规则
- verification artifact 位置
- 默认 strictness / gate 策略
- 允许的 status 集合或扩展字段

**原因**：

- 不同项目的 `docs/plans/`、`docs/superpowers/plans/`、monorepo 结构、CI 平台都不同
- 同一套 checker 需要复用，但不能假设所有项目长得一样

**替代方案**：

- 把路径硬编码进 companion：实现快，但完全不可移植
- 要求所有项目统一目录结构：理论上干净，现实中成本过高

### D6: Archive readiness 由 zero-gap closure 决定，archive command 本身是否强制由项目选择

**选择**：closure protocol 只定义 `archiveReady` 的语义，不强制绑定具体 archive 命令。默认语义是：

- 当且仅当没有 open gaps 时，`archiveReady = true`
- open gap 包括：未映射 scenario、缺失 verification entry、`pending`、`blocked`、`spec-fix-required` 等未闭合状态

具体项目可以选择：

- 把它作为 hard gate
- 把它作为 warning gate
- 只在 CI 上强制

**原因**：

- 标准层应定义 readiness，不应绑死到某个 workflow 命令
- 项目成熟度不同，迁移期间可能需要 warning-only 模式

**替代方案**：

- 协议层直接要求 archive 必须 hard fail：标准更强，但迁移成本更高

## Risks / Trade-offs

- **[作者负担增加]** spec 作者需要维护 `scenario_id`  
  **Mitigation**: 提供 `closure init` / lint / scaffold 支持，避免手工补全

- **[状态分散]** task checkbox 与 verification artifact 可能重复维护  
  **Mitigation**: 明确职责边界。`tasks.md` 管 implementation progress，`verification artifact` 管 scenario closure

- **[旧 change 迁移成本]** 历史 OpenSpec changes 没有 scenario ID  
  **Mitigation**: 采用 forward-only 或 incremental adoption；先要求新 change 使用协议，再提供迁移工具

- **[不同项目 plan 模板差异大]** 可能导致 closure checker 很难通用解析  
  **Mitigation**: 把强契约放在 `scenario_id` 和 `verification artifact`，plan 只做 adapter 解析；通过 `.openspec-closure.yaml` 降低耦合

- **[过度机械化]** 可能出现“check 通过但场景验证质量差”的假闭环  
  **Mitigation**: 协议只解决 traceability 和 readiness，不取代测试质量审查；项目仍需保留 review / validate

## Migration Plan

### Phase 1: 定义协议

- 固化 `scenario_id`、plan mapping、verification artifact、closure check、archive readiness 的标准层语义
- 为 companion 准备 fixture corpus，覆盖常见 gap 类型

### Phase 2: 构建 reference implementation

- 实现独立 companion 命令：`init`、`check`、`report`
- 实现项目适配配置 `.openspec-closure.yaml`
- 在当前仓库中做 reference adapter，但不修改 upstream workflow 文件

### Phase 3: 试点一个 active change

- 选一个仍在推进中的 change，例如 `deck-chat-message-contract`
- 生成 scenario inventory、verification artifact、closure report
- 根据试点结果收敛状态枚举和 gap taxonomy

### Phase 4: 推广与抽离

- 将 reference implementation 抽成独立 plugin / tool 包
- 在其他同样采用 OpenSpec + superpowers 的项目中只做薄接入

**Rollback strategy**:

- 该协议是附加能力，不替换原有 OpenSpec / superpowers 生命周期
- 如果 companion 不稳定，项目可以临时退回原有手工 archive 流程，不会影响已有 change artifact

## Open Questions

- `scenario_id` 的推荐语法是否应该完全固定，还是只要求稳定唯一即可
- verification artifact 的 canonical 文件名是否固定为 `verification.yaml`，还是允许通过配置完全自定义
- `deferred` / `waived` 这类状态是否属于协议层核心状态，还是交给项目扩展
- 是否需要 companion 提供 plan coverage matrix 的自动生成，而不仅是校验
