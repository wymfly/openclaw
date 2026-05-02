# Implementation Notes

## 2026-05-01 Ralph Iteration 9

Completed the backend DTO adoption slice for the migrated agents, sessions, usage, approvals, and runtime error surfaces:

- Added `deck-go/backend/internal/runtime/openclaw/contract_adapters.go` to convert generated Gateway DTOs into generated Deck-facing `deckapi` DTOs.
- Updated `LegacyInventorySurface` so browser-facing inventory routes now emit generated `deckapi` responses for:
  - agents list/create/update/delete
  - usage cost/provider/session/log responses
  - approval policy and pending approval responses
- Reused the same pending-approval normalizer from `ManagedRuntime.ListPendingApprovals` to avoid a second map-shaped response authority.
- Switched `RuntimeGatewayActionResponse` to the generated `deckapi.DeckGoRuntimeGatewayActionResponse` alias.
- Switched runtime facade errors to encode `deckapi.DeckGoRuntimeErrorResponse`.
- Updated `/approvals/pending` and agent detail lookup to consume the generated Deck-facing DTOs.
- Added adapter tests proving generated Gateway result DTOs convert into generated Deck-facing DTOs for agents, sessions, usage, and approvals.
- Added selected JSON compatibility assertions for agents, usage logs, and pending approvals.
- Added negative HTTP tests for typed error envelopes covering invalid body, runtime not found, and Gateway unavailable cases.
- Added a Playwright contract-chain smoke covering agents list/detail, sessions/chat creation, runtime/settings, usage/monitor, approvals, and stream reconnect behavior through Deck Go.
- Updated bundled and remote runtime Playwright smoke tests so the UI verifies runtime-mode state while the chat assertion triggers the same typed Deck Go chat API and waits for the `sessions.create` Gateway contract.

Remaining dynamic surfaces after this slice:

- `sessions.usage.timeseries` remains a documented dynamic Gateway result because the generated upstream result is still `any`.
- The eight upstream-schema-missing Gateway methods remain in `deck-go/contracts/source/deck-exceptions.contract.json` and generated exception docs.
- Broader plugin/node/config raw payloads remain outside this migrated-domain blocking set until upstream schemas or plugin schema contracts exist.

Fresh evidence:

```text
go test ./internal/runtime/openclaw ./internal/runtime/projection ./internal/server ./internal/api/http
ok github.com/openclaw/openclaw/deck-go/backend/internal/runtime/openclaw
ok github.com/openclaw/openclaw/deck-go/backend/internal/runtime/projection
ok github.com/openclaw/openclaw/deck-go/backend/internal/server
ok github.com/openclaw/openclaw/deck-go/backend/internal/api/http

make backend-test
go test ./... passed for deck-go/backend

make contract-gate
deck-api codegen assertions passed
ui metadata assertions passed
deck-api generated artifacts are up to date
ui metadata is up to date
endpoint classification is up to date
contract exceptions are up to date
stream contract is up to date
gateway-typecheck ok: 8 go exception(s), 0 fe violation(s)
wrote deck-go/docs/contract-inventory.json
wrote deck-go/docs/contract-inventory.md

make frontend-build
check-deck-ui-host ok
✓ built in 835ms

pnpm exec playwright test test/e2e/bundled.spec.ts test/e2e/remote.spec.ts test/e2e/contract-chain-smoke.spec.ts
3 passed

openspec validate deck-go-end-to-end-contract-chain
Change 'deck-go-end-to-end-contract-chain' is valid

openspec instructions apply --change deck-go-end-to-end-contract-chain --json
progress: 53 total, 53 complete, 0 remaining, state all_done

git diff --check
no whitespace errors

omx status
ralph: inactive (phase: cancelled)
ralplan: inactive (phase: cancelled)
skill-active: inactive (phase: cancelled)
```

Final coverage review:

- `deck-go/docs/contract-inventory.md` reports 0 missing contract types, 0 duplicate DTO authority issues, 0 migrated-domain blocking issues, 0 unclassified endpoints, 0 invalid endpoint classification rows, and 0 UI metadata issues.
- `deck-go/docs/deck-contract-exceptions.md` and `deck-go/docs/gateway-untyped-exceptions.md` list the remaining 8 Gateway untyped exceptions with owner `deck-go-contract-chain` and explicit exit criteria.
- Migrated-domain governance is blocking through `deck-go/contracts/scripts/deck-contract-inventory.mjs`: non-zero migrated-domain blocking issues now exit with status 1 inside `make contract-gate`.

