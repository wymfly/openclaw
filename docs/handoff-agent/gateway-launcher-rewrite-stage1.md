# Gateway Launcher Rewrite — Stage 1

**OpenSpec change**: `openspec/changes/gateway-launcher-rewrite/`
**Plan**: `openspec/changes/gateway-launcher-rewrite/plan.md`
**Scope**: Stage 1 — in-place rewrite of `deck-go/backend/internal/runtime/bundled/` (spawn-based supervisor → shell-out to official CLI), BFF reverse-proxy for Gateway assets, OperationsPanel UI gated on `supervisorState`. Stage 2 (rename `bundled/` → `local/` + env value rename) is out of scope.
**当前状态**: awaiting-re-review — H2 已按 phase 切 commit. H1 经代码事实复核后部分修复: `NewWithSupervisor` / `AttachSupervisor` no-op shims 已删除, 但 `bundled.Supervisor` 文件族仍被 legacy `runtime/openclaw` surface 依赖, 不作为本轮死代码删除.

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
