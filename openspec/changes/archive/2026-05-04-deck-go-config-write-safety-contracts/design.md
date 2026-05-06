## Context

The Gateway truth for config writes is currently `config.get`, `config.apply`, `config.patch`, and related generated method schemas. Deck Go already forwards these through `backend/internal/runtime/openclaw/gateway_queries.go` and exposes product BFF routes such as `POST /api/config/apply`, `POST /api/config/patch`, `PATCH /api/models/config`, `POST /api/deck/routing`, `POST /api/deck/identity`, and `POST /api/deck/agents` action variants for skills/event-stream/subagent config.

The current frontend already passes `baseHash` in many of these flows and some panels have local conflict handling, but there is no shared contract that says which writes require a base hash, which responses return a next hash, how conflicts should be represented, whether idempotency is supported, or what rollback/audit claims are allowed. The head matrix marks this as P0 because later module completion work should not independently rediscover write-safety semantics.

## Goals / Non-Goals

**Goals:**

- Inventory every current Deck Go config-like write path and classify the source of truth.
- Define one shared Deck-facing write-safety envelope for request identity, base-hash behavior, next-hash behavior, conflict/degraded responses, and unsupported rollback/audit claims.
- Keep Gateway truth first: use existing Gateway `config.*` and fork-added typed Gateway methods; do not add Gateway APIs in this proposal.
- Fix deterministic drift discovered during implementation, especially local `Record<string, unknown>` mutation responses, inconsistent `hash`/`baseHash` naming, and missing conflict tests.
- Add source-owned governance/report evidence so future config-like writes cannot bypass the safety contract silently.
- Update the head matrix and archive this child proposal when verification passes.

**Non-Goals:**

- Do not add persistent audit/history, rollback/version restore, import/export, secret-vault, or schema-batch Gateway features unless existing code truth already supports them.
- Do not make real non-noop writes to the operator's global OpenClaw config during automated verification.
- Do not redesign panels visually; UI changes are limited to deterministic safety behavior and type/facade alignment.
- Do not force non-config writes such as chat send/abort into this proposal unless they directly use config state or config-like base-hash mutation semantics.

## Decisions

### Decision: Introduce Deck-side config-write governance as a companion source

Add a source file under `deck-go/contracts/source/` that lists config-like write routes/actions, owner module, Gateway support basis, required base-hash behavior, response hash behavior, idempotency support, conflict behavior, rollback/audit status, and verification evidence.

Alternative considered: fold all metadata into `deck-route-governance.contract.json`. Rejected because route governance answers route ownership, while write safety needs action-level semantics for multiplexed routes such as `/api/deck/agents`, `/api/deck/routing`, and `/api/deck/identity`.

### Decision: Normalize at the Deck API/product layer, not by changing Gateway contracts

When Gateway result schemas expose `hash`, `baseHash`, or dynamic payload fields, Deck Go should adapt them into stable Deck-facing DTOs where product UI depends on them. Existing Gateway method schemas remain the source for wire compatibility.

Alternative considered: require Gateway to standardize all write responses first. Rejected for this child proposal because the user's current rule is Gateway truth first with no new upstream APIs by default.

### Decision: Conflict handling is required even when the Gateway error shape is heterogeneous

Deck Go should preserve upstream error text/details, but product facades and panels must detect known stale-hash/conflict cases and keep local edits intact. Where the backend can cheaply classify conflict status without hiding the original error, it should expose a stable field.

Alternative considered: leave conflict handling entirely to panel-local string matching. Rejected because the same base-hash semantics appear across several panels.

### Decision: Rollback and audit/history remain unavailable unless code truth exists

The contract should explicitly say rollback/audit/history are unsupported or deferred for each current write path. This prevents frontend product copy or mocks from implying enterprise features that Gateway/Deck do not yet provide.

Alternative considered: implement local audit/history now. Rejected because that belongs to the existing P1 `deck-go-control-audit-history-contract` matrix item and should not be hidden inside write-safety hardening.

## Risks / Trade-offs

- **Risk: broad surface area** -> Start with current config-like routes/actions and generated governance report; do not redesign unrelated modules.
- **Risk: false confidence from mocks** -> Require focused static/backend/frontend tests and record any real write checks as safe no-op only.
- **Risk: response-shape churn** -> Keep additive DTO normalization and compatibility aliases where existing frontend code already consumes `hash`.
- **Risk: multiplexed route ambiguity** -> Governance must include action-level rows, not just method/path rows.

## Migration Plan

1. Explore and record all config-like write paths in backend handlers, runtime adapters, frontend facades, generated Gateway types, and existing module tests.
2. Add config-write governance source plus a deterministic JSON/Markdown report and check target.
3. Wire the check into `contract-gate`.
4. Normalize Deck-facing DTO/facade/backend behavior where drift is deterministic.
5. Add or refresh focused tests for base-hash forwarding, conflict preservation, unsupported rollback/audit status, and no-op write safety.
6. Refresh contract inventory, generated artifacts, dynamic-surface reports if affected, route governance if necessary, and the head matrix.
7. Run OpenSpec validation, focused backend/frontend tests, `make contract-gate`, `git diff --check`, then archive.

## Open Questions

- Which current Gateway errors can be classified as base-hash conflicts without losing useful upstream details?
- Which module-level writes should remain `configHash` in UI-facing DTOs for readability, and which should expose `baseHash` as the canonical field?
- Whether idempotency should be generated by Deck for any config-like write that Gateway does not natively de-duplicate, or whether it should remain explicitly unsupported until Gateway supports it.
