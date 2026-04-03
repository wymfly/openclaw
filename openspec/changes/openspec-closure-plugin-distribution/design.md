## Context

`openspec-closure-companion` 已经把 closure protocol 的标准层定了下来：

- scenario inventory 以 `scenario_id` 为主键
- plan ownership 通过 `covers.id` 做 machine-checkable 映射
- verification artifact 使用 `verification.yaml`
- closure checker 输出 gap report 和 `archiveReady`

但当前 reference implementation 仍然只存在于本仓库里。用户级 skill 可以跨项目触发，实际执行能力却依赖项目里是否存在 `scripts/openspec-closure.ts` 和相关库文件。这个模型适合验证 protocol，不适合在多个 OpenSpec + superpowers 项目中稳定复用。

插件化 change 要解决的是交付和激活问题：

- **交付**：closure companion 该如何被安装到 Codex / Claude Code 环境中
- **激活**：agent 在任意项目里被手动或 workflow 路由时，如何稳定找到 companion core
- **接入**：项目应保留哪些 repo-owned 文件，哪些不再需要复制

## Goals / Non-Goals

**Goals:**

- 把 closure companion 提升为可安装的、跨项目复用的 bundle，而不是单仓库脚本
- 保持 companion core 的 runtime-neutral 边界，让 Codex 和 Claude Code 共用同一套 closure 语义
- 为 Codex 和 Claude Code 提供同名、同语义的 `openspec-closure-workflow` 激活方式
- 让新项目或新 worktree 在安装插件后，只需补薄配置即可运行 closure lifecycle
- 保持现有 project adapter 合同最小化，不要求项目复制 companion core

**Non-Goals:**

- 不重新设计 `scenario_id`、`verification.yaml`、gap taxonomy 或 `archiveReady` 语义
- 不强制修改 upstream `codex-dev-workflow`、`dev-workflow`、`openspec-workflow` 本体
- 不要求所有项目都必须通过 package-manager script 调用 closure；CLI、wrapper command 或 CI 都可以是接线方式
- 不把当前仓库里的 reference implementation 立即删掉；迁移可以分阶段进行

## Decisions

### D1: runtime-neutral companion core 仍是唯一真源

**选择**：closure checking、inventory 解析、plan coverage 解析、verification artifact 读写等核心逻辑保持在一个 runtime-neutral core 中。产品交付面只负责：

- 包装命令入口
- 暴露 skill
- 提供 product-specific manifest / installation metadata

**原因**：

- 避免 Codex / Claude 各自复制一份 checker 逻辑
- 便于多项目共享同一套 closure 语义
- 后续升级 gap taxonomy 或 artifact schema 时，不必同时改多份实现

### D2: Codex 使用一等插件 bundle 作为主要交付面

**选择**：Codex 侧提供一个正式插件 bundle，至少包含：

- `.codex-plugin/plugin.json`
- `skills/openspec-closure-workflow/SKILL.md`
- bundled closure executable / wrapper
- companion core 所需的本地脚本或可执行入口

**原因**：

- Codex 已有明确的插件交付结构
- 用户可以在任意项目中安装同一个插件，而不是复制仓库脚本
- workflow skill 与 companion core 可以在同一 bundle 中一起发布

### D3: Claude Code 提供与 Codex 语义一致的 companion bundle

**选择**：Claude Code 侧也提供可安装的 companion bundle 或 skill package，保证以下契约一致：

- skill 名称仍为 `openspec-closure-workflow`
- lifecycle 仍为 `init / report / check`
- 激活语义与 Codex 一致

实现载体可以是 Claude 插件 bundle 或官方支持的 skill bundle，但不能再依赖某个单独项目里的 core 脚本。

**原因**：

- 用户明确在 Codex 与 Claude Code 间切换
- 只做 Codex bundle 会把 closure workflow 重新变成单产品能力

### D4: 项目接入继续保持薄适配

**选择**：插件化之后，项目仍然只保留以下 repo-owned 接入面：

- `.openspec-closure.yaml`
- `openspec/changes/<change>/verification.yaml`
- plan 中的 `covers.id`

项目可以选择额外提供 `package.json` scripts 或 CI wrapper，但这不是协议必须项。

