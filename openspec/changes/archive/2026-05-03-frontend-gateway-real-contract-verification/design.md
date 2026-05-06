## Context

`gateway` already has an archived hifi redesign and an implemented `frontend-new` panel. The handoff package was refreshed after that archive with a richer multi-file prototype (`app.jsx`, `batch-console.jsx`, `describe-explorer.jsx`, data and CSS updates). The current production chain is mixed: runtime summary and capabilities are Deck runtime/BFF data, Gateway health/status/describe are BFF diagnostic routes over Gateway RPCs, and activity/monitor views are Deck backend projections over the event bus.

Verified route chain for the proposal baseline:

- `GET /api/bootstrap/status` -> Go `managed.BootstrapStatus`
- `GET /api/runtime/gateway` -> runtime facade/managed runtime status
- `GET /api/runtime/capabilities` -> runtime capabilities
- `GET /api/gateway/health` -> Go route -> Gateway `health`
- `GET /api/gateway/status` -> Go route -> Gateway `status`
- `GET /api/gateway/describe` -> Go route -> Gateway `gateway.describe`
- `GET /api/activity?limit=N` -> event bus projection
- `GET /api/monitor/runs` -> event bus run aggregation
- `GET /api/monitor/runs/{runId}` -> selected run event aggregation
- `GET /api/monitor/stats` -> aggregated run stats

## Goals / Non-Goals

**Goals:**

- Verify Gateway from handoff prototype through frontend wrappers, Go BFF/runtime routes, Gateway diagnostic RPCs, event-bus projections, mocks, and real-stack behavior.
- Treat the refreshed handoff as the visual/product target only when it matches current contracts and real BFF behavior.
- Fix deterministic Gateway-scoped drift directly, including stale handoff status, wrapper/docs drift, missing/degraded UI states, mock visual gaps, or real-stack test issues.
- Add bounded real-stack API/UI evidence without depending on real LLM traffic or guaranteed monitor-run presence.

**Non-Goals:**

- Add runtime lifecycle controls or change runtime mode from the panel.
- Add new upstream Gateway methods or result schemas unless a deterministic contract drift is found.
- Add durable activity storage or force real LLM calls solely to produce monitor events.
- Promote local gateway molecules to design-system primitives in this change.

## Decisions

- **Use current BFF/runtime truth over prototype additions.** The refreshed prototype includes describe and batch-console-like surfaces, but production can only activate them if current wrappers/routes exist and are safe. Unsupported prototype-only workflows become handoff notes.
- **Separate diagnostics from projections.** Gateway health/status/describe are real Gateway diagnostic RPC evidence; activity and monitor history are Deck event-bus projections and may be empty in real stacks.
- **Treat empty real monitor history as valid when route shape is verified.** Real-stack verification must prove runtime readiness, route shape, and UI rendering. It may classify monitor detail as empty-valid or handoff-blocked if no run exists after bounded attempts.
- **Keep lifecycle controls absent.** Start/stop/restart routes exist in the runtime surface, but this panel intentionally remains a diagnostics workbench unless a separate operations proposal adds stronger safeguards.
- **No dependency expansion.** Gateway visual refinements should keep module-local CSS and existing React state/tests.

## Risks / Trade-offs

- **Real event bus may not contain monitor runs** -> Verify list/stats/detail route shapes separately and record empty-valid evidence instead of fabricating runs.
- **Gateway health/status schema may be partial or environment-dependent** -> Render optional fields as unavailable and write tests against shape, not exact rich payloads.
- **Refreshed prototype may include unsupported batch/describe workflows** -> Implement only contract-backed surfaces; document ambiguous additions for final review.
- **Gateway-not-configured behavior differs from real-stack bundled mode** -> Keep first-run behavior covered by mock/unit tests and cover real-stack configured mode separately.
