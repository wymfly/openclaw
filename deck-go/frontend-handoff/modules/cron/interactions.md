# Cron Interactions

## Keyboard And Focus

- Job rows are buttons and must stay reachable by keyboard.
- Detail tabs are buttons in a tab-like strip; focus should remain visible.
- Template buttons must be reachable before the schedule fields.
- Native form controls keep browser focus behavior.
- Delete confirmation remains native `window.confirm` in this pass.

## Job Selection

- Clicking a job row selects it and loads its run history.
- Selected state must be visible without relying only on color.
- Selecting a different job must not mutate the draft until the operator clicks `Load selected`.

## Form Editing

- Template buttons update schedule kind/value only.
- Payload type switching can change the session target default as current code does.
- `Create Job` submits the current draft through `createCronJob`.
- `Load selected` maps selected job into the draft.
- `Save selected` submits the current draft through `updateCronJob(selectedJob.id, input)`.

## Actions

- `Refresh cron` reloads inventory/status and keeps preferred selection when possible.
- `Run Now` calls `runCronJob(selectedJob.id, { mode: "force" })`.
- `Delete Job` prompts for confirmation before `deleteCronJob`.
- Last action detail becomes visible after successful create/update/run/delete.

## Detail Tabs

- Configuration shows selected job raw payload detail.
- Run History shows selected job run entries.
- Heartbeat shows scheduler status and next execution evidence.
- Tab changes do not reset selected job or form draft.

## Error And Empty Recovery

- Load and action errors render inline and preserve existing data when possible.
- Empty jobs still expose the job form and create action.
- Mock visual states must be labeled as mock coverage rather than real Gateway/LLM evidence.
