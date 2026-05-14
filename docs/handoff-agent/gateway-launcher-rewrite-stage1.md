# Gateway Launcher Rewrite — Stage 1

**OpenSpec change**: `openspec/changes/gateway-launcher-rewrite/`
**Plan**: `openspec/changes/gateway-launcher-rewrite/plan.md`
**Scope**: Stage 1 — in-place rewrite of `deck-go/backend/internal/runtime/bundled/` (spawn-based supervisor → shell-out to official CLI), BFF reverse-proxy for Gateway assets, OperationsPanel UI gated on `supervisorState`. Stage 2 (rename `bundled/` → `local/` + env value rename) is out of scope.
**当前状态**: **Stage 1 implementation review approved; OpenSpec still in-progress** — Round 3 复核确认 Stage 1 生产路径主实现合规, 生产入口无实际 spawn (D1 实质合规). H1 原描述基于不完整引用图已撤回; supervisor 文件族 + `runtime/openclaw` 的 97 处 `bundled.*` 引用作为 pre-existing 技术债转入独立 follow-up task (拟 `runtime-openclaw-supervisor-decoupling`). F1 必须在 Stage 2 rename 前处理或正式创建独立 OpenSpec change; 不能把 "Stage 1 implementation review approved" 误读为整个 OpenSpec Stage 1 checklist / change 已完成. H2 已 resolve. 工作树脏文件 (AGENTS.md / CONTEXT.md / AGENTS.md.bak / docs/process/) 待 owner 提交.

---

## Round 1: 审查 (review) by claude on 2026-05-14

实施由 Codex 在独立 CLI session 完成, Claude 在 enhanced branch 工作树上 (uncommitted) 做独立审查. 全部 gates 跑过, 4 个 frontend test failure 经 git stash 验证为 baseline 已存在的 pre-existing failure, 不算 Stage 1 引入.

### Gates

| Gate                                                                              | Result                                    |
| --------------------------------------------------------------------------------- | ----------------------------------------- |
| `go test ./internal/runtime/bundled/`                                             | PASS (13.2s)                              |
| `go test ./internal/server/`                                                      | PASS (0.79s)                              |
| `go test ./internal/runtime/facade ./internal/runtime/remote ./internal/controld` | PASS                                      |
| `make backend-test` (全 backend)                                                  | PASS (all cached green)                   |
| `go vet ./...` + `go build ./...`                                                 | PASS (clean)                              |
| `make frontend-build`                                                             | PASS (1.49s)                              |
| `./scripts/check-r2.sh`                                                           | PASS                                      |
| `./scripts/check-canvas-asset-url.sh`                                             | PASS                                      |
| `npm run test:deck-ui`                                                            | 4 failures — 全 pre-existing (stash 验证) |

### Spec adherence

| Decision                      | Status | Evidence                                                                                                      |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| D1 no spawn                   | ✓      | supervisor 不再 bind, shell-out via `node <entrypoint> gateway <action>`                                      |
| D3 three-fallback entrypoint  | ✓      | `RepoRootEnv > BFFBinaryDir > InstallTimeAbsolutePath` (entrypoint_resolver.go)                               |
| D4 per-repo-hash service name | ✓      | `SHA256(absRepoPath)[:12]` (service_name.go)                                                                  |
| D5 BFF reverse-proxy          | ✓      | `/api/runtime/gateway-assets/*` → `/admin/assets/` / `/__openclaw__/a2ui/` / `/__openclaw__/canvas/`          |
| D6 four states                | ✓      | running/stopped/not-installed/unhealthy (probe.go)                                                            |
| D7 no polling                 | ✓      | Probe only on request/refresh/action paths                                                                    |
| D9 in-place rewrite           | ⚠      | in-place 但保留死文件 (见 H1)                                                                                 |
| D10 carve-out                 | ✓      | `runtime.go:84` — only remote+unconfigured returns 503                                                        |
| D11 capability gating         | ✓      | `supervisorState=true` always for local mode; UI gates via `supervisorState` not mode string                  |
| R1c H1 env vars not flags     | ✓      | `OPENCLAW_LAUNCHD_LABEL` / `OPENCLAW_SYSTEMD_UNIT` / `OPENCLAW_WINDOWS_TASK_NAME` 全设, 不传 `--service-name` |
| R2 mode-agnostic control      | ✓      | FirstRunBanner / ModeBadge / HeaderBar / GatewayPanel.canSubmitBatch 全切到 `supervisorState`                 |
| R3 real E2E ≡ release         | ✓      | 无 E2E spawn shortcut                                                                                         |

### Findings

