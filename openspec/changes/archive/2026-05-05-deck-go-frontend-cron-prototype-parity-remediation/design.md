## Context

Cron is Deck's scheduled-job control surface. The current contract chain is:

`CronPanel` -> `frontend-new/src/api.ts` wrappers -> Deck BFF routes:

- `GET /api/cron`
- `GET /api/cron/status`
- `GET /api/cron/runs`
- `POST /api/cron`
- `PATCH /api/cron/{id}`
- `POST /api/cron/{id}/run`
- `DELETE /api/cron/{id}`

Those routes adapt Gateway Cron methods:

- `cron.list`
- `cron.status`
- `cron.runs`
- `cron.add`
- `cron.update`
- `cron.run`
- `cron.remove`

Deck-facing DTO authority lives in
`contracts/source/deck-api.contract.ts`, while browser endpoint and mutation
policy are governed by
`contracts/source/deck-endpoints.contract.json`,
`contracts/source/deck-list-queries.contract.json`,
`contracts/source/deck-api-dynamic-surfaces.contract.json`, and
`contracts/source/deck-mutations.contract.json`.

The active visual target is
`frontend-handoff/modules/cron/prototype.html`. Current production already has
a scheduler status strip, job inventory, selected-job detail tabs, create/edit
dialog, run-now, enable/disable, delete confirmation, and history/scheduler
subviews. Existing evidence is still mock-functional only, and the real E2E is
read-heavy. This child proposal must close the gap with strict mock parity and
bounded real Gateway fixture evidence.

## Goals / Non-Goals

**Goals:**

- Confirm the active Cron prototype and reconcile it with current Gateway and
  Deck contract truth.
- Audit production Cron code, handoff files, mock fixtures, and real E2E
  against the strengthened head remediation standard.
- Fix deterministic visual, interaction, i18n, DTO, route-wrapper, fixture,
  or cleanup drift when supported by code truth.
- Preserve BFF-only browser access for Cron data and mutations.
- Exercise representative real Cron data by creating a run-scoped disposable
  job through Deck BFF/Gateway when the real stack accepts a safe disabled or
  far-future schedule.
- Cleanup only run-scoped jobs created by this test run.
- Keep `cron.run` skipped-safe unless a disposable run-now path is proven
  harmless in the real stack.
- Upgrade mock visual E2E and real Gateway E2E to cover shell navigation, all
  four theme/locale variants, meaningful safe tabs/dialogs, route-shape
  evidence, BFF-only transport, unexpected error checks, and fixture evidence.
- Update Cron implementation notes, the remediation matrix, and head task
  `6.4`.

**Non-Goals:**

- Do not replace the existing Cron implementation wholesale with prototype
  files.
- Do not invent Cron recurrence, preview, audit, notification, or bulk-action
  contracts that Gateway and Deck BFF do not expose.
- Do not mark scheduler mutations fixture-safe unless the test proves
  run-scoped create/update/delete cleanup through the real product chain.
- Do not execute user-owned jobs or delete non-run-scoped jobs.
- Do not require a real scheduled execution to fire as an archive blocker.

## Decisions

### D1: Code and contracts win over prototype-only projections

The prototype is the visual and interaction reference, but current generated
Deck DTOs, BFF routes, Gateway methods, and production code win when the
prototype contains static or speculative projections.

Alternative considered: make the static prototype the only authority. Rejected
because Cron is mutation-heavy and unsafe to validate from visuals alone.

### D2: Real fixture data uses a disabled or far-future run-scoped job

Cron real E2E should attempt to create a disposable job whose name,
description, payload, or id contains the current run id, then patch and delete
only that job. The preferred safe shape is disabled or scheduled far enough in
the future that it cannot execute during the test.

Alternative considered: rely on existing real jobs and empty-state screenshots.
Rejected because the strengthened standard requires representative run-scoped
data before accepting empty-state-only evidence.

### D3: Run-now remains skipped-safe unless proven harmless

`cron.run` may trigger product actions and therefore must remain skipped-safe
unless the test creates a disposable job and proves that invoking it cannot
touch user-owned sessions, agents, external channels, or long-running model
work.

Alternative considered: always click Run Now in real E2E. Rejected because the
operation is side-effectful and not needed to prove list/create/update/delete
contract readiness.

### D4: Browser transport remains BFF-only

Cron browser code may call relative `/api/cron*` Deck routes through the
frontend API facade, but it must not call the Gateway port or websocket
directly. Real E2E records direct browser Gateway HTTP or websocket attempts as
failures.

Alternative considered: validate Gateway directly from the page. Rejected
because Deck's contract chain intentionally keeps Gateway behind the Go BFF.

### D5: Unsupported scheduler projections stay honest

If next-fire preview, durable run logs, queue depth, retry policy, audit feed,
notification binding, or bulk operations are not exposed by current contracts,
the UI may show only contract-backed or local derived state and the notes must
record the exception.

Alternative considered: add local fake projections to satisfy the prototype.
Rejected because it would make the control surface look more capable than the
Gateway-backed product.

## Risks / Trade-offs

- **Risk: Cron fixture creation mutates real user config.** -> Use a unique
  run id, disabled/far-future schedule, and cleanup guards that refuse
  non-run-id targets.
- **Risk: cleanup fails.** -> Record exact route evidence, leave a handoff that
  includes the run id and job id, and do not mark fixture safety as proven.
- **Risk: real Gateway rejects the safe schedule shape.** -> Fix deterministic
  DTO/input mismatches if obvious; otherwise circuit-break with route evidence
  and keep mutations skipped-safe.
- **Risk: prototype and production intentionally differ.** -> Record accepted
  exceptions tied to contract truth.
- **Risk: run-now is tempting to validate but unsafe.** -> Validate the control
  affordance in mock; use real read/create/update/delete evidence unless a
  harmless disposable run is proven.

## Migration Plan

1. Audit prototype files, production Cron code, contract sources, BFF routes,
   mock Gateway support, visual spec, real E2E, and mutation-evidence policy.
2. Patch deterministic Cron UI, i18n, API facade, fixture, or cleanup drift.
3. Upgrade mock visual E2E to capture prototype-shaped list/detail states,
   tabs, builder, edit, delete confirmation, run-now, scheduler status, and all
   required localized theme variants.
4. Upgrade real Gateway E2E to create/update/delete a run-scoped disposable job
   when safe, verify route shapes and UI variants through Deck shell
   navigation, and record BFF-only/unexpected-error evidence.
5. Update mutation-evidence contracts only if real fixture create/update/delete
   cleanup is proven.
6. Update implementation notes and the head matrix, validate, then archive this
   child proposal.

## Open Questions

- Whether `cron.run` can become fixture-safe later via an inert job type or
  no-op Gateway execution target.
- Whether Cron should add first-class preview/audit/retry/notification
  contracts after all module parity remediation completes.
- Whether run history should be seeded by a safe Gateway fixture or remain
  mock-only until upstream provides a harmless execution lane.
