# logs — states (v2)

## View shape

Single-page two-pane workbench. No detail-route — the details pane is always
rendered on the right (or stacked under the stream pane on narrow viewports).

## Top-level state

```ts
{
  // filters
  query: string,                     // free text
  enabledLevels: Set<string>,        // {debug, info, warn, error}
  source: string,                    // "__all__" or source name
  session: string,                   // "__all__" or session name
  correlationId: string,             // exact-match trace id
  // selection
  selectedCursor: number | null,
  // dialogs
  rawDialog: { kind: "line" | "tape", entry } | null,
  exportOpen: boolean,
  // ephemeral UI
  copyState: "idle" | "copied"
}
```

Tweaks-driven (design-time only):

```ts
{
  theme: "dark" | "light",
  density: "compact" | "cozy",
  listState: "ready" | "loading" | "error",
  streamState: "live" | "paused",
  detailState: "ready" | "empty"
}
```

## List state

| State     | Trigger                                 | Renders                                                                           |
| --------- | --------------------------------------- | --------------------------------------------------------------------------------- |
| `ready`   | tail fetch resolved                     | KPI strip + filter bar + filtered tail rows + tape + details                      |
| `loading` | manual refresh in flight                | full-width state overlay with spinner; previous rows kept underneath in real prod |
| `error`   | tail fetch returned 5xx / network error | full-width error overlay with retry button                                        |

When `visible.length === 0` (filters narrow to zero) the tail card body shows
a localized empty block with hint copy. KPIs and tape are still rendered.

## Stream state

| State    | UI                                       | Stream dot     |
| -------- | ---------------------------------------- | -------------- |
| `live`   | green pill in topbar; "Pause stream" CTA | green, pulsing |
| `paused` | warn pill in topbar; "Resume stream" CTA | warn, static   |

In production:

- `connecting` / `reconnecting` show as warn pulse + reconnect status pill.
- `error` shows a banner inline above the action row.

The prototype collapses `connecting | reconnecting | error` into the `paused`
visual to keep the design surface tight; production must keep all three.

## Details state

| State   | Trigger                            | Renders                                              |
| ------- | ---------------------------------- | ---------------------------------------------------- |
| `ready` | a line is selected                 | hero + fields + correlation + stack (if error) + raw |
| `empty` | nothing selected (or filtered out) | empty placeholder with `IconLayers` glyph            |

Selecting a row that gets filtered out auto-falls-back to the first visible row.

## Filter composition

All filters AND together. Order applied in `app.jsx`:

1. Level checkbox membership.
2. Source equality (skipped for `__all__`).
3. Session equality (skipped for `__all__`).
4. Correlation id exact match (skipped if empty).
5. Free text — case-insensitive substring match across
   `ts | message | sessionKey | source | correlationId | JSON.stringify(fields)`.

The clear-all button resets levels (all checked), source / session to
`__all__`, correlation id to empty, free text to empty.

## Persistence

Production should persist (per existing wrappers):

- `deckGoLogsCursor` — last seen cursor (so refresh can be incremental).
- `deckGoLogsLastEventId` — SSE `Last-Event-ID` for resume-from-id.

Filter state (`query`, `enabledLevels`, `source`, `session`, `correlationId`)
is **session-only**; not persisted. (Future: persist via URL query so deep
links share filter context — out of scope for this pass.)

## Error states (production target, not all in prototype)

| Error           | UI                                                                          |
| --------------- | --------------------------------------------------------------------------- |
| Tail 5xx        | `state-overlay--error` with retry button. Previous rows blanked.            |
| Tail timeout    | Same; copy mentions "took too long".                                        |
| SSE drop        | Stream pill becomes warn; live dot becomes static; banner above action row. |
| SSE reset       | Tail rows blanked, live tape gets a reset row.                              |
| Buffer overflow | Status pill `BUFFER 5K` highlights; oldest 1000 dropped silently.           |

## Buffer behavior

`bufferCap = 5000`. When live stream lines push past 5,000:

- Drop oldest 1,000 lines (FIFO).
- KPI strip "Loaded rows" reflects post-drop count.
- Live tape gets a synthetic info row: `buffer trim — kept newest 4000`.

The prototype hardcodes 124 seed lines so this code path is not exercised; it
must be implemented in production.
