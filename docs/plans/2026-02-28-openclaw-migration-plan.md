# OpenClaw Fork Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 从 OpenClaw 上游重新 fork，选择性移植 MindGate 的安全加固、渠道稳定性、Windows 适配和测试增强。

**Architecture:** Feature Branch Overlay — 在 `enhanced` 分支上以独立 commit 叠加增量改动，定期 rebase 上游 main。所有改动尽量以新文件形式添加，对上游文件的修改限制在最小插入点。

**Tech Stack:** TypeScript ESM, Node 22+, pnpm, Vitest, Oxlint/Oxfmt

**Source repo (MindGate):** `/Users/wangym/workspace/agents/mindgate`
**Target repo (OpenClaw fork):** 需要在 Phase 0 中创建，预计位于 `/Users/wangym/workspace/agents/openclaw`

---

## Phase 0: Fork 准备

### Task 0.1: Fork OpenClaw 并创建本地仓库

**Step 1: 在 GitHub 上 fork OpenClaw**

在浏览器中访问 https://github.com/openclaw/openclaw ，点击 Fork 按钮，fork 到你的 GitHub 账户。

**Step 2: Clone fork 到本地**

```bash
cd /Users/wangym/workspace/agents
git clone git@github.com:<YOUR_USERNAME>/openclaw.git
cd openclaw
```

**Step 3: 配置 upstream remote**

```bash
git remote add upstream https://github.com/openclaw/openclaw.git
git fetch upstream main
```

**Step 4: 验证**

```bash
git remote -v
# 应该看到 origin (你的 fork) 和 upstream (openclaw/openclaw)
```

### Task 0.2: 创建 enhanced 分支

**Step 1: 从 main 创建 enhanced 分支**

```bash
git checkout -b enhanced main
git push -u origin enhanced
```

**Step 2: 验证分支存在**

```bash
git branch -a | grep enhanced
# 应该看到 * enhanced 和 remotes/origin/enhanced
```

### Task 0.3: 安装依赖并验证上游构建

**Step 1: 安装依赖**

```bash
pnpm install
```

**Step 2: 运行上游测试确认基线通过**

```bash
pnpm check
pnpm test
```

Expected: 全部通过。如果有失败，记录但不修复（这是上游的问题）。

**Step 3: Commit 无改动（标记基线）**

无需 commit，只确认基线状态。

### Task 0.4: 更新 CLAUDE.md 添加同步流程

**Step 1: 在新 fork 的 CLAUDE.md（或 AGENTS.md）末尾添加同步流程段落**

在文件末尾追加：

```markdown
## 上游同步流程

本项目是 OpenClaw 的增强 fork。`enhanced` 分支包含所有增量改动。

### 同步步骤

\`\`\`bash

# 1. 获取上游最新代码

git fetch upstream main

# 2. 切换到增强分支

git checkout enhanced

# 3. 将我们的 commit 叠到最新上游之上

git rebase upstream/main

# 4. 解决冲突（如果有），逐 commit 处理

# git rebase --continue

# 5. 验证

pnpm install
pnpm check
pnpm test

# 6. 推送

git push --force-with-lease origin enhanced
\`\`\`

### Commit 规范

- 前缀：`[enhanced]` 标识我们的增量 commit
- 示例：`[enhanced] feat: add SSRF dual-phase protection`
- 对上游文件的修改限制在最小插入点（一两行 import + 调用）
```

**Step 2: Commit**

```bash
git add CLAUDE.md  # 或 AGENTS.md，取决于上游用哪个
git commit -m "[enhanced] docs: add upstream sync workflow to CLAUDE.md"
```

---

## Phase 1: 安全加固（Feature 1）

> **前置条件**：Phase 0 完成，在 `enhanced` 分支上工作。
> **源码参考**：MindGate 仓库 `/Users/wangym/workspace/agents/mindgate`

### Task 1.1: 审查并移植 IP 检测工具库

**Files:**

- Source: `mindgate/src/shared/net/ip.ts` (283 行)
- Target: `openclaw/src/shared/net/ip.ts`（如上游已有则 diff 合并）

**Step 1: 对比 MindGate 和 OpenClaw 的 ip.ts**

```bash
diff /Users/wangym/workspace/agents/mindgate/src/shared/net/ip.ts \
     /Users/wangym/workspace/agents/openclaw/src/shared/net/ip.ts
```

