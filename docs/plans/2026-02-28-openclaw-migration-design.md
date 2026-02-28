# OpenClaw Fork Migration Design

从 OpenClaw 上游重新 fork，选择性移植 MindGate 的优质增量，丢弃膨胀部分。

## 决策记录

| 决策项    | 选择                      | 理由                             |
| --------- | ------------------------- | -------------------------------- |
| 目标渠道  | 全渠道（可按需激活/关闭） | 保留灵活性                       |
| 目标平台  | macOS + Linux + Windows   | 全平台支持                       |
| 命名      | 保持 OpenClaw 原名        | 减少品牌重命名工作，维持生态兼容 |
| 上游同步  | 定期 rebase 上游 main     | 持续获得上游新特性和修复         |
| 迁移策略  | Feature Branch Overlay    | 标准 git rebase 工作流           |
| 自动更新  | 不移植                    | 依赖上游机制                     |
| i18n 管线 | 不移植                    | 后续自行设计                     |

## 分支策略

```
openclaw/                    ← 从 github.com/openclaw/openclaw fork
├── main                     ← 跟踪上游 main（只用于 fetch upstream）
└── enhanced                 ← 增强分支（日常工作分支）
    ├── [upstream code]      ← 通过 rebase 保持最新
    └── [enhanced commits]   ← 增量 commit，叠在上游之上
```

### 上游同步流程

```bash
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

# 6. 推送（force-with-lease 安全覆盖）
git push --force-with-lease origin enhanced
```

### Commit 规范

- 前缀：`[enhanced]` 标识我们的增量 commit
- 示例：`[enhanced] feat: add SSRF dual-phase protection`
- 每个 feature 为一个或少量紧密关联的 commit

### rebase 冲突最小化原则

- 新功能优先以**新文件**形式添加，通过 import hook 接入上游
- 对上游文件的修改限制在最小插入点（一两行 import + 调用）
- 不重排上游函数、不改上游命名

## 移植模块

### Feature 1：安全加固（直接移植，质量已验证）

**优先级：最高**

| 文件                                      | 行数 | 评估                                             | 操作     |
| ----------------------------------------- | ---- | ------------------------------------------------ | -------- |
| `src/infra/net/ssrf.ts`                   | ~300 | 双阶段 SSRF 防护（DNS前+DNS后）                  | 直接移植 |
| `src/infra/net/ssrf.test.ts`              | ~134 | 57 个测试用例（43 私有 IP + 14 公网 + 恶意编码） | 直接移植 |
| `src/infra/net/fetch-guard.ts`            | ~250 | 重定向每跳校验 + 敏感 header 剥离                | 直接移植 |
| `src/shared/net/ip.ts`                    | ~150 | IPv4/IPv6 检测（含 6to4/Teredo/ISATAP/NAT64）    | 直接移植 |
| `src/security/external-content.ts` + test | ~380 | Unicode 同形字防护 + 随机化边界标记              | 直接移植 |
| `src/security/secret-equal.ts`            | 13   | SHA-256 + timingSafeEqual 恒时比较               | 直接移植 |
| `src/security/host-env-security.ts`       | ~100 | 危险环境变量阻止（LD_PRELOAD 等）                | 直接移植 |
| `src/security/windows-acl.ts` + test      | ~870 | 基于 SID 的 Windows ACL 检测                     | 直接移植 |
| 安全扫描测试                              | ~200 | AST 扫描阻止不安全模式                           | 直接移植 |

### Feature 2：渠道稳定性（直接移植，需先 diff 确认上游未修复）

**优先级：高**

| 文件                        | 行数 | 评估                       | 操作           |
| --------------------------- | ---- | -------------------------- | -------------- |
| `src/infra/retry.ts` + test | ~180 | 通用重试框架（指数退避）   | 直接移植       |
| `src/infra/retry-policy.ts` | ~50  | 渠道特定重试策略           | 直接移植       |
| Discord HELLO 超时          | ~80  | provider.lifecycle.ts 改动 | 最小 diff 移植 |
| Telegram IPv4-first DNS     | ~170 | network-config.ts + test   | 直接移植       |
| Signal JSON 解析防护        | ~70  | client.ts try-catch        | 最小 diff 移植 |

**注意**：移植前需与上游最新版 diff，如上游已修复则跳过。

### Feature 3：Windows 全平台适配（需深度审查）

**优先级：中**

- 76 个文件包含 `isWindows` / `process.platform === "win32"` 条件分支
- 需逐文件 diff 对比上游，仅移植 MindGate 新增的 Windows 适配
- Windows ACL 已包含在 Feature 1 中

### Feature 4：测试基础设施增强（直接移植增量部分）

**优先级：中**

- `test/setup.ts` 增强：环境隔离、fake timer 泄漏保护
- 测试工厂函数：如上游没有则移植

### Feature 5：覆盖率配置修正（需完善后移植）

**优先级：低**

- 将 `all: false` 改为 `all: true`
- 合理调整阈值（可能需从 70% 降到 50-60%，因为统计范围扩大了）
- 逐步扩展覆盖率 include 范围

## 不移植清单

| 内容                                       | 理由                             |
| ------------------------------------------ | -------------------------------- |
| 自动更新系统（1842 行）                    | 缺少签名验证，依赖上游机制       |
| i18n 管线（Go 工具 + 中文文档）            | 后续自行设计，异质语言增加复杂度 |
| `packages/clawdbot/` + `packages/moltbot/` | 旧名称兼容垫片，新 fork 不需要   |
| `vendor/a2ui/`（1.9MB）                    | 应改为 npm 依赖或 submodule      |
| `Swabble/`（Swift 项目）                   | 应独立为子仓库                   |
| 154KB README                               | 使用上游 README                  |
| 26 个 `@deprecated` 导出                   | 新 fork 不携带历史包袱           |
| 品牌重命名改动                             | 保持 OpenClaw 原名               |
| `scripts/docs-i18n/` Go 翻译工具           | 不移植 i18n                      |

## 审查流程

每个 Feature 移植前必须经过：

1. **diff 提取** — 与上游同名文件做 diff，区分新增 vs 修改
2. **代码审查** — 质量、安全性、测试覆盖、最小侵入性
3. **冲突预评估** — 修改的上游文件是否已大幅变化
4. **测试验证** — 增量测试 + 上游回归测试
5. **最终确认** — 展示完整 diff，获得确认后才 commit

### 审查通过标准

- 对上游文件的修改不超过 20 行/文件
- 新增文件有对应测试
- 不引入上游没有的新依赖（除非有充分理由）
- commit message 标注 `[enhanced]` 前缀

## 实施里程碑

| Phase | 内容                                                 | 检查点                           |
| ----- | ---------------------------------------------------- | -------------------------------- |
| 0     | Fork + 创建 enhanced 分支 + CI 配置 + CLAUDE.md 更新 | 分支可用，CI 通过                |
| 1     | 安全加固（Feature 1）                                | 安全扫描测试通过，上游测试无回归 |
| 2     | 渠道稳定性（Feature 2）                              | 渠道测试通过                     |
| 3     | Windows 适配（Feature 3）                            | Windows CI 通过                  |
| 4     | 测试增强（Feature 4 + 5）                            | `pnpm test:coverage` 通过        |

每个 Phase 结束时：`pnpm check` + `pnpm test` + 模拟 rebase 确保冲突可控。
