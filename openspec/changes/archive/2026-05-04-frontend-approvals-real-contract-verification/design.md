## Context

Approvals already has a production panel under `deck-go/frontend-new/src/components/panels/approvals/`, frontend wrappers in `src/api.ts`, Go BFF routes under `/api/approvals*`, and Gateway method coverage for typed policy/resolve calls plus documented untyped list calls. The refreshed v2 handoff expands the security-operations layout with a queue/detail workbench, countdowns, policy modal, decision bar, recent-decision strip, and summary KPIs.

The current evidence gap is not just visual fidelity. Approvals mutates real Gateway decision state and policy files, so the module must be verified as a contract-backed control surface. Real Gateway verification can be environment-dependent because pending approvals may be empty and unsafe to manufacture during a module pass.

## Goals / Non-Goals

**Goals:**

- Align production Approvals with the v2 handoff where backed by current contracts.
- Verify the contract chain from Gateway methods through Go BFF routes, Deck DTOs, frontend wrappers, UI behavior, mock data, and real-stack safe reads.
- Fix deterministic route, decision-envelope, documentation, i18n, test, mock, or UI metadata drift found during implementation.
- Add L1 mock visual evidence and bounded L2 real-stack evidence with circuit-breaker behavior.
- Record unsupported or ambiguous Gateway/product claims as handoff risks rather than implementing speculative behavior.

**Non-Goals:**

- Do not add bulk approval endpoints, typed audit pagination, typed summary KPI RPCs, or new approval-list Gateway result schemas.
- Do not generate real pending approvals through unsafe command execution just to satisfy L2 tests.
- Do not mutate a real approval policy during L2 unless the test has a deterministic, reversible fixture.
- Do not promote module-local decision, countdown, or policy editor molecules into the design system in this change.

## Decisions

1. **Treat code truth as contract authority.**
   - The implementation uses `contracts/source/deck-api.contract.ts`, endpoint classification, Go BFF routes, generated Gateway types, and upstream Gateway source/tests as truth.
   - Handoff docs are corrected when they conflict with code truth, for example `/api/stream` versus stale `/api/events/stream` wording or hyphenated decision values.
   - Alternative rejected: treat the prototype as authoritative for routes and payloads. That would risk fabricating control-plane behavior.

2. **Keep real-stack tests safe-read first.**
   - L2 verifies policy/pending/plugin read paths, UI render, stream/BFF boundary, and degraded/empty-valid handling.
   - Real decision and policy mutation are reviewed statically and covered through Go route tests plus L1 mock E2E unless a safe disposable fixture exists.
   - Alternative rejected: force real approve/deny actions. Real queues may contain operator-sensitive requests.

3. **Use bounded circuit breaker for real Gateway variation.**
   - A scenario gets at most three fresh attempts before being classified as degraded, empty-valid, skipped-safe, or handoff-blocked with evidence.
   - Static code review, focused tests, L1 mock visual E2E, OpenSpec validation, and build remain mandatory.

4. **Implement only contract-backed v2 surface.**
   - Search/filter, queue/detail layout, decision bar, reason input, policy editor affordance, countdown display, and action evidence are acceptable when they consume existing DTOs/wrappers.
   - Recent-decision strips and summary KPIs must be local projection/degraded unless backed by current activity/audit data.

## Risks / Trade-offs

- Real Gateway has no pending approvals during L2 → classify as empty-valid and prove read/UI/BFF boundary instead.
- Real approval-list methods remain untyped → keep explicit exceptions and BFF normalization review rather than pretending closed schemas exist.
- Prototype includes richer summary/audit states than contracts expose → preserve visual intent only where code truth supports it; document the rest.
- Policy mutation is sensitive → verify envelopes via focused tests and mock E2E; skip real mutation unless reversible fixture evidence exists.
- Countdown timers are client-computed from `expiresAtMs` → label as local evidence, not server-authoritative timing.
