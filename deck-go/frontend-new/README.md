# deck-go frontend-new

> The clean engineering workspace under **protocol-v1** (OpenSpec change `deck-go-frontend-protocol-v1`).
> Coexists with old `../frontend/` during the transition; future change replaces `frontend/` with this tree.

## Quick start

```sh
cd deck-go/frontend-new
npm install
npm run dev          # → http://localhost:5175/
npm run dev          # add ?dsGallery=1 to inspect every atom
npm run test:deck-ui # vitest + vitest-axe
npx tsc --noEmit     # type check
```

## What's here

- `src/main.tsx` — entry; loads `@fontsource/{inter,jetbrains-mono}` and `--ds-*` tokens
- `src/App.tsx` — placeholder app showing scaffolded state + theme/density toggles
- `src/design-system/`
  - `tokens/index.css` — canonical `--ds-*` tokens (dark / light · comfortable / compact)
  - `atoms/` — 36 flat atoms (`Badge.tsx` + `badge.css` co-located) + barrel + tests
  - `hooks/` — 5 hooks + barrel + tests
  - `dev/Gallery.tsx` — lazy-loaded design system live-sample (lazy-imported by `?dsGallery=1`)
- `src/components/panels/` — empty; chat lands first via `deck-go-chat-protocol-pilot`

## Protocol entries

- [`./CLAUDE.md`](./CLAUDE.md) — real engineering protocol (this workspace)
- [`../docs/CLAUDE.md`](../docs/CLAUDE.md) — project documentation navigation
- [`../frontend-handoff/CLAUDE.md`](../frontend-handoff/CLAUDE.md) — design ↔ engineering handoff protocol
- [`../docs/project/stack-decisions.md`](../docs/project/stack-decisions.md) — current stack (locked / defaulting / pending)
- [`../docs/project/current-state.md`](../docs/project/current-state.md) — 5-minute project state snapshot

## Tokens drift

`tokens/index.css` has a mirror at `../frontend-handoff/design-system/tokens.css`. Run
`bash ../scripts/check-tokens-drift.sh` after any token change — must exit 0.

## Coexistence with `../frontend/`

| Concern         | This workspace                 | Old `../frontend/` |
| --------------- | ------------------------------ | ------------------ |
| Port (dev)      | 5175                           | 5174               |
| Port (preview)  | 4175                           | 4174               |
| Package name    | `deck-go-frontend-new`         | `deck-go-frontend` |
| Status          | Active (new modules land here) | ⚠️ Frozen          |
| `node_modules/` | Independent                    | Independent        |

Both can run side-by-side. Switch-over happens in a future change (rename `frontend → frontend-legacy`, `frontend-new → frontend`).
