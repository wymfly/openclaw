# deck-go frontend-next

Copied legacy Deck frontend for the adapter-first migration path.

## Purpose

This app is the **primary stage-1 migration frontend** for `deck-go`.

- source reference remains frozen in `dashboard/`
- this copy lives under `deck-go/frontend-next/`
- stage 1 keeps the frontend on `Next + React`
- backend/control-plane truth comes from `deck-go` Go services

## Boot contract

1. Install from repo root:

```bash
pnpm install
```

2. Configure the Go backend base URL:

```bash
cp .env.example .env.local
```

3. Run the copied frontend:

```bash
pnpm dev
```

4. Build and run production mode:

```bash
pnpm build
pnpm start
```

## Key environment

- `NEXT_PUBLIC_DECK_GO_API_BASE`
  - when set, `src/lib/deck-client.ts` prefixes relative `/api/*` requests and stream endpoints so the copied frontend can talk directly to the `deck-go` Go backend

## Current migration posture

- `deckFetch` / `deckStream` support direct base-URL routing to Go
- session store calls that previously bypassed `deck-client` now use the shared transport seam
- Next route handlers still exist and may remain temporarily where a thin compatibility proxy is still needed
