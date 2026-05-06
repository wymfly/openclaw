## Context

`usage` already has an archived hifi redesign and an implemented `frontend-new` panel. The refreshed v2 handoff is richer: it defines a cost and quota cockpit with topbar KPIs, range presets, provider quota cards, daily aggregates, searchable/sortable sessions, and a four-tab session detail drawer. The current production panel is contract-aware but simplified, and it still uses older `models/usage` endpoint names for cost and provider quota data.

Verified route chain for the proposal baseline:

- `GET /api/bootstrap/status` -> Go `managed.BootstrapStatus`, already loaded by the Deck UI store.
- `GET /api/models/usage/cost` -> active legacy alias -> Gateway `usage.cost`.
- `GET /api/models/usage/providers` -> legacy alias -> Gateway `usage.status`.
- `GET /api/usage/sessions` -> Go BFF -> Gateway `sessions.usage`.
- `GET /api/usage/sessions/logs` -> Go BFF -> Gateway `sessions.usage.logs`.
- `GET /api/usage/timeseries` -> Go BFF -> Gateway `sessions.usage.timeseries`.
- `GET /api/v1/usage/cost` -> admin route tree -> Gateway `usage.cost`.

Observed deterministic drift at proposal time:

- The handoff documents `GET /api/usage/cost` and `GET /api/usage/providers`, while `frontend-new/src/api.ts`, endpoint classification, and existing smoke tests still name `GET /api/models/usage/cost` and `GET /api/models/usage/providers`.
- The active frontend `/api` route tree does not expose canonical `/api/usage/cost` or `/api/usage/providers`; only the admin `/api/v1` route tree exposes `/usage/cost`.
- `recharts` is requested by the handoff but is not declared in `frontend-new/package.json` or its lockfile. Repository rules require explicit approval for new dependencies.

## Goals / Non-Goals

**Goals:**

- Verify Usage from handoff prototype through frontend wrappers, Go BFF routes, OpenClaw Gateway methods, mocks, and real-stack behavior.
- Make `/api/usage/*` the production Usage route family where it is already backed by Gateway capability, while preserving legacy `/api/models/usage/*` aliases for existing Models and smoke coverage.
- Translate the v2 handoff into production code as far as current contracts and existing dependencies allow: read-only KPIs, cost/token trend, provider quotas, searchable/filterable/sortable sessions, selected-session details, lazy logs/timeseries/context weight, loading/empty/error states, and BFF-only access.
- Add bounded real-stack evidence without requiring real LLM traffic or guaranteed non-empty usage rows.
- Record unsupported or ambiguous claims for final review instead of hiding them in code.

**Non-Goals:**

- Add `recharts` or any new dependency without explicit approval.
- Claim real billing accuracy, provider quota policy semantics, tenant accounting, cost forecasting, or fixed timeseries granularity.
- Add mutation flows, exports, budget-rule editing, or session kill/rename actions.
- Add new Gateway methods or change upstream Gateway schemas.
- Promote local Usage molecules to design-system primitives in this change.

## Decisions

- **Use `/api/usage/*` as canonical for the Usage panel and keep `/api/models/usage/*` as compatibility aliases.** The v2 handoff and current BFF `/usage/cost` route already point to a Usage-owned route family. Adding `/usage/providers` removes an avoidable asymmetry while preserving existing Models usage and smoke tests.
- **Fix clear drift at the source-owned layer.** Endpoint classification, frontend wrappers, Go route aliases, tests, and handoff docs are deterministic if they disagree with the route chain. Those changes are in scope and should be fixed directly.
- **Do not add `recharts` in this change.** The prototype's chart primitives can be translated with existing React/CSS/SVG or progress-based charting. The dependency decision remains a recorded handoff risk until the user explicitly approves adding it.
- **Separate real capability from real data volume.** L2 real-stack tests must verify route shape, Gateway method reachability, UI rendering, and browser-to-BFF-only behavior. Empty daily cost, provider quota, sessions, logs, or timeseries can be empty-valid when the real Gateway has no data after bounded attempts.
- **Keep Usage read-only.** The panel may navigate to related agent/session panels, but it must not mutate Gateway, budgets, sessions, models, or providers.
- **Use design-system primitives where already available, but keep module-local layout.** Shared atoms/icons/patterns can be used when they exist; new Usage-specific quota/provider/session molecules stay module-local until at least one more module proves reuse.

## Risks / Trade-offs

- **Real Gateway usage may be empty or provider quota may be unknown** -> Verify response shape and render empty/degraded states; record empty-valid evidence rather than creating artificial usage.
- **Route alias migration may affect legacy consumers** -> Preserve `/api/models/usage/cost` and `/api/models/usage/providers` while switching the Usage panel and contract metadata to canonical `/api/usage/*`.
- **`recharts` visual parity gap** -> Build with existing dependencies and record that tooltip/crosshair/brush-grade chart fidelity is dependency-blocked.
- **Context-weight semantics may overstate precision** -> Show source (`run` or `estimate`) when available and record trust/visual weighting as a follow-up.
- **Admin `/api/v1` and active `/api` route trees may diverge** -> Update both only when the route is part of the verified Usage contract chain, and keep focused route tests.
- **Real L2 attempts may fail due to environment, auth, or Gateway readiness** -> Apply the circuit breaker after three fresh attempts for a scenario with no new narrowing evidence; static review, source fixes, focused tests, and L1 mock visual evidence remain mandatory.
