## Context

### Current state (verified against `0c0463b2b7` rebase base)

The fork's gateway layer accumulated changes in three intertwined ways:

1. **Add-only registration sprawl.** `src/gateway/server-methods.ts` now spreads 33 named handler bundles into `coreGatewayHandlers` (verified by reading lines 87–119), and `buildMethodRegistry` is called with 13 bundle imports. Every new fork-only handler requires editing two adjacent positions in this file plus one append in `server-methods-list.ts`. Upstream is also actively editing this file (verified: `git diff $BASE..upstream/main -- src/gateway/server-methods.ts` = +10/-0 in 14 days), and the two streams of edits will keep colliding.

2. **Positional schema appends.** Ten upstream `protocol/schema/*.ts` files received fork content appended at the end (`sessions.ts +320/-0`, `nodes.ts +141/-0`, `protocol-schemas.ts +125/-0`, `agents-models-skills.ts +118/-0`, `devices.ts +114/-0`, `protocol/index.ts +100/-0`, `cron.ts +72/-0`, `logs-chat.ts +39/-1`, `config.ts +34/-3`, `exec-approvals.ts +28/-0`). Upstream rewrote 6 of these 10 files in the past 14 days (subset overlap verified by `comm -12` of fork-modified vs. upstream-modified file lists in `src/gateway/`). Conflict probability per rebase is high.

3. **Deep internal coupling in deck handlers.** `src/gateway/server-methods/deck/*.ts` and `deck-auth.ts` import 33 distinct symbols from 14 internal openclaw modules (verified: `grep '^import.*from "\.\./\.\./\.\./' src/gateway/server-methods/deck/*.ts | sort -u | wc -l` → 33). Internal symbols include `loadConfig`, `writeConfigFile`, `listAgentEntries`, `resolveAgentSkillsFilter`, `buildWorkspaceSkillStatus`, `pickSandboxToolPolicy`, `resolveToolProfilePolicy`, `resolveAgentRoute`, `parseAgentSessionKey`, `resolveAgentIdFromSessionKey`, `getChatCommands`, `loadSessionStore`, `clearSessionQueues`, `abortEmbeddedPiRun`, `loadWorkspaceBootstrapFiles`, etc. Upstream rebases that rename any of these break the fork.

### Stakeholders

- **fork maintainers** (own rebase pain, want minimum churn)
- **deck-go team** (own typed client + 127 wrappers, want stable contract)
- **dashboard team** (in deprecation, but still consuming `deck.*`; transparent change required)
- **upstream openclaw maintainers** (potential PR audience for discovery + batch + service interfaces; do not assume acceptance)

### Constraints

- **Prompt cache stability** (CLAUDE.md): "Make ordering deterministic for any code assembling model/tool payloads from maps, sets, registries, or network results." The discovery loop and batch dispatch must produce byte-stable output across runs.
- **No breaking change to public RPC**: dashboard and deck-go must keep working without recompilation.
- **No skipped hooks** (CLAUDE.md `pnpm check`, `pnpm test`, `pnpm build` gates).
- **deck-go-side wrapper layer** (`gateway_queries.go`, 113 typed calls) is out of scope for _this_ proposal but must not be invalidated.

## Goals / Non-Goals

**Goals:**

- Reduce fork-modified upstream files in `src/gateway/` from **37 → ≤ 12** (measured by `git diff --name-only --diff-filter=M $BASE..enhanced -- src/gateway/`).
- Reduce per-rebase conflict resolution time by an order of magnitude on the registration / schema surfaces.
- Decouple deck handlers from openclaw internal symbol churn via a service interface boundary that is testable in isolation.
- Annotate every fork-only handler with a forkClass + bffEligible field so future BFF migration becomes a tracked, evidence-based decision rather than a guess.
- Preserve byte-stable codegen output for prompt cache (deterministic ordering at every aggregation point); preserve the side-effect-free guarantee on the codegen metadata manifest.
- Keep the path to upstream PR open for the most generic piece (`gateway-method-discovery`).

**Non-Goals:**

- **Adding the `gateway.batch` RPC primitive** — handed to the separate proposal `openclaw-gateway-batch-rpc-primitive` so that the public-RPC surface evolution does not get bundled with fork-conflict treatment.
- Moving any C3 handler to deck-go in this change. The mechanism is laid; actual migration is a separate proposal contingent on `gateway.batch` shipping.
- Adding a hook system for `server-chat.ts`, `message-handler.ts`, or `server-runtime-subscriptions.ts` edits — confirmed too small to justify (`+8/-0`, `+6/-2`, `+0/-0` respectively after using the correct rebase base).
- Refactoring `transcript-canonical`, `channel-event-filter`, or `wizard-spec` out of fork ownership. Their continued fork-only existence is fine; future upstream PRs are tracked separately.
- Removing `gateway_queries.go` thin wrappers in deck-go (deferred to follow-up proposal "deck-go BFF wrapper retirement").
- Splitting `deploy/seed/` into a separate repository (logistical, non-architectural).

## Decisions

### D1: Module-based auto-discovery — runtime manifest separated from codegen manifest

