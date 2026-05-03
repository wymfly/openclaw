# subagents interactions

## Filters

- Changing status, child-agent, requester-agent, or time range triggers a
  refresh through `fetchSubagentRuns`.
- Status defaults to `active` in the Active tab.
- History tab switches active status to `all` if the previous status was
  `active`.
- Child-agent filter maps to `agentId`; requester filter maps to
  `requesterAgentId`.

## Selection

- Clicking a run queue row selects it and fetches lineage with `{ runId }`.
- Selection is sticky across polling if the selected run remains in the result.
- If the selected run disappears, the first visible run becomes selected.

## Navigation

- Child agent button calls `navigateToAgent(ui, childAgentId, "subagents")`.
- Requester agent button calls
  `navigateToAgent(ui, requesterAgentId, "subagents")`.
- Child/requester session buttons call `navigateToSession(ui, sessionKey)`.

## Steering

- The operator enters a free-form instruction.
- The instruction is trimmed before calling `steerSubagentRun(runId,
instruction)`.
- On success, the instruction clears, last action payload renders, and the run
  list refreshes.

## Killing

- Kill is disabled unless the selected run is active.
- Clicking kill opens the browser confirmation using the localized run id copy.
- Cancel does not call the API.
- Confirm calls `killSubagentRun(runId)`, renders the last action payload, and
  refreshes.

## Defaults

- Reload calls `fetchDeckConfig` and rehydrates current default values.
- Save builds the next `agents.defaults.subagents` object, clamps numeric
  values, calls `applyDeckConfig(raw, baseHash)`, renders the result, and then
  reloads config.

## Accessibility

- The top mode switch uses a segmented tab control with `aria-label`.
- Queue rows are buttons with stable selected state via `aria-pressed`.
- Inputs and selects keep existing localized `aria-label` values.
- Toggle controls use native `role="switch"` from the design-system atom.
