# Repository Guidelines

- Repo: https://github.com/openclaw/openclaw
- In chat replies, file references must be repo-root relative only (example: `src/telegram/index.ts:80`); never absolute paths or `~/...`.
- Do not edit files covered by security-focused `CODEOWNERS` rules unless a listed owner explicitly asked for the change.

## Project Structure

- Source code: `src/` (CLI in `src/cli`, commands in `src/commands`, infra in `src/infra`, media in `src/media`).
- Tests: colocated `*.test.ts`. Docs: `docs/`. Built output: `dist/`.
- Nomenclature: use "plugin" / "plugins" in docs, UI, changelogs.
- Plugins: live in the bundled workspace plugin tree. Keep plugin-only deps in the extension `package.json`.
- Import boundaries: extensions use `openclaw/plugin-sdk/*` plus local `api.ts` / `runtime-api.ts` as public surface. Do not import core `src/**` from extension code.
- Messaging channels: consider **all** built-in + extension channels when refactoring shared logic.
- When adding channels/plugins/apps/docs, update `.github/labeler.yml` and create matching GitHub labels.

## Architecture Boundaries

Repo map:

- `src/plugin-sdk/*` = public plugin contract
- `src/channels/*` = core channel implementation
- `src/plugins/*` = plugin discovery, loader, registry
- `src/gateway/protocol/*` = typed Gateway wire protocol

**Detailed rules live in scoped AGENTS.md files** — read only those relevant to your current task:

- `extensions/AGENTS.md` — extension/plugin boundary
- `src/plugin-sdk/AGENTS.md` — public SDK contract
- `src/channels/AGENTS.md` — core channel boundary
- `src/plugins/AGENTS.md` — plugin loading, registry, manifest
- `src/gateway/protocol/AGENTS.md` — typed Gateway protocol
- `test/helpers/AGENTS.md` — shared test helper boundary

Core principles (apply everywhere):

- Core must stay extension-agnostic. No hardcoded extension/provider/channel id lists in core.
- Extensions cross into core only through `openclaw/plugin-sdk/*` and manifest metadata.
- Protocol changes are contract changes. Prefer additive evolution.
- New plugin seams must be documented, backwards-compatible, versioned contracts.

Workflow hygiene:

- Do not grep or existence-check every guide path before starting work.
- Read only the guides directly relevant to the files you are touching.

## Scoped Workflow Guides

- `docs/AGENTS.md` — Mintlify docs, docs links, docs i18n
- `ui/AGENTS.md` — Control UI i18n and generated locale
- `scripts/AGENTS.md` — script-runner, local-check lock, test/lint wrappers

## Build, Test, and Development Commands

- Runtime: Node **22+** (keep Node + Bun paths working).
- Install deps: `pnpm install` (also supported: `bun install`)
- If deps are missing, run `pnpm install` then retry the command once.
- Prefer Bun for TypeScript execution: `bun <file.ts>` / `bunx <tool>`.
- Run CLI in dev: `pnpm openclaw ...` or `pnpm dev`.

**Core commands:**

| Command                    | Purpose                              |
| -------------------------- | ------------------------------------ |
| `pnpm build`               | Type-check + build                   |
| `pnpm tsgo`                | TypeScript checks only               |
| `pnpm check`               | Lint + format check (local dev gate) |
| `pnpm format:fix`          | Auto-fix formatting                  |
| `pnpm test`                | Run tests (vitest)                   |
| `pnpm test:coverage`       | Tests with coverage                  |
| `FAST_COMMIT=1 git commit` | Skip hook's format + check           |

**Verification gates:**

- Local dev gate: `pnpm check` (normal edit loop).
- Landing gate (push `main`): `pnpm check` + `pnpm test` + `pnpm build` (when touching build/packaging/module boundaries).
- Do not land changes with failing checks caused by or plausibly related to the touched surface.

**Drift detection** (run gen + commit `.sha256` when changing these surfaces):

- Config schema: `pnpm config:docs:gen` / `pnpm config:docs:check`
- Plugin SDK API: `pnpm plugin-sdk:api:gen` / `pnpm plugin-sdk:api:check`

**Type error triage:** group by package/module/type contract, fix the source-of-truth type first, rerun before widening. Check `origin/main` before broad cleanup.

## Prompt Cache Stability

- Treat prompt-cache stability as correctness/perf-critical.
- Make ordering deterministic for any code assembling model/tool payloads from maps, sets, registries, or network results.
- Prefer mutating newest/tail content first so cached prefix stays byte-identical.
- Cache-sensitive changes require a regression test proving prefix stability.

