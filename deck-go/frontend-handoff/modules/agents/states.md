# agents - states

## List states

- `idle`: store has not requested agents yet.
- `loading`: skeleton/list placeholder is visible.
- `ready`: rows render from `DeckGoAgentsListResponse.agents`.
- `empty`: no agents returned; show create affordance.
- `filtered-empty`: agents exist but search/filter hides all rows; show clear-search affordance.
- `error`: list request failed; show retry and exact error text.

## Selection states

- `none`: workbench shows list only or no selected detail.
- `selected`: detail card renders for `selectedAgentId`.
- `requested-missing`: URL contains an agent id not in the current list; keep selection pending until refresh or show a not-found detail error.

## Detail states

- `detail-loading`: show compact loading banner without clearing selected summary.
- `detail-ready`: detail metadata and all sections can be reached.
- `detail-error`: show retry for the selected agent.

## Editable section states

Each editable section tracks:

- `clean`: loaded, no local edits.
- `dirty`: local edits differ from loaded contract data.
- `saving`: section save is in flight.
- `conflict`: backend returns stale hash/conflict; keep local edits visible.
- `error`: non-conflict save error; keep local edits visible.

Sections with dirty state:

- overview
- skills
- subagents
- event streams
- files

Read-only sections:

- tool policy preview
- system prompt preview

## Create flow states

The create flow submits only backend-supported fields:

- `name`
- `workspace`
- `emoji`
- `avatar`

Model, skills, subagents, and streams are presented as after-create configuration, not as initial POST payload.

States:

- `closed`
- `identity`
- `runtime-note`
- `review`
- `submitting`
- `error`
- `created`

## Delete states

- `closed`
- `confirming`
- `deleting`
- `error`
- `deleted`

Deletion must update the shared agents store and select a valid fallback or return to list.

## Realtime states

The panel consumes declared stream contracts:

- `agent.status.changed`
- `activity.event`

Unknown activity payloads are ignored. The UI does not require a future `eventType` discriminator.

## Prototype state controls

`prototype.html` exposes ready, empty, error, and create states through toolbar controls. These are review conveniences and not production controls.
