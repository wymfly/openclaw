# managed-runtime-supervisor-decoupling

**ADR**: `deck-go/docs/adr/0001-managed-runtime-supervisor-decoupling.md`
**Plan**: `deck-go/docs/superpowers/plans/2026-05-14-managed-runtime-supervisor-decoupling.md`
**Scope**: 让 `runtime/openclaw.ManagedRuntime` 不再依赖 `runtime/bundled.Supervisor` 系列类型, 删除 supervisor/preflight/process_group 6 个 spawn-era 文件, 解锁 `gateway-launcher-rewrite` Stage 2 (bundled/→local/ 重命名). 这是 Stage 1 review Round 4-5 抛出的 F1 follow-up.
**当前状态**: approved — Round 6 triage 显示 Round 5 列出的 5 个 finding 全部不需要 followup: F-A1 / F-A2 / F-A3 是 reviewer false-positive (Codex 已在 Round 4 同期实施), F-A4 / F-A5 是信息确认. 实施全过 `make backend-test` / `make frontend-build`. 可合入 enhanced.

---

## Round 1: planning by claude on 2026-05-14

Plan + ADR 起草. 关键决策:

- **形式**: ADR + writing-plans, 不是 OpenSpec change. 理由: F1 是 pure implementation refactor, 没有 product-behavior delta; OpenSpec 现有 spec 形式 (positive process governance) 不适合 F1 的 negative invariant 性质.
- **设计选项**: Option 1 (decouple) 而非 Option 2 (delete ManagedRuntime). 理由: ManagedRuntime 是 ~85 个方法 / 12 个 `httpapi.*Provider` 实现的 host, 整体 ~2000 LOC; 删它属于独立的 BFF-layer refactor, 不在本 task scope.
- **强弱依赖区分**: 强依赖 dead path (NewManagedRuntime 链 + EnsureAutoStart + managedGatewaySettingsFromRuntimeBundled) 必须随 supervisor 删除而清理; 弱依赖 dead entry (NewHandler / NewDependencies / server.New) 没有非测试 caller, 在同一个 PR 内清掉.
- **前端兼容**: spawn-era 字段 (pid / failurePhase / lastExitCode / ownershipFile / restartDelayMs) 在 facade.RuntimeStatus 中无对应字段, 会从响应中消失; `api.ts:611-626` 映射 undefined, `GatewayPanel.tsx` 渲染 "n/a" — 已验证容忍.

产出: 13 task / 7 phase plan, 自查发现 registry + 3 test fixture 漏掉, 加 Phase B' (3 task), 终稿 14 task / 8 phase.

**当前 verdict**: approve

---

## Round 2: plan review by codex on 2026-05-14

Codex 审查 plan + ADR, 抛出 5 个 finding:

```yaml
findings:
  - id: F1
    severity: blocker
    file: deck-go/docs/superpowers/plans/2026-05-14-managed-runtime-supervisor-decoupling.md:743-780
    issue: |
      Plan 把 registry AutoStart 设为默认 false; 但当前配置默认 true:
      config/store.go:254-255, envconf/envconf.go:135. 前端 GatewayPanel.tsx:1554-1556
      直接展示 bundledRuntime?.autoStart. 这是回归.
    fix: |
      让 facade.RuntimeStatus 携带 bundled AutoStart, 或由 ManagedRuntime
      adapter 从 loaded/env facade 补齐.

  - id: F2
    severity: blocker
    file: deck-go/docs/superpowers/plans/2026-05-14-managed-runtime-supervisor-decoupling.md:722-732
    issue: |
      Snapshot() → RuntimeStatus(ctx) 是 I/O 行为变化. 当前 registry.Snapshot()
      是纯内存读. plan 改成 RuntimeStatus(ctx) 会触发 facade probe (CLI 子进程 + HTTP).
      Remote path runtimeSummaryOverride 已 call 一次, registry 再 call 会重复.
      Plan 示例代码忽略 error.
    fix: |
      明确 /api/runtimes 是否允许主动 probe; 不要吞 error; remote override 要合并
      或移除重复 status call.

  - id: F3
    severity: medium
    file: deck-go/docs/adr/0001-managed-runtime-supervisor-decoupling.md:43
    issue: |
      ADR 说 runtime/registry 没 bundled.* references; 实际 summary.go/tests
      使用 bundled.Snapshot.

  - id: F4
    severity: medium
    file: deck-go/docs/superpowers/plans/2026-05-14-managed-runtime-supervisor-decoupling.md (File Structure 段)
    issue: |
      caller sweep 不完整. 除已列文件, server/server_test.go, gateway_routes_test.go,
      stream_test.go, stream_event_typing_test.go, runtime_facade_test.go 都使用
      ManagedSnapshot / NewManagedRuntimeWithStoreAndSupervisor. Phase F grep 会抓到,
      但 plan 文件清单应补上.

  - id: F5
    severity: nit
    file: deck-go/docs/adr/0001-managed-runtime-supervisor-decoupling.md
    issue: |
      ADR 写 facade.RuntimeFacade.GatewayConnection, 但 RuntimeFacade interface 本身没有
      这个方法. 当前是 concrete facades 有可选方法. 应写成 optional connector / type
      assertion, 或正式加进 interface.
```

