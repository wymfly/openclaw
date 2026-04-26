# Frontend

This directory is the active Vite Deck host.

Current facts:

- `src/main.tsx` boots the active `deck-ui` host by default
- browser transport goes through `src/lib/deck-client.ts`
- browser transport now recognizes only `VITE_DECK_GO_API_BASE`; otherwise it stays on the current host origin
- the build runs `scripts/check-deck-ui-host.mjs` before TypeScript/Vite
- `frontend-next/` is archive/reference-only and is no longer the active host path

Build / preview:

```bash
cd deck-go/frontend
npm run test:deck-ui
npm run test:deck-ui -- src/stores/__tests__/chat-store.test.ts

VITE_DECK_GO_API_BASE=http://127.0.0.1:19566 \
npm run build

VITE_DECK_GO_API_BASE=http://127.0.0.1:19566 \
npm run preview -- --host 127.0.0.1
```

Local operator stack wrapper:

```bash
cd deck-go
cp .env.example .env
make stack-start
make stack-chat-smoke
```

That wrapper keeps one shared `deck-go/.env` as the source of truth for:

- backend address and data dir
- deck access token
- managed gateway token
- active Vite host base URL

`make stack-chat-smoke` is the focused local browser proof for the active host's
chat path. It validates unlock + send + assistant reply visibility without
re-running the heavier reconnect continuity lane from Stage 3 closure smoke.
When a sandbox cannot launch Chrome/Chromium, start Chrome outside the sandbox
with `--remote-debugging-port=9333` and run the smoke with
`DECK_GO_SMOKE_BROWSER=cdp DECK_GO_SMOKE_CDP_URL=http://127.0.0.1:9333`.

Canonical local smoke:

```bash
cd deck-go
make smoke-stage3-host
```

Canonical active-host E2E closure suite:

```bash
cd deck-go
make smoke-stage3-e2e
```

Richer local smoke, if you also have a managed Gateway token available:

```bash
cd deck-go
DECK_GO_SMOKE_GATEWAY_TOKEN=<gateway-token> \
make smoke-stage3-host
```

That richer lane waits for managed runtime `running/healthy` and upgrades key
runtime-backed routes such as `logs`, `models config`, `config`, `channels`,
`plugins`, and `sessions` to `200` proofs. It also proves a minimal chat control
flow by creating a session, sending a message, waiting for the expected
assistant reply `314159` to land in history, surfacing that same assistant reply
in visible transcript content, surviving a page reload, aborting the active or
already-finished run, and completing a
managed runtime stop/start cycle back to `running/healthy`.

`make smoke-stage3-e2e` runs both supported Stage 3 host lanes in sequence:

- the default/basic auth + bootstrap smoke
- the richer managed-runtime/browser workflow smoke

If you still want a post-closeout observation window, the optional
stabilization tracker is:

```bash
cd deck-go
make check-stage3-stabilization
```

That smoke now proves three layers together:

- backend is reachable through a configured Deck access-token path
- backend bootstrap/runtime endpoints respond
- runtime gateway start preflight returns the expected operator-visible error when
  the local smoke environment lacks a managed gateway token
- Vite preview serves the active host bundle
- a browser can hydrate the page and find the active deck-ui shell text
  (`Gateway`, `Runtime`, `Chat`)

Host guardrails:

- all panel ids from `src/deck-ui/panel-registry.tsx` must stay routable through `src/deck-ui/ActivePanelHost.tsx` and `src/deck-ui/panel-component-registry.tsx`
- `src/deck-ui/panel-readiness.ts` must keep all active panels at `ready`
- active panel components must stay compatible with the current frontend TypeScript/lib target
- `src/shell-components.test.tsx` now locks readable transcript rendering for `text`, `tool_use`, and `tool_result` blocks