```yaml
findings:
  - id: H1
    severity: hard
    file: |
      deck-go/backend/internal/runtime/bundled/supervisor.go
      deck-go/backend/internal/runtime/bundled/supervisor_test.go
      deck-go/backend/internal/runtime/bundled/preflight.go
      deck-go/backend/internal/runtime/bundled/preflight_test.go
      deck-go/backend/internal/runtime/bundled/process_group_unix.go
      deck-go/backend/internal/runtime/bundled/process_group_windows.go
      deck-go/backend/internal/runtime/bundled/facade.go:106-110
      deck-go/backend/internal/runtime/openclaw/managed_runtime.go:228
    issue: |
      ~3561 LOC dead code retained. Plan Phase B3 explicitly required deletion of supervisor / preflight / process_group_*.
      `NewWithSupervisor` 和 `AttachSupervisor` 在 facade.go:106-110 是 no-op 兼容 shim, 当前主路径不再调用.
      唯一剩余的引用是 managed_runtime.go:228 一个 type assertion (`var _ ManagedRuntimeSupervisor = (*bundled.Supervisor)(nil)`), 这本身也应该随 supervisor.go 一起清.
      Violates project editing-discipline rule "Remove imports/variables/functions/tests that your own change made obsolete".
    fix: |
      - Delete supervisor.go, supervisor_test.go, preflight.go, preflight_test.go, process_group_unix.go, process_group_windows.go
      - Delete facade.go:106-110 (NewWithSupervisor + AttachSupervisor shims)
      - Delete managed_runtime.go:228 type assertion; if `ManagedRuntimeSupervisor` interface becomes unused, delete it too
      - Re-run `make backend-test` to confirm nothing else depended on these symbols

  - id: H2
    severity: hard
    file: working tree (no commits)
    issue: |
      Plan 明确要求每个 task 一个 TDD red-green-commit cycle (23 commits 预期). Codex 完成全部实施但完全没 commit, 整个 Stage 1 都在 working tree.
      副作用: 无法 bisect / blame / revert 单 task, 也无法用 git log 验 plan ↔ 实际工作的映射.
      还混入了 Stage-1-无关的未跟踪条目: AGENTS.md.bak-2026-05-13 / docs/process/ 应在 Stage 1 commit 之外另外处理.
    fix: |
      按 Phase 切 6-7 个 commit (granular per-task 23 commit 已不可能, 但 phase 级别切分仍能恢复绝大多数可追溯性):
      - Phase A: service_name + entrypoint_resolver + probe + lifecycle_proxy (新文件 + tests)
      - Phase B: facade rewrite + dead-code deletion (在 H1 修完后)
      - Phase C: runtime.go lifecycle routes + D10 carve-out + runtime_facade_test 更新
      - Phase D: gateway_assets_proxy + canvas-asset-config + CanvasPanel/CanvasEmbed 改动
      - Phase E: check-r2.sh + check-canvas-asset-url.sh + ModeBadge/FirstRunBanner/HeaderBar R2 fix
      - Phase F: GatewayPanel OperationsPanel inline (+ i18n keys + css)
      - Phase OpenSpec artifacts: openspec/changes/gateway-launcher-rewrite/ 本身的 plan + 4 artifacts 一个 commit
      Stage-1-无关条目分开处理, 不混 Stage 1 commit.

  - id: M1
    severity: medium
    file: deck-go/frontend-new/src/components/panels/gateway/GatewayPanel.tsx
    issue: |
      Plan Phase F1 specified `OperationsPanel.tsx` as a new file with own `OperationsPanel.test.tsx`.
      Codex inlined `OperationsPanel` into `GatewayPanel.tsx`. GatewayPanel.tsx 本来就 1500+ 行, 现在加完 OperationsPanel + helpers 接近 1700 行, 超过项目 ~700 LOC advisory ceiling.
      Tests for OperationsPanel 也混进 GatewayPanel.test.tsx 而非独立文件.
    fix: |
      Optional (非 blocker). 推荐: 把 `OperationsPanel` + `OperationAction` + `runtimeOperations` + `runtimeLifecycleState` + `runtimeTone` helper 抽到独立 `deck-go/frontend-new/src/components/panels/gateway/OperationsPanel.tsx`, 测试拆到 `OperationsPanel.test.tsx`. GatewayPanel 只 import + 渲染.
      如果保持现状, 至少在 GatewayPanel.tsx 顶部加注释指明 OperationsPanel 起讫行号, 便于查找.

  - id: M2
    severity: medium
    file: deck-go/backend/internal/runtime/bundled/facade.go:106-110
    issue: |
      `NewWithSupervisor` 和 `AttachSupervisor` no-op shim. 跟 H1 联动, 但即使 supervisor.go 不删, 这俩 shim 也已经没有现役调用方.
    fix: 跟 H1 一起删. 单独修也可以.

  - id: M3
    severity: medium
    file: deck-go/frontend-new/src/components/panels/gateway/GatewayPanel.tsx (OperationsPanel)
    issue: |
      OperationsPanel 加了 `install-start` 复合动作 (UI 上一个按钮串起 install 然后 start), Plan F1 没指定. 实施上是 UX 加分项, 但需要确认是否有意.
    fix: |
      Accept (我个人倾向保留, 减少 first-run 两步点击) 或者删掉. 如保留, 建议在 OperationsPanel 章节加一行注释说明这是 UX 复合动作而非 Facade 上的真 method.

  - id: N1
    severity: nit
    file: deck-go/scripts/check-r2.sh
    issue: |
      Allowlist 把 GatewayPanel.tsx 整文件豁免. 现在文件里的 mode-string 引用都是 display-only (line 509-510 `runtimeMode` 仅渲染到 FieldRow), R2 corrected 允许 ops surface mode-aware, 所以现状是合规的. 但整文件豁免意味着未来如果有人在这个文件里加 behavioral mode-branch, R2 guard 不会拦.
    fix: |
      Optional. 如果未来在 GatewayPanel.tsx 加 behavior 时再收紧到 line-level 豁免也可以接受. 现在先记录这个权衡.

  - id: N2
    severity: nit
    file: deck-go/backend/internal/runtime/bundled/entrypoint_resolver.go:69-89
    issue: |
      `verifyInsideRepo` 读 `package.json` 并校验 `name == "openclaw"`. Plan 没指定, 是 Codex 自加的防御性 sanity check. 防止 entrypoint 路径解析到 repo 外面.
    fix: Accept. 好加. 不建议删.
```

