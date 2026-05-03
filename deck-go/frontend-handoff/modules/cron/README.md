# Cron Jobs

**Status**: implemented-awaiting-archive
**Design completed**: 2026-05-03
**Designer**: Codex single-agent replacement workflow
**Depends on atoms**: Button, Input, Select, Toggle/Checkbox, Badge/Pill, Card, Code/Json detail, Status, Spinner
**New atoms needed**: none
**New tokens needed**: none
**Backend endpoints used**: see `api-usage.md`

## What this module does

Cron Jobs is the Automate workspace for scheduler inventory and job operations. It lets an operator inspect whether the scheduler is running, review upcoming jobs, create or edit schedule payloads, manually trigger a selected job, inspect run history, and see heartbeat availability.

This package is a high-fidelity handoff for `deck-go/frontend-new/src/components/panels/cron/`. It is based on the current deck-go contract chain and production behavior. Code and contracts remain the source of truth; this prototype is an implementation guide.

## Contract truth

- Frontend wrappers: `fetchCronJobs`, `fetchCronStatus`, `fetchCronRuns`, `createCronJob`, `updateCronJob`, `runCronJob`, and `deleteCronJob`.
- BFF endpoints: `GET /api/cron`, `GET /api/cron/status`, `GET /api/cron/{jobId}/runs`, `POST /api/cron`, `PATCH /api/cron/{jobId}`, `POST /api/cron/{jobId}/run`, and `DELETE /api/cron/{jobId}`.
- Backend source: Go BFF inventory routes -> managed runtime Gateway queries -> typed Gateway methods `cron.list`, `cron.status`, `cron.runs`, `cron.add`, `cron.update`, `cron.run`, and `cron.remove`.
- DTO authority: `DeckGoCronSchedule`, `DeckGoCronJob`, `DeckGoCronJobInput`, `DeckGoCronRunEntry`, `DeckGoCronStatus`, `DeckGoCronJobsResponse`, `DeckGoCronRunsResponse`, and related params types.
- Browser code must continue to call the Go BFF wrappers only; it must not call Gateway directly.

## How to implement

1. Open `prototype.html` and inspect the scheduler workbench layout, job catalog, create/edit form, selected job detail, run history, heartbeat tab, and last action detail.
2. Read `components.md` for module-local component structure and data boundaries.
3. Read `states.md` for loading, ready, empty, error, selected-job, run-history, heartbeat, and action states.
4. Read `interactions.md` for selection, tabs, templates, form editing, manual run, refresh, and guarded delete behavior.
5. Read `api-usage.md` and preserve the current BFF path and mutation envelopes.
6. Read `implementation-notes.md` for the production migration notes and verified mock visual coverage.

## Open questions for implementation

- The real Gateway generated cron result contains richer `state`, delivery, and usage fields than the current Deck-facing DTO consumes. This pass only normalizes known `state.nextRunAtMs` and `nextWakeAtMs` fields into the existing Deck DTO shape.
- Schedule grammar validation stays out of scope. A full recurrence builder or timezone planner needs a separate proposal.
- Mock visual coverage is available through `deck-go/test/e2e/cron-visual.spec.ts`; it is not real Gateway/LLM scheduler completeness evidence.
