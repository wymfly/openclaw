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
  - the only control-plane base env still recognized by `frontend-next`
  - drives both `src/lib/deck-client.ts` direct `/api/*` routing and the CSP `connect-src` allowlist in `next.config.ts`

## Current migration posture

- `deckFetch` / `deckStream` support direct base-URL routing to Go
- session store calls that previously bypassed `deck-client` now use the shared transport seam
- the old local `src/app/api/**` compatibility layer has been retired
- browser/runtime flows now depend on direct base-aware transport to `deck-go`

## Retained host shells

`frontend-next` is now a transitional host shell, not a second runtime owner. The
remaining host-specific surfaces are intentionally narrow:

- `src/lib/deck-client.ts`
  - the remaining host transport seam for direct `deck-go` calls
  - owns `NEXT_PUBLIC_DECK_GO_API_BASE` routing plus access
    token prompting, `x-deck-token` forwarding, and `Last-Event-ID` SSE replay

No private `DECK_GO_API_BASE` fallback remains inside `frontend-next`; the host
now converges on the same public base contract that the browser bundle uses.

The old `frontend-next/server` local runtime cluster has been retired. This host
no longer carries a second local Gateway runtime, event bus, approval bridge,
or alert engine alongside the Stage 2 control-plane.

The old `frontend-next/src/app/api/**` compatibility layer has also been
retired. The standalone Next host no longer serves local `/api/*` Deck
endpoints in Stage 1 external-backend mode.

Webhook callback ingress now belongs to the `deck-go` backend itself. The Next
host no longer carries a special callback rewrite layer.

Plugin locale bootstrap no longer bridges through the server request layer.
Dynamic plugin wizard text now resolves from plugin inventory already loaded on
the client path.

Everything else in `frontend-next` should behave like a normal frontend
consumer:

- no local runtime fallback
- no route-owned business truth
- no durable control-plane persistence
- no direct filesystem or Gateway loopback logic
