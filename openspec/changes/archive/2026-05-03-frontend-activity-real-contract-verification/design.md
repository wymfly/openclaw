## Context

Activity is a Deck-local projection surface, not a direct Gateway RPC workbench. The current production panel consumes BFF endpoints for activity and monitor projections plus the shared SSE stream. The high-fidelity pass already built the visual workspace and mock visual E2E, but the current rollout standard requires real-stack verification and code-level review.

This module has a different real-verification shape from Skills: there are no real mutations, but real Gateway state may be empty. Success therefore means the BFF routes, stream contract, frontend wrappers, and production UI handle real empty or populated projections correctly without pretending that mock monitor rows prove live LLM telemetry.

## Goals / Non-Goals

**Goals:**

- Audit Activity contract truth across Deck DTOs, endpoint classification, SSE contract metadata, Go BFF routes/projections, frontend wrappers, and production panel code.
- Compare the refreshed handoff prototype with real contract and code evidence; keep prototype-only assumptions documented.
- Fix deterministic Activity-scoped defects found during exploration or real verification.
- Verify safe real-stack reads for `/activity`, `/monitor/runs`, `/monitor/runs/{runId}` when a run exists, `/monitor/stats`, and production UI render/interaction.
- Keep L1 mock visual evidence separate from L2 real-stack evidence.
- Record a reusable matrix and handoff notes for later cross-module audit.

**Non-Goals:**

- Do not generate a real LLM run solely to seed Activity.
- Do not fabricate events in the real stack or mutate production event stores.
- Do not build a new persistent monitor store or analytics engine.
- Do not add broader design-system atoms during this pass.

## Decisions

### D1: Empty real Activity is valid if honest

Real stack verification may return empty activity and monitor runs. The test should assert shape, empty-state rendering, and no unexpected errors. Mock visual tests remain the place to prove dense diagnostics layout.

### D2: Clear drift is fixed, disputed telemetry is recorded

If exploration finds a scoped mismatch such as DTO shape, route status, query normalization, stream payload narrowing, or UI wrapper behavior, this change fixes it directly. If the mismatch requires real LLM/provider activity, a new event persistence model, or product telemetry semantics, it is recorded as handoff.

### D3: Contract chain stays BFF-first

Browser code must use `frontend-new/src/api.ts` and stream helpers. Activity panel components must not call Gateway, event bus, local storage, or backend internals directly.

## Risks / Trade-offs

- **Real stack can be empty** -> Verify shape and empty UI instead of requiring mock rows.
- **SSE payloads are open envelopes** -> Narrow required fields but keep raw details inspectable.
- **Monitor diagnostics are best-effort** -> Parse known object-shaped event data, preserve raw event data, and avoid claiming a full schema for stream-specific payloads.
- **Activity overlaps Gateway panel** -> Keep Activity module assertions scoped to its panel and wrapper behavior, not Gateway dashboard composition.

## Migration Plan

1. Baseline handoff, archived hifi change, production Activity code, wrappers, DTOs, routes/projections, and tests.
2. Build the Activity contract-chain matrix and classify supported/degraded/unsupported scenarios.
3. Fix deterministic drift with focused tests before widening.
4. Run focused frontend/backend tests and the Activity mock visual E2E.
5. Add or update Activity L2 real-stack API/UI E2E for safe reads and honest empty/populated render.
6. Update handoff notes, OpenSpec verification evidence, and archive once archive-ready.
