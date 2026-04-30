## 0. Pre-flight: Establish Baselines and Audit Tooling

- [x] 0.1 Capture rebase-base reference: `BASE=$(git merge-base upstream/main enhanced)` and record commit hash + date in `.omc/notepad.md`
- [x] 0.2 Snapshot current `pnpm protocol:gen:check` output bytes (`shasum dashboard/src/types/gateway-protocol.generated.ts dashboard/src/types/gateway-client.generated.ts`) — used as Phase 1+2+4 byte-stability gate
- [x] 0.3 Snapshot current `gateway.describe` JSON output (start gateway, call describe, save to `.omc/research/describe-baseline.json`) — used as bounded-diff gate per spec
- [x] 0.4 Generate fork-modified upstream files inventory: `git diff --name-only --diff-filter=M $BASE..enhanced -- src/gateway/` → `.omc/research/fork-modified-baseline.txt`
- [x] 0.5 Add `scripts/audit-schema-fork-footprint.ts` (measures fork-added/modified lines per upstream schema file)
- [x] 0.6 Add `scripts/audit-fork-classifications.ts` (enumerates registered methods + asserts every fork-only method has `forkClass`)
- [x] 0.7 Add `scripts/audit-gateway-service-coverage.ts` (uses TypeScript Compiler API to enumerate every internal symbol consumed by `src/gateway/server-methods/deck/**/*.ts` AND `src/gateway/server-methods/deck-auth.ts`; handles depth-1 `../../`, depth-3 `../../../`, multiline imports, and dynamic imports; exits non-zero if any consumed symbol is unmapped)
- [x] 0.8 Add `scripts/diff-describe-baseline.ts` (compares pre/post `gateway.describe` JSON, exits zero only when JSON-pointer-level diffs fall within the documented allow-list — initially `forkClass`, `bffEligible`, `controlPlaneWrite`)
- [x] 0.9 **Fix `deck.plugins.list` registry drift**: `deck/index.ts:7,21` registers the handler but `method-registry-data.ts` (currently 25 deck.\* entries) and `server-methods-list.ts` omit it. Add `deck.plugins.list` to both files and to `deckMethodDefs`. Verify via `grep -c '"deck\.' src/gateway/method-registry-data.ts` returns 26 after the fix
- [ ] 0.10 Run all baseline audits and commit `.omc/research/*` snapshots

## 1. Phase 1 — Schema Sibling-Split

- [x] 1.1 Move fork additions from `src/gateway/protocol/schema/sessions.ts` into new sibling `sessions-extensions.ts` (320 lines moved); add `export * from "./schema/sessions-extensions.js"` to the existing single-file barrel `src/gateway/protocol/schema.ts` (note: there is **no** `protocol/schema/index.ts` in this codebase)
- [x] 1.2 Move fork additions from `protocol/schema/nodes.ts` into `nodes-extensions.ts` (141 lines); add re-export in `protocol/schema.ts`
- [x] 1.3 Move fork additions from `protocol/schema/protocol-schemas.ts` into `protocol-schemas-extensions.ts` (125 lines); add re-export
- [x] 1.4 Move fork additions from `protocol/schema/agents-models-skills.ts` into `agents-models-skills-extensions.ts` (118 lines); add re-export
- [x] 1.5 Move fork additions from `protocol/schema/devices.ts` into `devices-extensions.ts` (114 lines); add re-export
- [x] 1.6 Move fork additions from `protocol/schema/cron.ts` into `cron-extensions.ts` (72 lines); add re-export
- [x] 1.7 Move fork additions from `protocol/schema/logs-chat.ts` into `logs-chat-extensions.ts` (39 lines); add re-export. Investigate the `-1` line: revert (with optional upstream PR) or document as residual fork-modification
- [x] 1.8 Move fork additions from `protocol/schema/config.ts` into `config-extensions.ts` (34 lines); add re-export. Investigate the `-3` lines and either revert or document
- [x] 1.9 Move fork additions from `protocol/schema/exec-approvals.ts` into `exec-approvals-extensions.ts` (28 lines); add re-export
- [x] 1.10 Move fork additions from `protocol/index.ts` into `protocol/index-extensions.ts` and add `export * from "./index-extensions.js"` to `protocol/index.ts`
- [x] 1.11 Audit pre-existing direct imports of `protocol/schema/<name>.ts` (e.g., `protocol/index.ts:528-554` imports `./schema/deck.js`); for each: keep direct import if symbol stays in upstream file, else add per-file compat re-export OR migrate consumer to barrel within the same phase
- [x] 1.12 Run `pnpm protocol:gen:check` and confirm byte-identical output vs. baseline from task 0.2
- [x] 1.13 Run `node scripts/audit-schema-fork-footprint.ts` — assert every upstream schema file has ≤ 5 fork-modified lines (excluding barrel re-export)
- [x] 1.14 Run `node scripts/diff-describe-baseline.ts` — assert allow-list-only diff
- [ ] 1.15 Run `pnpm test src/gateway/protocol/`, `pnpm tsgo`, `pnpm check` — targeted tests and build passed; `pnpm tsgo` / `pnpm check` remain blocked by known unrelated Feishu/provider-usage baseline errors. See `verification.yaml` scenario `phase1.targeted-tests`.
- [ ] 1.16 Commit Phase 1 (one commit per schema file or one combined commit; follow `scripts/committer "<msg>"` convention)

