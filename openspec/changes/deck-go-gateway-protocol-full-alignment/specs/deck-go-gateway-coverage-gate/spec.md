## ADDED Requirements

### Requirement: deck-go CI 阻塞新增 untyped Gateway 调用

deck-go CI SHALL 在 PR 流水线中执行 `make gateway-typecheck`，扫描：(a) Go 端 `internal/runtime/openclaw/`、`internal/handlers/` 路径下 `requester.Request(ctx, "<method>", ...)` 字符串调用；(b) FE 端 **仅**对 `fe-endpoint-classification.md` Category=`gateway-rpc-proxy` 的字符串调用做扫描——`deck-go-bff` 与 `binary-stream-upload` 类不被 gate。除非带行级豁免注释，否则阻塞合并。

#### Scenario: 新增 untyped 调用阻塞 CI

- **scenario_id**: `deck-go-gateway-coverage-gate.untyped-call-blocks-ci`
- **GIVEN** PR 在 `internal/handlers/foo.go` 新增 `q.requester.Request(ctx, "foo.bar", params)` 字符串调用
- **WHEN** CI 执行 `make gateway-typecheck`
- **THEN** 命令 SHALL 报告 `untyped-call: internal/handlers/foo.go:42` 并以非零码退出
- **AND** CI 流水线 SHALL 阻塞合并

#### Scenario: 行级豁免允许字符串调用

- **scenario_id**: `deck-go-gateway-coverage-gate.inline-exception`
- **GIVEN** 某 method 的 result schema 在上游缺失，必须暂时走 untyped
- **WHEN** caller 加 `// gateway:allow-untyped reason: <fork-divergent foo.bar missing schema, tracked at #1234>` 与字符串调用同行
- **THEN** `make gateway-typecheck` SHALL 跳过该行
- **AND** 命令 SHALL 把该豁免追加到 `docs/gateway-untyped-exceptions.md` 用于 PR review

#### Scenario: 白名单 FE endpoint 不触发 violation

- **scenario_id**: `deck-go-gateway-coverage-gate.fe-classification-whitelist`
- **GIVEN** FE 调用 `fetch('/download/logs/abc')` 或 `fetch('/sse/chat/xyz')` 或 `fetch('/upload/files', {method: 'POST'})`
- **WHEN** `make gateway-typecheck` 运行
- **THEN** 白名单匹配 SHALL 跳过这些调用
- **AND** 白名单 SHALL 来源于 PR-17 输出的 `deck-go/docs/fe-endpoint-classification.md` 中 Category=`deck-go-bff` 或 Category=`binary-stream-upload` 的条目，不得在 scanner 源码中维护第二份路径清单

### Requirement: deck-go 输出 coverage 报告并防倒退

deck-go SHALL 通过 `make gateway-coverage-report` 输出 typed binding 覆盖率到 `docs/gateway-coverage.md` 与 `docs/gateway-coverage-baseline.json`；CI SHALL 对比 PR 与 main 的 baseline，任一指标下降即阻塞，除非 PR 含 `gateway-coverage: regress allowed reason: <文字>` 豁免（commit message 或 PR description 任一处即可）。

#### Scenario: 报告输出四个核心指标

- **scenario_id**: `deck-go-gateway-coverage-gate.coverage-report-metrics`
- **WHEN** 执行 `make gateway-coverage-report`
- **THEN** `docs/gateway-coverage-baseline.json` SHALL 含字段 `{upstream_typed: N, deck_go_go_migrated: M, deck_go_fe_migrated: K, fork_divergent: F}`
- **AND** `docs/gateway-coverage.md` SHALL 含人类可读 markdown（百分比 + 缺失方法清单 + 与 dashboard 对照）

#### Scenario: PR 倒退被 CI 阻塞

- **scenario_id**: `deck-go-gateway-coverage-gate.coverage-regression-blocks`
- **GIVEN** main 分支 baseline 为 `deck_go_go_migrated: 100`
- **WHEN** PR 把某 wrapper 退回 untyped 调用，导致 PR 上 `deck_go_go_migrated: 99`
- **THEN** CI SHALL 报告 `coverage-regress: deck_go_go_migrated 100→99` 并以非零码退出
- **AND** PR 合并 SHALL 被阻塞

#### Scenario: 显式豁免允许倒退

- **scenario_id**: `deck-go-gateway-coverage-gate.coverage-regression-exception`
- **WHEN** PR description 含 `gateway-coverage: regress allowed reason: <某 method 因 server 端 bug 临时回退，tracked at #1234>`
- **THEN** CI SHALL 仅警告 + 通过
- **AND** 豁免记录 SHALL 出现在 PR comment（CI bot 输出）便于 review

#### Scenario: 上游新增 typed method 不视为倒退

- **scenario_id**: `deck-go-gateway-coverage-gate.upstream-growth-not-regression`
- **GIVEN** 上游 rebase 引入 5 个新 typed method（`upstream_typed: N → N+5`），deck-go 还未补
- **WHEN** PR 跑 `make gateway-coverage-report`
- **THEN** 报告 SHALL 显示百分比从 `M/N` 变 `M/(N+5)`（百分比下降）
- **AND** CI SHALL NOT 阻塞（因为绝对数字 `deck_go_go_migrated` 未下降，仅 ratio 变化）
- **AND** 报告 SHALL 把这 5 个新方法列在"待补"清单提醒后续 PR

### Requirement: coverage gate 与 fork-divergent 清单互不污染

deck-go fork-divergent 方法（已在 MVP `docs/fork-divergent-methods.md` 标注）SHALL 不计入 typed coverage 的分母；coverage 分母仅含上游 baseline typed methods。

#### Scenario: 新增 fork 方法不降低 typed coverage

- **scenario_id**: `deck-go-gateway-coverage-gate.fork-methods-excluded`
- **GIVEN** 当前 `deck_go_go_migrated: 100 / upstream_typed: 100 = 100%`
- **WHEN** fork 增量新增 5 个方法（写入 `docs/fork-divergent-methods.md`）
- **THEN** `upstream_typed` SHALL 仍为 100（不含 fork 增量）
- **AND** `fork_divergent` SHALL 为 5
- **AND** 整体覆盖率 SHALL 仍为 100%（不被 fork 方法稀释）
