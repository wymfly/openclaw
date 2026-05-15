# deck-go Guidelines

`deck-go/` is the current second-development mainline for this repository. It is
an enterprise management and operations platform built on top of OpenClaw, with a
Go backend, React/Vite frontend, and its own contract generation chain.

## Scope

- This file governs `deck-go/` and all child paths unless a deeper guide gives
  more specific rules.
- New Deck features, requirements, and bug fixes default here.
- Do not implement new work in legacy `dashboard/`, `deck-e2e/`, or `deploy/`
  unless the user explicitly asks for legacy maintenance.
- Do not copy `dashboard/` implementation details for "parity" by default.
  `dashboard/` is a legacy Next.js client; `deck-go/` is a separate architecture.

## Architecture

- Runtime mode is `.env`-driven and not switched at runtime.
- `local` mode connects to a local OpenClaw Gateway service installed through
  this repository's `dist/entry.js gateway install/start` CLI path.
- `remote` mode connects to a remote Gateway and may persist endpoint overrides
  in `deck-state.json`.
- Browser code talks only to the deck-go backend. It must not directly call
  Gateway.
- Backend runtime code is split by physical boundary under
  `backend/internal/runtime/`:
  - `facade/` defines the shared runtime interface.
  - `local/` owns local Gateway service lifecycle behavior.
  - `remote/` owns remote Gateway connection behavior.
  - `envconf/`, `state/`, `shared/`, and related packages support both modes.
- Keep local and remote implementation details isolated behind the facade.

## Contracts

`deck-go/contracts/` is the authority chain for Deck-facing and Gateway-facing
contracts.

- Gateway protocol shapes come from OpenClaw Gateway authority when schemas
  exist. Do not hand-redefine them in deck-go.
- Generated Gateway artifacts live under `contracts/generated/ts/gateway/` and
  `backend/internal/gateway/generated/`. Do not hand-edit generated files.
- Deck-facing DTO authority is `contracts/source/deck-api.contract.ts`.
- Browser endpoint classification is
  `contracts/source/deck-endpoints.contract.json`.
- Active dynamic or upstream-schema-missing exceptions belong in
  `contracts/source/deck-exceptions.contract.json`.
- SSE payload contracts belong in `contracts/source/deck-streams.contract.json`.
- UI contract metadata belongs in `contracts/source/deck-ui.contract.json`.
- Frontend-local `DeckGo*` DTOs are migration shims, not source authority.

Run contract commands from `deck-go/`:

| Command                  | Purpose                               |
| ------------------------ | ------------------------------------- |
| `make contracts-sync`    | Regenerate Deck-facing TS + Go DTOs   |
| `make contracts-check`   | Check Deck-facing generated artifacts |
| `make protocol-update`   | Regenerate Gateway TS + Go artifacts  |
| `make protocol-check`    | Verify generated Gateway artifacts    |
| `make ui-metadata-sync`  | Regenerate UI metadata TS + docs      |
| `make ui-metadata-check` | Check UI metadata drift               |
| `make contract-gate`     | Run the contract governance gate      |

When contract checks fail, fix the source contract or generator first, then rerun
the matching sync/check target.

## Backend

- Go module: `backend/go.mod`, Go `1.24.0`.
- Prefer `gofmt` and idiomatic Go package boundaries.
- Keep runtime-mode branching localized. Shared callers should depend on facade
  interfaces rather than testing concrete mode packages.
- Use `make backend-test` for normal backend verification.
- For concurrency, supervisor, websocket, or runtime lifecycle changes, prefer a
  focused `go test` on the touched package first, then broaden to
  `make backend-test`.

## Frontend

- Active frontend workspace: `frontend-new/`.
- Legacy frontend workspace: `frontend/` is frozen and kept as a migration
  reference. Do not add new modules there.
- Design handoff workspace: `frontend-handoff/` is for design-agent output and
  module handoff packages.
- `frontend-new/src/design-system/tokens/index.css` is the frontend token
  authority.
- `frontend-new/src/design-system/atoms/` owns the 36 flat atom files and their
  tests.
- `frontend-new/src/design-system/hooks/` owns shared design-system hooks.
- New business modules go under `frontend-new/src/components/panels/<module>/`.
- Prefer design-system atoms, hooks, tokens, and patterns over ad hoc styling.
- Production frontend code should avoid inline styles.
- Run `make frontend-build` for active frontend build verification.

Read deeper frontend protocol files when touching those areas:

- `docs/AGENTS.md` — deck-go docs map and current project context
- `frontend-new/AGENTS.md` — active engineering workspace protocol
- `frontend-handoff/AGENTS.md` — design-to-engineering handoff protocol
- `frontend/AGENTS.md` — frozen legacy warning and migration context

## Runtime And Dev Scripts

- `.env` samples:
  - `.env.local.example`
  - `.env.remote.example`
  - `.env.real-stack.example`
- Local backend scripts:
  - `scripts/dev/run-stack-mock.sh`
  - `scripts/dev/run-local.sh`
  - `scripts/dev/run-remote.sh`
- Real Gateway stack script:
  - `scripts/dev/run-stack-real.sh`

Operator stack targets must name their Gateway layer explicitly:

| Target family       | Gateway                          | Use                                               |
| ------------------- | -------------------------------- | ------------------------------------------------- |
| `make mock-stack-*` | `test/fixtures/mock-gateway.mjs` | mock visual/debug and CI-friendly behavior checks |
| `make real-stack-*` | real OpenClaw Gateway            | manual E2E and real contract-chain validation     |

Legacy `make stack-*` targets are mock aliases only. Do not use them when a
real OpenClaw Gateway is required.

`run-stack-real.sh` is the default operator infrastructure for real Gateway
coverage. It starts OpenClaw Gateway, backend, and a Vite frontend server, and
clears the fixed ports before startup. The frontend defaults to Vite dev mode
for visual debugging; set `DECK_GO_FRONTEND_MODE=preview` when a built-output
smoke is needed. The script defaults to `deck-go/.env.real-stack` and supports
`DECK_GO_REAL_STACK_ENV` for alternate real-stack env files.

Important L2 real-stack facts:

- Gateway: `18789`
- backend: `19566`
- Vite frontend: `4174`
- Real-stack Gateway startup uses `node dist/entry.js gateway install` followed
  by `gateway start`, with per-repo service naming set through
  `OPENCLAW_LAUNCHD_LABEL` / `OPENCLAW_SYSTEMD_UNIT` /
  `OPENCLAW_WINDOWS_TASK_NAME`. Do not reintroduce direct `gateway run` spawn
  shortcuts for real E2E/debug.
- The preferred local real E2E env uses an isolated copy of OpenClaw state under
  `deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state`.
  `run-stack-real.sh` prefers `gateway.auth.token` from that isolated
  `openclaw.json` so deck-go backend and Gateway auth stay aligned.
- The full stack/E2E matrix lives in
  `docs/project/e2e-stack-operations.md`.

## Testing

Two E2E layers coexist:

- L1 mock Gateway: `test/e2e/{bundled,remote}.spec.ts`, `test/e2e/*-visual.spec.ts`,
  and `test/fixtures/mock-gateway.mjs`. Use `make e2e-mock-runtime`,
  `make e2e-mock-module MODULE=<name>`, or `make e2e-mock-visual`.
- L2 real Gateway: `test/e2e/real-gateway.spec.ts` and
  `test/e2e/*-real-gateway.spec.ts`. Use `make e2e-real-smoke`,
  `make e2e-real-module MODULE=<name>`, or `make e2e-real-all`.
  These specs must keep the `DECK_GO_REAL_GATEWAY_E2E=1` guard.

Verification by touched surface:

| Touched surface                  | Preferred verification                            |
| -------------------------------- | ------------------------------------------------- |
| Broad deck-go change             | `make verify`                                     |
| Contracts or generated artifacts | `make contract-gate` or the narrow matching check |
| Gateway protocol generation      | `make protocol-check`                             |
| Backend runtime/API              | `make backend-test`                               |
| Frontend active workspace        | `make frontend-build`                             |
| Stack/runtime behavior           | real-stack script plus focused browser/API smoke  |

Do not mark generated artifacts, contract inventories, or snapshots as updated
only to silence checks without understanding the source authority and getting
approval for baseline-style changes.

## OpenSpec

- If an active OpenSpec change governs the work, its `proposal.md`, `design.md`,
  `tasks.md`, `specs/**/*.md`, and `verification.yaml` are the source of truth.
- For current runtime-mode work, follow
  `openspec/changes/runtime-mode-decoupling/tasks.md`.
- During `/goal` execution, use thin vertical slices, mark OpenSpec tasks only
  after verification, and run the relevant `openspec validate` before declaring
  implementation complete.