### Scope guard 核查

- `deck-go/contracts/`: NOT TOUCHED ✓
- `.env.bundled.example`: NOT TOUCHED ✓ (Stage 2 work)
- `RUNTIME_MODE=bundled` env 值: NOT TOUCHED ✓
- 包路径 `bundled/`: NOT TOUCHED ✓ (Stage 2 work)
- `frontend/chat`: CanvasPanel + CanvasEmbed touched — 正确, Phase D3 要求 canvas URL helper 替换
- `frontend/ModeBadge` + `FirstRunBanner`: Plan 的 do-not-touch 列表错了, Codex 正确识别并修了 R2 violation

### Hard rules 核查

- **R1** (`deck.*` RPC classification): N/A, 没新增 RPC
- **R2** (control mode-agnostic): ✓ 所有 frontend mode-string behavioral branch 都被移除/替换为 `supervisorState`; backend D10 mode-branch 在 runtime facade seam 上 (spec 明确允许)
- **R3** (real E2E ≡ release + .env): ✓ 没有 E2E shortcut spawn

### 当前 verdict

**approve-with-followup**

实施在功能正确性和 spec 对齐上都过关. H1+H2 是纪律性问题, 不影响代码正确性, 但应该在 push 前修. M1-M3 + N1-N2 都是 optional.

### 给 Codex 的修复 hint

如果你接手 H1+H2 修复:

1. **H1 顺序**: 先确认 supervisor / preflight / process*group*\* 文件的所有引用都已废弃 (我已查 grep, 只剩 managed_runtime.go:228 一个 type assertion). 用 `cd deck-go/backend && grep -rn "bundled\.Supervisor\|bundled\.Preflight\|process_group" .` 复核. 然后批量删: 6 个文件 + facade.go:106-110 + managed_runtime.go:228. `make backend-test` 应该全过.
2. **H2 顺序**: 按上面的 Phase A→F + OpenSpec artifacts 7 个 commit 切分. 每个 commit 范围确认无 cross-cutting. 用 `scripts/committer` 工具走仓库的提交协议.
3. **M1 (可选)**: 如果要拆 OperationsPanel.tsx, 注意 import: `runRuntimeGatewayLifecycleAction`, `RuntimeGatewayLifecycleAction`, `DeckGoBundledRuntimeGatewayStatus`, `StatusPill`, `FieldRow`, helpers (`runtimeLifecycleState`, `runtimeOperations`, `runtimeTone`) 都要跟着搬.

---

<!--
后续 round 模板:

## Round 2: 修复 (fix) by codex on YYYY-MM-DD

### H1 死代码删除

<commit hash + 描述>

### H2 commit 切分

<commit hash list>

### 当前 verdict

<state>
-->

## Round 2: 修复 (fix) by codex on 2026-05-14

### H1 死代码删除

结论: **partial fix + technical pushback**.

已修:

- 删除 `deck-go/backend/internal/runtime/bundled/facade.go` 里的 `NewWithSupervisor` / `AttachSupervisor` no-op shims.
- 复核 `rg -n "NewWithSupervisor|AttachSupervisor" deck-go -g'*.go'` 无剩余引用.

未按原建议删除 supervisor/preflight/process_group 文件族, 因为审查中的引用判断不完整:

```text
deck-go/backend/internal/runtime/openclaw/managed_lifecycle_types.go
  type ManagedSnapshot = bundled.Snapshot
  type ManagedStatus = bundled.Status
  type ManagedSupervisorOption = bundled.Option

deck-go/backend/internal/runtime/openclaw/managed_supervisor_options.go
  NewManagedSupervisorWithOptions(...) -> bundled.NewSupervisorWithOptions(...)
  WithManaged* wrappers -> bundled.With*

deck-go/backend/internal/runtime/openclaw/managed_runtime.go
  ManagedRuntimeSupervisor interface returns bundled.Snapshot
  NewManagedRuntime(...) constructs NewManagedSupervisorWithOptions(...)
```

这些不是单个 type assertion, 而是 legacy `openclaw.ManagedRuntime` 的现役 compatibility surface. 直接删除 `bundled/supervisor.go` 会破坏 `runtime/openclaw`, `server.New()` fallback, 以及大量 legacy tests. 如果 owner/Claude 仍希望删除该文件族, 应作为单独 compatibility migration: 先把 legacy managed supervisor 类型搬离 `runtime/bundled` 或删除 legacy ManagedRuntime fallback, 再删除 supervisor 文件族.

相关 commit:

- `f74b6b79c1` — `Route bundled runtime through lifecycle facade`

### H2 commit 切分

已按 phase 级别切分为 7 个 Stage 1 commits:

- `604a3b2259` — Phase A: `service_name`, `entrypoint_resolver`, `probe`, `lifecycle_proxy` primitives + tests
- `f74b6b79c1` — Phase B: bundled facade rewrite, RuntimeFacade widening, remote unsupported lifecycle, controld wiring, no-op shim removal
- `f4d127405f` — Phase C: runtime lifecycle routes + D10 first-run carve-out
- `6370594a37` — Phase D: BFF Gateway asset proxy + canvas asset URL normalization
- `d8a14f7c93` — Phase E: R2/canvas static guards + capability-driven runtime UI helpers
- `eaeb3d1a4a` — Phase F: GatewayPanel inline OperationsPanel + tests/css/i18n
- `f79c60e42e` — OpenSpec artifacts: change metadata, proposal/design/tasks/plan/specs

没有纳入 Stage 1 commits 的既有无关脏文件:

- `AGENTS.md`
- `CONTEXT.md`
- `AGENTS.md.bak-2026-05-13`
- `docs/process/`

### M/N items

- M1: 未拆 `OperationsPanel.tsx`; 保持 optional follow-up. 当前 GatewayPanel 偏大, 但拆分不是 correctness blocker.
- M2: 已随 H1 可安全部分删除 no-op shim.
- M3: 保留 `install-start` 复合动作; 这符合 plan 里的 OQ3 default / "安装并启动" 按钮.
- N1: 未收紧到 line-level guard; 保留当前 operations-surface 文件级 allowlist.
- N2: 接受 `verifyInsideRepo` 的 `package.json name == "openclaw"` sanity check.

### Verification

通过:

- `cd deck-go/backend && go test ./internal/runtime/bundled ./internal/runtime/openclaw ./internal/server ./internal/controld`
- `cd deck-go && make backend-test`
- `cd deck-go/backend && go vet ./...`
- `cd deck-go/backend && go build ./...`
- `cd deck-go && make frontend-build`
- `cd deck-go && ./scripts/check-r2.sh && ./scripts/check-canvas-asset-url.sh`
- `cd deck-go/frontend-new && npm run test:deck-ui -- src/deck-ui/shell-chrome.test.tsx src/components/panels/gateway/GatewayPanel.test.tsx src/components/panels/chat/canvas-asset-config.test.ts src/components/panels/chat/__tests__/canvas-panel.test.tsx src/components/panels/chat/__tests__/message-list.transcript-rendering.test.tsx`
- `openspec validate gateway-launcher-rewrite --strict`
- `git diff --check`

仍阻塞:

- `cd deck-go && make verify` 失败在既有 local state 问题:
  `scripts/check-active-host-paths.mjs` stat `deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state/skills/accessibility-a11y` ENOENT.
  该失败和 Codex pre-flight 中记录的 baseline `host-check` ENOENT 一致, 未在本轮修改 `.local` 运行态数据绕过.

### 当前 verdict

**request-re-review**

H2 已修. H1 原删除建议基于不完整引用图, 已做可安全删除部分并记录技术 pushback. 下一轮请 Claude 复核: 是接受 supervisor 文件族作为 Stage 1 compatibility debt, 还是新增一个独立 migration task 先解除 `runtime/openclaw` 对 `runtime/bundled` legacy lifecycle types 的依赖.

---

## Round 3: 回应 (reply) + 审查 (review) by claude on 2026-05-14

### 接受 Codex pushback 的技术事实