**Decision.** Replace the static `coreGatewayHandlers = { ...connectHandlers, ..., ...deckHandlers, ...describeHandlers }` aggregation in `src/gateway/server-methods.ts` with a discovery loop that walks `src/gateway/server-methods/**/*.module.ts` (runtime handlers) and `src/gateway/server-methods/**/*.method-defs.ts` (side-effect-free metadata), validates each export, and merges them in sorted order. **The runtime and metadata manifests live in separate files** to preserve the existing side-effect-free guarantee on `method-registry-data.ts` (verified at `method-registry-data.ts:1-6`: "Side-effect-free export for codegen consumption. MUST NOT import modules with side-effects at module scope.").

**Two-manifest contract:**

```typescript
// Side-effect-free metadata: every *.method-defs.ts exports:
export interface GatewayMethodMetadataModule {
  readonly name: string;                       // matches the sibling *.module.ts
  readonly methodDefs: Record<string, MethodMetadata>;
  readonly events?: Record<string, EventDefinition>;
  readonly priority?: number;
}
export const metadata: GatewayMethodMetadataModule = { ... };

// Runtime handlers: every *.module.ts exports:
export interface GatewayMethodModule {
  readonly name: string;                       // matches the sibling *.method-defs.ts
  readonly handlers: GatewayRequestHandlers;
  // The module re-exports the paired metadata so consumers can construct a registry from a single file:
  readonly metadata: GatewayMethodMetadataModule;
  readonly priority?: number;                  // optional, default 100
}
export const module: GatewayMethodModule = { ... };
```

**Two generated manifests:**

- `src/gateway/server-methods/_method-defs.generated.ts` — statically imports every `*.method-defs.ts`. Consumed by `method-registry-data.ts` and codegen scripts. **Must remain side-effect-free**; CI runs `bun -e 'import("./src/gateway/server-methods/_method-defs.generated.ts")'` and observes no runtime side effects (mirrors the existing pattern at `method-registry-data.ts:5`).
- `src/gateway/server-methods/_modules.generated.ts` — statically imports every `*.module.ts`. Consumed by `server-methods.ts` for runtime handler aggregation.

**Aggregation algorithm (sketch):**

```typescript
function loadGatewayMethodModules() {
  const modules = ALL_RUNTIME_MODULES.slice() // from _modules.generated.ts
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100) || a.name.localeCompare(b.name));

  const handlers: GatewayRequestHandlers = {};
  const methodDefs: Record<string, MethodMetadata> = {};
  const events: Record<string, EventDefinition> = {};
  const seenMethods = new Set<string>();
  for (const m of modules) {
    for (const k of Object.keys(m.handlers)) {
      if (seenMethods.has(k)) {
        throw new Error(`duplicate gateway method ${k} from module ${m.name}`);
      }
      seenMethods.add(k);
    }
    Object.assign(handlers, m.handlers);
    Object.assign(methodDefs, m.metadata.methodDefs);
    if (m.metadata.events) Object.assign(events, m.metadata.events);
  }
  return { handlers, methodDefs, events };
}
```

**Why this design over alternatives:**

- _vs. keeping the static spread_: Every fork addition mutates `server-methods.ts`. After 14 days of upstream churn this file accumulated +10 upstream lines on top of the fork's +48/-3, and the next rebase will conflict. Discovery removes the file as a contention point.
- _vs. one combined `_.module.ts`exporting both handlers and methodDefs*: Would force codegen to import handler modules, breaking the side-effect-free guarantee at`method-registry-data.ts:1-6`. The two-manifest split preserves this guarantee.
- _vs. dynamic `import()` at request time_: Per-request import would defeat the prompt cache and add latency. Module aggregation runs once at startup.
- _vs. file-system glob at startup_: Considered too magical. Build-time generators (`scripts/gen-method-modules.ts`) produce static `_modules.generated.ts` and `_method-defs.generated.ts`, which the runtime/codegen import statically. This keeps tree-shaking honest and runtime startup fast.

**Build hook.** `package.json` does **not** have a `prebuild` script (verified). Wire `gen-method-modules.ts` into `scripts/build-all.mjs` (the script invoked by `"build": "node scripts/build-all.mjs"`), and add `check:method-modules-up-to-date` to `pnpm check` to fail CI when the generated files are stale.

**Dispatcher core extraction (enables future batch primitive without import cycle).** Today `handleGatewayRequest` lives in `src/gateway/server-methods.ts:147` and combines (a) authorization (`authorizeGatewayMethod`), (b) unavailable-method check, (c) control-plane write budget, (d) handler lookup from `coreGatewayHandlers`, (e) `withPluginRuntimeGatewayRequestScope` invocation. Phase 2 of this proposal extracts the **logic** (a)–(c) and (e) into `src/gateway/server-methods/dispatcher.ts` as `dispatchGatewayRequest({ handlers, ...opts })`, where `handlers` is passed in (not imported). `server-methods.ts` becomes a thin caller that passes `{ ...coreGatewayHandlers, ...opts.extraHandlers }` to the dispatcher.

```typescript
// src/gateway/server-methods/dispatcher.ts (new)
export interface DispatchGatewayRequestOpts extends GatewayRequestOptions {
  handlers: GatewayRequestHandlers;
}
export async function dispatchGatewayRequest(opts: DispatchGatewayRequestOpts): Promise<void> {
  // (a) authorize, (b) check unavailable, (c) budget, look up handler in opts.handlers, (e) wrap in plugin scope
  // — exactly the existing handleGatewayRequest body, parameterized by opts.handlers.
}

// src/gateway/server-methods.ts (after Phase 2)
import { dispatchGatewayRequest } from "./server-methods/dispatcher.js";
export async function handleGatewayRequest(
  opts: GatewayRequestOptions & { extraHandlers? },
): Promise<void> {
  const handlers = { ...coreGatewayHandlers, ...opts.extraHandlers };
  await dispatchGatewayRequest({ ...opts, handlers });
}
```

