## Context

Deck Go currently has three source surfaces for live state:

- `GET /api/stream`: the shared BFF SSE stream backed by the runtime event bus, with `Last-Event-ID` replay and `projection.gap` when retained events cannot cover the requested cursor.
- `GET /api/logs/stream`: a polling SSE wrapper over `logs.tail`, with log cursor persistence and heartbeat comments.
- `POST /api/chat/session-events`: a JSON control endpoint that subscribes or unsubscribes Gateway session projection events before the shared stream carries `session.message`, `session.tool`, or `sessions.changed`.

Frontend consumers subscribe to these surfaces directly from chat, agents, activity, approvals, settings, command discovery, and logs. Each consumer currently decides retry status, stale state, cursor persistence, and refresh behavior locally, so the control UI has no single product contract explaining which Gateway/BFF truth drives each live projection.

## Goals / Non-Goals

**Goals:**

- Make live projection behavior explicit in a source contract that links panels, stream endpoints, events, refresh endpoints, stale thresholds, and gap recovery.
- Generate docs and frontend-readable metadata from that source so frontend work can use the same contract chain as backend/API work.
- Add shared frontend subscription helpers that preserve existing behavior while standardizing status, stale-state, cursor persistence, and projection-gap callbacks.
- Keep real Gateway verification bounded: prove current BFF SSE replay/gap behavior and contract generation; leave module-specific live E2E to later module completion proposals.

**Non-Goals:**

- Do not add new Gateway RPCs, Gateway event types, or upstream protocol requirements.
- Do not replace `/api/stream` with a new transport.
- Do not redesign chat streaming dispatchers in this proposal; chat may keep its specialized dispatcher while following the same contract semantics.
- Do not implement durable audit/history or list-query semantics here; those are separate matrix children.

## Decisions

1. **Use a Deck-owned contract source for product live projections.**

   The Gateway provides raw event and RPC capability, but the UI needs a product-level mapping from events to panel refresh behavior. A Deck-owned JSON contract is appropriate because it is an adaptation layer, not a copy of Gateway schemas. The generator validates that referenced stream endpoints/events and refresh endpoints are known by existing Deck contract sources.

   Rejected alternative: encode this only in `deck-streams.contract.json`. That file describes event payloads, but it cannot naturally express panel ownership, stale thresholds, or refresh endpoints.

2. **Generate both docs and TypeScript metadata.**

   Docs make the contract understandable during future product design. Generated TypeScript lets frontend code consume the same truth without hand-copying ids, stale thresholds, localStorage cursor keys, or gap policies.

3. **Standardize shared stream mechanics without forcing every panel through one UI component.**

   A hook-level helper is enough for this proposal: panels can keep their rendering and domain-specific event parsing while sharing status transitions, retry stale timers, Last-Event-ID persistence, and `projection.gap` handling.

4. **Treat projection gaps as recoverable stale state.**

   When `projection.gap` is observed, the subscriber marks the projection stale and invokes its configured refresh callback. This preserves operator visibility and lets the next list/snapshot endpoint recover from missed events.

## Risks / Trade-offs

- **Risk:** The live projection contract may list an event that the backend never emits in the current runtime mode.  
  **Mitigation:** The contract distinguishes source support from panel behavior and validates only known stream event names; real module E2E remains with the module completion proposals.

- **Risk:** Refactoring all existing consumers at once could destabilize chat streaming.  
  **Mitigation:** Chat keeps its specialized dispatcher and only consumes the shared contract metadata where low-risk; generic panels use the shared helper first.

- **Risk:** Stale timers can create noisy UI if a quiet stream has no events.  
  **Mitigation:** Stale state is based on connection/retry/gap/error state, not on event frequency. Heartbeats still keep the transport connected.

- **Risk:** The contract adds another generated artifact to keep in sync.  
  **Mitigation:** Add `make live-projection-contract-check` to `contract-gate` so drift is caught with the existing contract chain checks.
