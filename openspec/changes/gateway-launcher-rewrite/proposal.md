## Why

deck-go 当前 `bundled` 模式通过 BFF 进程 spawn Gateway 子进程, 是历史包袱: Gateway 跟 deck-go BFF 生命周期耦合 (BFF 崩溃 → Gateway 死), 自实现 supervisor / lock / PID 管理重复了 OpenClaw 官方运维 surface (`launchd` / `systemd` / `schtasks` 通过 `gateway install/start/stop/restart`) 已经提供的能力, 同时让 R2 (control surface 分层 mode-aware) 在 frontend / backend 散落多处 leakage (canvas A2UI 资产 bundled-only 加载是 functional leak, HeaderBar 直接 `mode === "remote"` 分支等). 用户在 2026-05-13 Phase 3 grill 中明确: "OpenClaw 的 Gateway 用官方的命令行单独启动就可以了 ... 需要的其实是运维 Gateway, 而不是把它包含进去." deck-go 应作为 Gateway 客户端 + 图形化运维界面, 调用本仓库 build 的官方 CLI, 不再 spawn 子进程.

本 change 是 β 二分收敛方案的 **change 1 (清理)**. 完成后 deck-go 能力表面跟当前一样 (mode 仍然启动时决定), 但底层从 spawn 改为调官方 CLI, 命名干净, R2 violation 清零, E2E 体系兼容新机制. 运行时切换能力推到 change 2 (`runtime-mode-switching`).

## What Changes

- **MODIFIED**: `runtime-mode-dispatch` capability — `RUNTIME_MODE` 取值从 `bundled | remote` 改为 `local | remote`; `bundled` 实现移除, `local` 实现新增 (走官方 CLI). `local` 模式下不再 spawn Gateway 子进程; deck-go BFF 通过本仓库 build 的 `node dist/entry.js gateway install/start/stop/restart/status` 来运维 Gateway 进程. 旧 `RUNTIME_BUNDLED_COMMAND` / `RUNTIME_BUNDLED_ARGS` env 删除. R2 修正版本继续生效 (业务 surface mode-agnostic, 运维 surface 显式 mode-aware).
- **NEW**: `local-gateway-lifecycle` capability — 定义 deck-go 在 `local` 模式下作为本地 Gateway 生命周期 copilot 的完整契约. 涵盖: 启动时 **4 状态** probe 状态机 (Running / Stopped / NotInstalled / Unhealthy; 不引入 reserved `cli-missing` 状态, 入口缺失通过 NotInstalled + `lastError: entrypoint_not_found` 表达), `[安装并启动] / [Start] / [Stop] / [Restart] / [Reinstall]` UI controls, entrypoint 路径定位三层 fallback (相对路径默认 + `OPENCLAW_REPO_ROOT` env 覆盖 + install 时绝对路径 lock + 路径漂移检测), per-repo-hash service 名 (防多 fork 同机器冲突, 通过 `OPENCLAW_LAUNCHD_LABEL` / `OPENCLAW_SYSTEMD_UNIT` / `OPENCLAW_WINDOWS_TASK_NAME` 现有 env vars 派生, 不引入新 CLI flag).
- **BREAKING**: `RUNTIME_MODE=bundled` 不再被接受. `RUNTIME_BUNDLED_COMMAND` / `RUNTIME_BUNDLED_ARGS` env 删除. 旧 `.env.bundled.example` 删除, 新 `.env.local.example` 取而代之.
- **BREAKING**: `Capabilities.mode` 字段值从 `"bundled" | "remote"` 改为 `"local" | "remote"`. Frontend 类型守卫 `isBundledRuntimeStatus()` 重命名 `isLocalRuntimeStatus()`. 此为 contract 改动, 需要 `make protocol-update` + `make contracts-sync` 重生产物.
- **MODIFIED**: `backend/internal/runtime/bundled/` 包重命名 `backend/internal/runtime/local/` + 重写 — spawn child + supervisor + lock 自实现的所有代码删除, 改为通过 shell exec 调本仓库 `dist/entry.js gateway install/start/stop/restart/status`. Lock / PID 管理依赖官方机制 (`$STATE_DIR/.locks/gateway.$HASH.lock`).
- **MODIFIED**: R2 violation 修复 6 处 — `frontend-new/src/deck-ui/HeaderBar.tsx:31` (业务 surface 直接 mode 分支), `backend/internal/server/assets.go:269` + `backend/internal/runtime/openclaw/legacy_admin_assets.go:249` (canvas A2UI 资产 bundled-only 加载, **functional leak**; 迁移方案为 BFF 反向代理 Gateway-served 资源, 保持 browser → BFF → Gateway 边界, 详 design D5), `frontend-new/src/api.ts:566/572/578` (类型守卫重命名 + 集中到运维 surface client). 同时落实 OperationsPanel mount 改为 `capabilities.supervisorState` 驱动而非 `mode === "local"` (R1c M2 修).
- **MODIFIED**: `scripts/dev/run-bundled.sh` 重命名 `run-local.sh`; `scripts/dev/run-stack-real.sh` 改为先 `node dist/entry.js gateway install + start` 再启 BFF + Vite (frontend Vite dev mode 热更新保留, 这是 real E2E 的关键体验).
- **MODIFIED**: E2E 适配 5 个 explicit gap — Mock E2E `mock-gateway.mjs` 由 test fixture 独立启动 (不再 BFF spawn); 旧 `test/e2e/bundled.spec.ts` + `remote.spec.ts` 合并为 `mock.spec.ts` (或 design.md 决定保留两份测不同 endpoint 形态); `make e2e-mock-runtime` / `make e2e-mock-module` 简化; Real E2E install 隔离 (per-repo-hash service 名 + uninstall cleanup, 不污染用户 `~/Library/LaunchAgents/`); `.env.remote.example` 本 change 保留不动.
- **REMOVED**: `bundled/supervisor.go`, `bundled/preflight.go`, `bundled/ownership.go`, `bundled/fingerprint.go`, `bundled/config_sync*` 全部删除 — 这些都是 spawn 模式自实现的细节, 走官方 CLI 后不再需要.
- **DOC**: deck-go/AGENTS.md + deck-go/CLAUDE.md "Architecture" / "Runtime And Dev Scripts" 段同步更新, 反映 `local` 命名和 install/start 路径; `.env` 三件套描述同步.
- **CONSTRAINT**: 本 change 严格遵守 Rule R3 (Real E2E ≡ release + .env 差异) — 任何"E2E-only spawn shortcut" 提议必须 reject; E2E 与 release 共享同一份 BFF / frontend 代码 + install 路径, 唯一差别在 `.env` 隔离路径 + 调试 flag.