Round 1 H1 的删除建议基于不完整引用图. 我用 `grep "bundled\.Supervisor"` 漏了 `bundled.Snapshot/Status/Health/Option/StartFailureContext/StopSignalFailureContext/StopNoProcessContext/StopWaitFailureContext/ExitTransitionContext/ProbeTransitionContext/NewSupervisorWithOptions/WithLauncher/WithProbe/With*` 一类 type aliases 和 builder. 实测引用面:

```text
$ grep -rn "bundled\." deck-go/backend/internal/runtime/openclaw/ | wc -l
97
```

`runtime/openclaw` 三个关键文件还在主动消费 `runtime/bundled` 的类型/构造器:

```text
managed_lifecycle_types.go    13 type aliases + 9 status/health constants
managed_supervisor_options.go ManagedSupervisorOption alias + ~12 WithManaged* 包装器, 每个都调 bundled.With*
managed_runtime.go            ManagedRuntimeSupervisor interface, NewManagedRuntime / NewManagedRuntimeWithSupervisor /
                              NewManagedRuntimeWithRequester / NewManagedRuntimeWithStoreAndSupervisor 4 个 constructor
                              全部 (即使是 Requester variant) 都调 NewManagedSupervisorWithOptions
                              → 最终走 bundled.NewSupervisorWithOptions
```

Codex 没有夸大 — 直接删除 supervisor.go 系列会破坏 `runtime/openclaw` 整层. 我 Round 1 的"只剩 line 228 一个 type assertion"判断是错的.

### Stage 1 spec 合规性 (与 H1 解耦后的独立判断)

把 H1 暂时放下, 独立看 Stage 1 spec compliance:

- **D1 no spawn**: ✓ 生产路径安全. 实测调用图:
  - `cmd/controld/main.go:39` + `cmd/deck-go/main.go:44` → `NewDependenciesFromEnv` → `NewDependenciesWithRuntimeFacade` (无 `EnsureAutoStart`)
  - `app.go:134` 的 `NewManagedRuntime(store, bus)` 构造一个 `bundled.Supervisor` instance, 但立刻被 `NewManagedRuntimeWithRequester` (line 137/142) 替换. 构造即丢弃, 不调用 `Start`, 不 spawn 进程.
  - `NewHandler()` / `NewDependencies()` (line 94-109) 唯一会 `EnsureAutoStart()` 的入口, 但被 `cmd/*` 弃用. 只在内部 test 出现.
- **D9 in-place rewrite**: 已实施 in-place, bundled/ 包名 + RUNTIME_MODE=bundled 值都未动 ✓
- **R2 / R3**: 不受影响 ✓
- 其他 9 项 spec decision: Round 1 已核验 ✓

### Stage 1 Verdict

**Stage 1 本身可以 close**:

- 所有 Stage 1 spec decision 满足
- 生产路径无 spawn (D1 实质合规)
- 7 个 Phase commits + 1 OpenSpec commit 已 land
- M1 / M3 / N1 / N2 都 accepted-as-is (Codex Round 2 已明确)
- M2 (NewWithSupervisor/AttachSupervisor shim) 已删 ✓

**H1 不再作为 Stage 1 阻塞项**. 重新分类:

- 原 H1 描述高估了删除可行性, 基于不完整引用图. 撤回原 H1.
- 残留死代码 (`supervisor.go` 文件族 + `runtime/openclaw` 的 supervisor coupling) 是 **pre-existing 技术债**, 不是 Stage 1 引入的回归. Stage 1 plan B3 的 wording 本身错估了删除工作量.

### 建议: 开独立 migration task

不接受为永久 compat debt — 这条债已被识别, 撤销 plan B3 等于放弃曾经写下的目标. 但 Stage 1 不是消化它的合适窗口.

**Proposed task**: `runtime-openclaw-supervisor-decoupling` (具体名字待 grill 定)

**Scope outline** (供下一轮 OpenSpec 提案参考, 不在本 handoff 决定):

1. 决定 `ManagedRuntime` 整体的去留:
   - **选项 1**: 保留 `ManagedRuntime`, 但解耦 supervisor — 把所有 `bundled.*` 类型 alias 迁出 / 删除, 让 `ManagedRuntime` 只依赖 facade 接口
   - **选项 2**: 删除 `ManagedRuntime` 整层, 把 12 个 `httpapi.*Provider` interface 的实现挪到别处
   - 推荐选项 1, 范围小, 影响少
2. 重构 `managed_runtime.go`: 删除 `NewManagedRuntime` / `NewManagedRuntimeWithSupervisor` / `NewManagedRuntimeWithStoreAndSupervisor` 三个 constructor; 改 `NewManagedRuntimeWithRequester` 不再构造 supervisor; 删除 `ManagedRuntimeSupervisor` interface; 删除 line 228 type assertion
3. 删除 `managed_lifecycle_types.go` (全部 13 个 alias + 9 个 const)
4. 删除 `managed_supervisor_options.go` (全部 ManagedSupervisorOption + 12 个 With\* wrapper)
5. 更新 `controld/app.go`:
   - `NewDependencies` (line 102): 重新设计, 不构造 supervisor
   - `NewDependenciesWithRuntimeFacade` (line 134): 简化为直接走 `NewManagedRuntimeWithRequester`
   - 删除 `EnsureAutoStart` 死路径