## 2026-05-01 Ralph Iteration 1

Implemented the first contract-chain foundation slice from the ralplan:

- Added a shared Deck API codegen module at `deck-go/contracts/scripts/deck-api-codegen.mjs`.
- Rewired `contracts-sync` and `contracts-check` to use the shared codegen module instead of duplicating generation logic.
- Added `deck-go/contracts/scripts/deck-api-codegen.test.mjs` for parser and TS/Go generation assertions.
- Added `deck-go/contracts/scripts/deck-contract-inventory.mjs`.
- Generated `deck-go/docs/contract-inventory.md` and `deck-go/docs/contract-inventory.json`.
- Restored frontend endpoint classification into current docs and made it source-backed through:
  - `deck-go/contracts/source/deck-endpoints.contract.json`
  - `deck-go/contracts/scripts/sync-endpoint-classification.mjs`
  - `deck-go/docs/fe-endpoint-classification.md`
- Added a source-backed contract exception registry through:
  - `deck-go/contracts/source/deck-exceptions.contract.json`
  - `deck-go/contracts/scripts/sync-contract-exceptions.mjs`
  - `deck-go/docs/deck-contract-exceptions.md`
- Added Makefile targets:
  - `contracts-codegen-test`
  - `endpoint-classification-sync`
  - `endpoint-classification-check`
  - `contract-exceptions-sync`
  - `contract-exceptions-check`
  - `contract-inventory`
  - `contract-gate`
- Normalized endpoint categories to the OpenSpec names:
  - `gateway-protocol-adapter`
  - `deck-go-bff`
  - `stream-binary-upload`
  - `documented-exception`
- Completed endpoint classification against backend route registrations:
  - 137 browser-facing backend endpoint registrations
  - 145 classified endpoint rows
  - 0 unclassified endpoint registrations
  - 0 invalid endpoint classification rows
- Added frontend caller mapping to `deck-go/docs/contract-inventory.md`:
  - 111 frontend endpoint caller lines
  - 78 endpoint registrations with frontend callers
- Added reporting-only inventory checks for:
  - unclassified backend endpoint registrations
  - invalid endpoint classification categories
  - exception records missing required fields or affected method/endpoint
- Added explicit stream contract governance through:
  - `deck-go/contracts/source/deck-streams.contract.json`
  - `deck-go/contracts/scripts/sync-stream-contract.mjs`
  - `deck-go/docs/deck-stream-contract.md`
  - `stream-contract-sync`
  - `stream-contract-check`
- Documented `/stream`, `/logs/stream`, and `/chat/session-events` contracts, including generated event DTOs, temporary frontend-local runtime DTOs, and documented dynamic log payload leaves.
- Reconciled this change against `deck-go-gateway-protocol-full-alignment` in `openspec/changes/deck-go-end-to-end-contract-chain/gateway-alignment-reconciliation.md`.
- Confirmed the shared upstream-schema-missing Gateway exception set is the same eight methods recorded in `deck-go/contracts/source/deck-exceptions.contract.json`.
- Updated `make gateway-typecheck` so `deck-go/docs/gateway-untyped-exceptions.md` is generated from both inline allow markers and `deck-go/contracts/source/deck-exceptions.contract.json`; an inline untyped Gateway call without a registry record is now a violation.
- Updated `deck-go/contracts/README.md` with the contract authority chain, contract commands, and migration rules for generated Gateway artifacts, Deck-facing DTOs, endpoint classification, stream contracts, and exception records.

Fresh evidence:

```text
make contracts-codegen-test
deck-api codegen assertions passed

make contracts-check
deck-api generated artifacts are up to date

make endpoint-classification-check
endpoint classification is up to date

make contract-exceptions-check
contract exceptions are up to date

make stream-contract-check
stream contract is up to date

make gateway-typecheck
gateway-typecheck ok: 8 go exception(s), 0 fe violation(s)

make contract-gate
deck-api codegen assertions passed
deck-api generated artifacts are up to date
endpoint classification is up to date
contract exceptions are up to date
stream contract is up to date
gateway-typecheck ok: 8 go exception(s), 0 fe violation(s)
wrote deck-go/docs/contract-inventory.json
wrote deck-go/docs/contract-inventory.md
```