**Why this matters now (not later).** The separate `openclaw-gateway-batch-rpc-primitive` proposal needs a low-level dispatcher that does NOT import `_modules.generated.ts`, otherwise its `gateway-batch.module.ts` participates in a cycle: `server-methods.ts` → `_modules.generated.ts` → `gateway-batch.module.ts` → `dispatcher.ts` → `server-methods.ts`. Extracting `dispatcher.ts` here, in this proposal, gives the batch primitive a true bottom-of-stack helper. **Cycle proof**: `dispatcher.ts` imports only from `control-plane-rate-limit.js`, `control-plane-audit.js`, `method-scopes.js`, `protocol/index.js`, `role-policy.js`, `plugins/runtime/gateway-request-scope.js` — none of which import `server-methods.ts` or any handler module.

**Context augmentation.** To let the batch handler re-invoke `dispatchGatewayRequest` for sub-calls without importing the handler manifest, `GatewayRequestContext` adds a new field `handlers?: GatewayRequestHandlers` populated by the outer `handleGatewayRequest` before invocation. The batch handler reads `context.handlers` and passes it back to `dispatchGatewayRequest` per sub-call. This keeps the batch handler's import surface limited to `dispatcher.ts` (sibling) only.

**Cache stability.** Sort by `(priority, name)`. The generated manifests are deterministic; a regression test asserts `JSON.stringify(loadGatewayMethodModules()) === expectedFixture` and shuffles the source list before generation to detect ordering regressions.

**Fail-fast.** Duplicate method registration throws at startup with the offending module names. CI runs `node scripts/check-method-modules.ts` to surface this in `pnpm check`.

### D2: Sibling `*-extensions.ts` for fork-added schemas

**Decision.** For every upstream `src/gateway/protocol/schema/<name>.ts` that the fork extends, create a sibling `src/gateway/protocol/schema/<name>-extensions.ts` containing only the fork-added exports. Re-export from the existing single-file barrel `src/gateway/protocol/schema.ts` (verified location — there is **no** `protocol/schema/index.ts` in this codebase). For symbols moved to a sibling that have pre-existing direct importers (notably `protocol/index.ts:528-554` imports the deck schema directly from `./schema/deck.js`), preserve the consumer either by (a) keeping a compat re-export in the upstream file, or (b) migrating the consumer to the barrel in the same phase.

**Files affected:**

| Upstream file                             | Fork append | Becomes                                                                                               |
| ----------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------- |
| `protocol/schema/sessions.ts`             | +320        | `protocol/schema/sessions-extensions.ts` (new, +320 lines moved)                                      |
| `protocol/schema/nodes.ts`                | +141        | `nodes-extensions.ts`                                                                                 |
| `protocol/schema/protocol-schemas.ts`     | +125        | `protocol-schemas-extensions.ts`                                                                      |
| `protocol/schema/agents-models-skills.ts` | +118        | `agents-models-skills-extensions.ts`                                                                  |
| `protocol/schema/devices.ts`              | +114        | `devices-extensions.ts`                                                                               |
| `protocol/index.ts`                       | +100        | `protocol/index-extensions.ts` re-exported by `protocol/index.ts` (+1 line)                           |
| `protocol/schema/cron.ts`                 | +72         | `cron-extensions.ts`                                                                                  |
| `protocol/schema/logs-chat.ts`            | +39/-1      | `logs-chat-extensions.ts` (the `-1` line stays in upstream file as a fork modification — see Risk R3) |
| `protocol/schema/config.ts`               | +34/-3      | `config-extensions.ts` (the `-3` is a fork modification — see R3)                                     |
| `protocol/schema/exec-approvals.ts`       | +28         | `exec-approvals-extensions.ts`                                                                        |

**Barrel update.** `src/gateway/protocol/schema.ts` adds one `export * from "./<name>-extensions.js"` per affected file (≤ 10 lines added to the barrel total).

**Why this design over alternatives:**

- _vs. keeping appends_: Upstream actively edits these files. Verified overlap: 6 of these 10 files were also touched by upstream in the last 14 days. Sibling files eliminate positional collisions.
- _vs. one giant `protocol/schema/fork-extensions.ts`_: Would lose the per-domain locality. Reading "where are the sessions extensions" stays trivial when colocated with `sessions.ts`.
- _vs. moving fork content into a separate top-level `protocol/schema-fork/` directory_: More invasive imports across the codebase. The sibling pattern keeps imports stable (`from "./sessions-extensions.js"` is a one-liner add; everything else continues to import from `./sessions.js` or the existing barrel `protocol/schema.ts`).

**Verification that this works.** `protocol/schema/sessions.ts` head (verified by reading) is pure TypeBox schema with `Type.Object({...})` exports. The fork's appended exports use the same module-scope export style, so moving them to a sibling and re-exporting via the barrel preserves all consumer imports. The deck schema direct-import block at `protocol/index.ts:528-554` already imports from `./schema/deck.js` (a fork-only file, not affected by sibling-split), so it requires no change.

### D3: Service interface layer

