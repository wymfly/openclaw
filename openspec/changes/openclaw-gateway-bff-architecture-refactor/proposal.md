## Why

The fork (`wymfly/openclaw`, branch `enhanced`) accumulated 91 modified gateway files vs. its rebase base (`upstream/main` @ `0c0463b2b7`, 2026-04-14). Of those, **54 are pure new files** and **37 modify upstream files** — but every single deck adapter handler still reaches deep into openclaw internals via 33 unique imports across 14 internal modules (verified: `grep '^import.*from "\.\./\.\./\.\./' src/gateway/server-methods/deck/*.ts | sort -u | wc -l`). When upstream renames any of those internals, the fork breaks silently or has to chase every rebase.

Three problems compound:

1. **`server-methods.ts` and `server-methods-list.ts` are growing add-only registration lists** that collide with upstream additions on every rebase (current fork diff: +48/-3 and +42/-0 respectively, verified).
2. **Fork additions to upstream schema files** (`protocol/schema/sessions.ts +320`, `nodes.ts +141`, `protocol-schemas.ts +125`, `agents-models-skills.ts +118`, `devices.ts +114`, `protocol/index.ts +100`, …) are pure positional appends that conflict whenever upstream touches the same file.
3. **Deck handlers reach into openclaw internals** (`loadConfig`, `listAgentEntries`, `resolveAgentSkillsFilter`, `buildWorkspaceSkillStatus`, `pickSandboxToolPolicy`, `resolveToolProfilePolicy`, `resolveAgentRoute`, `parseAgentSessionKey`, `getChatCommands`, …) with 33 distinct internal symbols. Upstream is moving fast (6503 commits in 14 days; `src/gateway` alone got 420 files / +51K / -7.9K), so internal renames are a recurring hazard.

The current "extend the registry by editing upstream lists" pattern is ergonomic in the short term but does not scale. We need to move from **list-based registration → discovery-based registration** and from **deep-import handlers → service-interface handlers**, with the new boundary giving fork-only RPC handlers a stable home and giving upstream-touching code a tightly-bounded contact surface.

This proposal is scoped to **fork-conflict treatment** (registration discovery, schema sibling-split, service-interface layer, hot-path split, fork handler classification). The separate proposal `openclaw-gateway-batch-rpc-primitive` is being prepared in parallel to introduce the `gateway.batch` RPC primitive that enables future BFF migration of C3 handlers; it is intentionally not in this proposal.

## What Changes

This proposal introduces 4 new capabilities and modifies 1 existing capability, organized as a coherent **fork-conflict treatment surface** for the gateway layer:

- **Auto-discovery for server methods**: Replace the static `coreGatewayHandlers = { ...connectHandlers, ...logsHandlers, ...deckHandlers, ...describeHandlers }` spread (currently 33 named spreads in `src/gateway/server-methods.ts`) with a discovery loop that walks `src/gateway/server-methods/**/*.module.ts` and merges their exported handlers + method-defs. Every fork-only registration becomes a sibling file in the same directory; upstream changes to the registration site stop causing fork conflicts.
- **Sibling extension files for protocol schemas**: For every upstream schema file that the fork extends (`protocol/schema/sessions.ts`, `nodes.ts`, `devices.ts`, `agents-models-skills.ts`, `protocol-schemas.ts`, `cron.ts`, `logs-chat.ts`, `config.ts`, `exec-approvals.ts`, `index.ts`), move the fork's added exports into a `*-extensions.ts` sibling and re-export from the matching barrel. Upstream files revert to their baseline content.
- **Service interface layer**: Introduce `src/gateway/services/{agents,auth,config,sessions,routing,skills,subagents,subagent-registry,plugins}.service.ts` that wraps the openclaw internal symbols deck handlers depend on. Deck handlers stop importing from `../../../config/`, `../../../agents/`, etc. (and `../../` for `deck-auth.ts`), and instead consume the version-stable service interface. **BREAKING for fork-internal call sites only — public RPC surface is unchanged.**
- **Fork-only handler classification standard**: Document the C1/C2/C3/C4/C5 classification (composition / mutation / light view / business rule / infrastructure) for the 26 fork-only `deck.*` methods plus the fork-added `models.catalog.providers`, `models.configured`, `sessions.usage{,Logs,Timeseries}`, `sessions.{clear,steer}`, and `gateway.describe`. All classes stay in the gateway in this proposal; the C3 (light view) class is annotated as a future BFF-migration candidate, contingent on the separate `gateway.batch` proposal landing.
- **Hot-path module split for `server-methods/models.ts`**: Carve out the fork's `models.configured` handler, the provider provenance helpers, and `modelsMethodDefs`'s ownership of `models.list` metadata into `models-extensions.module.ts`. The upstream file (which upstream rewrote +1244 lines in 14 days) keeps only any residual fork-modification of upstream-authored functions (currently the `-1` line; investigated and either reverted or documented as residual).
- **Modified — `gateway-communication`**: Register the discovery surface and the obligation that fork-only handlers register through `*.module.ts` siblings, so the existing capability spec accurately reflects how methods are exposed.
- **Out of scope (deferred)**:
  - **`gateway.batch` RPC primitive** — handed to the separate proposal `openclaw-gateway-batch-rpc-primitive` so that the public-RPC surface evolution does not get bundled with fork-conflict treatment.
  - **Migrating any C3 handler to deck-go** — eligibility is annotated by this proposal but actual migration depends on `gateway.batch` shipping and on a separate deck-go-side BFF proposal.
  - **Hooks system** for `server-chat.ts` / `message-handler.ts` — those edits are confirmed too small (+8/-0 and +6/-2) to justify a hook framework.
  - **Refactoring `transcript-canonical`, `channel-event-filter`, `wizard-spec`** — these are fork-only or near-fork-only files whose single-file fork diff is small enough to defer; we will revisit when their import graphs grow or their upstream-touch surface widens.
  - **Deploy/seed repository extraction** (logistical, not architectural).

