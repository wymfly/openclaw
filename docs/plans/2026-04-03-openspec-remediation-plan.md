# OpenSpec Review Remediation Plan

> 日期: 2026-04-03
> 状态: proposed
> 来源: 当前 worktree 相对 `upstream/main` 基线的 OpenSpec / plan / implementation 审查结果

## 1. 目标

把本轮审查中确认的问题落实成一组可执行的整改任务，优先恢复三类一致性：

- OpenSpec artifacts 与实际实现的一致性
- 已勾选完成任务与真实验证结果的一致性
- 当前代码行为与规格场景的一致性

## 2. 范围

本计划仅覆盖以下三个 change 的后续整改：

- `deck-agent-config-enhancement`
- `deck-dynamic-commands`
- `wecom-api-expansion`

不覆盖其他尚未进入本轮 findings 的 Deck / WeCom change，也不在本计划中引入新的功能扩展。

## 3. 已确认问题

### 3.1 wecom-api-expansion

- `openspec/changes/wecom-api-expansion/tasks.md` 中多处“类型通过”项已勾选，但当前 `pnpm tsgo` 仍在 `extensions/wecom` 新增文件上报错。
- 当前 `pnpm test -- extensions/wecom` 通过，但这不能替代全局类型门槛。

### 3.2 deck-agent-config-enhancement

- Files Browser 已渲染列表，但“点击哪一项就编辑哪一项 / 为缺失文件直接创建”这一核心交互没有真正打通。
- Skills 管理只实现了“全部更新”和白名单模式下的部分配置入口，未完整覆盖每条技能的配置与单项更新场景。
- `SkillConfigEditor` 不能表达“清空已有 apiKey / env”的删除语义。
- 同一 change 的 proposal / design / spec / tasks / plan 已经出现事实漂移。

### 3.3 deck-dynamic-commands

- `CommandRegistry` 的同名冲突降级路径只保存了 qualified fallback，但没有实现 `registry.get("source:name")` 的限定名读取。
- 对应测试未覆盖限定名访问，和 OpenSpec / plan 中的承诺不一致。

## 4. 整改顺序

按以下顺序执行，避免“文档修了但代码仍错”或“代码修了但任务状态仍假完成”。

1. 先修任务状态与文档真相。
2. 再修会阻塞交付的类型门槛。
3. 再修已经勾选完成但行为未兑现的交互缺口。
4. 最后做验证与收口。

## 5. 任务清单

### Task 1: 回滚错误的完成状态 [docs]

**目标:** 把错误的 `[x]` 改回未完成，恢复 OpenSpec tasks 的可信度。

**Files:**

- Modify: `openspec/changes/wecom-api-expansion/tasks.md`
- Modify: `openspec/changes/deck-agent-config-enhancement/tasks.md`
- Modify: `openspec/changes/deck-dynamic-commands/tasks.md`

- [ ] 将所有依赖“当前 `pnpm tsgo` 通过”的任务改回未完成，直到重新验证为止
- [ ] 将 Files Browser / Skills / qualified fallback 中未兑现的完成项改回未完成
- [ ] 在任务后追加一行简短备注，说明回滚原因是“review found implementation / verification gap”

**Exit Criteria:**

- 任务勾选状态不再与当前代码事实冲突

### Task 2: 修复 wecom-api-expansion 的类型门槛 [backend/wecom-extension]

**目标:** 让 `extensions/wecom` 新增内容不再导致全局 `pnpm tsgo` 失败。

**Files:**

- Modify: `extensions/wecom/src/enhanced/config-compat.test.ts`
- Modify: `extensions/wecom/src/enhanced/mcp-config.test.ts`
- Modify: `extensions/wecom/src/enhanced/pending-reply.test.ts`
- Modify: `extensions/wecom/src/agent/api-client.upload.test.ts`
- Modify: `extensions/wecom/src/monitor.active.test.ts`
- Modify: `extensions/wecom/src/monitor.integration.test.ts`
- Modify: `extensions/wecom/src/monitor/state.queue.test.ts`
- Modify: `extensions/wecom/src/outbound.test.ts`
- Modify: `extensions/wecom/src/transport/bot-ws/inbound.test.ts`
- Modify: `extensions/wecom/vitest.config.ts`

- [ ] 修复新增测试中的结构类型错误、mock 返回值不匹配、`setTimeout` 类型断言问题
- [ ] 修复 `vitest.config.ts` 的 Vite 类型冲突
- [ ] 确认 production code 与新增 test helpers 的导出契约一致

**Exit Criteria:**

- `pnpm tsgo` 不再因为 `extensions/wecom` 新增内容失败
- `pnpm test -- extensions/wecom` 继续保持通过

### Task 3: 打通 Files Browser 的真实编辑流 [frontend/dashboard]

**目标:** 让 Files Browser 兑现 OpenSpec 中“点哪项编辑哪项、缺失文件可直接创建”的场景。

**Files:**