**Decision.** Introduce `src/gateway/services/<domain>.service.ts` files that wrap **every** openclaw internal symbol consumed by deck handlers (including `deck-auth.ts`, which lives at `server-methods/` depth and uses `../../` imports). The exact service set is generated by `scripts/audit-gateway-service-coverage.ts` using the TypeScript Compiler API to parse imports — **not** by text grep, which misses multiline imports and depth-1 paths.

**Initial service set (boundaries cleaned per Codex R2 §B):**

- `agents.service.ts` — `listAgentEntries`, `listAgentIds`, `resolveAgentConfig`, `resolveAgentSkillsFilter`, `buildWorkspaceSkillStatus`, `resolveAgentWorkspaceDir`, `resolveDefaultAgentId`, `loadWorkspaceBootstrapFiles` and `DEFAULT_*_FILENAME` constants (multiline import from `../../../agents/workspace.js`), `resolveOpenClawAgentDir` (currently imported by `deck-auth.ts` via depth-1 `../../agents/agent-paths.js`). **Does not own `loadConfig`** — that belongs to `config.service`; if a method needs both, it injects both services.
- `auth.service.ts` — `buildAuthOverview` (from `../../agents/auth-diagnostics.js`), `runAuthProbes` and `AuthProbeResult` (from `../../commands/models/list.probe.js`). **Does not own session paths** — see `sessions.service`.
- `config.service.ts` — `loadConfig`, `writeConfigFile`, `readConfigFileSnapshotForWrite`, `resolveConfigSnapshotHash`. Plus `OpenClawConfig` and `AgentBinding` type re-exports for handler convenience.
- `sessions.service.ts` — `loadSessionStore` (from `../../../config/sessions.js`), `resolveStorePath` and `resolveSessionTranscriptsDirForAgent` (from `../../../config/sessions/paths.js` — the latter is the `await import(...)` target at `deck-auth.ts:127-130`; **moved here from auth.service** because the import path is `config/sessions/paths.js`, not an auth concern), `resolveStateDir` (from `../../../config/paths.js`), `loadJsonFile` (from `../../../infra/json-file.js`).
- `routing.service.ts` — `resolveAgentRoute`, `RoutePeer` type (from `../../../routing/resolve-route.js`), `normalizeAgentId`, `parseAgentSessionKey`, `resolveAgentIdFromSessionKey`, `getSubagentDepth` (from `../../../routing/session-key.js`).
- `skills.service.ts` — `getChatCommands`, `ChatCommandDefinition` type (from `../../../auto-reply/commands-registry*.js`), `listSkillCommandsForAgents`, `listCoreToolSections`, `pickSandboxToolPolicy`, `resolveToolProfilePolicy`, `isToolAllowedByPolicyName`, `buildDefaultToolPolicyPipelineSteps`, `ToolPolicyPipelineStep` type.
- `subagents.service.ts` — `abortEmbeddedPiRun`, `clearSessionQueues`, `AGENT_LANE_SUBAGENT`, `INTERNAL_MESSAGE_CHANNEL`, `callGateway`.
- `subagent-registry.service.ts` — `getSubagentRunsForDeck`, `markSubagentRunTerminated`, `markSubagentRunForSteerRestart`, `clearSubagentRunSteerRestart`, `replaceSubagentRunAfterSteer`, `SubagentRunRecord` type.
- `plugins.service.ts` — `buildPluginSnapshotReport` (from `../../../plugins/status.js`).

**Documented escape hatch (services/README.md).** `DEFAULT_EVENT_STREAMS` from `../../channel-event-filter.js` (used at `src/gateway/server-methods/deck/agents.ts:16`) is a **gateway-local** constant (the channel-event-filter module is a fork-only file inside `src/gateway/`, not an openclaw internal). It is not wrapped in a service interface; it is consumed directly. `services/README.md` MUST list this as the documented escape hatch with rationale ("gateway-local constant, not openclaw internal").

**Audit (binding contract):** `scripts/audit-gateway-service-coverage.ts` enumerates every internal symbol consumed by `src/gateway/server-methods/deck/**/*.ts` and `src/gateway/server-methods/deck-auth.ts` (handling depth-1 `../../`, depth-3 `../../../`, multiline imports, and dynamic imports). It exits non-zero if any consumed symbol is not reachable through a service interface. Documented in `services/README.md` with explicit listing of any intentional escape hatches.

**Service shape (one example):**

```typescript
// src/gateway/services/agents.service.ts
import { loadConfig as _loadConfig } from "../../config/config.js";
import { listAgentEntries as _listAgentEntries /* ... */ } from "../../agents/agent-scope.js";

export interface AgentsService {
  readonly version: 1;
  loadConfigSnapshot(): OpenClawConfig;
  listEntries(): readonly AgentEntry[];
  resolveDefaultId(cfg?: OpenClawConfig): string | undefined;
  resolveSkillsFilter(agentId: string): SkillsFilter;
  workspaceSkillStatus(agentId: string): SkillsStatus;
  workspaceDir(agentId: string): string;
  loadBootstrapFiles(agentId: string): BootstrapFiles;
}

export function createAgentsService(): AgentsService {
  return {
    version: 1,
    loadConfigSnapshot: () => _loadConfig(),
    listEntries: () => _listAgentEntries(),
    resolveDefaultId: (cfg) => _resolveDefaultAgentId(cfg ?? _loadConfig()),
    resolveSkillsFilter: (id) => _resolveAgentSkillsFilter(_loadConfig(), id),
    workspaceSkillStatus: (id) => _buildWorkspaceSkillStatus(_loadConfig(), id),
    workspaceDir: (id) => _resolveAgentWorkspaceDir(_loadConfig(), id),
    loadBootstrapFiles: (id) => _loadWorkspaceBootstrapFiles(_loadConfig(), id),
  };
}
```