**Step 2: 审查差异**

重点关注：

- MindGate 新增的 IPv6 过渡地址检测函数（6to4、Teredo、ISATAP、NAT64）
- 旧式 IPv4 字面量解析（八进制、十六进制、短格式）
- 确认没有引入新的 npm 依赖（只依赖 `ipaddr.js`，上游应该已有）

**Step 3: 应用差异**

如果上游已有此文件，仅合并 MindGate 新增的函数。
如果上游没有此文件，直接复制。

```bash
# 示例：直接复制（如果上游没有或差异太大）
cp /Users/wangym/workspace/agents/mindgate/src/shared/net/ip.ts \
   /Users/wangym/workspace/agents/openclaw/src/shared/net/ip.ts
```

**Step 4: 确认 TypeScript 编译通过**

```bash
cd /Users/wangym/workspace/agents/openclaw
pnpm tsc --noEmit src/shared/net/ip.ts 2>&1 | head -20
```

**Step 5: 向用户展示 diff 并等待确认**

展示完整 diff，解释每个改动的意义，等待用户确认后才继续。

### Task 1.2: 审查并移植 SSRF 防护核心

**Files:**

- Source: `mindgate/src/infra/net/ssrf.ts` (326 行)
- Source: `mindgate/src/infra/net/ssrf.test.ts` (133 行)
- Source: `mindgate/src/infra/net/ssrf.pinning.test.ts` (157 行)
- Target: 对应的 `openclaw/src/infra/net/` 路径

**Step 1: Diff 对比 ssrf.ts**

```bash
diff /Users/wangym/workspace/agents/mindgate/src/infra/net/ssrf.ts \
     /Users/wangym/workspace/agents/openclaw/src/infra/net/ssrf.ts
```

**Step 2: 审查差异**

重点关注：

- 双阶段检测架构（Phase 1 DNS 前 + Phase 2 DNS 后）
- `createPinnedLookup` / `createPinnedDispatcher` DNS pinning
- `BLOCKED_HOSTNAMES` 硬编码集合
- 导入依赖：`../../shared/net/ip.js`（已在 Task 1.1 处理）、`./hostname.js`、`undici`

**Step 3: 检查 hostname.js 依赖**

```bash
diff /Users/wangym/workspace/agents/mindgate/src/infra/net/hostname.ts \
     /Users/wangym/workspace/agents/openclaw/src/infra/net/hostname.ts 2>/dev/null || echo "上游不存在此文件"
```

如果上游没有 hostname.ts，需要一并移植。

**Step 4: 合并/复制文件**

**Step 5: 运行测试**

```bash
cd /Users/wangym/workspace/agents/openclaw
pnpm vitest run src/infra/net/ssrf.test.ts src/infra/net/ssrf.pinning.test.ts -v
```

Expected: 全部通过。

**Step 6: 向用户展示 diff 并等待确认**

### Task 1.3: 审查并移植 Fetch Guard

**Files:**

- Source: `mindgate/src/infra/net/fetch-guard.ts` (197 行)
- Source: `mindgate/src/infra/net/fetch-guard.ssrf.test.ts` (151 行)
- Target: 对应的 `openclaw/src/infra/net/` 路径

**Step 1: Diff 对比**

```bash
diff /Users/wangym/workspace/agents/mindgate/src/infra/net/fetch-guard.ts \
     /Users/wangym/workspace/agents/openclaw/src/infra/net/fetch-guard.ts
```

**Step 2: 审查差异**

重点关注：

- 手动重定向跟踪（`redirect: "manual"`）
- 跨域重定向时的 header 剥离（Authorization、Cookie）
- 重定向循环检测和最大次数限制
- 导入依赖：`./ssrf.js`（已在 Task 1.2 处理）、`../../utils/fetch-timeout.js`

**Step 3: 检查 fetch-timeout.js 依赖是否上游已有**

```bash
ls /Users/wangym/workspace/agents/openclaw/src/utils/fetch-timeout.ts 2>/dev/null || echo "需要移植"
```

**Step 4: 合并/复制文件 + 运行测试**

```bash
pnpm vitest run src/infra/net/fetch-guard.ssrf.test.ts -v
```

**Step 5: 向用户展示 diff 并等待确认**

### Task 1.4: 审查并移植外部内容安全

**Files:**

