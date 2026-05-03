# logs — components (v2)

## Tree

```
LogsApp                                       [app.jsx]
├─ Topbar                                     [app.jsx — inline]
│  ├─ eyebrow / title / subtitle
│  ├─ stream status pill (live | paused)
│  ├─ tail status pill (ready | loading)
│  └─ ⌘K kbd hint
├─ FilterBar                                  [filter-bar.jsx]
│  ├─ row 1: free text + correlation id + clear-all
│  └─ row 2: level toggles (debug/info/warn/error) + source select + session select
└─ Workbench                                  [app.jsx — inline]
   ├─ LogStream (left pane)                   [log-stream.jsx]
   │  ├─ MetricStrip (cursor / visible / loaded / warns / errors / buffer)
   │  ├─ ActionRow (refresh tail + pause/resume + clear local + export + live dot)
   │  ├─ TailCard (sticky header + LogRow list)
   │  │  └─ LogRow × N                        [log-row.jsx]
   │  └─ TapeCard (live SSE summaries)
   │     └─ TapeRow × N
   └─ DetailsPane (right pane)                [details-pane.jsx]
      ├─ Hero (level pill + source tile + cursor + ts + cid)
      ├─ HeroActions (copy / open raw / filter-by-correlation)
      ├─ StructuredFields (dl/dt/dd)
      ├─ CorrelationContext
      ├─ StackTrace (only when level === "error")
      └─ RawJson (DeckGoLogsTailResponse.lines[i])
```

## Dialogs

| Component             | Trigger                                         | Body                                                                  |
| --------------------- | ----------------------------------------------- | --------------------------------------------------------------------- | ------ |
| `RawLineDialog`       | "Open raw payload" hero action / tape row click | Pretty-printed JSON of the line OR tape event                         |
| `ExportPreviewDialog` | "Prepare export" action button                  | First 6 filtered rows as `<ts> [LEVEL] [source] sess=<sess> cid=<cid> | <msg>` |

Both share `ModalShell` (backdrop click + Esc to close, focus trap).

## Local molecules

### LevelPill

`<span class="log-pill log-row__pill--{level}">{Icon} {label}</span>` — used in
the row "Level" column and the details pane hero.

### SourceTile

`<span class="source-tile source-tile--tone-{tone}"><glyph 2-letter>{label}</span>`
— used only in the details pane hero. The tail row uses a single colored dot
(`source-dot`) to keep row height under 24px.

### MetricTile

Used in the stream KPI strip. Variant `--warn` / `--error` shifts the value
color when the count is non-zero.

### LogRow

6-column grid (ts / level / source / session+cid / message / cursor). Selected
row gets accent border + accent-tinted background. Error rows get a faint red
background tint regardless of selection. Header row is sticky.

### TapeRow

Click-through summary for one SSE event. Variant by event type:
`tape-row--log-batch` (accent border) and `tape-row--log-reset` (warn border +
warn-tinted background).

## Props (production target)

```ts
type FilterBarProps = {
  query: string;
  onQueryChange: (q: string) => void;
  levels: Array<"debug" | "info" | "warn" | "error">;
  enabledLevels: Set<string>;
  onToggleLevel: (level: string) => void;
  sources: string[];
  source: string; // "__all__" | source name
  onSourceChange: (s: string) => void;
  sessions: string[];
  session: string;
  onSessionChange: (s: string) => void;
  correlationId: string;
  onCorrelationChange: (c: string) => void;
  onClearAll: () => void;
};

type LogRowProps = {
  line: LogLine;
  selected: boolean;
  onSelect: () => void;
  density: "compact" | "cozy";
};

type LogStreamProps = {
  lines: LogLine[];
  visible: LogLine[];
  selectedCursor: number | null;
  onSelect: (cursor: number) => void;
  density: "compact" | "cozy";
  streamState: "live" | "paused";
  onTogglePause: () => void;
  onRefresh: () => void;
  onClearLocal: () => void;
  onPrepareExport: () => void;
  bufferCap: number;
  cursor: number;
  liveTape: TapeEvent[];
  onOpenTapeRaw: (evt: TapeEvent) => void;
};

type DetailsPaneProps = {
  line: LogLine | null;
  onJumpCorrelation: (cid: string) => void;
  onOpenRaw: () => void;
  onCopyMessage: () => void;
  copyState: "idle" | "copied";
};
```

## Class-name intent

| Class                                      | Purpose                                          |
| ------------------------------------------ | ------------------------------------------------ |
| `.logs-app`                                | Top-level grid container                         |
| `.logs-app__topbar`                        | Eyebrow / title / status row                     |
| `.logs-app__workbench`                     | Two-pane grid (`--loading` / `--error` collapse) |
| `.filter-bar`                              | Filter container card                            |
| `.level-toggle` / `--on`                   | Per-level checkbox toggle                        |
| `.log-stream`                              | Left pane wrapper                                |
| `.log-stream__metrics`                     | KPI strip (6 columns)                            |
| `.log-stream__action-row`                  | Action button row                                |
| `.log-stream__panes`                       | List card + tape card grid                       |
| `.log-row`                                 | One log line row                                 |
| `.log-row--selected`                       | Selected state                                   |
| `.log-row--error-tint`                     | Error tint background                            |
| `.log-pill--{level}`                       | Level pill variants                              |
| `.tape-row--log-batch` / `--log-reset`     | Tape row event type variants                     |
| `.details-pane`                            | Right pane wrapper                               |
| `.details-pane__hero`                      | Hero header                                      |
| `.details-pane__kv`                        | Structured fields `<dl>`                         |
| `.details-pane__stack`                     | Stack trace `<pre>`                              |
| `.modal` / `.modal__head` / `.modal__body` | Modal shell                                      |