**Why this design over alternatives:**

- _vs. continuing to import internals directly_: Couples deck handler maintenance to upstream internal renames (e.g., if upstream renames `loadConfig` → `loadConfigSnapshot`, every handler breaks). The service interface absorbs the rename in one place.
- _vs. RPC-ifying internals_: Would push 5–10 extra round-trips per deck handler call. Service interfaces are in-process function calls; zero perf cost.
- _vs. dependency injection container_: Overengineered for ≤ 7 services. Plain factory functions that return interface objects keep code obvious and testable.

**Versioning.** Each service exports `version: 1`. Breaking changes bump the version and add a `version: 2` factory; consumers migrate explicitly. Contract test asserts that `createAgentsService().version === 1` to detect accidental drift.

**Contract tests (post-rebase smoke).** `services/__tests__/contract.test.ts` constructs each service and exercises every method with realistic inputs. This is the canary that runs after every upstream rebase and surfaces internal API breakage immediately.

### D4: Fork-only handler classification standard

**Decision.** Every fork-only RPC handler is classified as one of:

- **C1 — Composition view**: Reads from ≥ 3 distinct internal **service namespaces** (counting per-service, not per-method) and joins their output. Stays gateway. Examples: `deck.agents.detail`, `deck.commands.discover`.
- **C2 — Mutation**: Calls `writeConfigFile`, `clearSessionQueues`, `abortEmbeddedPiRun`, `markSubagentRunTerminated`, `markSubagentRunForSteerRestart`, or otherwise mutates openclaw state. Stays gateway.
- **C3 — Light view**: Reads from 1–2 distinct internal service namespaces and applies trivial filter/sort/shape. Annotated `bffEligible: true`. Stays gateway in this proposal; future migration to deck-go BFF depends on a separate `gateway.batch` proposal landing first.
- **C4 — Business rule**: Replicates openclaw decision logic (toolPolicy, system prompt, routing simulation/validation, plugin snapshot, auth aggregation/probing). Strictly stays gateway.
- **C5 — Infrastructure / introspection**: Exposes gateway-protocol-layer functionality (registry introspection, capability discovery, future batch dispatch) whose target is the gateway itself rather than an openclaw domain. Strictly stays gateway. Example: `gateway.describe`.

**Per-method classification (all 26 fork-only deck methods + `gateway.describe` + 6 non-deck fork methods):**

