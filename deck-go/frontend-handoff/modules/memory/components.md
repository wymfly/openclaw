# Components

## Component Tree

```text
MemoryPanel
  MemoryHeader
  MemoryMetricStrip
  MemoryWorkbench
    AgentControlCard
    LaneSwitcher
    FileLane
      MemoryPathToolbar
      MemoryFileRow[]
    SearchLane
      MemorySearchControls
      MemorySearchResultRow[]
    GraphLane
      MemoryGraphSummary
      MemoryGraphRow[]
    HealthLane
      MemoryHealthRow[]
    DreamsLane
      DreamActionStrip
      DreamDiarySummary
  MemoryDetailSidecar
    FileDetail | SearchDetail | GraphDetail | HealthDetail | DreamDetail
```

## Local Molecules

### Memory metric tile

- `label`: short uppercase metric label
- `value`: stable text or number
- `tone`: `neutral | positive | warning | danger`
- Keep one-line truncation for long paths.

### Lane switcher

- Five lanes: Files, Search, Graph, Health, Dreams.
- Uses button semantics and `aria-pressed`.
- Must not resize the workbench when switching lanes.

### Memory file row

- Displays file/directory type, name, path, size, and relation count.
- Directory rows browse the path.
- File rows read content into the sidecar.

### Search result row

- Displays path, relevance, tier, scope, optional decay score, and content
  snippet.
- Empty and LanceDB-unavailable states are distinct.

### Health diagnostic row

- Displays agent id, provider, embedding status, and error text when present.
- Raw payload remains available in detail.

### Dream action strip

- Read, backfill, and dedupe are normal actions.
- Repair, reset short-term, and reset are visually dangerous and require
  confirmation.

### Detail sidecar

- Mirrors the active lane and keeps selected/raw payload evidence visible.
- Never renders blank content: use empty, loading, or error copy.

## Styling Contract

- Use `--ds-*` tokens with fallback to existing app tokens.
- Radius stays at or below 8px for cards/rows.
- Stable responsive constraints: the first viewport should keep controls,
  metrics, primary lane, and detail sidecar readable on desktop and collapse to
  one column below tablet width.
