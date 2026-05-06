## Context

Alerts is a Deck-local configuration surface. The browser calls the Go BFF through `frontend-new/src/api.ts`; the BFF persists alert rules in local JSON storage through `localstore.AlertRule`. The existing contract exposes alert rule CRUD fields (`name`, `entityType`, `condition`, `threshold`, `action`, `cooldownMs`, `enabled`, timestamps, and `lastFiredAt`) but does not expose durable fired history, audit history, alert evaluator state, test-fire dry runs, webhook target binding, or condition DSL grammar.

The v2 handoff package is visually richer than the current production panel and includes some product concepts that are not yet backed by a real contract. This pass therefore combines implementation with calibration: implement what the contract can support, fix deterministic drift, and document unsupported assumptions instead of making mock-only UI look real.

## Goals / Non-Goals

**Goals:**

- Rebuild Alerts production UI toward the v2 high-fidelity package while preserving the BFF-only contract boundary.
- Keep alert rule CRUD, selection, filtering, validation, toggle, delete guard, and refresh behavior contract-backed.
- Represent unsupported fires/audit/test-fire/evaluator semantics as disabled, fallback, or documented product gaps.
- Verify source DTOs, generated artifacts, Go BFF routes/localstore behavior, frontend wrappers, production UI, L1 mock visual behavior, and L2 real-stack CRUD/API/UI behavior.
- Apply deterministic fixes immediately when the root cause is clear and scoped to Alerts.

**Non-Goals:**

- No Gateway method additions.
- No alert evaluator engine, real delivery pipeline, webhook confirmation, durable fired-event store, or audit event store.
- No condition DSL parser, syntax highlighting, autocomplete, or schema editor.
- No new dependencies and no design-system atom/pattern promotion.

## Decisions

### D1: Use the v2 prototype as visual direction, not as capability truth

The production UI should borrow the v2 layout language: compact list, filters, KPI strip, selected detail, trigger/action evidence, and guarded CRUD. However, any prototype feature without contract support must be simplified, disabled, or documented. This avoids turning mock `recentFires` and `audit` data into false product claims.

### D2: Preserve the Deck-local CRUD contract

Alerts remains a local BFF policy store. Frontend code continues to call `fetchAlertRules`, `createAlertRule`, `updateAlertRule`, and `deleteAlertRule`. Backend validation remains owned by Go route/input handling. Contract changes are allowed only if source contract and actual Go JSON behavior diverge.

### D3: Verification includes real mutation but isolates test data

The L2 real-stack E2E may create, patch, and delete a uniquely named test alert rule because Alerts is Deck-local and not a provider/LLM side effect. The test must clean up its own rule and tolerate pre-existing user alert rules without destructive broad cleanup.

### D4: Product gaps are explicit

Fired history, audit timeline, and test fire are not treated as supported just because the prototype includes them. The implementation can show a fallback panel using `lastFiredAt` and explanatory copy, but it must not invent event rows or claim delivery verification.

## Risks / Trade-offs

- **Prototype overreach** -> Gate each visible workflow against DTO/BFF evidence and record unsupported concepts in `implementation-notes.md`.
- **Local store persistence can contain user data** -> L2 test creates a unique rule id/name path and deletes only the rule it created.
- **CRUD UI can regress while visual density improves** -> Keep focused unit tests for load, validation, create/edit/toggle/delete, and add real-stack API/UI coverage.
- **Contract optionality may be unclear** -> Fix only when Go JSON tags and real responses prove drift; otherwise record for final audit.

## Migration Plan

1. Baseline handoff, archived hifi spec, current production Alerts code, contracts, wrappers, Go routes/localstore, and tests.
2. Build a contract-chain matrix for supported CRUD, degraded/fallback fired evidence, and unsupported evaluator/history/test-fire semantics.
3. Implement scoped production UI and contract/wrapper/backend fixes backed by evidence.
4. Run focused frontend and backend tests, L1 mock visual E2E, L2 real-stack Alerts API/UI E2E, OpenSpec validation, and build checks.
5. Update handoff status/implementation notes and archive the change only after tasks and verification evidence are complete.
