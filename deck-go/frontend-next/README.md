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

## Retained host shells

`frontend-next` is now a transitional host shell, not a second runtime owner. The
remaining host-specific surfaces are intentionally narrow:

- `src/lib/deck-go-base.ts`
  - the only place that resolves `DECK_GO_API_BASE` /
    `NEXT_PUBLIC_DECK_GO_API_BASE`
  - shared by the retained host shells so base/env transport rules stay single-sourced
- `src/app/api/**/route.ts` plus `src/app/api/_deck-go-proxy.ts`
  - same-origin proxy and thin response-shaping shell for browser callers that
    still talk to `Next` route handlers
- `src/lib/deck-client.ts`
  - browser-side transport shell for direct `deck-go` calls, including access
    token prompting, `x-deck-token` forwarding, and `Last-Event-ID` SSE replay
- `src/i18n/request.ts`
  - server-side locale bootstrap bridge that reads plugin locale inventory from
    the Stage 2 control-plane during render-time execution
- `src/middleware.ts`
  - the last remaining host-only ingress seam
  - ingress reverse-proxy shell for plugin webhook callbacks that must enter
    through the public `frontend-next` port and hop to loopback Gateway

The old `frontend-next/server` local runtime cluster has been retired. This host
no longer carries a second local Gateway runtime, event bus, approval bridge,
or alert engine alongside the Stage 2 control-plane.

Everything else in `frontend-next` should behave like a normal frontend
consumer:

- no local runtime fallback
- no route-owned business truth
- no durable control-plane persistence
- no direct filesystem or Gateway loopback logic outside `src/middleware.ts`
