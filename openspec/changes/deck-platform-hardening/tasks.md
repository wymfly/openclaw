## 1. Upstream Result Schemas

- [ ] 1.1 为 `sessions.usage` 添加 result schema + methodDefs（基于 Gateway handler 返回值推断 TypeBox schema）
- [ ] 1.2 为 `sessions.usage.logs` 添加 result schema + methodDefs
- [ ] 1.3 为 `sessions.usage.timeseries` 添加 result schema + methodDefs
- [ ] 1.4 为 `tools.effective` 添加 result schema + methodDefs
- [ ] 1.5 为 `skills.install` 添加 result schema + methodDefs
- [ ] 1.6 为 `config.set` 添加 result schema + methodDefs
- [ ] 1.7 运行 `pnpm protocol:gen:ts` 重新生成 typed client，验证 6 个方法出现在 GatewayMethodMap
- [ ] 1.8 将 6 个 dashboard API routes 从 `gatewayRequest()` 迁移到 typed `gwRequest()`
- [ ] 1.9 运行 `pnpm protocol:gen:check` + `pnpm check` 验证

## 2. Unified Error Model

- [ ] 2.1 创建 `dashboard/src/lib/errors.ts`：定义 `GatewayErrorCode` 枚举 + `DeckApiError` class + `ErrorBody` 类型
- [ ] 2.2 实现 `fetchApi<T>(url, options?)` 共享 fetch helper
- [ ] 2.3 将 `api-helpers.ts` 中的 ErrorBody 替换为从 `errors.ts` 导入，gwRequest catch 块使用 DeckApiError
- [ ] 2.4 将 `with-auth.ts` 中的 ErrorBody 替换为从 `errors.ts` 导入
- [ ] 2.5 将 `chat-api.ts` 中的 ApiErrorBody 替换为从 `errors.ts` 导入，保留 `normalizeGatewayError`
- [ ] 2.6 迁移 3-5 个客户端 stores 到 `fetchApi()`（选择重复样板最多的：webhooks, cron, skills, budget, alerts）
- [ ] 2.7 验证无重复 ErrorBody 定义：`grep -r "type ErrorBody\|type ApiErrorBody" dashboard/src/` 仅命中 errors.ts
- [ ] 2.8 运行 `pnpm check` + `pnpm test` 验证

## 3. Panel Registry

- [ ] 3.1 创建 `dashboard/src/lib/panel-registry.ts`：定义 `PanelEntry` 类型 + `PanelRegistry` 数据结构 + `Panel` type 导出
- [ ] 3.2 为 23 个现有面板创建 registry entries（可在 panel-registry.ts 中集中定义，每个面板一行）
- [ ] 3.3 修改 `stores/ui.ts`：`Panel` type 改为从 panel-registry 导入（不再手写 union）
- [ ] 3.4 修改 `NavRail.tsx`：navGroups 改为从 registry 读取
- [ ] 3.5 修改 `page.tsx`：lazy imports + ActivePanel 路由改为从 registry 读取
- [ ] 3.6 修改 `useKeyboardShortcuts.ts`：NAV_PANELS 改为从 registry 读取 shortcutIndex
- [ ] 3.7 验证 i18n keys 与 registry labelKey 一致
- [ ] 3.8 运行 `pnpm check` + `pnpm test` + 手动验证 NavRail 渲染正确

## 4. Coverage Gate Automation

- [ ] 4.1 创建 `scripts/protocol-coverage-check.ts`：从 method-registry-data 读取所有方法名
- [ ] 4.2 添加 typed client allowlist 解析 + untyped gatewayRequest 扫描
- [ ] 4.3 添加覆盖率报告输出（method family 分组 + typed/untyped/not-covered/N/A 分类）
- [ ] 4.4 在 `package.json` 注册 `protocol:coverage:check` 脚本
- [ ] 4.5 运行脚本验证输出与 matrix 中 Gateway Capability Coverage Baseline 一致

## 5. 收尾

- [ ] 5.1 更新 matrix 中 Gateway Transport 状态（partial → replacement-ready，如果 6 schemas 补齐）
- [ ] 5.2 更新 matrix 中 Shared Error/Mutation 状态（partial → replacement-ready）
- [ ] 5.3 更新 matrix 中 Shell/Panel 状态（partial → replacement-ready）
- [ ] 5.4 更新 matrix 中 Capability Coverage Gate 状态（partial → replacement-ready，如果自动化脚本就绪）
- [ ] 5.5 运行 `pnpm check` + `pnpm test` 全量验证
