## Context

前两轮工作已经完成了两件事：

1. 在当前仓库中实现了 portable closure companion 与 plugin bundles
2. 在 Codex 和 Claude Code 中完成了真实安装验证

这说明 closure workflow 已经从“概念”进入“可用工具”阶段。问题也因此从“能不能做出来”切换为“它应该归谁拥有”。

当前仓库里同时存在三类和 `openspec-closure` 相关的资产：

### A. 工具主体，应迁出

- `packages/openspec-closure-core/`
- `plugins/openspec-closure/`
- `plugins/openspec-closure-claude/`
- `scripts/openspec-closure.ts`
- `scripts/lib/openspec-closure/*`
- `test/scripts/openspec-closure*.test.ts`
- `test/fixtures/openspec-closure*/**`
- `docs/reference/openspec-closure-companion.md`
- `docs/reference/openspec-closure-plugin.md`
- `package.json` 中的 `openspec:closure:*` scripts
- `openspec/specs/closure-plugin-distribution/spec.md`
- `openspec/specs/closure-project-bootstrap/spec.md`
- `openspec/specs/closure-workflow-activation/spec.md`
- 与这些 repo-owned tooling 对应的 active change / plan artifacts

### B. 项目消费层，应保留

- `.openspec-closure.yaml`
- OpenClaw 自己各个 change 的 `verification.yaml`
- 当前仓库后续作为 consumer 使用外部插件时所需的最小接入说明

### C. 历史验证证据，应保留

- 已归档的 change 目录及其中的 `verification.yaml`
- 证明 OpenClaw 真实跑过 closure workflow、并以它收敛过 OpenClaw spec 的历史记录
- 与 OpenClaw adoption 直接相关的归档 provenance

迁移设计的关键不是“全搬走”，而是把 B/C 和 A 严格区分。

## Goals / Non-Goals

**Goals**

- 在 OpenClaw 同级目录建立一个独立 sibling repo，承接 `openspec-closure` 的工具主体
- 清理 OpenClaw 中不属于产品仓库的 closure tooling/source/testing/docs/spec 资产
- 保留 OpenClaw 本地真正属于项目资产的 consumer config、verification artifacts 和历史验证证据
- 让迁移后的 OpenClaw 继续能作为外部 consumer 使用已安装插件

**Non-Goals**

- 不改变 `scenario_id`、`verification.yaml`、`archiveReady`、gap taxonomy 等 closure protocol 语义
- 不修改用户级 skill 的名称或激活口令
- 不要求在当前回合里完成发布到远端代码托管；本次只定义本机 sibling repo 迁移边界与落地步骤

## Decisions

### D1: sibling repo 成为 closure tooling 的唯一 source of truth

**选择**

在 OpenClaw 同级目录创建独立 repo（建议 `../openspec-closure`），承接：

- shared core
- repo CLI / launchers
- Codex plugin bundle
- Claude bundle
- generic docs
- generic tests / fixtures
- generic closure OpenSpec specs / plans / active changes

**原因**

- 这些资产服务于多个 OpenSpec + superpowers 项目
- 它们的发布、测试、安装和所有权已经脱离 OpenClaw 产品边界

### D2: OpenClaw 只保留 consumer adapter 与 project evidence

**选择**

OpenClaw 迁移后只保留：

- `.openspec-closure.yaml`
- OpenClaw 自己的 `openspec/changes/**/verification.yaml`
- OpenClaw 自己的 archived change evidence
- 必要时一份很薄的 consumer-facing contributor note

OpenClaw 不再保留：

- shared core 源码
- plugin bundles
- repo-local closure executable / wrapper
- generic closure tests / fixtures
- generic plugin docs
- 把 closure tooling 当作当前 repo 官方 capability 的主 specs
- `package.json` 中仅用于本仓库分发 closure tooling 的 scripts

**原因**

- 这样才能把“项目负责数据和消费配置，工具 repo 负责执行能力”真正做实

### D3: historical evidence 保留，但不再作为当前产品 capability 暴露

**选择**

以下资产必须保留在 OpenClaw：