- Source: `mindgate/src/security/external-content.ts` (323 行) — 无本地导入，仅 `node:crypto`
- Source: `mindgate/src/security/external-content.test.ts` (328 行)

**Step 1: Diff 对比**

```bash
diff /Users/wangym/workspace/agents/mindgate/src/security/external-content.ts \
     /Users/wangym/workspace/agents/openclaw/src/security/external-content.ts
```

**Step 2: 审查 — 重点关注**

- Unicode 同形字防护（`foldMarkerText`）
- 随机化标记 ID（`randomBytes(8)`）
- 注入模式检测（`detectSuspiciousPatterns`，11 种模式）
- 这是独立模块，无本地导入依赖，移植最干净

**Step 3: 合并/复制 + 运行测试**

```bash
pnpm vitest run src/security/external-content.test.ts -v
```

**Step 4: 向用户展示 diff 并等待确认**

### Task 1.5: 审查并移植其余安全模块

**Files:**

- `src/security/secret-equal.ts` (12 行) — 独立，仅 `node:crypto`
- `src/security/host-env-security.ts` → 实际路径 `src/infra/host-env-security.ts` (148 行) — 依赖同目录 JSON 策略文件
- `src/infra/host-env-security.test.ts` (192 行)
- `src/infra/host-env-security.policy-parity.test.ts` (44 行)
- `src/security/windows-acl.ts` (285 行) — 依赖 `../process/exec.js`
- `src/security/windows-acl.test.ts` (434 行)

**Step 1: 逐文件 diff 对比上游**

对每个文件执行 diff。

**Step 2: 审查重点**

- `secret-equal.ts`：极简（12 行），直接移植
- `host-env-security.ts`：检查 JSON 策略文件 `host-env-security-policy.json` 是否需要一并移植
- `windows-acl.ts`：检查 `../process/exec.js` 依赖在上游是否存在

**Step 3: 合并/复制 + 运行测试**

```bash
pnpm vitest run src/security/windows-acl.test.ts src/infra/host-env-security.test.ts -v
```

**Step 4: 向用户展示 diff 并等待确认**

### Task 1.6: 审查并移植安全扫描测试

**Files:**

- `src/security/temp-path-guard.test.ts` (210 行) — 依赖 `../test-utils/repo-scan.js`
- `src/security/weak-random-patterns.test.ts` (34 行) — 依赖 `../test-utils/repo-scan.js`
- `src/test-utils/repo-scan.ts` (138 行) — 上述两个测试的共享依赖

**Step 1: 检查 repo-scan.ts 在上游是否存在**

```bash
ls /Users/wangym/workspace/agents/openclaw/src/test-utils/repo-scan.ts 2>/dev/null || echo "需要移植"
```

**Step 2: 移植 repo-scan.ts（如需要），然后移植两个安全扫描测试**

**Step 3: 运行测试**

```bash
pnpm vitest run src/security/temp-path-guard.test.ts src/security/weak-random-patterns.test.ts -v
```

Expected: 全部通过（扫描不应在上游代码中发现问题）。

**Step 4: 向用户展示 diff 并等待确认**

### Task 1.7: 提交 Feature 1

**Step 1: 确认所有安全测试通过**

```bash
pnpm vitest run src/security/ src/infra/net/ -v
```

**Step 2: 确认上游原有测试无回归**

```bash
pnpm test
```

**Step 3: 确认 lint/format 通过**

```bash
pnpm check
```

**Step 4: Commit**

```bash
git add -A
git commit -m "[enhanced] feat: add security hardening — SSRF dual-phase protection, fetch guard, external content sanitization, Windows ACL, env security, guardrail tests"
```

**Step 5: 验证 rebase 可行性**

```bash
git stash  # 如有未提交的改动
git rebase upstream/main --dry-run 2>&1 || echo "dry-run 不支持，跳过"
git stash pop 2>/dev/null || true
```

---

## Phase 2: 渠道稳定性（Feature 2）

> **前置条件**：Phase 1 完成。

### Task 2.1: 审查并移植统一重试框架

**Files:**

- Source: `mindgate/src/infra/retry.ts` (136 行) — **NEW FILE**，仅依赖 `../utils.js` (sleep)
- Source: `mindgate/src/infra/retry.test.ts` (91 行) — **NEW FILE**
- Source: `mindgate/src/infra/retry-policy.ts` (103 行) — **NEW FILE**，依赖 retry.ts + `@buape/carbon` + logging

