# Activity States

## Activity Feed State

| State             | Trigger                                    | UI                                                                                                   |
| ----------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Loading           | `fetchActivityEvents()` pending            | subdued status badge, stable skeleton-like empty slots or existing layout                            |
| Ready with events | events returned                            | metrics, filters, grouped timeline, selected event                                                   |
| Ready empty       | zero events                                | empty note that no activity has been reported                                                        |
| Filter empty      | loaded events exist but filters match none | filter-empty note; existing event detail may remain visible only if still selected by fallback logic |
| Not configured    | BFF returns `gateway_not_configured`       | shared Gateway not-configured empty state                                                            |
| Error             | other load failure                         | inline error note without exposing raw configured-gateway sentinel text                              |

## Live Stream State

- Incoming `activity.event` payload inserts into the timeline.
- Duplicate ids are replaced rather than duplicated.
- Non-activity stream events are ignored by `useActivitySSE`.
- Invalid JSON payloads are ignored.

## Monitor Run State

| State                | Trigger                              | UI                                                            |
| -------------------- | ------------------------------------ | ------------------------------------------------------------- |
| Loading              | `fetchMonitorRuns()` pending         | run readiness badge shows loading while layout remains stable |
| Ready with runs      | runs returned                        | stats strip, top agents if present, run list, selected run    |
| Ready empty          | no monitor runs                      | empty note that no monitor runs were reported                 |
| Filter empty         | filters remove all runs              | same no-runs state for current filters                        |
| Pagination available | `nextCursor` exists                  | load more action                                              |
| Not configured       | BFF returns `gateway_not_configured` | shared Gateway not-configured empty state                     |
| Error                | other monitor failure                | inline error note                                             |

## Selected Run Detail State

- `idle`: no run selected.
- `loading`: run id selected, detail request pending.
- `ready`: summary, diagnostics, raw events, and payload are visible.
- `error`: inline monitor error shown; selected run list remains available.

## Empty / Edge Cases

- Missing `agentId`: render system/unavailable and hide open-agent handoff.
- Missing `sessionKey`: hide open-session handoff.
- Long ids and JSON payloads: wrap or truncate inside constrained surfaces.
- Unknown stream data: keep raw event visible and skip parsed diagnostic row.
- `details` may be string or object-like payload from live events; render through text/raw payload without assuming schema.