## Capabilities

### New Capabilities

- `gateway-method-discovery`: Module-based handler/method-def registration that replaces the static spread list in `server-methods.ts`. Defines the `*.module.ts` runtime contract, the parallel side-effect-free `*.method-defs.ts` contract for codegen, deterministic ordering for cache stability, the discovery loop, fail-fast duplicate detection, and the migration path that lets fork-only modules drop into a sibling file without touching upstream registration code.
- `gateway-service-interfaces`: Establishes the contract between gateway handlers and openclaw internal modules. Each service interface is a versioned, narrow surface (`AgentsService`, `AuthService`, `ConfigService`, `SessionsService`, `RoutingService`, `SkillsService`, `SubagentsService`, `SubagentRegistryService`, `PluginsService`). Defines the construction pattern, the no-side-effects rule, the contract test strategy that runs after every upstream rebase, and an `audit-gateway-service-coverage.ts` script (TypeScript Compiler API) that enumerates every internal symbol consumed by deck handlers and verifies the service set covers it.
- `gateway-fork-handler-classification`: Codifies the C1/C2/C3/C4/C5 classification used to decide where a fork-only RPC handler lives (Gateway vs. future BFF). Lists every fork-only method's classification with rationale, defines the migration eligibility criteria for C3, separates infrastructure (C5) from business rule (C4), and sets the ADR template for adding new fork-only handlers.
- `gateway-schema-modularity`: Establishes the sibling-extension pattern (`<name>-extensions.ts` next to `<name>.ts`) for fork additions to upstream `protocol/schema/*.ts` files, plus the rules for re-exporting through the existing `src/gateway/protocol/schema.ts` barrel and for keeping any pre-existing direct imports of `protocol/schema/<name>.ts` working via per-file compatibility re-exports. Defines what content qualifies as a "sibling extension" vs. what must remain a true modification of the upstream file.

### Modified Capabilities

- `gateway-communication`: Adds requirements for (a) discovery-based handler registration replacing static spread lists, (b) the obligation that every fork-only handler is registered through a `*.module.ts` sibling rather than by editing the central `server-methods.ts`, (c) cache-stable aggregation across the registration pipeline.

## Impact

**Affected source areas (gateway side):**