| Method                             | Class  | Rationale (services / mutations / role)                                                                                                                                                                | Action                    |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| `deck.auth.overview`               | C4     | Replicates auth aggregation: `buildAuthOverview` decision logic                                                                                                                                        | Stay; service: `auth`     |
| `deck.auth.probe`                  | C4     | Replicates provider probe decision logic: `runAuthProbes`                                                                                                                                              | Stay; service: `auth`     |
| `deck.commands.discover`           | C1     | `skillsService` + `agentsService` + `configService` (3 namespaces)                                                                                                                                     | Stay                      |
| `deck.routing.list`                | **C3** | Reads `configService` + `agentsService.resolveDefaultId` only; local enrichment / filter / sort. Re-classified from C1 after code verification (`routing.ts:156-201` has no `resolveAgentRoute` call). | Stay; `bffEligible: true` |
| `deck.routing.add`                 | C2     | `configService.writeConfigFile`                                                                                                                                                                        | Stay                      |
| `deck.routing.remove`              | C2     | `configService.writeConfigFile`                                                                                                                                                                        | Stay                      |
| `deck.routing.validate`            | C4     | Replicates upstream routing rule check                                                                                                                                                                 | Stay; service: `routing`  |
| `deck.routing.simulate`            | C4     | Replicates `resolveAgentRoute` decision logic                                                                                                                                                          | Stay; service: `routing`  |
| `deck.agents.detail`               | C1     | `agentsService` + `configService` + `skillsService` (3 namespaces)                                                                                                                                     | Stay                      |
| `deck.agents.skills.get`           | C1     | `agentsService` + `skillsService` + `configService` (3 namespaces)                                                                                                                                     | Stay                      |
| `deck.agents.skills.set`           | C2     | `configService.writeConfigFile`                                                                                                                                                                        | Stay                      |
| `deck.agents.subagents.get`        | C1     | `agentsService` + `subagentsService` + `configService` (3 namespaces)                                                                                                                                  | Stay                      |
| `deck.agents.subagents.set`        | C2     | `configService.writeConfigFile`                                                                                                                                                                        | Stay                      |
| `deck.agents.toolPolicy.preview`   | C4     | Replicates `pickSandboxToolPolicy` + `resolveToolProfilePolicy` + `isToolAllowedByPolicyName` decision logic                                                                                           | Stay                      |
| `deck.agents.systemPrompt.preview` | C4     | Replicates prompt rendering with variable substitution                                                                                                                                                 | Stay                      |
| `deck.agents.eventStreams.get`     | C4     | Reads + applies default rules logic                                                                                                                                                                    | Stay                      |
| `deck.agents.eventStreams.set`     | C2     | `configService.writeConfigFile`                                                                                                                                                                        | Stay                      |
| `deck.subagents.list`              | C3     | `subagentRegistryService.getSubagentRunsForDeck` + light enrichment                                                                                                                                    | Stay; `bffEligible: true` |
| `deck.subagents.kill`              | C2     | `subagentsService.abortEmbeddedPiRun` + `subagentRegistryService.markSubagentRunTerminated`                                                                                                            | Stay                      |
| `deck.subagents.lineage`           | C3     | Pulls parent chain from `subagentRegistryService`                                                                                                                                                      | Stay; `bffEligible: true` |
| `deck.subagents.steer`             | C2     | `subagentsService.clearSessionQueues` + multiple `subagentRegistry` mutations                                                                                                                          | Stay                      |
| `deck.identity.list`               | C3     | Reads identity table + light enrichment                                                                                                                                                                | Stay; `bffEligible: true` |
| `deck.identity.link`               | C2     | `configService.writeConfigFile`                                                                                                                                                                        | Stay                      |
| `deck.identity.unlink`             | C2     | `configService.writeConfigFile`                                                                                                                                                                        | Stay                      |
| `deck.threads.list`                | C3     | `sessionsService.loadSessionStore` + filter                                                                                                                                                            | Stay; `bffEligible: true` |
| `deck.plugins.list`                | C4     | Replicates `buildPluginSnapshotReport` decision logic                                                                                                                                                  | Stay; service: `plugins`  |
| `gateway.describe`                 | **C5** | Registry introspection — gateway-protocol layer, not openclaw domain. Re-classified from C4.                                                                                                           | Stay (codegen dependency) |
| `models.catalog.providers`         | C4     | `KNOWN_PROVIDER_DEFAULTS` aggregation                                                                                                                                                                  | Stay                      |
| `models.configured`                | C1     | `configService` + provider provenance + `agentsService` (3 namespaces)                                                                                                                                 | Stay                      |
| `sessions.usage`                   | C1     | `sessionsService` aggregation across config + log + agents                                                                                                                                             | Stay                      |
| `sessions.usage.logs`              | C1     | `sessionsService` log scan                                                                                                                                                                             | Stay                      |
| `sessions.usage.timeseries`        | C1     | `sessionsService` timeseries aggregation                                                                                                                                                               | Stay                      |
| `sessions.clear`                   | C2     | `subagentsService.clearSessionQueues` + state reset                                                                                                                                                    | Stay                      |
| `sessions.steer`                   | C2     | Live session steer mutation                                                                                                                                                                            | Stay                      |

**Result.** Of 34 fork-only methods (after Phase 0 fixes the `deck.plugins.list` registry drift — see tasks): **C1 = 8, C2 = 11, C3 = 5, C4 = 9, C5 = 1**. **5 are C3-eligible** annotation for future BFF migration. **0 are migrated in this proposal.**

### D5: Hot-path module split for `server-methods/models.ts`

**Decision.** The fork's `+215/-1` addition to `src/gateway/server-methods/models.ts` is **not** a single atomic block. It is composed of:

1. New imports + helper functions for provider provenance (lines added at file head and around helpers).
2. The new `models.configured` handler (a complete fork-only handler).
3. `modelsMethodDefs` taking ownership of the `models.list` result-schema metadata that the fork now wants to type.
4. The single `-1` line — a real fork modification of an upstream-authored function (must be investigated case-by-case).

The split MUST extract: (a) `models.configured` handler into a new `models-configured.module.ts`, (b) provider-provenance helpers into `services/model-provenance.service.ts` (or a sibling helper file), (c) `modelsMethodDefs` content for `models.list` into a new `models-list.method-defs.ts` whose ownership is documented as fork-only metadata extension. The `-1` line is investigated as a separate task and either reverted (with optional upstream PR), absorbed into the service helper, or accepted as a residual fork-modification with a code comment.

**Naming choice (resolves OQ4).** Use the `*.module.ts` and `*.method-defs.ts` patterns (D1 territory) for the extracted handler and metadata, not the `*-extensions.ts` schema pattern (D2 territory). Rationale: the carved content is registration territory, not schema territory.

**Why this is special-cased.** Upstream rewrote `models.ts` by **+1244 lines in 14 days** (verified). This is the highest-velocity hot-path file the fork touches. Carving the additive content out is the highest-leverage rebase improvement on this file; the residual single-line modification is bounded and visible.

### D6: Migration sequencing

**Decision.** Phases 1 → 2 → 3 → 4 in this order. Each phase produces a green build and ships independently:

1. **Schema sibling-split (Phase 1).** Touches no runtime behavior. Lowest risk. Surfaces any tooling assumption about schema file paths early.
2. **Auto-discovery + module manifest (Phase 2).** Replaces the static spread without changing what is registered. Establishes the runtime/manifest split (`*.module.ts` vs `*.method-defs.ts`) that preserves the existing `method-registry-data.ts` no-side-effects guarantee.
3. **Service interface layer + deck handler refactor (Phase 3).** Largest LOC change but isolated to fork-only files. Drives `audit-gateway-service-coverage.ts` against the deck handler set (including `deck-auth.ts` at `../../` depth).
4. **Hot-path split for `models.ts` (Phase 4).** Carves additive content out of the highest-velocity upstream file. Smallest in scope but highest-leverage on rebase pain.

