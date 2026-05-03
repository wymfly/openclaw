# States

## Data State

```ts
type ThreadsLoadState = "idle" | "loading" | "ready";

type ThreadsState = {
  threads: DeckGoThreadEntry[];
  selectedThreadId: string;
  draftFilters: {
    agentId: string;
    channel: string;
    status: "active" | "all";
  };
  appliedFilters: {
    agentId: string;
    channel: string;
    status: "active" | "all";
  };
  loadState: ThreadsLoadState;
  error: string;
  handoffMessage: string;
};
```

## Ready

- Show status as ready.
- Sort rows by `lastActivityAt` descending, then `threadId` ascending.
- Select the most recently active row on first load.
- Show relationship map and handoff actions for the selected row.

## Loading

- Keep the previous rows visible if already loaded.
- Status pill changes to loading.
- Refresh button may remain enabled; duplicate responses must be ignored by the
  existing load sequence guard.

## Empty

- Show empty inventory when `threads` is empty.
- Detail side shows select-a-thread copy and keeps filters visible.
- Do not fabricate demo rows.

## Error

- Show the error message near the filters.
- Preserve last successful rows when possible.
- Allow retry by pressing refresh.

## Clipboard Fallback

- If clipboard write is unavailable or fails, show the selected
  `targetSessionKey` visibly in the handoff message.

## Missing Optional Label

- If `label` is missing, use `threadId` as the visible title.
- Keep the raw `threadId` visible even when `label` exists.
