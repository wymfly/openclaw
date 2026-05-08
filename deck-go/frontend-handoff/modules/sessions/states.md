# sessions - states

## Load states

| State                | Meaning                                   | UI                                                                      |
| -------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| inventory idle       | no sessions loaded or load failed         | muted inventory badge and error note if present                         |
| inventory loading    | `fetchSessions` / preview load pending    | running badge; previous list may remain                                 |
| inventory ready      | sessions and previews resolved            | inventory badge OK; visible count and rows available                    |
| detail idle          | no selected session or detail load failed | detail badge muted; empty selected-session state                        |
| detail loading       | detail/history pending                    | selected hero stays stable where possible                               |
| detail ready         | detail/history resolved                   | selected hero, transcript workbench, and Inspector tab summaries render |
| lineage loading      | subagent lineage pending                  | lineage badge running                                                   |
| lineage ready        | subagent lineage resolved                 | lineage nodes and relations render                                      |
| inspector overview   | default selected Inspector tab            | selected metadata and tab summaries render                              |
| inspector usage      | operator selected Usage tab               | usage/context diagnostics render                                        |
| inspector compaction | operator selected Compaction tab          | checkpoint list and branch/restore controls render                      |
| inspector lineage    | operator selected Lineage tab             | subagent lineage and relation navigation render                         |
| inspector actions    | operator selected Actions tab             | patch controls, guarded actions, and latest action result render        |

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
- this data belongs to the Inspector `Usage` tab, but it still loads with the
  selected session rather than being tab-triggered

## Compaction

When `compactionCount` is absent or zero:

- compaction history is omitted

When `compactionCount` is positive:

- `fetchCompactionCheckpoints(sessionKey)` loads checkpoints
- branch calls `branchCompactionCheckpoint(sessionKey, checkpointId)`
- restore arms a confirmation state before calling
  `restoreCompactionCheckpoint(sessionKey, checkpointId)` and refreshes
  checkpoints after execution
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

Reset/clear:

- first click arms a confirmation state
- confirming click calls the existing API wrapper
- invalidate selected transcript cache
- refresh inventory and selected detail while preserving selection

Patch:

- calls the existing API wrapper immediately
- stays scoped to product-backed model/label/thinking/fast controls
- invalidates selected transcript cache
- refreshes inventory and selected detail while preserving selection

Compact/delete/restore:

- require a confirmation gate before the API call
- compact preserves selection after refresh
- delete clears detail/history and lets inventory choose the next session
- restore preserves selected session and refreshes compaction state

## Unsupported states

These are not guaranteed by current contracts and should remain follow-up notes:

- server-side pagination/cursor for inventory
- exhaustive schema-driven session patch fields
- chat compose/send/abort/steer controls in the Sessions module
- Gateway-only list/preview/compact/delete options before Deck product
  contracts expose them
- stronger typed compaction action result shape
- real-time sessions stream refresh in this panel
- real Gateway/LLM E2E proof from mock visual tests