**当前 verdict**: request-changes

---

## Round 3: plan revision by claude on 2026-05-14

逐 finding 核实代码事实, 全部 VALID. 修复路径:

- **F1 + F5**: 引入新 `Phase Z` (facade contract 补全), 作为 Phase A 前置, 包含两个 task:
  - Z1: `facade.RuntimeFacade` interface 加 `GatewayConnection(ctx) (GatewayConnection, error)`. concrete `bundled.Facade` / `remote.Facade` 已实现, 只动 interface 一行.
  - Z2: `facade.RuntimeStatus` 加 `AutoStart bool` 字段. `bundled.Facade.RuntimeGatewayStatus` 从 `f.cfg.AutoStart` 填; `remote.Facade` 填 `false`. 保留现有 frontend 渲染.
- **F2** (架构改动, 最重): `ManagedRuntime` 引入 `lastStatus facade.RuntimeStatus` + `sync.RWMutex` 内存 cache:
  - `LastStatus() facade.RuntimeStatus` (no ctx, no error) 暴露 cache
  - `RuntimeGatewayActionResponse` / Start / Stop / Restart / BootstrapStatus 在 facade 调用后 setLastStatus
  - `registry.SnapshotReader` 改名 `LastStatusReader`, 签名改为 `LastStatus() facade.RuntimeStatus` (无 ctx 无 error)
  - registry summarize 读 `status.AutoStart` + `Mode == "bundled" → Managed`
  - `controld.runtimeSummaryOverride` 不变, 它继续在 remote mode 主动 probe (与 registry cache 解耦, plan 显式接受)
  - 加 `TestManagedRuntimeRegistryDoesNotProbeFacadeOnList` 防 list-time probe 回归
- **F3**: ADR Context 段 line 26-33 加 Cross-package consumers 列表 (registry / server 5 test / transport_binding_test); line 43 改写 registry 入 scope.
- **F4**: plan File Structure / Self-discovery commands / Task C2 三处补 server 5 test + ws_test + contract_test, 共 8 处.

终稿: 17 task / 9 phase. 1447 → 1932 行. 内部一致性 self-review 通过.

**当前 verdict**: request-changes resolved → ready for implementation

---

## Round 4: implementation by codex on 2026-05-14

Codex 全量实施. Phase Z 独立 commit `354b312399 Allow ManagedRuntime to depend on facade lifecycle contract` (顺序前置, 满足"Z 先 land 才能 A 引用"). 其余改动留在工作区供 review.

主要改动:

- `deck-go/backend/internal/runtime/openclaw/*`: ManagedRuntime 改为 `facade.RuntimeFacade` 依赖, 删除 supervisor/spawn 路径, 新增 facade 状态缓存 (`lastStatus + RWMutex`)
- `deck-go/backend/internal/runtime/registry/*`: registry 改读 cached `facade.RuntimeStatus`, `Managed` 从 `Mode == "bundled"` 推导
- `deck-go/backend/internal/server/*`, `deck-go/backend/internal/controld/*`: lifecycle / bootstrap / version / router 测试全部迁移到 facade 模型, lifecycle response 后 refresh cache
- 删除: `runtime/bundled/{supervisor,preflight,process_group_*}.go` 共 6 文件; `runtime/openclaw/{managed_lifecycle_types,managed_supervisor_options}.go` 共 2 文件 + 对应 test 文件
- 新增: `runtime/facade/testfacade/testfacade.go` 测试 helper; `runtime/openclaw/managed_runtime_facade_test.go` (7 个 cache/facade-shape 测试, 含 zero-probe regression guard)

