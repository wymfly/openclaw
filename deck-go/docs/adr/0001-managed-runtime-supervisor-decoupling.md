# ADR 0001: Decouple `runtime/openclaw.ManagedRuntime` from `runtime/bundled` supervisor

- **Status**: Accepted
- **Date**: 2026-05-14
- **Owner**: deck-go runtime team
- **Related**:
  - OpenSpec change `gateway-launcher-rewrite` (Stage 1, implementation review approved, OpenSpec in-progress)
  - Handoff log `docs/handoff-agent/gateway-launcher-rewrite-stage1.md` (Rounds 1–5)

## Context

OpenSpec change `gateway-launcher-rewrite` Stage 1 replaced the local Gateway lifecycle mechanism: the BFF no longer spawns the Gateway directly; it shells out to the official `openclaw gateway` CLI through `runtime/bundled.LifecycleProxy`. Stage 1 Plan Phase B3 also intended to delete the now-unused spawn machinery under `runtime/bundled/`:

- `supervisor.go` (1523 LOC), `supervisor_test.go` (1567 LOC)
- `preflight.go` (158 LOC), `preflight_test.go` (208 LOC)
- `process_group_unix.go` (61 LOC), `process_group_windows.go` (44 LOC)

The Stage 1 review (Round 1 → Round 4) discovered that the legacy `runtime/openclaw` package still consumes ~97 references to `runtime/bundled` types: `bundled.Snapshot`, `bundled.Status`, `bundled.Option`, `bundled.NewSupervisorWithOptions`, and roughly a dozen `bundled.With*` policy wrappers. Production grep:

```
$ rg -n "bundled\." deck-go/backend/internal/runtime/openclaw | wc -l
97
```

Concrete consumers inside `runtime/openclaw`:

- `managed_lifecycle_types.go` — 13 type aliases + 9 status/health constants
- `managed_supervisor_options.go` — `ManagedSupervisorOption = bundled.Option` + ~12 `WithManaged*` wrappers
- `managed_runtime.go` — `ManagedRuntimeSupervisor` interface (returns `bundled.Snapshot`), 4 constructors that all call `NewManagedSupervisorWithOptions`, 5 public lifecycle methods (`Snapshot/Start/Stop/Restart/GatewayConnection`), `EnsureAutoStart` type-assertion probe
- `legacy_runtime_orchestration.go` — `runtimeStatus(bundled.Snapshot) → deckapi.DeckGoRuntimeGatewayStatus`, used by `RuntimeGatewayStatusResponse` / `StartRuntimeGateway` / `StopRuntimeGateway` / `RestartRuntimeGateway` / `BootstrapStatus`
- `legacy_admin_settings_onboarding.go` — `runtimeVersionStatus(m.Snapshot())`

Cross-package consumers also detected (not inside `runtime/openclaw`):

- `runtime/registry/summary.go` — `SnapshotReader` interface returns `bundled.Snapshot`; `summarize(snapshot bundled.Snapshot, …)` reads `snapshot.Managed`, `Configured`, `Status`, `Health`, `GatewayURL`, `LastError`, `AutoStart`
- `runtime/registry/{summary_test,summary_capability_test,registry_test}.go` — use `bundled.Snapshot{…}` fixtures
- `server/{server_test,gateway_routes_test,stream_test,stream_event_typing_test,runtime_facade_test,test_router_test}.go` — use `ManagedSnapshot` (alias to `bundled.Snapshot`) and `NewManagedRuntimeWithStoreAndSupervisor` against fake supervisors
- `runtime/openclaw/transport_binding_test.go` — `bundled.Snapshot{…}` fixtures inside ManagedRuntime tests

Production entry points (`cmd/controld/main.go`, `cmd/deck-go/main.go`) flow through `controld.NewDependenciesWithRuntimeFacade`, which constructs a `bundled.Supervisor` instance and then immediately replaces the resulting `ManagedRuntime` with `NewManagedRuntimeWithRequester`. Result:

- Production does NOT call `Start()` on the discarded supervisor; D1 (Stage 1 spec "no spawn") holds in practice.
- A `bundled.Supervisor` instance is still constructed on every BFF boot — wasteful, and a latent footgun: any future caller could call `Start()` and revive the spawn path.

Three additional dead entry points still expose `EnsureAutoStart`:

- `controld.NewHandler()` / `controld.NewDependencies()` — no non-test caller; only used by tests.
- `server.New()` — no non-test caller.

