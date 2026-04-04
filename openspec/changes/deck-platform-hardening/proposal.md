## Why

Deck Web Replacement Program 的 20 个模块已达 replacement-ready，但平台基础设施层仍有 4 项缺口阻碍后续跟随上游迭代开发：Gateway typed client 覆盖不完整导致新方法无法自动获得类型安全、错误处理各模块各自发明、面板注册硬编码导致新增面板需改 5 处、覆盖验证只能人工执行。这 4 项是进入 Phase 5 Replacement Gate 前必须收尾的平台债务。

## What Changes

- 为 6 个 upstream Gateway 方法补齐 result schema + methodDefs 元数据，重新生成 typed client
- 设计统一的 ErrorCode enum + typed error response model，集成到 gwRequest/gatewayRequest 调用链
- 将 Shell/Panel 的硬编码注册（5 个 touch point）重构为 PanelRegistry 动态注册模式
- 新增 `pnpm protocol:coverage:check` 自动化脚本，读取 matrix + typed client 生成覆盖率报告

## Capabilities

### New Capabilities

- `upstream-result-schemas`: 补齐 6 个 upstream Gateway 方法的 result schema（sessions.usage/steer/get, tools.effective 等），使 Deck typed client 完整覆盖所有已使用方法
- `unified-error-model`: 统一 ErrorCode enum + typed error response + gwRequest 错误链，替代各模块自行发明的错误处理
- `panel-registry`: PanelRegistry 动态注册机制，消除 Shell/NavRail 中 5 处硬编码面板列表
- `coverage-gate-automation`: 自动化覆盖验证脚本，读取 Gateway method registry + Deck client 生成覆盖率报告

### Modified Capabilities

- `gateway-communication`: Gateway typed client 覆盖范围扩展到 upstream 方法

## Impact

- `src/gateway/server-methods/` — 补充 6 个方法的 result schema + methodDefs
- `src/gateway/protocol/schema/` — 新增 result schema 定义
- `scripts/protocol-gen-ts.ts` — 可能需适配新 schema
- `dashboard/src/types/gateway-*.generated.ts` — 重新生成
- `dashboard/src/lib/api-helpers.ts` — 集成统一错误模型
- `dashboard/src/components/shell/` — PanelRegistry 重构
- `dashboard/src/components/panels/` — 面板注册方式迁移
- `scripts/` — 新增 coverage check 脚本
