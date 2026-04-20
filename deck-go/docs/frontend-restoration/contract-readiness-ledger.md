# Contract-Readiness Ledger

This ledger classifies legacy panel families against current `deck-go` backend contract readiness.

## Status model

- `ready`: current deck-go contracts appear sufficient for restoration without new backend façade work
- `ready-with-adapter`: current deck-go contracts are partially sufficient, but frontend restoration will need adapter-side normalization or selective façade completion
- `frontend-blocked`: current deck-go contracts are not yet sufficient; frontend restoration should not start on that family without additional backend support

## Ledger

| Panel family             | Status               | Current evidence                                                                                                                                                                                                                                                |
| ------------------------ | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chat`                   | `ready-with-adapter` | current `deck-go` already has session/chat/read/live continuity seams in `deck-go/frontend/src/api.ts`, `deck-go/frontend/src/stream-contract.ts`, and `deck-go/contracts/generated/ts/deck-api.generated.ts`; structure is wrong, contracts are partially real |
| `sessions`               | `ready-with-adapter` | `deck-go/backend/internal/server/inventory.go` exposes `/sessions`; current DTOs cover session list/detail/history seam                                                                                                                                         |
| `gateway` / monitor      | `ready-with-adapter` | `deck-go/backend/internal/server/gateway.go` and `/runtime/gateway` already expose bootstrap/runtime status, but panel-grade monitor surface still needs frontend remapping                                                                                     |
| `logs`                   | `ready-with-adapter` | `/logs` and `/logs/stream` already exist; current shell consumes log streams                                                                                                                                                                                    |
| `channels`               | `ready-with-adapter` | `channels.status`, `channels.logout`, and config patch path exist, but full legacy channel panel family is richer than current deck-go contract                                                                                                                 |
| `plugins`                | `ready-with-adapter` | `deck.plugins.list` exists, but legacy plugin panel behavior likely needs more than inventory listing                                                                                                                                                           |
| `config` / config-editor | `ready-with-adapter` | `config.get`, `config.patch`, `config.apply`, `config.schema.lookup` exist, but the legacy config-editor workflow is deeper than the current frontend                                                                                                           |
| `models`                 | `frontend-blocked`   | current deck-go frontend/backend surface does not yet expose a restored models panel contract comparable to legacy `ModelsPanel` expectations                                                                                                                   |
| `approvals`              | `frontend-blocked`   | current shell still treats approval mainly as a slot; no dedicated deck-go approvals façade is restored yet                                                                                                                                                     |
| `routing`                | `frontend-blocked`   | no restored routing façade or simulator-specific deck-go surface is present yet                                                                                                                                                                                 |
| `threads`                | `frontend-blocked`   | no thread panel contract or façade visible in current deck-go surface                                                                                                                                                                                           |
| `agents`                 | `frontend-blocked`   | legacy agent detail/list workflow is not yet restored against deck-go-owned frontend structure                                                                                                                                                                  |
| `subagents`              | `frontend-blocked`   | no dedicated subagent contract or façade is restored yet                                                                                                                                                                                                        |
| `identity`               | `frontend-blocked`   | no identity panel-facing deck-go contract currently surfaced                                                                                                                                                                                                    |
| `nodes`                  | `frontend-blocked`   | no node-management-specific deck-go frontend contract restored yet                                                                                                                                                                                              |
| `memory`                 | `frontend-blocked`   | no memory panel family surface restored in deck-go frontend                                                                                                                                                                                                     |
| `usage`                  | `frontend-blocked`   | no usage panel family restoration contract visible in current deck-go frontend                                                                                                                                                                                  |
| `activity`               | `frontend-blocked`   | no activity timeline surface restored yet                                                                                                                                                                                                                       |
| `webhooks`               | `frontend-blocked`   | no webhooks panel contract surfaced yet                                                                                                                                                                                                                         |
| `alerts`                 | `frontend-blocked`   | no alerts panel contract surfaced yet                                                                                                                                                                                                                           |
| `cron`                   | `frontend-blocked`   | no cron/scheduler panel contract surfaced yet                                                                                                                                                                                                                   |
| `skills`                 | `frontend-blocked`   | no skills panel contract surfaced yet                                                                                                                                                                                                                           |
| `docs`                   | `frontend-blocked`   | no docs hub contract surfaced yet                                                                                                                                                                                                                               |
| `api-explorer`           | `ready-with-adapter` | `gateway.describe` and related gateway APIs exist, but no restored explorer-specific frontend composition exists yet                                                                                                                                            |
| `budget`                 | `frontend-blocked`   | no budget panel contract surfaced yet                                                                                                                                                                                                                           |
| `settings`               | `ready-with-adapter` | local settings/bootstrap/runtime shell exists, but not yet in legacy settings-panel structure                                                                                                                                                                   |

## Use rule

This ledger is a Tranche 0 planning artifact, not an implementation verdict.

Execution should pick the first restoration slices from:

- `ready`
- `ready-with-adapter`

and defer `frontend-blocked` families until the required deck-go backend contract surface exists.