`runtime/projection` and `runtime/openclaw/views` were checked and have zero references to `bundled.*`. `runtime/registry` does have `bundled.*` references (see above) and is part of this decoupling.

## Decision

Adopt **Option 1**: keep `runtime/openclaw.ManagedRuntime` as the host of the BFF runtime surface and the ~12 `httpapi.*Provider` implementations, but **decouple it from `runtime/bundled` supervisor types**.

Specifically:

1. The `facade.RuntimeFacade` interface SHALL grow two contract additions consumed by `ManagedRuntime`:
   - A `GatewayConnection(context.Context) (GatewayConnection, error)` method. Both `bundled.Facade` and `remote.Facade` already implement this concretely; the interface SHALL be widened to match.
   - A new `AutoStart bool` field on `facade.RuntimeStatus`. `bundled.Facade.RuntimeGatewayStatus` SHALL populate it from `RuntimeBundledConfig.AutoStart`; `remote.Facade` SHALL leave it `false`. This preserves the current `registry.RuntimeSummary.AutoStart` semantics and the existing frontend rendering at `GatewayPanel.tsx:1554-1556`.
2. `ManagedRuntime` SHALL hold a `facade facade.RuntimeFacade` field instead of `supervisor ManagedRuntimeSupervisor`, plus a `lastStatus facade.RuntimeStatus` field under an `sync.RWMutex`. The cache is updated whenever a `RuntimeGatewayActionResponse`-returning method or `BootstrapStatus` calls into the facade and receives a fresh status; it is read by `registry.LastStatusReader` and by the WS lifecycle bridge. This preserves the synchronous in-memory read shape that `supervisor.Snapshot()` provided, so the `/api/runtimes` list endpoint stays I/O-free.
3. Lifecycle answers (`RuntimeGatewayStatusResponse`, `StartRuntimeGateway`, `StopRuntimeGateway`, `RestartRuntimeGateway`, `BootstrapStatus`) SHALL read from `facade.RuntimeFacade.RuntimeGatewayStatus / Start / Stop / Restart` and adapt `facade.RuntimeStatus` (not `bundled.Snapshot`) into `deckapi.DeckGoRuntimeGatewayStatus`. After each call they SHALL refresh the cache.
4. `runtime/registry.SnapshotReader` SHALL be renamed to `LastStatusReader` with signature `LastStatus() facade.RuntimeStatus` — no `context`, no error — to match the in-memory cache contract from (2). `summarize(facade.RuntimeStatus, capabilities)` SHALL replace the current `summarize(bundled.Snapshot, capabilities)`. `controld/app.go runtimeSummaryOverride` (which still actively probes in remote mode) is unaffected by this change.
5. Internal `ManagedRuntime` `GatewayConnection` callers (including `DeviceTokenRotate`) SHALL route through `facade.RuntimeFacade.GatewayConnection`.
6. The five `ManagedRuntime` public lifecycle methods (`Snapshot/Start/Stop/Restart/GatewayConnection`) — currently only test-called from outside the package — SHALL be removed. The four `RuntimeGatewayActionResponse`-returning methods on `ManagedRuntimeSurface` are the supported public surface. A new `LastStatus() facade.RuntimeStatus` method SHALL exist on `ManagedRuntime` to back `registry.LastStatusReader`.
7. `ManagedRuntimeSupervisor` interface, `managed_lifecycle_types.go`, `managed_supervisor_options.go`, and their tests SHALL be removed.
8. `NewManagedRuntime` and `NewManagedRuntimeWithSupervisor` and `NewManagedRuntimeWithStoreAndSupervisor` SHALL be removed; the surviving constructor is `NewManagedRuntimeWithFacade` (new name; supersedes `NewManagedRuntimeWithRequester`) and SHALL accept the `facade.RuntimeFacade`.
9. `controld.NewHandler` / `controld.NewDependencies` / `server.New` (legacy dead spawn entry points) SHALL be removed; tests that depend on them SHALL be refactored to use `NewDependenciesWithRuntimeFacade` with a test facade.
10. `managedGatewaySettingsFromRuntimeBundled` (dead since Stage 1 Round 2) SHALL be removed.
11. After 1–10 land green, `runtime/bundled` spawn files SHALL be deleted: `supervisor.go`, `supervisor_test.go`, `preflight.go`, `preflight_test.go`, `process_group_unix.go`, `process_group_windows.go`.