- 归档的 `openspec/changes/archive/2026-04-03-deck-chat-message-contract/verification.yaml`
- 归档的 `openspec/changes/archive/2026-04-03-openspec-closure-plugin-distribution/verification.yaml`
- 对应 archive 目录中能够证明 OpenClaw 真正跑过 closure workflow 的历史记录

但这些保留资产必须被视为：

- provenance
- historical evidence

而不是 OpenClaw 当前仍拥有的 plugin/tooling source。

**原因**

- 用户明确要求保留“实际跑过并验证过”的项目资产
- 同时必须避免这些保留证据继续误导为 repo-owned capability

### D4: generic closure main specs 迁出，OpenClaw 不再对其主规范负责

**选择**

迁移完成后，`openspec/specs/closure-*` 不再留在 OpenClaw 主 spec 集合中。它们的权威版本迁移到 sibling repo。OpenClaw 只保留与自身产品能力直接相关的 specs。

**原因**

- 主 spec 集合表达的是当前仓库拥有并持续维护的能力
- `closure-plugin-distribution` / `closure-project-bootstrap` / `closure-workflow-activation` 已经超出 OpenClaw 产品能力范围

### D5: 迁移顺序以“先外移、再切换、后清理”为准

**选择**

按以下顺序实施：

1. 在 sibling repo 建立完整工具主体
2. 让 sibling repo 的 bundle / core 对 OpenClaw 仓库做外部 consumer 验证
3. 从 OpenClaw 删除已迁出的 source/test/docs/spec surfaces
4. 保留并复核 consumer config 与历史证据

**原因**

- 先删后迁风险太高
- 先在外部 repo 验证，才能证明清理 OpenClaw 后不会失去可用性

### D6: 当前 in-progress 的 generic closure change 一并迁出

**选择**

`openspec/changes/openspec-closure-companion/` 及其计划文件不再作为 OpenClaw 的 active change 持续推进，而是迁移到 sibling repo 作为工具 repo 的持续开发记录。

**原因**

- 这是 generic closure tooling 的 source-of-truth，而不是 OpenClaw 产品改造本身
- 如果继续把它留在 OpenClaw active changes 中，仓库边界会再次混乱

## Risks / Trade-offs

- **[跨仓库迁移会引入双边改动]** 当前仓库和 sibling repo 都要变  
  **Mitigation**: 先用 OpenSpec 固定边界，再按“外移完成后再清理”的顺序推进

- **[OpenClaw 清理过度，误删项目证据]**  
  **Mitigation**: 在 plan 中显式列出 must-keep 清单，并用验证命令再次确认 archive evidence 仍在

- **[用户级 skill 仍引用旧命令习惯]**  
  **Mitigation**: sibling repo 保持相同 lifecycle 语义和激活名，OpenClaw 只调整消费说明，不改 skill 名称

- **[写 sibling repo 需要跨出当前 workspace]**  
  **Mitigation**: 在真正实施时使用受控的外部写入，并先备份/确认目标目录状态

## Migration Plan

### Phase 1: 固化 ownership / retention contract

- 明确迁出清单、保留清单、历史证据清单
- 为 sibling repo 目录结构和 OpenClaw consumer boundary 建 spec

### Phase 2: 搭建 sibling repo source-of-truth

- 在 OpenClaw 同级目录创建独立 repo
- 迁入 shared core、bundles、generic docs/tests/specs/plans
- 修正包管理、导入路径和验证命令

### Phase 3: 以 OpenClaw 作为外部 consumer 做交叉验证

- 用 sibling repo 的 closure tooling 对当前 OpenClaw 仓库运行 `init/report/check`
- 验证 Codex / Claude bundle 仍能对 OpenClaw 作为 consumer 生效

### Phase 4: 清理 OpenClaw

- 删除工具主体与 generic closure surfaces
- 保留 `.openspec-closure.yaml`、verification artifacts、archive evidence
- 更新当前仓库中的最小 consumer-facing 说明

## Open Questions

- sibling repo 是否在本地直接初始化为 git repo，还是先只创建工作目录和文件结构
- OpenClaw 是否还需要保留 package-manager convenience scripts，还是完全依赖外部已安装插件
- OpenClaw 是否保留一页最小 consumer note，还是只在 `AGENTS.md` 中说明
