## Why

`openspec-closure` 现在已经以 shared core、Codex bundle、Claude bundle 的形态可运行、可安装，但这些实现资产仍然驻留在 OpenClaw 仓库中：

- `packages/openspec-closure-core/`
- `plugins/openspec-closure/`
- `plugins/openspec-closure-claude/`
- `scripts/openspec-closure.ts`
- `scripts/lib/openspec-closure/*`
- `docs/reference/openspec-closure-*.md`
- `test/scripts/openspec-closure*.test.ts`

它们本质上属于跨项目开发基础设施，而不是 OpenClaw 产品能力。继续把它们留在当前仓库，会让模块所有权、测试职责、发布形态和文档边界长期混在一起。

用户已经明确希望把这些资产迁移到 OpenClaw 同级目录下的独立自研插件仓库中，同时要求保留当前项目中那些已经真实证明“OpenClaw 曾经使用并验证过这套插件/流程”的项目资产。

## What Changes

- 新增一套 repo extraction 规范，把 `openspec-closure` 的工具主体迁移到 OpenClaw 同级目录下的独立 sibling repo
- 明确 OpenClaw 只保留 consumer boundary：
  - `.openspec-closure.yaml`
  - OpenClaw 自己的 `openspec/changes/**/verification.yaml`
  - 归档后的验证证据与迁移 provenance
- 明确哪些资产必须从 OpenClaw 移除：
  - shared core
  - repo-local CLI / wrapper
  - Codex / Claude plugin bundles
  - 通用测试夹具
  - 通用插件文档
  - 当前仓库中把这些工具当作 repo-owned capability 的主 spec
- 明确 sibling repo 将成为新的 source of truth，并负责后续 closure companion / plugin 的实现、测试、文档和分发

## Capabilities

### New Capabilities

- `closure-tooling-ownership`: 定义 closure tooling 的 source-of-truth 必须位于独立 sibling repo，而不是 OpenClaw 产品仓库
- `closure-openclaw-consumer-boundary`: 定义 OpenClaw 迁移后只保留 consumer config、本地 verification artifacts 与历史验证证据
- `closure-migration-retained-evidence`: 定义迁移过程中哪些项目资产必须保留，避免在清理时误删真实验证结果

### Modified Capabilities

- None

## Impact

- Affected systems:
  - OpenClaw repo 内的 closure tool/package/plugin/docs/tests/spec ownership
  - 新 sibling repo 的脚手架与 source-of-truth 目录结构
  - OpenClaw 作为 consumer 时的接线方式
- Expected implementation shape:
  - 在 OpenClaw 同级目录创建独立 repo（建议名 `openspec-closure`）
  - 迁出 closure core、plugin bundles、generic docs/tests/specs
  - OpenClaw 仅保留 consumer adapter 和 historical evidence
- Explicitly out of scope:
  - 重写 closure protocol 的语义
  - 修改 upstream OpenSpec / superpowers 本体
  - 改写 Codex / Claude 的安装机制