## Coding Style

- Language: TypeScript (ESM). Strict typing; avoid `any`.
- Formatting/linting: Oxlint + Oxfmt. Never add `@ts-nocheck` or inline lint suppressions by default.
- Prefer `zod` at external boundaries. Prefer discriminated unions and `Result<T, E>` for recoverable decisions.
- Do not use freeform strings for internal branching; prefer closed code unions.
- Dynamic imports: do not mix `await import("x")` and static `import from "x"` for the same module. Use `*.runtime.ts` boundaries for lazy loading.
- Circular deps: keep `pnpm check:import-cycles` and `pnpm check:madge-import-cycles` green.
- Extension imports: use `openclaw/plugin-sdk/<subpath>` as the only cross-package contract. Internal extension imports go through local barrels (`./api.ts`, `./runtime-api.ts`).
- No prototype mutation for sharing class behavior. Use explicit inheritance/composition.
- Keep files under ~700 LOC. Add brief comments for non-obvious logic.
- Naming: **OpenClaw** for product headings; `openclaw` for CLI/package/paths.
- Written English: American spelling (color, behavior, analyze).

## Release / Advisory Workflows

- Use `$openclaw-release-maintainer` at `.agents/skills/openclaw-release-maintainer/SKILL.md` for release workflows.
- Use `$openclaw-ghsa-maintainer` at `.agents/skills/openclaw-ghsa-maintainer/SKILL.md` for GHSA advisories.
- Release and publish require explicit approval.

## Testing Guidelines

- Framework: Vitest, V8 coverage (70% threshold). Naming: `*.test.ts`, e2e: `*.e2e.test.ts`.
- Model constants in tests: prefer `sonnet-4.6` and `gpt-5.4`.
- Run `pnpm test` before pushing when you touch logic.
- Clean up timers, env, globals, mocks, sockets, temp dirs so `--isolate=false` stays green.
- Test performance: avoid `vi.resetModules()` + `await import(...)` per test for heavy modules. Prefer static/`beforeAll` imports with mock resets in `beforeEach`. Use narrow SDK subpaths and `*.runtime.ts` seams over broad barrel mocks. Treat import-dominated test time as a boundary bug.
- Run tests via `pnpm test <path-or-filter> [vitest args...]`; do not use raw `pnpm vitest run`.
- Workers: max 16. Memory pressure: `OPENCLAW_VITEST_MAX_WORKERS=1 pnpm test`.
- Live tests: `OPENCLAW_LIVE_TEST=1 pnpm test:live`. Full kit: `docs/help/testing.md`.
- Agents MUST NOT modify baseline/inventory/snapshot files to silence checks without approval.
- Changelog: user-facing changes only. Append to end of section. No changelog for pure test changes.

## Commit & PR Guidelines

- Use `$openclaw-pr-maintainer` at `.agents/skills/openclaw-pr-maintainer/SKILL.md` for PR workflows.
- Create commits with `scripts/committer "<msg>" <file...>`; avoid manual `git add`/`git commit`.
- Concise, action-oriented commit messages (e.g., `CLI: add verbose flag to send`).
- Group related changes; avoid bundling unrelated refactors.
- Agents MUST NOT create or push merge commits on `main`. Rebase onto `origin/main` before pushing.

## Security & Safety

- Never commit real phone numbers, videos, or live config values. Use fake placeholders.
- Do not change version numbers or run npm publish without explicit consent.
- Any dependency with `pnpm.patchedDependencies` must use exact version (no `^`/`~`).
- Patching dependencies requires explicit approval.

## Multi-agent Safety

- Do **not** create/drop `git stash`, switch branches, or modify `git worktree` unless explicitly requested.
- "commit" = scope to your changes only. "commit all" = everything in grouped chunks. "push" = may `git pull --rebase` first.
- Focus on your changes; ignore unrecognized files from other agents.
- Formatting-only diffs: auto-resolve without asking. Only ask for semantic changes.

## Collaboration Notes

- When working on a GitHub Issue or PR, print the full URL at the end.
- Verify answers in code; do not guess.
- Tool schema guardrails: avoid `Type.Union` in tool input schemas; use `stringEnum`/`optionalStringEnum`. Avoid raw `format` property names.
- Never send streaming/partial replies to external messaging surfaces (WhatsApp, Telegram); only final replies.
- Bug investigations: read source code of relevant npm dependencies before concluding.

---

## 二次开发主目标 (current focus)

本仓库的二次开发工作分为「上一代」和「当前主目标」两条线，并存于同一棵代码树中。