## 2026-05-01 Ralph Iteration 8

Split the frontend type authority out of `deck-go/frontend/src/api.ts`:

- Added `deck-go/frontend/src/api-types.ts`.
- Moved all exported `DeckGo*` type aliases/re-exports into `api-types.ts`.
- Kept `api.ts` as the transport/helper function surface and re-exported the same public types from `api-types.ts`.
- Updated contract inventory to count split frontend type surfaces across both `api.ts` and `api-types.ts`.

Current inventory after the split:

- Frontend exported `DeckGo*` types: 210
- Frontend generated DTO aliases/re-exports: 210
- Frontend local DTO definitions: 0
- Missing contract types: 0
- Duplicate DTO authority issues: 0
- Migrated-domain blocking issues: 0

Fresh evidence:

```text
make frontend-build
check-deck-ui-host ok
✓ built in 873ms

make contract-gate
deck-api codegen assertions passed
ui metadata assertions passed
deck-api generated artifacts are up to date
ui metadata is up to date
endpoint classification is up to date
contract exceptions are up to date
stream contract is up to date
gateway-typecheck ok: 8 go exception(s), 0 fe violation(s)
wrote deck-go/docs/contract-inventory.json
wrote deck-go/docs/contract-inventory.md
```

## 2026-05-01 Ralph Iteration 7

Completed the remaining Deck-facing DTO source migration and frontend DTO authority replacement:

- Added the remaining approvals, devices, nodes, cron, docs, alerts, webhooks, memory, budget, monitor, activity, identity, threads, and usage DTOs to `deck-api.contract.ts`.
- Regenerated `deck-go/contracts/generated/ts/deck-api.generated.ts`.
- Regenerated `deck-go/backend/internal/deckapi/types.generated.go`.
- Replaced the remaining frontend-local exported `DeckGo*` DTO definitions in `deck-go/frontend/src/api.ts` with generated aliases through a `DeckApi` type namespace import.
- Kept the existing runtime compatibility aliases for normalized bundled/remote runtime status. These aliases are generated-backed and are not counted as local DTO authority.
- Confirmed no temporary frontend DTO shim remains; therefore no new shim exception record is needed.

Generator support was extended for indexed-access types such as `DeckGoCronRunEntry["status"][]`, mapping them to a safe Go string representation instead of emitting invalid Go syntax.

Current inventory:

- Contract source `DeckGo*` types: 234
- Missing contract types: 0
- Frontend generated DTO aliases: 181
- Frontend local DTO definitions: 0
- Duplicate DTO authority issues: 0
- Migrated-domain blocking issues: 0

Fresh evidence:

```text
make contracts-codegen-test
deck-api codegen assertions passed

make contracts-check
deck-api generated artifacts are up to date
ui metadata is up to date

make backend-test
go test ./... passed for deck-go/backend

make frontend-build
check-deck-ui-host ok
✓ built in 867ms

make contract-gate
deck-api codegen assertions passed
ui metadata assertions passed
deck-api generated artifacts are up to date
ui metadata is up to date
endpoint classification is up to date
contract exceptions are up to date
stream contract is up to date
gateway-typecheck ok: 8 go exception(s), 0 fe violation(s)
wrote deck-go/docs/contract-inventory.json
wrote deck-go/docs/contract-inventory.md
```

## 2026-05-01 Ralph Iteration 6

Completed the remaining 4.3 Deck-facing DTO source migration for sessions/chat/log/compaction surfaces:

- `DeckGoSession`
- `DeckGoLogsTailResponse`
- `DeckGoCompactionCheckpoint`
- `DeckGoCompactionListResponse`
- `DeckGoCompactionActionResponse`

The bulk of session/chat/transcript/SSE event DTOs were already in `deck-api.contract.ts`; this slice closed the remaining local DTO gaps for the 4.3 category and regenerated TypeScript/Go artifacts.

Inventory movement after this DTO batch:

- Contract source `DeckGo*` types: 140
- Missing contract types: 94
- Duplicate DTO authority issues: 66
- Migrated-domain blocking issues: 0

Fresh evidence:

```text
make contracts-codegen-test
deck-api codegen assertions passed

make contract-gate
deck-api codegen assertions passed
ui metadata assertions passed
deck-api generated artifacts are up to date
ui metadata is up to date
endpoint classification is up to date
contract exceptions are up to date
stream contract is up to date
gateway-typecheck ok: 8 go exception(s), 0 fe violation(s)
wrote deck-go/docs/contract-inventory.json
wrote deck-go/docs/contract-inventory.md

make backend-test
go test ./... passed for deck-go/backend

make frontend-build
check-deck-ui-host ok
✓ built in 858ms
```

## 2026-05-01 Ralph Iteration 5

Migrated the 4.2 DTO batch into `deck-go/contracts/source/deck-api.contract.ts` and regenerated TypeScript/Go artifacts:

- agents
- tools
- config
- models
- skills
- subagents
- routing

The old frontend exports in `deck-go/frontend/src/api.ts` intentionally remain for now. This completes the 4.2 source-contract migration, while 4.5 will replace those local definitions with generated imports/re-exports.

Generator support was extended for the migration-time shape `Record<string, unknown> & { ... }`, so generated Go DTOs preserve the typed literal fields instead of collapsing the whole alias to `any`.

Inventory movement after this DTO batch:

- Contract source `DeckGo*` types: 135
- Missing contract types: 99
- Duplicate DTO authority issues: 62
- Migrated-domain blocking issues: 0

Fresh evidence:

```text
make contracts-codegen-test
deck-api codegen assertions passed

make contracts-check
deck-api generated artifacts are up to date
ui metadata is up to date

make backend-test
go test ./... passed for deck-go/backend

make frontend-build
check-deck-ui-host ok
✓ built in 875ms

make contract-gate
deck-api codegen assertions passed
ui metadata assertions passed
deck-api generated artifacts are up to date
ui metadata is up to date
endpoint classification is up to date
contract exceptions are up to date
stream contract is up to date
gateway-typecheck ok: 8 go exception(s), 0 fe violation(s)
wrote deck-go/docs/contract-inventory.json
wrote deck-go/docs/contract-inventory.md
```

## 2026-05-01 Ralph Iteration 4

Extended the contract inventory into a reporting-plus-blocking governance surface:

- Reports frontend generated DTO aliases vs frontend-local DTO definitions.
- Reports duplicate DTO authority issues when a frontend-local declaration owns a `DeckGo*` type already present in the generated Deck-facing contract.
- Reports potential undocumented dynamic backend surface lines from handler/runtime code.
- Carries stale UI metadata validation issues into the inventory report.
- Marks UI metadata domains by `migrationStatus`.
- Fails `make contract-gate` only for migrated-domain blocking issues:
  - migrated-domain DTOs still missing from `deck-api.contract.ts`
  - migrated-domain frontend DTO declarations that are not generated-backed aliases

Current governance snapshot:

- Frontend generated DTO aliases: 21
- Frontend local DTO definitions: 160
- Duplicate DTO authority issues: 0
- Migrated-domain blocking issues: 0
- Potential undocumented dynamic surface lines: 1368

Fresh evidence:

```text
make contract-inventory
wrote deck-go/docs/contract-inventory.json
wrote deck-go/docs/contract-inventory.md

make contract-gate
deck-api codegen assertions passed
ui metadata assertions passed
deck-api generated artifacts are up to date
ui metadata is up to date
endpoint classification is up to date
contract exceptions are up to date
stream contract is up to date
gateway-typecheck ok: 8 go exception(s), 0 fe violation(s)
wrote deck-go/docs/contract-inventory.json
wrote deck-go/docs/contract-inventory.md
```

Current inventory baseline:

- Frontend exported `DeckGo*` types: 181
- Contract source `DeckGo*` types: 54
- Missing contract types: 179
- Frontend API functions: 165
- Frontend endpoint caller lines: 111
- Endpoint registrations with frontend callers: 78
- Browser-facing endpoint registrations: 137
- Classified endpoint rows: 145
- Unclassified endpoint registrations: 0
- Invalid endpoint classification rows: 0
- Exception records missing fields: 0
- Endpoint categories:
  - `deck-go-bff`: 131
  - `documented-exception`: 3
  - `gateway-protocol-adapter`: 7
  - `stream-binary-upload`: 4
