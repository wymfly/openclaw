## ADDED Requirements

### Requirement: Runtime handler manifest is separate from codegen metadata manifest

Runtime handler discovery and codegen metadata discovery SHALL use separate generated manifests. The codegen metadata manifest MUST import only side-effect-free metadata exports and MUST preserve the existing `method-registry-data.ts` no-runtime-side-effects guarantee (verified at `method-registry-data.ts:1-6`: "Side-effect-free export for codegen consumption. MUST NOT import modules with side-effects at module scope."). The runtime handler manifest MAY import handler modules with runtime initialization.

#### Scenario: Codegen metadata manifest is side-effect-free

- **WHEN** `bun -e 'import("./src/gateway/server-methods/_method-defs.generated.ts")'` is executed
- **THEN** the import MUST complete with no runtime side effects observable in stdout/stderr (no log lines, no I/O), preserving the contract enforced today by the equivalent check at `method-registry-data.ts:5`

#### Scenario: Runtime handler manifest is allowed to have side effects

- **WHEN** `_modules.generated.ts` is loaded at gateway startup
- **THEN** module-scope handler initialization MAY occur (matching today's `server-methods.ts` import behavior), and this MUST NOT contaminate the metadata manifest path consumed by codegen

### Requirement: Module-based handler aggregation

The gateway SHALL aggregate request handlers from `*.module.ts` files and method definitions / event definitions from paired `*.method-defs.ts` files discovered under `src/gateway/server-methods/**`. The aggregation MUST replace the static `coreGatewayHandlers` spread expression in `src/gateway/server-methods.ts` and MUST be the sole source of method registration consumed by `handleGatewayRequest`.

#### Scenario: Adding a new fork-only RPC method does not touch upstream files

- **WHEN** a new fork-only handler is introduced as a paired `src/gateway/server-methods/<domain>/<name>.module.ts` + `<name>.method-defs.ts` files with the exported `module: GatewayMethodModule` and `metadata: GatewayMethodMetadataModule` shapes respectively
- **THEN** `src/gateway/server-methods.ts`, `src/gateway/server-methods-list.ts`, and `src/gateway/method-registry-data.ts` SHALL require zero edits for the new method to become live, and `git diff $BASE..HEAD -- 'src/gateway/server-methods.ts' 'src/gateway/server-methods-list.ts' 'src/gateway/method-registry-data.ts'` after the change SHALL show no edits

#### Scenario: Discovery exposes handlers, method-defs, and events through paired files

- **WHEN** the gateway initializes the method registry
- **THEN** every `*.module.ts` file MUST contribute its `handlers` field, every paired `*.method-defs.ts` file MUST contribute `methodDefs` and (optionally) `events`, and the resulting `coreGatewayHandlers` and `gatewayMethodRegistry` SHALL contain exactly the union of all paired exports with no manual list maintenance

### Requirement: Two manifests are generated deterministically by the build

The build SHALL produce two generated files: `src/gateway/server-methods/_modules.generated.ts` (statically imports every `*.module.ts`) and `src/gateway/server-methods/_method-defs.generated.ts` (statically imports every `*.method-defs.ts`). The generator MUST be invoked from `scripts/build-all.mjs` (the script bound to the `"build"` script in `package.json`; **not** `prebuild`, which does not exist as a `package.json` hook in this codebase). A `check:method-modules-up-to-date` guard MUST run inside `pnpm check` and fail when generated files are stale. Both generated files MUST sort imports by `(priority ascending, module name ascending)` before emission.

#### Scenario: Generator output is byte-stable across runs

- **WHEN** `node scripts/gen-method-modules.ts` is executed twice in succession on the same source tree
- **THEN** the two emitted `_modules.generated.ts` files MUST be byte-identical, AND the two emitted `_method-defs.generated.ts` files MUST be byte-identical

#### Scenario: Disordered file system inputs do not affect output ordering

- **WHEN** the underlying file system enumerates module / method-defs files in arbitrary order
- **THEN** both generated manifests MUST still order modules by `(priority, name)` independent of enumeration order, verified by a unit test that shuffles the module list before generation

#### Scenario: Stale generated manifest fails CI

- **WHEN** a `*.module.ts` or `*.method-defs.ts` is added/removed/renamed without re-running the generator and `pnpm check` is executed
- **THEN** the `check:method-modules-up-to-date` guard MUST exit non-zero and identify which generated file is out of date

### Requirement: Duplicate method registration fails fast

The aggregation step SHALL fail at startup with a descriptive error if two modules register the same method name, and the error message MUST identify both contributing module names.

#### Scenario: Conflicting method names abort startup

- **WHEN** two `*.module.ts` files each declare a handler for `"deck.agents.detail"` and the registry is built
- **THEN** the build/startup step MUST throw an `Error` whose message names both module names and the conflicting method, and the gateway MUST NOT serve any request until the conflict is resolved

### Requirement: Method-list is derived, not edited

The `BASE_METHODS` constant in `src/gateway/server-methods-list.ts` SHALL be derived from the discovered registry rather than maintained as a hand-edited string array. Implementations MUST use `gatewayMethodRegistry.listMethods()` (or `Array.from(registry.methods.keys())`) — **not** `Object.keys(registry.methods)`, because `MethodRegistry.methods` is a `ReadonlyMap` (verified at `src/gateway/method-registry.ts:44-46`), not a `Record`.

#### Scenario: Removing a method from a module removes it from BASE_METHODS

- **WHEN** a `*.module.ts` is deleted and the registry is rebuilt
- **THEN** `BASE_METHODS` MUST no longer contain the method names that the deleted module declared, without any manual edit to `server-methods-list.ts`

#### Scenario: Adding a method to a module adds it to BASE_METHODS

- **WHEN** a new method `"deck.experimental.foo"` is declared in any `*.module.ts`
- **THEN** `BASE_METHODS` MUST contain `"deck.experimental.foo"` after the next aggregation, with no manual edit to `server-methods-list.ts`

#### Scenario: Implementation uses Map-aware API

- **WHEN** the derived `BASE_METHODS` constant is implemented
- **THEN** it MUST consume `gatewayMethodRegistry.listMethods()` or `Array.from(gatewayMethodRegistry.methods.keys())`, and MUST NOT use `Object.keys(gatewayMethodRegistry.methods)` which would return `[]` since `methods` is a `ReadonlyMap` not a plain object

### Requirement: Dispatcher exposes controlled sub-request dispatch without leaking raw handlers

The gateway SHALL extract request dispatch into `src/gateway/server-methods/dispatcher.ts` as `dispatchGatewayRequest({ handlers, ...opts })`. The raw `GatewayRequestHandlers` map MUST remain private to the dispatcher call path and MUST NOT be stored on `GatewayRequestContext`, because that context is available through plugin runtime scope. Handlers that need to dispatch sub-requests (initially `gateway.batch`) SHALL receive an optional `dispatchSubRequest` function on `GatewayRequestHandlerOptions`; this function MUST re-enter `dispatchGatewayRequest` and preserve authorization, role, unavailable-method, and control-plane budget checks.

#### Scenario: GatewayRequestContext does not expose raw handlers

- **WHEN** TypeScript compiles `GatewayRequestContext` and plugin runtime request scope after the dispatcher extraction
- **THEN** neither surface SHALL contain `handlers`, `coreGatewayHandlers`, or any raw `GatewayRequestHandlers` map

#### Scenario: Sub-request dispatch preserves the normal request pipeline

- **WHEN** a handler invokes `dispatchSubRequest` for a sub-call
- **THEN** the sub-call MUST pass through the same authorization, role, unavailable-method, handler lookup, and control-plane write budget logic as a top-level request

### Requirement: MethodDefinition type contract carries fork-introspection metadata

The `MethodDefinition` interface in `src/gateway/method-registry.ts` SHALL include three optional fields used by fork-only registration: `forkClass?: "C1" | "C2" | "C3" | "C4" | "C5"`, `bffEligible?: boolean`, `controlPlaneWrite?: boolean`. The `GatewayDescribePayload` and the `gateway.describe` result schema SHALL surface these fields. The `schemaVersion` hash SHALL incorporate them so any change triggers a bump.

#### Scenario: MethodDefinition type accepts the new fields

- **WHEN** TypeScript compiles `src/gateway/method-registry.ts` after this change
- **THEN** an assignment of `{ handler, scope: "operator.read", forkClass: "C1", bffEligible: false, controlPlaneWrite: false }` to a `MethodDefinition` MUST type-check without error

#### Scenario: gateway.describe surfaces the metadata fields

- **WHEN** a client calls `gateway.describe`
- **THEN** for every method whose `methodDef` carries `forkClass`/`bffEligible`/`controlPlaneWrite`, the response payload MUST include those fields under the method's entry, with the same values declared in the source

#### Scenario: schemaVersion bumps when controlPlaneWrite is added

- **WHEN** a method-def's `controlPlaneWrite` flag toggles from `undefined` to `true`
- **THEN** the `gatewayMethodRegistry.schemaVersion` hash MUST change, asserted by a unit test in `src/gateway/method-registry.test.ts`

### Requirement: Discovery-driven codegen output remains stable

The codegen produced by `pnpm protocol:gen:ts` SHALL produce byte-identical output before and after the migration to discovery-based registration when the underlying method set is unchanged.

#### Scenario: Pre/post migration codegen byte-equivalence

- **WHEN** `pnpm protocol:gen:ts` is executed against the codebase before this change and against the codebase after this change with the same set of registered methods
- **THEN** the resulting `dashboard/src/types/gateway-protocol.generated.ts` and `dashboard/src/types/gateway-client.generated.ts` files MUST be byte-identical
