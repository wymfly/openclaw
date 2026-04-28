# deck-go

Parallel Deck migration project.

Goals for phase 0:

- keep the legacy `dashboard/` runnable and untouched except for critical fixes
- establish a sibling project for the Go-backed control-plane migration
- preserve a single React frontend product
- preserve chat inside that frontend product
- create the documentation and contract locations required by the approved PRD

Directory map:

- `backend/` — Go control-plane / BFF
- `frontend/` — React SPA
- `contracts/` — generated and owned contract artifacts
- `docs/` — parity, cutover, governance, and deployment evidence
- `dev/` — local side-by-side development helpers

Gateway protocol workflow:

```bash
cd deck-go
make protocol-update          # regenerate Gateway TS + Go typed bindings
make protocol-check           # CHECK_MODE drift check, no file writes
make fork-divergence-report   # refresh docs/fork-divergent-methods.md
make benchmark-rpc            # loopback RPC latency guard
```

Generated Gateway artifacts:

- `contracts/generated/ts/gateway/` — TS `GatewayMethodMap`, typed client, and allowlist
- `backend/internal/gateway/generated/` — Go typed bindings and method allowlist

Backend RPC calls through `gateway.Client.Request` reuse `gateway.Realtime` so
one-off RPC wrappers and subscriptions share the same Gateway WebSocket
connection.

Local Stage 3 operator stack:

- copy `deck-go/.env.example` to `deck-go/.env`
- `cd deck-go && make stack-start`
- `cd deck-go && make stack-chat-smoke`
- To force local Chrome for the browser smoke:
  `DECK_GO_SMOKE_BROWSER=chrome make stack-chat-smoke`
- If the environment cannot launch Chrome/Chromium directly, run Chrome outside
  the sandbox and connect over CDP:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9333 \
  --user-data-dir=/tmp/deck-go-smoke-chrome \
  --no-first-run \
  --no-default-browser-check

DECK_GO_SMOKE_BROWSER=cdp \
DECK_GO_SMOKE_CDP_URL=http://127.0.0.1:9333 \
make stack-chat-smoke
```

That stack uses:

- `backend/` as the control-plane truth
- `frontend/` as the active Vite host
- `deck-go` backend managed runtime APIs to own the local Gateway lifecycle
- `stack-chat-smoke` as the focused browser proof that the live frontend can unlock,
  send a chat message, and render the assistant reply through the active host
