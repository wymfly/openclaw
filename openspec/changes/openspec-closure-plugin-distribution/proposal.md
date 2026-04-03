## Why

`openspec-closure-companion` 已经定义了 portable closure protocol，并在当前仓库给出了 reference implementation，但真正可执行的 companion 仍然是 repo-local 的：

- `scripts/openspec-closure.ts`
- `scripts/lib/openspec-closure/*`
- `.openspec-closure.yaml`

这意味着用户级 skill 虽然能在任意新项目或新 worktree 中被触发，但没有安装到项目里的 companion core 时，agent 只能“知道应该做 closure”，却不能直接执行 closure。对于同时使用 Codex 和 Claude Code、并在多个采用 OpenSpec + superpowers 的项目间切换的工作流来说，这还不够。

现在需要把 closure companion 从“某个仓库里的 reference implementation”提升为“可安装、可激活、可跨项目复用的插件交付面”，同时保持 project adapter 仍然是薄配置，而不是要求每个项目 vendoring 一份 core 脚本。

## What Changes

- 新增 `openspec-closure` 的插件化交付规范，定义 closure companion 如何作为可安装 bundle 提供给 Codex 和 Claude Code
- 明确 runtime-neutral companion core 与 product-specific plugin bundle 的边界，避免把项目脚本目录当成唯一执行面
- 为 Codex 定义一等插件交付面：包含 `.codex-plugin/plugin.json`、bundled skills、wrapper scripts 与可选 marketplace metadata
- 为 Claude Code 定义镜像交付面：提供与 Codex 同名、同语义的 `openspec-closure-workflow` 激活契约和 companion wrapper
- 明确项目接入仍然只依赖薄配置和 change artifacts，例如 `.openspec-closure.yaml`、`verification.yaml`、plan `covers.id`
- 明确新项目 / 新 worktree 的最小 bootstrap 体验：安装插件后，无需再复制 repo-local companion core

## Capabilities

### New Capabilities

- `closure-plugin-distribution`: 定义 closure companion 的安装形态、运行边界和跨产品交付规则
- `closure-workflow-activation`: 定义 manual skill activation 和 wrapper workflow activation 如何稳定触发 closure lifecycle
- `closure-project-bootstrap`: 定义项目如何以薄配置方式接入插件化 closure companion，并在缺失适配层时获得可执行的 bootstrap guidance

### Modified Capabilities

- None

## Impact

- Affected systems:
  - closure companion 的交付形态（从 repo-local reference implementation 升级为可安装 bundle）
  - Codex / Claude Code 的 skill activation surface
  - 各项目的 OpenSpec 收尾接入方式（保留薄配置，不再 vendoring core）
- Expected implementation shape:
  - 一个 runtime-neutral companion core
  - 一个 Codex 插件 bundle
  - 一个 Claude-compatible companion bundle / skill package
  - 一个薄 project adapter 合同
- Explicitly out of scope:
  - 重写 `openspec-closure-companion` 的 protocol/core 语义
  - 直接 patch upstream OpenSpec / superpowers 本体
  - 要求所有项目统一目录结构、包管理器或 CI 平台