## 2. Phase 2 — Auto-Discovery for Server Methods

### 2.A Type contract extension (MethodDefinition + GatewayDescribePayload)

- [x] 2.1 Extend `MethodDefinition` interface in `src/gateway/method-registry.ts:6-15` to add: `forkClass?: "C1" | "C2" | "C3" | "C4" | "C5"`, `bffEligible?: boolean`, `controlPlaneWrite?: boolean`. Update `MethodMetadata` shape and `buildMethodRegistry` to carry these through
- [x] 2.2 Extend `GatewayDescribePayload` in `src/gateway/method-registry.ts:22-42` and the corresponding `gateway.describe` result schema (per `setDescribeRegistry` consumer) to surface the new fields
- [x] 2.3 Update `schemaVersion` hashing in `src/gateway/method-registry.ts` (the `[...events.entries()].toSorted(...)` block + the methods entries hashing) to include the new metadata fields, so any change to `forkClass`/`bffEligible`/`controlPlaneWrite` triggers a bump
- [x] 2.4 Add unit test in `src/gateway/method-registry.test.ts` asserting that adding a `controlPlaneWrite: true` flag to a method-def changes the `schemaVersion` hash

### 2.B Discovery generator and module pairs

- [x] 2.5 Define `GatewayMethodMetadataModule` and `GatewayMethodModule` interfaces in `src/gateway/method-registry.ts` per design D1 (separate metadata vs runtime contracts; `*.module.ts` re-exports paired metadata for single-file-import ergonomics)
- [x] 2.6 Add `scripts/gen-method-modules.ts` build-time generator that:
  - Walks `src/gateway/server-methods/**/*.method-defs.ts` → emits `src/gateway/server-methods/_method-defs.generated.ts` (side-effect-free imports only)
  - Walks `src/gateway/server-methods/**/*.module.ts` → emits `src/gateway/server-methods/_modules.generated.ts` (runtime handler imports)
  - Sorts both manifests by `(priority ascending, module name ascending)` for cache stability
