# Stage 1 Live Stack Runbook

This runbook is the canonical operator path for the Stage 1 stack:

- `deck-go` backend as control-plane truth
- `frontend-next` as the Stage 1 `Next + React + Node` host
- managed Gateway lifecycle controlled from the frontend

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

## 2. Build `frontend-next` against the external backend

`NEXT_PUBLIC_DECK_GO_API_BASE` must be present at build time so the browser bundle and CSP both allow direct calls to the external backend.

```bash
cd deck-go/frontend-next
NEXT_PUBLIC_DECK_GO_API_BASE=http://127.0.0.1:19566 \
pnpm build
```

## 3. Start the production-like frontend host

Use the standalone server, not `next start`.

```bash
cd deck-go/frontend-next
HOSTNAME=127.0.0.1 \
PORT=3011 \
NEXT_PUBLIC_DECK_GO_API_BASE=http://127.0.0.1:19566 \
pnpm start
```

Expected checks:

```bash
curl -si http://127.0.0.1:3011/ | head -20
curl -sf http://127.0.0.1:19566/api/v1/onboarding/status
```

The page CSP should include the external backend origin in `connect-src`.

## 4. Live browser verification

Provide a resolvable Gateway token and run the live Playwright suite against the external host:

```bash
cd deck-go/frontend-next
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3011 \
PLAYWRIGHT_DECK_GO_API_BASE=http://127.0.0.1:19566 \
PLAYWRIGHT_GATEWAY_URL=ws://127.0.0.1:18789 \
OPENCLAW_GATEWAY_TOKEN=<gateway-token> \
pnpm test:e2e:live
```

Current canonical live suite covers 14 browser proofs:

- smoke
- channels
- gateway lifecycle
- approvals resolve
- approvals refresh recovery
- docs extraction + reload rehydrate
- chat send / steer / abort
- compaction history visibility
- webhooks failed delivery visibility
- webhooks history accumulation + reload rehydrate
- monitor/activity fidelity
- memory browse/health + reload stability + degraded search notice
- canvas empty-state bridge surface
- media inline read + download headers

## 5. What this proves

- onboarding/bootstrap works against the external backend
- core panel loading works through the Stage 1 host
- gateway lifecycle controls are reachable from the UI
- browser-initiated lifecycle actions hit `deck-go` directly
- advanced Stage 1 surfaces have live proof for approvals/docs/webhooks/history reload behavior
- canvas/media normal-usage paths are covered by the canonical live suite

## 6. Known constraints

- rebuilding `frontend-next` invalidates the active standalone server's `.next` chunks; restart the frontend after every build
- if `NEXT_PUBLIC_DECK_GO_API_BASE` is omitted during build, browser lifecycle calls will fail because the local `/api/*` compatibility layer has been retired