**Step 1: 确认这些文件在上游不存在**

```bash
ls /Users/wangym/workspace/agents/openclaw/src/infra/retry.ts 2>/dev/null && echo "上游已有！需 diff" || echo "上游不存在，直接复制"
ls /Users/wangym/workspace/agents/openclaw/src/infra/retry-policy.ts 2>/dev/null && echo "上游已有！需 diff" || echo "上游不存在，直接复制"
```

**Step 2: 检查依赖在上游是否可用**

- `../utils.js` — 上游应该有 sleep 函数
- `@buape/carbon` — 检查上游是否已有此依赖
- `../logging/subsystem.js` — 上游应该有
- `./errors.js` — 上游应该有

```bash
grep -q "buape/carbon" /Users/wangym/workspace/agents/openclaw/package.json && echo "有" || echo "没有"
```

**Step 3: 复制文件**

```bash
cp /Users/wangym/workspace/agents/mindgate/src/infra/retry.ts \
   /Users/wangym/workspace/agents/openclaw/src/infra/retry.ts
cp /Users/wangym/workspace/agents/mindgate/src/infra/retry-policy.ts \
   /Users/wangym/workspace/agents/openclaw/src/infra/retry-policy.ts
cp /Users/wangym/workspace/agents/mindgate/src/infra/retry.test.ts \
   /Users/wangym/workspace/agents/openclaw/src/infra/retry.test.ts
```

**Step 4: 运行测试**

```bash
pnpm vitest run src/infra/retry.test.ts -v
```

**Step 5: 向用户展示 diff 并等待确认**

### Task 2.2: 审查 Discord 稳定性修复（上游是否已修复？）

**Files:**

- Source: `mindgate/src/discord/monitor/provider.ts` — MODIFICATION（EventQueue timeout 30s→5min，约 6 行改动）
- Source: `mindgate/src/logging/console.ts` — MODIFICATION（抑制 EventQueue 噪音日志，约 3 行改动）

**Step 1: 检查上游是否已修复此问题**

```bash
# 检查上游 EventQueue timeout 值
grep -n "listenerTimeout" /Users/wangym/workspace/agents/openclaw/src/discord/monitor/provider.ts
# 如果已经是 300_000 或更大，说明上游已修复，跳过此 task
```

**Step 2: 如果上游未修复 — 提取最小 diff**

```bash
diff /Users/wangym/workspace/agents/mindgate/src/discord/monitor/provider.ts \
     /Users/wangym/workspace/agents/openclaw/src/discord/monitor/provider.ts | head -50
```

**Step 3: 仅应用 EventQueue timeout 改动（不超过 20 行）**

**Step 4: 向用户展示 diff 并等待确认**

### Task 2.3: 审查 Telegram IPv4-first DNS 修复

**Files:**

- Source: `mindgate/src/telegram/network-config.ts` (106 行) — **NEW FILE**
- Source: `mindgate/src/telegram/network-config.test.ts` (163 行) — **NEW FILE**
- 依赖: `src/infra/wsl.ts` — WSL2 检测

**Step 1: 确认这些文件在上游不存在**

```bash
ls /Users/wangym/workspace/agents/openclaw/src/telegram/network-config.ts 2>/dev/null
ls /Users/wangym/workspace/agents/openclaw/src/infra/wsl.ts 2>/dev/null
```

**Step 2: 检查依赖**

- `../config/types.telegram.js` (TelegramNetworkConfig) — 上游是否有此类型
- `../infra/env.js` (isTruthyEnvValue) — 上游是否有
- `../infra/wsl.js` (isWSL2Sync) — 可能需要一并移植

**Step 3: 移植 wsl.ts（如需要）+ network-config.ts + test**

**Step 4: 检查上游 Telegram bot 启动代码是否需要 hook 来调用 network-config**

在上游 Telegram 初始化代码中找到 DNS/网络配置的位置，添加最小的 import + 调用。

**Step 5: 运行测试**

```bash
pnpm vitest run src/telegram/network-config.test.ts -v
```

**Step 6: 向用户展示 diff 并等待确认**

### Task 2.4: 审查 Signal JSON 解析防护

**Files:**

- Source: `mindgate/src/signal/client.ts` (215 行) — MODIFICATION（parseSignalRpcResponse 函数）

**Step 1: 检查上游 Signal client 是否已有 JSON 解析防护**

