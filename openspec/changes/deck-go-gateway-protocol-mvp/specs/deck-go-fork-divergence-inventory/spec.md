## ADDED Requirements

### Requirement: 自动生成 fork-divergent method 清单

deck-go SHALL 提供脚本对比 `upstream/main` 与当前 fork，自动产出 fork 相对上游新增或修改的 Gateway methods 清单，作为后续完全对齐与适配层迁移提案的输入。

#### Scenario: 脚本输出 markdown 清单

- **WHEN** 在 deck-go 仓内执行 `bunx tsx deck-go/contracts/scripts/fork-divergence-report.ts`
- **THEN** `deck-go/docs/fork-divergent-methods.md` SHALL 被创建或覆盖
- **AND** 文件 SHALL 包含一个 markdown 表格列出每个 fork-divergent method

#### Scenario: 清单条目带 file:line 证据

- **GIVEN** fork 在 `src/gateway/server-methods/wecom-extras.ts` 中新增了 method `wecom.foo`
- **WHEN** 脚本执行
- **THEN** `fork-divergent-methods.md` 中 `wecom.foo` 条目 SHALL 包含 `src/gateway/server-methods/wecom-extras.ts:<line>` 形式的证据链接
- **AND** 条目 SHALL 标识 method 来源（新增 / 修改）

#### Scenario: 清单覆盖 server-methods-list 与 server-methods 目录

- **WHEN** 脚本执行
- **THEN** SHALL diff `git diff upstream/main..HEAD -- src/gateway/server-methods-list.ts src/gateway/server-methods/`
- **AND** SHALL 同时与 `gateway.describe` 输出做对比，取并集，避免遗漏运行时注册的 method

#### Scenario: 上游同步后可重跑校验

- **GIVEN** 开发者完成一次 `git rebase upstream/main`
- **WHEN** 重新执行 `fork-divergence-report.ts`
- **THEN** 脚本 SHALL 重新生成清单，反映 rebase 后的最新差距
- **AND** 若差距列表无变化，SHALL 不修改文件 mtime 之外的内容（确定性输出）

### Requirement: baseline 缺失时优雅降级，不阻塞 CI

`fork-divergence-report.ts` SHALL 在 `upstream/main` ref 不可用时按优先级回退，并不接入 CI 阻塞链路。

#### Scenario: upstream/main 存在时优先使用

- **GIVEN** 本地 git 远端存在 `upstream/main`
- **WHEN** 脚本执行
- **THEN** SHALL 使用 `upstream/main` 作为 baseline

#### Scenario: 仅 origin/main 可用时退而求其次

- **GIVEN** `upstream/main` ref 不存在但 `origin/main` 存在（典型 CI 环境）
- **WHEN** 脚本执行
- **THEN** SHALL 使用 `origin/main` 作为 baseline
- **AND** SHALL 在 stderr 警告 "fallback baseline: origin/main"

#### Scenario: 通过环境变量手动指定 baseline

- **GIVEN** 环境变量 `OPENCLAW_UPSTREAM_BASE` 设为合法 commit SHA
- **WHEN** 脚本执行
- **THEN** SHALL 使用该 SHA 作为 baseline，覆盖前两条优先级

#### Scenario: 全部 baseline 不可用时退化模式

- **GIVEN** `upstream/main`、`origin/main` 都不存在且无 `OPENCLAW_UPSTREAM_BASE`
- **WHEN** 脚本执行
- **THEN** SHALL 以 0 退出码完成
- **AND** 输出文件中所有条目 SHALL 标记 `Type = baseline-unavailable`，列出 fork 当前所有 method 名
- **AND** stderr SHALL 警告 "no upstream baseline available; report is incomplete"

#### Scenario: 不接入 CI 阻塞

- **GIVEN** `make protocol-check` 在 CI 中执行
- **THEN** SHALL NOT 调用 `fork-divergence-report.ts`
- **AND** fork-divergent 报告仅在 `make fork-divergence-report` 显式调用时生成

### Requirement: 清单条目结构化字段

每个 fork-divergent method 条目 SHALL 至少包含以下字段：method 名、变更类型、来源文件证据、简短理由（如已知）。

#### Scenario: 表头字段完整

- **WHEN** `fork-divergent-methods.md` 被打开
- **THEN** 表头 SHALL 包含 `Method | Type | Evidence | Notes` 四列
- **AND** `Type` SHALL 为 `added` 或 `modified` 二选一
- **AND** `Notes` 列 SHALL 允许为空（理由由人工事后补充）
