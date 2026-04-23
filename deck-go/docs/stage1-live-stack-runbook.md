# Stage 3 Live Stack Runbook

This runbook is the canonical operator path for the current live stack:

- `deck-go` backend as control-plane truth
- `frontend` as the active Vite host
- managed Gateway lifecycle controlled through the restored Vite shell

## 1. Start `deck-go`

```bash
cd deck-go/backend
DECK_GO_ADDR=127.0.0.1:19566 \
DECK_GO_DATA_DIR=/tmp/deck-go-stage1 \
go run ./cmd/deck-go
```

Expected checks:

```bash
curl -sf http://127.0.0.1:19566/api/runtime/gateway
curl -sf http://127.0.0.1:19566/api/bootstrap/status
```

## 2. Build `frontend` against the external backend

`VITE_DECK_GO_API_BASE` should be present at build time so the browser bundle targets the external backend.

```bash
cd deck-go/frontend
VITE_DECK_GO_API_BASE=http://127.0.0.1:19566 \
npm run build
```

## 3. Start the production-like frontend host

Use Vite preview for a production-like host.

```bash
cd deck-go/frontend
VITE_DECK_GO_API_BASE=http://127.0.0.1:19566 \
npm run preview -- --host 127.0.0.1 --port 4174
```

Expected checks:

```bash
curl -si http://127.0.0.1:4174/ | head -20
curl -sf http://127.0.0.1:19566/api/v1/onboarding/status
```

## 4. Live browser verification

Stage 3 host cutover is now validated primarily through the default build/verify lane:

```bash
cd deck-go
make verify
```

For a local backend + Vite preview smoke that boots both processes and curls the
canonical endpoints:

```bash
cd deck-go
make smoke-stage3-host
```

That smoke now includes a headless browser probe over the live Vite preview and
waits for restored host content to hydrate, instead of stopping at static HTML.
It also runs through a configured Deck access-token path by default.
Under the default local smoke setup, it additionally checks that
`POST /api/runtime/gateway/start` reaches the managed-runtime preflight and
returns the expected `managed gateway token is required` error.

If you have a real managed Gateway token available, you can upgrade the same
smoke lane:

```bash
cd deck-go
DECK_GO_SMOKE_GATEWAY_TOKEN=<gateway-token> \
make smoke-stage3-host
```

In that richer mode the smoke expects lifecycle start acceptance and upgrades
several runtime-backed inventory/config routes from `502` wiring proof to `200`
data proof.

The frontend build now includes a structural guard that fails if:

- any panel id in `frontend/src/restoration/panel-registry.tsx` is no longer implemented in `ActivePanelHost`
- any readiness entry regresses to `frontend-blocked`
- restored panels reintroduce compile-target-incompatible helper patterns

## 5. What this proves

- onboarding/bootstrap works against the external backend
- core panel loading works through the restored Vite host
- gateway lifecycle controls are reachable from the UI
- browser-initiated lifecycle actions hit `deck-go` directly
- `frontend-next` is no longer required in the default build/run path
- the restored panel registry is structurally complete from the Vite host’s point of view

## 6. Known constraints

- live browser smoke against the Stage 3 host is still a separate follow-up tranche; `make verify` is the current canonical gate
- if `VITE_DECK_GO_API_BASE` is omitted, `deck-client.ts` will fall back to `VITE_API_BASE` and then the local default API origin
- `frontend-next` may still be retained in-repo for archive/reference-only comparison, but it is not part of the default host path