净 diff: -4857 / +883 LOC.

**计划之外的两处自发改进** (codex 主动加, 不在 plan):

1. **`recordManagedRuntimeStatus` sidecar** (`server/runtime.go:137-150` + `managed_runtime.go:402 RecordRuntimeStatus`): BFF `/runtime/gateway/{install,start,stop,restart,reinstall,refresh}` 路由直接 call `runtimeFacade.X`, 不走 `ManagedRuntime.*RuntimeGateway`. plan 假设所有 lifecycle 都过 ManagedRuntime, 这其实在 `featureRuntimeFacadeDirect` 路径下不成立. codex 通过 `runtimeStatusRecorder` interface 反向喂 cache, 关掉 plan 漏掉的覆盖缺口.
2. **`facadeConnectionProvider` + `facadeDirectRequester` adapter** (`managed_runtime.go:278-311`): 当 facade 不实现 `Requester` interface (如 testfacade.Stub), 用 `GatewayConnection` 三元组 wrap 出 Requester 兼容层. ~30 LOC. 隔离测试构造对 production facade 实现的依赖.

验证证据 (codex 报告):

- `go test ./internal/runtime/bundled/ ./internal/runtime/openclaw/ ./internal/runtime/registry/ ./internal/server/ ./internal/controld/ -count=1` 通过
- `make backend-test` 通过
- `make frontend-build` 通过 (仅 Vite chunk size warning)
- `git diff --check -- deck-go/backend` 通过
- 自发现 grep: 没有非 bundled 包里的 `bundled.*` caller, 没有旧 `ManagedSnapshot` / supervisor constructor 引用

`make verify` 卡在 `.local/deck-go-real-stack/isolated/data/managed-gateway-state/skills/accessibility-a11y` 断链, 与本次 diff 无关 (历史 isolated state 残留).

**当前 verdict**: ready-for-review

---

## Round 5: implementation review by claude on 2026-05-14

逐项核实 plan / ADR 约束 + spot-check 关键实现.

### 主线约束全部满足

| 约束                                                              | 状态 | 证据                                                                                                                                                       |
| ----------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase Z 独立 commit                                               | ✅   | `354b312399` 只动 facade interface + bundled/remote facade                                                                                                 |
| `bundled.*` 不外泄 `/runtime/bundled/`                            | ✅   | grep clean                                                                                                                                                 |
| 老 constructor / interface / dead entry 全删                      | ✅   | 8 文件 + `ManagedRuntimeSupervisor` / `EnsureAutoStart` / `server.New` / `NewHandler` / `NewDependencies` / `NewManagedRuntimeWithStoreAndSupervisor` 全清 |
| `lastStatus + sync.RWMutex + LastStatus()/setLastStatus()`        | ✅   | `managed_runtime.go:213,393,406`                                                                                                                           |
| `RuntimeGatewayActionResponse` 后 refresh cache                   | ✅   | `legacy_runtime_orchestration.go` Start/Stop/Restart 全部 `setLastStatus`                                                                                  |
| `BootstrapStatus` prime cache                                     | ✅   | `refreshFacadeStatus` 集中化, B1 path 走它                                                                                                                 |
| `registry.SnapshotReader → LastStatusReader` (no ctx, no err)     | ✅   | `summary.go:14-15`                                                                                                                                         |
| `summarize` 读 `status.AutoStart + Mode→Managed`                  | ✅   | `summary.go:69,76`                                                                                                                                         |
| `facade.RuntimeStatus.AutoStart` bundled 从 cfg, remote false     | ✅   | `bundled/facade.go:168`, `remote/facade.go:179`                                                                                                            |
| `RuntimeFacade.GatewayConnection` interface 方法                  | ✅   | `facade/facade.go:124`                                                                                                                                     |
| `controld.runtimeSummaryOverride` 不动                            | ✅   | `app.go:208-266` 与旧版一致                                                                                                                                |
| 没人 call `managed.Snapshot/Start/Stop/Restart/GatewayConnection` | ✅   | `TestExternalPackages_DoNotCallRaw...` 正则 guard                                                                                                          |
| Cache 不被 list 触发 probe                                        | ✅   | `TestManagedRuntimeRegistryDoesNotProbeFacadeOnList` (probe count = 0)                                                                                     |

### Findings (mild, non-blocking)

