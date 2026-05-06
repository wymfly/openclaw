## Context

`logs` has a recent v2 handoff package and a production panel that already calls the Deck BFF through `fetchLogsTail()` and `streamLogEvents()`. The remaining risk is contract truth: Gateway `logs.tail` is still upstream-schema-missing, the Deck-facing tail response exposes `lines?: unknown[]`, and the SSE stream carries dynamic `log.batch`/`log.reset` payloads.

The active browser boundary remains unchanged. The frontend calls the Go BFF only; the Go BFF forwards tail requests to Gateway `logs.tail` and implements `/logs/stream` by polling `logs.tail` and emitting SSE frames.

## Goals / Non-Goals

**Goals:**

- Verify the full Logs contract chain from Gateway RPC to Go BFF route/stream, generated DTOs, frontend wrappers, production parser, mock fixtures, and real-stack behavior.
- Translate the v2 handoff into the production panel while keeping behavior defensively anchored to `unknown[]` log lines.
- Fix clear Logs-scoped drift directly, especially endpoint documentation mismatch and parser/UI/test gaps.
- Capture L1 mock visual evidence and bounded L2 real-stack API/UI evidence without requiring a seeded real log corpus.

**Non-Goals:**

- Add an upstream TypeBox schema for `logs.tail`.
- Add a typed `DeckGoLogLine` DTO unless implementation evidence proves the BFF already guarantees it.
- Add server-side log filters, persistent export/download endpoint, or durable log storage.
- Promote Logs-specific molecules into the shared design system during this pass.

## Decisions

- **Normalize at the panel boundary, not the contract source.** Production will parse strings and object-like log rows into a local `ParsedLogEntry` shape with optional cursor, timestamp, level, source, session key, correlation id, fields, stack, and raw payload. This keeps the UI useful while respecting `lines: unknown[]`.
- **Keep filters local.** Level, source, session, correlation id, and free-text filters narrow loaded rows only. The UI and handoff notes must not imply Gateway receives those filters until the contract adds query parameters.
- **Treat real logs as environment-dependent.** A real stack can legitimately return no lines or no immediate SSE batch. L2 tests must verify runtime readiness, BFF response shape, production rendering, and stream handshake/first frame when available, then classify empty/timeout cases with evidence after bounded attempts.
- **Use deterministic fixes directly.** If docs, wrappers, mocks, CORS, query forwarding, parser behavior, or tests contradict the verified route/contract chain without product ambiguity, the implementation fixes the source-owned layer in the same change.
- **Use handoff notes for unresolved product questions.** Typed line schema, server-side filtering, durable export, and stronger SSE payload semantics stay as recorded follow-up unless Gateway/BFF support is verified.

## Risks / Trade-offs

- **Dynamic `unknown[]` lines can vary by Gateway emitter** -> Defensive parsing keeps raw payload access visible and avoids closed assumptions.
- **Real Gateway may not have log lines during a test window** -> L2 verification accepts `real-empty-valid` or `environment-blocked` only after proving the route is reachable and response/stream behavior is understood.
- **The prototype uses a richer normalized shape than the contract** -> Production can show richer details when present but must render missing fields as unavailable or omitted.
- **SSE polling duplicates admin/server route logic** -> This pass reviews both route surfaces and adds focused coverage for deterministic failures, but deeper de-duplication is out of scope.
