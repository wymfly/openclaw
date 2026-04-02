---
name: validate
description: 验证当前工作的代码质量。运行测试、类型检查、lint，验证前后端 API 契约。在提交前或标记任务完成前调用。
---

# Validate

提交前的标准化质量验证。按顺序执行以下检查，全部通过才允许提交。

## 使用时机

- 标记任务完成前
- git commit 前
- Agent Team 中各 agent 完成实现后
- 用户要求验证时

## 检查流程

### Step 1：检测项目技术栈

扫描项目根目录，确定需要运行哪些检查：

```
package.json 存在 → 启用 TypeScript/JavaScript 检查
pyproject.toml / setup.py / requirements.txt 存在 → 启用 Python 检查
两者都有 → 全栈项目，两套检查都跑
```

### Step 2：测试套件

```bash
# Python
pytest --tb=short -q

# TypeScript/JavaScript（按项目配置选择）
npm test          # 或
npx vitest run    # 或
npx jest          # 取决于项目配置
```

**判定**：

- 全通过 → ✅ 继续
- 有失败 → ❌ 停止，列出失败项，不继续后续检查

### Step 3：类型检查

```bash
# TypeScript
npx tsc --noEmit

# Python（如已配置）
pyright            # 或
mypy .             # 取决于项目配置
```

**判定**：

- 0 errors → ✅ 继续
- 有 errors → ❌ 列出所有类型错误，需修复后重新验证

### Step 4：Lint

```bash
# Python
ruff check .          # 或项目配置的 linter

# TypeScript/JavaScript
npx eslint .          # 或项目配置的 linter
```

**判定**：

- 0 errors → ✅ 继续（warnings 可忽略）
- 有 errors → ❌ 列出错误，需修复

### Step 5：API 契约验证（仅全栈变更时）

**触发条件**：当前变更同时包含后端 route/endpoint 文件和前端 API 调用文件。

**参照源优先级**：

1. `openspec/specs/` 或 `openspec/changes/*/specs/` 存在 → 以 spec 文件中的字段定义为**权威参照**
2. 无 OpenSpec specs → 退回到前后端代码互相对比

**执行方式（有 specs/ 时）**：

1. 读取 specs/ 中与当前变更相关的 spec 文件，提取定义的字段名、类型、必填/可选
2. 读取后端 route handler 的 response model，与 spec 对比
3. 读取前端 API 消费代码的字段使用，与 spec 对比
4. 三方交叉验证：spec ↔ 后端 ↔ 前端，报告任何不匹配

**执行方式（无 specs/ 时）**：

1. 读取变更涉及的后端 route handler，提取 response model 的字段名和类型
2. 读取变更涉及的前端 API 消费代码，提取使用的字段名
3. 对比两者，报告任何不匹配

**判定**：

- 字段名完全匹配 → ✅
- 有不匹配 → ❌ 列出差异，需修复

### Step 5.5：OpenSpec 需求覆盖检查（仅 OpenSpec 项目）

**触发条件**：`openspec/changes/*/specs/` 或 `openspec/specs/` 存在。

**执行方式**：

1. 读取当前 active change 的 specs/ 目录下所有 spec 文件
2. 提取所有 WHEN/THEN 场景（ADDED + MODIFIED requirements）
3. 对照测试文件，检查每个场景是否有对应的测试覆盖：
   - 搜索测试文件中是否有名称或注释匹配该场景的测试用例
   - 搜索测试文件中是否有逻辑覆盖该 WHEN 条件和 THEN 断言
4. 输出覆盖报告

**判定**：

- 所有 ADDED/MODIFIED requirements 的场景都有测试覆盖 → ✅
- 有未覆盖的场景 → ⚠️ 列出未覆盖的 requirement + scenario（警告，不阻塞提交）

> **注意**：场景→测试的映射是基于语义搜索的粗略检查，不保证 100% 准确。未覆盖的场景应人工确认是否确实缺少测试。

### Step 6：未使用代码检查

```bash
# TypeScript - 检查未使用的 import 和变量
npx tsc --noEmit 2>&1 | grep -i "unused"

# Python - 检查未使用的 import
ruff check --select F401 .
```

**判定**：

- 0 unused → ✅
- 有 unused → ⚠️ 警告（不阻塞，但建议清理）

## 结果汇总

检查完成后输出汇总表：

```
┌─────────────────────┬────────┐
│ 检查项               │ 结果   │
├─────────────────────┼────────┤
│ 测试套件             │ ✅ / ❌ │
│ 类型检查             │ ✅ / ❌ │
│ Lint                │ ✅ / ❌ │
│ API 契约             │ ✅ / ❌ / ⏭️ │
│ 需求覆盖（OpenSpec） │ ✅ / ⚠️ / ⏭️ │
│ 未使用代码           │ ✅ / ⚠️ │
├─────────────────────┼────────┤
│ 总结                │ 可提交 / 需修复 │
└─────────────────────┴────────┘
```

- `⏭️` = 不适用（非全栈变更跳过 API 契约；无 OpenSpec 跳过需求覆盖）
- 任何 ❌ → 不可提交，需先修复
- 只有 ⚠️ 没有 ❌ → 可提交，但建议清理

## 与其他 skill 的关系

- `dev-workflow` 中的 `verification skill` 步骤应调用本 skill
- `team-driven-development` 中各 agent 完成任务后应调用本 skill
- `finishing-branch` 前必须通过本 skill 的全部检查
- `openspec-workflow` 的 specs/ 是 Step 5 API 契约验证的权威参照源（存在时优先使用）
- `openspec-workflow` 的 specs/ 中的 WHEN/THEN 场景是 Step 5.5 需求覆盖检查的输入

## 注意事项

- 本 skill 只做**检查和报告**，不自动修复——修复由调用者决定
- 如果项目有自定义的检查命令（如 `make check`、`npm run validate`），优先使用项目配置
- 测试套件是最重要的检查——如果测试失败，后续检查可以跳过（因为代码状态不稳定）
