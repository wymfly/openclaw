# deck-go E2E Stack Operations

This file is the operator matrix for deck-go debugging and E2E. It separates
mock Gateway, real OpenClaw Gateway, and automated Playwright runs so scripts,
configuration, and test intent stay aligned.

All paths below are repo-root relative unless stated otherwise.

## Operator Stacks

| Intent                | Command                                 | Gateway                              | Env file                  | State/config root                                                       |
| --------------------- | --------------------------------------- | ------------------------------------ | ------------------------- | ----------------------------------------------------------------------- |
| Mock UI/debug         | `cd deck-go && make mock-stack-restart` | `test/fixtures/mock-gateway.mjs`     | `deck-go/.env`            | `deck-go/.local/deck-go-stack/data/managed-gateway-state`               |
| Real Gateway UI/debug | `cd deck-go && make real-stack-restart` | `node dist/entry.js gateway run ...` | `deck-go/.env.real-stack` | `deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state` |

Legacy `make stack-*` targets remain as aliases for `mock-stack-*` and print a
warning. Do not use `make stack-*` when you need the real OpenClaw Gateway.
Mock and real operator stacks share the fixed local ports, so treat them as
mutually exclusive and switch with `make mock-stack-restart` or
`make real-stack-restart`.

## Mock Stack

Use mock stack for frontend visual convergence, CI-friendly panel behavior, and
contract-shaped UI states that should not depend on real Gateway availability.

Commands:

```bash
cd deck-go
make mock-stack-restart
make mock-stack-status
make mock-stack-logs
```

Default facts:

- Frontend: `http://127.0.0.1:4174`
- Backend: `http://127.0.0.1:19566`
- Gateway port: `18789`, served by `test/fixtures/mock-gateway.mjs`
- Request log: `deck-go/.local/deck-go-stack/logs/mock-gateway-requests.jsonl`
- `openclaw.json` under this state root is mock/managed state, not real Gateway
  truth.

## Real Gateway Stack

Use real stack for manual E2E, product validation, and contract-chain evidence
against OpenClaw Gateway.

Commands:

```bash
cd deck-go
make real-stack-restart
make real-stack-status
make real-stack-logs
```

Default facts:

- Frontend: `http://127.0.0.1:4174`
- Backend: `http://127.0.0.1:19566`
- Gateway: `ws://127.0.0.1:18789`, served by real OpenClaw Gateway
- Env file: `deck-go/.env.real-stack`
- `openclaw.json`:
  `deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state/openclaw.json`
- Workspace:
  `deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state/workspace`

`run-stack-real.sh` uses `node dist/entry.js gateway run --bind loopback --port
18789 --allow-unconfigured` by default. Do not use `pnpm openclaw gateway run`
for this path because it can trigger dirty-tree rebuilds and runtime-postbuild
dependency staging.

The script prefers `gateway.auth.token` from the isolated `openclaw.json` when
present, so deck-go backend and Gateway auth stay aligned. The env token remains
only a fallback.

## Automated Playwright E2E

Automated Playwright specs do not require the operator stack to already be
running; the helpers start disposable stacks with temporary ports.

| Test class          | Naming                              | Helper                                          | Command                                                        |
| ------------------- | ----------------------------------- | ----------------------------------------------- | -------------------------------------------------------------- |
| Mock runtime smoke  | `bundled.spec.ts`, `remote.spec.ts` | `startBundledStack`, `startRemoteFirstRunStack` | `make e2e-mock-runtime`                                        |
| Mock visual/module  | `*-visual.spec.ts`                  | `startBundledStack`                             | `make e2e-mock-module MODULE=agents` or `make e2e-mock-visual` |
| Real Gateway smoke  | `real-gateway.spec.ts`              | `startRealGatewayStack`                         | `make e2e-real-smoke`                                          |
| Real Gateway module | `*-real-gateway.spec.ts`            | `startRealGatewayStack`                         | `make e2e-real-module MODULE=agents` or `make e2e-real-all`    |

Real Gateway automated specs must keep `test.skip(process.env.DECK_GO_REAL_GATEWAY_E2E !== "1", ...)`
so they never run accidentally in offline/mock-only workflows.

## Alignment Rules

- Mock visual specs use `*-visual.spec.ts` and `startBundledStack`.
- Real contract/function specs use `*-real-gateway.spec.ts` and
  `startRealGatewayStack`.
- Do not point a real Gateway spec at `test/fixtures/mock-gateway.mjs`.
- Do not use `make stack-*` in new docs or test instructions; write
  `mock-stack-*` or `real-stack-*` explicitly.
- If a spec supports an already-running external real stack, name the env vars
  explicitly in the spec and document that it is an exception.
- When adding a new module, add both `MODULE-visual.spec.ts` and
  `MODULE-real-gateway.spec.ts` unless the OpenSpec proposal records why one
  layer is intentionally skipped.

## Quick Diagnosis

If the frontend looks connected but Gateway calls fail, check in this order:

```bash
cd deck-go
make real-stack-status
curl --noproxy '*' -sS http://127.0.0.1:18789/ | head
```

The real Gateway root should return the OpenClaw Control HTML title, not the
mock Gateway text. If `/api/gateway/health` reports token mismatch, verify that
`deck-go/.env.real-stack` points at the intended isolated state directory and
that `openclaw.json` contains the token the Gateway is using.
