## 1. Baseline And Contract Truth

- [x] 1.1 Re-read runtime id, Deck contract source/generated artifacts, Gateway transport, Data Fabric query-key, and follow-up inbox sources listed in `design.md`.
- [x] 1.2 Confirm whether the default runtime id can be generated from contract authority in this change; update artifacts before implementation if the chosen path changes materially.
- [x] 1.3 Record the selected path in `verification.yaml`: generated contract constant or explicit verified bridge.

## 2. Runtime Id And Query Keys

- [x] 2.1 Move frontend Data Fabric default runtime id usage to contract-owned/generated authority, or add the explicit bridge verification described in `design.md`.
- [x] 2.2 Ensure Data Fabric query keys and Gateway client code do not add new hand-written `"rt_local"` fallbacks.
- [x] 2.3 Add or update query-key tests documenting default runtime id use and numeric-like object key ordering.

## 3. Gateway RPC Transport

- [x] 3.1 Refactor Gateway RPC transport/client construction only if reusable state can be separated from per-request `X-Request-Id` generation.
- [x] 3.2 Add tests proving default Gateway RPC requests keep fresh request ids across repeated calls.
- [x] 3.3 Add or preserve tests proving explicit caller-provided request ids remain stable.

## 4. Follow-Up And Documentation

- [x] 4.1 Update `openspec/follow-ups/2026-05-08-frontend-data-fabric-follow-ups.md` statuses for FU-002, FU-003, and FU-004 according to evidence.
- [x] 4.2 Update Data Fabric README or code comments only where they document the selected runtime id or Gateway tracing behavior.

## 5. Verification And Closure

- [x] 5.1 Run focused frontend tests for query keys and Gateway transport/client behavior.
- [x] 5.2 Run `cd deck-go/frontend-new && npx tsc -b --pretty false`.
- [x] 5.3 Run `cd deck-go && make frontend-build`.
- [x] 5.4 If contract source or generated artifacts changed, run the relevant contract sync/check and `cd deck-go && make contract-gate`.
- [x] 5.5 Run `openspec validate deck-go-data-fabric-contract-and-transport-cleanup --type change --strict`.
- [x] 5.6 Create or update `verification.yaml` with command evidence, fallback decisions, unrelated failures, and archive readiness.
- [x] 5.7 Sync accepted spec deltas into main specs, rerun touched spec validation, and archive the change when ready.
