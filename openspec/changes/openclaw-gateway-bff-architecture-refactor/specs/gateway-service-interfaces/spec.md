## ADDED Requirements

### Requirement: Service interface layer wraps internal openclaw symbols

The gateway SHALL expose a versioned service interface layer at `src/gateway/services/<domain>.service.ts` that wraps every openclaw internal symbol consumed by gateway request handlers. Gateway request handlers MUST consume these service interfaces and MUST NOT import openclaw internal modules directly. Coverage SHALL be enforced by `scripts/audit-gateway-service-coverage.ts` using TypeScript Compiler API import parsing — **not** text grep, which misses multiline imports, depth-1 (`../../`) imports such as `deck-auth.ts`, and dynamic imports such as `deck-auth.ts:127-130`.

#### Scenario: Audit script reports zero unmapped internal symbols

- **WHEN** `node scripts/audit-gateway-service-coverage.ts` is executed against the post-refactor branch
- **THEN** the script MUST exit zero and MUST report every internal symbol consumed by `src/gateway/server-methods/deck/**/*.ts` or `src/gateway/server-methods/deck-auth.ts` as either reachable through a service interface or listed as a documented escape hatch in `src/gateway/services/README.md`

#### Scenario: A new deck handler consumes the same service interfaces

- **WHEN** a new fork-only `deck.*` handler is added in any `*.module.ts` file
- **THEN** the handler MUST acquire its dependencies via `createAgentsService()`, `createConfigService()`, etc., and MUST NOT introduce new internal imports from `src/agents/`, `src/config/`, `src/sessions/`, `src/routing/`, `src/plugins/`, or `src/auto-reply/` unless those imports are added to a service interface or to the documented escape-hatch list

### Requirement: Each service interface declares an explicit version

Every service interface SHALL expose a `readonly version: number` field, and every consumer SHALL be tolerant of receiving the version it was compiled against. Breaking changes to a service interface MUST bump the version number and MUST add a `createXyzServiceV2()` factory while keeping the v1 factory until all callers migrate.

#### Scenario: Service version is exposed and visible to callers

- **WHEN** a handler invokes `createAgentsService()`
- **THEN** the returned object MUST contain `version: 1`, and the handler MAY assert this version at construction time to detect accidental upgrades

### Requirement: Service interfaces are pass-through in v1

In v1, every service interface method SHALL forward to the corresponding openclaw internal symbol with no caching, no I/O batching, and no semantic transformation beyond renaming for ergonomic consistency. Caching or aggregation belongs to a future v2.

#### Scenario: Service method is a thin forwarder

- **WHEN** an arbitrary v1 service method is inspected
- **THEN** the implementation body MUST be at most five executable lines and MUST NOT introduce module-scope state, caches, or memoisation

### Requirement: Contract tests guard the service-to-internal binding

A contract test suite SHALL construct every service interface, exercise every method on it with realistic inputs, and assert that the underlying openclaw internal symbols still resolve and behave as the service interface contract declares.

#### Scenario: Contract test runs in CI and fails loudly on internal rename

- **WHEN** an upstream rebase renames or removes any internal symbol that a service interface forwards to
- **THEN** the contract test MUST fail at build or test time with a stack trace identifying the broken service method, and the failure MUST surface in `pnpm check` or `pnpm test` (never silently)

#### Scenario: Contract test exercises every method of every service

- **WHEN** the contract test suite is enumerated
- **THEN** every method declared on every `XyzService` interface MUST have at least one corresponding test case that calls it with arguments matching the type contract

### Requirement: Service interface set covers every deck handler dependency

The service interface set SHALL cover every non-protocol dependency imported by `src/gateway/server-methods/deck/**/*.ts` AND `src/gateway/server-methods/deck-auth.ts`. Service boundaries SHALL respect ownership: `loadConfig` belongs only to `config.service` (not duplicated in `agents.service`), `loadSessionStore` and `resolveSessionTranscriptsDirForAgent` belong to `sessions.service` (not `auth.service`, despite being consumed by `deck-auth.ts`).

The initial service set SHALL include exactly nine services: `agents`, `auth`, `config`, `sessions`, `routing`, `skills`, `subagents`, `subagent-registry`, `plugins`. If a dependency is intentionally left as local gateway infrastructure rather than wrapped in a service interface, it MUST be listed in `src/gateway/services/README.md` with owner and rationale. The known initial escape hatch is `DEFAULT_EVENT_STREAMS` from `src/gateway/channel-event-filter.ts` (used at `src/gateway/server-methods/deck/agents.ts:16`), which is a gateway-local fork-only constant, not an openclaw internal.

#### Scenario: Audit script enforces coverage with TypeScript Compiler API

- **WHEN** `node scripts/audit-gateway-service-coverage.ts` is executed
- **THEN** the script MUST parse imports of `src/gateway/server-methods/deck/**/*.ts` and `src/gateway/server-methods/deck-auth.ts` using the TypeScript Compiler API (handling multiline imports, depth-1 and depth-3 paths, and dynamic imports), enumerate every imported symbol, and assert that each symbol is either reachable through a service interface or listed as an intentional escape hatch in `services/README.md`. The script MUST exit non-zero if any symbol is unmapped

#### Scenario: deck-auth.ts depth-1 imports are mapped

- **WHEN** the audit enumerates `deck-auth.ts` imports
- **THEN** `resolveOpenClawAgentDir` (from `../../agents/agent-paths.js`), `buildAuthOverview` (from `../../agents/auth-diagnostics.js`), `runAuthProbes` (from `../../commands/models/list.probe.js`), and the dynamically-imported `resolveSessionTranscriptsDirForAgent` MUST all be reachable through service interfaces (initially `agentsService`, `authService`, and `sessionsService`; session path helpers belong to `sessionsService`, not `authService`)

#### Scenario: deck/subagents-steer.ts multiline imports are mapped

- **WHEN** the audit enumerates the multiline import block at the top of `deck/subagents-steer.ts`
- **THEN** every imported symbol (`AGENT_LANE_SUBAGENT`, `abortEmbeddedPiRun`, `clearSubagentRunSteerRestart`, `getSubagentRunsForDeck`, `markSubagentRunForSteerRestart`, `replaceSubagentRunAfterSteer`, `clearSessionQueues`, `loadConfig`, `loadSessionStore`, `resolveStorePath`, `callGateway`, `parseAgentSessionKey`, `INTERNAL_MESSAGE_CHANNEL`) MUST be reachable through one of the listed service interfaces
