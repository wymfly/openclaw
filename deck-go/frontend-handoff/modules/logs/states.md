# logs - states

## Tail state

| State     | Meaning                                         | UI                                                                      |
| --------- | ----------------------------------------------- | ----------------------------------------------------------------------- |
| `idle`    | No successful tail load in current render path. | Neutral tail badge, empty rows, refresh enabled.                        |
| `loading` | `fetchLogsTail` is pending.                     | Running badge, optional small spinner, previous rows remain if present. |
| `ready`   | Latest `fetchLogsTail` resolved.                | OK badge, cursor and visible count metrics update.                      |

Errors from `fetchLogsTail` render as a compact status banner and do not clear
the current local rows unless the component has no prior tail.

## Stream state

| State          | Meaning                               | UI                                       |
| -------------- | ------------------------------------- | ---------------------------------------- |
| `idle`         | Stream disabled or not yet connected. | Neutral stream badge; toggle can resume. |
| `connecting`   | SSE request started.                  | Running stream badge.                    |
| `connected`    | SSE open and receiving/ready.         | OK stream badge.                         |
| `reconnecting` | Existing stream helper is retrying.   | Running/warn stream badge.               |
| `error`        | Stream helper surfaced an error.      | Error banner plus stream status badge.   |

Pausing stream sets `streamingEnabled=false`, aborts the SSE controller, and
keeps the current tail rows, live tape, and event history.

## Data states

### Ready with rows

The first viewport shows:

- tail status
- stream status
- cursor
- visible row count
- local filter controls
- latest rows
- live tape and stream event sidecar
- raw tail payload seam

### Empty

If `tail.lines` is empty or all rows are filtered out, render the localized empty
copy. Do not fabricate a synthetic log row.

### Reset

When a `log.reset` stream event arrives:

- add the localized reset label to live tape
- clear tail rows
- mark `reset=true` in tail state when a tail exists
- keep stream event evidence visible

### Batch

When a `log.batch` stream event arrives:

- persist event id to `deckGoLogsLastEventId`
- persist payload cursor to `deckGoLogsCursor` when present
- append payload lines to `tail.lines`
- cap local buffer at `LOG_BUFFER_LIMIT`
- add a summary item to live tape

## Local filters

Level, source, and session filters only filter already-loaded rows. They do not
change `/logs` query params and must not be presented as server-side search.

Rules:

- Unchecking a level hides rows with that parsed level.
- Source `all` disables source filtering.
- Session filter matches parsed `sessionKey` or message text case-insensitively.
- Export preview uses filtered rows, not all loaded rows.

## Persistence

- Tail cursor key: `deckGoLogsCursor`
- SSE last event id key: `deckGoLogsLastEventId`

Invalid persisted cursors are ignored on initial tail load.

## Unsupported states

These are not guaranteed by current contracts and should remain follow-up notes:

- server-side level/source/session filters
- durable log deletion
- durable export/download files
- structured stack trace grouping
- guaranteed upstream `logs.tail` generated schema
