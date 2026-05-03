## Context

`frontend-new` already contains a functional `CronPanel` under the `cron` panel id. It calls Deck-facing wrappers for scheduler inventory and actions:

- `fetchCronJobs({ includeDisabled: true })` -> `GET /api/cron`
- `fetchCronStatus()` -> `GET /api/cron/status`
- `fetchCronRuns(jobId, { limit: 20, sortDir: "desc" })` -> `GET /api/cron/{jobId}/runs`
- `createCronJob`, `updateCronJob`, `runCronJob`, `deleteCronJob` -> BFF mutation routes under `/api/cron`

The Go BFF maps those routes to typed Gateway methods `cron.list`, `cron.status`, `cron.runs`, `cron.add`, `cron.update`, `cron.run`, and `cron.remove`. Deck-facing DTO authority is `DeckGoCronSchedule`, `DeckGoCronJob`, `DeckGoCronJobInput`, `DeckGoCronRunEntry`, `DeckGoCronStatus`, `DeckGoCronJobsResponse`, `DeckGoCronRunsResponse`, and related params types.

The current panel already covers inventory, selected job detail, create/update/run/delete, template shortcuts, run history, heartbeat status, and guarded delete confirmation. The main gaps are visual convergence and mock-verification quality: it uses global `deck-ui-cron*` CSS in `theme.css`, and the bundled mock Gateway has no `cron.*` handlers, so visual E2E cannot exercise the normal frontend API path.

## Goals / Non-Goals

**Goals:**

- Produce a complete Cron handoff package.
- Rewrite Cron into a high-fidelity scheduler workbench aligned with the current design-system posture.
- Preserve load/error handling, selection fallback, create/update/run/delete behavior, guarded delete confirmation, template application, run-history tab, heartbeat tab, last-action raw evidence, and current BFF wrapper usage.
- Add contract-shaped `cron.*` mock Gateway support needed for visual E2E.
- Add focused mock visual coverage for ready and interaction states.
- Record Cron-specific design-system feedback without silently promoting atoms or patterns.

**Non-Goals:**

- No new Gateway method or BFF route.
- No browser-side direct Gateway RPC.
- No real scheduler policy redesign, cron parser, timezone editor, recurrence builder, or validation library.
- No new dependencies, table libraries, date libraries, or chart libraries.
- No canonical design-system atom/pattern promotion inside this module change.
- No guarantee that real Gateway cron payload internals are fully normalized beyond the current Deck-facing DTO shape.

## Decisions

1. **Treat Cron as an operations scheduler workbench, not a recurrence-builder product.**
   The panel should expose live job inventory, selected configuration, run evidence, and existing action controls. A full schedule grammar editor or timezone planner would expand product scope and belongs in a separate proposal.

2. **Preserve the BFF wrapper boundary and existing mutation envelopes.**
   The frontend already respects the browser/backend boundary. The rewrite should keep the same wrapper calls and not introduce direct `cron.*` RPC from browser code.

3. **Use module-local scheduler molecules.**
   Scheduler status tiles, job rows, form sections, selected job hero, run rows, heartbeat status, and raw action detail overlap with prior workbench patterns, but Cron adds scheduler-specific semantics. Promotion to design-system patterns waits for a separate proposal.

4. **Fix deterministic mock cron drift.**
   The mock Gateway should implement `cron.list`, `cron.status`, `cron.runs`, `cron.add`, `cron.update`, `cron.run`, and `cron.remove` with stable contract-shaped payloads. The frontend API wrapper may normalize generated Gateway fields already present in the BFF payload, such as `job.state.nextRunAtMs` and `status.nextWakeAtMs`, into the current Deck-facing DTO shape. This is fixture/wrapper correction, not a new Gateway method or browser-side Gateway access.

5. **Keep raw payload evidence visible but not dominant.**
   Selected job payload and last action details stay available through `JsonDetails`, while the primary viewport prioritizes human-scannable schedule, status, next run, and run history evidence.

## Risks / Trade-offs

- **Risk: Visual rewrite regresses create/update/run/delete behavior.** -> Keep focused unit tests for load/select/template/create/update/run/delete/confirm behavior and add visual E2E for ready plus interaction states.
- **Risk: Mock cron data diverges from real Gateway.** -> Shape fixtures from Deck DTOs and generated Gateway typed result fields, and label visual evidence as mock-only.
- **Risk: The form remains dense.** -> Use stable two-column responsive constraints, compact field clusters, and action grouping; do not add a large recurrence-builder layer.
- **Risk: Global CSS cleanup affects adjacent Automate panels.** -> Remove only `deck-ui-cron*` styling from `theme.css`; leave `webhooks`, `approvals`, and shared group rules intact until their own module passes.