**Why this order:**

- Phase 1 first because it's the most rebase-blocking and the most independent (no behavior change).
- Phase 2 before Phase 3 because once handlers are discovered, refactoring them no longer touches the registration site at all.
- Phase 4 last because it depends on the discovery scaffolding (Phase 2) being in place to receive the carved-out modules.

### D7: Cache stability discipline

**Decision.** Every aggregation point (D1 module merge, D2 schema barrel re-export) sorts inputs deterministically. Two regression tests are required:

1. **Same-implementation byte-stability**: `gateway.describe` JSON output is byte-identical across two consecutive invocations against an unchanged registry.
2. **Pre/post-migration bounded diff**: A baseline `gateway.describe` JSON snapshot is captured in Phase 0; after each phase, the snapshot is re-captured and `scripts/diff-describe-baseline.ts` asserts that the JSON-pointer-level differences fall within a documented allow-list (initially: `forkClass`, `bffEligible`).

**Why.** CLAUDE.md mandates: "Make ordering deterministic for any code assembling model/tool payloads from maps, sets, registries, or network results. ... Cache-sensitive changes require a regression test proving prefix stability." `gateway.describe` is a model-facing payload through the protocol introspection path, so its output ordering must remain stable, and the migration must not silently change the payload shape.

## Risks / Trade-offs

- **R1: Discovery-loop module ordering drift breaks prompt cache** → Sort by `(priority, name)`; fixture-based regression test in `__tests__/discovery-determinism.test.ts`; CI fails on diff.
- **R2: Discovery breaks the existing side-effect-free guarantee on `method-registry-data.ts`** → Split the runtime handler manifest from the metadata manifest at the file level (`*.module.ts` for runtime, `*.method-defs.ts` for codegen). Add a CI assertion that imports the metadata manifest and observes no runtime side effects (mirrors the existing `bun -e 'import(...)'` pattern at `method-registry-data.ts:5`).
- **R3: Schema sibling-split cannot capture small `-1` / `-3` modifications** (`logs-chat.ts -1`, `config.ts -3`, `models.ts -1`) → These are real fork modifications, not appends. Each requires individual investigation: either upstream PR if benign, or absorb into service interface, or accept residual fork modification on those specific lines.
- **R4: Service interface introduces an indirection that obscures debugging** → Mitigation: services are thin (each method ≤ 5 lines, mostly forwarding). Stack traces still point to internal modules. Documented in `services/README.md`.
- **R5: Discovery startup cost** → Module list is generated at build time (`scripts/gen-method-modules.ts`); runtime imports a static `_modules.generated.ts`. Zero filesystem walk at startup. `[UNVERIFIED]` against tsdown bundling — covered as a Phase 2 verification task.
- **R6: Upstream renames the internal symbols a service interface wraps** → Contract tests run on every rebase and fail loudly. Maintenance cost moves from "every handler" to "one service file."
- **R7: Module manifest generator becomes a chokepoint for codegen** → Same chokepoint already exists for `pnpm protocol:gen:ts`. Adding a sibling generator is mechanical.
- **R8: BFF migration of C3 handlers is _not_ delivered in this proposal** → Acknowledged. The point of this change is to _annotate_ migration eligibility, not to migrate. Migration depends on the separate `gateway.batch` proposal landing first plus a separate deck-go BFF proposal.
- **R9: Service-coverage audit may miss internal symbols imported via depth-1 (`../../`) paths or multiline imports** → Use TypeScript Compiler API (`ts.preProcessFile`) in `audit-gateway-service-coverage.ts`, not text grep. Test the audit against `deck-auth.ts` (depth 1) and the multiline-import handlers (`deck/agents.ts`, `deck/subagents-steer.ts`) explicitly.
- **R10: `prebuild` hook does not exist in `package.json`** → Wire the generator into `scripts/build-all.mjs` (the script invoked by `"build"`) and add a `check:method-modules-up-to-date` guard inside `pnpm check`. Do not invent a `prebuild` script.
- **R11: `CONTROL_PLANE_WRITE_METHODS` only covers 3 upstream methods** (`config.apply`, `config.patch`, `update.run` — verified at `server-methods.ts:33`); fork-added C2 config-write methods are not protected → As part of Phase 2.E, mark the explicit 10-method list (3 upstream + 7 fork-config-write per task 2.22) via a `controlPlaneWrite: true` flag on the method-def, and switch `CONTROL_PLANE_WRITE_METHODS` to derive from the registry: `new Set(gatewayMethodRegistry.listMethods().filter(m => gatewayMethodRegistry.getDefinition(m)?.controlPlaneWrite === true))`. **Note:** `MethodRegistry.methods` is a `ReadonlyMap` (verified `method-registry.ts:44-46`), so `listMethods()` / `getDefinition(...)` is the correct API — not `Object.keys(...)`. Documented in spec `gateway-communication`. (Note: the practical impact only fires when a write-batch primitive lands in the separate `gateway.batch` proposal — this proposal lays the metadata.)

## Migration Plan

**Per-phase rollout (each phase is one or more PRs to `enhanced`):**

0. **Phase 0 — Baseline & audit tooling (~3 days).**
   - Capture rebase-base snapshot, codegen output bytes, `gateway.describe` JSON baseline.
   - Add `scripts/audit-schema-fork-footprint.ts`, `scripts/audit-fork-classifications.ts`, `scripts/audit-gateway-service-coverage.ts`, `scripts/diff-describe-baseline.ts`.

