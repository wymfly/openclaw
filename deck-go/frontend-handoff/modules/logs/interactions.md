# logs — interactions (v2)

## Pointer

- **Log row click** → select that line → details pane updates. Re-clicking the
  selected row is a no-op (does not toggle off). Cursor `pointer`.
- **Hero "Filter by correlation"** → sets `correlationId` to the line's cid +
  clears free text → tail collapses to that trace span.
- **Hero "Open raw payload"** → opens `RawLineDialog` with the line JSON.
- **Hero "Copy line"** → copies the line message to clipboard (mocked in
  prototype with a 1.4s "Copied" badge).
- **Tape row click** → opens `RawLineDialog` with the SSE event JSON.
- **Action: refresh tail** → flips `listState=loading` for 280ms then back to
  `ready`. Production: real fetch.
- **Action: pause / resume stream** → toggles `streamState`. Production also
  aborts/reconnects the SSE controller.
- **Action: clear local logs** → unselects current line. Production also clears
  the in-memory ring buffer (does not delete Gateway logs).
- **Action: prepare export** → opens `ExportPreviewDialog`.
- **Filter clear-all** → resets all 5 filter axes.

## Keyboard

| Key                 | Context                    | Behavior                                                            |
| ------------------- | -------------------------- | ------------------------------------------------------------------- |
| `⌘K` / `Ctrl K`     | anywhere                   | Focus the free text search input                                    |
| `Enter` / `Space`   | focused log row            | Select the row                                                      |
| `Tab` / `Shift Tab` | within filter bar          | Cycle focus through level / source / session / correlation / search |
| `Esc`               | open dialog                | Close the dialog                                                    |
| `Esc`               | open dialog backdrop click | Close the dialog                                                    |

The filter bar uses native semantics:

- Level toggles are `<input type="checkbox">` inside `<fieldset>` with a
  `<legend>`.
- Source / session selects are native `<select>`.
- Free text + correlation id are native `<input type="search" / "text">`.

Tab order:

1. Topbar action buttons
2. Free text search → correlation id input → clear-all button
3. Level checkboxes (4) → source select → session select
4. Action row (refresh / pause / clear / export)
5. Log rows (each row is a single tab stop with `role="button"`)
6. Tape row buttons

## Hover

- **Log rows** — bg lifts from `--ds-bg-1` to `--ds-bg-hover`. Selected rows
  stay accent-tinted.
- **Action buttons** — bg `--ds-bg-2` → `--ds-bg-hover`.
- **Tape rows** — bg `--ds-bg-2` → `--ds-bg-hover`. Border tint preserved.
- **Hero "Filter by correlation"** button — accent-tinted background; hover
  brightens text.
- **Filter bar inputs** — focus-visible ring uses `var(--ds-accent)` with 14%
  alpha glow.

## Density

`compact` (default):

- Row padding `8px 16px`, line height tight.
- Date column hides under each timestamp.
- Tape list capped at 200px.

`cozy`:

- Row padding `12px 16px`.
- Filter bar gets bigger gaps.
- Metric tiles bump to 64px min height.

The Tweaks panel toggles between the two; production switches via global density
preference.

## Empty / loading / error

| Scenario                    | Where                    | UI                                                                |
| --------------------------- | ------------------------ | ----------------------------------------------------------------- |
| filter zero results         | tail card body           | "No lines match these filters." + hint                            |
| stream paused               | action row + topbar pill | warn pill + warn dot, "Resume stream" CTA                         |
| `listState = "loading"`     | full workbench           | spinner overlay "Loading tail (limit 200)…"                       |
| `listState = "error"`       | full workbench           | error overlay with retry CTA                                      |
| no line selected            | details pane             | empty glyph + "No line selected"                                  |
| line has no `fields`        | StructuredFields section | "No structured fields recorded."                                  |
| line has no `correlationId` | CorrelationContext       | "No correlation id on this line." (muted)                         |
| line not error level        | StackTrace section       | section omitted entirely                                          |
| live tape empty             | tape card                | empty list (no special copy in prototype; production: empty hint) |

## Focus

- After clicking a log row → focus stays on the row (preserves keyboard nav).
- After dismissing a dialog → focus returns to the trigger button.
- After clearing-all filters → focus moves to free text search.
- Focus-visible outline on rows uses `outline: 1px solid color-mix(...accent 50%)`.

## A11y semantics

- Filter bar: `<section aria-label="Log filters">` containing:
  - Free text: `aria-label="Free text filter"` + visible label.
  - Correlation id: `aria-label="Correlation id filter"` + visible label.
  - Levels: `<fieldset aria-label="Log levels"><legend>Levels</legend>…</fieldset>`.
  - Source / session: `<select>` with adjacent `<label>`.
- Log row list: `<ul role="list">` with sticky header row.
- Each log row: `<li role="button" tabIndex={0} aria-pressed={selected}>` —
  acts as a single-press target.
- Details pane: `<aside aria-label="Log line details">` with `<section
aria-labelledby="dp-…">` per region.
- Modals: `<div role="dialog" aria-modal="true">` with explicit close button
  carrying `aria-label="Close"`.
- Status pills: text content names the state ("Stream live", "Tail ready") so
  color isn't the only signal.
- Live dot: `aria-hidden` (accompanying text owns the announcement).

## Tweaks-driven exploration

Design-time only. Tweaks panel exposes:

- `theme` ∈ `dark | light`
- `density` ∈ `compact | cozy`
- `listState` ∈ `ready | loading | error`
- `streamState` ∈ `live | paused`
- `detailState` ∈ `ready | empty`

Production translation drops the panel entirely; equivalent state arrives from
fetch + selectors.