The `runtime/bundled` package SHALL remain (it now hosts only the new shell-out lifecycle: `lifecycle_proxy.go`, `service_name.go`, `entrypoint_resolver.go`, `probe.go`, `facade.go`). Stage 2 of `gateway-launcher-rewrite` will rename the package to `runtime/local`.

## Alternatives Considered

- **Delete `ManagedRuntime` entirely (Option 2)**. Rejected. `ManagedRuntime` is the host for ~85 methods implementing 12 `httpapi.*Provider` interfaces across `legacy_admin_*.go` (~2000 LOC) and the WS lifecycle bridge. Removing it amounts to a separate BFF-layer refactor with much larger blast radius, and is not required to break the bundled-supervisor coupling.
- **Leave the coupling as permanent compat debt (do nothing)**. Rejected. Stage 1 Plan B3 already wrote down the intent to delete the spawn machinery; abandoning that intent now would let supervisor death code travel through Stage 2 (`bundled/` → `local/` rename) and grow harder to clean. Construction-then-discard of `bundled.Supervisor` on every BFF boot is also a latent footgun (someone could call `Start()` and revive the spawn path).
- **Write an OpenSpec change with a synthetic "invariant" spec**. Rejected. F1 is a pure implementation refactor with no product-behavior delta. Existing governance-style OpenSpec specs (e.g. `deck-go-bff-route-contract-governance`) describe positive process governance (route metadata SHALL exist). F1's invariant is a negative constraint with no enforceable scan mechanism. Forcing it into OpenSpec shape adds artifact weight without governance value. An ADR + plan is the correct form.

## Consequences

Positive:

- The 5-state Stage 1 spec ("D1 no spawn") becomes structurally guaranteed in `runtime/openclaw`, not just incidentally true via discard-after-construct.
- `runtime/bundled` shrinks to ~5 small files implementing the new shell-out lifecycle, ready for the Stage 2 rename.
- `cmd/*` becomes the only legal entry point. Footgun entry points (`NewHandler`, `server.New`) are removed.
- Future readers do not see a `ManagedRuntimeSupervisor` interface that returns `bundled.Snapshot` and have to wonder which mode it implies.

Negative / cost:

- ~350–550 LOC net diff across `controld/`, `runtime/openclaw/`, `runtime/registry/`, `runtime/facade/`, `runtime/bundled/`, `runtime/remote/`, and `server/`.
- ~11 test files need rework: `runtime/openclaw/managed_runtime_test.go`, `runtime/openclaw/managed_runtime_ws_test.go`, `runtime/openclaw/managed_runtime_ws_lifecycle_test.go`, `runtime/openclaw/managed_supervisor_options_test.go` (full delete), `runtime/openclaw/managed_runtime_contract_test.go`, `runtime/openclaw/transport_binding_test.go`, `runtime/registry/{summary_test,summary_capability_test,registry_test}.go`, `server/{server_test,gateway_routes_test,stream_test,stream_event_typing_test,runtime_facade_test,test_router_test}.go`.
- `runtimeStatus(bundled.Snapshot) → deckapi.DeckGoRuntimeGatewayStatus` adapter is replaced by `runtimeStatus(facade.RuntimeStatus) → deckapi.DeckGoRuntimeGatewayStatus`. Field mapping needs to be revalidated (some `bundled.Snapshot` fields like `RestartDelayMs`, `OwnershipFile`, `Owner`, `OwnershipState` have no equivalent in `facade.RuntimeStatus` and will be removed from the response — these are stale fields of the spawn era; their disappearance is correct).
- `deckapi.DeckGoRuntimeGatewayStatus` shape change is owner-facing if a frontend currently reads `pid`/`ownershipState`/`restartAttempts`/`restartDelayMs` fields. Audit during implementation; if any are read, decide whether to leave them as zero-valued or extend the deckapi contract.
- `facade.RuntimeStatus.AutoStart` and `facade.RuntimeFacade.GatewayConnection` widen the facade contract, so any future mode implementation MUST honor them. Both are concretely zero-cost for the two existing implementations (`bundled` and `remote`).

Order with Stage 2:

- This ADR's plan MUST land before `gateway-launcher-rewrite` Stage 2 (rename `runtime/bundled/` → `runtime/local/`). Otherwise Stage 2 carries dead code through the rename and surface-area cleanup becomes harder.
