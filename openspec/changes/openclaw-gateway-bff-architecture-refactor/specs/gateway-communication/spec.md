## ADDED Requirements

### Requirement: Handler registration is discovery-driven, not list-driven

The gateway's request-handler registration SHALL be sourced from automatic discovery of `*.module.ts` files under `src/gateway/server-methods/**` rather than from manually-edited spread expressions in `src/gateway/server-methods.ts` or arrays in `src/gateway/server-methods-list.ts`. New methods become live by adding a `*.module.ts` file; no centrally-edited registration list exists.

#### Scenario: Discovery is the only source of registered handlers

- **WHEN** `coreGatewayHandlers` is constructed at gateway startup
- **THEN** the construction MUST be the result of `loadGatewayMethodModules()` aggregation rather than a hand-spread expression of named bundle imports

#### Scenario: server-methods-list is derived

- **WHEN** `BASE_METHODS` from `server-methods-list.ts` is enumerated
- **THEN** its contents MUST be derived from the discovered registry's keys and MUST NOT be a hand-edited literal array

### Requirement: Fork-only handlers register through `*.module.ts` siblings

Every fork-only RPC handler SHALL be registered through a `*.module.ts` file colocated with the handler's source rather than through a centrally-edited list in upstream files. This applies to all current and future fork additions.

#### Scenario: Adding a fork-only handler requires zero upstream-file edits

- **WHEN** a developer introduces a new fork-only handler in `src/gateway/server-methods/<domain>/<name>.module.ts`
- **THEN** the change set MUST NOT modify `src/gateway/server-methods.ts`, `src/gateway/server-methods-list.ts`, or `src/gateway/method-registry-data.ts`

#### Scenario: Existing fork-only handlers migrate to the module pattern

- **WHEN** the migration completes
- **THEN** `src/gateway/server-methods/deck/index.ts`, `src/gateway/server-methods/deck-auth.ts`, `src/gateway/server-methods/describe.ts`, `src/gateway/server-methods/models-catalog-providers.ts`, and every `*-method-defs.ts` MUST be replaced by or wrapped as `*.module.ts` files conforming to the `GatewayMethodModule` shape

### Requirement: Cache-stable aggregation across the registration pipeline

Every step that aggregates handlers, method definitions, or events into model-facing payloads SHALL produce byte-stable output for byte-stable input, in compliance with the project-wide prompt-cache stability rule.

#### Scenario: gateway.describe output is stable across runs

- **WHEN** `gateway.describe` is invoked twice with identical parameters against an unchanged registry
- **THEN** the JSON-serialised response payload MUST be byte-identical between the two invocations

### Requirement: Pre/post-migration `gateway.describe` diff is bounded

The migration to discovery-based registration SHALL preserve `gateway.describe` semantics such that the pre-vs-post-migration JSON diff is limited to a documented allow-list of fields (initially: `forkClass`, `bffEligible`, `controlPlaneWrite`). All other content MUST be byte-identical between the captured baseline (Phase 0) and the post-migration snapshot.

#### Scenario: Baseline diff allow-list enforcement

- **WHEN** `node scripts/diff-describe-baseline.ts` compares the Phase 0 baseline `gateway.describe` JSON against a snapshot taken after the migration completes
- **THEN** the script MUST exit zero only when every JSON-pointer-level difference falls within the documented allow-list, and MUST exit non-zero with the specific paths otherwise

## MODIFIED Requirements

### Requirement: Typed client coverage

The Deck typed client SHALL cover all Gateway methods that are called by the dashboard and have result schemas. The `GatewayMethodMap` SHALL include entries for every method with a registered result schema in `methodDefs`. With the introduction of discovery-based registration, "registered in `methodDefs`" SHALL mean "exposed by any discovered `*.method-defs.ts` metadata module" (the side-effect-free codegen manifest), **not** "exposed by `*.module.ts` runtime handlers" — the two-manifest split keeps the codegen path side-effect-free per `method-registry-data.ts:1-6`.

#### Scenario: All 5 new upstream methods appear in GatewayMethodMap

- **WHEN** `pnpm protocol:gen:ts` is executed after adding result schemas
- **THEN** the generated `GatewayMethodMap` SHALL include entries for `sessions.usage`, `sessions.usage.logs`, `sessions.usage.timeseries`, `tools.effective`, and `skills.install` in addition to all previously covered methods

#### Scenario: No regression in existing typed methods

- **WHEN** `pnpm protocol:gen:ts` is executed after adding new result schemas
- **THEN** all 26 existing `deck.*` typed methods (25 currently in `method-registry-data.ts` plus `deck.plugins.list` after the registry-drift fix in Phase 0) and all previously typed `chat.*` / `sessions.*` methods SHALL remain in the generated output unchanged

#### Scenario: Discovery-sourced method-defs feed codegen via the side-effect-free manifest

- **WHEN** the codegen pipeline enumerates `methodDefs` for inclusion in `GatewayMethodMap`
- **THEN** it MUST consume the union of all `*.method-defs.ts` metadata exports (via `_method-defs.generated.ts`) ordered deterministically by `(priority, module name)`, MUST NOT import `*.module.ts` runtime handler modules, and MUST produce the same `GatewayMethodMap` shape as it does today
