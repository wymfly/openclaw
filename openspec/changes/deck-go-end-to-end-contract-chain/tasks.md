## 0. Baseline and Inventory

- [x] 0.1 Capture current Gateway protocol status with `make protocol-check` and `make gateway-typecheck`; record the existing untyped exception count and paths.
- [x] 0.2 Capture current Deck-facing contract status with `make contracts-check`; record generated TypeScript and Go artifact paths.
- [x] 0.3 Inventory all exported `DeckGo*` DTOs and API functions in `deck-go/frontend/src/api.ts`; group them by module domain.
- [x] 0.4 Inventory all browser-facing Deck Go backend endpoints and route handlers; map each route to its frontend caller.
- [x] 0.5 Compare frontend DTO inventory against `deck-go/contracts/source/deck-api.contract.ts`; produce a missing-type/module report.
- [x] 0.6 Identify all backend handler responses that still use `any`, `map[string]any`, raw `unknown`, or Gateway passthrough shapes.

## 1. Contract Generator Foundation

- [x] 1.1 Extend the Deck-facing contract parser to support the TypeScript constructs needed by existing `DeckGo*` DTOs: exported interfaces, exported type aliases, string literal unions, nullable fields, nested arrays, records, and referenced DTOs.
- [x] 1.2 Add generator tests for TypeScript-to-TypeScript output parity for representative DTOs from settings, runtime, agents, sessions, usage, and approvals.
- [x] 1.3 Add generator tests for TypeScript-to-Go output parity for optional fields, union-like enums, records, arrays, and nested DTO references.
- [x] 1.4 Add support for Deck-facing SSE event DTO generation or explicitly document the stream contract format if generated event DTOs require a separate file.
- [x] 1.5 Ensure `make contracts-check` fails when generated TypeScript or Go artifacts drift from `deck-go/contracts/source/`.

## 2. Endpoint Classification and Exceptions

- [x] 2.1 Create a machine-readable endpoint classification source for all Deck Go browser-facing endpoints.
- [x] 2.2 Classify each endpoint as `gateway-protocol-adapter`, `deck-go-bff`, `stream-binary-upload`, or `documented-exception`.
- [x] 2.3 Generate a human-readable endpoint inventory document from the classification source.
- [x] 2.4 Create or update the exception registry for untyped Gateway methods, dynamic Deck-facing payloads, raw passthroughs, and temporary frontend DTO shims.
- [x] 2.5 Add owner, reason, affected endpoint or method, and exit criteria to each existing exception.
- [x] 2.6 Add a reporting-only check that flags unclassified endpoints and exceptions missing required fields.

## 3. Gateway Source Protocol Adapter Alignment

- [x] 3.1 Reconcile this proposal with the existing Gateway typed alignment change so the Gateway source protocol remains the only authority for Gateway method and event shapes.
- [x] 3.2 Update Gateway adapter code paths to consume generated Gateway request/result/event DTOs wherever upstream schemas already exist.
- [x] 3.3 Keep the existing eight upstream-schema-missing Gateway methods as documented exceptions until upstream schemas or replacement contracts exist.
- [x] 3.4 Add adapter tests showing generated Gateway results are converted into generated Deck-facing DTOs for at least agents, sessions, usage, and approvals.
- [x] 3.5 Add a check that fails on new untyped Gateway calls unless the method has a documented exception.

## 4. Deck-Facing DTO Migration