- [x] 2.7 Wire `gen-method-modules.ts` into `scripts/build-all.mjs` (NOT `prebuild` — verified that `package.json` has no `prebuild` hook; existing `"build"` script invokes `node scripts/build-all.mjs`). Add `check:method-modules-up-to-date` to `pnpm check` to fail CI when generated files are stale
- [x] 2.8 Implement `loadGatewayMethodModules()` runtime aggregator with fail-fast duplicate detection (throws `Error` naming both modules + the duplicate method)
- [x] 2.9 Add CI test asserting `_method-defs.generated.ts` is side-effect-free: `bun -e 'import("./src/gateway/server-methods/_method-defs.generated.ts")'` produces no runtime side effects (mirrors the existing pattern at `method-registry-data.ts:5`)
- [x] 2.10 Convert `src/gateway/server-methods/deck/index.ts` into `deck.module.ts` + `deck.method-defs.ts` pair
- [x] 2.11 Convert `src/gateway/server-methods/deck-auth.ts` into `deck-auth.module.ts` + `deck-auth.method-defs.ts` pair
- [x] 2.12 Convert `src/gateway/server-methods/describe.ts` into `describe.module.ts` + `describe.method-defs.ts` pair
- [x] 2.13 Convert `src/gateway/server-methods/models-catalog-providers.ts` into `models-catalog-providers.module.ts` + `models-catalog-providers.method-defs.ts` pair
- [x] 2.14 Convert each existing `*-method-defs.ts` (10 files: chat, config, control-plane, device, node, sessions, skills, talk, usage, wizard) into a `*.method-defs.ts` paired with the corresponding `*.module.ts` runtime handler module

### 2.C Dispatcher extraction (enables future batch primitive without import cycle)

- [x] 2.15 Create `src/gateway/server-methods/dispatcher.ts` exporting `dispatchGatewayRequest({ handlers, ...opts }: DispatchGatewayRequestOpts)`. Move the body of `handleGatewayRequest` from `server-methods.ts:147-220` (authorize → unavailable check → control-plane budget → handler lookup from `opts.handlers` → `withPluginRuntimeGatewayRequestScope` invocation) into this new function. Imports: `withPluginRuntimeGatewayRequestScope`, `consumeControlPlaneWriteBudget`, `formatControlPlaneActor`, `resolveControlPlaneActor`, `ADMIN_SCOPE`, `authorizeOperatorScopesForMethod`, `ErrorCodes`, `errorShape`, `isRoleAuthorizedForMethod`, `parseGatewayRole`. **Must NOT import `server-methods.ts` or any handler module or `_modules.generated.ts`** (cycle proof)
- [x] 2.16 Add an optional `dispatchSubRequest` field to `GatewayRequestHandlerOptions` (not to `GatewayRequestContext`). `dispatchGatewayRequest` populates it when invoking handlers; the closure captures the private `handlers` map and re-enters `dispatchGatewayRequest` for sub-calls. Do not expose `handlers` through `GatewayRequestContext` or plugin runtime scope
- [x] 2.17 Refactor `handleGatewayRequest` in `server-methods.ts` to be a thin wrapper: `const handlers = { ...coreGatewayHandlers, ...opts.extraHandlers }; await dispatchGatewayRequest({ ...opts, handlers });`
- [x] 2.18 Add CI test in `src/gateway/server-methods/__tests__/dispatcher.test.ts` covering: success path equivalent to today's `handleGatewayRequest`, scope enforcement, control-plane budget, handler-not-found error, and that plugin runtime scope does not expose a raw `handlers` map on `context`
- [x] 2.19 Verify cycle proof: `node scripts/check-import-cycles.ts` (or `pnpm check:import-cycles` if equivalent) on `src/gateway/server-methods/dispatcher.ts` reports no import cycle

### 2.D Registration site replacement

- [x] 2.20 Replace the `coreGatewayHandlers = { ...connectHandlers, ... }` spread in `src/gateway/server-methods.ts` with discovery-driven aggregation: `const { handlers, methodDefs, events } = loadGatewayMethodModules(); export const coreGatewayHandlers = handlers; export const gatewayMethodRegistry = buildMethodRegistry(handlers, methodDefs, events);`
- [x] 2.21 Replace `BASE_METHODS` static array in `src/gateway/server-methods-list.ts` with `gatewayMethodRegistry.listMethods().slice().sort()` (note: `methods` is a `ReadonlyMap`, NOT a `Record` — verified at `method-registry.ts:44-46`; use `listMethods()` or `Array.from(methods.keys())`, NOT `Object.keys()`)

