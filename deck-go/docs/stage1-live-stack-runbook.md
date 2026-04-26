# Stage 3 Live Stack Runbook

This runbook is the canonical operator path for the current live stack:

- `deck-go` backend as control-plane truth
- `frontend` as the active Vite host
- managed Gateway lifecycle controlled through the restored Vite shell

## 0. Preferred local operator wrapper

For day-to-day local bring-up, prefer the checked-in wrapper instead of manually
retyping env vars:

```bash
cd deck-go
cp .env.example .env
make stack-start
```

That path keeps backend/frontend/runtime settings in one `deck-go/.env` file and
lets `deck-go` own local Gateway lifecycle through its own runtime APIs.
After `make stack-start`, use the Codex Playwright plugin for browser E2E. Do
not run `make stack-chat-smoke` in Codex/Ralph sessions; that target is
intentionally disabled because it delegated to the deprecated shell-launched
browser smoke path.

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

Stage 3 host cutover is now validated through the default build/verify lane:

```bash
cd deck-go
make verify
```

For Codex/Ralph work, browser E2E verification is done with the Codex
Playwright plugin, not the shell-launched `smoke-stage3-*` browser scripts.
The shell smoke path launches Chrome/Chromium from the sandboxed shell and is
known to fail in this environment with browser startup `SIGABRT` / `kill EPERM`.
Do not use it as a migration or Ralph closure gate.

The supported Codex/Ralph E2E path is:

```bash
# Terminal/session 1
DECK_GO_STACK_ENV=/tmp/deck-go-e2e.env deck-go/scripts/manage-local-stack.sh backend-fg

# Terminal/session 2
DECK_GO_STACK_ENV=/tmp/deck-go-e2e.env deck-go/scripts/manage-local-stack.sh frontend-fg

# Terminal/session 3
DECK_GO_STACK_ENV=/tmp/deck-go-e2e.env deck-go/scripts/manage-local-stack.sh runtime-start
```

Then use the Codex Playwright plugin to:

- open the Vite preview URL
- seed `localStorage.deckGoAccessToken`
- verify `Gateway Healthy` and `Runtime running`
- navigate the high-value panels
- send a real Chat message with `browser_type`
- capture console output and JSON artifacts

The latest accepted artifact shape is:

- `deck-go-plugin-core-panels-<backend>-<frontend>.json`
- `deck-go-plugin-chat-send-<backend>-<frontend>.json`
- `deck-go-plugin-console-<backend>-<frontend>.log`

The shell targets `make smoke-stage3-host`, `make smoke-stage3-e2e`,
`make deck-go-stage3-host`, and `make deck-go-stage3-e2e` are intentionally
disabled for Codex/Ralph validation. They must not be selected for future
verification.

If you still want a post-closeout observation window, the optional stabilization
tracker is:

```bash
cd deck-go
make check-stage3-stabilization
```

The optional enforced follow-on gate is:

```bash
make deck-go-stage3-stabilization-enforce
```

The frontend build now includes a structural guard that fails if:

- any panel id in `frontend/src/deck-ui/panel-registry.tsx` is no longer routable through `ActivePanelHost` / `panel-component-registry.tsx`
- any readiness entry in `frontend/src/deck-ui/panel-readiness.ts` regresses away from `ready`
- active panels reintroduce compile-target-incompatible helper patterns

## 5. What this proves

- onboarding/bootstrap works against the external backend
- core panel loading works through the active Vite host
- gateway lifecycle controls are reachable from the UI
- browser-initiated lifecycle actions hit `deck-go` directly
- `frontend-next` is no longer required in the default build/run path
- the active panel registry is structurally complete from the Vite host's point of view

## 6. Known constraints

- `make verify` still proves the default repo gate, but Stage 3 closure now
  additionally relies on Codex Playwright plugin artifacts for browser-backed
  host workflows
- if `VITE_DECK_GO_API_BASE` is omitted, `deck-client.ts` stays on relative `/api/*` paths and therefore requires the current host origin to be the backend
- `frontend-next` may still be retained in-repo for archive/reference-only comparison, but it is not part of the default host path
- shell-launched Playwright/Chromium smoke is not a Codex/Ralph validation
  path because this environment cannot reliably launch or control that browser
  process