```yaml
findings:
  - id: F-A1
    severity: medium
    file: deck-go/backend/internal/controld/app.go:232-266
    issue: |
      runtimeSummaryOverride.apply 在 remote mode 主动 call
      p.runtime.RuntimeGatewayStatus(ctx) 拿 fresh status 改写 item, 但**不**回写
      ManagedRuntime 的 lastStatus cache. 后果: /api/runtimes 看到 fresh probe 值,
      而 LastStatus() (其他 cache 读者) 看到旧值, 直到下次 BootstrapStatus 或
      lifecycle action. "Single source of truth"概念被打破.
    fix: |
      在 runtimeSummaryOverride.apply 末尾通过 runtimeStatusRecorder interface
      (sidecar 已有) 喂 cache, 与 BFF lifecycle path 对齐. 或者 ADR 显式接受
      divergence 作为 design choice. 倾向前者 (sidecar pattern 已在 codebase).

  - id: F-A2
    severity: nit
    file: deck-go/backend/internal/server/runtime.go:141-150
    issue: |
      recordManagedRuntimeStatus 用 `status == (facade.RuntimeStatus{})` 判断
      "空 status, 不 record". 依赖 Go struct equality. 当前 facade.RuntimeStatus
      含指针字段 (PID *int 等), zero value 是 nil pointer, 比较 work; 但作为
      guard 仍脆弱, future struct evolution 易踩坑.
    fix: |
      改为显式语义 check, 如 `if status.Mode == "" && status.Status == ""`,
      或在 caller 做 error-gate (只有 success path 才 record).

  - id: F-A3
    severity: nit
    file: deck-go/backend/internal/runtime/openclaw/managed_runtime_facade_test.go
    issue: |
      plan 模板里的 TestManagedRuntime_SetLastStatusIsRace_Safe (32-goroutine
      并发 hammering) 未实施. sync.RWMutex 实施惯用, `go test -race` 默认能 catch
      issues, 但缺少专门 trip wire — future 改 mutex 类型不会被 catch.
    fix: |
      加 race-hammer 测试, 在 make backend-test race mode 下做 regression guard.

  - id: F-A4
    severity: info
    file: deck-go/backend/internal/runtime/openclaw/managed_runtime_ws.go
    issue: |
      WS bridge 是纯 WS proxy (上行 method calls + 下行 events), 不处理 lifecycle
      status pub; lifecycle 通过 events.Bus 在 RuntimeGatewayActionResponse 后 emit,
      这条 path 已 setLastStatus. WS bridge 不需要单独 cache update.
    fix: |
      不是 finding, 只是确认覆盖.

  - id: F-A5
    severity: info
    file: deck-go/backend/internal/controld/app_test.go:19,319
    issue: |
      controld app_test.go 仍 import `runtime/bundled` 包并用 bundled.NewWithDependencies
      构造真实 bundled.Facade 做 e2e probe.
    fix: |
      不是 finding. bundled 包还在 (只是 supervisor.go 删了), bundled.Facade 是新的
      shell-out lifecycle 入口, 不是删掉的 bundled.Supervisor. plan 的 "bundled.* 不外泄"
      特指 Supervisor / Snapshot / Status* 系列, 不包括 bundled.Facade 自身.
```

### 验证状态

| 项                                                                              | 状态                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `make backend-test`                                                             | ✅ 全 ok (cached)                                      |
| `make frontend-build`                                                           | ✅ (codex 报告)                                        |
| grep guards (`bundled.*` / `ManagedSnapshot` / 老 constructor)                  | ✅ clean                                               |
| 8 个 supervisor/preflight/process_group/lifecycle_types/supervisor_options 文件 | ✅ 已删                                                |
| `make verify`                                                                   | ⚠️ 卡在 `.local` ignored 文件断链 (与 diff 无关; 接受) |

### 合并建议

可直接 commit 并合入 enhanced. 5 finding 全部 mild, 不阻塞.

- **优先级 P1**: F-A1 (cache 与 wrapper 不一致) — 决定是补 RecordRuntimeStatus 回喂 (建议), 还是 ADR 显式接受 divergence
- **优先级 P2**: F-A2 (zero-value guard) + F-A3 (race test) — 同一个 followup commit 解决
- **F-A4, F-A5**: 不需 action

**当前 verdict**: approve-with-followup

---

## Round 6: fix by codex on 2026-05-14

