# Frontend

This directory is the active Stage 3 Deck host.

Current facts:

- `src/main.tsx` boots the restored Vite host by default
- browser transport goes through `src/lib/deck-client.ts`
- the build now runs `scripts/check-restored-host.mjs` before TypeScript/Vite
- `frontend-next/` is archive/reference-only and is no longer the active host path

Build / preview:

```bash
cd deck-go/frontend
VITE_DECK_GO_API_BASE=http://127.0.0.1:19566 \
npm run build

VITE_DECK_GO_API_BASE=http://127.0.0.1:19566 \
npm run preview -- --host 127.0.0.1
```

Canonical local smoke:

```bash
cd deck-go
make smoke-stage3-host
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
flow by creating a session, sending a message, waiting for user+assistant
history messages to appear, and aborting the started run.

That smoke now proves three layers together:

- backend is reachable through a configured Deck access-token path
- backend bootstrap/runtime endpoints respond
- runtime gateway start preflight returns the expected operator-visible error when
  the local smoke environment lacks a managed gateway token
- Vite preview serves the active host bundle
- a headless browser can hydrate the page and find the restored shell text
  (`Deck Go operator shell`, `Gateway`, `Runtime`, `Chat`)

Host guardrails:

- all panel ids from `src/restoration/panel-registry.tsx` must stay implemented in `src/restoration/ActivePanelHost.tsx`
- `src/restoration/contract-readiness.ts` must not regress any panel back to `frontend-blocked`
- restored panels must stay compatible with the current frontend TypeScript/lib target