- `src/gateway/server-methods.ts`: Replace the 33-name handler spread with a discovery loop. Upstream-side fork diff drops from +48/-3 to ≤ +5 lines.
- `src/gateway/server-methods-list.ts`: BASE_METHODS becomes derived from the discovered registry. Upstream-side fork diff drops from +42/-0 to 0 lines.
- `src/gateway/method-registry.ts` & `method-registry-data.ts`: Codegen data source switches from manual import list to discovery-driven aggregation, preserving deterministic ordering for prompt-cache stability.
- `src/gateway/protocol/schema/*.ts`: 9 upstream schema files revert to baseline (~1300 lines move into sibling `*-extensions.ts` files); the existing single-file barrel `src/gateway/protocol/schema.ts` adds 1 line per extension re-export. `src/gateway/protocol/index.ts`'s direct `import from "./schema/<name>.js"` sites (e.g., `protocol/index.ts:528-554` for deck) are either preserved (when the imported symbols stay in the upstream file) or migrated to the barrel in the same phase.
- `src/gateway/services/` (new directory): ~9 service interface modules wrap currently inlined internal calls. The exact set is generated from `audit-gateway-service-coverage.ts`.
- `src/gateway/server-methods/deck/*.ts` and `deck-auth.ts`: 12 handlers (~3000 LOC total, verified by `wc -l`) refactored to consume services instead of internals. Note: `deck-auth.ts` lives at `server-methods/` depth (uses `../../` imports), not at the deeper `deck/` subdirectory; the audit must catch both depths. Public RPC surface unchanged.
- `src/gateway/server-methods/*.module.ts` and `*.method-defs.ts`: Net-new convention. The runtime handler manifest (`*.module.ts`) and the side-effect-free metadata manifest (`*.method-defs.ts`) are kept in separate files to preserve the existing `method-registry-data.ts` no-runtime-side-effects guarantee. All 10 existing `*-method-defs.ts` and the deck/usage/catalog handler bundles convert to this format.

**Affected source areas (deck-go side, no change in this proposal):**

- `deck-go/backend/internal/runtime/openclaw/gateway_queries.go`: 127 thin-wrapper functions remain unchanged. Their retirement depends on the separate `gateway.batch` proposal landing first; tracked as a follow-up.

**Generated artifacts:**

- `dashboard/src/types/gateway-protocol.generated.ts` and `gateway-client.generated.ts`: Regenerated. Public-RPC surface bytes are byte-identical to baseline (any difference must be limited to the small whitelist of new `forkClass` / `bffEligible` / `controlPlaneWrite` introspection fields surfaced by `gateway.describe`, validated by the spec).
- `deck-go/backend/internal/gateway/generated/*.go`: Regenerated. Existing 113 typed wrappers continue to work; no new public methods.
- `pnpm protocol:gen:check` must pass.

**Rebase / upstream impact:**

- Conflict-prone files reduced from 37 → ≤ 12 (verified mapping in design.md).
- `server-methods.ts`, `server-methods-list.ts`, `protocol/schema/{sessions,nodes,devices,agents-models-skills,protocol-schemas,cron,logs-chat,config,exec-approvals}.ts`: all become **0 fork lines** after refactor. `server-methods/models.ts` becomes 0 fork lines for the additive content (handlers / methodDefs); any residual single-line modification of upstream-authored functions is documented and tracked separately.
- Upstream PR candidates: `gateway-method-discovery` is the most mechanical and self-contained; submitting it to upstream is plausible and would make the fork even smaller. `gateway-service-interfaces` is more opinionated; fork-internal use is fine if upstream declines.

**Downstream consumers (no breaking changes to public RPC):**

- `dashboard/`: Consumes only via typed client; transparent.
- `deck-go/`: Consumes via typed client + 113 typed wrappers; transparent.
- CLI / external SDK clients: Unaffected; same wire protocol.

**Risks:**

- Discovery-loop ordering must remain deterministic to keep prompt-cache stable (CLAUDE.md: "Prompt Cache Stability"). This is enforced by sorting module paths before merge and is covered by a regression test.
- Discovery must not break the existing side-effect-free guarantee on `method-registry-data.ts`. This is enforced by splitting the runtime handler manifest from the metadata manifest at the file level and by a CI assertion that imports the metadata manifest and observes no runtime side effects.
- Service interface boundary churn: each upstream rebase requires the contract test to confirm internal symbol mappings still resolve. Failure mode is loud (compile error) rather than silent.
- Hot-path file (`server-methods/models.ts`) still receives upstream edits at high frequency; carving out the additive content removes most fork conflicts on this file but does not eliminate the need to follow upstream's models refactors when they touch the residual modification.
