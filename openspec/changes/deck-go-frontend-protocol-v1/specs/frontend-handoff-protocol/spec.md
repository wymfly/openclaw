## ADDED Requirements

### Requirement: 协议三入口 CLAUDE.md 必须存在且互引

deck-go 仓库 SHALL 维持以下三个 CLAUDE.md 入口文件，每个文件 MUST 在顶部链接其余两个：

- `deck-go/docs/CLAUDE.md`：项目文档导航 + 现状段
- `deck-go/frontend-new/CLAUDE.md`：真实工程协议
- `deck-go/frontend-handoff/CLAUDE.md`：双 agent 协作协议

旧 `deck-go/frontend/CLAUDE.md` SHALL 在顶部加冻结提示，标明"此目录已冻结，新工作 see ../frontend-new/CLAUDE.md"。

#### Scenario: agent 落地于 frontend-handoff 目录

- **WHEN** 设计 agent 第一次进入 `frontend-handoff/`
- **THEN** 它读到的 `CLAUDE.md` 顶部 MUST 链接到 `docs/CLAUDE.md` 和 `frontend-new/CLAUDE.md`，且明确标记自身角色为"双 agent 协作协议"

#### Scenario: agent 落地于 frontend-new 目录

- **WHEN** Claude Code 第一次进入 `frontend-new/`
- **THEN** 它读到的 `CLAUDE.md` 顶部 MUST 链接到 `docs/CLAUDE.md` 和 `frontend-handoff/CLAUDE.md`，且明确标记自身角色为"真实工程协议"

#### Scenario: agent 落地于旧 frontend 目录

- **WHEN** 任何 agent 进入旧 `frontend/`
- **THEN** 它读到的 `CLAUDE.md` 顶部 MUST 包含冻结提示，引导其切换到 `frontend-new/CLAUDE.md`

### Requirement: 协议必须提供 orientation 路径

每份 CLAUDE.md MUST 在专门段落"如何获悉当前状态"中列出落地 agent 应按顺序读取的真实目录/文件路径。状态发现 SHALL 完全依赖目录树和文件内容（含 module README 的 `Status:` 行），不依赖任何 journal/log 文件。

#### Scenario: 设计 agent 想知道哪些模块已实现

- **WHEN** 设计 agent 落地后想了解模块状态
- **THEN** 它按 `frontend-handoff/CLAUDE.md` 中的 orientation 段落，`ls frontend-handoff/modules/` 并读各 README 的 `Status:` 行获悉
- **AND** 协议 MUST NOT 要求读 STATE.md / journal 类文件（这些不存在）

#### Scenario: Claude Code 想知道有哪些 atom 可复用

- **WHEN** Claude Code 准备实现一个新模块
- **THEN** orientation 段告诉它读 `frontend-new/src/design-system/atoms/index.ts` barrel 即可获悉，无需 INVENTORY.md

### Requirement: 协议 MUST 与具体技术栈解耦

`frontend-handoff/CLAUDE.md` 和 `frontend-new/CLAUDE.md` MUST NOT 硬编码 server-state / shared-state / routing / i18n 等具体库选择。具体库决议 SHALL 单独维护在 `docs/project/stack-decisions.md`。协议条款只描述契约（如"server state 与 UI state 分桶"），不描述实现库。

#### Scenario: 项目栈选择变更

- **WHEN** 项目决定从 lib X 切换到 lib Y
- **THEN** 修改仅发生在 `docs/project/stack-decisions.md`，`frontend-handoff/CLAUDE.md` 和 `frontend-new/CLAUDE.md` MUST 不需要任何修改

#### Scenario: agent 翻译 prototype 时需查具体栈

- **WHEN** Claude Code 翻译原型，遇到 server-state / routing 等需要具体库的决策
- **THEN** 它从协议得到"分桶原则"，从 `stack-decisions.md` 得到"当前用什么库"，两者结合执行

### Requirement: 协议 MUST 包含 8 条结构性增强条款

