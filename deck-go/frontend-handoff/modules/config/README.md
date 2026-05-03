# Config Handoff

Status: ready for production rewrite under `frontend-config-hifi-contract-redesign`.

## Contract Truth

- Browser entry points:
  - `fetchDeckConfig()` -> `GET /api/config`
  - `applyDeckConfig(raw, baseHash)` -> `POST /api/config/apply`
  - `lookupConfigPath(path)` -> `POST /api/config/schema-lookup`
- Deck-facing DTO authority:
  - `DeckGoConfigSnapshotResponse`
  - `DeckGoConfigApplyResponse`
  - `DeckGoConfigLookupChild`
  - `DeckGoConfigLookupResponse`
- Backend/Gateway chain:
  - Go routes: `deck-go/backend/internal/server/config.go` and `gateway.go`
  - Gateway methods: `config.get`, `config.apply`, `config.patch`, `config.schema.lookup`
- Mutation safety:
  - Snapshot hash/baseHash is the apply base.
  - Raw JSON is the single draft source.
  - Structured field edits write back into the raw JSON draft and do not mutate backend state until apply.

## Product Frame

Config is a governance workbench for openclaw.json. Operators need to inspect current config shape, edit a structured subset safely, review raw JSON diffs before applying, and recover when the backend reports a stale base hash.

## Workflow Constraints

- Keep all browser traffic behind the Go BFF. Do not call Gateway directly.
- Keep raw JSON as the single source of draft truth.
- Keep sensitive masking as display-only. Do not imply secret vault protection.
- Keep unsupported concepts out of the UI: schema authoring, schema migration generation, history/version restore, config import/export, collaborative editing, and production rollback assurance.
- Label mock/local visual tests as mock/local evidence only.

## Implementation Notes

- First viewport should expose:
  - config status
  - top-level key count
  - schema section count
  - hash/baseHash
  - dirty state
  - raw editor controls
  - schema lookup and structured fields
  - diff/conflict surfaces when active
- Apply flow remains preview-first: raw edit -> diff preview -> confirm apply.
- Conflict flow remains refresh-aware: failed apply -> latest config fetch -> remote-vs-local diff -> reload latest or retry with latest hash.

## Open Questions

- Whether future Gateway contracts will expose config history or rollback.
- Whether schema hints should provide richer labels/help text for all plugin-owned fields.
- Whether a future canonical JSON editor atom is justified after config and models both exercise raw JSON editing.