## Capabilities

### New Capabilities

- `local-gateway-lifecycle`: deck-go 在 `local` 模式下作为本地 Gateway 生命周期 copilot 的契约 — install/start/stop/restart 通过本仓库 `dist/entry.js gateway` CLI 调用; 5 状态 probe (Running / Stopped / NotInstalled / Unhealthy) + 对应 UI; entrypoint 路径定位 (相对默认 + env 覆盖 + install 时绝对路径 lock + 漂移检测); per-repo-hash service 名防多 fork 冲突; ensure-available + lifecycle-controllable 两个唯一目标的 scope 锚定 (拒绝监控 dashboard / 升级管理 / token rotation / wizard 等 scope creep).

### Modified Capabilities

- `runtime-mode-dispatch`: `RUNTIME_MODE` 取值从 `bundled | remote` 改为 `local | remote`; `bundled` 实现移除; `local` 实现是新加的 (调官方 CLI, 见 `local-gateway-lifecycle`); `RUNTIME_BUNDLED_*` env 删除; `Capabilities.mode` 字段值改 enum; frontend 类型守卫重命名; R2 violation 清零 (业务 surface mode-agnostic 严格执行, 运维 surface mode-aware 显式合法). 注: `runtime-mode-dispatch` 由 `runtime-mode-decoupling` change 引入但尚未 archive — 本 change 的 delta 在该 change archive 后会与本 change 的 delta 合并落地到 `openspec/specs/runtime-mode-dispatch/spec.md`.

## Impact

**Affected code**:

- `deck-go/backend/internal/runtime/bundled/` → 重命名 `local/` + 大部分文件重写或删除
- `deck-go/backend/internal/runtime/facade/` — interface 不破坏 (change 2 才会扩展 swap 接口)
- `deck-go/backend/internal/runtime/envconf/` — 移除 `RUNTIME_BUNDLED_*` 解析
- `deck-go/backend/internal/server/assets.go:269` + `deck-go/backend/internal/runtime/openclaw/legacy_admin_assets.go:249` — canvas A2UI 资产路径重设计 (design.md 锁归宿)
- `deck-go/frontend-new/src/deck-ui/HeaderBar.tsx:31` — 业务 surface 违规修复
- `deck-go/frontend-new/src/api.ts:566/572/578` — 类型守卫重命名
- `deck-go/frontend-new/src/components/runtime/*` — 运维 surface 完善 (`FirstRunBanner` / `ModeBadge` 等已合规, 但需要加 Gateway 状态面板和 install/start/stop/restart controls)