### 当前主目标 — `deck-go/`

`deck-go/` 是 OpenClaw 之上新建的企业管理/运维平台（Go 后端 + React 前端），按 `RUNTIME_MODE` 在 bundled / remote 两种模式下运行：bundled 模式下 deck-go 本机 spawn Gateway；remote 模式下连接远程 Gateway。新工作均以此目录为主线。

- 完整设计：`docs/superpowers/specs/2026-04-28-runtime-mode-decoupling-design.md`
- 现状：runtime-mode 解耦正在按 `openspec/changes/runtime-mode-decoupling/tasks.md` 实施
- 本地后端启动脚本：`deck-go/scripts/dev/run-bundled.sh` / `deck-go/scripts/dev/run-remote.sh`
- `.env` 样例：`deck-go/.env.bundled.example` / `deck-go/.env.remote.example`
- 独立于 `deploy/` 的 deck-go 部署产物后续单独规划

### 已归档参考 — 上一代 Deck 客户端

下列内容**保留可用、不再迭代**，仅作为历史决策与代码模式的参考：

| 路径                                                      | 性质                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| `dashboard/`                                              | Next.js 实现的上一代 Deck 客户端（`openclaw-deck` v0.1.0）      |
| `deck-e2e/`                                               | 上一代 Deck 视觉基线截图                                        |
| `deploy/`                                                 | 上一代 Deck + Gateway 部署产物（`openclaw-deploy-*.tar.gz` 等） |
| `scripts/dev/deck-dev.sh`                                 | 上一代 Gateway+Dashboard 开发启动脚本                           |
| `scripts/protocol-gen*.ts` / `protocol-coverage-check.ts` | 为 `dashboard/src/types/` 生成 typed client 的 codegen          |
| `scripts/deck-gap-report.ts`                              | 上一代 Deck 能力差距报告                                        |
| `scripts/deck-visual-comparison-scaffold.mjs`             | 上一代视觉 parity 脚手架                                        |
| 根目录 `deck-chat-visual-parity-*.png/.md`                | 上一代视觉 parity 历史快照                                      |

新功能、新需求、新 bug 修复**不要进上面的目录**。下面 "Enhanced Fork" 一节里 `Deck 客户端三层架构定位` / `Deck 开发环境` / `Gateway Protocol SDK` 三个子节均针对 `dashboard/`，已统一标记 (legacy)。

---

## Enhanced Fork — 上游同步流程

本项目是 OpenClaw 的增强 fork（`wymfly/openclaw`）。`enhanced` 分支包含所有增量改动，`main` 分支跟踪上游。

### 同步步骤

```bash
# 1. 获取上游最新代码
git fetch upstream main

# 2. 切换到增强分支
git checkout enhanced

# 3. 将我们的 commit 叠到最新上游之上
git rebase upstream/main

# 4. 解决冲突（如果有），逐 commit 处理
# git rebase --continue

# 5. Protocol SDK 同步（如果上游改了 Gateway 方法/schema）
#    详见下方「Gateway Protocol SDK → 上游 rebase 后的 Protocol 同步流程」
pnpm protocol:gen:ts
pnpm tsc --noEmit  # 检查 Deck 类型是否需要修复

# 6. 验证
pnpm install
pnpm check
pnpm test

# 7. 推送
git push --force-with-lease origin enhanced
```

### Commit 规范

- 前缀：`[enhanced]` 标识增量 commit
- 示例：`[enhanced] feat: add SSRF dual-phase protection`
- 对上游文件的修改限制在最小插入点（一两行 import + 调用）
- 新功能优先以新文件形式添加

### 增强模块

本 fork 移植自 MindGate 的优质增量，包含：

1. **安全加固** — SSRF 双阶段防护、Fetch Guard、外部内容 Unicode 防护、Windows ACL、环境变量安全
2. **渠道稳定性** — 统一重试框架（指数退避）、Discord HELLO 超时、Telegram IPv4-first DNS、Signal JSON 解析防护
3. **Windows 适配** — 全平台条件分支、icacls 解析、WSL2 检测
4. **测试增强** — 环境隔离、安全扫描测试（temp-path-guard、weak-random）、覆盖率修正

设计文档：`docs/plans/2026-02-28-openclaw-migration-design.md`
实施计划：`docs/plans/2026-02-28-openclaw-migration-plan.md`

### Deck 客户端三层架构定位 (legacy: 针对 `dashboard/`)