- Dynamic backend surface lines: 1368

Remaining stage gates before business DTO migration:

- Decide UI metadata source format before migrating high-value domains.
- Reconcile the existing Gateway typed alignment proposal before moving Gateway-backed BFF DTOs.

## 2026-05-01 Ralph Iteration 2

Migrated the first low-risk Deck-facing DTO batch into `deck-go/contracts/source/deck-api.contract.ts`:

- Settings and bootstrap connection/version responses.
- Runtime Gateway state and configured-model responses.
- Gateway health, status, and describe responses.
- Channel test and throughput responses.
- Plugin capability and approval responses.

Generated artifacts were refreshed in:

- `deck-go/contracts/generated/ts/deck-api.generated.ts`
- `deck-go/backend/internal/deckapi/types.generated.go`

Frontend DTO authority for the migrated domains now comes from the generated contract artifact. `deck-go/frontend/src/api.ts` keeps compatibility exports for existing consumers, but those exports are aliases or narrowed aliases over generated DTOs for the migrated settings/runtime/gateway/channel/plugin domains.

Fresh evidence captured during this slice:

```text
make frontend-build
check-deck-ui-host ok: frontend uses Deck UI host alias and local package resolution
✓ built in 1.38s

make backend-test
ok  	openclawdeck/backend/internal/api	(cached)
ok  	openclawdeck/backend/internal/deckapi	(cached)
ok  	openclawdeck/backend/internal/gateway	(cached)
ok  	openclawdeck/backend/internal/runtime	(cached)
ok  	openclawdeck/backend/internal/store	(cached)
```

Inventory movement after this DTO batch:

- Contract source `DeckGo*` types: 73
- Missing contract types: 161
- No remaining inventory gaps for the 4.1 settings/bootstrap/runtime/gateway/channel/plugin DTO batch.

## 2026-05-01 Ralph Iteration 3

Added the first UI metadata contract layer as a sibling source file:

- `deck-go/contracts/source/deck-ui.contract.json`
- `deck-go/contracts/scripts/sync-ui-contract-metadata.mjs`
- `deck-go/contracts/scripts/sync-ui-contract-metadata.test.mjs`
- `deck-go/contracts/generated/ts/deck-ui-metadata.generated.ts`
- `deck-go/docs/deck-ui-contract-metadata.md`

The chosen source format is `sibling-ui-contract-json`, keeping UI semantics adjacent to but separate from `deck-api.contract.ts`. The first-pass schema covers labels, field kinds, input hints, table hints, status semantics, empty states, action safety, capability requirements, and refresh behavior.

Metadata is now present for the first UI-planning domains:

- runtime/settings
- agents/tools
- sessions/chat
- usage/monitor
- approvals

The metadata validator fails on stale DTO references, stale field references, unknown endpoint IDs, unknown action IDs, unknown action safety values, and destructive actions without confirmation metadata. The generated frontend artifact gives future UI work a stable import target without reading Go handlers.

Contract inventory now includes UI metadata coverage and Gateway exception counts:

- UI metadata domains: 5
- UI metadata migrated domains: 1
- UI metadata field entries: 24
- UI metadata actions: 17
- UI metadata covered DTOs: 33
- UI metadata covered endpoints: 39
- UI metadata issues: 0
- Gateway untyped exceptions: 8

Fresh evidence:

```text
make ui-metadata-sync
wrote deck-go/contracts/generated/ts/deck-ui-metadata.generated.ts
wrote deck-go/docs/deck-ui-contract-metadata.md

make ui-metadata-test
ui metadata assertions passed

make ui-metadata-check
ui metadata is up to date

make contract-gate
deck-api codegen assertions passed
ui metadata assertions passed
deck-api generated artifacts are up to date
ui metadata is up to date
endpoint classification is up to date
contract exceptions are up to date
stream contract is up to date
gateway-typecheck ok: 8 go exception(s), 0 fe violation(s)
wrote deck-go/docs/contract-inventory.json
wrote deck-go/docs/contract-inventory.md
```