1. **Phase 1 — Schema sibling-split (~1 week).**
   - Move fork additions from each upstream `protocol/schema/*.ts` to `*-extensions.ts` siblings.
   - Update the existing single-file barrel `src/gateway/protocol/schema.ts` to re-export from each `*-extensions.ts` (note: there is **no** `protocol/schema/index.ts` in this codebase; the barrel is the file at `protocol/schema.ts`).
   - For `protocol/index.ts`'s direct imports of `./schema/<name>.js` (e.g., the deck import block at `protocol/index.ts:528-554`): keep direct imports for symbols that remain in the upstream file; either migrate to barrel or add per-file compat re-export for symbols that move to `*-extensions.ts`.
   - Run `pnpm protocol:gen:check` to verify byte-identical codegen output.
   - Verification gate: `git diff $BASE..HEAD -- src/gateway/protocol/schema/ src/gateway/protocol/schema.ts` shows only `*-extensions.ts` adds plus `schema.ts +N export *` lines.

2. **Phase 2 — Auto-discovery (~1 week).**
   - Add `scripts/gen-method-modules.ts` (build-time discovery).
   - Wire it into `scripts/build-all.mjs` start; add `check:method-modules-up-to-date` to `pnpm check`.
   - Convert each existing `*-method-defs.ts` into a `*.method-defs.ts` (side-effect-free metadata only) and pair it with a `*.module.ts` that imports both the handlers and the `*.method-defs.ts` content.
   - Convert the `deck/index.ts` barrel into a `deck.module.ts` plus `deck.method-defs.ts` pair.
   - Replace `coreGatewayHandlers` spread + `buildMethodRegistry` argument list in `server-methods.ts` with the discovery-driven aggregation.
   - Convert `BASE_METHODS` in `server-methods-list.ts` to a derived constant.
   - Add `controlPlaneWrite: true` flag to upstream `config.apply`, `config.patch`, `update.run` method-defs and switch `CONTROL_PLANE_WRITE_METHODS` to derive from the registry.
   - Verification gate: `pnpm test`, `pnpm build`, `pnpm protocol:gen:check`. Byte-stable codegen output. The `bun -e 'import("./src/gateway/_method-defs.generated.ts")'` smoke test must produce no runtime side effects.

3. **Phase 3 — Service interfaces + deck handler refactor (~1.5 weeks).**
   - Implement service interfaces under `src/gateway/services/` (the exact set is generated by `audit-gateway-service-coverage.ts`).
   - Refactor each deck handler **and `deck-auth.ts`** to consume services (no behavior change).
   - Add `services/__tests__/contract.test.ts` to lock the surface.
   - Verification gate: `node scripts/audit-gateway-service-coverage.ts` exits zero — no internal symbol consumed by a deck handler is unmapped to a service.

4. **Phase 4 — Hot-path split for `models.ts` (~3-5 days).** Carve `models.configured` handler, provider helpers, and the `models.list` metadata extension into separate `*.module.ts` / `*.method-defs.ts` / service files. Investigate the residual `-1` line.

**Rollback plan.**

- Each phase is independent; rolling back Phase N has no impact on Phase 1..N-1.
- Phase 2 (auto-discovery) is the most invasive; rollback would restore the static spread from git history (one revert commit).
- Phase 4 (hot-path split) is local to a few new files; if it proves problematic, deleting them and restoring the appended content into `models.ts` is a clean revert.

**Verification at each phase.**

- `pnpm check` (lint + format + new `check:method-modules-up-to-date` guard)
- `pnpm test` (full suite must stay green)
- `pnpm build` (tsgo + tsdown)
- `pnpm protocol:gen:check` (codegen byte-stability)
- For Phase 2 specifically: `bun -e 'import("./src/gateway/_method-defs.generated.ts")'` produces no runtime side effects, and produces identical bytes across two runs.
- For Phase 1, 2, and 4: `node scripts/diff-describe-baseline.ts` exits zero (or fails only on documented allow-listed fields).

## Open Questions

- **OQ1**: Do any of the 33 services-mapped internal symbols themselves need caching at the service layer (e.g., `loadConfig` is observed at `io.ts:1796-1800` to use a pinned runtime snapshot, so v1 pass-through is acceptable; but `buildPluginSnapshotReport` and `runAuthProbes` may have I/O cost worth caching)? Current decision: service interfaces are pass-through in v1. Caching is a v2 concern. Codex independently verified the `loadConfig` pinning.
- **OQ2**: How to expose the C3 → BFF migration eligibility list to deck-go? Current decision: a `bffEligible: true` field on the method-def, surfaced in `gateway.describe`. deck-go can choose to mirror the gateway view in its own BFF later; both must remain valid until the eligible methods are formally retired.
- **OQ3**: Should we attempt the upstream PR for `gateway-method-discovery` before or after landing in `enhanced`? Current decision: land in `enhanced` first to derisk; submit upstream PR from a stable known-good base. Upstream acceptance is a bonus, not a prerequisite.
- **OQ4**: Should the audit scripts be packaged inside `scripts/` (current default) or live under `tools/` to signal "non-runtime, non-lib"? Current decision: `scripts/` for parity with existing `protocol-gen-ts.ts`.