**原因**：

- 如果项目还需要 vendoring `scripts/openspec-closure.ts`，插件化就失去意义了
- 应把“项目负责数据与策略，插件负责执行能力”这个边界说清

### D5: activation 以显式 skill 为核心，wrapper workflow 只做路由

**选择**：插件必须提供可手动激活的 `openspec-closure-workflow`。可选的 `codex-workflow`、`dev-workflow`、`openspec-workflow` 集成只能做薄路由：

- 在 OpenSpec 实施前提示或调用 closure init
- 在 archive 前提示或调用 closure report/check

wrapper 不得复制 companion 内部规则。

**原因**：

- 用户需要“一句激活”的稳定入口
- 同时要避免在多个 workflow skill 中重复 closure 逻辑，造成漂移

### D6: 新项目 / 新 worktree 的成功路径以“已安装插件 + 薄配置”定义

**选择**：插件化后的成功路径是：

1. 用户环境已安装 companion bundle
2. 项目中存在 `.openspec-closure.yaml`
3. change 存在 `scenario_id`、plan `covers.id`，并可生成 `verification.yaml`

对同仓库新 worktree，不要求重复安装；对全新项目，不要求复制 repo-local core。

**原因**：

- 这是用户真正关心的跨项目可移植性
- 也能把“skill 可触发但 companion 不存在”的半成品状态彻底消掉

### D7: 缺失适配层时返回 bootstrap guidance，而不是原始文件错误

**选择**：当插件在某个项目里找不到 `.openspec-closure.yaml`、匹配不到 plan、或 change 缺少 `verification.yaml` 时，应优先输出可执行的 bootstrap guidance，例如：

- 需要新增什么配置文件
- 建议放在哪个路径
- 下一条应运行的命令是什么

而不是直接把 `ENOENT` / parse stack trace 暴露给用户。

**原因**：

- 插件化之后，第一次接入某个新项目会非常常见
- 如果首个体验是底层错误，workflow 很难真正推广

## Risks / Trade-offs

- **[双产品交付增加复杂度]** Codex 与 Claude 的插件/skill 结构不同  
  **Mitigation**: 把 companion core 作为单一真源，bundle 层只做适配

- **[现有 repo-local reference implementation 与插件版本并存]** 可能造成短期双轨  
  **Mitigation**: 明确 reference implementation 仅用于开发/测试，跨项目使用优先插件 bundle

- **[workflow 集成边界模糊]** 容易退化成“到处复制 closure 规则”  
  **Mitigation**: 明确 wrapper skill 只做路由，手册和测试都验证不重复实现 companion 逻辑

- **[新项目接入体验不一致]** 不同项目的 plan 目录、package-manager、CI 都不同  
  **Mitigation**: 所有项目差异都收敛到 `.openspec-closure.yaml` 与最小 bootstrap guidance

## Migration Plan

### Phase 1: 固化插件交付合同

- 明确 Codex bundle、Claude bundle、runtime-neutral core 和 project adapter 的边界
- 为 activation contract 和 bootstrap contract 建立验收 spec

### Phase 2: 搭建 bundle 骨架

- 用 Codex 插件骨架工具搭建 Codex plugin
- 搭建 Claude-compatible bundle / skill package
- 保证两侧都能调用同一 companion core

### Phase 3: 连接 workflow 与 bootstrap

- 为 `openspec-closure-workflow` 提供 product-local assets
- 明确 `codex-workflow` / `dev-workflow` / `openspec-workflow` 的推荐路由方式
- 补新项目 / 新 worktree 的 bootstrap guidance

### Phase 4: 试点与迁移

- 在当前仓库用插件化 bundle 取代 repo-local 调用路径做一次试点
- 验证对另一个工作树或 fixture project 的可复用性
- 最后再决定 reference implementation 的保留策略

## Open Questions

- Claude Code 侧最终使用 `.claude-plugin` 还是 skill bundle 作为官方交付面
- Codex / Claude 插件是否应共享同一发布仓库，还是从同一源代码分别打包
- 项目是否需要一个自动 bootstrap 命令来生成 `.openspec-closure.yaml` 模板
