## 1. Upstream Result Schemas

- [ ] 1.1 为 `sessions.usage` 添加 result schema（从 handler `respond()` 调用点推导 TypeBox schema）+ methodDefs
- [ ] 1.2 为 `sessions.usage.logs` 添加 result schema + methodDefs
- [ ] 1.3 为 `sessions.usage.timeseries` 添加 result schema + methodDefs
- [ ] 1.4 为 `tools.effective` 添加 result schema + methodDefs
- [ ] 1.5 为 `skills.install` 添加 result schema + methodDefs
- [ ] 1.6 在 `src/gateway/method-registry-data.ts` 中将新增 methodDefs 接入 allMethodDefs
- [ ] 1.7 运行 `pnpm protocol:gen:ts` 重新生成 typed client，验证 5 个方法出现在 GatewayMethodMap
- [ ] 1.8 迁移 5 个 dashboard API routes 从 `gatewayRequest()` 到 typed `gwRequest()`：`usage/sessions/route.ts`、`usage/sessions/logs/route.ts`、`usage/timeseries/route.ts`、`deck/tools-effective/route.ts`、`skills/install/route.ts`
- [ ] 1.9 运行 `pnpm protocol:gen:check` + `pnpm check` + `pnpm build` 验证

## 2. Unified Error Model

- [ ] 2.1 创建 `dashboard/src/lib/errors.ts`：定义 `GatewayErrorCode`（6 个值）+ `DeckApiError` class + `ErrorBody` 类型 + `mapGatewayError` 映射函数
- [ ] 2.2 实现 `fetchApi<T>(url, options?)` 客户端 fetch helper（res.ok 检查 + JSON 解析 + DeckApiError 包装）
- [ ] 2.3 将 `api-helpers.ts` 中的 ErrorBody 替换为从 `errors.ts` 导入（gwRequest 保持返回 NextResponse 不变，仅 import 路径变化）
- [ ] 2.4 将 `with-auth.ts` 中的 ErrorBody 替换为从 `errors.ts` 导入
- [ ] 2.5 将 `chat-api.ts` 中的 ApiErrorBody 替换为从 `errors.ts` 导入，保留 `normalizeGatewayError`
- [ ] 2.6 迁移 3-5 个客户端 stores 到 `fetchApi()`（选择重复样板最多的：webhooks, cron, skills, budget, alerts）
- [ ] 2.7 验证无重复 ErrorBody 定义：`grep -r "type ErrorBody\|type ApiErrorBody" dashboard/src/` 仅命中 errors.ts
- [ ] 2.8 运行 `pnpm check` + `pnpm test` 验证

## 3. Panel Registry

- [ ] 3.1 创建 `dashboard/src/lib/panel-registry.ts`：定义 `PanelEntry` 类型 + `PANELS` 数组（24 个 entries，含 eager/position 标记）+ 导出 `Panel` type
- [ ] 3.2 修改 `stores/ui.ts`：`Panel` type 改为从 panel-registry 导入
- [ ] 3.3 修改 `components/layout/NavRail.tsx`：navGroups 改为从 PANELS 按 group 分组读取，`position: 'bottom'` 单独渲染
- [ ] 3.4 修改 `app/page.tsx`：lazy imports + ActivePanel 路由改为从 PANELS 读取（`eager: true` 的用静态 import，其余用 lazy）
- [ ] 3.5 修改 `hooks/useKeyboardShortcuts.ts`：NAV_PANELS 改为从 PANELS 读取 shortcutIndex
- [ ] 3.6 验证 i18n keys 与 registry labelKey 一致
- [ ] 3.7 运行 `pnpm check` + `pnpm test` + `pnpm build` 验证（lazy-loading 路由变更必须通过 build）

## 4. Coverage Gate Automation

- [ ] 4.1 创建 `scripts/protocol-coverage-check.ts`：从 method-registry-data 读取 allMethodNames
- [ ] 4.2 添加 GatewayMethodMap keys 解析（从 gateway-protocol.generated.ts 提取，非 ALLOWLIST）+ untyped gatewayRequest 扫描
- [ ] 4.3 添加覆盖率报告输出（method family 分组 + typed/untyped/not-covered/N/A 分类）
- [ ] 4.4 在 `package.json` 注册 `protocol:coverage:check` 脚本
- [ ] 4.5 运行脚本验证输出与 matrix 中 Gateway Capability Coverage Baseline 一致

## 5. 收尾

- [ ] 5.1 更新 matrix：Gateway Transport partial → replacement-ready（5 schemas 补齐后）
- [ ] 5.2 更新 matrix：Shared Error/Mutation partial 备注改为"unified error codes done; rollback API deferred"（不升级为 replacement-ready）
- [ ] 5.3 更新 matrix：Shell/Panel partial → replacement-ready
- [ ] 5.4 更新 matrix：Capability Coverage Gate partial → replacement-ready（自动化脚本就绪后）
- [ ] 5.5 运行 `pnpm check` + `pnpm test` + `pnpm build` 全量验证
