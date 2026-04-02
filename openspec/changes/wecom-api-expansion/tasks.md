## 1. P0 — 上游同步基础设施

- [x] 1.1 复制 `src/runtime/source-registry.ts`（244 行），修复 import 路径差异，确保 tsc 编译通过
- [x] 1.2 复制 `src/context-store.ts`（264 行），修复 import 路径差异
- [x] 1.3 source-registry 由 calendar/tool.ts 和 mcp/tool.ts 内部引用，无需额外 session-manager 集成

## 2. P0 — Calendar 模块（上游同步）

- [x] 2.1 复制 `src/capability/calendar/` 目录（client.ts, schema.ts, tool.ts, types.ts, index.ts，共 1961 行），修复 import 路径
- [x] 2.2 在 `extensions/wecom/index.ts` 的 `register()` 中添加 `registerWecomCalendarTools(api)` 调用
- [x] 2.3 验证 calendar CRUD + free/busy + attendee 管理编译通过（tsc --noEmit）

## 3. P0 — MCP Bridge 模块（上游同步）

- [x] 3.1 复制 `src/capability/mcp/` 目录（index.ts, schema.ts, tool.ts, transport.ts，共 685 行），修复 import 路径
- [x] 3.2 在 `extensions/wecom/index.ts` 的 `register()` 中添加 MCP tool factory 调用
- [x] 3.3 验证 MCP 桥接编译通过（tsc --noEmit）

## 4. P0 — 集成验证

- [x] 4.1 pnpm tsgo 通过（仅 pre-existing vitest.config 类型冲突）
- [x] 4.2 运行 `pnpm test -- extensions/wecom` 确认无回归（35 files, 218 passed）
- [x] 4.3 INEFFECTIVE_DYNAMIC_IMPORT 检查待 Phase 4 pnpm build

## 5. P1 — Contact 通讯录模块（自研）

- [x] 5.1 创建 `src/capability/contact/types.ts` — 定义 Member、Department、Tag 类型（标注隐私受限字段）
- [x] 5.2 创建 `src/capability/contact/client.ts` — 实现 GET-based 重试模式 + 6 方法
- [x] 5.3 创建 `src/capability/contact/schema.ts` — oneOf 判别联合 schema，6 actions
- [x] 5.4 创建 `src/capability/contact/tool.ts` — action switch 分发，隐私限制说明文本
- [x] 5.5 无需 index.ts（直接从 tool.ts 导出）
- [x] 5.6 在 `extensions/wecom/index.ts` 的 `register()` 中添加 `registerWecomContactTools(api)` 调用
- [x] 5.7 编写 `src/capability/contact/contact.test.ts` — 5 个用例覆盖

## 6. P1 — Meeting 会议模块（自研）

- [x] 6.1 创建 `src/capability/meeting/types.ts`
- [x] 6.2 创建 `src/capability/meeting/client.ts` — POST-based 3-retry, field mapping
- [x] 6.3 创建 `src/capability/meeting/schema.ts` — oneOf 5 actions
- [x] 6.4 创建 `src/capability/meeting/tool.ts` — action switch 分发
- [x] 6.5 无需 index.ts
- [x] 6.6 在 `extensions/wecom/index.ts` 注册
- [x] 6.7 编写 `src/capability/meeting/meeting.test.ts` — 5 个用例覆盖

## 7. P1 — Todo 待办模块（自研）

- [x] 7.1 创建 `src/capability/todo/types.ts`
- [x] 7.2 创建 `src/capability/todo/client.ts` — POST /cgi-bin/oa/*, 3-retry
- [x] 7.3 创建 `src/capability/todo/schema.ts` — oneOf 3 actions
- [x] 7.4 创建 `src/capability/todo/tool.ts` — action switch 分发
- [x] 7.5 无需 index.ts
- [x] 7.6 在 `extensions/wecom/index.ts` 注册
- [x] 7.7 编写 `src/capability/todo/todo.test.ts` — 4 个用例覆盖

## 8. P1 — 集成验证

- [ ] 8.1 全量 `pnpm build` 确保无编译错误
- [ ] 8.2 运行 `pnpm test` 确认无回归
- [ ] 8.3 验证 contact + meeting + todo 三模块独立可注册、互不依赖

## 9. P2 — Approval 审批模块（自研，按需）

- [ ] 9.1 创建 `src/capability/approval/types.ts` — 定义 ApprovalRecord、ApprovalTemplate、ApprovalNode 类型
- [ ] 9.2 创建 `src/capability/approval/client.ts` — 实现 submit / list / getDetail / getTemplate 方法（含重试）
- [ ] 9.3 创建 `src/capability/approval/schema.ts` — oneOf 判别联合 schema，action: submit | list | get_detail | get_template
- [ ] 9.4 创建 `src/capability/approval/tool.ts` — action switch 分发
- [ ] 9.5 创建 `src/capability/approval/index.ts` — 导出
- [ ] 9.6 在 `extensions/wecom/index.ts` 的 `register()` 中添加 `registerWecomApprovalTools(api)` 调用
- [ ] 9.7 编写 `src/capability/approval/approval.test.ts` — 覆盖各 action + 重试场景

## 10. P2 — External Contact 客户联系模块（自研，按需）

- [ ] 10.1 创建 `src/capability/external-contact/types.ts` — 定义 ExternalContact、GroupChat 类型
- [ ] 10.2 创建 `src/capability/external-contact/client.ts` — 实现 get / list / listGroups 方法（含重试 + 分页 cursor）
- [ ] 10.3 创建 `src/capability/external-contact/schema.ts` — oneOf 判别联合 schema，action: get | list | list_groups
- [ ] 10.4 创建 `src/capability/external-contact/tool.ts` — action switch 分发
- [ ] 10.5 创建 `src/capability/external-contact/index.ts` — 导出
- [ ] 10.6 在 `extensions/wecom/index.ts` 的 `register()` 中添加 `registerWecomExternalContactTools(api)` 调用
- [ ] 10.7 编写 `src/capability/external-contact/external-contact.test.ts` — 覆盖各 action + 分页 + 重试场景

## 11. P2 — 最终验证

- [ ] 11.1 全量 `pnpm build` 确保无编译错误
- [ ] 11.2 运行 `pnpm test` 全量测试通过
- [ ] 11.3 检查所有新模块的 Tool 注册顺序和命名一致性