```bash
grep -n "JSON.parse" /Users/wangym/workspace/agents/openclaw/src/signal/client.ts
# 如果已包裹在 try-catch 中，上游已修复
```

**Step 2: 如果上游未修复 — 提取 parseSignalRpcResponse 函数的最小 diff**

**Step 3: 向用户展示 diff 并等待确认**

### Task 2.5: 审查连接错误检测增强

**Files:**

- Source: `mindgate/src/agents/pi-embedded-helpers/errors.ts` — MODIFICATION（新增 `isConnectionErrorMessage` 函数，约 29 行）
- Source: `mindgate/src/auto-reply/reply/agent-runner-execution.ts` — MODIFICATION（重试从 1→3 次，约 5 行改动）

**Step 1: 检查上游是否已有 isConnectionErrorMessage**

```bash
grep -n "isConnectionErrorMessage\|ECONNRESET\|socket hang up" \
  /Users/wangym/workspace/agents/openclaw/src/agents/pi-embedded-helpers/errors.ts | head -10
```

**Step 2: 如果上游未有 — 提取最小 diff**

仅添加 `isConnectionErrorMessage()` 函数和 `classifyFailoverReason()` 中的集成点。
仅修改 `MAX_TRANSIENT_RETRIES` 从 2 到 3。

**Step 3: 向用户展示 diff 并等待确认**

### Task 2.6: 提交 Feature 2

**Step 1: 运行相关测试**

```bash
pnpm vitest run src/infra/retry.test.ts src/telegram/network-config.test.ts -v
```

**Step 2: 运行全量测试确认无回归**

```bash
pnpm test
```

**Step 3: Commit**

```bash
git add -A
git commit -m "[enhanced] feat: add channel stability — unified retry framework, Discord HELLO timeout, Telegram IPv4-first DNS, Signal JSON parsing, connection error detection"
```

---

## Phase 3: Windows 全平台适配（Feature 3）

> **前置条件**：Phase 2 完成。

### Task 3.1: 提取 MindGate-only Windows 改动清单

**Step 1: 生成所有 Windows 条件分支的文件列表**

```bash
cd /Users/wangym/workspace/agents/mindgate
grep -rl "process\.platform.*win32\|isWindows" src/ --include="*.ts" | grep -v ".test.ts" | sort > /tmp/mindgate-windows-files.txt
wc -l /tmp/mindgate-windows-files.txt
```

**Step 2: 逐文件与上游 diff，标记 MindGate 新增的 Windows 代码**

```bash
while read f; do
  upstream="/Users/wangym/workspace/agents/openclaw/$f"
  if [ -f "$upstream" ]; then
    changes=$(diff "$f" "$upstream" 2>/dev/null | grep -c "^[<>]" || true)
    echo "$changes $f"
  else
    echo "NEW $f"
  fi
done < /tmp/mindgate-windows-files.txt | sort -rn | head -30
```

**Step 3: 生成审查清单**

按改动量排序，将结果分为：

- **NEW 文件**：直接移植候选
- **大改动文件**（>20 行 diff）：需仔细审查
- **小改动文件**（≤20 行 diff）：可直接应用
- **上游已有改动**：跳过

**Step 4: 向用户展示清单并等待确认哪些需要移植**

### Task 3.2: 移植 Windows 适配代码

基于 Task 3.1 的确认清单，逐文件移植。

**Step 1: 对于每个确认的文件**

```bash
# 新文件
cp /Users/wangym/workspace/agents/mindgate/<file> /Users/wangym/workspace/agents/openclaw/<file>

# 修改文件 — 手动应用 diff（不超过 20 行/文件）
```

**Step 2: TypeScript 编译检查**

```bash
cd /Users/wangym/workspace/agents/openclaw
pnpm check
```

**Step 3: 向用户展示完整 diff 并等待确认**

### Task 3.3: 提交 Feature 3

```bash
pnpm test
git add -A
git commit -m "[enhanced] feat: add Windows platform support — ACL detection, path handling, WSL2 detection, platform-aware conditionals"
```

---

## Phase 4: 测试增强（Feature 4 + 5）

> **前置条件**：Phase 3 完成。

### Task 4.1: 审查并移植 test/setup.ts 增强

**Files:**

- Source: `mindgate/test/setup.ts` (189 行)
- Source: `mindgate/test/test-env.ts` (147 行)

**Step 1: Diff 对比**

