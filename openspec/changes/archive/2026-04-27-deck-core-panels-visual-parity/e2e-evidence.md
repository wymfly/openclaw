# E2E Evidence: Core Deck Panel Visual Parity

## Status

Passed on the merged `enhanced` branch with Playwright MCP after Codex restart.

## Scope

- Agents
- Gateway
- Models

## Required Evidence

- Local stack status from `deck-go/scripts/manage-local-stack.sh status`
- Playwright MCP route/mode matrix result
- Representative screenshots:
  - `core-agents-dark-en.png`
  - `core-models-light-zh.png`
- Console/error review
- Accepted unavailable-state rationale, if any
- Final verification commands and results

## Results

2026-04-27 21:30 CST preflight evidence:

- `deck-go/scripts/manage-local-stack.sh status` passed. Go backend and Vite
  frontend are reachable, and the Go-managed source Gateway runtime reports
  `health: healthy` at `ws://127.0.0.1:18789`.
- Playwright MCP was attempted through `mcp__playwright__` after clearing the
  current session's Playwright MCP process and the Codex App server's leaked
  `@playwright/mcp` children. The plugin still returned
  `browserBackend.callTool: Target page, context or browser has been closed`
  and did not spawn a fresh current-session backend.
- `pnpm --dir deck-go/frontend build` passed after the merge.
- `pnpm --dir deck-go/frontend test:deck-ui` passed after fixing an
  IdentityPanel test selection race in the merged control panel surface:
  83 test files, 615 tests.

2026-04-27 post-restart Playwright MCP evidence:

- Codex restart restored Playwright MCP. Minimal `browser_tabs/new` passed.
- The local stack was restarted with backend/frontend foreground sessions.
  `deck-go/scripts/manage-local-stack.sh status` reported backend/frontend
  reachable and managed source Gateway `status: running`, `health: healthy`.
- Agents, Gateway, and Models passed the Playwright MCP desktop matrix across
  `en/dark`, `en/light`, `zh/dark`, and `zh/light`.
- Console review: no browser console errors and no page errors in the final
  Core matrix.
- Screenshots:
  - `.omx/artifacts/deck-go-visual-parity-e2e-closure/core-agents-dark-en.png`
  - `.omx/artifacts/deck-go-visual-parity-e2e-closure/core-models-light-zh.png`
- Accepted unavailable-state rationale: none. The first Core pass used a fixed
  900 ms wait and saw transient Models "Connecting gateway" states; the rerun
  waited for `.deck-ui-shell` and all modes passed.

2026-04-27 22:01 CST fresh Playwright MCP closure check:

- Reused the restarted Playwright MCP session and ran the full desktop matrix
  for all four visual parity proposals: 25 panels x 4 locale/theme modes = 100
  checks.
- Core coverage in that run: 12 checks for Agents, Gateway, and Models.
- Result: 0 failures, 0 browser console errors, 0 page errors. The representative
  Core sample `agents/en/dark` had `.deck-ui-shell`, no error boundary, no auth
  gate, matching `lang`, and no horizontal overflow.
