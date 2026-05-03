# Cron States

## Load State

| State              | Trigger                                      | UI                                                        |
| ------------------ | -------------------------------------------- | --------------------------------------------------------- |
| Loading            | `fetchCronJobs` or `fetchCronStatus` pending | scheduler status shows loading; layout remains stable     |
| Ready with jobs    | jobs array has entries                       | job catalog, selected job, form, detail tabs, and actions |
| Ready with no jobs | jobs missing or empty                        | empty catalog note plus create form remains available     |
| Error              | any inventory/status load failure            | inline error note and refresh action                      |

## Selection State

- Default selection is the first job returned by `fetchCronJobs`.
- Preferred selection is preserved after create/update/run refresh when the job remains in the refreshed list.
- If the selected job no longer exists, fallback to the first available job.
- Selecting a row loads run history for that job.

## Form State

- Default draft uses cron schedule kind and the daily template expression.
- Template buttons set `scheduleKind: "cron"` and replace `scheduleValue`.
- Loading selected job maps job schedule and payload into `CronDraft`.
- Payload kind `agentTurn` maps payload text to `message`; `systemEvent` maps payload text to `text`.
- Agent id is omitted from create/update payload when blank.
- Enabled is a boolean toggle/checkbox.

## Action State

- Create, save, run, and delete actions disable conflicting actions while pending.
- Delete requires native confirmation.
- Successful action result is exposed as raw detail.
- Failed action writes an inline error and does not clear loaded jobs.

## Detail State

- Configuration tab shows selected job payload.
- Run History tab shows run entries sorted by the current query.
- Heartbeat tab shows read-only scheduler heartbeat and next execution evidence.
- If there is no selected job, detail shows a choose-job hint except heartbeat, which can still show scheduler status.

## Run History State

- Empty entries render `No runs yet`.
- Status values `ok`, `error`, and `skipped` render distinct status tones.
- Missing duration or date fields render `n/a`.
- Optional error/delivery fields remain available for future detail expansion but are not fabricated.
