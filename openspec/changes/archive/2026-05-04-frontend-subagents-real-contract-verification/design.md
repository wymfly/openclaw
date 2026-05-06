## Context

Subagents already has production code under `deck-go/frontend-new/src/components/panels/subagents/`, frontend wrappers in `src/api.ts`, Go BFF action routes under `/api/deck/subagents` and `/api/deck/agents`, and generated Gateway coverage for `deck.subagents.*` plus `deck.agents.subagents.*`. The refreshed v2 handoff expands the module into a focused runs/permissions workbench with search, status and spawn-mode filters, KPI strip, selected-run detail tabs, lineage, steer/kill dialogs, per-agent permission editing, and raw/outcome inspection.

The evidence gap is not only visual fidelity. Subagents can terminate live child sessions, inject steering instructions, and modify per-agent subagent allow-lists, so production behavior must be checked against the real contract chain. The handoff currently contains stale route and status assumptions: production uses BFF action routes, and Gateway list filters currently accept `active | completed | failed | timeout | all`, not the prototype-only `running | succeeded | killed | stalled` set.

## Goals / Non-Goals

**Goals:**

- Align production Subagents with the v2 handoff where backed by current Gateway/BFF contracts.
- Verify the contract chain from Gateway schemas/methods through Go BFF routes, Deck DTOs, frontend wrappers, UI behavior, mock data, and real-stack safe reads.
- Fix deterministic route, status, action-envelope, hash, documentation, i18n, test, mock, or UI metadata drift found during implementation.
- Add L1 mock visual evidence and bounded L2 real-stack evidence with circuit-breaker behavior.
- Record unsupported or ambiguous Gateway/product claims as handoff risks rather than implementing speculative behavior.

**Non-Goals:**

- Do not add new REST routes for `/api/deck/subagents/<runId>/kill`, `/api/deck/subagents/<runId>/steer`, `/api/deck/subagents/<runId>/audit`, or `/api/deck/agents/<agentId>/subagent-config`.
- Do not change Gateway status schemas to match prototype names unless Gateway code truth changes first.
- Do not add audit pagination, kill-cascade guarantees, client-authored steer dedup keys, or stalled-state detection as product commitments in this change.
- Do not introduce new frontend dependencies or promote module-local Subagents molecules into the design system in this change.

## Decisions

1. **Treat Gateway/BFF code truth as the route authority.**
   - The implementation uses `contracts/source/deck-api.contract.ts`, endpoint classification, generated Gateway protocol types, Go BFF routes, and upstream Gateway source/tests as truth.
   - Handoff docs are corrected when they conflict with code truth, for example REST-style per-run routes versus `/api/deck/subagents` action envelopes.
   - Alternative rejected: treat the prototype route table as authoritative. That would fabricate API paths and bypass existing contract governance.

2. **Map the v2 visual model onto current status values.**
   - Production can render a v2-like runs workbench while using `active`, `completed`, `failed`, `timeout`, and open string fallback statuses from the contract.
   - Prototype-only `running`, `succeeded`, `killed`, and `stalled` remain documented as visual assumptions unless Gateway schemas adopt them.
   - Alternative rejected: widen filters in the frontend only. The Gateway validator rejects unsupported status values.

3. **Keep real-stack tests safe-read first.**
   - L2 verifies list, lineage when data exists, agent subagent-config reads, UI render, action route boundaries, and BFF-only browser access.
   - Real kill/steer and permission writes are covered by static envelope review, focused Go/TS tests, and L1 mock E2E unless a disposable live run/config fixture exists.
   - Alternative rejected: force real kill/steer/write actions. Real subagent runs and operator config may be sensitive.

4. **Use bounded circuit breaker for real Gateway variation.**
   - A real scenario gets at most three fresh attempts before being classified as degraded, empty-valid, skipped-safe, or handoff-blocked with evidence.
   - Static code review, focused tests, L1 mock visual E2E, OpenSpec validation, and build remain mandatory.

5. **Implement only contract-backed v2 surface.**
   - Search/filter, runs/permissions modes, selected detail tabs, lineage, outcome/raw views, steer/kill dialogs, permission editing, and action evidence are acceptable when they consume existing DTOs/wrappers.
   - Audit, stalled inference, kill cascade, and client dedup behavior must remain absent, degraded, or documented unless backed by current contracts.

## Risks / Trade-offs

- Real Gateway has no subagent runs during L2 -> classify run-list and lineage behavior as empty-valid while proving route shape, UI empty state, and BFF boundary.
- Kill/steer are sensitive live-session mutations -> verify envelopes via focused tests and mock E2E; skip real mutation unless a disposable fixture exists.
- Per-agent permissions mutate `openclaw.json` -> verify `baseHash` handling through focused tests and mock data; skip real write unless reversible fixture evidence exists.
- Prototype includes richer audit/stalled/killed states than Gateway schemas expose -> preserve visual intent only where code truth supports it; document the rest.
- Existing worktree is already broad and dirty from the module loop -> keep this change scoped to Subagents artifacts, ignore unrelated dirty files, and use `git diff --check` plus focused tests for evidence.
