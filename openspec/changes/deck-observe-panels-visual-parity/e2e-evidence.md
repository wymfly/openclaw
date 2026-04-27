# E2E Evidence: Observe Deck Panel Visual Parity

## Status

Blocked on Playwright MCP browser context recovery. Non-browser gates are passing on
the merged `enhanced` branch.

## Scope

- Usage
- Sessions
- Memory
- Logs
- Activity
- Threads
- API Explorer

## Required Evidence

- Local stack status from `deck-go/scripts/manage-local-stack.sh status`
- Playwright MCP route/mode matrix result
- Representative screenshots:
  - `observe-sessions-dark-en.png`
  - `observe-api-explorer-light-zh.png`
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

Remaining blocker before marking this change complete:

- Run the Playwright MCP route/mode matrix for Usage, Sessions, Memory, Logs,
  Activity, Threads, and API Explorer, and save the required screenshots plus
  console review artifacts.
