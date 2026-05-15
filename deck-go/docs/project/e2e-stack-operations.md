# deck-go E2E Stack Operations

This file is the operator matrix for deck-go debugging and E2E. It separates
mock Gateway, real OpenClaw Gateway, and automated Playwright runs so scripts,
configuration, and test intent stay aligned.

All paths below are repo-root relative unless stated otherwise.

## Operator Stacks

| Intent                | Command                                 | Gateway                                    | Env file                  | State/config root                                                       |
| --------------------- | --------------------------------------- | ------------------------------------------ | ------------------------- | ----------------------------------------------------------------------- |
| Mock UI/debug         | `cd deck-go && make mock-stack-restart` | `test/fixtures/mock-gateway.mjs`           | `deck-go/.env`            | `deck-go/.local/deck-go-stack/data/managed-gateway-state`               |
| Real Gateway UI/debug | `cd deck-go && make real-stack-restart` | `node dist/entry.js gateway install/start` | `deck-go/.env.real-stack` | `deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state` |

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

This state root is the canonical full real-stack configuration for manual E2E.
Keep long-lived agents, providers, sessions, and workspaces here. Automated real
Playwright specs read its `openclaw.json` as the source seed, then copy it into a
per-run temp state directory before installing the Gateway service so test
cleanup cannot rewrite the canonical config.

`run-stack-real.sh` installs the per-repo Gateway service with
`node dist/entry.js gateway install --port 18789 --token ... --force`, then
starts it with `node dist/entry.js gateway start` before launching the deck-go
backend. Do not bypass this with direct `gateway run`; real-stack verification
must exercise the same install/start path used by local mode.

The script prefers `gateway.auth.token` from the isolated `openclaw.json` when
present, so deck-go backend and Gateway auth stay aligned. `OPENCLAW_GATEWAY_TOKEN`
remains only a fallback.

## Automated Playwright E2E

Automated Playwright specs do not require the operator stack to already be
running; the helpers start disposable stacks with temporary ports.

| Test class          | Naming                                     | Helper                                        | Command                                                        |
| ------------------- | ------------------------------------------ | --------------------------------------------- | -------------------------------------------------------------- |
| Mock runtime smoke  | `mock.spec.ts`, `operations-panel.spec.ts` | `startLocalStack`, `startRemoteFirstRunStack` | `make e2e-mock-runtime`                                        |
| Mock visual/module  | `*-visual.spec.ts`                         | `startLocalStack`                             | `make e2e-mock-module MODULE=agents` or `make e2e-mock-visual` |
| Real Gateway smoke  | `real-gateway.spec.ts`                     | `startRealGatewayStack`                       | `make e2e-real-smoke`                                          |
| Real Gateway module | `*-real-gateway.spec.ts`                   | `startRealGatewayStack`                       | `make e2e-real-module MODULE=agents` or `make e2e-real-all`    |

Real Gateway automated specs must keep `test.skip(process.env.DECK_GO_REAL_GATEWAY_E2E !== "1", ...)`
so they never run accidentally in offline/mock-only workflows.

## Alignment Rules

- Mock visual specs use `*-visual.spec.ts` and `startLocalStack`.
- Real contract/function specs use `*-real-gateway.spec.ts` and
  `startRealGatewayStack`.
- Do not point a real Gateway spec at `test/fixtures/mock-gateway.mjs`.
- Real Gateway automated specs install/start the per-repo Gateway service with
  `OPENCLAW_LAUNCHD_LABEL` / `OPENCLAW_SYSTEMD_UNIT` /
  `OPENCLAW_WINDOWS_TASK_NAME`, seed from the canonical full real-stack
  `openclaw.json`, set `OPENCLAW_STATE_DIR` to a per-run temp
  `managed-gateway-state` directory, and uninstall the service during teardown.
  Cleanup failure is a test failure, not a warning.
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

## Manual Real-Stack Smoke

Owner-run acceptance for the real stack:

1. `cd deck-go && scripts/dev/run-stack-real.sh start` installs and starts the
   per-repo Gateway service.
2. The Gateway status reaches `running`, and deck-go reports local mode through
   `/api/runtime/gateway`.
3. A browser chat session reaches the first response token through the real
   Gateway.
4. `scripts/dev/run-stack-real.sh stop` invokes the service cleanup path and
   leaves no listener on the Gateway port.

This manual smoke is owner-only evidence for the OpenSpec task; automated Stage
3 changes document and preserve the path but do not mark the owner-run item
complete without owner sign-off.
