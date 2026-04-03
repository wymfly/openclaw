## 1. Ownership Freeze

- [x] 1.1 明确 must-move、must-keep、historical-evidence 三份清单
- [x] 1.2 确认 sibling repo 的目标名称、根目录和最小目录结构
- [x] 1.3 确认 `openspec/changes/openspec-closure-companion/` 的迁出策略

## 2. Sibling Repo Bootstrap

- [x] 2.1 在 OpenClaw 同级目录创建独立 repo，并迁入 closure core、repo CLI、plugin bundles
- [x] 2.2 迁入 generic tests、fixtures、generic docs、generic OpenSpec artifacts
- [x] 2.3 让 sibling repo 能独立运行和验证，不再依赖 OpenClaw 内部实现路径

## 3. Consumer Validation

- [x] 3.1 用 sibling repo 的 closure tooling 对当前 OpenClaw 仓库执行 consumer 验证
- [x] 3.2 验证 Codex / Claude bundle 仍能以 OpenClaw 作为 consumer 运行
- [x] 3.3 明确 OpenClaw 迁移后的最小接入说明

## 4. OpenClaw Cleanup

- [x] 4.1 删除已迁出的 tooling source、generic tests、generic docs、generic specs、package scripts
- [x] 4.2 保留 `.openspec-closure.yaml`、OpenClaw 的 verification artifacts、archive evidence
- [x] 4.3 确认 OpenClaw 主 spec 集合不再包含 generic closure tooling capability

## 5. Final Verification

- [x] 5.1 验证 sibling repo 自身的测试/build/插件入口
- [x] 5.2 验证 OpenClaw 作为 consumer 仍可被 closure tooling 成功处理
- [x] 5.3 复核保留资产完整且未误删历史证据