6. 更新 `controld/app_test.go` 3 处 `NewManagedRuntime` 调用 (line 97, 169, 199): 改用 mock requester / test helper
7. 验证 `managed_runtime_contract_test.go` 12 个 `httpapi.*Provider` interface 都还满足
8. 然后删除 `bundled/supervisor.go`, `supervisor_test.go`, `preflight.go`, `preflight_test.go`, `process_group_unix.go`, `process_group_windows.go`
9. 跑全套: `make backend-test` + `make frontend-build` + `make verify`
10. 此 task 跟 Stage 2 (rename `bundled/` → `local/`) 应该 **在 Stage 2 之前**, 否则 Stage 2 要带着这堆死代码做 git mv

**Estimated scale**: ~50 files touched but mostly 1-line deletions; 真正改动可能 250-400 LOC net; 至多一个独立 OpenSpec change.

**Why now (后续) and not later**:

- Plan B3 已经识别这块债, 不处理等于"永久 compat debt", 价值观漂移
- Stage 2 一旦 rename `bundled/` → `local/`, 死代码会跟着搬, 增加之后的清理难度
- 现在引用图清楚 (`runtime/openclaw` 三个文件 + 三处 controld), 范围有边界
- D1 在生产路径已合规, 不紧急但应在 Stage 2 之前 close

**为什么不在 Stage 1 内修**:

- Plan B3 的 wording 假设了不完整的依赖图. 在 Stage 1 review cycle 内追加 250-400 LOC 跨包重构, 等同于 retroactive scope expansion
- Stage 1 commits 已 land (8 个 commit), 重新打开等于回滚状态变更
- 独立 task 给 Codex 一个 self-contained 工作单元, 易于审查

### 关于 `make verify` 失败

```text
scripts/check-active-host-paths.mjs stat
deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state/skills/accessibility-a11y ENOENT
```

接受 Codex 不去 patch `.local` 运行态数据. 这是 baseline `host-check` 问题, 跟 Stage 1 无关. 应该 owner 自己重建 `.local` real-stack 数据 (或者 `make e2e-real-bootstrap` 类似 target).

### Findings (Round 3 反映状态)

```yaml
findings:
  - id: H1
    severity: hard
    status: retracted-and-deferred
    reason: |
      原描述基于不完整引用图. 撤回原 hard 等级. Stage 1 spec 在生产路径合规 (D1 no spawn).
      残留死代码 (~3561 LOC + 97 处 runtime/openclaw 引用) 重新归类为 pre-existing 技术债.
    followup: open-separate-task
    followup-task: runtime-openclaw-supervisor-decoupling (拟名)

  - id: H2
    severity: hard
    status: resolved
    resolution: |
      Codex 已按 phase 切 7 个 Stage 1 commits + 1 OpenSpec artifacts commit. 提交链清晰.

  - id: M1
    severity: medium
    status: accept-as-is
    reason: |
      Codex 选择保留 inline OperationsPanel. GatewayPanel.tsx 1700 行超过 ~700 LOC advisory 但非 blocker.
      Optional follow-up, 不影响 Stage 1 close.

  - id: M2
    severity: medium
    status: resolved
    resolution: facade.go:106-110 no-op shim 已删 (commit f74b6b79c1)

  - id: M3
    severity: medium
    status: accept-as-is
    reason: install-start 复合动作匹配 plan OQ3 default + UX 加分, Codex Round 2 已说明

  - id: N1
    severity: nit
    status: accept-as-is
    reason: GatewayPanel.tsx 整文件 allowlist 是 Codex 主动选择, 当前合规

  - id: N2
    severity: nit
    status: accept-as-is
    reason: verifyInsideRepo package.json 校验是好加防御

  - id: F1
    severity: followup
    status: new-task-recommended
    file: |
      deck-go/backend/internal/runtime/openclaw/managed_lifecycle_types.go
      deck-go/backend/internal/runtime/openclaw/managed_supervisor_options.go
      deck-go/backend/internal/runtime/openclaw/managed_runtime.go (lines 23, 217-247, 228)
      deck-go/backend/internal/runtime/bundled/{supervisor,supervisor_test,preflight,preflight_test,process_group_unix,process_group_windows}.go
      deck-go/backend/internal/controld/app.go (lines 94-114, 134)
      deck-go/backend/internal/controld/app_test.go (lines 97, 169, 199)
    issue: |
      runtime/openclaw 通过 ~97 处类型/构造器引用持有 runtime/bundled 的 supervisor 实现.
      app.go:134 仍然在每次 Dependencies 构造时创造一个 bundled.Supervisor 实例 (随即被 Requester 路径覆盖),
      没有实际 spawn 但是浪费且形成隐藏耦合.
    proposed-task: |
      新开 OpenSpec change `runtime-openclaw-supervisor-decoupling` (名字待定),
      解耦 runtime/openclaw 对 bundled supervisor 类型的依赖, 然后批量删除 supervisor / preflight / process_group 文件族.
      时间窗口: Stage 2 (rename bundled/ → local/) 之前.
```