```bash
diff /Users/wangym/workspace/agents/mindgate/test/setup.ts \
     /Users/wangym/workspace/agents/openclaw/test/setup.ts
diff /Users/wangym/workspace/agents/mindgate/test/test-env.ts \
     /Users/wangym/workspace/agents/openclaw/test/test-env.ts
```

**Step 2: 审查增量部分**

MindGate 可能新增的内容：

- Fake timer 泄漏保护（afterEach cleanup）
- 环境变量隔离增强（更多 key 的快照/恢复）
- Plugin registry stub 机制

注意：Plugin registry 相关代码可能是 MindGate 品牌特有的，需要调整为 OpenClaw 的等价概念。

**Step 3: 仅移植通用的测试基础设施增强**

不移植 MindGate 品牌特有的 channel plugin stub（上游应该有自己的版本）。

**Step 4: 向用户展示 diff 并等待确认**

### Task 4.2: 审查并移植 test-utils 增量

**Files:**

- Source: `mindgate/src/test-utils/` (21 文件, 891 行)

**Step 1: 列出上游 test-utils 已有的文件**

```bash
ls /Users/wangym/workspace/agents/openclaw/src/test-utils/ 2>/dev/null
```

**Step 2: Diff 对比，仅移植上游没有的工具**

重点移植候选：

- `repo-scan.ts` (138 行) — 安全扫描测试依赖，Phase 1 可能已移植
- `env.ts` (72 行) — 环境快照/恢复
- `temp-home.ts` (43 行) — 临时 HOME 管理
- `ports.ts` (109 行) — 确定性端口分配

**Step 3: 向用户展示 diff 并等待确认**

### Task 4.3: 修正覆盖率配置

**Files:**

- Modify: `openclaw/vitest.config.ts`

**Step 1: 读取当前上游覆盖率配置**

```bash
cat /Users/wangym/workspace/agents/openclaw/vitest.config.ts
```

**Step 2: 修改配置**

将 `all: false` 改为 `all: true`：

```typescript
coverage: {
  provider: "v8",
  all: true,  // 统计所有源文件，不仅仅是被测试 import 的
  // ... 其他配置保持不变
}
```

**Step 3: 运行覆盖率，评估是否需要调整阈值**

```bash
pnpm test:coverage 2>&1 | tail -30
```

如果覆盖率低于阈值，合理降低到实际水平（但不低于 50%）。

**Step 4: 向用户展示改动并等待确认**

### Task 4.4: 提交 Feature 4+5

```bash
pnpm test
git add -A
git commit -m "[enhanced] feat: enhance test infrastructure — env isolation, repo scanning, coverage config fix"
```

---

## Phase 5: 最终验证

### Task 5.1: 全量验证

**Step 1: Format + Typecheck + Lint**

```bash
pnpm check
```

**Step 2: 全量测试**

```bash
pnpm test
```

**Step 3: 覆盖率**

```bash
pnpm test:coverage
```

### Task 5.2: 模拟上游同步

**Step 1: Fetch 最新上游**

```bash
git fetch upstream main
```

**Step 2: 尝试 rebase**

```bash
git rebase upstream/main
```

**Step 3: 如果有冲突**

记录冲突文件数量。如果冲突超过 5 个文件，评估是否需要调整移植策略（减少对上游文件的侵入性改动）。

```bash
git rebase --abort  # 如果冲突太多，回退
```

### Task 5.3: 记录最终状态

**Step 1: 列出所有 [enhanced] commit**

```bash
git log --oneline --grep="\[enhanced\]"
```

Expected: 4-5 个 commit（Phase 0 docs + Feature 1-4）。

**Step 2: 统计改动量**

```bash
git diff --stat upstream/main..enhanced
```

**Step 3: 向用户汇报完成状态**

---

## 审查检查清单（每个 Task 的 diff 审查时使用）

- [ ] 对上游文件的修改不超过 20 行/文件
- [ ] 新增文件有对应测试
- [ ] 不引入上游没有的新 npm 依赖
- [ ] 无 `any` 类型
- [ ] 无 `@ts-ignore` / `@ts-nocheck`
- [ ] 无 `console.log`（应使用 subsystem logger）
- [ ] commit message 标注 `[enhanced]` 前缀
- [ ] TypeScript 编译通过
- [ ] 相关测试通过
- [ ] 上游原有测试无回归