| 层             | 数据源                                   | 核心工作                                 | 典型模块                              |
| -------------- | ---------------------------------------- | ---------------------------------------- | ------------------------------------- |
| **实时交互层** | Gateway RPC（WebSocket/SSE）             | 渲染优化、流式响应、状态同步             | Chat、Session、Agent 运行态           |
| **配置管理层** | `openclaw.json`（通过 Gateway RPC 读写） | 对齐源码校验逻辑，设计交互友好的配置界面 | Models、Channels、Hooks、Agent 配置   |
| **状态监控层** | Gateway RPC（只读）                      | 可视化展示运行状态                       | Device 状态、Channel 连接、Usage 统计 |

### Deck 开发环境 (legacy: 针对 `dashboard/`)

> **新主目标 deck-go 的开发环境见文末 "Deck-go 开发环境" 一节。**

**强制规则：Gateway 必须从本地源码运行，不得使用全局安装的 `openclaw` 命令。**

原因：增强 fork 包含自定义 RPC handlers（Channel Event Filter 等），全局安装版本不包含这些代码。

启动脚本：`scripts/dev/deck-dev.sh`

```bash
# 启动 Gateway + Dashboard（推荐）
scripts/dev/deck-dev.sh

# 单独启动
scripts/dev/deck-dev.sh gateway   # Gateway only（从本地源码构建+运行）
scripts/dev/deck-dev.sh deck      # Dashboard only
scripts/dev/deck-dev.sh stop      # 停止所有
```

手动启动：

- Gateway：`NO_PROXY=localhost,127.0.0.1 pnpm openclaw gateway run --bind loopback --port 18789 --force`
- Dashboard：`cd dashboard && NO_PROXY=localhost,127.0.0.1 pnpm dev`

**检查清单**（功能测试前）：

- [ ] `NO_PROXY=localhost,127.0.0.1` 已设置（否则 Squid 代理拦截 localhost 请求）
- [ ] Gateway 从本地源码运行（`pnpm openclaw`，不是全局 `openclaw`）
- [ ] 验证：`curl -s http://localhost:3000/api/deck/agents -X POST -H 'Content-Type: application/json' -d '{"action":"eventStreams.get","agentId":"main"}'` 应返回 JSON

### Gateway Protocol SDK (legacy: `dashboard/` typed client)

> deck-go 走自己的契约链路（`deck-go/contracts/` + `deckapi.generated.go`），与本节描述的 `dashboard/src/types/gateway-*.generated.ts` 流水线**无关**。本节保留供 `dashboard/` 维护参考。

Deck 通过 typed client（`gw.*`）调用 Gateway RPC，类型从 TypeBox schema 自动生成。

设计文档：`docs/plans/2026-03-27-gateway-protocol-sdk-design.md`

```
ProtocolSchemas (TypeBox) + Result Schemas → MethodRegistry
    ↓ scripts/protocol-gen-ts.ts           ↓ gateway.describe RPC
dashboard/src/types/gateway-*.generated.ts  运行时 API 发现
    ↓
GatewayClient (typed) → Deck stores/routes
```

**开发规则**：

- Deck 必须通过 typed client (`gw.*`) 调用 Gateway，**禁止** `gatewayRequest()` 字符串调用
- `dashboard/src/types/gateway-*.generated.ts` 是自动生成的，**不要手工编辑**
- 新增 Gateway RPC 方法时必须同步四处：handler → result schema → methodDefs → `pnpm protocol:gen:ts`
- `pnpm protocol:gen:check` 必须通过才能 push enhanced 分支

**上游 rebase 后的 Protocol 同步流程**：

```bash
# 1. 检测上游新增/修改的方法
git diff upstream/main~1..upstream/main -- src/gateway/server-methods-list.ts
git diff upstream/main~1..upstream/main -- src/gateway/protocol/schema/

# 2. 对新增方法：
#    Deck 需要 → 补 result schema + methodDefs 元数据
#    Deck 不需要 → 标记 result: undefined（P2 层级）

# 3. 重新生成 typed client
pnpm protocol:gen:ts

# 4. 修复 Deck 消费侧类型错误
pnpm tsc --noEmit
```

**关键文件**：

| 文件                                                | 角色                                                     |
| --------------------------------------------------- | -------------------------------------------------------- |
| `src/gateway/method-registry.ts`                    | MethodRegistry 核心（method → handler + schema + scope） |
| `src/gateway/server-methods/describe.ts`            | `gateway.describe` introspection RPC                     |
| `scripts/protocol-gen-ts.ts`                        | TypeScript codegen 脚本                                  |
| `dashboard/src/types/gateway-protocol.generated.ts` | 生成的类型定义（不要手编）                               |
| `dashboard/src/types/gateway-client.generated.ts`   | 生成的 typed client + allowlist（不要手编）              |
| `scripts/deck-gap-report.ts`                        | Deck 能力差距检测（typed/partial/untyped 三级分类）      |

