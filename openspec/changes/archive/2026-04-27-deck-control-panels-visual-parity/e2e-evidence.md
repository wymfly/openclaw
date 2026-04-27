# E2E Evidence: Control Deck Panel Visual Parity

## Status

Passed on the merged `enhanced` branch with Playwright MCP after Codex restart.

## Scope

- Budget
- Alerts
- Channels
- Plugins
- Routing
- Subagents
- Identity
- Config
- Nodes
- Docs
- Settings

## Required Evidence

- Local stack status from `deck-go/scripts/manage-local-stack.sh status`
- Playwright MCP route/mode matrix result
- Representative screenshots:
  - `control-channels-dark-en.png`
  - `control-config-light-zh.png`
  - `control-settings-dark-en.png`
- Console/error review
- Accepted unavailable-state rationale, if any
- Final verification commands and results

## Results

2026-04-27 21:30 CST partial closure evidence:

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
- Budget, Alerts, Channels, Plugins, Routing, Subagents, Identity, Config,
  Nodes, Docs, and Settings passed the Playwright MCP desktop matrix across
  `en/dark`, `en/light`, `zh/dark`, and `zh/light`.
- Console review: no browser console errors and no page errors in the final
  Control matrix.
- Screenshots:
  - `.omx/artifacts/deck-go-visual-parity-e2e-closure/control-channels-dark-en.png`
  - `.omx/artifacts/deck-go-visual-parity-e2e-closure/control-config-light-zh.png`
  - `.omx/artifacts/deck-go-visual-parity-e2e-closure/control-settings-dark-en.png`
- Accepted unavailable-state rationale: none. The first Control pass treated
  the Settings panel's legitimate Access Token field as an auth-gate match.
  Settings was rerun with exact auth-gate text detection and passed all four
  locale/theme modes.

2026-04-27 22:01 CST fresh Playwright MCP closure check:

- Reused the restarted Playwright MCP session and ran the full desktop matrix
  for all four visual parity proposals: 25 panels x 4 locale/theme modes = 100
  checks.
- Control coverage in that run: 44 checks for Budget, Alerts, Channels, Plugins,
  Routing, Subagents, Identity, Config, Nodes, Docs, and Settings.
- Result: 0 failures, 0 browser console errors, 0 page errors. Representative
  Control samples `channels/en/dark` and `settings/zh/light` had
  `.deck-ui-shell`, no error boundary, no auth gate, matching `lang`, and no
  horizontal overflow.
