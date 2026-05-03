# subagents states

## Ready

- Runs list loads from `DeckGoSubagentsListResponse`.
- The first available run is selected if the prior selected run is missing.
- Lineage loads for the selected run.
- Header and metrics show ready status, visible count, server total, active
  count, history count, and selected depth/model.
- Action result and config result areas are hidden until a mutation completes.

## Loading

- Header badge switches to loading.
- Refresh and mutation buttons can show loading copy or disabled state.
- Existing selected run remains visible until the new request succeeds.

## Empty

- Run queue shows an empty message when no run matches the current filters.
- Selected-run detail shows a choose-run message.
- Lineage area shows a select-run message.
- Empty state does not fabricate example runs.

## Error

- Error text appears in a banner near the workbench header.
- Prior successful data can remain visible if present.
- Retry uses the same refresh action and does not reset filters.

## Active Run

- Steering is enabled only when the instruction has non-empty trimmed content.
- Kill is enabled only for `status === "active"`.
- Kill must remain confirmation-gated.

## Historical Run

- Steering remains available only if backend supports the action for the run.
  Current production keeps the same wrapper but disables kill for non-active
  statuses.
- Historical fields show ended time and outcome payload when available.

## Config

- Config mode keeps the active-run workflow reachable through the segmented
  control.
- Global defaults are loaded from config get.
- Save uses current hash/base hash and renders the returned apply result.
- Per-agent permission rows render after `agents.list` and
  `deck.agents.subagents.get` data are available.
