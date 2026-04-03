## 1. Bundle Contract

- [x] 1.1 明确 runtime-neutral companion core 与 product bundle 的职责边界
- [x] 1.2 定义 Codex / Claude 两侧共享的 `openspec-closure-workflow` activation contract
- [x] 1.3 定义新项目 / 新 worktree 的最小 bootstrap contract

## 2. Codex Bundle

- [x] 2.1 用 Codex 插件骨架搭建 `openspec-closure` 插件目录与 manifest
- [x] 2.2 把 closure companion executable / wrapper 接到插件本地 assets，而不是项目脚本目录
- [x] 2.3 在 Codex bundle 中提供 `openspec-closure-workflow` 及必要的 wrapper workflow skill

## 3. Claude Bundle

- [x] 3.1 搭建 Claude-compatible companion bundle 或 skill package
- [x] 3.2 保证 Claude 侧提供与 Codex 一致的 `openspec-closure-workflow` 语义
- [x] 3.3 验证 Claude 侧不依赖任意单一项目里的 companion core

## 4. Project Bootstrap

- [x] 4.1 明确项目接入只需 `.openspec-closure.yaml`、`verification.yaml` 与 plan `covers.id`
- [x] 4.2 为缺失 adapter / verification artifact 的项目提供 bootstrap guidance
- [x] 4.3 文档化新项目与新 worktree 的接入流程

## 5. Validation

- [x] 5.1 在当前仓库验证插件化 bundle 可替代 repo-local closure 调用路径
- [x] 5.2 在新 worktree 或 fixture project 中验证安装后的跨项目可用性
- [x] 5.3 验证 manual activation 与 workflow routing 都能完成 `init / report / check`