- [x] 4.1 Migrate settings, bootstrap, runtime, gateway status, channels, and plugins DTOs into `deck-api.contract.ts`; regenerate TS and Go artifacts.
- [x] 4.2 Migrate agents, tools, config, models, skills, subagents, and routing DTOs into `deck-api.contract.ts`; regenerate TS and Go artifacts.
- [x] 4.3 Migrate sessions, chat, transcript, log stream, and SSE event DTOs into the Deck-facing contract source; regenerate TS and Go artifacts.
- [x] 4.4 Migrate approvals, devices, nodes, cron, docs, alerts, webhooks, memory, budget, monitor, activity, identity, threads, and usage DTOs into the Deck-facing contract source.
- [x] 4.5 Replace frontend-local `DeckGo*` DTO definitions in migrated domains with imports or re-exports from generated contract artifacts.
- [x] 4.6 Keep temporary frontend DTO shims only where needed for staged migration and record each shim in the exception registry.
- [x] 4.7 Split `deck-go/frontend/src/api.ts` as needed so transport wrappers, generated DTO imports, and domain-specific helpers are no longer mixed into one large authority file.

## 5. Backend DTO Adoption

- [x] 5.1 Update Deck Go backend handlers for low-risk BFF modules to decode requests and encode responses with generated `deckapi` Go DTOs.
- [x] 5.2 Update Gateway-backed handler adapters to return generated Deck-facing DTOs after consuming generated Gateway protocol DTOs.
- [x] 5.3 Replace handler-level `map[string]any` and `any` response shapes in migrated modules with generated DTOs or documented dynamic leaves.
- [x] 5.4 Add compatibility tests that compare selected pre-migration JSON payloads to generated DTO output for migrated modules.
- [x] 5.5 Add negative tests for typed error envelopes, validation failures, runtime unavailable, and Gateway unavailable cases.

## 6. UI Contract Metadata

- [x] 6.1 Choose the metadata source format: annotations in `deck-api.contract.ts`, a sibling UI contract file, or per-domain metadata files under `deck-go/contracts/source/`.
- [x] 6.2 Define the first-pass metadata schema for labels, field kinds, input hints, table hints, status semantics, empty states, action safety, capability requirements, and refresh behavior.
- [x] 6.3 Add metadata for the first migrated domains: runtime/settings, agents/tools, sessions/chat, usage/monitor, and approvals.
- [x] 6.4 Generate or validate metadata references against generated DTOs, fields, endpoints, and actions.
- [x] 6.5 Expose a generated frontend metadata artifact that future UI panels can consume without reading backend handler code.
- [x] 6.6 Add tests that fail when metadata references stale DTOs, missing fields, unknown actions, or removed endpoint IDs.

## 7. Governance Gates

- [x] 7.1 Implement a contract coverage report with Gateway protocol coverage, Deck-facing endpoint DTO coverage, frontend-local DTO count, UI metadata coverage, and exception count.
- [x] 7.2 Add reporting-only checks for duplicate DTO authority, unclassified endpoints, stale metadata, and undocumented dynamic leaves.
- [x] 7.3 Mark migrated modules in the coverage report and make duplicate DTOs or missing generated DTO usage blocking only for migrated modules.
- [x] 7.4 Add a CI or Makefile target that runs `protocol-check`, `gateway-typecheck`, `contracts-check`, contract coverage, and metadata validation in a single Deck Go contract gate.
- [x] 7.5 Update `deck-go/docs/gateway-untyped-exceptions.md` or its replacement so it is generated from the exception registry.
- [x] 7.6 Document the contract authority chain and migration rules in `deck-go/contracts/README.md`.

## 8. Verification and Rollout

- [x] 8.1 Run focused frontend typecheck for migrated modules and fix all generated DTO import/type errors.
- [x] 8.2 Run backend Go tests for migrated handlers and adapters.
- [x] 8.3 Run `make protocol-check`, `make gateway-typecheck`, and `make contracts-check` after each migration batch.
- [x] 8.4 Run browser or Playwright smoke tests for agents list/detail, sessions/chat, runtime/settings, usage/monitor, approvals, and stream reconnect behavior.
- [x] 8.5 Review the final coverage report and ensure all remaining exceptions have owners and exit criteria.
- [x] 8.6 Enable blocking governance checks for all migrated domains.
- [x] 8.7 Prepare implementation notes that describe remaining dynamic surfaces and the next proposal needed for upstream schema gaps or plugin schema contracts.