`frontend-handoff/CLAUDE.md` MUST 包含以下 8 条扩展条款（在主体协议后专门段落呈现）：

1. **Lite handoff 通道**：trivial 改动（≤1 文件改动 + 描述）允许跳过 6 件套
2. **反向签收**：实施完成后设计 agent 跑视觉对照确认，prototype 才正式归档
3. **Atom 复用 gate**：新增 atom 必须证明现有不能扩展
4. **Pattern 层**：跨模块的 NavRail/TopBar/PageShell 等住 `src/design-system/patterns/`，不在 atoms/ 也不在 panels/
5. **后端契约协商**：`api-usage.md` 假设的 endpoint 不存在时走 raise 流程，禁止设计静默扭曲
6. **冲突分级**：framework-blocker / 工程代价 / 个人偏好 三档；framework-blocker 必须 raise，个人偏好不算 disagreement
7. **Token drift CI**：双向 tokens 文件强制脚本检查（`scripts/check-tokens-drift.sh`）
8. **Version lock**：CLAUDE.md 顶部 protocol-vN 标识；revise 期间不允许新模块切入

#### Scenario: trivial 改动走 lite handoff

- **WHEN** 设计 agent 只想调整某 atom 的 hover 态颜色
- **THEN** 协议允许它仅在 `proposals/` 写一个一段描述的提案，跳过 6 件套，Claude Code 直接评审

#### Scenario: tokens 文件漂移

- **WHEN** Claude Code 改了 `frontend-new/src/design-system/tokens/index.css` 但忘了同步 handoff
- **THEN** `scripts/check-tokens-drift.sh` 运行时返回非 0，CI（接入后）阻断 commit

#### Scenario: 设计提议新 atom

- **WHEN** 设计 agent 想在 `frontend-handoff/design-system/atoms/<NewAtom>/` 提议新 atom
- **THEN** 它的 proposal MUST 包含一段 reuse 分析，证明现有 36 atoms 中无适合扩展项

### Requirement: tokens 文件必须保持双向一致

`frontend-handoff/design-system/tokens.css` 和 `frontend-new/src/design-system/tokens/index.css` 的 token 定义部分 MUST 保持一致。`scripts/check-tokens-drift.sh` SHALL 提供机器可读的 drift 检测，返回 0 表示一致、非 0 表示漂移并打印 diff。

#### Scenario: 协议落地时初始反向同步

- **WHEN** protocol-v1 落定时
- **THEN** `frontend-handoff/design-system/tokens.css` 整段被 `frontend/src/design-system/tokens/index.css` 内容覆盖
- **AND** drift 脚本在该 commit 后执行返回 0

#### Scenario: 设计 agent 提议 token 变更

- **WHEN** 设计 agent 修改 `frontend-handoff/design-system/tokens.css` 并写 proposal
- **THEN** 在 Claude Code 应用到 `frontend-new/.../tokens/index.css` 之前 drift 脚本会返回非 0（这是符合预期的"待审"状态）
- **AND** Claude Code 应用后再跑脚本 MUST 返回 0

### Requirement: 协议必须有支撑文档而不嵌入项目细节

`docs/project/` 下 SHALL 维护以下支撑文档作为 CLAUDE.md 的指针目标：

- `stack-decisions.md`：当前技术栈具体选择（解耦项）
- `current-state.md`：项目代码现状人类可读快照

CLAUDE.md MUST 通过链接指向它们而不是嵌入内容。

#### Scenario: agent 想了解当前 React/Vite 版本

- **WHEN** 任意 agent 想知道项目栈版本
- **THEN** 它从 CLAUDE.md 得到 `docs/project/stack-decisions.md` 的链接，从该文件读取
- **AND** CLAUDE.md 本身 MUST NOT 重复这些版本号

#### Scenario: agent 想了解项目当前实现进度

- **WHEN** agent 第一次落地需要快速 onboarding
- **THEN** 从 CLAUDE.md 得到 `docs/project/current-state.md` 链接，5 分钟内对项目有全局理解
