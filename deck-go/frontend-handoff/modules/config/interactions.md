# Config Interactions

## Refresh

- Calls `fetchDeckConfig`.
- Replaces raw draft and loaded baseline.
- Clears pending diff, conflict preview, JSON drafts, and sensitive visibility.

## Lookup

- Calls `lookupConfigPath(path.trim())`.
- Empty path is allowed for root schema through the initial loader.
- Manual lookup requires a non-empty path.

## Structured Field Edit

- Writes to the raw config draft through local path helpers.
- Keeps backend untouched until apply.
- Clears pending diff/conflict because the draft changed.

## Apply Preview

- Parses raw JSON and requires a JSON object.
- Computes diff from loaded baseline to draft.
- Shows preview before backend mutation.

## Confirm Apply

- Calls `applyDeckConfig(raw, baseHash)`.
- On success, refreshes and records action result.
- On conflict, fetches latest config and shows conflict preview.

## Conflict Recovery

- Reload latest replaces the draft with backend truth.
- Retry local with latest hash calls the same apply wrapper with the latest hash.

## Sensitive Reveal

- Toggles only local input type.
- Does not change raw draft or backend config.
