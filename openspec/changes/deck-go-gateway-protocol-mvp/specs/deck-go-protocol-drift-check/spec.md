## ADDED Requirements

### Requirement: protocol-check 使用 CHECK_MODE 内存比对

`make protocol-check` SHALL 调用 codegen 脚本的 CHECK_MODE，将内存中产出的 expected 内容与目标文件比对，分别报告 missing 与 drift，**不依赖 `git diff --exit-code`**（避免 untracked 新文件被漏报）。

#### Scenario: 缺失的生成文件被报告为 MISSING

- **GIVEN** `deck-go/backend/internal/gateway/generated/methods.go` 不存在（首次运行或被误删）
- **WHEN** 在 deck-go 仓内执行 `make protocol-check`
- **THEN** 命令 SHALL 以非零退出码失败
- **AND** 失败信息 SHALL 包含 `MISSING: <file path>` 文案
- **AND** 失败信息 SHALL 提示运行 `make protocol-update`

#### Scenario: 内容漂移被报告为 DRIFT

- **GIVEN** `deck-go/backend/internal/gateway/generated/methods.go` 存在但内容与上游 `allMethodDefs` 派生的 expected 不一致（包括手改与上游新增 method 未同步）
- **WHEN** `make protocol-check` 执行
- **THEN** 命令 SHALL 以非零退出码失败
- **AND** 失败信息 SHALL 包含 `DRIFT: <file path>` 文案

#### Scenario: 上游新增 method 后未重生成则失败

- **GIVEN** 上游新增了一个 typed method `foo.bar`（注册在 `allMethodDefs` 且 `params || result`）
- **AND** deck-go `internal/gateway/generated/` 与 `contracts/generated/ts/` 未重新生成
- **WHEN** `make protocol-check` 执行
- **THEN** 命令 SHALL 以非零退出码失败
- **AND** 检测路径 SHALL 同时覆盖 Go 与 TS 两组产物

#### Scenario: generated 与上游一致时 protocol-check 通过

- **GIVEN** 上游 `allMethodDefs` 与 deck-go 生成产物同步
- **WHEN** `make protocol-check` 执行
- **THEN** 命令 SHALL 以 0 退出码成功
- **AND** SHALL 不在 working tree 留下任何修改（CHECK_MODE 不写入磁盘）

### Requirement: protocol-update 一键重新生成产物

`make protocol-update` SHALL 不带 CHECK_MODE 跑 codegen，覆写所有生成产物。

#### Scenario: protocol-update 重新生成 Go 与 TS 输出

- **WHEN** 开发者执行 `make protocol-update`
- **THEN** target SHALL 依次执行 `protocol-gen-go.ts` 与 `protocol-gen-ts.ts`
- **AND** 执行后 `deck-go/backend/internal/gateway/generated/` 与 `deck-go/contracts/generated/ts/` 反映上游最新 schema

#### Scenario: protocol-update 后再跑 protocol-check 通过

- **WHEN** 开发者依次执行 `make protocol-update` 与 `make protocol-check`
- **THEN** `protocol-check` SHALL 以 0 退出码成功

### Requirement: CI workflow 集成 protocol-check

deck-go 的 CI 配置 SHALL 在每次 PR 与 push 上运行 `make protocol-check`。

#### Scenario: CI 在 PR 上自动跑 protocol-check

- **WHEN** 开发者推送一个改动了 `deck-go/backend/internal/gateway/generated/`、`deck-go/contracts/generated/`、`deck-go/contracts/scripts/` 或上游 `src/gateway/method-registry-data.ts` 的 PR
- **THEN** CI workflow SHALL 调用 `make protocol-check`
- **AND** 若 check 失败，CI run SHALL 标记为 failure 并阻塞合并
