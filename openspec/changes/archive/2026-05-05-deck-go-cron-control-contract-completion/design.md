## Context

Cron is Gateway-backed through `cron.list`, `cron.status`, `cron.add`,
`cron.update`, `cron.remove`, `cron.run`, and `cron.runs`. Deck Go exposes those
methods through `/api/cron*` BFF routes and renders a control-plane workbench in
`frontend-new`. Current read-path evidence is sufficient, but write and run
actions are not action-evidence known, and the Gateway `cron.run` schema is
narrower than the existing handler behavior.

Current source truth:

- Cron list/runs are covered by shared list-query metadata.
- Cron payload and delivery fields remain intentionally dynamic because delivery
  modes are not fully productized.
- Cron add/update/remove mutate scheduler state; cron run can trigger operator
  workload. Real automation must stay deferred or skipped-safe without
  disposable scheduler fixtures.
- `cron.run` catches invalid session target errors and returns `{ ok: true,
ran: false, reason: "invalid-spec" }`.

## Goals / Non-Goals

**Goals:**

- Add action-level mutation evidence for Cron create/update/delete/run.
- Type Cron delete and run response DTOs at the Deck-facing boundary.
- Route frontend Cron write/run facades through mutation evidence helpers.
- Fix `cron.run` result schema to include the existing `invalid-spec` reason.
- Preserve dynamic payload/delivery surfaces as intentional documented limits.
- Update durable notes, matrix rows, generated matrix Markdown, and head
  verification evidence.

**Non-Goals:**

- Do not run real scheduler mutations against the operator environment.
- Do not add cron expression preview/validation dependency.
- Do not add bulk operations, live run-history streams, optimistic concurrency,
  global analytics, delivery-kind DTOs, or cleanup fixtures.
- Do not add new Gateway cron methods.

## Decisions

### Decision: Action-level evidence, fixture safety still conservative

Cron write buttons are real product actions, so they should not stay hidden
under a broad deferred class. Each visible action gets mutation evidence, but
create/update/delete stay deferred and manual run stays skipped-safe until real
fixtures can prove cleanup and workload safety.

Alternative rejected: declare create/delete fixture-safe by naming run-scoped
jobs. Cleanup semantics vary by runtime and are not yet proven for scheduler
state, so that would overstate real E2E safety.

### Decision: Fix Gateway schema to match existing handler behavior

The handler already returns `invalid-spec`; codegen should advertise it. This is
a schema-truth fix, not a product expansion.

Alternative rejected: change the handler to fit the narrower schema. The
existing value is useful because it distinguishes invalid job spec from
not-due/already-running.

### Decision: Keep payload and delivery dynamic

Cron payloads and delivery results depend on action kind and downstream
delivery path. They remain documented dynamic surfaces until delivery-kind DTOs
are productized.

## Risks / Trade-offs

- **Risk:** Mutation evidence may be mistaken for real write safety.  
  **Mitigation:** Fixture statuses remain deferred/skipped-safe and matrix gaps
  explicitly state real scheduler mutation fixtures are not proven.
- **Risk:** Cron DTOs still carry dynamic payload/delivery fields.  
  **Mitigation:** Dynamic-surface docs keep those leaves intentional and scoped
  to Cron delivery/payload evolution.

## Migration Plan

1. Add Cron delete/run DTOs and Cron mutation evidence source entries.
2. Fix `cron.run` schema reason union and regenerate Gateway protocol artifacts.
3. Regenerate Deck API and mutation evidence artifacts.
4. Route Cron frontend write/run facades through mutation evidence helpers and
   update focused tests.
5. Update Cron notes, matrix rows, generated matrix Markdown, and head evidence.
6. Run focused contract, protocol, backend, frontend, build, OpenSpec, and diff
   checks; then archive this child proposal.
