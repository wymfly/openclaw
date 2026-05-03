## Context

`frontend-new` already has a functional `LogsPanel` with tail loading, SSE stream subscription, cursor persistence, local level/source/session filtering, live event tape, stream event details, export preview, and raw tail payload inspection. Its data boundary is the existing API facade: `fetchLogsTail` for `GET /logs` and `streamLogEvents` for `GET /logs/stream`.

Exploration did not find a deterministic query-forwarding drift for `/logs`: the frontend sends `cursor`, `limit`, and `maxBytes`, and the Go BFF forwards those supported query params to `logs.tail`. The upstream Gateway `logs.tail` method is still untyped in the generated Gateway protocol because upstream lacks schema; this is an existing contract-chain exception and should remain documented rather than solved in this UI-only pass.

## Goals / Non-Goals

**Goals:**

- Produce a complete logs handoff package.
- Rewrite the production logs panel into a compact observability workbench aligned with chat/agents/routing/subagents.
- Preserve contract-backed workflows: tail load, stream subscription, cursor persistence, local filtering, export preview, clear local buffer, live event tape, and payload inspection.
- Add mock visual coverage and update design-system readiness evidence.

**Non-Goals:**

- No real Gateway/LLM log streaming E2E in this change.
- No generated Gateway protocol edits for `logs.tail`.
- No new dependencies.
- No UI that implies server-side level/source/session filtering, durable log search, log download endpoints, or structured schema guarantees beyond the current tail payload.

## Decisions

1. **Keep logs as a read-only observability panel.**
   The panel may clear local buffers and prepare export text, but it should not imply server-side log deletion or persistent export files.

2. **Use a tail-and-stream workbench.**
   The redesign will use: top status/metric strip, left filter + tail line list, right live tape + stream event/payload sidecar, and an export preview area.

3. **Treat log rows and event tape as local observability molecules.**
   Logs shares metric/header/detail patterns with previous modules but also introduces tape/code-heavy rows. Promotion decisions belong in a separate design-system proposal unless a shared API is clear.

4. **Keep stream behavior stable.**
   Cursor and last-event-id localStorage behavior, reset handling, and stream pause/resume should remain intact.

## Risks / Trade-offs

- **Risk: Logs becomes too visually dense.** -> Mitigate with a two-column workbench and compact but separated zones.
- **Risk: UI implies query filters are sent to Gateway.** -> Keep copy and implementation clear that level/source/session filters are local.
- **Risk: Mock visual coverage is mistaken for real stream proof.** -> Label E2E evidence as mock visual coverage only.
- **Risk: Raw code areas overflow.** -> Use stable dimensions, wrapping, and scroll containers.
