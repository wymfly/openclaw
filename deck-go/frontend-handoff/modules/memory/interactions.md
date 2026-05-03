# Interactions

## Agent Selection

- Text input supports direct agent id entry.
- Gateway-backed selector switches between known agents when available.
- Changing agent refreshes file/graph data for the active browse lane.

## Lane Switching

- Files and Graph load the current agent memory workspace.
- Health loads diagnostics.
- Dreams reads the diary on entry.
- Search waits for explicit query submission.

## Browse / Read

- Directory row click: browse into directory.
- File row click: read file content.
- Back to parent: browse parent path or root.
- Long path text truncates visually but remains visible in row/detail text.

## Search

- Empty query sets a local validation error.
- Search trims whitespace before sending.
- `scope=all` is omitted by the wrapper; `global` and `agent` are sent.
- LanceDB-unavailable responses are warning states, not hard failures.

## Dreams

- `read`, `backfill`, and `dedupe` run directly.
- `repair`, `resetShortTerm`, and `reset` require `window.confirm`.
- Rejected confirmation leaves action result and diary unchanged.

## Keyboard / Focus

- Native buttons, inputs, and selects are used.
- Active lane button uses `aria-pressed`.
- Inputs retain visible focus rings.
- The panel does not trap focus.
