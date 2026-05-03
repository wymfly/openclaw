# States

## Ready

- Agent selector has a valid `agentId`.
- File lane shows current path, file count, directory count, and rows.
- Detail sidecar shows selected file content or a selectable empty state.

## Loading

- Main status pill reads `Memory loading`.
- Workbench keeps previous layout dimensions.
- Loading does not clear the active lane label.

## Empty

- File lane: "No memory files loaded."
- Graph lane: "No memory graph nodes loaded."
- Search lane: "No memory search results loaded."
- Dreams lane: "Dream diary has not been read yet."

## Error

- Error banner/row appears under controls.
- Existing selected content remains visible when possible.
- API error text can wrap without widening the panel.

## Search Unavailable

- `searchMemory` may return `unavailableReason` when the backend returns `501`.
- The reason is displayed as a warning lane state.
- Detail sidecar still shows the search-result empty prompt.

## File Read

- Selecting a file calls `readMemoryFile(agentId, path)`.
- The selected row is visibly active.
- Sidecar shows path and content in a wrapped code surface.

## Directory Browse

- Selecting a directory calls `browseMemory(agentId, path)`.
- The selected file state clears.
- Parent navigation appears when `currentBrowsePath` is non-empty.

## Health

- Health lane loads through `fetchMemoryHealth`.
- Single-result `doctor.memory.status` payloads are normalized into one row.
- Raw payload remains available in sidecar.

## Dreams

- Entering the Dreams lane reads the diary.
- Maintenance actions store the latest action result and refresh the diary.
- Confirmation rejection for destructive actions does not call
  `runMemoryDreams`.