### 2.E controlPlaneWrite explicit name list

- [x] 2.22 Add `controlPlaneWrite: true` flag to method-defs of the **10 explicitly-enumerated control-plane-write methods** (decision 5, option a):
  - **Upstream (3, verified at `server-methods.ts:33`):** `config.apply`, `config.patch`, `update.run`
  - **Fork-added config writes (7):** `deck.routing.add`, `deck.routing.remove`, `deck.agents.skills.set`, `deck.agents.subagents.set`, `deck.agents.eventStreams.set`, `deck.identity.link`, `deck.identity.unlink`
  - **Excluded (runtime mutations, NOT control-plane writes):** `deck.subagents.kill`, `deck.subagents.steer`, `sessions.clear`, `sessions.steer` — these are runtime control, not config writes; they are NOT budgeted and that matches today's behavior
- [x] 2.23 Switch `CONTROL_PLANE_WRITE_METHODS` constant in `server-methods.ts` to derive from the registry: `new Set(gatewayMethodRegistry.listMethods().filter(m => gatewayMethodRegistry.getDefinition(m)?.controlPlaneWrite === true))`
- [x] 2.24 Add unit test in `server-methods.ts` test asserting the derived set equals the literal 10-name set above (regression guard)

### 2.F Verification

- [x] 2.25 Add `src/gateway/__tests__/discovery-determinism.test.ts` asserting `JSON.stringify(loadGatewayMethodModules())` is byte-stable across two consecutive invocations and across shuffled module enumeration order
- [x] 2.26 Add `src/gateway/__tests__/discovery-duplicate-detection.test.ts` asserting fail-fast on duplicate method names
- [x] 2.27 Run `pnpm protocol:gen:check` and confirm byte-identical output vs. baseline (task 0.2). Note: with the type contract extension landing here, the codegen output may add `forkClass` / `bffEligible` / `controlPlaneWrite` fields — if so, regenerate the baseline once and document the bumped diff in the PR description; subsequent runs must remain byte-identical
- [x] 2.28 Start gateway and re-snapshot `gateway.describe` output — run `node scripts/diff-describe-baseline.ts` and assert allow-list-only diff (post Phase 2 the diff includes the new metadata fields if present in `gateway.describe`'s result; allow-list extends to cover those fields)
- [x] 2.29 Verify the runtime bundle (`dist/`) does not include `gen-method-modules.ts` or any `scripts/` content (the generator runs at build time; runtime bundle imports only the emitted `_modules.generated.ts` / `_method-defs.generated.ts`). Spot-check by grepping `dist/` for `gen-method-modules` (should be 0 hits)
- [ ] 2.30 Run `pnpm test`, `pnpm build`, `pnpm check` — Phase 2 targeted regression suite, build, protocol generation, and method-module checks passed; full `pnpm tsgo` / `pnpm check` remain blocked by known unrelated Feishu/provider-usage baseline errors. See `verification.yaml` scenario `phase2.full-gates`.
- [x] 2.31 Verify `git diff $BASE..HEAD -- src/gateway/server-methods.ts src/gateway/server-methods-list.ts` shows ≤ 5 lines remaining fork diff (server-methods.ts retains the thin `handleGatewayRequest` wrapper plus its imports; server-methods-list.ts drops to 0)
- [ ] 2.32 Commit Phase 2

## 3. Phase 3 — Service Interface Layer + Deck Handler Refactor

- [x] 3.1 Create `src/gateway/services/README.md` documenting the v1 contract (pass-through, version field, no caching, contract test obligation, escape-hatch listing rules)
- [x] 3.2 Implement `src/gateway/services/agents.service.ts` wrapping `listAgentEntries`, `listAgentIds`, `resolveAgentConfig`, `resolveAgentSkillsFilter`, `buildWorkspaceSkillStatus`, `resolveAgentWorkspaceDir`, `resolveDefaultAgentId`, `loadWorkspaceBootstrapFiles` + the `DEFAULT_*_FILENAME` constants from `../../../agents/workspace.js` (multiline import), `resolveOpenClawAgentDir` (currently imported by `deck-auth.ts` via depth-1 `../../agents/agent-paths.js`). **Does NOT own `loadConfig`** — that belongs to `config.service.ts`
- [x] 3.3 Implement `src/gateway/services/auth.service.ts` wrapping `buildAuthOverview` (from `../../agents/auth-diagnostics.js`), `runAuthProbes` and `AuthProbeResult` (from `../../commands/models/list.probe.js`). **Does NOT own session paths** — those belong to `sessions.service.ts`
- [x] 3.4 Implement `src/gateway/services/config.service.ts` wrapping `loadConfig`, `writeConfigFile`, `readConfigFileSnapshotForWrite`, `resolveConfigSnapshotHash` plus `OpenClawConfig`/`AgentBinding` type re-exports
- [x] 3.5 Implement `src/gateway/services/routing.service.ts` wrapping `resolveAgentRoute`, `RoutePeer` type, `parseAgentSessionKey`, `resolveAgentIdFromSessionKey`, `normalizeAgentId`, `getSubagentDepth`
- [x] 3.6 Implement `src/gateway/services/skills.service.ts` wrapping `listSkillCommandsForAgents`, `getChatCommands`, `ChatCommandDefinition` type, `listCoreToolSections`, `pickSandboxToolPolicy`, `resolveToolProfilePolicy`, `isToolAllowedByPolicyName`, `buildDefaultToolPolicyPipelineSteps`, `ToolPolicyPipelineStep` type
- [x] 3.7 Implement `src/gateway/services/subagents.service.ts` wrapping `abortEmbeddedPiRun`, `clearSessionQueues`, `AGENT_LANE_SUBAGENT`, `INTERNAL_MESSAGE_CHANNEL`, `callGateway`
- [x] 3.8 Implement `src/gateway/services/subagent-registry.service.ts` wrapping `getSubagentRunsForDeck`, `markSubagentRunTerminated`, `clearSubagentRunSteerRestart`, `markSubagentRunForSteerRestart`, `replaceSubagentRunAfterSteer`, `SubagentRunRecord` type
- [x] 3.9 Implement `src/gateway/services/plugins.service.ts` wrapping `buildPluginSnapshotReport` (from `../../../plugins/status.js`)
- [x] 3.10 Implement `src/gateway/services/sessions.service.ts` wrapping `loadSessionStore` (from `../../../config/sessions.js`), `resolveStorePath` and `resolveSessionTranscriptsDirForAgent` (from `../../../config/sessions/paths.js` — the latter is the `await import(...)` target at `deck-auth.ts:127-130`; **moved here from auth.service** because the import path is `config/sessions/paths.js`, not an auth concern), `resolveStateDir` (from `../../../config/paths.js`), `loadJsonFile` (from `../../../infra/json-file.js`)
- [x] 3.10b Document `DEFAULT_EVENT_STREAMS` from `src/gateway/channel-event-filter.js` (used at `src/gateway/server-methods/deck/agents.ts:16`) as an **escape hatch** in `src/gateway/services/README.md`. Rationale: it is a gateway-local fork-only constant, not an openclaw internal — handlers may import it directly
- [x] 3.11 Add `src/gateway/services/__tests__/contract.test.ts` covering every method on every service with realistic inputs (the canary that runs after every upstream rebase)
- [x] 3.12 Refactor `src/gateway/server-methods/deck/agents.ts` (546 LOC, largest) — first split into `deck-agents-detail.module.ts`, `deck-agents-skills.module.ts`, `deck-agents-subagents.module.ts`, `deck-agents-eventStreams.module.ts`, `deck-agents-preview-toolPolicy.module.ts`, `deck-agents-preview-systemPrompt.module.ts` (one method per file or close to it), then refactor each to consume services. The pre-split makes per-handler refactor reviewable
- [x] 3.13 Refactor `src/gateway/server-methods/deck/routing.ts` (423 LOC) — split into `deck-routing-list.module.ts`, `deck-routing-add.module.ts`, `deck-routing-remove.module.ts`, `deck-routing-validate.module.ts`, `deck-routing-simulate.module.ts`, then refactor to consume services
- [x] 3.14 Refactor `src/gateway/server-methods/deck/subagents.ts` (287 LOC) and `subagents-steer.ts` (210 LOC) to consume `subagentsService` + `subagentRegistryService`
- [x] 3.15 Refactor `src/gateway/server-methods/deck-auth.ts` (186 LOC) to consume `authService` + `agentsService`
- [x] 3.16 Refactor `src/gateway/server-methods/deck/identity.ts` (189 LOC) to consume `configService` + `agentsService`
- [x] 3.17 Refactor `src/gateway/server-methods/deck/commands.ts` (156 LOC) to consume `skillsService` + `agentsService` + `configService`
- [x] 3.18 Refactor `src/gateway/server-methods/deck/threads.ts` (101 LOC) to consume `sessionsService`
- [x] 3.19 Refactor `src/gateway/server-methods/deck/plugins.ts` (95 LOC) to consume `pluginsService`
- [x] 3.20 Refactor `src/gateway/server-methods/deck/utils.ts` (54 LOC), `agent-read-config.ts` (52 LOC), and `agents-preview.ts` (261 LOC) to consume services
- [x] 3.21 Run `node scripts/audit-gateway-service-coverage.ts` — exit 0 (no internal symbol consumed by a deck handler is unmapped to a service)
- [x] 3.22 Add `forkClass` and `bffEligible` annotations to every method's `methodDefs` entry (per spec `gateway-fork-handler-classification`)
- [x] 3.23 Run `node scripts/audit-fork-classifications.ts` — exit 0 with totals matching the locked table (C1=8, C2=11, C3=5, C4=9, C5=1, sum=34, after Phase 0 task 0.9 fixes the `deck.plugins.list` registry drift)
- [x] 3.24 Run `node scripts/diff-describe-baseline.ts` — assert allow-list-only diff (now `forkClass`/`bffEligible` should appear)
- [ ] 3.25 Run `pnpm test` (full deck handler test suite must remain green), `pnpm build`, `pnpm check` — deck handler regression tests, build, OpenSpec validation, `git diff --check`, and check pre-gates passed; `pnpm check` remains blocked by known unrelated Feishu/provider-usage baseline errors. See `verification.yaml` scenario `phase3.full-gates`.
- [ ] 3.26 Commit Phase 3

## 4. Phase 4 — Hot-path Module Split for `server-methods/models.ts`

- [x] 4.1 Read `src/gateway/server-methods/models.ts` and identify cohesive units in the +215 fork addition: (a) provider-provenance imports + helpers, (b) `models.configured` handler, (c) `modelsMethodDefs` taking ownership of `models.list` result-schema metadata
- [x] 4.2 Create `src/gateway/server-methods/models-configured.module.ts` + `models-configured.method-defs.ts` housing the `models.configured` handler + its metadata (consume `configService`, `agentsService`)
- [x] 4.3 Move provider-provenance helpers into a services-owned gateway helper (`src/gateway/services/model-provenance.ts`) referenced by the new module
- [x] 4.4 Move `modelsMethodDefs`'s `models.list` metadata extension into `models-list.method-defs.ts` (fork-only metadata extension; document the ownership in `services/README.md`)
- [x] 4.5 Investigate the `-1` line modification of upstream-authored `models.ts`: either revert (and optionally submit upstream PR), absorb into a service helper, or accept as residual fork-modification with a code comment
- [x] 4.6 Verify `git diff $BASE..HEAD -- src/gateway/server-methods/models.ts` shows zero fork-added lines (and only the residual `-1` if accepted)
- [x] 4.7 Run `pnpm test src/gateway/server-methods/`, `pnpm protocol:gen:check`, `pnpm build`
- [ ] 4.8 Commit Phase 4

## 5. Verification Gates and Final Audit

- [ ] 5.1 Re-run `pnpm check`, `pnpm test`, `pnpm build` end-to-end on a clean checkout — final audit passed build, protocol/config checks, method-module checks, cycle checks, targeted tests, and deck-go build; full `pnpm check` / `pnpm test` remain blocked by unrelated baseline failures. See `verification.yaml` scenario `phase5.final-audit`.
- [x] 5.2 Re-run `pnpm protocol:gen:check` — output must remain byte-identical to the baseline taken in task 0.2 (no public-RPC surface change in this proposal)
- [ ] 5.3 Run final fork-edit footprint audit: `git diff --name-only --diff-filter=M $BASE..HEAD -- src/gateway/ | grep -v test | wc -l` SHALL return ≤ 12 — blocked at 32 modified non-test gateway files; RCA classifies this as a Phase 5 metric/scope mismatch rather than a Phase 4 regression. See `.omc/research/rca-phase5-footprint-20260429-145451.md`.
- [ ] 5.4 Confirm specific zero-touch upstream files: `git diff $BASE..HEAD -- src/gateway/server-methods.ts src/gateway/server-methods-list.ts src/gateway/protocol/schema/{sessions,nodes,devices,agents-models-skills,protocol-schemas,cron,logs-chat,config,exec-approvals}.ts` returns no fork-added handler/list/schema lines — schema footprint and thin-entry checks passed, but the task remains unchecked because the original command still has intentional sibling re-export / thin wrapper diffs and needs the RCA-adjusted metric wording before closure.
- [x] 5.5 Confirm `git diff $BASE..HEAD -- src/gateway/server-methods/models.ts` returns no fork-added handler/methodDef lines (residual `-1` only if documented)
- [x] 5.6 Run service contract test suite (`src/gateway/services/__tests__/contract.test.ts`) — every service method exercised
- [x] 5.7 Run discovery determinism + duplicate detection tests
- [x] 5.8 Run service coverage + classification audits (both must exit 0)
- [x] 5.9 Snapshot post-refactor `gateway.describe` JSON; run `node scripts/diff-describe-baseline.ts` (allow-list-only diff: `forkClass`, `bffEligible`, `controlPlaneWrite`)
- [ ] 5.10 Verify dashboard and deck-go regenerated typed clients compile cleanly: `cd dashboard && pnpm tsgo` and `cd deck-go/backend && go build ./...` — split status: deck-go backend build passed; dashboard `pnpm tsgo` remains blocked by existing dashboard test/e2e typing baseline unrelated to the generated gateway typed client. See `verification.yaml` scenarios `phase5.deck-go-backend-compile` and `phase5.dashboard-typed-client-compile`.
- [ ] 5.11 Update `openspec/specs/gateway-communication/spec.md` archive (per OpenSpec apply workflow) to reflect the modified requirements

## 6. Optional Follow-ups (Not in This Change)

- [ ] 6.1 Draft upstream PR for `gateway-method-discovery` (auto-discovery + module manifest + `*.method-defs.ts` side-effect-free pattern)
- [ ] 6.2 Land the separate proposal `openclaw-gateway-batch-rpc-primitive` (the `gateway.batch` RPC primitive that was carved out of this proposal). That proposal handles:
  - acyclic dispatcher design (forbid nested `gateway.batch`)
  - per-sub-call scope / control-plane budget enforcement (relies on the `controlPlaneWrite` flag added in 2.22)
  - typed-client codegen for `dashboard` and `deck-go`
- [ ] 6.3 Open separate proposal: deck-go BFF view layer for the 5 C3-eligible handlers (`deck.routing.list`, `deck.subagents.list`, `deck.subagents.lineage`, `deck.identity.list`, `deck.threads.list`); requires 6.2 to ship first
- [ ] 6.4 Open separate proposal: deck-go `gateway_queries.go` thin-wrapper retirement
- [ ] 6.5 Open separate proposal: extraction of `deploy/seed/` to its own repository