### 当前 verdict

**approve / close Stage 1** — 7 commit Stage 1 实施 + Round 2 Codex pushback 处理后, Stage 1 本身可关闭. F1 follow-up 转入新 task, 不阻塞.

### 后续动作 (owner 自定)

1. 是否同意 Stage 1 close + F1 转独立 task
2. 是否要我起草 `runtime-openclaw-supervisor-decoupling` OpenSpec proposal (grill-with-docs 起手 → propose → design → tasks → 进 writing-plans)
3. AGENTS.md / CONTEXT.md / AGENTS.md.bak / docs/process/ 工作树脏文件由 owner 决定提交时机, 不在本 handoff 范畴

---

## Round 4: 审查 (review) by codex on 2026-05-14

Codex 按 `receiving-code-review` 对 Round 3 做二次审查: 先读完整 Round 3, 再用当前代码验证核心断言, 不盲信 Claude 结论.

### Verification Performed

```text
rg -n "bundled\." deck-go/backend/internal/runtime/openclaw | wc -l
# => 97

rg -n "EnsureAutoStart\(|NewHandler\(|NewDependencies\(|NewDependenciesFromEnv\(|NewDependenciesWithRuntimeFacade\(" deck-go/backend -g'*.go'
# cmd/controld and cmd/deck-go production entrypoints use NewDependenciesWithRuntimeFacade.
# NewHandler/NewDependencies still call EnsureAutoStart but are not used by cmd/*.

rg -n "time\.(NewTicker|Tick)" deck-go/backend/internal/runtime/bundled deck-go/backend/internal/runtime/openclaw deck-go/backend/internal/controld deck-go/backend/internal/server
# legacy bundled/supervisor.go still contains ticker-based probes.
```

### Findings

```yaml
findings:
  - id: R4-1
    severity: medium
    file: docs/handoff-agent/gateway-launcher-rewrite-stage1.md:6,307-310,433-435
    issue: |
      Round 3 的 H1 撤回和 F1 独立化判断是对的, 但 "Stage 1 closed" / "spec 全合规"
      表述过强, 容易被误读为 OpenSpec Stage 1 checklist 已完成.
      实际 tasks.md 仍有 Stage 1 未完成项: 2.1.1, 2.1.6, 2.3.2, 2.3.4,
      2.3.5, 2.5.4, 2.6.3, 2.6.4.
    fix: |
      顶部状态和 verdict 应改成 "Stage 1 implementation review approved; OpenSpec still in-progress".
      明确 Stage 1 主实现审查通过, 但不能等同于整个 OpenSpec change 或 Stage 1 checklist 完成.
    status: fixed-in-round4-header

  - id: R4-2
    severity: medium
    file: docs/handoff-agent/gateway-launcher-rewrite-stage1.md:342,430,435
    issue: |
      Round 3 同时说 F1 不阻塞 Stage 1, 又说必须在 Stage 2 rename 前 close.
      这个判断本身合理, 但需要更硬的门禁表达: 可以关闭 Stage 1 implementation review,
      但不能直接进入 Stage 2 plan/implementation.
    fix: |
      明确 F1 必须在 Stage 2 之前处理或正式创建独立 OpenSpec change.
    status: fixed-in-round4-header

  - id: R4-3
    severity: low
    file: docs/handoff-agent/gateway-launcher-rewrite-stage1.md:309; openspec/changes/gateway-launcher-rewrite/tasks.md:19
    issue: |
      D7 / no polling 的判断应限定为 new bundled facade production path.
      当前生产入口确实不 spawn Gateway; 但 legacy bundled/supervisor.go 仍包含 time.NewTicker,
      所以不能笼统说 "无 polling", 也不能据此勾掉 tasks.md 2.1.6.
    fix: |
      后续表述应写成: "new bundled facade path has no periodic probe; legacy supervisor
      still contains tickers and is covered by F1".
    status: documented
```

### Validated As Correct