**上游同步 Skill**：使用 `$deck-upstream-sync`（`.agents/skills/deck-upstream-sync/SKILL.md`）完成完整的 rebase → protocol sync → gap 检测 → Deck 适配工作流。

**Method Registry 元数据模式**：

```typescript
// src/gateway/server-methods/deck/agents.ts
export const deckAgentsHandlers: GatewayRequestHandlers = { ... };
export const deckAgentsMethodDefs: Record<string, Omit<MethodDefinition, "handler">> = {
  "deck.agents.detail": {
    params: DeckAgentsDetailParamsSchema,
    result: DeckAgentsDetailResultSchema,
    scope: "operator.read",
  },
};
```

**Result Schema 优先级**：P0（`deck.*` 全部）+ P1（Deck 已用的上游方法）必须有 result schema；P2（Deck 未用的）标记 `result: undefined`。

---

## Deck-go 开发环境（新主目标）

`deck-go/` 是当前二次开发主目标，与上一代 `dashboard/` 共存但完全独立——独立的 contracts 链路、独立的运行时模型（.env-driven）、独立的开发/部署工具链。

### 设计与状态

- **设计文档**：`docs/superpowers/specs/2026-04-28-runtime-mode-decoupling-design.md`
- **核心理念**：`RUNTIME_MODE` 由 .env 决定，运行时不可切换
  - `bundled` 模式：deck-go 本机 spawn Gateway，UI 对 runtime 配置只读，所有参数从 .env 读
  - `remote` 模式：deck-go 连接远程 Gateway，UI 可改 endpoint 并写入 `deck-state.json`（覆盖 .env 默认值）
- **架构原则**：facade 接口 + 两个 impl 包（`bundled/`、`remote/`）物理隔离，Browser 永远只跟 deck-go 说话不直连 Gateway
- **现状**：runtime-mode 解耦已进入实施，后续闭环以 `openspec/changes/runtime-mode-decoupling/tasks.md` 为准

### 开发产物

当前主线产物：

- `deck-go/.env.bundled.example` / `deck-go/.env.remote.example` —— runtime-mode `.env` 样例（复制后请设为私有权限）
- `deck-go/scripts/dev/run-bundled.sh` / `deck-go/scripts/dev/run-remote.sh` —— 本地后端启动脚本（不复用上一代 `scripts/dev/deck-dev.sh`）
- `deck-go/backend/internal/runtime/{facade,envconf,state,bundled,remote,shared}/` —— 后端 runtime-mode 模块切分
- `deck-go/contracts/` —— deck-go 自有契约链路；修改 API 合约后运行 `cd deck-go && make contracts-sync`
- 独立于上一代 `deploy/` 的 deck-go 部署形态（systemd unit / 容器镜像）后续单独规划
- E2E 目标：`bundled.spec.ts` / `remote.spec.ts`

### 与上一代 Deck 的关系

| 维度         | `dashboard/`（legacy）                            | `deck-go/`（current）                          |
| ------------ | ------------------------------------------------- | ---------------------------------------------- |
| UI 框架      | Next.js (TS/React)                                | React + Vite + 自研 deck-ui                    |
| 后端         | 直接走 Gateway typed client                       | Go middleware (controld) + facade abstraction  |
| 部署         | `deploy/openclaw-deploy-*.tar.gz`                 | 待规划，不复用 `deploy/`                       |
| 启动         | `scripts/dev/deck-dev.sh`（启 Gateway+Dashboard） | `deck-go/scripts/dev/run-*.sh`（待落地）       |
| Gateway 关系 | 1:1 本机绑定                                      | 1:1 本机（bundled）或 1:N 远程（remote，未来） |
| 状态         | 冻结（仍可使用，不再迭代新功能）                  | 主线（所有新工作）                             |

### 开发约定

- 给 `deck-go/` 加新功能时 **不要**回参考 `dashboard/` 的实现细节去做"对齐"——两套架构不同，对齐是错的
- 上游 rebase 流程仍然走 "Enhanced Fork — 上游同步流程"；其中 Protocol SDK 同步那一节只针对 `dashboard/`，对 `deck-go/` 无影响
- deck-go 后续可能产生自己的 AGENTS.md 子节或独立 `deck-go/AGENTS.md`，目前由本节统一描述
