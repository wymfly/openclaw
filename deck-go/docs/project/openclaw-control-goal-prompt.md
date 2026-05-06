# OpenClaw Control Goal Prompt

> 这份文档用于后续 `/goal` 启动时作为执行提示词读取。它不是 OpenSpec
> proposal，不替代任何具体 change 的 `proposal.md`、`design.md`、`tasks.md`
> 或 `verification.yaml`。进入实际实施前，仍必须先读取相关 OpenSpec artifact
> 和最新代码真相。

## Goal

在 Codex App 派生的新 worktree 上持续推进 OpenClaw Control 的部署、安装、打包、运维基础设施设计与实施。

## Background

`deck-go` 今后定位为 OpenClaw Gateway 的 Control 端，包含：

1. Web Control：Go backend + Vite/React `frontend-new`，由 Go 服务托管静态前端，浏览器打开本地地址。
2. Native Control：薄包装壳 / WebView，只负责启动/停止同一个 Go backend 并展示本地 Control URL。

Gateway 仍保持现有两种接入方式：

1. `remote`：连接已有 Gateway。
2. `bundled`：按现有 `RUNTIME_BUNDLED_*` 配置启动本地 Gateway。

不要重构 Gateway runtime，不要复活 legacy `dashboard/`，不要把 native shell 变成业务层。

## Worktree Discipline

- 使用 Codex App 从当前 session 派生的新 worktree 执行后续 `/goal`。
- 不在主 worktree 直接修改。
- 不继续使用之前手动创建的 `work/openclaw-control-productization` worktree；那条线只作为历史探索参考，默认放弃。
- 开始前先检查新 worktree 状态、当前分支、与 `enhanced` / `origin/enhanced` 的差距。
- 若需要迁移旧 productization 探索内容，必须先通过 `$openspec-explore` 重新验证主线代码和 OpenSpec 真相，再按新 worktree 的当前基线重新创建或更新 proposal；不要直接依赖旧 worktree 的未提交状态。
- 禁止破坏性 reset/checkout。若有冲突，先整理冲突风险和本地改动清单；只处理本任务相关冲突。

## Architecture Principles

- OpenClaw Gateway 是 runtime plane 和业务权威。
- `deck-go` backend 是唯一 Control BFF、runtime facade、supervisor、projection、package entrypoint。
- `frontend-new` 是唯一 Control UI 产品面。
- Web/native 壳只能访问 `deck-go` backend，不能直接连接 Gateway。
- Native Control 只是薄壳，不拥有业务 API、不拥有 Gateway runtime、不复制 agent runner。
- 发布目标是开源/内部工具级可发布项目，不做商业发布体系：不要求自动更新、签名、公证、复杂 installer，但要能清晰编译、打包、安装、启动、调试、运维。

## Required Reading

开始任何实施前，先读取：

- 根 `AGENTS.md` 与 `deck-go/AGENTS.md`。
- `openspec/changes/deck-go-contract-chain-audit-and-real-e2e-foundation/proposal.md`
- `openspec/changes/deck-go-contract-chain-audit-and-real-e2e-foundation/design.md`
- `openspec/changes/deck-go-contract-chain-audit-and-real-e2e-foundation/tasks.md`
- `openspec/changes/deck-go-contract-chain-audit-and-real-e2e-foundation/verification.yaml`
- `deck-go/docs/contract-chain-audit.matrix.json` 与生成 Markdown。
- `deck-go/docs/project/contract-chain-guide.md`。
- 本文档：`deck-go/docs/project/openclaw-control-goal-prompt.md`。
- 如涉及 `frontend-new`，先读 `frontend-new` 本地指南；但除非提案明确允许，不修改 active panel/module hot path。

## Execution Discipline

1. 每个新提案开始前必须先做 `$openspec-explore`。
2. explore 阶段只读，不实现；必须产出 evidence packet：
   - 当前代码已支持什么。
   - 相关 contract-chain matrix row，或说明为什么不适用。
   - 相关 source authority、contracts、BFF/frontend facade、E2E evidence。
   - 与现有 active OpenSpec changes 的重叠风险。
   - 预计写入范围。
   - 验证命令。
   - 不确定问题和不能假设的部分。
3. 只有 explore 足够后，才创建或更新 OpenSpec proposal/design/spec/tasks。
4. OpenSpec artifacts 是实施时唯一规划源，不创建平行计划文档。
5. 实施必须小切片、可验证；任务完成后才能勾选 `tasks.md`。
6. 任何 claim 完成前必须运行 fresh verification。
7. 不引入新依赖，除非单独 proposal 明确比较和批准。
8. 不修改 legacy `dashboard/`、`deck-e2e/`、`deploy/`。
9. 不触碰安全 `CODEOWNERS` 范围。
10. 不把 unsupported prototype capability 当成已完成产品能力；必须按 contract matrix 降级、隐藏、标记 unsupported，或进入后续 proposal。

## Initial Priorities

1. 在新 worktree 中确认主线真相：`git status`、`git log`、`openspec list --json`、contract-chain matrix、当前 active changes。
2. 通过 `$openspec-explore` 复查 OpenClaw Control productization 的当前边界，使其显式依赖 `deck-go-contract-chain-audit-and-real-e2e-foundation`。
3. 如果仍需要 `packaged-runtime-smoke`，不要直接使用旧 worktree 结果；先在新基线上重新 explore，再创建或更新对应 OpenSpec change。
4. 在不进入大实现的前提下，准备第一个完整基础设施提案，候选名：
   - `deck-go-control-distribution-foundation`
   - `deck-go-package-root-conventions`
5. 第一个基础设施提案应覆盖但不一次性全实现：
   - package root / app root / data root / logs root / run root / config root。
   - Web Control portable bundle。
   - `remote` / `bundled` / debug profile 示例。
   - `start` / `stop` / `status` / `logs` / `doctor` 运维脚本方向。
   - packaging smoke 与 real-e2e / contract-chain audit 的关系。
   - 后续 Native Control thin shell 的前置约束。

## Recommended Sequence

1. New worktree truth scan。
2. Productization umbrella proposal。
3. Package root conventions proposal。
4. Portable Web Control proposal and implementation。
5. Runtime profiles + ops scripts proposal and implementation。
6. Diagnostics / doctor proposal and implementation。
7. Native shell decision proposal。
8. Native shell implementation only after package/start protocol stable。

## Verification Baseline

- OpenSpec：`openspec validate <change> --strict`。
- Contract matrix：`cd deck-go && make contract-chain-audit-check`。
- Contract surfaces touched：`cd deck-go && make contract-gate` 或 narrow matching target。
- Backend touched：`cd deck-go && make backend-test` 或 focused Go tests。
- Frontend touched：`cd deck-go && make frontend-build` 或 focused frontend tests。
- Packaging touched：packaged runtime smoke / portable bundle smoke。
- Always run `git diff --check` before claiming completion。

## Completion Report Shape

每轮最终报告必须说明：

- 当前 change/proposal 状态。
- changed files。
- verification evidence。
- remaining risks / deferred decisions。
- next recommended OpenSpec slice。