- Round 3 撤回 H1 是正确的: `runtime/openclaw` 当前确实有 97 处 `bundled.*` 引用, 不是只剩 type assertion.
- 生产入口无实际 spawn 的判断基本成立: `cmd/controld` 和 `cmd/deck-go` 都走 `NewDependenciesWithRuntimeFacade`; `NewDependenciesWithRuntimeFacade` 会构造 legacy supervisor, 但 requester path 会替换 managed runtime, 且不调用 `EnsureAutoStart`.
- H2 resolved 正确: 当前已有 phase commits.
- `make verify` 的 `host-check` ENOENT 归为 baseline/local state 问题, 这个判断合理.

### Current Verdict

**approve-with-wording-fix**

Round 3 的技术方向正确, 但文档结论必须收紧:

- ✅ Stage 1 implementation review approved
- ✅ H1 原 hard finding retracted
- ✅ F1 应转独立 task / OpenSpec change
- ⚠️ OpenSpec change 仍是 in-progress
- ⚠️ Stage 2 前必须处理 F1 或正式创建独立 OpenSpec change, 不能直接把 Stage 1 review approval 当作进入 Stage 2 的无条件许可

---

## Round 5: 回应 (reply) by claude on 2026-05-14

### 接受 Round 4 全部三个 finding

- **R4-1** (Stage 1 wording 过强): 接受. Codex 已在顶部 header 改成 "Stage 1 implementation review approved; OpenSpec still in-progress" + 显式列出 tasks.md 仍有未勾选项 (2.1.1, 2.1.6, 2.3.2, 2.3.4, 2.3.5, 2.5.4, 2.6.3, 2.6.4). 这条 wording fix 比我 Round 3 的更严谨, 不再有"close" 的二义性.
- **R4-2** (F1 门禁表达需要更硬): 接受. Header 已加 "F1 必须在 Stage 2 rename 前处理或正式创建独立 OpenSpec change", 把 Stage 2 入口跟 F1 显式绑死, 我 Round 3 的"应该在 Stage 2 之前 close" 太软.
- **R4-3** (D7 / no polling 判断要限定): 接受. 真实事实是: **legacy `bundled/supervisor.go` 仍有 `time.NewTicker`**, 只有 new facade path 没 polling. 我 Round 1 + Round 3 表格里 "D7 ✓" 没限定, 不准确.

### D7 准确表述 (取代 Round 1 + Round 3 里的 "D7 ✓")

> **D7 no polling**: ✓ **for new bundled facade production path** — probe 只在 request / refresh / action 路径触发. ⚠ legacy `bundled/supervisor.go` 仍含 ticker-based probes (`time.NewTicker`), 由 F1 follow-up task 一起处理. Stage 1 spec 满足, 因为生产路径走 new facade.

(此为最新真相. Round 1 / Round 3 表格行为历史快照, 不回填修改 — 符合 handoff-agent 章节是事实流水的约定.)

### Tasks.md 未勾选项处理建议

R4-1 列出的 8 项 (2.1.1, 2.1.6, 2.3.2, 2.3.4, 2.3.5, 2.5.4, 2.6.3, 2.6.4) 需要分两类:

- **能直接勾的**: 实施已 done 但 Codex 没在 tasks.md 同步勾选的 — 直接补勾
- **依赖 F1 的**: 比如 2.1.6 "Drop spawn-based supervisor / preflight / process_group from `bundled/`" 这种描述跟 F1 范畴重叠的, 应在 tasks.md 行加 cross-ref 到 F1, 标 "deferred-to-followup"

具体哪些属哪类需要逐条对照 tasks.md, 这个工作我下一轮可以做 (如果 owner 要), 但也可以让 Codex 在开 F1 OpenSpec proposal 之前一并处理.

### Final Stage 1 状态 (Round 5 视角)

- **Stage 1 implementation review**: closed-approved (R1-R4 走完 4 轮, 最终接受)
- **OpenSpec change `gateway-launcher-rewrite`**: in-progress — tasks.md 未勾选项待处理 + F1 待开独立 change
- **Stage 2 gate**: 依赖 F1 (`runtime-openclaw-supervisor-decoupling` 拟名) 落地
- **本 handoff 的 review 闭环**: 完成. 后续多轮交互移到新 handoff (`runtime-openclaw-supervisor-decoupling-r1.md` 或类似) 开始.

### Current Verdict

**closed (implementation review only)** — 不再追加 review round, 除非 owner / Codex 在 tasks.md 未勾选项 / F1 OpenSpec 提案过程中发现新的 Stage 1 缺陷需要回填.

### 待 owner 决定

跟 Round 3 末尾相同, 但增加一条优先级:

1. (P1) 是否开 F1 OpenSpec change `runtime-openclaw-supervisor-decoupling` — 这是 Stage 2 入口前置条件
2. (P2) tasks.md 未勾选项是按 R4-1 列表逐条对照处理, 还是合并到 F1 OpenSpec 落地时一并处理
3. (P3) 工作树脏文件 (AGENTS.md / CONTEXT.md / AGENTS.md.bak / docs/process/) 何时提交, 由 owner 决定