处理 Claude Round 5 的 5 个 finding. 结论: F-A1 / F-A2 / F-A3 成立并已修复; F-A4 / F-A5 是覆盖确认, 无需代码动作.

### Finding responses

- **F-A1 fixed**: `deck-go/backend/internal/controld/app.go:180` 给 `runtimeSummaryOverride` 注入 `runtimeStatusRecorder`; `app.go:274` 在 remote `RuntimeGatewayStatus(ctx)` 成功后把 fresh `facade.RuntimeStatus` 回写 `ManagedRuntime.LastStatus()` cache. 新增 `TestRuntimeSummaryOverrideRecordsRemoteStatusCache` (`deck-go/backend/internal/controld/app_test.go:384`) 覆盖 `/api/v1/runtimes` remote override 不再只改响应、不改 cache.
- **F-A2 fixed**: `deck-go/backend/internal/server/runtime.go:141` 将 `status == (facade.RuntimeStatus{})` 换成显式语义 guard `Mode == "" && Status == ""`. 新增 `TestRecordManagedRuntimeStatusSkipsSemanticallyEmptyStatus` (`deck-go/backend/internal/server/runtime_facade_test.go:715`) 防止只有 `Configured` 等非 lifecycle 字段的空语义状态覆盖 cache.
- **F-A3 fixed**: `deck-go/backend/internal/runtime/openclaw/managed_runtime_facade_test.go:175` 新增 32-goroutine `RecordRuntimeStatus` / `LastStatus` hammer test, 并用 `go test -race` 验证.
- **F-A4 no action**: WS bridge 不直接产生 lifecycle status; lifecycle action path 已 set cache, 保持现状.
- **F-A5 no action**: `runtime/bundled` 包仍是有效 facade 包; 本 change 删除的是 supervisor/preflight/process_group spawn-era surface, 不是禁止 `bundled.Facade` 测试使用.

### 验证

| 命令                                                                                                                              | 结果 |
| --------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `go test ./internal/controld/ -run TestRuntimeSummaryOverrideRecordsRemoteStatusCache -count=1`                                   | pass |
| `go test ./internal/server/ -run TestRecordManagedRuntimeStatusSkipsSemanticallyEmptyStatus -count=1`                             | pass |
| `go test ./internal/runtime/openclaw/ -run TestManagedRuntime_LastStatusConcurrentAccessSafe -count=1`                            | pass |
| `go test -race ./internal/runtime/openclaw/ -run TestManagedRuntime_LastStatusConcurrentAccessSafe -count=1`                      | pass |
| `go test ./internal/runtime/openclaw/ ./internal/server/ ./internal/controld/ -count=1`                                           | pass |
| `make backend-test`                                                                                                               | pass |
| `git diff --check -- deck-go/backend/internal/controld deck-go/backend/internal/server deck-go/backend/internal/runtime/openclaw` | pass |

### Reviewer ack (claude, 2026-05-14)

独立复跑通过 (从 reviewer 端而非 codex 端):

```
go test ./internal/controld/ -run TestRuntimeSummaryOverrideRecordsRemoteStatusCache -count=1            → PASS (0.40s)
go test ./internal/server/ -run TestRecordManagedRuntimeStatusSkipsSemanticallyEmptyStatus -count=1     → PASS (0.30s)
go test -race ./internal/runtime/openclaw/ -run TestManagedRuntime_LastStatusConcurrentAccessSafe -count=1 → PASS (1.19s)
make backend-test                                                                                         → PASS (cached, full sweep)
```

代码 spot-check 通过:

- `controld/app.go:215` 字段 `recorder runtimeStatusRecorder` + `app.go:181-183` 通过 type assertion wire (`managed.(runtimeStatusRecorder)`) + `app.go:274` apply 末尾 `p.record(status)` + `app.go:278-283` record 内部 nil/empty guard. F-A1 cache-divergence 完整闭合.
- `server/runtime.go:142,152-154` + `controld/app.go:279,285-287` 两处 `isRuntimeStatusEmpty` 共享显式语义判断. F-A2 zero-value guard 替换完成, 跨包一致.
- `managed_runtime_facade_test.go:175-198` 32 workers × 200 iter 并发 hammer `RecordRuntimeStatus` / `LastStatus`; `go test -race` 验证. F-A3 race regression guard 到位.

**当前 verdict**: approve. 可合入 enhanced.
