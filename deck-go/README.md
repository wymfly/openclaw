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
make gateway-typecheck        # block untyped Gateway regressions
make gateway-coverage-report  # refresh typed coverage baseline/report
make benchmark-rpc            # loopback RPC latency guard
```

Generated Gateway artifacts:

- `contracts/generated/ts/gateway/` — TS `GatewayMethodMap`, typed client, and allowlist
- `backend/internal/gateway/generated/` — Go typed bindings and method allowlist

Backend RPC calls through `gateway.Client.Request` reuse `gateway.Realtime` so
one-off RPC wrappers and subscriptions share the same Gateway WebSocket
connection.

All Gateway calls go through typed bindings:

- Go runtime callers use `backend/internal/gateway/generated.TypedClient` or documented `gateway:allow-untyped` D12 exceptions.
- Frontend Gateway RPC proxy calls use `contracts/generated/ts/gateway/client.ts::createGatewayClient` through `frontend/src/lib/gateway-client.ts`.
- Deck Go BFF control-plane, binary, SSE, and upload/download routes are classified in `docs/fe-endpoint-classification.md` and intentionally remain outside typed RPC.
- Run `make gateway-typecheck` before pushing protocol or Deck caller changes; run `make gateway-coverage-report` after upstream syncs or typed migration work.

Local operator stacks:

- Mock Gateway UI/debug: `cd deck-go && make mock-stack-restart`
- Real OpenClaw Gateway UI/debug: `cd deck-go && make real-stack-restart`
- Status/logs: `make mock-stack-status` / `make real-stack-status`, and
  `make mock-stack-logs` / `make real-stack-logs`

Legacy `make stack-*` targets are mock aliases only. Use `real-stack-*` whenever
manual E2E must run against the real OpenClaw Gateway.

See `docs/project/e2e-stack-operations.md` for the full matrix of mock vs real
env files, state directories, and Playwright commands.
