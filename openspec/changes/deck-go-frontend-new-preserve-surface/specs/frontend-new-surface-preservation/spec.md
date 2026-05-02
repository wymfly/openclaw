## ADDED Requirements

### Requirement: frontend-new preserves the complete frozen frontend surface

`deck-go/frontend-new` SHALL expose the complete current `deck-go/frontend` product surface for all panels that are not explicitly governed by a newer `frontend-new` implementation. The preserved surface MUST include the old host-level affordances, panel inventory, panel-local components, panel tests, shared/runtime components, theme support, i18n namespaces, and import-chain dependencies required for those panels to build and run.

#### Scenario: Preserved panel inventory is restored

- **WHEN** `frontend-new` is built after this change
- **THEN** the active shell SHALL expose panel entries for `chat`, `agents`, `gateway`, `models`, `usage`, `sessions`, `memory`, `logs`, `activity`, `threads`, `api-explorer`, `cron`, `webhooks`, `approvals`, `skills`, `budget`, `alerts`, `channels`, `plugins`, `routing`, `subagents`, `identity`, `config`, `nodes`, `docs`, and `settings`
- **AND** every non-chat/non-agents panel SHALL render from a preserved `frontend-new/src/components/panels/<panel>/` implementation rather than a placeholder-only fallback

#### Scenario: Shared dependencies are restored

- **WHEN** a preserved panel imports shared shell components, runtime empty states, navigation helpers, store helpers, lib utilities, or i18n keys that existed in frozen `frontend`
- **THEN** the corresponding dependency SHALL exist in `frontend-new`
- **AND** the implementation SHALL NOT replace the dependency with a no-op stub solely to satisfy compilation

### Requirement: chat and agents remain new-authority modules

`chat` and `agents` SHALL remain governed by their `frontend-new` implementations. Frozen `frontend` implementations for those modules MAY be read for edge cases and tests, but MUST NOT overwrite the current `frontend-new` `chat` or `agents` code, stores, API wrappers, CSS, or i18n namespaces unless a later OpenSpec change explicitly changes that authority.

#### Scenario: Restoring preserved panels does not overwrite chat

- **WHEN** the preservation migration copies panel code from frozen `frontend`
- **THEN** `frontend-new/src/components/panels/chat/` SHALL remain the current `frontend-new` chat implementation
- **AND** chat build/tests SHALL continue to pass

#### Scenario: Restoring preserved panels does not overwrite agents

- **WHEN** the preservation migration copies panel code from frozen `frontend`
- **THEN** `frontend-new/src/components/panels/agents/` SHALL remain the current `frontend-new` agents implementation
- **AND** agents-specific i18n, store, stream, and contract helpers added by the agents rebuild SHALL remain intact

### Requirement: Preserved modules use frontend-new contract boundaries

Preserved panels SHALL call backend behavior through `frontend-new/src/api.ts`, `frontend-new/src/api-types.ts`, generated contract artifacts, and existing Deck transport helpers. If a preserved panel requires an API wrapper or DTO that is missing or stale, the implementation MUST update the contract source or `frontend-new` facade as appropriate rather than scattering raw endpoints in panel components or editing generated files.

#### Scenario: Missing API wrapper is reconciled at the facade

- **WHEN** a preserved panel needs a function that existed in frozen `frontend/src/api.ts` but is missing in `frontend-new/src/api.ts`
- **THEN** the function SHALL be reconciled into the `frontend-new` API facade
- **AND** panel code SHALL import the facade function instead of constructing a raw URL/action string locally

#### Scenario: Generated DTO is missing or wrong

- **WHEN** a preserved panel requires a Deck-facing DTO that is missing or structurally wrong
- **THEN** the implementation SHALL update the appropriate contract source and regenerate artifacts
- **AND** generated files SHALL NOT be patched by hand

### Requirement: Preservation status is explicit

The restored surface SHALL distinguish modules that are `new` from modules that are `preserved`. This status MUST be visible either in UI contract metadata, frontend-new engineering docs, or both, so future work can tell whether a module is already a protocol-v1 redesign or merely preserved for product coverage.

#### Scenario: Module authority is inspectable

- **WHEN** a future frontend task inspects module status
- **THEN** it SHALL be able to identify `chat` and `agents` as `new`
- **AND** it SHALL be able to identify restored non-chat/non-agents modules as `preserved`

#### Scenario: Future redesign starts from preserved status

- **WHEN** a later change proposes a redesign for a preserved module
- **THEN** the proposal SHALL treat the preserved module as the baseline product behavior to retain or intentionally change
- **AND** it SHALL NOT assume the module is missing or unimplemented

### Requirement: Host regression guard prevents two-panel fallback

`frontend-new` SHALL include a verification guard that fails when the active app regresses to a chat/agents-only shell, loses registered panel cases, drops host runtime/auth affordances, or routes preserved panels through placeholder-only fallbacks.

#### Scenario: Registry case is missing

- **WHEN** a panel id exists in the active `frontend-new` registry but no corresponding component case or lazy/eager render path exists
- **THEN** the host guard SHALL fail

#### Scenario: Active boot path bypasses the full host

- **WHEN** `frontend-new/src/main.tsx` or the active app entry bypasses the restored full deck-ui host for normal business routes
- **THEN** the host guard SHALL fail unless the route is the isolated `?dsGallery=1` design-system gallery path

### Requirement: Restored surface is verifiable in build, tests, and browser smoke

The preservation migration SHALL be complete only when `frontend-new` builds, frontend tests pass, and browser smoke verifies default chat, new agents, and representative preserved panels through the restored shell.

#### Scenario: Frontend verification passes

- **WHEN** `cd deck-go/frontend-new && npm run build` and `npm run test:deck-ui` run after implementation
- **THEN** both commands SHALL complete successfully

#### Scenario: Representative panels open

- **WHEN** the local stack serves `frontend-new`
- **THEN** a browser smoke SHALL open default chat, `?panel=agents`, and representative preserved panels from core, observe, automate, and control groups without uncaught render errors