**Affected contracts / generated artifacts**:

- `deck-go/contracts/source/deck-api.contract.ts` — `Capabilities.mode` enum 值
- `deck-go/contracts/generated/ts/...` + `deck-go/backend/internal/gateway/generated/...` — 需要 `make protocol-update` + `make contracts-sync` 重生
- `deck-go/contracts/source/deck-endpoints.contract.json` — `bundled-mode read-only` 等注释更新为 `local-mode read-only`

**Affected env / scripts**:

- `deck-go/.env.bundled.example` → `.env.local.example` (内容大幅变, RUNTIME*BUNDLED*\* 删除, 加 OPENCLAW_REPO_ROOT 默认值或注释)
- `deck-go/.env.real-stack.example` — RUNTIME*BUNDLED*\* 替换为新的 install/start 配置
- `deck-go/.env.remote.example` — 本 change 不动
- `deck-go/scripts/dev/run-bundled.sh` → `run-local.sh`
- `deck-go/scripts/dev/run-stack-real.sh` — 先 install + start 再启 BFF + Vite

**Affected tests**:

- `deck-go/test/e2e/bundled.spec.ts` + `remote.spec.ts` → 合并 `mock.spec.ts` (或保留两份, design.md 决定)
- `deck-go/test/e2e/real-gateway.spec.ts` — fixture setup 改为 install + start, 加 cleanup `gateway uninstall`
- `deck-go/test/e2e/*-real-gateway.spec.ts` — 同上 fixture 改动
- `deck-go/test/fixtures/mock-gateway.mjs` — 启动方式改为 fixture 独立 spawn

**Affected docs**:

- `deck-go/AGENTS.md` "Architecture" / "Runtime And Dev Scripts" 段
- `deck-go/CLAUDE.md` — 同上 (重复内容)
- `deck-go/docs/project/e2e-stack-operations.md` — 完整重写 install/start 路径
- 本仓库根 `CONTEXT.md` — Phase 3 grill log 已沉淀, 本 change 不再额外改

**Affected upstream-sync**:

- `.agents/skills/deck-upstream-sync/SKILL.md` — 路径常量从 `internal/runtime/bundled/supervisor.go` 改为新结构 (实际上多数 supervisor 文件直接删除, sync 路径表瘦身)

**Risks**:

- 多 fork 同机器装 launchd service 名冲突 → per-repo-hash service 名 + `gateway uninstall` cleanup 兜底
- Repo 目录移动后 plist 失效 → 启动时 health check 比对路径, 不一致提示 reinstall
- canvas A2UI 资产归宿 — design.md D5 已决 (Gateway-served at source + BFF 反向代理路由 `/api/runtime/gateway-assets/*`, 保持三层边界); 实施时 BFF 路由是 thin pipe (~50 LOC), Gateway-side 路由作为新 HTTP surface 单独 PR 描述 tradeoff (不走 R1 type-2, 因 R1 严格定义为 `deck.*` RPC)
- Rule R3 在 Gap 4 (real E2E install 隔离) 实施时容易违反 — 任何"E2E-only spawn shortcut" 提议必须 reject
- Stage 2 contract 改动 + Stage 3 E2E 改动并行可能引入 schema drift → 严格执行 `make contract-gate` + `make protocol-check`
- 用户已运行的旧 bundled 模式 deck-go 实例需要迁移路径: 卸载旧 launchd plist (如有) + 重装新 service 名

**Non-Scope (推到 change 2 `runtime-mode-switching`)**:

- 运行时 mode 切换 (facade swap interface + BFF `/api/runtime/connect` endpoint)
- frontend mode toggle UI + remote endpoint 输入 form
- 持久化 store (`deck-state.json` 扩展记住"上次连什么")
- 切到 remote 时本地 Gateway 保持运行的连接迁移 / SSE/WS 优雅迁移

**Design 哲学锚定 (拒绝 scope creep)**:

唯一两个目标 — ensure 可用 + 生命周期可控. 不做监控 dashboard / 升级管理 / token rotation / log aggregation / multi-Gateway / wizard / 任何"看着酷但跟这两个目标无关"的 feature.
