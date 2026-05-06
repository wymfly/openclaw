## Context

The current repo has only `backend/internal/platform/audit/doc.go`. No deck-go route, DTO, or store records control-side mutations. The config-write-safety proposal explicitly deferred audit/history to this P1 platform-control proposal. Gateway truth remains the source for upstream capabilities, but audit/history is deck-go product-level control behavior built around the existing BFF.

## Goals / Non-Goals

**Goals:**

- Record authenticated `/api` mutation requests in a bounded in-memory audit log.
- Expose recent audit entries via a typed Deck-facing BFF route.
- Keep retention rules explicit in the response.
- Add contract governance so the route, DTOs, generated artifacts, and facade do not drift.
- Verify that non-mutating reads do not create audit records and that old records are evicted by retention.

**Non-Goals:**

- Do not add a new Gateway RPC or upstream protocol method.
- Do not persist audit entries to disk in this proposal.
- Do not compute deep before/after diffs for every resource type.
- Do not add frontend UI panels; module/UI proposals can consume the facade later.
- Do not audit unauthenticated rejected requests before the access middleware.

## Decisions

### Decision: In-process bounded audit log first

The first contract uses an in-memory ring buffer with a fixed max-entry retention rule. This gives the control plane a real audit/history contract without introducing storage migration, encryption, or retention-policy UX before the product shape is proven.

Alternative rejected: durable disk persistence in this proposal. It is valuable, but it requires retention/deletion policy, storage location, migration, and sensitive-data review.

### Decision: Generic mutation middleware

Audit recording SHALL live as middleware under `/api` after authentication. It records `POST`, `PUT`, `PATCH`, and `DELETE` requests after the handler completes. This captures current and future BFF mutations without requiring every handler to remember an audit call.

### Decision: Minimal summaries

Entries SHALL include method/path/action/target/result and request metadata. Field-level before/after summaries are omitted for now because different modules need different redaction and diff semantics. The contract leaves `summary` optional.

### Decision: Read route is Deck-owned

`GET /api/audit/events` is a Deck BFF route with Deck API DTO authority. It is not a Gateway protocol adapter. The frontend facade can consume it later without direct Gateway calls.

## Risks / Trade-offs

- In-memory retention loses entries on restart -> response advertises `mode: process-memory` and max entries.
- Generic path-based target is coarse -> sufficient for first history view; module proposals can add richer request IDs/summaries.
- Middleware can accidentally record sensitive request bodies -> it does not record bodies.
- Route governance expands -> add endpoint classification and route governance rows with focused backend evidence.

## Migration Plan

1. Implement bounded audit log package and middleware.
2. Register middleware and `GET /api/audit/events`.
3. Add Deck-facing DTOs and regenerate TS/Go artifacts.
4. Add frontend facade and governance metadata.
5. Run backend tests, contract checks, OpenSpec validation, and matrix sync.

Rollback removes the middleware, route, DTOs, and governance rows. No production data migration is needed.

## Open Questions

- Durable storage, actor identity beyond local operator, field-level before/after diffs, and UI presentation remain future proposals after this contract is proven.
