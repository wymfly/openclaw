# sessions - states

## Load states

| State             | Meaning                                   | UI                                                                           |
| ----------------- | ----------------------------------------- | ---------------------------------------------------------------------------- |
| inventory idle    | no sessions loaded or load failed         | muted inventory badge and error note if present                              |
| inventory loading | `fetchSessions` / preview load pending    | running badge; previous list may remain                                      |
| inventory ready   | sessions and previews resolved            | inventory badge OK; visible count and rows available                         |
| detail idle       | no selected session or detail load failed | detail badge muted; empty selected-session state                             |
| detail loading    | detail/history pending                    | selected hero stays stable where possible                                    |
| detail ready      | detail/history resolved                   | runtime metadata, transcript, usage, compaction, and lineage sections render |
| lineage loading   | subagent lineage pending                  | lineage badge running                                                        |
| lineage ready     | subagent lineage resolved                 | lineage nodes and relations render                                           |

Errors render as compact card-local notes. Long error messages must wrap without
breaking the workbench.

## Inventory

When sessions load:

- fetch up to the current `SESSION_FETCH_LIMIT`
- fetch previews for the first `PREVIEW_LIMIT` sessions
- select the navigation `sessionKey` when present and found, otherwise keep
  current selection when requested, otherwise select the first session

Client-side filters:

- search title, key, and preview
- filter by inferred session kind
- reset page to 1 when filters change

## Detail and transcript

When a selected session key exists:

- load detail through `fetchSessionDetail`
- load history through transcript cache if available, otherwise `fetchChatHistory`
- normalize fetched transcript messages before caching
- clear lineage unless the selected session is a subagent

When a selected session is subagent-like:

- load lineage through `fetchSubagentLineage({ sessionKey })`
- render parent/child relationships when present

## Usage and context

When selected session key exists:

- `SessionUsageDetails` loads `fetchUsageSessions({ includeContextWeight: true, key, limit: 1 })`
- `SessionUsageDetails` loads `fetchUsageSessionLogs({ key, limit: 50 })`
- missing context weight renders a compact empty row
- high-token turns render as a textual marker only

## Compaction

When `compactionCount` is absent or zero:

- compaction history is omitted

When `compactionCount` is positive:

- `fetchCompactionCheckpoints(sessionKey)` loads checkpoints
- branch calls `branchCompactionCheckpoint(sessionKey, checkpointId)`
- restore calls `restoreCompactionCheckpoint(sessionKey, checkpointId)` and refreshes checkpoints
- latest compaction action is shown as local evidence

## Transcript search and export

Transcript search:

- searches loaded messages only
- match navigation cycles within current matches
- selected match renders as plain text

Export:

- JSON/Markdown export uses selected session plus loaded transcript messages
- export preview is local UI state
- export does not call a server endpoint

## Session mutations

Reset/clear/patch:

- call the existing API wrapper immediately
- invalidate selected transcript cache
- refresh inventory and selected detail while preserving selection

Compact/delete:

- require a confirmation gate before the API call
- compact preserves selection after refresh
- delete clears detail/history and lets inventory choose the next session

## Unsupported states

These are not guaranteed by current contracts and should remain follow-up notes:

- server-side pagination/cursor for inventory
- exhaustive schema-driven session patch fields
- stronger typed compaction action result shape
- real-time sessions stream refresh in this panel
- real Gateway/LLM E2E proof from mock visual tests