- Modify: `dashboard/src/components/panels/agents/tabs/FilesBrowser.tsx`
- Modify: `dashboard/src/components/panels/agents/tabs/BootstrapFileEditor.tsx`
- Modify: `dashboard/src/components/panels/agents/tabs/ContextTab.tsx`
- Modify: `openspec/changes/deck-agent-config-enhancement/specs/agent-files-browser/spec.md`（如实现策略需要澄清）

- [ ] 将 FilesBrowser 改为受控选中文件模式，而不是仅控制 editor 是否展开
- [ ] 点击已有文件时直接打开对应文件内容
- [ ] 点击缺失文件“创建”时直接打开对应缺失文件的空编辑器
- [ ] 如存在缓存命中路径，明确 `agents.files.get` 的调用与复用条件

**Exit Criteria:**

- 行为与 `agent-files-browser/spec.md` 的 4 个场景对齐

### Task 4: 补齐 Skills 管理缺口 [frontend/dashboard]

**目标:** 让技能配置和更新功能覆盖规格承诺的场景，而不是只覆盖部分模式。

**Files:**

- Modify: `dashboard/src/components/panels/agents/tabs/SkillsTab.tsx`
- Modify: `dashboard/src/components/panels/agents/tabs/SkillConfigEditor.tsx`
- Modify: `dashboard/src/components/panels/agents/tabs/SkillInstallDialog.tsx`
- Modify: `openspec/changes/deck-agent-config-enhancement/specs/agent-skills-management/spec.md`

- [ ] 允许在非 `whitelist` 模式下访问技能配置入口，或下调 spec / tasks 承诺到真实行为
- [ ] 为 ClawHub 技能补上单项更新入口，或明确写入 spec 为“仅支持全部更新”
- [ ] 让 `SkillConfigEditor` 能显式发送“删除 apiKey / 清空 env”语义
- [ ] 统一 install / config / update 的真实数据来源与交互文案

**Exit Criteria:**

- Skills 相关 spec、tasks、UI 行为三者一致

### Task 5: 实现 qualified fallback 读取 [frontend/dashboard]

**目标:** 让 `deck-dynamic-commands` 的 registry 真正支持 OpenSpec 中定义的限定名读取路径。

**Files:**

- Modify: `dashboard/src/lib/command-registry.ts`
- Modify: `dashboard/src/lib/command-registry.test.ts`
- Modify: `openspec/changes/deck-dynamic-commands/specs/command-registry/spec.md`
- Modify: `openspec/changes/deck-dynamic-commands/tasks.md`

- [ ] 为 `CommandRegistry.get()` 增加 `source:name` 查询能力
- [ ] 补充冲突后通过限定名读取被覆盖命令的测试
- [ ] 复查 `unregister()` / `unregisterBySource()` 提升逻辑，确保与 qualified fallback 一致

**Exit Criteria:**

- `registry.get("builtin:model")` 等路径可用
- 对应测试覆盖真实契约

### Task 6: 统一 deck-agent-config-enhancement 的单一真源 [docs]

**目标:** 消除该 change 内 proposal / design / spec / tasks / plan 的事实漂移。

**Files:**

- Modify: `openspec/changes/deck-agent-config-enhancement/proposal.md`
- Modify: `openspec/changes/deck-agent-config-enhancement/design.md`
- Modify: `openspec/changes/deck-agent-config-enhancement/tasks.md`
- Modify: `openspec/changes/deck-agent-config-enhancement/specs/agent-skills-management/spec.md`
- Modify: `openspec/changes/deck-agent-config-enhancement/specs/agent-identity-display/spec.md`
- Modify: `docs/plans/2026-03-31-deck-agent-config-enhancement-plan.md`

- [ ] 去掉 `agent.identity.get` 不支持的 `description / aliases` 承诺
- [ ] 明确 skill install 的真实模式是 install option / ClawHub slug，而不是任意本地路径输入
- [ ] 仅保留已存在或计划继续实现的交互，不保留已经放弃的行为承诺

**Exit Criteria:**

- 同一 change 内不再出现相互矛盾的契约描述

### Task 7: 验证与收口 [verification]

**目标:** 在重新勾选任务前，用统一命令证明整改已经落地。

- [ ] 运行 `pnpm tsgo`
- [ ] 运行 `pnpm test -- extensions/wecom`
- [ ] 运行与 dashboard 变更直接相关的 targeted tests
- [ ] 如触及 Gateway 协议、生成类型或共享 surface，再运行 `pnpm build`
- [ ] 验证通过后，按事实重新更新对应 OpenSpec tasks 的完成状态

**Exit Criteria:**

- 重新勾选的任务都有可追溯验证依据

## 6. 建议执行批次

### Batch A

- Task 1
- Task 2

### Batch B

- Task 3
- Task 4
- Task 5

### Batch C

- Task 6
- Task 7

## 7. 完成定义

以下条件全部满足后，才可将本轮审查相关任务标记为完成：

- `wecom-api-expansion` 不再以错误任务状态掩盖类型门槛问题
- `deck-agent-config-enhancement` 的 Files / Skills / Identity 契约与实现一致
- `deck-dynamic-commands` 的 qualified fallback 契约与测试一致
- 所有重新勾选完成的任务都有对应验证证据
